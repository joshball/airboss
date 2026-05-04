"""Front-matter capture for FAA handbooks.

WP-HANDBOOK-RE-EXTRACTION-V2 Sub-phase 1C.

Extracts the pages between the cover and chapter 1 as synthetic depth-0
sections under a `front-matter/` subdirectory. Per spec, the canonical
shape is:

- `front-matter/00-cover.md`            -- title page
- `front-matter/01-preface.md`          -- preface text if present
- `front-matter/02-acknowledgments.md`  -- contributors / reviewers
- `front-matter/03-introduction.md`     -- substantive prose introduction
- `front-matter/04-table-of-contents.md` -- verbatim FAA TOC (optional)

Discrimination is by PDF page range: `front_matter_page_range: [start, end]`
in the per-doc YAML names the cover .. last-page-before-chapter-1 (1-indexed
inclusive). Pages outside that range fall through to chapter detection.

The extractor scans page text within the range and segments by recognized
front-matter markers: a heading like "Preface", "Acknowledgments",
"Introduction", "Table of Contents", or "Major Revisions" / "Notice" /
"Major Enhancements" -- the first body line of each segment names the
section. Pages preceding the first marker land in `00-cover.md`.

OutlineNode level is `'front-matter'` (peer to `'chapter'`), code is
`'fm.<n>'` (1-indexed), depth 0. Ordinals start at 0 so front-matter rows
sort BEFORE chapter 1 (ordinal 1) in the chapter-list view.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from pathlib import Path

import fitz

from .outline import OutlineNode
from .sections import SectionBody

# Recognized front-matter section headings. Order matters: earlier
# patterns win at first-match. Each tuple is (canonical_slug,
# heading_regex_pattern).
#
# The regex matches a line whose stripped, lower-cased form is the
# heading (so 'Preface' and 'PREFACE' both match `preface`). We also
# match common variants (e.g. "Acknowledgments" / "Acknowledgements").
_FRONT_MATTER_MARKERS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("preface", re.compile(r"^preface$", re.IGNORECASE)),
    (
        "acknowledgments",
        re.compile(r"^acknowled?gements?$", re.IGNORECASE),
    ),
    ("notice", re.compile(r"^notice$", re.IGNORECASE)),
    (
        "major-enhancements",
        re.compile(r"^major\s+(?:enhancements|revisions|changes)$", re.IGNORECASE),
    ),
    (
        "summary-of-changes",
        re.compile(r"^summary\s+of\s+changes$", re.IGNORECASE),
    ),
    ("introduction", re.compile(r"^introduction$", re.IGNORECASE)),
    (
        "table-of-contents",
        re.compile(r"^table\s+of\s+contents$", re.IGNORECASE),
    ),
    ("foreword", re.compile(r"^foreword$", re.IGNORECASE)),
)

# Canonical section titles (what we render in the markdown body's `# Title`
# header and the manifest `title` field). Keyed by slug.
_FRONT_MATTER_TITLES: dict[str, str] = {
    "cover": "Cover",
    "preface": "Preface",
    "acknowledgments": "Acknowledgments",
    "notice": "Notice",
    "major-enhancements": "Major Enhancements",
    "summary-of-changes": "Summary of Changes",
    "introduction": "Introduction",
    "table-of-contents": "Table of Contents",
    "foreword": "Foreword",
}

# Patterns for chrome we strip from front-matter prose: page-number-only
# lines, the FAA's repeated handbook-name banner, and pure roman numerals.
_PAGE_NUMBER_PATTERNS = (
    re.compile(r"^\s*[ivxlcdm]+\s*$", re.IGNORECASE),  # roman numerals
    re.compile(r"^\s*\d+\s*$"),  # bare integer
)
_BANNER_RE = re.compile(r"\bHandbook\b.*\bFAA-H-\d", re.IGNORECASE)


@dataclass
class FrontMatterSection:
    """One front-matter section ready for the manifest + body writer."""

    slug: str
    """Canonical kebab-case slug (e.g. `cover`, `preface`, `introduction`)."""

    title: str
    """Display title (e.g. `Cover`, `Preface`, `Introduction`)."""

    ordinal: int
    """0-indexed; orders front-matter rows ahead of chapter 1 (ordinal 1+)."""

    body_md: str
    """Cleaned section body text (paragraphs preserved, page chrome stripped)."""

    pdf_page_start: int
    """1-indexed first PDF page covered by this segment."""

    pdf_page_end: int
    """1-indexed last PDF page covered by this segment (inclusive)."""


def extract_front_matter(
    pdf_path: Path,
    page_range: tuple[int, int],
) -> list[FrontMatterSection]:
    """Read the PDF's front-matter pages and segment by recognized markers.

    Returns a list of ``FrontMatterSection`` records in document order.
    The first segment is always `cover` (everything before the first
    recognized marker; never empty for a real handbook PDF). Subsequent
    segments are named by their heading marker.

    The cover segment is non-empty even when no body prose precedes the
    first marker -- the title page text gets attributed to it -- so
    every handbook produces at least one front-matter row.
    """
    start, end = page_range
    if start < 1 or end < start:
        raise ValueError(
            f"extract_front_matter: invalid page_range={page_range!r} "
            f"(start must be >= 1; end must be >= start)."
        )
    doc = fitz.open(pdf_path)
    try:
        if end > doc.page_count:
            raise ValueError(
                f"extract_front_matter: page_range end={end} exceeds PDF "
                f"page count {doc.page_count}."
            )
        # Read all pages in the front-matter range as a list of (page_num,
        # text) so we can scan for markers without re-opening pages.
        pages: list[tuple[int, str]] = []
        for pdf_page in range(start, end + 1):
            page_text = doc.load_page(pdf_page - 1).get_text("text") or ""
            pages.append((pdf_page, page_text))
    finally:
        doc.close()

    return _segment_front_matter(pages)


def _segment_front_matter(pages: list[tuple[int, str]]) -> list[FrontMatterSection]:
    """Walk pages line-by-line; cut a new segment at each recognized marker.

    The first segment is always `cover` (collects everything before the
    first marker). Subsequent segments take their slug from the marker
    that opened them.

    Markers must appear as a standalone line (after lstrip / rstrip).
    A marker that appears mid-paragraph is ignored.
    """
    if not pages:
        return []

    # Each segment: { slug, title, page_start, page_end, lines: [str] }.
    segments: list[dict[str, object]] = [
        {
            "slug": "cover",
            "title": _FRONT_MATTER_TITLES["cover"],
            "page_start": pages[0][0],
            "page_end": pages[0][0],
            "lines": [],
        }
    ]

    for pdf_page, page_text in pages:
        # Carry the page_end forward on the current segment so a segment
        # that spans multiple pages reflects its full range.
        segments[-1]["page_end"] = pdf_page
        for raw_line in page_text.splitlines():
            stripped = raw_line.strip()
            marker_slug = _match_marker(stripped)
            if marker_slug is not None and marker_slug != segments[-1]["slug"]:
                # Open a new segment.
                segments.append(
                    {
                        "slug": marker_slug,
                        "title": _FRONT_MATTER_TITLES[marker_slug],
                        "page_start": pdf_page,
                        "page_end": pdf_page,
                        "lines": [],
                    }
                )
                continue
            current_lines = segments[-1]["lines"]
            assert isinstance(current_lines, list)
            current_lines.append(raw_line)

    out: list[FrontMatterSection] = []
    for ordinal, seg in enumerate(segments):
        slug = str(seg["slug"])
        body = _clean_body("\n".join(_lines_of(seg)))
        out.append(
            FrontMatterSection(
                slug=slug,
                title=str(seg["title"]),
                ordinal=ordinal,
                body_md=body,
                pdf_page_start=int(seg["page_start"]),
                pdf_page_end=int(seg["page_end"]),
            )
        )
    return out


def _lines_of(seg: dict[str, object]) -> list[str]:
    """Type-narrowing accessor."""
    lines = seg["lines"]
    assert isinstance(lines, list)
    return [str(line) for line in lines]


def _match_marker(stripped_line: str) -> str | None:
    """Return the canonical slug for a recognized marker, else None."""
    if not stripped_line:
        return None
    for slug, pattern in _FRONT_MATTER_MARKERS:
        if pattern.match(stripped_line):
            return slug
    return None


def _clean_body(raw_body: str) -> str:
    """Strip page-number-only lines, the FAA banner, and collapse blanks.

    The cleaning is intentionally light. We don't try to parse paragraph
    structure (the front matter is short and the reader is fine with
    occasional double-newlines); we just remove the most common chrome
    so the rendered output is readable.
    """
    cleaned: list[str] = []
    prev_blank = True
    for line in raw_body.splitlines():
        stripped = line.strip()
        if not stripped:
            if prev_blank:
                continue
            cleaned.append("")
            prev_blank = True
            continue
        if any(p.match(stripped) for p in _PAGE_NUMBER_PATTERNS):
            continue
        if _BANNER_RE.search(stripped):
            continue
        cleaned.append(stripped)
        prev_blank = False
    # Drop trailing blanks
    while cleaned and not cleaned[-1]:
        cleaned.pop()
    return "\n".join(cleaned)


def front_matter_to_outline_nodes(
    sections: list[FrontMatterSection],
) -> list[OutlineNode]:
    """Convert front-matter segments into ``OutlineNode`` records.

    Each segment becomes a depth-0 node with ``level='front-matter'``.
    The code is `fm.<ordinal+1>` (so cover is `fm.1`, preface is
    `fm.2`, etc.). Codes use the dotted-decimal format the manifest
    validator already accepts (`SECTION_TREE_CODE_REGEX`).
    """
    out: list[OutlineNode] = []
    for sec in sections:
        out.append(
            OutlineNode(
                level="front-matter",
                code=_front_matter_code(sec.ordinal),
                title=sec.title,
                page_start=sec.pdf_page_start,
                page_end=sec.pdf_page_end,
                parent_code=None,
                ordinal=sec.ordinal,
            )
        )
    return out


def front_matter_to_section_bodies(
    sections: list[FrontMatterSection],
    nodes: list[OutlineNode],
) -> list[SectionBody]:
    """Pair each front-matter segment with its OutlineNode as a SectionBody."""
    if len(sections) != len(nodes):
        raise ValueError(
            f"front_matter_to_section_bodies: section/node count mismatch "
            f"({len(sections)} vs {len(nodes)})."
        )
    out: list[SectionBody] = []
    for sec, node in zip(sections, nodes, strict=True):
        out.append(
            SectionBody(
                node=node,
                body_md=sec.body_md,
                # Front matter has no FAA chapter-page header; leave None
                # so the manifest carries `null` (Zod schema accepts it).
                faa_page_start=None,
                faa_page_end=None,
                char_count=len(sec.body_md),
            )
        )
    return out


def _front_matter_code(ordinal: int) -> str:
    """Section code for a front-matter row.

    The manifest validator's section-code regex is
    `^[0-9]+(\\.[0-9]+){0,2}$`. We use the dedicated `0.<n>` namespace
    so front-matter codes never collide with chapter ordinals (chapters
    start at `1`). Cover = `0.1`, Preface = `0.2`, etc.

    Note: the dotted form makes the code two-digit (depth 1 by code
    length); we still mark `level='front-matter'` and `depth=0` at the
    seed layer so the row is listed alongside chapters in the
    chapter-list view.
    """
    return f"0.{ordinal + 1}"


def front_matter_chapter_slug(sec: FrontMatterSection) -> str:
    """Return the chapter-directory slug used in the on-disk path.

    Path layout: `<root>/front-matter/<NN>-<slug>.md`. The leading
    chapter dir is the literal `"front-matter"`; the file ordinal is
    zero-padded.
    """
    return sec.slug


def front_matter_body_filename(sec: FrontMatterSection) -> str:
    """Return the on-disk filename for one front-matter section."""
    return f"{sec.ordinal:02d}-{sec.slug}.md"


def front_matter_body_relpath_under_edition(sec: FrontMatterSection) -> str:
    """Return the path under `<edition_root>/front-matter/...`."""
    return f"front-matter/{front_matter_body_filename(sec)}"


def hash_text_sha256(text: str) -> str:
    """SHA-256 hex digest of a string -- exposed so tests can pin hashes."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()
