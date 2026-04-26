"""PDF outline -> tree of `OutlineNode` records.

PyMuPDF exposes the PDF outline (table of contents) as a flat list of
`(level, title, page)` tuples. We walk that list level-aware, building a tree
that preserves chapter / section / subsection boundaries plus each node's
page range (start = its own page; end = the next sibling's page - 1).

When the FAA outline is wrong (a chapter starts at the wrong page, or a
section is missing because the FAA never bookmarked it), `outline_overrides`
in the per-handbook YAML config replaces specific nodes by code path.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

import fitz  # PyMuPDF


@dataclass
class OutlineNode:
    """One row in the chapter / section / subsection tree."""

    level: str  # "chapter" | "section" | "subsection"
    code: str   # "12" / "12.3" / "12.3.2"
    title: str
    page_start: int  # 1-indexed PDF page (not FAA-printed page)
    page_end: int    # inclusive
    children: list[OutlineNode] = field(default_factory=list)
    parent_code: str | None = None
    ordinal: int = 0


class OutlineError(RuntimeError):
    """Raised when the PDF outline cannot be parsed into a usable tree."""


_LEVEL_NAMES = ("chapter", "section", "subsection")


def parse_outline(pdf_path: Path, *, doc_total_pages: int | None = None) -> list[OutlineNode]:
    """Read the PDF outline and produce a flat list of nodes (tree-ordered)."""
    with fitz.open(pdf_path) as doc:
        toc = doc.get_toc()
        page_count = doc.page_count
    if not toc:
        raise OutlineError(
            f"PDF outline missing for {pdf_path}. "
            "Author an outline_overrides block in the handbook YAML config "
            "or surface a hand-curated outline.yaml override."
        )

    if doc_total_pages is None:
        doc_total_pages = page_count

    # First pass: emit a flat list with assigned levels + dot-codes.
    flat: list[OutlineNode] = []
    counters: list[int] = [0, 0, 0]
    parent_codes: list[str | None] = [None, None, None]
    for entry in toc:
        depth, title, page = entry[0], entry[1].strip(), entry[2]
        if depth < 1 or depth > 3:
            # Drop deeper-than-subsection bookmarks (table-of-contents links,
            # appendices nested under subsections); they aren't section content.
            continue
        depth_idx = depth - 1
        counters[depth_idx] += 1
        # Reset deeper counters when a shallower bookmark increments.
        for deeper in range(depth_idx + 1, len(counters)):
            counters[deeper] = 0
            parent_codes[deeper] = None
        code_parts = [str(c) for c in counters[: depth_idx + 1] if c > 0]
        code = ".".join(code_parts) if code_parts else str(counters[depth_idx])
        parent_code = parent_codes[depth_idx - 1] if depth_idx > 0 else None
        node = OutlineNode(
            level=_LEVEL_NAMES[depth_idx],
            code=code,
            title=_clean_title(title),
            page_start=max(1, int(page)),
            page_end=doc_total_pages,
            parent_code=parent_code,
            ordinal=counters[depth_idx],
        )
        parent_codes[depth_idx] = code
        flat.append(node)

    if not flat:
        raise OutlineError(f"PDF outline empty after filtering for {pdf_path}.")

    # Second pass: backfill page_end as the next entry's page_start - 1.
    for i, node in enumerate(flat):
        next_idx = i + 1
        if next_idx < len(flat):
            node.page_end = max(node.page_start, flat[next_idx].page_start - 1)
        else:
            node.page_end = doc_total_pages
    return flat


def to_tree(flat: list[OutlineNode]) -> list[OutlineNode]:
    """Re-link `flat` into a chapter-rooted tree via `parent_code` pointers."""
    by_code: dict[str, OutlineNode] = {n.code: n for n in flat}
    roots: list[OutlineNode] = []
    for node in flat:
        if node.parent_code is None:
            roots.append(node)
            continue
        parent = by_code.get(node.parent_code)
        if parent is None:
            # Parent not present in the outline -- treat the node as a root so
            # nothing is silently dropped. Surface as a warning, not an error.
            roots.append(node)
            continue
        parent.children.append(node)
    return roots


def filter_to_chapter(flat: list[OutlineNode], chapter_code: str) -> list[OutlineNode]:
    """Filter the flat outline to the subtree under `chapter_code` (CLI `--chapter`)."""
    keep: list[OutlineNode] = []
    for node in flat:
        if node.code == chapter_code or node.code.startswith(chapter_code + "."):
            keep.append(node)
    if not keep:
        raise OutlineError(f"No nodes match chapter code `{chapter_code}` in the outline.")
    return keep


_NORMALISE_WS = re.compile(r"\s+")


def _clean_title(title: str) -> str:
    return _NORMALISE_WS.sub(" ", title).strip()
