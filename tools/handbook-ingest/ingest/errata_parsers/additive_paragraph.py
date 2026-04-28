"""Additive-paragraph errata parser (the MOSAIC layout).

Both the AFH and PHAK MOSAIC addenda (October 2025) use the same
declarative layout: a series of self-contained instructions of the
form

    In Chapter N: <Chapter Title>, the following <subsection|paragraph>
    will be added to the <Section Anchor> section on page <X-Y>:
    <new content>

with two variants:

- Replacement variant: "the <ordinal> paragraph after the <ordinal>
  bulleted list in the <Section Anchor> section on page <X-Y>, will be
  revised as follows: <new content>" (paraphrased; matched by the
  "will be revised as follows:" sentinel).

- Append-to-end variant: "the following paragraph will be added to the
  end of the <Section Anchor> section on page <X-Y>: <new content>".

The parser walks the PDF as a single concatenated string, splits on
"In Chapter " sentinels, and emits one :class:`ErrataPatch` per block.

Layout assumptions (any miss raises :class:`UnknownErrataLayoutError`):

- The header line names a chapter as ``Chapter <N>: <Title>``.
- A page anchor of form ``<chapter>-<page>`` (e.g. ``2-4``) follows the
  word ``page`` somewhere in the lead-in.
- The lead-in ends in a colon (with optional trailing whitespace) on a
  line, after which the body content begins.

The parser tolerates per-page running headers/footers (the MOSAIC PDFs
repeat ``FAA-H-8083-XX, ... – Addendum`` plus a ``Page N of N`` footer
on every page); these are stripped before block parsing.
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


_MONTH_DAY_YEAR = re.compile(
    r'(?:January|February|March|April|May|June|July|August|September|October|November|December)'
    r'\s+\d{1,2},\s+\d{4}'
)

# Block sentinel: "In Chapter <N>: <Title>," at the start of an instruction.
_BLOCK_SPLIT = re.compile(r'(?=In Chapter \d+:)', re.DOTALL)

# Header capture: "In Chapter N: Title," and capture the chapter number.
# The chapter title may itself contain a colon (e.g. "Energy Management:
# Mastering Altitude and Airspeed Control"), so we anchor on the trailing
# comma followed by " the " to terminate the title capture.
_CHAPTER_HEADER = re.compile(
    r'^In Chapter (?P<chapter>\d+):\s*(?P<chapter_title>.+?),\s*the\b',
    re.DOTALL,
)

# Lead-in pattern variants. Each capture group names the verb phrase
# that determines patch kind. The PDF text wraps mid-lead-in (e.g. the
# word "section" lands on the line after the section anchor), so the
# patterns use \s+ everywhere whitespace appears and DOTALL throughout.

# add_subsection: "the following subsection will be added to the <X> section on page Y-Z:"
_ADD_SUBSECTION_LEAD = re.compile(
    r'the\s+following\s+subsection\s+will\s+be\s+added\s+to\s+the\s+'
    r'(?P<section>.+?)\s+section\s+on\s+page\s+(?P<anchor>\d+-\d+)\s*:\s*',
    re.DOTALL | re.IGNORECASE,
)

# append_paragraph: "the following paragraph will be added to [the end of] the <X> section on page Y-Z:"
# The "to the" is required; "the end of" is optional and inserted between
# "to" and the next "the". The section anchor allows commas (FAA names like
# "Preflight Assessment of the Aircraft, Engine, and Propeller") because
# the trailing "section on page X-Y" sentinel pins the anchor end.
_APPEND_PARAGRAPH_LEAD = re.compile(
    r'the\s+following\s+paragraph\s+will\s+be\s+added\s+to\s+'
    r'(?:the\s+end\s+of\s+)?'
    r'the\s+(?P<section>.+?)\s+section\s+on\s+page\s+(?P<anchor>\d+-\d+)\s*:\s*',
    re.DOTALL | re.IGNORECASE,
)

# replace_paragraph: "<the .* paragraph .* in the> <X> section on page Y-Z, will be revised as follows:"
# Captures a flexible lead-in that names a paragraph offset and ends with the
# "will be revised as follows" sentinel.
_REPLACE_PARAGRAPH_LEAD = re.compile(
    r'(?P<paragraph_phrase>the\s+\S+\s+paragraph\b.+?)\s+in\s+the\s+'
    r'(?P<section>.+?)\s+section\s+on\s+page\s+(?P<anchor>\d+-\d+)\s*,\s*'
    r'will\s+be\s+revised\s+as\s+follows\s*:\s*',
    re.DOTALL | re.IGNORECASE,
)


class AdditiveParagraphParser(ErrataParser):
    """Parser for the MOSAIC-shaped additive-paragraph addendum layout."""

    name = 'additive-paragraph'

    def parse(self, pdf_path: Path, errata: ErrataConfig) -> list[ErrataPatch]:
        text = _extract_pdf_text(pdf_path)
        text = _strip_running_chrome(text)
        # Block-split on "In Chapter " sentinels. The first split before
        # the first sentinel is preamble (FAA cover letter / "Note:"
        # prose); we drop it.
        blocks = _BLOCK_SPLIT.split(text)
        instruction_blocks = [b for b in blocks if _CHAPTER_HEADER.match(b)]
        if not instruction_blocks:
            raise UnknownErrataLayoutError(
                f"Additive-paragraph parser found no 'In Chapter <N>:' instruction blocks "
                f"in {pdf_path}. Expected the MOSAIC layout. Markers tried: {_CHAPTER_HEADER.pattern!r}."
            )

        patches: list[ErrataPatch] = []
        for block in instruction_blocks:
            patch = _parse_block(block)
            if patch is not None:
                patches.append(patch)
        if not patches:
            raise UnknownErrataLayoutError(
                f"Additive-paragraph parser recognized {len(instruction_blocks)} 'In Chapter' "
                f"blocks in {pdf_path} but could not classify any. Lead-in patterns may have drifted."
            )
        return patches


def _extract_pdf_text(pdf_path: Path) -> str:
    """Read the PDF as a single string, page-joined with form feeds."""
    # Local import keeps the parser package importable without pymupdf
    # for unit tests that pass already-extracted text.
    import fitz

    doc = fitz.open(pdf_path)
    try:
        return '\f'.join(page.get_text() for page in doc)
    finally:
        doc.close()


def _strip_running_chrome(text: str) -> str:
    """Remove repeating per-page header/footer lines."""
    lines = text.split('\n')
    out: list[str] = []
    for raw in lines:
        line = raw.rstrip()
        stripped = line.strip()
        # Drop common running chrome.
        if stripped.startswith('FAA-H-8083-') and 'Addendum' in stripped:
            continue
        if stripped.startswith('Page ') and ' of ' in stripped:
            continue
        if stripped == 'FAA':
            continue
        if stripped == 'Flight Standards Service':
            continue
        if stripped == 'General Aviation & Commercial Division':
            continue
        if stripped == 'Training & Certification Group':
            continue
        if stripped == 'Testing Standards Section':
            continue
        if stripped.startswith('Flight Standards Service') and 'Training' in stripped:
            continue
        # A bare date line "October 20, 2025" used as a running header.
        if _MONTH_DAY_YEAR.fullmatch(stripped):
            continue
        # Drop bare form-feed survivors.
        if stripped == '\f':
            continue
        out.append(line)
    # Strip stray form feed bytes on their own lines too.
    return '\n'.join(out).replace('\f', '\n')


def _parse_block(block: str) -> ErrataPatch | None:
    """Classify and parse a single instruction block."""
    header = _CHAPTER_HEADER.match(block)
    if header is None:
        return None
    chapter_num = header.group('chapter')

    # Try replace_paragraph first (its sentinel is the most distinctive:
    # "will be revised as follows:"). Then add_subsection. Then
    # append_paragraph (least specific lead-in).
    for kind, pattern, body_extractor in (
        (PATCH_KIND_REPLACE_PARAGRAPH, _REPLACE_PARAGRAPH_LEAD, _extract_replace_body),
        (PATCH_KIND_ADD_SUBSECTION, _ADD_SUBSECTION_LEAD, _extract_add_subsection_body),
        (PATCH_KIND_APPEND_PARAGRAPH, _APPEND_PARAGRAPH_LEAD, _extract_append_body),
    ):
        match = pattern.search(block)
        if match is None:
            continue
        body_start = match.end()
        body = block[body_start:].strip()
        # Normalize section anchor whitespace: PDF text wraps section
        # names mid-phrase ("Preflight\nAssessment of the Aircraft").
        # Collapse to a single line so the apply pipeline can match it
        # against the handbook's section markdown headings.
        section_anchor = re.sub(r'\s+', ' ', match.group('section')).strip()
        anchor = match.group('anchor').strip()
        # Sanity check: anchor's chapter must match the block's chapter.
        anchor_chap = anchor.split('-')[0]
        if anchor_chap != chapter_num:
            # Different chapter detected via lead-in than via header; trust the lead-in.
            chapter_num = anchor_chap
        chapter = chapter_num.zfill(2)
        # Strip the body of any trailing whitespace / blank lines.
        body = re.sub(r'\s+\n', '\n', body).strip()
        if kind == PATCH_KIND_ADD_SUBSECTION:
            heading, content = body_extractor(body)
            if not content.strip():
                return None
            return ErrataPatch(
                kind=kind,
                chapter=chapter,
                section_anchor=section_anchor,
                target_page=anchor,
                new_heading=heading,
                original_text=None,
                replacement_text=content.strip(),
            )
        # append_paragraph and replace_paragraph: body is the new prose.
        new_text = body_extractor(body) if body_extractor is not None else body
        if not new_text.strip():
            return None
        return ErrataPatch(
            kind=kind,
            chapter=chapter,
            section_anchor=section_anchor,
            target_page=anchor,
            new_heading=None,
            # original_text is unknown without the source handbook; the
            # apply pipeline fills it from the section markdown at apply
            # time. The parser leaves it None.
            original_text=None,
            replacement_text=new_text.strip(),
        )
    return None


def _extract_add_subsection_body(body: str) -> tuple[str, str]:
    """Split the first non-empty line as the new subsection heading."""
    lines = body.splitlines()
    heading = ''
    content_start = 0
    for idx, line in enumerate(lines):
        if line.strip():
            heading = line.strip()
            content_start = idx + 1
            break
    content = '\n'.join(lines[content_start:]).strip()
    return heading, content


def _extract_append_body(body: str) -> str:
    """append_paragraph's body is the trailing prose verbatim."""
    return body


def _extract_replace_body(body: str) -> str:
    """replace_paragraph's body is the trailing prose verbatim."""
    return body
