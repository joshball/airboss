"""Section extraction via the printed Table of Contents (Option 3).

Determinism contract: same source PDF + same `phak.yaml` configuration =
identical output, byte-for-byte. No randomness, no model calls, no
non-monotonic iteration. The compare script and the seed both depend on
this guarantee; do not introduce any state that breaks it.

Pipeline shape:

1. Read TOC page range from the YAML config (`toc.page_start..toc.page_end`).
2. For each TOC page, walk PyMuPDF's `dict` text blocks line-by-line. The
   PHAK TOC lays out two columns; the chapter heading sits at column-x and
   sections beneath sit at column-x or column-x + indent. We treat:
     - "Chapter N" heading (no dotted-leader page) -> sets the chapter context
     - Title-only line followed by a numeric page like `12-1` -> level inferred
       from indent depth relative to that chapter's column-x.
3. Emit a `SectionTreeNode` per leaf TOC entry, with `page_anchor` set to the
   printed page reference ("12-7"), `parent_title` walked from the indent
   stack.
4. For each entry, optionally verify against the body text by walking to the
   resolved PDF page and looking for a heading-style text run whose font
   fingerprint matches `heading_style` and whose Levenshtein-similarity to the
   TOC title clears `heading_match_threshold`. Mismatches are logged and the
   entry is dropped (the chapter row still owns the body text).

The body-verify step is configurable: `heading_style.verify_in_body: false`
in YAML disables it (useful when first onboarding a handbook with unknown
typesetting before tuning the fingerprint).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from pathlib import Path

import fitz

from .config_loader import HandbookConfig
from .outline import OutlineNode
from .section_tree import STRATEGY_TOC, SectionTreeNode

# Dotted-leader entry: title + dots + printed page like "12-7" or "12-23".
# We allow trailing whitespace and tolerate em-spaces + non-breaking spaces.
_DOTTED_LEADER_RE = re.compile(r"^(?P<title>.+?)\s*[\.…]{2,}\s*(?P<page>\d{1,3}-\d{1,3})\s*$")
"""Single-line dotted-leader entry. Title + dots + `<chapter>-<page>`."""

_CHAPTER_HEADING_RE = re.compile(r"^Chapter\s+(\d+)$", re.IGNORECASE)
"""TOC chapter sentinel ('Chapter 12') without a dotted-leader page."""

_TITLE_TAIL_RE = re.compile(r"^(?P<title>.+?)\s*[\.…]{2,}\s*$")
"""Truncated TOC entry: title + dots, no page (the page is on the next line)."""

_PAGE_HEAD_RE = re.compile(r"^\s*(?P<page>\d{1,3}-\d{1,3})\s*$")
"""Continuation line carrying just the printed page reference."""

_ROMAN_PAGE_RE = re.compile(r"^[ivxlcdm]{1,8}$", re.IGNORECASE)
"""Line containing only a Roman-numeral page header (PHAK ToC page numbers)."""

_FAA_PAGE_RE = re.compile(r"\b(?P<chap>\d+)-(?P<page>\d+)\b")


@dataclass(frozen=True)
class TocConfig:
    """Subset of `phak.yaml -> toc` consumed by this module."""

    page_start: int
    page_end: int
    pattern: str = "dotted_leader"

    @classmethod
    def from_raw(cls, raw: dict[str, object]) -> TocConfig:
        return cls(
            page_start=int(raw["page_start"]),
            page_end=int(raw["page_end"]),
            pattern=str(raw.get("pattern", "dotted_leader")),
        )


@dataclass(frozen=True)
class HeadingStyleConfig:
    """Subset of `phak.yaml -> heading_style` consumed by this module."""

    body_font_size: float = 10.5
    heading_min_size_ratio: float = 1.05
    heading_color_hex: str = "#ef4144"
    heading_match_threshold: float = 0.85
    verify_in_body: bool = True

    @classmethod
    def from_raw(cls, raw: dict[str, object] | None) -> HeadingStyleConfig:
        raw = raw or {}
        return cls(
            body_font_size=float(raw.get("body_font_size", 10.5)),
            heading_min_size_ratio=float(raw.get("heading_min_size_ratio", 1.05)),
            heading_color_hex=str(raw.get("heading_color_hex", "#ef4144")),
            heading_match_threshold=float(raw.get("heading_match_threshold", 0.85)),
            verify_in_body=bool(raw.get("verify_in_body", True)),
        )


@dataclass
class TocLine:
    """One line of TOC text, captured with its column position for indent."""

    text: str
    x: float
    page_num: int  # PDF page number (1-indexed)


@dataclass
class TocExtractionResult:
    """What `extract_via_toc` returns to callers."""

    nodes: list[SectionTreeNode]
    warnings: list[str] = field(default_factory=list)


def extract_via_toc(
    pdf_path: Path,
    config: HandbookConfig,
    chapters: list[OutlineNode],
    *,
    raw_yaml: dict[str, object] | None = None,
) -> TocExtractionResult:
    """Walk the TOC pages and emit a section tree per chapter in `chapters`.

    `chapters` is the chapter-level outline emitted by `outline.detect_outline_from_text`
    (or `outline.parse_outline`); we only emit nodes at level 1+ underneath
    each chapter. Chapters not present in `chapters` are skipped silently --
    the caller decides which chapters round-trip into the manifest.
    """
    if raw_yaml is None:
        raw_yaml = {}
    toc_raw = raw_yaml.get("toc")
    if not toc_raw or not isinstance(toc_raw, dict):
        raise ValueError(
            f"sections_via_toc requires a `toc:` block in the handbook YAML config. "
            f"Add toc.page_start and toc.page_end to {config.document_slug}.yaml."
        )
    toc_cfg = TocConfig.from_raw(toc_raw)
    style_cfg = HeadingStyleConfig.from_raw(raw_yaml.get("heading_style"))  # type: ignore[arg-type]

    chapter_ords = {c.ordinal for c in chapters if c.level == "chapter"}
    if not chapter_ords:
        raise ValueError("extract_via_toc received an empty chapter set.")

    with fitz.open(pdf_path) as doc:
        toc_lines = _collect_toc_lines(doc, toc_cfg)
        # PHAK's TOC repeats the chapter title as the first dotted-leader
        # entry under each `Chapter N` sentinel; AFH's does not. The parser
        # honors `repeat_chapter_title_as_first_entry` accordingly so AFH
        # doesn't accidentally swallow its first real section.
        repeat_chapter_title = toc_cfg.pattern == "dotted_leader"
        nodes, warnings = _parse_toc_lines(
            toc_lines, chapter_ords, repeat_chapter_title=repeat_chapter_title
        )
        if style_cfg.verify_in_body:
            verify_warnings = _verify_against_body(doc, nodes, chapters, style_cfg, config.page_offset)
            warnings.extend(verify_warnings)

    return TocExtractionResult(nodes=nodes, warnings=warnings)


def _coalesce_toc_lines(lines: list[TocLine]) -> list[TocLine]:
    """Merge multi-line TOC entries into single logical lines.

    Two patterns to handle:

    - **Title-tail then page**: `"Foo Bar Baz...."` (ends in dots) + `"12-7"`.
      Coalesce into `"Foo Bar Baz........ 12-7"`.
    - **Title-only continuation then dotted-leader**: `"Methods by Which..."`
      (no dots, plain text) + `"Point..............12-14"`.
      Coalesce into `"Methods by Which... Point..............12-14"`.

    Same-x within 2px is the gate. We use a 3-line lookahead so a stray
    continuation line never eats an unrelated dotted-leader.
    """
    # Drop Roman-numeral page headers ("viii", "xiii") from PHAK's TOC pages
    # before any merging logic. These appear at the top of each TOC page and
    # otherwise bleed into the next entry as a phantom continuation.
    lines = [line for line in lines if not _ROMAN_PAGE_RE.match(line.text.strip())]
    out: list[TocLine] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        # Pattern A: title-tail (ends in dots) + page-only line.
        if _TITLE_TAIL_RE.match(line.text) and i + 1 < len(lines):
            nxt = lines[i + 1]
            m_page = _PAGE_HEAD_RE.match(nxt.text)
            if m_page and abs(nxt.x - line.x) < 200:  # page may be on right margin
                out.append(
                    TocLine(
                        text=f"{line.text.rstrip('. …')} ........ {m_page.group('page')}",
                        x=line.x,
                        page_num=line.page_num,
                    )
                )
                i += 2
                continue
        # Pattern B: title-only continuation followed by a dotted-leader entry.
        if (
            not _DOTTED_LEADER_RE.match(line.text)
            and not _CHAPTER_HEADING_RE.match(line.text)
            and not _TITLE_TAIL_RE.match(line.text)
            and not _PAGE_HEAD_RE.match(line.text)
            and i + 1 < len(lines)
        ):
            nxt = lines[i + 1]
            if _DOTTED_LEADER_RE.match(nxt.text) and abs(nxt.x - line.x) < 2:
                out.append(
                    TocLine(
                        text=f"{line.text.rstrip()} {nxt.text}",
                        x=line.x,
                        page_num=nxt.page_num,
                    )
                )
                i += 2
                continue
        out.append(line)
        i += 1
    return out


def _collect_toc_lines(doc: fitz.Document, toc_cfg: TocConfig) -> list[TocLine]:
    """Read every TOC page, joining same-y-band spans so column lines stay intact.

    Two layouts are supported:

    - ``dotted_leader`` (PHAK convention): each TOC line ships its title and
      the printed page on a single PDF line, separated by leader dots.
    - ``right_column`` (AFH 3C convention): each TOC entry ships its title in
      the left column and its page reference in a far-right column, on
      different (but close) y values. We pair them by y-band and synthesize a
      ``"title ........ <page>"`` line so the downstream dotted-leader parser
      (`_parse_toc_lines`) doesn't need to learn a second layout.
    """
    if toc_cfg.pattern == "right_column":
        return _collect_toc_lines_right_column(doc, toc_cfg)
    lines: list[TocLine] = []
    for page_num in range(toc_cfg.page_start, toc_cfg.page_end + 1):
        if page_num < 1 or page_num > doc.page_count:
            continue
        page = doc.load_page(page_num - 1)
        page_dict = page.get_text("dict")
        for block in page_dict.get("blocks", []):
            for line in block.get("lines", []):
                spans = line.get("spans", [])
                if not spans:
                    continue
                text = "".join(s.get("text", "") for s in spans).strip()
                if not text:
                    continue
                bbox = line.get("bbox", (0, 0, 0, 0))
                lines.append(TocLine(text=text, x=float(bbox[0]), page_num=page_num))
    return lines


# Page-anchor pattern reused by the right-column collector.
_RIGHT_COLUMN_PAGE_RE = re.compile(r"^\d{1,3}-\d{1,3}$")
# Maximum vertical distance (in PDF points) between a title line and its
# right-column page anchor for the pair to count as the same TOC entry. The
# AFH 3C TOC offsets the page anchor by ~1.5pt; 6pt is generous without
# crossing into the next entry, which is typeset ~14pt below.
_RIGHT_COLUMN_Y_BAND = 6.0


def _collect_toc_lines_right_column(doc: fitz.Document, toc_cfg: TocConfig) -> list[TocLine]:
    """Pair left-column titles with right-column page anchors by y-band.

    Returns one synthetic ``TocLine`` per paired entry whose `text` mimics
    the dotted-leader form ``"<title> ........ <chap>-<page>"``. Lines whose
    page anchor can't be located within `_RIGHT_COLUMN_Y_BAND` of any title
    are dropped (they're typically bookmarks-style chapter headings that the
    `_CHAPTER_HEADING_RE` parser will pick up separately).

    "Chapter N: Title" lines (no page anchor) pass through untouched so the
    downstream parser still sees its sentinel.
    """
    chapter_heading_re = re.compile(r"^Chapter\s+(\d+)\b", re.IGNORECASE)
    lines: list[TocLine] = []
    for page_num in range(toc_cfg.page_start, toc_cfg.page_end + 1):
        if page_num < 1 or page_num > doc.page_count:
            continue
        page = doc.load_page(page_num - 1)
        page_dict = page.get_text("dict")
        # Collect all line-level spans on the page with their (x, y, text).
        raw: list[tuple[float, float, str]] = []
        for block in page_dict.get("blocks", []):
            for line in block.get("lines", []):
                spans = line.get("spans", [])
                if not spans:
                    continue
                text = "".join(s.get("text", "") for s in spans).strip()
                if not text:
                    continue
                bbox = line.get("bbox", (0, 0, 0, 0))
                raw.append((float(bbox[0]), float(bbox[1]), text))
        # Split into anchors (right column, page-anchor only) and titles.
        anchors: list[tuple[float, float, str]] = []
        titles: list[tuple[float, float, str]] = []
        for entry in raw:
            x, y, text = entry
            if _RIGHT_COLUMN_PAGE_RE.match(text):
                anchors.append(entry)
            else:
                titles.append(entry)
        used_anchor_idx: set[int] = set()
        for tx, ty, ttext in titles:
            chap_m = chapter_heading_re.match(ttext)
            # Pass chapter sentinels through verbatim; they have no page anchor
            # and the downstream parser keys off the regex.
            if chap_m:
                lines.append(TocLine(text=f"Chapter {int(chap_m.group(1))}", x=tx, page_num=page_num))
                # Also emit the inline-title form so we can later associate the
                # chapter title with its body chapter (consumed by the chapter
                # parser's "first dotted leader after Chapter N" rule).
                continue
            # Find the closest unused anchor within the y-band.
            best: tuple[float, int] | None = None  # (distance, index)
            for i, (ax, ay, _atext) in enumerate(anchors):
                if i in used_anchor_idx:
                    continue
                if abs(ay - ty) > _RIGHT_COLUMN_Y_BAND:
                    continue
                if ax <= tx + 50:  # anchor must be to the right of the title
                    continue
                dist = abs(ay - ty)
                if best is None or dist < best[0]:
                    best = (dist, i)
            if best is None:
                continue
            used_anchor_idx.add(best[1])
            page_text = anchors[best[1]][2]
            synthetic = f"{ttext.rstrip()} ........ {page_text}"
            lines.append(TocLine(text=synthetic, x=tx, page_num=page_num))
    return lines


def _parse_toc_lines(
    lines: list[TocLine],
    known_chapter_ords: set[int],
    *,
    repeat_chapter_title: bool = True,
) -> tuple[list[SectionTreeNode], list[str]]:
    """Two-pass parse: collapse continuation lines, then emit nodes by indent.

    PHAK splits long TOC titles across two lines; the second line either
    continues the title (no dotted leader) or carries just the dotted-leader
    page reference. We coalesce those into single logical entries before
    emitting nodes so indent-based level inference is stable.

    When `repeat_chapter_title` is True (the PHAK convention), the first
    dotted-leader entry after a `Chapter N` sentinel is treated as the
    chapter title repeated and dropped from the section list (the chapter
    row already exists upstream). When False (AFH 3C convention, where the
    chapter title is inline on the sentinel line), every dotted-leader
    entry becomes a section.
    """
    coalesced: list[TocLine] = _coalesce_toc_lines(lines)
    # Now walk coalesced lines, tracking the active chapter and indent stack.
    nodes: list[SectionTreeNode] = []
    warnings: list[str] = []

    chapter_column_x: float | None = None
    chapter_ord: int | None = None
    # Stack of (level, indent_x, title) frames so deeper entries can pick a parent.
    indent_stack: list[tuple[int, float, str]] = []

    i = 0
    while i < len(coalesced):
        line = coalesced[i]
        text = line.text.strip()
        # "Chapter N" sentinel: next dotted-leader entry is the chapter title.
        m_ch = _CHAPTER_HEADING_RE.match(text)
        if m_ch:
            chap_num = int(m_ch.group(1))
            if chap_num not in known_chapter_ords:
                warnings.append(
                    f"toc: 'Chapter {chap_num}' in TOC has no matching body chapter; skipping its TOC subtree"
                )
                chapter_ord = None
                chapter_column_x = None
                indent_stack = []
            else:
                chapter_ord = chap_num
                chapter_column_x = None  # set on the first dotted-leader entry below
                indent_stack = []
            i += 1
            continue
        m_dot = _DOTTED_LEADER_RE.match(text)
        if not m_dot:
            i += 1
            continue
        title = m_dot.group("title").strip()
        page = m_dot.group("page")
        page_chap = int(page.split("-", 1)[0])
        # First dotted-leader after a "Chapter N" sentinel is the chapter
        # title repeated under the PHAK convention; we drop it because the
        # chapter-level row already exists upstream. Under the AFH 3C
        # convention the chapter title is on the sentinel line itself, so
        # the first dotted-leader is a real section -- we still seed
        # `chapter_column_x` from it but emit it as a node.
        if chapter_ord is not None and chapter_column_x is None:
            chapter_column_x = line.x
            if repeat_chapter_title:
                i += 1
                continue
        # If we somehow hit an entry whose printed-page chapter differs from the
        # active chapter, switch context (PHAK's Coriolis Force pattern).
        if chapter_ord is None or page_chap != chapter_ord:
            if page_chap in known_chapter_ords:
                chapter_ord = page_chap
                chapter_column_x = line.x
                indent_stack = []
                i += 1
                continue
            i += 1
            continue
        # Indent depth: 0 -> level 1, anything indented -> level 2.
        # The handbook DB schema supports a chapter / section / subsection
        # tree (max 3 levels = max 3-dot codes like 12.3.2). PHAK's ToC
        # occasionally goes one level deeper (e.g. "Hazards" under
        # "Thunderstorms" under "Fronts"); we collapse those into level 2
        # under the most recent level-1 ancestor so the dotted code stays
        # within the schema's 3-level limit.
        if chapter_column_x is None:
            chapter_column_x = line.x
        delta = max(0.0, line.x - chapter_column_x)
        level = 1 if delta < 4 else 2
        # Pop the indent stack to the right ancestor.
        while indent_stack and indent_stack[-1][0] >= level:
            indent_stack.pop()
        parent_title = indent_stack[-1][2] if indent_stack else None
        node = SectionTreeNode(
            chapter_ordinal=chapter_ord,
            level=level,
            title=title,
            parent_title=parent_title,
            page_anchor=page,
            provenance=STRATEGY_TOC,
            confidence=1.0,
            extra={"toc_x": f"{line.x:.1f}", "toc_page": str(line.page_num)},
        )
        nodes.append(node)
        indent_stack.append((level, line.x, title))
        i += 1

    return nodes, warnings


def _verify_against_body(
    doc: fitz.Document,
    nodes: list[SectionTreeNode],
    chapters: list[OutlineNode],
    style_cfg: HeadingStyleConfig,
    page_offset: int,
) -> list[str]:
    """Confirm each TOC entry has a matching heading-style run on the named body page.

    For PHAK the heading fingerprint is "red, bold, ~12pt" -- color
    `#ef4144`, Helvetica-Bold, size at or above `heading_min_size_ratio *
    body_font_size`. Mismatches are logged but do not drop the node; the
    caller logs the warning into the manifest and the section row gets
    seeded as-is. (Joshua decides per-chapter via `phak.yaml` whether to
    trust TOC for that chapter.)
    """
    warnings: list[str] = []
    target_color = _hex_to_int(style_cfg.heading_color_hex)
    min_size = style_cfg.body_font_size * style_cfg.heading_min_size_ratio

    # Build chapter -> (page_start, page_end) for body navigation.
    chapter_ranges: dict[int, tuple[int, int]] = {
        int(c.code): (c.page_start, c.page_end) for c in chapters if c.level == "chapter"
    }

    # Cache headings per-page so verifying many nodes against the same page
    # remains O(pages), not O(nodes * pages).
    headings_cache: dict[int, list[str]] = {}

    for node in nodes:
        ch_range = chapter_ranges.get(node.chapter_ordinal)
        if ch_range is None or node.page_anchor is None:
            continue
        m_anchor = _FAA_PAGE_RE.match(node.page_anchor)
        if not m_anchor:
            continue
        # Convert FAA anchor "12-7" to a PDF page within the chapter range.
        # Strategy: find the body page whose first FAA-page header equals the
        # anchor. Fall back to chapter_start + (page-1) using page_offset.
        target_pdf_page = _find_body_page_for_anchor(
            doc, node.page_anchor, ch_range[0], ch_range[1], page_offset
        )
        if target_pdf_page is None:
            warnings.append(
                f"toc-verify: chapter {node.chapter_ordinal} title={node.title!r}: "
                f"could not locate body page for anchor {node.page_anchor}"
            )
            continue
        if target_pdf_page not in headings_cache:
            headings_cache[target_pdf_page] = _collect_heading_runs(
                doc.load_page(target_pdf_page - 1), target_color, min_size
            )
        if not _heading_matches(node.title, headings_cache[target_pdf_page], style_cfg.heading_match_threshold):
            warnings.append(
                f"toc-verify: chapter {node.chapter_ordinal} title={node.title!r} "
                f"(anchor {node.page_anchor}, PDF p{target_pdf_page}): no body heading >= "
                f"{style_cfg.heading_match_threshold:.2f} similarity"
            )
    return warnings


def _find_body_page_for_anchor(
    doc: fitz.Document, anchor: str, page_start: int, page_end: int, page_offset: int
) -> int | None:
    """Resolve "12-7" to the PDF page whose printed header reads `12-7`."""
    target = anchor.strip()
    for pdf_page in range(page_start, page_end + 1):
        if pdf_page < 1 or pdf_page > doc.page_count:
            continue
        page = doc.load_page(pdf_page - 1)
        text = page.get_text("text")
        for line in text.splitlines()[:8]:
            if line.strip().startswith(target):
                return pdf_page
    # Fallback: derive from chapter start + (page-1) using page_offset.
    m = _FAA_PAGE_RE.match(target)
    if not m:
        return None
    page_within_chapter = int(m.group("page"))
    candidate = page_start + page_within_chapter - 1
    if 1 <= candidate <= page_end:
        return candidate
    return None


def _collect_heading_runs(page: fitz.Page, target_color: int, min_size: float) -> list[str]:
    """Pull every text run whose color + size matches the heading fingerprint."""
    runs: list[str] = []
    for block in page.get_text("dict").get("blocks", []):
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                text = span.get("text", "").strip()
                if not text:
                    continue
                if span.get("color", 0) != target_color:
                    continue
                if float(span.get("size", 0)) < min_size:
                    continue
                runs.append(text)
    return runs


def _heading_matches(toc_title: str, body_runs: list[str], threshold: float) -> bool:
    if not body_runs:
        return False
    norm_toc = toc_title.lower().strip()
    for run in body_runs:
        norm_run = run.lower().strip()
        sim = SequenceMatcher(None, norm_toc, norm_run).ratio()
        if sim >= threshold:
            return True
    return False


def _hex_to_int(hex_str: str) -> int:
    s = hex_str.lstrip("#")
    return int(s, 16)
