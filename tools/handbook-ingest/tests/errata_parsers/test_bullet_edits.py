"""Unit tests for the bullet-edits errata parser (PHAK MOSAIC layout).

The cached PHAK MOSAIC addendum PDF is the canonical fixture. Synthetic
strings exercise edge cases (unknown layout, line-wrapped page anchors,
mismatched chapter references, malformed bullet rows).
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from ingest.errata_parsers import (
    BulletEditsParser,
    UnknownErrataLayoutError,
    get_parser,
)
from ingest.errata_parsers.bullet_edits import (
    REMOVAL_SENTINEL,
    _extract_page_anchor,
    _extract_section_anchor,
    _merge_continuation_bullets,
    _split_into_instruction_chunks,
    _stitch_wrapped_page_anchors,
    _strip_running_chrome,
)
from ingest.handbooks.base import (
    PATCH_KIND_APPEND_PARAGRAPH,
    PATCH_KIND_REPLACE_PARAGRAPH,
    ErrataConfig,
    ErrataPatch,
)

PHAK_MOSAIC_PATH = Path(
    os.path.expanduser("~/Documents/airboss-handbook-cache/handbooks/phak/FAA-H-8083-25C/_errata/mosaic.pdf")
)

PHAK_ERRATA = ErrataConfig(
    id="mosaic",
    source_url="https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/PHAK_Addendum_(MOSAIC).pdf",
    published_at="2025-10-20",
    parser="bullet-edits",
)


@pytest.mark.skipif(not PHAK_MOSAIC_PATH.is_file(), reason="PHAK MOSAIC PDF not cached")
def test_parse_phak_mosaic_yields_expected_patch_count() -> None:
    """The cached PHAK MOSAIC PDF should produce 20+ patches (one per discrete edit)."""
    parser = BulletEditsParser()
    patches = parser.parse(PHAK_MOSAIC_PATH, PHAK_ERRATA)
    assert len(patches) >= 20, f"expected >=20 patches; got {len(patches)}"
    for p in patches:
        assert isinstance(p, ErrataPatch)
        assert p.chapter.isdigit() and len(p.chapter) == 2
        chap_str, page_str = p.target_page.split("-", 1)
        assert chap_str.isdigit() and page_str.isdigit()
        assert p.section_anchor.strip()
        assert p.replacement_text.strip()


@pytest.mark.skipif(not PHAK_MOSAIC_PATH.is_file(), reason="PHAK MOSAIC PDF not cached")
def test_phak_mosaic_includes_lsa_removal() -> None:
    """The LSA-definition removal renders as a ``replace_paragraph`` with the
    REMOVAL_SENTINEL replacement; the original_text retains the FAA-published
    paragraph verbatim so the diff UI can show what was struck.
    """
    parser = BulletEditsParser()
    patches = parser.parse(PHAK_MOSAIC_PATH, PHAK_ERRATA)
    removals = [p for p in patches if p.replacement_text == REMOVAL_SENTINEL and p.original_text]
    assert removals, "expected at least one removal patch with REMOVAL_SENTINEL"
    assert any("Light-sport aircraft (LSA)" in (p.original_text or "") for p in removals)


@pytest.mark.skipif(not PHAK_MOSAIC_PATH.is_file(), reason="PHAK MOSAIC PDF not cached")
def test_phak_mosaic_includes_bullet_state_change() -> None:
    """The Rotorcraft (gyroplane only) -> Rotorcraft Gyroplane edit lands as a
    replace_paragraph patch carrying both original and replacement bullet text.
    """
    parser = BulletEditsParser()
    patches = parser.parse(PHAK_MOSAIC_PATH, PHAK_ERRATA)
    rotorcraft = [
        p
        for p in patches
        if p.kind == PATCH_KIND_REPLACE_PARAGRAPH and p.original_text == "Rotorcraft (gyroplane only)"
    ]
    assert rotorcraft, "expected the gyroplane bullet replacement patch"
    assert rotorcraft[0].replacement_text == "Rotorcraft Gyroplane"


@pytest.mark.skipif(not PHAK_MOSAIC_PATH.is_file(), reason="PHAK MOSAIC PDF not cached")
def test_phak_mosaic_includes_new_bullet_added() -> None:
    """A "new bullet will be added that states X" maps to append_paragraph."""
    parser = BulletEditsParser()
    patches = parser.parse(PHAK_MOSAIC_PATH, PHAK_ERRATA)
    appends = [p for p in patches if p.kind == PATCH_KIND_APPEND_PARAGRAPH]
    assert appends, f"expected append_paragraph patches; got kinds {[p.kind for p in patches]}"
    # The Rotorcraft Helicopter line is one of the new-bullet appends.
    assert any(
        "Rotorcraft Helicopter" in p.replacement_text for p in appends
    ), f"expected the Rotorcraft Helicopter append; saw {[p.replacement_text[:60] for p in appends]}"


@pytest.mark.skipif(not PHAK_MOSAIC_PATH.is_file(), reason="PHAK MOSAIC PDF not cached")
def test_phak_mosaic_handles_comma_delimited_anchor() -> None:
    """The "Pilot Certifications: Sport Pilot" parent anchor is broadened
    to "Pilot Certifications" for bullets that do not name a quoted
    subsection (PHAK does not have a "Sport Pilot" section file -- the
    Sport Pilot content lives under the parent ``Pilot Certifications``
    file, with sibling subsections like ``Privileges``/``Limitations``
    handling the more specific bullet content).
    """
    parser = BulletEditsParser()
    patches = parser.parse(PHAK_MOSAIC_PATH, PHAK_ERRATA)
    pilot_cert = [p for p in patches if p.section_anchor == "Pilot Certifications"]
    privileges = [p for p in patches if p.section_anchor == "Privileges"]
    limitations = [p for p in patches if p.section_anchor == "Limitations"]
    assert (
        len(pilot_cert) >= 2
    ), f"expected >=2 patches inheriting the broadened Pilot Certifications anchor; got {len(pilot_cert)}"
    assert privileges, "expected at least one bullet with the quoted Privileges subsection anchor"
    assert limitations, "expected at least one bullet with the quoted Limitations subsection anchor"


def test_get_parser_returns_bullet_edits() -> None:
    parser = get_parser("bullet-edits")
    assert isinstance(parser, BulletEditsParser)


def test_unknown_layout_raises_when_pdf_lacks_markers(tmp_path: Path) -> None:
    """A PDF with no top-level instruction sentinels raises UnknownErrataLayoutError."""
    import fitz

    pdf_path = tmp_path / "garbage.pdf"
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), "This document has no errata instructions whatsoever.")
    doc.save(pdf_path)
    doc.close()

    parser = BulletEditsParser()
    bogus = ErrataConfig(
        id="bogus",
        source_url="https://x.test/x.pdf",
        published_at="2026-01-01",
        parser="bullet-edits",
    )
    with pytest.raises(UnknownErrataLayoutError, match="no top-level instruction sentinels"):
        parser.parse(pdf_path, bogus)


def test_strip_running_chrome_removes_repeated_headers() -> None:
    raw = (
        "FAA-H-8083-25C, Pilot’s Handbook of Aeronautical Knowledge – Addendum\n"
        "October 20, 2025\n"
        "Page 3 of 5\n"
        "Flight Standards Service\n"
        "Real instruction text on this line.\n"
    )
    cleaned = _strip_running_chrome(raw)
    assert "Real instruction text" in cleaned
    assert "October 20, 2025" not in cleaned
    assert "Page 3 of 5" not in cleaned
    assert "Flight Standards Service" not in cleaned


def test_stitch_wrapped_page_anchors_collapses_line_break_inside_anchor() -> None:
    raw = "on page 1-\n20 the title will be revised"
    out = _stitch_wrapped_page_anchors(raw)
    assert "page 1-20" in out
    assert "page 1-\n20" not in out


def test_extract_page_anchor_finds_parenthetical_form() -> None:
    chunk = "Aircraft Classifications section (Page 1-15) due to the removal"
    assert _extract_page_anchor(chunk) == "1-15"


def test_extract_page_anchor_finds_on_page_form() -> None:
    chunk = "in the second set of bullets on page 1-16 the last bullet"
    assert _extract_page_anchor(chunk) == "1-16"


def test_extract_section_anchor_phak_comma_form() -> None:
    chunk = (
        "Due to the requirements of 14 CFR part 61, in Chapter 17, Aeromedical "
        "Factors, Obtaining a Medical Certificate section on page 17-2, the first "
        "paragraph will be revised as follows:"
    )
    assert _extract_section_anchor(chunk) == "Obtaining a Medical Certificate"


def test_extract_section_anchor_quoted_subsection_form() -> None:
    chunk = "in the “Privileges” subsection on page 1-16, the first bullet will"
    assert _extract_section_anchor(chunk) == "Privileges"


def test_extract_section_anchor_paragraph_of_section_form() -> None:
    chunk = (
        "In Chapter 9, Flight Manuals and Other Documents, the last paragraph of the "
        "Aircraft Documents: Airworthiness Certificate section on page 9-8 will be "
        "revised as follows:"
    )
    assert _extract_section_anchor(chunk) == ("Aircraft Documents: Airworthiness Certificate")


def test_split_into_instruction_chunks_drops_preamble() -> None:
    text = (
        "Due to the Modernization of Special Airworthiness Certification (MOSAIC) Rule, "
        "which was published on July 18, 2025...\n"
        "Note: Light-sport aircraft category, as it pertains to aircraft certification, has not changed.\n"
        "The following will be removed from Chapter 1, Introduction to Flying, "
        "Aircraft Classifications and Ultralight Vehicles section (Page 1-15) due to "
        "the removal of the definition of light-sport aircraft from 14 CFR part 1, "
        "section 1.1:\nLight-sport aircraft (LSA)...\n"
        "In Chapter 3: Aircraft Construction, the Aircraft Design, Certification, and "
        "Airworthiness section on page 3-2, will be revised as follows:\n"
        "The FAA certifies three types...\n"
    )
    chunks = _split_into_instruction_chunks(text)
    # Two real instructions; preamble + Note are dropped because they
    # don't start with a sentinel (the first chunk does start with "Due
    # to" though, so it's kept; we filter at the parser level not the
    # split level).
    starts = [c.lstrip().split("\n", 1)[0][:50] for c in chunks]
    assert any(s.startswith("The following will be removed") for s in starts)
    assert any(s.startswith("In Chapter 3") for s in starts)


def test_merge_continuation_bullets_attaches_followers() -> None:
    """A "new bullets will be added that say the following:" lead bullet
    should absorb the bullets that immediately follow it (which the PDF
    extractor renders at the same glyph level)."""
    bullets = [
        'Due to ..., in the "Limitations" subsection on page 1-17, new bullets will be added that say the following:',
        "Maximum 10,000 feet MSL or 2,000 feet AGL, whichever is higher",
        "For more information regarding sport pilot privileges, refer to 14 CFR part 61",
        "Due to ..., the next directive starts here on page 1-17",
    ]
    merged = _merge_continuation_bullets(bullets)
    assert len(merged) == 2
    assert "Maximum 10,000 feet MSL" in merged[0]
    assert "For more information" in merged[0]
    assert merged[1].startswith("Due to")


def test_malformed_bullet_returns_no_patches(tmp_path: Path) -> None:
    """A bullet without a page anchor or section reference is dropped silently
    (the parser does not crash, it just skips the unrecognized item).
    """
    import fitz

    pdf_path = tmp_path / "partial.pdf"
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text(
        (50, 50),
        "The following will be revised in Chapter 1, Some Title, Some Section section. (Page 1-1):\n"
        "• This bullet has no page anchor and no recognizable action sentinel.\n",
    )
    doc.save(pdf_path)
    doc.close()

    parser = BulletEditsParser()
    bogus = ErrataConfig(
        id="partial",
        source_url="https://x.test/partial.pdf",
        published_at="2026-01-01",
        parser="bullet-edits",
    )
    with pytest.raises(UnknownErrataLayoutError, match="classified zero of them"):
        parser.parse(pdf_path, bogus)
