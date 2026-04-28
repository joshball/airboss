"""Unit tests for the additive-paragraph errata parser.

The cached AFH MOSAIC addendum PDF is the canonical fixture. PHAK
MOSAIC is verified during integration once cached. Synthetic strings
exercise edge cases (unknown layout, mismatched chapter anchors).
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from ingest.errata_parsers import (
    AdditiveParagraphParser,
    UnknownErrataLayoutError,
    get_parser,
)
from ingest.handbooks.base import (
    PATCH_KIND_ADD_SUBSECTION,
    PATCH_KIND_APPEND_PARAGRAPH,
    PATCH_KIND_REPLACE_PARAGRAPH,
    ErrataConfig,
    ErrataPatch,
)

AFH_MOSAIC_PATH = Path(
    os.path.expanduser(
        '~/Documents/airboss-handbook-cache/handbooks/afh/FAA-H-8083-3C/AFH_Addendum_MOSAIC.pdf'
    )
)

PHAK_MOSAIC_PATH = Path(
    os.path.expanduser(
        '~/Documents/airboss-handbook-cache/handbooks/phak/FAA-H-8083-25C/PHAK_Addendum_MOSAIC.pdf'
    )
)

AFH_ERRATA = ErrataConfig(
    id='mosaic',
    source_url='https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/AFH_Addendum_(MOSAIC).pdf',
    published_at='2025-10-20',
    parser='additive-paragraph',
)

PHAK_ERRATA = ErrataConfig(
    id='mosaic',
    source_url='https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/PHAK_Addendum_(MOSAIC).pdf',
    published_at='2025-10-20',
    parser='additive-paragraph',
)


@pytest.mark.skipif(not AFH_MOSAIC_PATH.is_file(), reason="AFH MOSAIC PDF not cached")
def test_parse_afh_mosaic_yields_patches() -> None:
    parser = AdditiveParagraphParser()
    patches = parser.parse(AFH_MOSAIC_PATH, AFH_ERRATA)
    assert len(patches) >= 4, f"expected >=4 patches; got {len(patches)}"
    for p in patches:
        assert isinstance(p, ErrataPatch)
        assert p.kind in {
            PATCH_KIND_ADD_SUBSECTION,
            PATCH_KIND_APPEND_PARAGRAPH,
            PATCH_KIND_REPLACE_PARAGRAPH,
        }
        assert p.chapter.isdigit() and len(p.chapter) == 2
        # target_page in printed FAA <chapter>-<page> form.
        assert '-' in p.target_page
        chap_str, page_str = p.target_page.split('-', 1)
        assert chap_str.isdigit() and page_str.isdigit()
        assert p.section_anchor.strip()
        assert p.replacement_text.strip()


@pytest.mark.skipif(not AFH_MOSAIC_PATH.is_file(), reason="AFH MOSAIC PDF not cached")
def test_afh_mosaic_includes_known_subsection() -> None:
    """The AFH MOSAIC adds 'Light-sport Category Aircraft Maintenance' to Chapter 2."""
    parser = AdditiveParagraphParser()
    patches = parser.parse(AFH_MOSAIC_PATH, AFH_ERRATA)
    add_subsections = [p for p in patches if p.kind == PATCH_KIND_ADD_SUBSECTION]
    assert add_subsections, "expected at least one add_subsection patch"
    headings = {p.new_heading for p in add_subsections if p.new_heading}
    assert 'Light-sport Category Aircraft Maintenance' in headings


@pytest.mark.skipif(not AFH_MOSAIC_PATH.is_file(), reason="AFH MOSAIC PDF not cached")
def test_afh_mosaic_includes_replace_paragraph() -> None:
    """The Role of the FAA edit is a replace_paragraph patch in Chapter 1."""
    parser = AdditiveParagraphParser()
    patches = parser.parse(AFH_MOSAIC_PATH, AFH_ERRATA)
    replacements = [p for p in patches if p.kind == PATCH_KIND_REPLACE_PARAGRAPH]
    assert replacements, "expected at least one replace_paragraph patch"
    role_patches = [p for p in replacements if p.section_anchor.startswith('Role of the FAA')]
    if not role_patches:
        sections = [p.section_anchor for p in replacements]
        pytest.fail(f"expected a 'Role of the FAA' replacement; got sections {sections}")


@pytest.mark.skipif(not AFH_MOSAIC_PATH.is_file(), reason="AFH MOSAIC PDF not cached")
def test_afh_mosaic_includes_append_paragraph() -> None:
    """Pre-Takeoff and Crosswind Takeoff patches are append_paragraph kind."""
    parser = AdditiveParagraphParser()
    patches = parser.parse(AFH_MOSAIC_PATH, AFH_ERRATA)
    appends = [p for p in patches if p.kind == PATCH_KIND_APPEND_PARAGRAPH]
    assert appends, f"expected append_paragraph patches; got {[p.kind for p in patches]}"


@pytest.mark.skipif(not PHAK_MOSAIC_PATH.is_file(), reason="PHAK MOSAIC PDF not cached")
def test_parse_phak_mosaic_yields_patches() -> None:
    parser = AdditiveParagraphParser()
    patches = parser.parse(PHAK_MOSAIC_PATH, PHAK_ERRATA)
    assert len(patches) >= 1, f"expected >=1 PHAK patches; got {len(patches)}"


def test_get_parser_returns_additive_paragraph() -> None:
    parser = get_parser('additive-paragraph')
    assert isinstance(parser, AdditiveParagraphParser)


def test_unknown_parser_name_raises_clear_error() -> None:
    with pytest.raises(ValueError, match='No parser registered'):
        get_parser('summary-of-changes')


def test_unknown_layout_raises_when_pdf_lacks_markers(tmp_path: Path) -> None:
    """A PDF with no 'In Chapter <N>:' markers raises UnknownErrataLayoutError."""
    import fitz

    pdf_path = tmp_path / 'garbage.pdf'
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), 'This document has no errata instructions whatsoever.')
    doc.save(pdf_path)
    doc.close()

    parser = AdditiveParagraphParser()
    bogus = ErrataConfig(
        id='bogus',
        source_url='https://x.test/x.pdf',
        published_at='2026-01-01',
        parser='additive-paragraph',
    )
    with pytest.raises(UnknownErrataLayoutError, match='no .* instruction blocks'):
        parser.parse(pdf_path, bogus)
