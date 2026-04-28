"""Bullet-edits errata parser (the PHAK MOSAIC layout).

The PHAK October 2025 MOSAIC addendum uses a richer instruction grammar
than AFH MOSAIC. Where AFH MOSAIC consistently shapes every change as
"In Chapter N: <Title>, the following <subsection|paragraph> will be
added to the <Section> section on page <X-Y>: <body>", PHAK MOSAIC mixes
in:

- bullet-level edits ("the bullet that states 'X' will change to state
  'Y'", "the last bullet will have the following text added to the end
  of the statement: ...");
- comma-delimited chapter anchors ("Chapter 1, Introduction to Flying,
  X section, ..." rather than the AFH "In Chapter 1: ...,") that pin the
  section by name + page;
- list reordering ("the bulleted list will be reordered as follow:");
- whole-section replace and first-paragraph replace; and
- a single removal directive.

This parser walks the cleaned PDF text top-to-bottom and emits one
:class:`ErrataPatch` per discrete change. Every PHAK MOSAIC edit maps
naturally into one of the existing three patch kinds:

- ``replace_paragraph``: bullet-state changes, paragraph revisions,
  full-section revisions, list reorderings, and the LSA-definition
  removal (rendered as a typeset "(removed by FAA)" sentinel rather
  than allowing an empty replacement that the schema rejects);
- ``append_paragraph``: new bullets added to an existing list,
  trailing-text additions on a bullet, and any "the following will be
  added" prose that does not start a new subsection;
- ``add_subsection``: not exercised by PHAK MOSAIC but supported here
  so future bullet-edits-shaped addenda can use the same archetype.

Layout assumptions (any miss raises :class:`UnknownErrataLayoutError`):

- The PDF text contains at least one top-level sentinel from
  :data:`_TOP_SENTINELS`.
- Chapter anchors appear either as ``In Chapter <N>:`` (AFH-style) or
  ``Chapter <N>, <Title>,`` (PHAK comma-delimited form).
- A printed page anchor of form ``<chapter>-<page>`` is reachable from
  the lead-in.

The parser is intentionally permissive with the lead-in text: PHAK
MOSAIC uses several phrasings of "Due to ..., in Chapter N, ..., the X
... will be revised as follows:" that an over-specified pattern would
miss. We anchor on the action sentinels (``will change to state``,
``will be revised as follows``, ``the bulleted list will be reordered``,
``a new bullet will be added``, ``new bullets will be added``,
``will have the following text added to the end of the statement``,
``the following will be removed``) and walk backward from each match
to recover the chapter, section, and page anchors.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import TYPE_CHECKING

from ..handbooks.base import (
    PATCH_KIND_ADD_SUBSECTION,
    PATCH_KIND_APPEND_PARAGRAPH,
    PATCH_KIND_REPLACE_PARAGRAPH,
    ErrataPatch,
)
from .base import ErrataParser, UnknownErrataLayoutError

if TYPE_CHECKING:
    from ..handbooks.base import ErrataConfig


# Sentinel marker rendered into ``replacement_text`` when the FAA directive
# is to remove a definition or paragraph entirely. The schema enforces a
# non-empty replacement_text; this italic note keeps the field meaningful
# while preserving the "this content was deleted" semantics for the reader.
REMOVAL_SENTINEL = "*[Removed by FAA per addendum; see source URL for context.]*"


_MONTH_DAY_YEAR = re.compile(
    r"(?:January|February|March|April|May|June|July|August|September|October|November|December)" r"\s+\d{1,2},\s+\d{4}"
)


# Top-level instruction sentinels used to split the document into
# instruction-sized chunks. The split keeps the sentinel at the start of
# the next chunk so the chunk parser sees it.
_TOP_SENTINELS = (
    "The following will be removed from Chapter ",
    "The following will be revised in Chapter ",
    "In Chapter ",
    "Due to ",
)


# Block-split: one instruction starts at any sentinel that appears at a
# line start. Lookahead so the sentinel is preserved at the chunk start.
# The sentinels above translate into one large alternation. Anchored to
# beginning-of-line via re.MULTILINE.
_INSTRUCTION_SPLIT = re.compile(r"(?m)(?=^(?:" + "|".join(re.escape(s) for s in _TOP_SENTINELS) + "))")


# Page anchor: <chapter>-<page>, exactly as printed in FAA handbooks.
_PAGE_ANCHOR_PATTERN = r"\d+-\d+"

# Chapter header capture in the AFH style ("In Chapter N:") or the PHAK
# comma-delimited style ("Chapter N, Title,"). Both forms surface the
# chapter ordinal and the title. The trailing terminator is either
# "," or ":" or whitespace before "the" / "Aircraft" / etc.
_CHAPTER_HEADER = re.compile(
    r"(?:In\s+)?Chapter\s+(?P<chapter>\d+)\s*[,:]\s*(?P<chapter_title>.+?)\s*[,.]\s+",
    re.DOTALL,
)


# ----- Action sentinels (used to classify a chunk after the chapter is found)
# Each pattern captures the bits the apply pipeline needs to land the patch.

# "the bullet that states, 'X' will change to state, 'Y'"
_BULLET_STATE_CHANGE = re.compile(
    r'the\s+bullet\s+that\s+states\s*,?\s*[“"](?P<original>.+?)[”"]\s+'
    r'will\s+change\s+to\s+state\s*,?\s*[“"](?P<replacement>.+?)[”"]',
    re.DOTALL | re.IGNORECASE,
)

# "the last bullet will change to state, 'X'" / "the first bullet will change to state, 'X'"
_BULLET_ORDINAL_CHANGE = re.compile(
    r"the\s+(?P<ordinal>first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|last)\s+"
    r'bullet\s+will\s+change\s+to\s+state\s*,?\s*[“"](?P<replacement>.+?)[”"]',
    re.DOTALL | re.IGNORECASE,
)

# "the third bullet of the bulleted list will be revised as follows: <body>"
_BULLET_OF_LIST_REVISED = re.compile(
    r"the\s+(?P<ordinal>first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|last)\s+"
    r"bullet\s+of\s+the\s+bulleted\s+list\s+will\s+be\s+revised\s+as\s+follows\s*:\s*",
    re.DOTALL | re.IGNORECASE,
)

# "a new bullet will be added that states, 'X'"
_NEW_BULLET_ADDED = re.compile(
    r'a\s+new\s+bullet\s+will\s+be\s+added\s+that\s+states\s*,?\s*[“"](?P<replacement>.+?)[”"]',
    re.DOTALL | re.IGNORECASE,
)

# "new bullets will be added that say the following: <bullets>"
_NEW_BULLETS_ADDED = re.compile(
    r"new\s+bullets\s+will\s+be\s+added\s+that\s+say\s+the\s+following\s*:\s*",
    re.DOTALL | re.IGNORECASE,
)

# "the last bullet will have the following text added to the end of the statement: <text>"
_BULLET_TEXT_APPENDED = re.compile(
    r"the\s+(?P<ordinal>first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|last)\s+"
    r"bullet\s+will\s+have\s+the\s+following\s+text\s+added\s+to\s+the\s+end\s+of\s+the\s+statement\s*:\s*",
    re.DOTALL | re.IGNORECASE,
)

# "the bulleted list will be reordered as follow[s]: <bullets>"
_LIST_REORDERED = re.compile(
    r"the\s+bulleted\s+list\s+will\s+be\s+reordered\s+as\s+follows?\s*:\s*",
    re.DOTALL | re.IGNORECASE,
)

# "the paragraph after the bulleted list will be revised as follows: <body>"
_PARAGRAPH_AFTER_LIST = re.compile(
    r"the\s+paragraph\s+after\s+the\s+bulleted\s+list\s+will\s+be\s+revised\s+as\s+follows\s*:\s*",
    re.DOTALL | re.IGNORECASE,
)

# "the <ordinal> paragraph (of the X section)? on page Y-Z will be revised as follows"
# Captures both "the first paragraph of the Introduction section" and
# "the fourth paragraph on page 6-2" wordings. Tolerates the
# FAA-typo'd "be revised" without "will".
_ORDINAL_PARAGRAPH_REVISED = re.compile(
    r"the\s+(?P<ordinal>first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|last)\s+"
    r"paragraph\b.*?(?:will\s+)?be\s+revised\s+as\s+follows\s*:\s*",
    re.DOTALL | re.IGNORECASE,
)

# "the title will be revised to 'X' and the first paragraph will be revised as follows: <body>"
_TITLE_AND_PARAGRAPH_REVISED = re.compile(
    r'the\s+title\s+will\s+be\s+revised\s+to\s+[“"](?P<new_title>.+?)[”"]\s+and\s+'
    r"the\s+(?P<ordinal>first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|last)\s+"
    r"paragraph\s+will\s+be\s+revised\s+as\s+follows\s*:\s*",
    re.DOTALL | re.IGNORECASE,
)

# "(the X section on page Y-Z,?) will be revised as follows: <body>" -- whole-section replace.
# Distinct from the paragraph-revised forms above; this matches when the
# direct subject of "will be revised" is the section itself. Anchored on
# a left boundary (the chapter title's trailing comma + optional "the")
# so the captured section name does not vacuum up the chapter prefix.
# Tolerates an optional trailing comma between the subsection name and
# "section" (PHAK MOSAIC's "A Note About Light Sport Aircraft, section on
# page 3-2 ...") and the FAA's mid-anchor "Construction, " separator
# variant ("Aircraft Construction, Aircraft Design, ..., section").
# Whole-section "will be revised" sentinel (no embedded section name; the
# section is recovered from :func:`_extract_section_anchor`). Anchors on
# the page locator + revise verb so the "body" portion of the chunk can
# be sliced reliably.
_SECTION_REVISED = re.compile(
    r"\s+section\s+on\s+page\s+(?P<anchor>"
    + _PAGE_ANCHOR_PATTERN
    + r")\s*,?\s*will\s+be\s+revised\s+as\s+follows\s*:\s*",
    re.DOTALL,
)


class BulletEditsParser(ErrataParser):
    """Parser for the PHAK MOSAIC-shaped bullet-edits addendum layout."""

    name = "bullet-edits"

    def parse(self, pdf_path: Path, errata: ErrataConfig) -> list[ErrataPatch]:
        text = _extract_pdf_text(pdf_path)
        text = _strip_running_chrome(text)
        chunks = _split_into_instruction_chunks(text)
        if not chunks:
            raise UnknownErrataLayoutError(
                f"Bullet-edits parser found no top-level instruction sentinels in {pdf_path}. "
                f"Expected one of: {list(_TOP_SENTINELS)}."
            )

        patches: list[ErrataPatch] = []
        for chunk in chunks:
            patches.extend(_parse_chunk(chunk))
        if not patches:
            raise UnknownErrataLayoutError(
                f"Bullet-edits parser found {len(chunks)} instruction chunks in {pdf_path} "
                f"but classified zero of them. Action sentinels may have drifted."
            )
        return patches


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _extract_pdf_text(pdf_path: Path) -> str:
    """Read the PDF as a single string, page-joined with form feeds."""
    import fitz

    doc = fitz.open(pdf_path)
    try:
        return "\f".join(page.get_text() for page in doc)
    finally:
        doc.close()


def _strip_running_chrome(text: str) -> str:
    """Remove repeating per-page header/footer lines."""
    lines = text.split("\n")
    out: list[str] = []
    for raw in lines:
        line = raw.rstrip()
        stripped = line.strip()
        if stripped.startswith("FAA-H-8083-") and "Addendum" in stripped:
            continue
        if stripped.startswith("Page ") and " of " in stripped:
            continue
        if stripped in {
            "FAA",
            "Flight Standards Service",
            "General Aviation & Commercial Division",
            "Training & Certification Group",
            "Testing Standards Section",
        }:
            continue
        if stripped.startswith("Flight Standards Service") and "Training" in stripped:
            continue
        if _MONTH_DAY_YEAR.fullmatch(stripped):
            continue
        if stripped == "\f":
            continue
        out.append(line)
    return "\n".join(out).replace("\f", "\n")


def _split_into_instruction_chunks(text: str) -> list[str]:
    """Split the document into chunks that each begin at a top-level sentinel.

    The first slice (preamble) is dropped if it does not start with a
    sentinel. The PDF preamble carries the FAA cover paragraph and the
    "Note:" advisory which we never patch from. Page anchors split across
    a line break (``page 1-\n20``) are stitched back together so the
    sentinel matchers see ``page 1-20``.
    """
    text = _stitch_wrapped_page_anchors(text)
    chunks = _INSTRUCTION_SPLIT.split(text)
    return [c for c in chunks if any(c.lstrip().startswith(s) for s in _TOP_SENTINELS)]


def _stitch_wrapped_page_anchors(text: str) -> str:
    """Collapse ``\\d+-\\n\\s*\\d+`` and ``\\d+\\s*-\\s*\\d+`` to ``\\d+-\\d+``.

    The PDF text extractor preserves the printed line break in the
    middle of an FAA page anchor (``page 1-\n20``); we rejoin those so
    every downstream pattern sees a clean ``page 1-20``. Also collapses
    surrounding spaces (``page 1 - 20``) to the canonical hyphen form.
    """
    return re.sub(r"(\d+)\s*-\s*(\d+)", r"\1-\2", text)


def _parse_chunk(chunk: str) -> list[ErrataPatch]:
    """Classify and parse a single instruction chunk into one or more patches."""
    chapter, chapter_title = _extract_chapter(chunk)
    if chapter is None:
        return []
    page_anchor = _extract_page_anchor(chunk)

    # 1. Removal directives stand alone.
    if chunk.lstrip().startswith("The following will be removed from Chapter "):
        return _parse_removal(chunk, chapter)

    # 2. Multi-bullet "The following will be revised in Chapter N, ..., (Pages X-Y[ & X-Y]):"
    #    bodies are a list of bullets, each bullet is its own action sentinel.
    if chunk.lstrip().startswith("The following will be revised in Chapter "):
        return _parse_multi_bullet_block(chunk, chapter)

    # 3. "Due to <reason>, in Chapter N, <Title>, <Section> section on page X-Y, the X paragraph
    #    will be revised as follows: <body>". A single replace_paragraph patch.
    if chunk.lstrip().startswith("Due to "):
        return _parse_due_to_block(chunk, chapter, chapter_title, page_anchor)

    # 4. "In Chapter N, ..., the bulleted list will be reordered as follow: <bullets>"
    #    or "In Chapter N: <Title>, the X section on page Y-Z, will be revised as follows: <body>"
    if chunk.lstrip().startswith("In Chapter "):
        return _parse_in_chapter_block(chunk, chapter, chapter_title, page_anchor)

    return []


def _extract_chapter(chunk: str) -> tuple[str | None, str | None]:
    match = _CHAPTER_HEADER.search(chunk)
    if match is None:
        return None, None
    chapter_num = match.group("chapter")
    return chapter_num.zfill(2), match.group("chapter_title").strip().rstrip(",.")


def _extract_page_anchor(chunk: str) -> str | None:
    """Find the first ``<chapter>-<page>`` token after a 'page' / '(Page' / '(Pages' marker.

    Page anchors split across a line break are pre-stitched by
    :func:`_stitch_wrapped_page_anchors` at chunk-split time, so this
    function does not need to handle wrapped anchors.
    """
    match = re.search(
        r"\(?Pages?\s+(" + _PAGE_ANCHOR_PATTERN + r")",
        chunk,
        re.IGNORECASE,
    )
    if match:
        return match.group(1)
    match = re.search(
        r"on\s+page\s+(" + _PAGE_ANCHOR_PATTERN + r")",
        chunk,
        re.IGNORECASE,
    )
    if match:
        return match.group(1)
    return None


def _extract_section_anchor(chunk: str) -> str | None:
    """Pull the section anchor from a chunk.

    PHAK uses several forms; we try each in order:

    1. ``in the "<Section>" subsection on page X-Y`` (PHAK quoted-subsection form).
    2. ``Chapter N, <ChapTitle>, the <ordinal> paragraph of the <Section> section ...``
       (paragraph-of-section form).
    3. ``Chapter N, <ChapTitle>, the last paragraph of the <Section> section on page X-Y``.
    4. ``Chapter N, <ChapTitle>, <Section> section ...`` (PHAK comma form).
    5. ``In Chapter N: <ChapTitle>, [the] <Section> section`` (AFH-style fallback).

    Prepositional locators ("the first paragraph of the", "the last
    paragraph of the", etc.) are stripped so the returned anchor is the
    section title only, matching how the apply pipeline scores anchors.
    """
    # Quoted-subsection form is the most specific.
    match = re.search(
        r'in\s+the\s+[“"](?P<section>[^“”"]+?)[”"]\s+subsection',
        chunk,
        re.IGNORECASE,
    )
    if match:
        return _normalize_whitespace(match.group("section"))

    # "the <ordinal> paragraph of the <Section> section ..." or
    # "the last paragraph of the <Section> section ..."
    match = re.search(
        r"the\s+(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|last)\s+"
        r"paragraph\s+of\s+the\s+(?P<section>.+?)\s+section\b",
        chunk,
        re.DOTALL | re.IGNORECASE,
    )
    if match:
        return _normalize_whitespace(match.group("section"))

    # PHAK / AFH chapter-prefixed forms: capture between the chapter title
    # and the `section` keyword that immediately precedes either a
    # ``(Page X-Y)`` parenthetical or a `on page X-Y` locator. The
    # section name may itself contain commas ("Aircraft Design,
    # Certification, and Airworthiness") and may wrap one or more lines.
    # The match is greedy up to the action locator.
    match = re.search(
        r"(?:In\s+)?Chapter\s+\d+\s*[,:]\s*[^,\n]+,\s*(?:the\s+)?"
        r"(?P<section>.+?)\s+section\s+(?:on\s+page|\(Page)\s+" + _PAGE_ANCHOR_PATTERN,
        chunk,
        re.DOTALL,
    )
    if match:
        return _normalize_whitespace(match.group("section"))
    return None


def _normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().rstrip(",.")


def _parse_removal(chunk: str, chapter: str) -> list[ErrataPatch]:
    """Single ``replace_paragraph`` patch with REMOVAL_SENTINEL replacement."""
    section_anchor = _extract_section_anchor(chunk)
    page_anchor = _extract_page_anchor(chunk)
    if not section_anchor or not page_anchor:
        return []
    body = _body_after_first_colon(chunk)
    if not body:
        return []
    return [
        ErrataPatch(
            kind=PATCH_KIND_REPLACE_PARAGRAPH,
            chapter=chapter,
            section_anchor=section_anchor,
            target_page=page_anchor,
            new_heading=None,
            original_text=body,
            replacement_text=REMOVAL_SENTINEL,
        )
    ]


def _parse_multi_bullet_block(chunk: str, chapter: str) -> list[ErrataPatch]:
    """Parse a "The following will be revised in Chapter N, ...:" block.

    The block has a single top-level lead-in that names the chapter +
    parent section, followed by a sequence of ``• Due to ...,`` bullet
    items. PHAK MOSAIC bullets reference different printed pages within
    the parent section's range; we extract the page from each bullet
    and the section from the parent lead-in (or, when the bullet itself
    names a quoted subsection, we use that more-specific anchor).

    Continuation bullets (rendered with the same glyph by the PDF
    extractor but functionally nested under a "new bullets will be
    added that say the following:" sentinel) are merged back into their
    parent's body.
    """
    parent_section = _extract_parent_section_from_multi_bullet_header(chunk)
    body = _body_after_first_colon(chunk)
    if not body:
        return []
    bullets = _split_into_top_level_bullets(body)
    bullets = _merge_continuation_bullets(bullets)
    patches: list[ErrataPatch] = []
    for bullet in bullets:
        patch = _parse_bullet_item(bullet, chapter, parent_section_anchor=parent_section)
        if patch is not None:
            patches.extend(patch)
    return patches


def _extract_parent_section_from_multi_bullet_header(chunk: str) -> str | None:
    """For "The following will be revised in Chapter N, <ChapTitle>, <Section> section. (Pages X):"
    return the parent section anchor.
    """
    match = re.search(
        r"The\s+following\s+will\s+be\s+revised\s+in\s+Chapter\s+\d+\s*,\s*[^,]+,\s*" r"(?P<section>.+?)\s+section\b",
        chunk,
        re.DOTALL | re.IGNORECASE,
    )
    if match is None:
        return None
    return _normalize_whitespace(match.group("section"))


def _merge_continuation_bullets(bullets: list[str]) -> list[str]:
    """Merge follow-on bullets back into the bullet they continue.

    A bullet is a "continuation" of its predecessor when the predecessor
    introduces a trailing-content sentinel (``say the following:``,
    ``the following:``) and the successor lacks its own action sentinel
    (i.e. does not start with ``Due to`` and does not contain a page
    anchor). Once merging starts on a parent bullet it continues for as
    long as successors remain "continuation"-shaped, even after their
    text gets folded into the parent (the parent's "the following:"
    contract is sticky for the whole continuation run).
    """
    if not bullets:
        return bullets
    merged: list[str] = []
    in_continuation = False
    for bullet in bullets:
        if in_continuation and _is_continuation_bullet(bullet):
            merged[-1] = merged[-1] + "\n- " + bullet
            continue
        in_continuation = _ends_with_say_the_following(bullet)
        merged.append(bullet)
    return merged


def _ends_with_say_the_following(bullet: str) -> bool:
    tail = bullet.rstrip().rstrip(":").rstrip()
    return bool(
        re.search(
            r"(?:say|adding|adds?)\s+the\s+following$",
            tail,
            re.IGNORECASE,
        )
        or re.search(r"will\s+be\s+added\s+that\s+say\s+the\s+following:?\s*$", bullet, re.IGNORECASE)
    )


def _is_continuation_bullet(bullet: str) -> bool:
    """A bullet without its own action sentinel is a continuation of the prior bullet.

    PHAK MOSAIC continuations are short content snippets ("Maximum
    10,000 feet MSL ..."). We classify by absence of distinctive
    structural markers: no leading "Due to", no page anchor, no quoted
    subsection.
    """
    s = bullet.strip()
    if s.startswith("Due to"):
        return False
    if re.search(r"on\s+page\s+\d+-\d+", s, re.IGNORECASE):
        return False
    if re.search(r"\b(?:bullet|paragraph|subsection|section)\b", s, re.IGNORECASE):
        # Has structural language; treat as its own item.
        return False
    return True


def _parse_due_to_block(
    chunk: str,
    chapter: str,
    chapter_title: str | None,
    page_anchor: str | None,
) -> list[ErrataPatch]:
    """Parse a top-level "Due to ..., in Chapter N, ..., ... revised as follows: <body>"."""
    section_anchor = _extract_section_anchor(chunk) or chapter_title or ""
    if page_anchor is None:
        return []

    # Title-and-paragraph revision is a special composite case.
    title_match = _TITLE_AND_PARAGRAPH_REVISED.search(chunk)
    if title_match is not None:
        body = chunk[title_match.end() :].strip()
        # Two patches: one for the title revision (rendered as a new heading
        # inserted via add_subsection-style note), one for the first paragraph.
        # We model the title revision as a replace_paragraph that swaps the
        # original H1/H2 line for the new title, and the body revision as a
        # second replace_paragraph patch carrying the new prose.
        return [
            ErrataPatch(
                kind=PATCH_KIND_REPLACE_PARAGRAPH,
                chapter=chapter,
                section_anchor=section_anchor,
                target_page=page_anchor,
                new_heading=None,
                original_text=None,
                replacement_text=f'## {title_match.group("new_title").strip()}',
            ),
            ErrataPatch(
                kind=PATCH_KIND_REPLACE_PARAGRAPH,
                chapter=chapter,
                section_anchor=section_anchor,
                target_page=page_anchor,
                new_heading=None,
                original_text=None,
                replacement_text=_clean_body(body),
            ),
        ]

    # Most-specific actions first: bullet-of-list revision, then ordinal
    # paragraph revision. Whole-section replace is least specific and is
    # tried last, since the section pattern can otherwise greedily span
    # the locator phrase ("the first paragraph of the X section ...").
    bullet_of_list_match = _BULLET_OF_LIST_REVISED.search(chunk)
    if bullet_of_list_match is not None:
        body = chunk[bullet_of_list_match.end() :].strip()
        return [
            ErrataPatch(
                kind=PATCH_KIND_REPLACE_PARAGRAPH,
                chapter=chapter,
                section_anchor=section_anchor,
                target_page=page_anchor,
                new_heading=None,
                original_text=None,
                replacement_text=_clean_body(body),
            )
        ]

    ordinal_match = _ORDINAL_PARAGRAPH_REVISED.search(chunk)
    if ordinal_match is not None:
        body = chunk[ordinal_match.end() :].strip()
        return [
            ErrataPatch(
                kind=PATCH_KIND_REPLACE_PARAGRAPH,
                chapter=chapter,
                section_anchor=section_anchor,
                target_page=page_anchor,
                new_heading=None,
                original_text=None,
                replacement_text=_clean_body(body),
            )
        ]

    section_match = _SECTION_REVISED.search(chunk)
    if section_match is not None:
        body = chunk[section_match.end() :].strip()
        section = _extract_section_anchor(chunk) or chapter_title or ""
        return [
            ErrataPatch(
                kind=PATCH_KIND_REPLACE_PARAGRAPH,
                chapter=chapter,
                section_anchor=section,
                target_page=section_match.group("anchor"),
                new_heading=None,
                original_text=None,
                replacement_text=_clean_body(body),
            )
        ]
    return []


def _parse_in_chapter_block(
    chunk: str,
    chapter: str,
    chapter_title: str | None,
    page_anchor: str | None,
) -> list[ErrataPatch]:
    """Parse a top-level "In Chapter N, ..." instruction (PHAK or AFH style)."""
    section_anchor = _extract_section_anchor(chunk) or chapter_title or ""

    list_match = _LIST_REORDERED.search(chunk)
    if list_match is not None and page_anchor is not None:
        body = chunk[list_match.end() :].strip()
        return [
            ErrataPatch(
                kind=PATCH_KIND_REPLACE_PARAGRAPH,
                chapter=chapter,
                section_anchor=section_anchor,
                target_page=page_anchor,
                new_heading=None,
                original_text=None,
                replacement_text=_clean_body(body),
            )
        ]

    bullet_of_list_match = _BULLET_OF_LIST_REVISED.search(chunk)
    if bullet_of_list_match is not None and page_anchor is not None:
        body = chunk[bullet_of_list_match.end() :].strip()
        return [
            ErrataPatch(
                kind=PATCH_KIND_REPLACE_PARAGRAPH,
                chapter=chapter,
                section_anchor=section_anchor,
                target_page=page_anchor,
                new_heading=None,
                original_text=None,
                replacement_text=_clean_body(body),
            )
        ]

    ordinal_match = _ORDINAL_PARAGRAPH_REVISED.search(chunk)
    if ordinal_match is not None and page_anchor is not None:
        body = chunk[ordinal_match.end() :].strip()
        return [
            ErrataPatch(
                kind=PATCH_KIND_REPLACE_PARAGRAPH,
                chapter=chapter,
                section_anchor=section_anchor,
                target_page=page_anchor,
                new_heading=None,
                original_text=None,
                replacement_text=_clean_body(body),
            )
        ]

    section_match = _SECTION_REVISED.search(chunk)
    if section_match is not None:
        body = chunk[section_match.end() :].strip()
        return [
            ErrataPatch(
                kind=PATCH_KIND_REPLACE_PARAGRAPH,
                chapter=chapter,
                section_anchor=section_anchor,
                target_page=section_match.group("anchor"),
                new_heading=None,
                original_text=None,
                replacement_text=_clean_body(body),
            )
        ]
    return []


def _split_into_top_level_bullets(body: str) -> list[str]:
    """Split the body on top-level ``• `` glyphs.

    The PDF preserves the bullet glyph at the start of each top-level
    item. PHAK MOSAIC nests sub-bullets without a glyph (continuation
    indent), so a strict "top-level glyph at line start" split does the
    right thing.
    """
    parts = re.split(r"(?m)^\s*•\s+", body)
    # First chunk before any bullet is preamble; drop it if blank.
    return [p.strip() for p in parts[1:] if p.strip()]


def _parse_bullet_item(
    bullet: str,
    chapter: str,
    *,
    parent_section_anchor: str | None = None,
) -> list[ErrataPatch] | None:
    """Each bullet item lands one or two patches against the section/page it
    references. PHAK MOSAIC bullets reference different printed pages within
    the same parent section; we extract the page anchor from each item and
    fall back to ``parent_section_anchor`` when the bullet itself only
    names a structural locator like "in the first set of bullets".
    """
    page_anchor = _extract_page_anchor(bullet)
    bullet_section = _extract_section_anchor(bullet)
    section_anchor: str | None
    if bullet_section is not None:
        section_anchor = bullet_section
    elif parent_section_anchor is not None:
        # When the bullet only names a structural locator ("the first set
        # of bullets on page X-Y"), the parent block's anchor is the
        # right starting point. PHAK MOSAIC's parent anchors are often
        # colon-delimited ("Pilot Certifications: Sport Pilot"); the
        # specific half ("Sport Pilot") rarely names a real
        # ``handbook_section`` row, while the broad half
        # ("Pilot Certifications") matches the chapter's parent section
        # file. Strip to the broad half so the apply pipeline resolves.
        section_anchor = parent_section_anchor.rsplit(":", 1)[0].strip()
    else:
        section_anchor = None
    if not page_anchor or not section_anchor:
        return None

    out: list[ErrataPatch] = []

    # "the bullet that states, 'X' will change to state, 'Y'"
    for match in _BULLET_STATE_CHANGE.finditer(bullet):
        out.append(
            ErrataPatch(
                kind=PATCH_KIND_REPLACE_PARAGRAPH,
                chapter=chapter,
                section_anchor=section_anchor,
                target_page=page_anchor,
                new_heading=None,
                original_text=match.group("original").strip(),
                replacement_text=match.group("replacement").strip(),
            )
        )

    # "a new bullet will be added that states, 'X'"
    for match in _NEW_BULLET_ADDED.finditer(bullet):
        out.append(
            ErrataPatch(
                kind=PATCH_KIND_APPEND_PARAGRAPH,
                chapter=chapter,
                section_anchor=section_anchor,
                target_page=page_anchor,
                new_heading=None,
                original_text=None,
                replacement_text=f'- {match.group("replacement").strip()}',
            )
        )

    # "the last bullet will change to state, 'X'" (only emit if no
    # explicit-state-change patch was emitted from this bullet, so we
    # do not double-record an edit that the explicit form already names).
    if not out:
        for match in _BULLET_ORDINAL_CHANGE.finditer(bullet):
            out.append(
                ErrataPatch(
                    kind=PATCH_KIND_REPLACE_PARAGRAPH,
                    chapter=chapter,
                    section_anchor=section_anchor,
                    target_page=page_anchor,
                    new_heading=None,
                    original_text=None,
                    replacement_text=match.group("replacement").strip(),
                )
            )

    text_appended_match = _BULLET_TEXT_APPENDED.search(bullet)
    if text_appended_match is not None:
        body = bullet[text_appended_match.end() :].strip()
        if body:
            out.append(
                ErrataPatch(
                    kind=PATCH_KIND_APPEND_PARAGRAPH,
                    chapter=chapter,
                    section_anchor=section_anchor,
                    target_page=page_anchor,
                    new_heading=None,
                    original_text=None,
                    replacement_text=_clean_body(body),
                )
            )

    new_bullets_match = _NEW_BULLETS_ADDED.search(bullet)
    if new_bullets_match is not None:
        body = bullet[new_bullets_match.end() :].strip()
        if body:
            out.append(
                ErrataPatch(
                    kind=PATCH_KIND_APPEND_PARAGRAPH,
                    chapter=chapter,
                    section_anchor=section_anchor,
                    target_page=page_anchor,
                    new_heading=None,
                    original_text=None,
                    replacement_text=_clean_body(body),
                )
            )

    paragraph_after_match = _PARAGRAPH_AFTER_LIST.search(bullet)
    if paragraph_after_match is not None:
        body = bullet[paragraph_after_match.end() :].strip()
        if body:
            out.append(
                ErrataPatch(
                    kind=PATCH_KIND_REPLACE_PARAGRAPH,
                    chapter=chapter,
                    section_anchor=section_anchor,
                    target_page=page_anchor,
                    new_heading=None,
                    original_text=None,
                    replacement_text=_clean_body(body),
                )
            )

    # "the X paragraph on page Y-Z will be revised as follows: <body>"
    ordinal_paragraph_match = _ORDINAL_PARAGRAPH_REVISED.search(bullet)
    if ordinal_paragraph_match is not None and not out:
        body = bullet[ordinal_paragraph_match.end() :].strip()
        if body:
            out.append(
                ErrataPatch(
                    kind=PATCH_KIND_REPLACE_PARAGRAPH,
                    chapter=chapter,
                    section_anchor=section_anchor,
                    target_page=page_anchor,
                    new_heading=None,
                    original_text=None,
                    replacement_text=_clean_body(body),
                )
            )

    # `add_subsection` is intentionally supported by the archetype but not
    # exercised by PHAK MOSAIC. The pattern would match
    # "the following subsection will be added ..." -- mirror the
    # additive-paragraph parser so a future bullet-edits addendum can
    # use the same archetype without a third parser file.
    add_subsection_match = re.search(
        r"the\s+following\s+subsection\s+will\s+be\s+added\s+to\s+"
        r"(?:the\s+)?(?P<section>[^\n]+?)\s+section\s+on\s+page\s+(?P<anchor>" + _PAGE_ANCHOR_PATTERN + r")\s*:\s*",
        bullet,
        re.DOTALL | re.IGNORECASE,
    )
    if add_subsection_match is not None:
        tail = bullet[add_subsection_match.end() :].strip()
        heading, content = _split_heading_from_body(tail)
        if heading and content:
            out.append(
                ErrataPatch(
                    kind=PATCH_KIND_ADD_SUBSECTION,
                    chapter=chapter,
                    section_anchor=_normalize_whitespace(add_subsection_match.group("section")),
                    target_page=add_subsection_match.group("anchor"),
                    new_heading=heading,
                    original_text=None,
                    replacement_text=content,
                )
            )

    return out or None


def _body_after_first_colon(chunk: str) -> str:
    """Return everything after the first lead-in colon, trimmed.

    Top-level removal/revision instructions terminate their lead-in line
    with a colon. The body that follows is the new content, the bulleted
    list, or the paragraph being struck.
    """
    # The first colon often appears mid-lead-in (e.g. "Pilot Certifications:
    # Sport Pilot section."). Pin on a colon that ends a line or is followed
    # by whitespace + the body content. We accept any colon followed by a
    # newline or by two-or-more whitespace chars.
    match = re.search(r":\s*(?:\n|\s{2,})", chunk)
    if match is None:
        return ""
    return _clean_body(chunk[match.end() :])


def _clean_body(body: str) -> str:
    """Strip trailing whitespace and collapse runs of blank lines."""
    body = body.replace("’", "'")
    body = re.sub(r"\s+\n", "\n", body)
    body = re.sub(r"\n{3,}", "\n\n", body)
    return body.strip()


def _split_heading_from_body(body: str) -> tuple[str, str]:
    """Split the first non-empty line as the new heading; rest is content."""
    lines = body.splitlines()
    heading = ""
    content_start = 0
    for idx, line in enumerate(lines):
        if line.strip():
            heading = line.strip()
            content_start = idx + 1
            break
    content = "\n".join(lines[content_start:]).strip()
    return heading, content
