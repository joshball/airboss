"""Per-section text extraction.

Walks the PDF page-by-page within each `OutlineNode`'s page range, collects
text via PyMuPDF's layout-aware `get_text("text")`, strips page chrome
(running headers/footers, page numbers), merges hyphenated line breaks, and
preserves paragraph boundaries.

Each pipeline run produces:

    SectionBody(
        node: OutlineNode,
        body_md: str,
        faa_pages: tuple[int | None, int | None],
        char_count: int,
    )
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

import fitz

from .config_loader import PAGE_LABEL_WALK_BACK_DEFAULT
from .outline import OutlineNode

# Lines shorter than this on a page that look like running headers / footers
# get dropped. Longer lines that match this length but are common to many
# pages also get dropped via _drop_repeated_chrome.
_CHROME_LINE_MAX = 120

# Strip "12-7" / "Page 12-7" / numeric-only page numbers.
_PAGE_NUMBER_PATTERNS = [
    re.compile(r"^\s*\d+\s*$"),
    re.compile(r"^\s*\d+\s*-\s*\d+\s*$"),
    re.compile(r"^\s*Page\s+\d+(\s*-\s*\d+)?\s*$", re.IGNORECASE),
]


@dataclass
class SectionBody:
    """Per-section body + FAA page metadata.

    `faa_page_start`/`faa_page_end` are the printed FAA page references
    (e.g. `"12-7"`), stored verbatim so hyphenated pagination round-trips
    to the seed. None when the page reference is unknown.
    """

    node: OutlineNode
    body_md: str
    faa_page_start: str | None
    faa_page_end: str | None
    char_count: int


@dataclass
class SectionExtractionResult:
    """Bodies plus the warnings collected while reading printed page labels."""

    bodies: list[SectionBody]
    warnings: list[str] = field(default_factory=list)


_FAA_HEADER_RE = re.compile(r"^(\d+)-(\d+)\b")


def extract_sections(
    pdf_path: Path,
    nodes: list[OutlineNode],
    page_offset: int = 0,
    *,
    chapter_overrides: dict[int, dict[str, str]] | None = None,
    walk_back: int = PAGE_LABEL_WALK_BACK_DEFAULT,
) -> SectionExtractionResult:
    """Extract body text + FAA pagination for every node in `nodes`.

    `page_offset` is honored as a fallback when a page's printed `<chapter>-
    <page>` header can't be read (mid-figure spreads, full-bleed images).
    Otherwise, `faa_page_start`/`faa_page_end` carry the printed FAA page
    reference verbatim (e.g. `"12-1"`) so the seed and reader display match
    what's typeset on the PDF page.

    Page-label resolution order for each end of the range:
      1. If `chapter_overrides[<chapter_ord>]` carries an explicit
         `faa_page_start`/`faa_page_end`, use it verbatim.
      2. Read the FAA-style header from the target PDF page.
      3. Walk backward up to `walk_back` PDF pages looking for a parseable
         FAA header. Surface a warning that records which page recovered.
      4. Fall back to `pdf_page - page_offset` (legacy behavior). Surface a
         warning so the failure is visible in the manifest.
    """
    overrides = chapter_overrides or {}
    bodies: list[SectionBody] = []
    warnings: list[str] = []
    with fitz.open(pdf_path) as doc:
        # Detect page chrome up-front by hashing repeated lines.
        chrome_lines = _detect_chrome_lines(doc)
        for node in nodes:
            text_pieces: list[str] = []
            for page_num in range(node.page_start - 1, node.page_end):
                if page_num >= doc.page_count:
                    break
                page = doc.load_page(page_num)
                text = page.get_text("text")
                cleaned = _clean_page_text(text, chrome_lines)
                if cleaned:
                    text_pieces.append(cleaned)
            joined = "\n\n".join(text_pieces)
            body = _normalize_paragraphs(joined)
            chap_ord = _chapter_ordinal_for(node)
            override = overrides.get(chap_ord) if chap_ord is not None else None
            faa_start = _resolve_page_label(
                doc=doc,
                pdf_page=node.page_start,
                page_offset=page_offset,
                walk_back=walk_back,
                override_value=(override or {}).get("faa_page_start"),
                node_code=node.code,
                end_label="start",
                warnings=warnings,
            )
            faa_end = _resolve_page_label(
                doc=doc,
                pdf_page=node.page_end,
                page_offset=page_offset,
                walk_back=walk_back,
                override_value=(override or {}).get("faa_page_end"),
                node_code=node.code,
                end_label="end",
                warnings=warnings,
            )
            bodies.append(
                SectionBody(
                    node=node,
                    body_md=body,
                    faa_page_start=faa_start,
                    faa_page_end=faa_end,
                    char_count=len(body),
                )
            )
    return SectionExtractionResult(bodies=bodies, warnings=warnings)


def _chapter_ordinal_for(node: OutlineNode) -> int | None:
    """Return the chapter ordinal a node lives under (chapter rows themselves
    use their own ordinal). Section/subsection rows derive it from `code`'s
    leading numeric segment."""
    head = node.code.split(".", 1)[0]
    if head.isdigit():
        return int(head)
    return None


def _resolve_page_label(
    *,
    doc: fitz.Document,
    pdf_page: int,
    page_offset: int,
    walk_back: int,
    override_value: str | None,
    node_code: str,
    end_label: str,
    warnings: list[str],
) -> str | None:
    """Resolve a single end of a page range to a printed FAA label.

    Order: explicit override -> direct read -> walk-back read -> page-offset
    fallback (with warning). Returns None for front-matter pages.
    """
    if override_value is not None:
        return override_value
    if pdf_page < 1 or pdf_page > doc.page_count:
        return None
    direct = _read_header_at(doc, pdf_page)
    if direct is not None:
        return direct
    # Walk backward looking for a parseable header so we don't print a raw
    # PDF page number for the last page of a chapter when it lacks a header.
    for back in range(1, walk_back + 1):
        candidate = pdf_page - back
        if candidate < 1:
            break
        recovered = _read_header_at(doc, candidate)
        if recovered is not None:
            warnings.append(
                f"page-label: node {node_code} {end_label}-page (PDF p{pdf_page}) had no parseable "
                f"FAA header; recovered `{recovered}` from PDF p{candidate} (walk-back {back})"
            )
            return recovered
    if pdf_page <= page_offset:
        return None
    fallback = str(pdf_page - page_offset)
    warnings.append(
        f"page-label: node {node_code} {end_label}-page (PDF p{pdf_page}) had no parseable FAA "
        f"header within {walk_back} pages; falling back to offset-derived `{fallback}`. "
        f"Add `chapter_overrides` for an explicit value if this is wrong."
    )
    return fallback


def _read_header_at(doc: fitz.Document, pdf_page: int) -> str | None:
    """Read the FAA-style page header from a single page; None if absent."""
    if pdf_page < 1 or pdf_page > doc.page_count:
        return None
    page = doc.load_page(pdf_page - 1)
    text = page.get_text("text")
    for line in text.splitlines()[:8]:
        stripped = line.strip()
        m = _FAA_HEADER_RE.match(stripped)
        if m:
            return f"{m.group(1)}-{m.group(2)}"
    return None


def _detect_chrome_lines(doc: fitz.Document) -> set[str]:
    """Lines that recur across many pages are page chrome; drop them."""
    counts: dict[str, int] = {}
    sample = min(doc.page_count, 60)
    for i in range(sample):
        page = doc.load_page(i)
        text = page.get_text("text")
        seen: set[str] = set()
        for line in text.splitlines():
            stripped = line.strip()
            if not stripped or len(stripped) > _CHROME_LINE_MAX:
                continue
            if stripped in seen:
                continue
            seen.add(stripped)
            counts[stripped] = counts.get(stripped, 0) + 1
    threshold = max(3, sample // 4)
    return {line for line, count in counts.items() if count >= threshold}


def _clean_page_text(text: str, chrome_lines: set[str]) -> str:
    out_lines: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            out_lines.append("")
            continue
        if stripped in chrome_lines:
            continue
        if any(p.match(stripped) for p in _PAGE_NUMBER_PATTERNS):
            continue
        out_lines.append(line.rstrip())
    return "\n".join(out_lines)


_HYPHEN_LINE_BREAK = re.compile(r"(\w+)-\n(\w+)")
_MULTI_BLANK = re.compile(r"\n{3,}")


def _normalize_paragraphs(text: str) -> str:
    # Merge hyphenated line breaks: "obser-\nvation" -> "observation".
    merged = _HYPHEN_LINE_BREAK.sub(r"\1\2", text)
    # Collapse runs of 3+ blank lines down to a paragraph break.
    merged = _MULTI_BLANK.sub("\n\n", merged)
    # Trim leading/trailing whitespace per paragraph.
    paragraphs = [p.strip() for p in merged.split("\n\n")]
    paragraphs = [p for p in paragraphs if p]
    return "\n\n".join(paragraphs)
