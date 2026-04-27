"""Retro-apply SHA-256 figure dedup to an already-extracted handbook tree.

The same `deduplicate_figures` pass used by the CLI is run after a fresh
extraction. For trees that were committed before the dedup pass landed
(PHAK, AFH, AvWX), we don't have to re-fetch and re-extract every PDF
just to drop redundant PNGs -- the bytes on disk are the bytes the
pipeline produced. This script:

1. Reads `<root>/manifest.json` and reconstructs `FigureRecord`s from
   `manifest["figures"]`.
2. Runs the shared `deduplicate_figures` pass: byte-identical files
   collapse to one canonical PNG; redundant files are deleted.
3. Rewrites `manifest["figures"][i].asset_path` to the canonical paths.
4. Walks every section markdown file and rewrites figure references
   that point at a removed asset to point at the canonical asset
   instead.
5. Records `manifest["extraction"]["figure_dedup"]` so the operation is
   auditable in the manifest.

Usage:

    python -m ingest.dedup_existing <doc> <edition>
    python -m ingest.dedup_existing avwx FAA-H-8083-28B
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import click

from .figures import FigureRecord
from .figures_dedup import deduplicate_figures
from .paths import edition_root, repo_root


@click.command(context_settings={"help_option_names": ["-h", "--help"]})
@click.argument("document_slug")
@click.argument("edition")
def main(document_slug: str, edition: str) -> None:
    """Apply SHA-256 dedup to an existing `handbooks/<doc>/<edition>/` tree."""
    root = edition_root(document_slug, edition)
    manifest_path = root / "manifest.json"
    if not manifest_path.is_file():
        click.echo(f"error: manifest.json missing at {manifest_path}", err=True)
        raise SystemExit(2)

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    fig_entries = manifest.get("figures", [])
    if not fig_entries:
        click.echo("nothing to do: manifest has no figures")
        return

    # Reconstruct FigureRecord list. asset_path in the manifest is repo-
    # relative (e.g. `handbooks/avwx/FAA-H-8083-28B/figures/foo.png`); the
    # dedup pass needs absolute Paths.
    repo = repo_root()
    records: list[FigureRecord] = []
    for entry in fig_entries:
        rel = entry["asset_path"]
        records.append(
            FigureRecord(
                section_code=entry["section_code"],
                ordinal=int(entry["ordinal"]),
                caption=entry["caption"],
                asset_path=(repo / rel).resolve(),
                width=int(entry.get("width") or 0),
                height=int(entry.get("height") or 0),
            )
        )

    # Track original -> canonical absolute path so the markdown rewrite
    # below can replace removed paths in section bodies.
    pre_paths = [r.asset_path for r in records]

    rewritten, dedup_meta = deduplicate_figures(records)
    if dedup_meta["canonicalized"] == 0:
        click.echo("no duplicates found; nothing to rewrite")
        manifest.setdefault("extraction", {})["figure_dedup"] = dedup_meta
        manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        return

    # Build rel-path-based replacement map for the markdown rewrite.
    # Repo-relative POSIX strings (`handbooks/avwx/.../figures/x.png`)
    # are what the section markdown actually contains.
    replacements: dict[str, str] = {}
    for old_abs, rec in zip(pre_paths, rewritten, strict=True):
        new_abs = rec.asset_path
        if old_abs == new_abs:
            continue
        old_rel = _to_repo_rel(old_abs, repo)
        new_rel = _to_repo_rel(new_abs, repo)
        replacements[old_rel] = new_rel

    # Update the manifest's `figures[]` asset paths.
    for entry, rec in zip(fig_entries, rewritten, strict=True):
        entry["asset_path"] = _to_repo_rel(rec.asset_path, repo)
        entry["width"] = rec.width
        entry["height"] = rec.height

    # Walk every section markdown file under the edition root and rewrite
    # figure links that point at a removed asset.
    rewritten_files = 0
    for md_path in sorted(root.rglob("*.md")):
        original = md_path.read_text(encoding="utf-8")
        replaced = original
        for old_rel, new_rel in replacements.items():
            # Two embedding shapes exist in the tree:
            # - `(/handbooks/...)` -- absolute-path style emitted by
            #   `normalize._compose_markdown`.
            # - `(handbooks/...)` -- repo-relative style some chapters
            #   carried before the slash-prefix landed.
            replaced = replaced.replace(f"(/{old_rel})", f"(/{new_rel})")
            replaced = replaced.replace(f"({old_rel})", f"({new_rel})")
        if replaced != original:
            md_path.write_text(replaced, encoding="utf-8")
            rewritten_files += 1

    manifest.setdefault("extraction", {})["figure_dedup"] = dedup_meta
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    click.echo(
        f"dedup complete: {dedup_meta['canonicalized']} files removed, "
        f"{dedup_meta['freed_bytes']} bytes freed, "
        f"{rewritten_files} markdown files rewritten"
    )


def _to_repo_rel(absolute: Path, repo: Path) -> str:
    return str(absolute.relative_to(repo)).replace("\\", "/")


if __name__ == "__main__":
    main()  # pragma: no cover -- click entrypoint
    sys.exit(0)
