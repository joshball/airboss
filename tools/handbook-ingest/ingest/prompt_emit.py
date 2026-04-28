"""Emit the section-extraction prompt set into the per-run output dir.

For `--strategy prompt`, this module renders:

    tools/handbook-ingest/prompts-out/<doc>/<edition>/
      out/                                 # mutable; overwritten each run
        _run.md                            # orchestrator prompt (paste target)
        _parameters.md                     # snapshot of templates/.../parameters.md
        _section_tree_contract.md          # snapshot of prompts/section_tree.md
        _config.yaml                       # snapshot of the handbook YAML
        meta.json                          # write-once replay record
        README.md                          # auto-generated overview
        NN-<slug>.md                       # one per chapter
      archive/<run-id>/                    # frozen snapshot (archive-by-default)
        ... same files as out/ ...

`--no-archive` skips the `archive/<run-id>/` write.

Run-id format: `YYYYMMDD-HHMM` UTC. Collision suffix `-N` for `N >= 2`.

Templates evolve in git history; per-run snapshots are immutable in
`archive/<run-id>/`. Re-running a year later from a frozen run dir
produces the same prompts even if templates have moved on.
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from .chapter_plaintext import ChapterPlaintextSidecar
from .config_loader import HandbookConfig, resolve_config_path
from .outline import OutlineNode
from .paths import edition_root, ensure_dir, relative_to_repo, repo_root
from .sections import SectionBody

# Filenames written into out/ and archive/<run-id>/. Module-level so the
# tests + cli + readme stay in sync.
RUN_FILENAME = "_run.md"
PARAMETERS_FILENAME = "_parameters.md"
CONTRACT_FILENAME = "_section_tree_contract.md"
CONFIG_SNAPSHOT_FILENAME = "_config.yaml"
META_FILENAME = "meta.json"
README_FILENAME = "README.md"

# JSON output filename written into each handbooks/<doc>/<edition>/<NN>/
# directory by the sub-agents (NOT by this module). Recorded in meta.json
# so a reviewer can find every chapter's output without parsing prompts.
LLM_SECTION_TREE_FILENAME = "_llm_section_tree.json"
MODEL_SELF_REPORT_FILENAME = "_model_self_report.txt"

PROMPTS_OUT_DIRNAME = "prompts-out"
"""Top-level dir under tools/handbook-ingest/ that holds per-run output."""

OUT_SUBDIR = "out"
"""Mutable per-run dir; the paste target."""

ARCHIVE_SUBDIR = "archive"
"""Frozen per-run snapshots (archive-by-default)."""


@dataclass(frozen=True)
class PromptEmitResult:
    """Summary of what `emit_prompts` wrote."""

    out_dir: Path
    """Absolute path to the mutable `out/` directory."""

    archive_dir: Path | None
    """Absolute path to the `archive/<run-id>/` snapshot, or None when
    `--no-archive` was passed."""

    run_id: str
    """The run-id used (`YYYYMMDD-HHMM[-N]`)."""

    files_written: int
    """Number of files written to `out/` (does not double-count archive)."""

    chapter_prompt_paths: list[Path]
    """Per-chapter prompt files in ordinal order (under `out/`)."""

    meta_path: Path
    """Absolute path to `out/meta.json`."""


def emit_prompts(
    config: HandbookConfig,
    chapter_nodes: list[OutlineNode],
    chapter_bodies: list[SectionBody],
    sidecars: list[ChapterPlaintextSidecar],
    *,
    source_pdf_sha256: str,
    archive: bool = True,
    now: datetime | None = None,
) -> PromptEmitResult:
    """Render the prompt set into `out/` and (optionally) `archive/<run-id>/`.

    The caller is responsible for writing the chapter sidecars BEFORE
    invoking this function -- `sidecars` carries the descriptors so we
    don't re-hash them.

    `now` is injected for tests so run-id generation is deterministic.
    """
    if len(sidecars) != len([c for c in chapter_nodes if c.level == "chapter"]):
        raise ValueError(
            f"sidecar count ({len(sidecars)}) does not match chapter count "
            f"({len([c for c in chapter_nodes if c.level == 'chapter'])}); "
            f"caller must write a sidecar per chapter before emit_prompts."
        )

    now = now or datetime.now(tz=UTC)
    out_dir = ensure_dir(_prompts_out_root() / config.document_slug / config.edition / OUT_SUBDIR)
    archive_root = _prompts_out_root() / config.document_slug / config.edition / ARCHIVE_SUBDIR

    # Compute templates + their SHA-256s up front; meta.json + README cite
    # them. Templates live next to one another so a single dir read works.
    template_dir = _template_dir()
    parameters_text = _read_template(template_dir / "parameters.md")
    contract_text = _read_template(_root_prompts_dir() / "section_tree.md")
    orchestrator_template = _read_template(template_dir / "orchestrator.md")
    chapter_template = _read_template(template_dir / "chapter.md")
    readme_template = _read_template(template_dir / "run_readme.md")

    config_yaml_text = _read_text(resolve_config_path(config.document_slug))

    # Wipe out/ before re-writing so stale files from a prior run don't
    # survive into a new emission.
    _clear_out_dir(out_dir)

    # Build the per-chapter prompts. Chapter ordinals drive both the
    # prompt filename AND the archive filename so the on-disk order
    # matches the FAA chapter order.
    chapter_only = [c for c in chapter_nodes if c.level == "chapter"]
    chapter_only_sorted = sorted(chapter_only, key=lambda c: c.ordinal)
    sidecar_by_ordinal = {s.chapter_ordinal: s for s in sidecars}
    bodies_by_ordinal = {b.node.ordinal: b for b in chapter_bodies if b.node.level == "chapter"}

    chapter_prompt_paths: list[Path] = []
    chapter_meta: list[dict[str, object]] = []
    contract_relative_for_prompt = relative_to_repo(out_dir / CONTRACT_FILENAME)

    for chap in chapter_only_sorted:
        sidecar = sidecar_by_ordinal.get(chap.ordinal)
        body = bodies_by_ordinal.get(chap.ordinal)
        if sidecar is None or body is None:
            raise ValueError(f"missing sidecar/body for chapter ordinal {chap.ordinal}")
        prompt_filename = f"{chap.ordinal:02d}-{_slugify(chap.title)}.md"
        prompt_path = out_dir / prompt_filename
        page_range = _format_page_range(body)
        chapter_ordinal_padded = f"{chap.ordinal:02d}"
        output_path_rel = relative_to_repo(
            edition_root(config.document_slug, config.edition)
            / chapter_ordinal_padded
            / LLM_SECTION_TREE_FILENAME
        )
        sidecar_path_rel = relative_to_repo(sidecar.path)
        rendered = chapter_template.format(
            document_slug=config.document_slug,
            edition=config.edition,
            title=chap.title,
            chapter_ordinal=chap.ordinal,
            chapter_ordinal_padded=chapter_ordinal_padded,
            page_range=page_range,
            sidecar_path=sidecar_path_rel,
            sidecar_sha256=sidecar.sha256,
            output_path=output_path_rel,
            contract_path=contract_relative_for_prompt,
        )
        prompt_path.write_text(rendered, encoding="utf-8")
        chapter_prompt_paths.append(prompt_path)
        prompt_sha = _sha256_of_text(rendered)
        chapter_meta.append(
            {
                "ordinal": chap.ordinal,
                "code": chap.code,
                "title": chap.title,
                "page_range": page_range,
                "sidecar_path": sidecar_path_rel,
                "sidecar_sha256": sidecar.sha256,
                "sidecar_chars": sidecar.char_count,
                "output_path": output_path_rel,
                "model_self_report_path": relative_to_repo(
                    edition_root(config.document_slug, config.edition)
                    / chapter_ordinal_padded
                    / MODEL_SELF_REPORT_FILENAME
                ),
                "prompt_path": relative_to_repo(prompt_path),
                "prompt_sha256": prompt_sha,
            }
        )

    # Snapshots of static templates -- copied verbatim into out/ so the
    # archive captures every byte the agent sees.
    (out_dir / PARAMETERS_FILENAME).write_text(parameters_text, encoding="utf-8")
    (out_dir / CONTRACT_FILENAME).write_text(contract_text, encoding="utf-8")
    (out_dir / CONFIG_SNAPSHOT_FILENAME).write_text(config_yaml_text, encoding="utf-8")

    # Render the orchestrator with a list of chapter-prompt paths and the
    # chapter count substituted in.
    chapter_paths_block = "\n".join(
        f"- `{relative_to_repo(p)}`" for p in chapter_prompt_paths
    )
    orchestrator_text = orchestrator_template.format(
        document_slug=config.document_slug,
        edition=config.edition,
        chapter_count=len(chapter_prompt_paths),
        chapter_prompt_paths=chapter_paths_block,
    )
    (out_dir / RUN_FILENAME).write_text(orchestrator_text, encoding="utf-8")

    template_hashes = {
        "parameters_md_sha256": _sha256_of_text(parameters_text),
        "section_tree_md_sha256": _sha256_of_text(contract_text),
        "orchestrator_md_sha256": _sha256_of_text(orchestrator_template),
        "chapter_md_sha256": _sha256_of_text(chapter_template),
        "run_readme_md_sha256": _sha256_of_text(readme_template),
    }

    repo_sha = _resolve_repo_sha()

    run_id = _resolve_run_id(now, archive_root)

    meta = {
        "run_id": run_id,
        "generated_at_utc": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "document_slug": config.document_slug,
        "edition": config.edition,
        "repo_sha": repo_sha,
        "source_pdf_sha256": source_pdf_sha256,
        "templates": template_hashes,
        "config": {
            "chapter_text_max_chars": config.chapter_text_max_chars,
            "section_strategy": config.section_strategy,
            "config_yaml_sha256": _sha256_of_text(config_yaml_text),
        },
        "chapters": chapter_meta,
    }
    meta_path = out_dir / META_FILENAME
    meta_path.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")

    readme_text = readme_template.format(
        document_slug=config.document_slug,
        edition=config.edition,
        run_id=run_id,
        generated_at_utc=meta["generated_at_utc"],
        repo_sha=repo_sha,
        **template_hashes,
    )
    (out_dir / README_FILENAME).write_text(readme_text, encoding="utf-8")

    files_written = (
        # static
        4
        # meta + readme + run
        + 3
        + len(chapter_prompt_paths)
    )

    archive_dir: Path | None = None
    if archive:
        archive_dir = ensure_dir(archive_root / run_id)
        # Mirror out/ into archive/<run-id>/. We copy each file individually
        # so a partial copy on error is loud rather than silent.
        for src in sorted(out_dir.iterdir()):
            if src.is_file():
                shutil.copy2(src, archive_dir / src.name)

    return PromptEmitResult(
        out_dir=out_dir,
        archive_dir=archive_dir,
        run_id=run_id,
        files_written=files_written,
        chapter_prompt_paths=chapter_prompt_paths,
        meta_path=meta_path,
    )


def read_meta(config: HandbookConfig) -> dict[str, object]:
    """Read the existing `meta.json` for this handbook's `out/` dir."""
    meta_path = (
        _prompts_out_root() / config.document_slug / config.edition / OUT_SUBDIR / META_FILENAME
    )
    if not meta_path.is_file():
        raise FileNotFoundError(
            f"meta.json missing at {meta_path}; run --strategy prompt first."
        )
    return json.loads(meta_path.read_text(encoding="utf-8"))


def out_dir_for(config: HandbookConfig) -> Path:
    """Return the absolute path to this handbook's `out/` directory."""
    return _prompts_out_root() / config.document_slug / config.edition / OUT_SUBDIR


def _prompts_out_root() -> Path:
    """Top-level `tools/handbook-ingest/prompts-out/` directory."""
    return Path(__file__).resolve().parent.parent / PROMPTS_OUT_DIRNAME


def _template_dir() -> Path:
    """Repo-rooted path to the section-extraction template directory."""
    return Path(__file__).resolve().parent / "prompts" / "section-extraction"


def _root_prompts_dir() -> Path:
    """The `tools/handbook-ingest/ingest/prompts/` dir (holds section_tree.md)."""
    return Path(__file__).resolve().parent / "prompts"


def _read_template(path: Path) -> str:
    if not path.is_file():
        raise FileNotFoundError(f"template missing: {path}")
    return path.read_text(encoding="utf-8")


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _sha256_of_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _format_page_range(body: SectionBody) -> str:
    """Render the printed FAA page range for a chapter body."""
    start = body.faa_page_start or "?"
    end = body.faa_page_end or "?"
    if start == end:
        return start
    return f"{start}..{end}"


_SLUG_RE = re.compile(r"[^a-z0-9]+")


def _slugify(title: str) -> str:
    """Filesystem-safe lower-kebab slug from a chapter title."""
    cleaned = _SLUG_RE.sub("-", title.lower()).strip("-")
    return cleaned or "untitled"


def _resolve_run_id(now: datetime, archive_root: Path) -> str:
    """Pick a sortable run-id, suffix `-N` (N>=2) on collision."""
    base = now.strftime("%Y%m%d-%H%M")
    candidate = archive_root / base
    if not candidate.exists():
        return base
    n = 2
    while (archive_root / f"{base}-{n}").exists():
        n += 1
    return f"{base}-{n}"


def _resolve_repo_sha() -> str:
    """Return the current git HEAD short SHA, or `unknown` on failure."""
    try:
        result = subprocess.run(  # noqa: S603 -- repo-local read-only call
            ["git", "rev-parse", "HEAD"],
            cwd=repo_root(),
            check=True,
            capture_output=True,
            text=True,
        )
        return result.stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return "unknown"


def _clear_out_dir(out_dir: Path) -> None:
    """Remove every file inside `out_dir` (the dir itself stays).

    Re-running with `--strategy prompt` should produce a clean `out/` -- if
    a prior run had more chapters than this run does, the leftover prompt
    files would otherwise survive and confuse the user.
    """
    if not out_dir.is_dir():
        return
    for child in out_dir.iterdir():
        if child.is_file():
            child.unlink()
        elif child.is_dir():
            shutil.rmtree(child)


