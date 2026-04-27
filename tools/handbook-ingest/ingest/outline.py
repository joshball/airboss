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
        last_chapter_last_page = (
            _find_last_chapter_last_page(doc, toc, page_count) if toc else None
        )
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

    # Second pass: backfill page_end level-aware. Each node's page_end is
    # the page-start of the next bookmark whose depth is *less than or
    # equal to* this node's depth (i.e. the next sibling or aunt) minus 1.
    # Without the level-aware look-ahead, a chapter would inherit its
    # first child's page_start, collapsing the chapter range to a single
    # page.
    last_chapter_idx: int | None = None
    for i, node in enumerate(flat):
        if node.level == "chapter":
            last_chapter_idx = i
    for i, node in enumerate(flat):
        own_depth = _LEVEL_NAMES.index(node.level)
        next_sibling_or_above_idx: int | None = None
        for j in range(i + 1, len(flat)):
            other_depth = _LEVEL_NAMES.index(flat[j].level)
            if other_depth <= own_depth:
                next_sibling_or_above_idx = j
                break
        if next_sibling_or_above_idx is not None:
            node.page_end = max(node.page_start, flat[next_sibling_or_above_idx].page_start - 1)
        else:
            node.page_end = doc_total_pages
    # Cap the last chapter and every node nested under it to the actual
    # last body page that carried its FAA `<chap>-<page>` header. Pages
    # beyond it are appendices / glossaries / index that ride on a
    # different header scheme and would otherwise pollute the chapter
    # body. When the cap can't be determined (no FAA headers in the doc)
    # we leave the legacy behavior intact.
    if last_chapter_last_page is not None and last_chapter_idx is not None:
        last_chapter = flat[last_chapter_idx]
        for node in flat[last_chapter_idx:]:
            if node.page_end > last_chapter_last_page:
                node.page_end = max(node.page_start, last_chapter_last_page)
        # Tighten the descendants too -- if any subsection's start page is
        # past the cap, fall back to the chapter's start so the section
        # extractor's range never inverts.
        if last_chapter.page_end < last_chapter.page_start:
            last_chapter.page_end = last_chapter.page_start
    return flat


def _find_last_chapter_last_page(
    doc: fitz.Document, toc: list[tuple[int, str, int]], page_count: int
) -> int | None:
    """Find the last PDF page that carries the LAST chapter's FAA header.

    Walks the document forward from the last top-level bookmark's start
    page, parsing each page's footer + header for `<chap>-<page>`. The
    chapter ordinal is taken from the count of depth-1 bookmarks that
    precede the last one (so AvWX's chapter-28 cap reads `28-N` headers).
    Returns None when no header is found within the document -- callers
    fall back to `doc_total_pages`.
    """
    chapter_entries = [t for t in toc if t[0] == 1]
    if not chapter_entries:
        return None
    # Prefer the leading numeric prefix on the bookmark title (e.g. "28
    # Aviation Weather Tools") -- bookmark order doesn't always match
    # chapter ordinal one-to-one. Fall back to the count of top-level
    # entries when the title carries no leading code.
    code_prefix = re.compile(r"^(\d+)\b")
    last_title = chapter_entries[-1][1].strip()
    m = code_prefix.match(last_title)
    last_chapter_ord = int(m.group(1)) if m else len(chapter_entries)
    last_chapter_start = chapter_entries[-1][2]
    page_header_re = re.compile(r"^(\d+)-\d+\b")
    last_seen: int | None = None
    for pdf_page in range(last_chapter_start, page_count + 1):
        page = doc.load_page(pdf_page - 1)
        text = page.get_text("text")
        nonblank = [line.strip() for line in text.splitlines() if line.strip()]
        candidates = [*nonblank[:8], *nonblank[-4:]]
        for line in candidates:
            m = page_header_re.match(line)
            if not m:
                continue
            chap = int(m.group(1))
            if chap == last_chapter_ord:
                last_seen = pdf_page
                break
    return last_seen


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


def detect_outline_from_text(
    pdf_path: Path, *, skip_pages: set[int] | None = None
) -> list[OutlineNode]:
    """Scan page text for FAA-style `<chapter>-<page>` headers and infer chapter boundaries.

    Each FAA handbook page carries the printed page number in the header /
    footer in the form `12-7` (chapter 12, page 7 within the chapter). The
    first page where the chapter number increments is the start of the new
    chapter. Section numbers are likewise inferred from the H1-style headings
    that appear early on each page (`Atmospheric Pressure and Altitude`,
    bold, isolated on a page); we surface chapters only and let `sections.py`
    extract the body text per chapter range -- this avoids guessing at FAA
    section boundaries that aren't reliably typeset.

    The last chapter ends at the last PDF page bearing its `<chapter>-<page>`
    header -- not at the document's total page count. PHAK's PDF includes a
    glossary (G-NN headers) and an index (I-NN headers) after the last
    chapter; treating those as part of the final chapter inflates its body
    and breaks the printed-page-end resolution.
    """
    chapter_starts: dict[int, int] = {}
    chapter_titles: dict[int, str] = {}
    chapter_last_seen: dict[int, int] = {}
    skip = skip_pages or set()

    page_header_re = re.compile(r"^(\d+)-\d+\b")

    with fitz.open(pdf_path) as doc:
        for page_num in range(doc.page_count):
            # Skip pages explicitly excluded by the caller (e.g. printed-TOC
            # pages whose right-column page anchors would otherwise look like
            # body chapter starts to this scanner).
            if (page_num + 1) in skip:
                continue
            page = doc.load_page(page_num)
            text = page.get_text("text")
            chapter_num: int | None = None
            stripped_lines = [line.strip() for line in text.splitlines() if line.strip()]
            # Top window: first 8 lines (PHAK convention).
            for line in stripped_lines[:8]:
                m = page_header_re.match(line)
                if m:
                    candidate = int(m.group(1))
                    if 1 <= candidate <= 30:
                        chapter_num = candidate
                        break
            # Bottom window: last 4 lines (AFH 3C convention; the printed
            # `<chap>-<page>` reference sits in the footer rather than the
            # header on every body page).
            if chapter_num is None:
                for line in stripped_lines[-4:]:
                    m = page_header_re.match(line)
                    if m:
                        candidate = int(m.group(1))
                        if 1 <= candidate <= 30:
                            chapter_num = candidate
                            break
            if chapter_num is None:
                continue
            chapter_last_seen[chapter_num] = page_num + 1
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

    if not chapter_starts:
        raise OutlineError(f"Could not detect any FAA `<chapter>-<page>` headers in {pdf_path}.")

    sorted_chapters = sorted(chapter_starts.keys())
    nodes: list[OutlineNode] = []
    for idx, chap_num in enumerate(sorted_chapters):
        page_start = chapter_starts[chap_num]
        if idx + 1 < len(sorted_chapters):
            page_end = chapter_starts[sorted_chapters[idx + 1]] - 1
        else:
            # Last chapter: stop at the last PDF page that actually carried a
            # `<this-chapter>-<page>` header. The pages after it (glossary,
            # index, appendices typeset with G-NN/I-NN/A-NN headers) are not
            # part of the chapter and would otherwise pull in body text and
            # break the printed-page-end resolution.
            page_end = chapter_last_seen[chap_num]
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
# Strip a leading dotted-section code from a bookmark title, e.g.
# "1 Introduction" -> "Introduction" or "2.2.1.1 Satellite Analysis Branch
# (SAB)" -> "Satellite Analysis Branch (SAB)". The handbook structure code
# is already stored separately on the node; carrying it inside `title`
# duplicates it on every chip, breadcrumb, and page heading.
_BOOKMARK_CODE_PREFIX = re.compile(r"^\d+(?:\.\d+)*\s+")


def _clean_title(title: str) -> str:
    cleaned = _NORMALISE_WS.sub(" ", title).strip()
    cleaned = _BOOKMARK_CODE_PREFIX.sub("", cleaned, count=1)
    return cleaned


_CHAPTER_TITLE_INLINE_RE = re.compile(r"^Chapter\s+(\d+)\s*[:—–-]\s*(.+)$", re.IGNORECASE)


def _extract_chapter_title(lines: list[str], chapter_num: int, page_header_re: re.Pattern[str]) -> str | None:
    """Heuristic: derive the chapter title from a cover page.

    Two FAA conventions are in the wild:

    1. **PHAK convention** - the title sits above a standalone `Chapter N`
       sentinel in 1-3 short, mostly-Title-Case lines. Walk upward from the
       sentinel collecting those.
    2. **AFH 3C convention** - the title is inline on the same line as the
       chapter sentinel, e.g. ``"Chapter 1: Introduction to Flight Training"``.
       Pull the trailing portion after the colon.

    Returns None when neither convention fires.
    """
    chapter_header_re = re.compile(r"^Chapter\s+(\d+)$", re.IGNORECASE)
    for i in range(len(lines) - 1, -1, -1):
        # AFH inline form: "Chapter N: Some Title"
        inline = _CHAPTER_TITLE_INLINE_RE.match(lines[i])
        if inline and int(inline.group(1)) == chapter_num:
            return _clean_title(inline.group(2))
        # PHAK upward-scan form: standalone "Chapter N" with title above.
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
