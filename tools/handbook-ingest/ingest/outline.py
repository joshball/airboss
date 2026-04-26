"""PDF outline -> tree of `OutlineNode` records.

Two strategies produce an outline:

1. **PDF bookmarks** (`parse_outline`). PyMuPDF exposes `get_toc()` as a flat
   list of `(level, title, page)` tuples. We walk that list level-aware,
   building a tree of chapter / section / subsection nodes with page ranges.
2. **Content-driven detection** (`detect_outline_from_text`). When the
   handbook's PDF bookmarks are mangled (PHAK 25C ships per-chapter PDFs
   concatenated together with worthless bookmark titles like
   `03_phak_ch1.pdf`), we scan page text for the chapter-page header pattern
   the FAA uses on every page (`<chapter>-<page>`, e.g. `12-7`) and treat the
   first page that increments the chapter number as the chapter boundary.

The per-handbook YAML config picks which strategy applies via
`outline_strategy: bookmark | content` (default `bookmark`).
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


def detect_outline_from_text(pdf_path: Path) -> list[OutlineNode]:
    """Scan page text for FAA-style `<chapter>-<page>` headers and infer chapter boundaries.

    Each FAA handbook page carries the printed page number in the header /
    footer in the form `12-7` (chapter 12, page 7 within the chapter). The
    first page where the chapter number increments is the start of the new
    chapter. Section numbers are likewise inferred from the H1-style headings
    that appear early on each page (`Atmospheric Pressure and Altitude`,
    bold, isolated on a page); we surface chapters only and let `sections.py`
    extract the body text per chapter range -- this avoids guessing at FAA
    section boundaries that aren't reliably typeset.
    """
    chapter_starts: dict[int, int] = {}
    chapter_titles: dict[int, str] = {}

    page_header_re = re.compile(r"^(\d+)-\d+\b")

    with fitz.open(pdf_path) as doc:
        for page_num in range(doc.page_count):
            page = doc.load_page(page_num)
            text = page.get_text("text")
            chapter_num: int | None = None
            for line in text.splitlines():
                stripped = line.strip()
                if not stripped:
                    continue
                m = page_header_re.match(stripped)
                if m:
                    candidate = int(m.group(1))
                    if 1 <= candidate <= 30:
                        chapter_num = candidate
                        break
            if chapter_num is None:
                continue
            if chapter_num not in chapter_starts:
                chapter_starts[chapter_num] = page_num + 1
                # FAA cover page typeset: title-line-1 / title-line-2 (often
                # split across two lines, e.g. "Introduction" / "To Flying"),
                # then "Chapter N". Look upward from the "Chapter N" sentinel
                # for the title; require Title-Case and short lines.
                lines = [line.strip() for line in text.splitlines()]
                title = _extract_chapter_title(lines, chapter_num, page_header_re)
                if title:
                    chapter_titles[chapter_num] = title
        total_pages = doc.page_count

    if not chapter_starts:
        raise OutlineError(f"Could not detect any FAA `<chapter>-<page>` headers in {pdf_path}.")

    sorted_chapters = sorted(chapter_starts.keys())
    nodes: list[OutlineNode] = []
    for idx, chap_num in enumerate(sorted_chapters):
        page_start = chapter_starts[chap_num]
        page_end = (
            chapter_starts[sorted_chapters[idx + 1]] - 1 if idx + 1 < len(sorted_chapters) else total_pages
        )
        title = chapter_titles.get(chap_num) or f"Chapter {chap_num}"
        nodes.append(
            OutlineNode(
                level="chapter",
                code=str(chap_num),
                title=title,
                page_start=page_start,
                page_end=page_end,
                parent_code=None,
                ordinal=chap_num,
            )
        )
    return nodes


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


def _extract_chapter_title(lines: list[str], chapter_num: int, page_header_re: re.Pattern[str]) -> str | None:
    """Heuristic: scan upward from `Chapter N` collecting Title-Case short lines.

    The FAA chapter cover pages place the title above the `Chapter N` sentinel
    in 1-3 short, mostly-Title-Case lines. We collect those, joining them
    until we hit a longer body line (the introductory paragraph) or run out.
    """
    chapter_header_re = re.compile(r"^Chapter\s+(\d+)$", re.IGNORECASE)
    for i in range(len(lines) - 1, -1, -1):
        cm = chapter_header_re.match(lines[i])
        if not cm or int(cm.group(1)) != chapter_num:
            continue
        parts: list[str] = []
        for back in range(i - 1, max(-1, i - 6), -1):
            candidate = lines[back]
            if not candidate:
                if parts:
                    break
                continue
            if page_header_re.match(candidate):
                # Page header bled into the upward scan; ignore.
                continue
            # Skip body lines (long; end with sentence punctuation; not Title Case).
            if len(candidate) > 50:
                if parts:
                    break
                continue
            if candidate.endswith((".", ",", ";", ":")):
                if parts:
                    break
                continue
            if not _is_title_case(candidate):
                if parts:
                    break
                continue
            parts.insert(0, candidate)
            if len(parts) >= 4:
                break
        if parts:
            return _clean_title(" ".join(parts))
        return None
    return None


def _is_title_case(text: str) -> bool:
    """Lenient: any line where the first non-`[\\d-]` token starts with a capital letter."""
    stripped = text.strip()
    if not stripped:
        return False
    if not stripped[0].isupper():
        return False
    # Reject lines that look like `12-1 Some Body`; those are page headers.
    if re.match(r"^\d+-\d+", stripped):
        return False
    return True
