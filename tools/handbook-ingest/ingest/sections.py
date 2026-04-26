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
from dataclasses import dataclass
from pathlib import Path

import fitz

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
    node: OutlineNode
    body_md: str
    faa_page_start: int | None
    faa_page_end: int | None
    char_count: int


def extract_sections(pdf_path: Path, nodes: list[OutlineNode], page_offset: int = 0) -> list[SectionBody]:
    """Extract body text + FAA pagination for every node in `nodes`.

    `page_offset` shifts FAA-printed pages relative to PDF page numbers when
    the handbook's front matter occupies pages the FAA didn't number (most
    8083-series handbooks ship a Roman-numeral preface).
    """
    bodies: list[SectionBody] = []
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
            faa_start = _faa_page(node.page_start, page_offset)
            faa_end = _faa_page(node.page_end, page_offset)
            bodies.append(
                SectionBody(
                    node=node,
                    body_md=body,
                    faa_page_start=faa_start,
                    faa_page_end=faa_end,
                    char_count=len(body),
                )
            )
    return bodies


def _faa_page(pdf_page: int, page_offset: int) -> int | None:
    if pdf_page <= page_offset:
        return None
    return pdf_page - page_offset


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
