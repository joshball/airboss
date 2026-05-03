"""Section extraction via a hand-extracted TOC markdown sidecar.

This strategy is designed for handbooks where the embedded PDF TOC is empty
(`fitz.get_toc()` returns 0 entries) AND no per-chapter PDFs are published.
IFH (FAA-H-8083-15B) is the canonical instance.

The user pre-extracts the printed TOC into a markdown file. The path is
declared in the per-handbook YAML as ``toc_file: <relative path>``. The
parser walks that file line-by-line and emits:

- One ``OutlineNode`` per chapter (level "chapter", code = chapter ordinal).
- One ``SectionTreeNode`` per dotted-leader entry beneath each chapter.

Determinism contract: same TOC file in = identical chapter list and section
list out. No randomness, no LLM calls, no PyMuPDF state -- just text
parsing.

## Chapter 6 / 7 Section I / II quirk

IFH (FAA-H-8083-15B) chapters 6 and 7 each subdivide into Section I and
Section II in the printed TOC, e.g. ``Chapter 6, Section I`` (analog
instrumentation) and ``Chapter 6, Section II`` (electronic flight
display). The schema's chapter / section / subsection 3-level model
cannot represent this directly.

The WP `wp-ifh-section-tree` decision (option b in spec.md) models this
as: chapter 6 holds two top-level sections `6.1` (Section I) and `6.2`
(Section II); same for chapter 7. Deeper TOC entries beneath each
Section I / II become subsections (level 2 under the Section). FAA
chapter ordinals (1..11) and FAA page anchors (`6-1`, `6-15`, `7-1`,
`7-33`) round-trip without renumbering.

## Hierarchy depth

A hand-extracted TOC strips the printed indentation that the PDF layout
used to indicate L2+ depth. We do not attempt to recover the column
hierarchy. Chapters with no Section I / II split flatten every TOC line
to level 1 (a "section" under the chapter). Chapters 6 and 7 nest
beneath their Section I / II parent at level 2 (a "subsection" under the
Section).

The optional follow-up LLM prompt-flow can re-derive deeper hierarchy
when wanted; the deterministic TOC-file path runs without it.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

from .outline import OutlineError, OutlineNode
from .section_tree import SectionTreeNode

# Strategy provenance. Same module-private constant as `STRATEGY_TOC` /
# `STRATEGY_PROMPT` in section_tree.py; kept here so callers can surface the
# strategy name in the manifest without coupling to that module.
STRATEGY_TOC_FILE = "toc-file"

# Recognise the chapter sentinels used in the user's hand-extracted TOC.
# Two shapes: bare ``Chapter <N>`` and the IFH-specific ``Chapter <N>,
# Section <I|II>`` quirk.
_CHAPTER_LINE_RE = re.compile(r"^Chapter\s+(?P<num>\d+)\s*$", re.IGNORECASE)
_CHAPTER_SECTION_LINE_RE = re.compile(
    r"^Chapter\s+(?P<num>\d+)\s*,\s*Section\s+(?P<roman>I{1,3}|IV|V?I{0,3})\s*$",
    re.IGNORECASE,
)
# Dotted-leader entry: title + 2+ leader chars (`.` or unicode ellipsis) +
# FAA page anchor like ``1-1`` or ``11-23``. Trailing whitespace tolerated.
# Also matches appendix entries ``A-1``, ``B-1``, glossary ``G-1``,
# index ``I-1``.
_DOTTED_LEADER_RE = re.compile(
    r"^(?P<title>.+?)\s*[\.…]{2,}\s*(?P<page>(?:\d{1,3}|[A-Z])-\d{1,3})\s*$"
)
# Continuation line: a title prefix that ends without dots and without a
# page anchor. The next line carries the dotted-leader + page. We coalesce
# the two before classifying.
_PURE_TITLE_RE = re.compile(r"^[^\.…]+$")
# Roman numeral I -> 1, II -> 2, etc. Bound to single-section-numbering
# usage (the IFH quirk only ever hits I and II); we reject anything beyond
# IV explicitly so a typo isn't silently swallowed.
_ROMAN_TO_INT = {"I": 1, "II": 2, "III": 3, "IV": 4}


@dataclass
class TocFileConfig:
    """Subset of the handbook YAML consumed by the toc-file-sidecar parser."""

    toc_file_path: Path

    @classmethod
    def from_raw(cls, raw_yaml: dict[str, object], repo_root: Path) -> TocFileConfig:
        toc_file = raw_yaml.get("toc_file")
        if not isinstance(toc_file, str) or not toc_file.strip():
            raise OutlineError(
                "toc-file-sidecar strategy requires a `toc_file:` field in the "
                "handbook YAML (relative path to a hand-extracted TOC markdown)."
            )
        absolute = (repo_root / toc_file).resolve()
        if not absolute.is_file():
            raise OutlineError(
                f"toc-file-sidecar: toc_file `{toc_file}` does not resolve to a "
                f"file (looked at {absolute})."
            )
        return cls(toc_file_path=absolute)


@dataclass
class TocFileExtractionResult:
    """What the parser hands back to the CLI."""

    chapters: list[OutlineNode]
    sections: list[SectionTreeNode]
    warnings: list[str] = field(default_factory=list)


@dataclass
class _CoalescedLine:
    """One TOC-file line after multi-line title coalescing."""

    text: str
    source_line: int


def parse_toc_file(
    toc_path: Path,
    *,
    chapter_page_starts: dict[int, int] | None = None,
) -> TocFileExtractionResult:
    """Parse a hand-extracted TOC markdown file into chapters + sections.

    `chapter_page_starts`, when supplied, gives the 1-indexed PDF start
    page for each chapter ordinal. The chapter outline emits page ranges
    closed by the next chapter's start (last chapter ends at the document
    end -- the caller fills that in). Pass ``None`` to skip page-range
    population (chapters get start/end of 1, callers patch later).
    """
    text = toc_path.read_text(encoding="utf-8")
    lines = [line.rstrip("\n") for line in text.splitlines()]
    coalesced = _coalesce_lines(lines)

    chapters: list[OutlineNode] = []
    sections: list[SectionTreeNode] = []
    warnings: list[str] = []

    # State for the chapter walker.
    current_chapter: int | None = None
    # Active "Section I" / "Section II" parent inside chapter 6 / 7 (the
    # IFH quirk). When non-None, dotted-leader entries become L2
    # subsections under this section; when None, they become L1 sections.
    section_parent_ord: int | None = None
    # Within-chapter L1 ordinal counter. Reset on chapter change.
    section_ordinal: int = 0
    # Within-section L2 subsection counter. Reset on section parent change.
    subsection_ordinal: int = 0

    # Chapter title is the first dotted-leader line after a chapter
    # sentinel -- it carries the chapter title + chapter page anchor.
    # Track whether we still need to swallow it.
    pending_chapter_title: bool = False
    # Pending "Section I" / "Section II" sentinel awaiting its title line.
    pending_section_sentinel: tuple[int, str] | None = None

    chapter_titles: dict[int, str] = {}
    chapter_first_page: dict[int, str] = {}

    for c_line in coalesced:
        line = c_line.text.strip()
        if not line:
            continue

        m_ch_section = _CHAPTER_SECTION_LINE_RE.match(line)
        if m_ch_section is not None:
            ch_num = int(m_ch_section.group("num"))
            roman = m_ch_section.group("roman").upper()
            section_idx = _ROMAN_TO_INT.get(roman)
            if section_idx is None:
                warnings.append(
                    f"toc-file: unrecognised Roman numeral in 'Chapter {ch_num}, "
                    f"Section {roman}' at line {c_line.source_line}; entry skipped"
                )
                continue
            # New section sentinel implies the chapter context already exists.
            if current_chapter is None or current_chapter != ch_num:
                # Chapter sentinel was missing -- synthesize it and warn.
                warnings.append(
                    f"toc-file: 'Chapter {ch_num}, Section {roman}' at line "
                    f"{c_line.source_line} appeared without a preceding "
                    f"'Chapter {ch_num}' line; synthesizing chapter context"
                )
                current_chapter = ch_num
                section_ordinal = 0
                pending_chapter_title = False
                # The chapter title is unknown without a `Chapter N` line; the
                # IFH printed TOC stamps the chapter title on the section
                # sentinel line itself in some editions. Fall back to
                # `Chapter <N>` so `chapter_titles` is non-empty (the parser
                # otherwise hard-fails after the loop) and downstream code
                # can patch via `title_overrides`.
                chapter_titles.setdefault(ch_num, f"Chapter {ch_num}")
            section_parent_ord = section_idx
            section_ordinal += 1
            subsection_ordinal = 0
            pending_section_sentinel = (section_idx, roman)
            continue

        m_chapter = _CHAPTER_LINE_RE.match(line)
        if m_chapter is not None:
            ch_num = int(m_chapter.group("num"))
            current_chapter = ch_num
            section_parent_ord = None
            section_ordinal = 0
            subsection_ordinal = 0
            pending_chapter_title = True
            pending_section_sentinel = None
            continue

        # Skip front-matter (Preface, Acknowledgments, Introduction)
        # appearing BEFORE the first Chapter sentinel; these are not part
        # of the section tree.
        if current_chapter is None:
            continue

        m_dot = _DOTTED_LEADER_RE.match(line)
        if m_dot is None:
            # Unrecognised line inside a chapter -- log and skip.
            warnings.append(
                f"toc-file: line {c_line.source_line} did not parse as a "
                f"dotted-leader entry: {line!r}"
            )
            continue

        title = m_dot.group("title").strip()
        page = m_dot.group("page")
        page_chap_token = page.split("-", 1)[0]

        # Appendices / Glossary / Index land here too; their pages start
        # with letters (`A`, `B`, `G`, `I`). They are emitted as separate
        # appendix-shaped chapters via the bare chapter regex when the TOC
        # carries them on a standalone line; the inline form
        # ``Appendix A..........A-1`` is treated as a flat appendix entry
        # under the LAST chapter context. We intentionally skip them here
        # so the section list stays chapter-bounded.
        if not page_chap_token.isdigit():
            # Drop the appendix-style entry from the section list.
            continue

        # Pending chapter title: the first dotted-leader entry under a
        # `Chapter N` sentinel is the chapter title + start-page anchor.
        if pending_chapter_title:
            chapter_titles[current_chapter] = title
            chapter_first_page[current_chapter] = page
            pending_chapter_title = False
            continue

        if pending_section_sentinel is not None:
            sec_idx, roman = pending_section_sentinel
            section_title = f"Section {roman} -- {title}"
            sections.append(
                SectionTreeNode(
                    chapter_ordinal=current_chapter,
                    level=1,
                    title=section_title,
                    parent_title=chapter_titles.get(current_chapter),
                    page_anchor=page,
                    ordinal=sec_idx,
                    provenance=STRATEGY_TOC_FILE,
                    confidence=1.0,
                    extra={
                        "source_line": str(c_line.source_line),
                        "section_kind": f"Section {roman}",
                    },
                )
            )
            section_ordinal = sec_idx
            pending_section_sentinel = None
            continue

        # Regular dotted-leader entry. If we are inside a Section I/II
        # parent, this becomes a subsection (L2) under that section.
        # Otherwise it is a flat L1 section under the chapter.
        if section_parent_ord is not None:
            subsection_ordinal += 1
            sections.append(
                SectionTreeNode(
                    chapter_ordinal=current_chapter,
                    level=2,
                    title=title,
                    parent_title=None,
                    page_anchor=page,
                    ordinal=subsection_ordinal,
                    provenance=STRATEGY_TOC_FILE,
                    confidence=1.0,
                    extra={"source_line": str(c_line.source_line)},
                )
            )
        else:
            section_ordinal += 1
            sections.append(
                SectionTreeNode(
                    chapter_ordinal=current_chapter,
                    level=1,
                    title=title,
                    parent_title=chapter_titles.get(current_chapter),
                    page_anchor=page,
                    ordinal=section_ordinal,
                    provenance=STRATEGY_TOC_FILE,
                    confidence=1.0,
                    extra={"source_line": str(c_line.source_line)},
                )
            )

    if not chapter_titles:
        raise OutlineError(
            f"toc-file-sidecar: no `Chapter <N>` sentinels found in "
            f"{toc_path}. Verify the file has the expected shape."
        )

    chapters = _emit_chapter_outline(chapter_titles, chapter_first_page, chapter_page_starts)

    return TocFileExtractionResult(chapters=chapters, sections=sections, warnings=warnings)


def _coalesce_lines(lines: list[str]) -> list[_CoalescedLine]:
    """Merge two-line title wraps into single logical lines.

    The hand-extracted TOC occasionally splits a long title across two
    lines: the first line carries the title prefix without a page anchor,
    the next line carries the title suffix + dotted-leader + page. The
    parser needs the whole title in one place to classify the entry; the
    coalescer joins them.

    Lines that already match the dotted-leader, chapter, or chapter-section
    regexes pass through unchanged. A line that is a "pure title"
    (no dots, no page) gets merged with its successor when the successor
    is itself a dotted-leader or a `Title.....` pattern. Anything else
    passes through.
    """
    result: list[_CoalescedLine] = []
    i = 0
    n = len(lines)
    while i < n:
        text = lines[i].strip()
        if not text:
            i += 1
            continue
        # Sentinels pass through.
        if _CHAPTER_LINE_RE.match(text) or _CHAPTER_SECTION_LINE_RE.match(text):
            result.append(_CoalescedLine(text=text, source_line=i + 1))
            i += 1
            continue
        if _DOTTED_LEADER_RE.match(text):
            result.append(_CoalescedLine(text=text, source_line=i + 1))
            i += 1
            continue
        # Pure-title continuation candidate. Try to fold the next line into it.
        if _PURE_TITLE_RE.match(text) and i + 1 < n:
            nxt = lines[i + 1].strip()
            # Don't fold across a chapter sentinel boundary.
            if (
                nxt
                and not _CHAPTER_LINE_RE.match(nxt)
                and not _CHAPTER_SECTION_LINE_RE.match(nxt)
                and (_DOTTED_LEADER_RE.match(nxt) or _PURE_TITLE_RE.match(nxt))
            ):
                merged = f"{text} {nxt}"
                if _DOTTED_LEADER_RE.match(merged):
                    result.append(_CoalescedLine(text=merged, source_line=i + 1))
                    i += 2
                    continue
                # If the merge still doesn't form a dotted-leader, look at the next-next line
                # (handles 3-line title wraps).
                if i + 2 < n:
                    nxt2 = lines[i + 2].strip()
                    triple = f"{text} {nxt} {nxt2}"
                    if _DOTTED_LEADER_RE.match(triple):
                        result.append(_CoalescedLine(text=triple, source_line=i + 1))
                        i += 3
                        continue
        # Drop unparseable line; the caller logs it as a warning when
        # encountered inside a chapter context.
        result.append(_CoalescedLine(text=text, source_line=i + 1))
        i += 1
    return result


def _emit_chapter_outline(
    chapter_titles: dict[int, str],
    chapter_first_page: dict[int, str],
    chapter_page_starts: dict[int, int] | None,
) -> list[OutlineNode]:
    """Build OutlineNode chapters from the title + first-page anchors.

    `chapter_page_starts` (when supplied by the caller) provides the
    1-indexed PDF start page for each chapter ordinal -- typically derived
    by walking the body PDF for FAA `<chap>-<page>` headers. Without it,
    we fall back to chapter_ordinal as a placeholder; the body slicer does
    the actual page resolution.
    """
    chapters: list[OutlineNode] = []
    sorted_ords = sorted(chapter_titles.keys())
    for chap_num in sorted_ords:
        title = chapter_titles[chap_num]
        page_start = (chapter_page_starts or {}).get(chap_num, 1)
        page_end = page_start  # caller patches via the body-page scanner
        chapters.append(
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
    return chapters
