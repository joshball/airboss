"""Read per-chapter section trees from the prompt-flow sidecars.

The prompt strategy fans out one sub-agent per chapter; each sub-agent
writes two files into `handbooks/<doc>/<edition>/<NN>/`:

- `_llm_section_tree.json`  -- the strict-JSON section tree.
- `_model_self_report.txt`  -- one line; the model the sub-agent reports
                              running on (e.g. `claude-opus-4-7`).

This module loads those files into `SectionTreeNode` records for the
compare flow. Hard-fails on missing or malformed inputs (no skip-with-
warning per the design doc; the user re-pastes the failing chapter).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .config_loader import HandbookConfig
from .outline import OutlineNode
from .paths import edition_root
from .prompt_emit import LLM_SECTION_TREE_FILENAME, MODEL_SELF_REPORT_FILENAME
from .section_tree import SectionTreeNode

# Provenance label for nodes loaded from the prompt flow's sidecars. Kept
# distinct from the historical `"llm"` value so manifest readers can tell
# the two paths apart even if old artifacts ever resurface.
PROMPT_PROVENANCE = "prompt"


class SidecarMissingError(FileNotFoundError):
    """A chapter's `_llm_section_tree.json` or `_model_self_report.txt` is missing."""


class SidecarMalformedError(ValueError):
    """A chapter's sidecar JSON failed shape checks."""


@dataclass(frozen=True)
class ChapterSidecarLoad:
    """Per-chapter result of loading the prompt-flow sidecars."""

    chapter_ordinal: int
    nodes: list[SectionTreeNode]
    model_self_report: str
    json_path: Path
    model_self_report_path: Path


@dataclass(frozen=True)
class SidecarLoadResult:
    """Aggregate result of `load_chapter_sidecars`."""

    chapters: list[ChapterSidecarLoad]

    @property
    def all_nodes(self) -> list[SectionTreeNode]:
        out: list[SectionTreeNode] = []
        for chap in self.chapters:
            out.extend(chap.nodes)
        return out

    @property
    def model_self_reports(self) -> dict[int, str]:
        return {c.chapter_ordinal: c.model_self_report for c in self.chapters}


def load_chapter_sidecars(
    config: HandbookConfig,
    chapter_nodes: list[OutlineNode],
) -> SidecarLoadResult:
    """Read every chapter's `_llm_section_tree.json` + `_model_self_report.txt`.

    Hard-fails on missing files OR malformed JSON (no skip-with-warning).
    The user re-pastes the failing chapter's prompt manually if a retry
    is needed.
    """
    chapters: list[ChapterSidecarLoad] = []
    base = edition_root(config.document_slug, config.edition)
    for chap in chapter_nodes:
        if chap.level != "chapter":
            continue
        chap_dir = base / f"{chap.ordinal:02d}"
        json_path = chap_dir / LLM_SECTION_TREE_FILENAME
        report_path = chap_dir / MODEL_SELF_REPORT_FILENAME
        if not json_path.is_file():
            raise SidecarMissingError(
                f"chapter {chap.ordinal}: missing {json_path}. "
                f"Re-paste prompts-out/{config.document_slug}/{config.edition}/out/_run.md "
                f"into a fresh Claude Code session and wait for sub-agents to finish."
            )
        if not report_path.is_file():
            raise SidecarMissingError(
                f"chapter {chap.ordinal}: missing {report_path}. "
                f"Sub-agents must emit `_model_self_report.txt` alongside the JSON. "
                f"Re-paste the chapter prompt or the full _run.md."
            )
        try:
            raw = json.loads(json_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise SidecarMalformedError(
                f"chapter {chap.ordinal}: {json_path} is not valid JSON: {exc}. "
                f"Re-paste this chapter's prompt and re-run --strategy compare."
            ) from exc
        if not isinstance(raw, list):
            raise SidecarMalformedError(
                f"chapter {chap.ordinal}: {json_path} must be a JSON array; "
                f"got {type(raw).__name__}."
            )
        for entry in raw:
            if not isinstance(entry, dict):
                raise SidecarMalformedError(
                    f"chapter {chap.ordinal}: {json_path} array entries must be objects; "
                    f"got {type(entry).__name__}."
                )
        nodes = _entries_to_nodes(raw, chap.ordinal, json_path)
        report_text = report_path.read_text(encoding="utf-8").strip()
        if not report_text:
            raise SidecarMalformedError(
                f"chapter {chap.ordinal}: {report_path} is empty; "
                f"sub-agents must write the model name on a single line."
            )
        chapters.append(
            ChapterSidecarLoad(
                chapter_ordinal=chap.ordinal,
                nodes=nodes,
                model_self_report=report_text.splitlines()[0].strip(),
                json_path=json_path,
                model_self_report_path=report_path,
            )
        )
    return SidecarLoadResult(chapters=chapters)


def _entries_to_nodes(
    entries: list[dict[str, Any]], chapter_ordinal: int, source_path: Path
) -> list[SectionTreeNode]:
    """Convert parsed entries into `SectionTreeNode` records.

    Mirrors the historical `_entries_to_nodes` from the deleted
    `sections_via_llm.py` so JSON files produced by either path read the
    same way. Sorts by `(line_offset, level)` for determinism.
    """
    rows: list[tuple[int, int, SectionTreeNode]] = []
    for idx, entry in enumerate(entries):
        title_raw = entry.get("title")
        if not isinstance(title_raw, str) or not title_raw.strip():
            raise SidecarMalformedError(
                f"chapter {chapter_ordinal}: entry {idx} in {source_path} missing/empty `title`."
            )
        title = title_raw.strip()
        level_raw = entry.get("level")
        if not isinstance(level_raw, int) or level_raw < 1 or level_raw > 3:
            raise SidecarMalformedError(
                f"chapter {chapter_ordinal}: entry {idx} ({title!r}) in {source_path} "
                f"has invalid `level` ({level_raw!r}); must be 1, 2, or 3."
            )
        level = level_raw
        # Schema caps at chapter / section / subsection (3 levels of dotted
        # codes). Mirror the deprecated API path's L3 -> L2 clamp so re-runs
        # against an old JSON file produce the same compare report.
        if level == 3:
            level = 2
        page_anchor_raw = entry.get("page_anchor")
        page_anchor = (
            page_anchor_raw.strip()
            if isinstance(page_anchor_raw, str) and page_anchor_raw.strip()
            else None
        )
        line_offset_raw = entry.get("line_offset", 0)
        line_offset = int(line_offset_raw) if isinstance(line_offset_raw, int) else 0
        parent_title_raw = entry.get("parent_title")
        parent_title = (
            parent_title_raw.strip()
            if isinstance(parent_title_raw, str) and parent_title_raw.strip()
            else None
        )
        node = SectionTreeNode(
            chapter_ordinal=chapter_ordinal,
            level=level,
            title=title,
            parent_title=parent_title,
            page_anchor=page_anchor,
            provenance=PROMPT_PROVENANCE,
            confidence=1.0,
            extra={"line_offset": str(line_offset)},
        )
        rows.append((line_offset, level, node))
    rows.sort(key=lambda r: (r[0], r[1]))
    return [r[2] for r in rows]


# ---------------------------------------------------------------------------
# Disagreements loader (Phase 3 of section-extraction-contract-v2)
# ---------------------------------------------------------------------------

DISAGREEMENTS_FILENAME = "_llm_disagreements.json"
"""Per-chapter disagreement file emitted by sub-agents that disagree with
the TOC parser checklist embedded in their prompt."""

_VALID_DISAGREEMENT_TYPES = frozenset({
    "level_mismatch",
    "parent_mismatch",
    "missing_in_body",
    "extra_in_toc",
    "anchor_mismatch",
})


@dataclass(frozen=True)
class Disagreement:
    """One LLM-vs-TOC disagreement entry from `_llm_disagreements.json`."""

    chapter_ordinal: int
    type: str
    title: str
    toc_says: dict[str, Any]
    body_says: dict[str, Any]
    reason: str


def load_chapter_disagreements(
    config: HandbookConfig,
    chapter_ordinal: int,
) -> list[Disagreement]:
    """Read `_llm_disagreements.json` for one chapter.

    Returns an empty list when the file is absent (not every chapter has
    disagreements; the sub-agent skips the file when it agrees with the
    TOC checklist or the checklist was empty).

    Hard-fails on malformed JSON or invalid entry shape -- the file's
    presence is meant as structured signal, not free-form notes; if the
    sub-agent emitted something we can't parse, the user re-pastes that
    chapter's prompt.
    """
    chap_dir = edition_root(config.document_slug, config.edition) / f"{chapter_ordinal:02d}"
    path = chap_dir / DISAGREEMENTS_FILENAME
    if not path.is_file():
        return []
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SidecarMalformedError(
            f"chapter {chapter_ordinal}: {path} is not valid JSON: {exc}. "
            f"Re-paste this chapter's prompt and re-run --strategy compare."
        ) from exc
    if not isinstance(raw, list):
        raise SidecarMalformedError(
            f"chapter {chapter_ordinal}: {path} must be a JSON array; "
            f"got {type(raw).__name__}."
        )
    out: list[Disagreement] = []
    for idx, entry in enumerate(raw):
        if not isinstance(entry, dict):
            raise SidecarMalformedError(
                f"chapter {chapter_ordinal}: {path} entry {idx} must be an object; "
                f"got {type(entry).__name__}."
            )
        type_raw = entry.get("type")
        if type_raw not in _VALID_DISAGREEMENT_TYPES:
            raise SidecarMalformedError(
                f"chapter {chapter_ordinal}: {path} entry {idx} has invalid "
                f"`type` ({type_raw!r}); must be one of {sorted(_VALID_DISAGREEMENT_TYPES)}."
            )
        title_raw = entry.get("title")
        if not isinstance(title_raw, str) or not title_raw.strip():
            raise SidecarMalformedError(
                f"chapter {chapter_ordinal}: {path} entry {idx} missing/empty `title`."
            )
        toc_says = entry.get("toc_says") or {}
        body_says = entry.get("body_says") or {}
        if not isinstance(toc_says, dict) or not isinstance(body_says, dict):
            raise SidecarMalformedError(
                f"chapter {chapter_ordinal}: {path} entry {idx} `toc_says` and "
                f"`body_says` must be objects."
            )
        reason_raw = entry.get("reason", "")
        reason = str(reason_raw).strip() if reason_raw is not None else ""
        out.append(
            Disagreement(
                chapter_ordinal=chapter_ordinal,
                type=str(type_raw),
                title=title_raw.strip(),
                toc_says=dict(toc_says),
                body_says=dict(body_says),
                reason=reason,
            )
        )
    return out
