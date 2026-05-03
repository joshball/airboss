"""Unit tests for the toc-file-sidecar parser (`sections_via_toc_file.py`).

Covers the IFH FAA-H-8083-15B quirks the parser is designed for:

- Plain `Chapter <N>` sentinels followed by chapter title + page anchor.
- The IFH `Chapter <N>, Section <I|II>` quirk (chapters 6 and 7) producing
  two top-level sections per chapter.
- Two-line title wraps (the hand-extracted TOC sometimes splits long titles
  across two lines).
- Appendix / Glossary / Index entries are skipped (they're not body
  sections).
- Page-anchor extraction handles two-digit pages.
"""

from __future__ import annotations

from pathlib import Path
from textwrap import dedent

from ingest.outline import OutlineError
from ingest.sections_via_toc_file import STRATEGY_TOC_FILE, parse_toc_file


def _write_toc(tmp_path: Path, body: str) -> Path:
    p = tmp_path / "ifh-toc.md"
    p.write_text(dedent(body).lstrip(), encoding="utf-8")
    return p


def test_single_chapter_with_flat_l1_sections(tmp_path: Path) -> None:
    """A `Chapter N` sentinel + chapter title + dotted-leader entries."""
    toc = _write_toc(
        tmp_path,
        """
        https://example/ignored
        Preface....................................................................iii

        Chapter 1
        The National Airspace System...........................1-1
        Introduction....................................................................1-1
        Airspace Classification...............................................1-2
        Special Use Airspace..................................................1-2
        """,
    )
    result = parse_toc_file(toc)
    # One chapter.
    assert len(result.chapters) == 1
    chapter = result.chapters[0]
    assert chapter.code == "1"
    assert chapter.title == "The National Airspace System"
    # Three L1 sections: Introduction, Airspace Classification, Special Use Airspace.
    assert len(result.sections) == 3
    titles = [s.title for s in result.sections]
    assert titles == ["Introduction", "Airspace Classification", "Special Use Airspace"]
    # All level=1, page anchors preserved.
    assert all(s.level == 1 for s in result.sections)
    assert result.sections[0].page_anchor == "1-1"
    assert result.sections[1].page_anchor == "1-2"
    # All carry the toc-file provenance.
    assert all(s.provenance == STRATEGY_TOC_FILE for s in result.sections)


def test_chapter_six_section_i_and_ii_quirk(tmp_path: Path) -> None:
    """IFH chapters 6/7 split into Section I (analog) and Section II (electronic)."""
    toc = _write_toc(
        tmp_path,
        """
        Chapter 6, Section I
        Airplane Attitude Instrument Flying Using Analog Instrumentation......6-1
        Introduction....................................................................6-1
        Learning Methods..........................................................6-2
        Chapter 6, Section II
        Airplane Attitude Instrument Flying Using an Electronic Flight Display..6-15
        Introduction..................................................................6-15
        Learning Methods........................................................6-16
        Control and Performance Method ............................6-18
        """,
    )
    result = parse_toc_file(toc)
    # Chapter 6 with two L1 sections (Section I and Section II) plus their L2
    # subsections nested beneath each.
    assert len(result.chapters) == 1
    chapter = result.chapters[0]
    assert chapter.code == "6"
    # Section nodes:
    # L1 - "Section I -- Airplane Attitude Instrument Flying Using Analog ..."
    # L2 - "Introduction"   (under Section I)
    # L2 - "Learning Methods"  (under Section I)
    # L1 - "Section II -- Airplane Attitude Instrument Flying Using an Electronic ..."
    # L2 - "Introduction"   (under Section II)
    # L2 - "Learning Methods"  (under Section II)
    # L2 - "Control and Performance Method"  (under Section II)
    by_level_title = [(s.level, s.title) for s in result.sections]
    assert by_level_title == [
        (1, "Section I -- Airplane Attitude Instrument Flying Using Analog Instrumentation"),
        (2, "Introduction"),
        (2, "Learning Methods"),
        (1, "Section II -- Airplane Attitude Instrument Flying Using an Electronic Flight Display"),
        (2, "Introduction"),
        (2, "Learning Methods"),
        (2, "Control and Performance Method"),
    ]
    # Page anchors thread through.
    assert result.sections[0].page_anchor == "6-1"
    assert result.sections[3].page_anchor == "6-15"


def test_appendix_glossary_index_entries_skipped(tmp_path: Path) -> None:
    """Appendix A/B, Glossary, Index pages start with letters; they aren't body sections."""
    toc = _write_toc(
        tmp_path,
        """
        Chapter 1
        Title One...........................................................1-1
        Introduction......................................................1-1
        Appendix A..........................................................A-1
        Clearance Shorthand
        Appendix B..........................................................B-1
        Glossary ..............................................................G-1
        Index ......................................................................I-1
        """,
    )
    result = parse_toc_file(toc)
    # Only the Chapter 1 section emits; the appendix-leading entries are
    # dropped because their page anchor doesn't start with a digit.
    assert [s.title for s in result.sections] == ["Introduction"]


def test_two_line_title_wrap_is_coalesced(tmp_path: Path) -> None:
    """Long titles split across two lines coalesce into one entry."""
    toc = _write_toc(
        tmp_path,
        """
        Chapter 1
        Chapter Title.....................................................1-1
        Weather Information and Communication
        Features.................................................................1-10
        New Technologies .......................................................1-10
        """,
    )
    result = parse_toc_file(toc)
    assert [s.title for s in result.sections] == [
        "Weather Information and Communication Features",
        "New Technologies",
    ]
    assert result.sections[0].page_anchor == "1-10"


def test_two_digit_page_anchors(tmp_path: Path) -> None:
    """`1-30` and `11-23` round-trip without truncation."""
    toc = _write_toc(
        tmp_path,
        """
        Chapter 1
        Chapter Title.....................................................1-1
        Far Section.............................................................1-30
        Chapter 11
        Eleventh Title......................................................11-1
        Deep Section..............................................................11-23
        """,
    )
    result = parse_toc_file(toc)
    assert len(result.chapters) == 2
    sections_by_chap = {(s.chapter_ordinal, s.page_anchor) for s in result.sections}
    assert (1, "1-30") in sections_by_chap
    assert (11, "11-23") in sections_by_chap


def test_no_chapter_sentinel_raises(tmp_path: Path) -> None:
    """A TOC file with no recognisable chapter sentinel hard-fails."""
    toc = _write_toc(
        tmp_path,
        """
        Preface....................................................................iii
        Acknowledgments..................................................v
        Introduction...........................................................vii
        """,
    )
    raised = False
    try:
        parse_toc_file(toc)
    except OutlineError as exc:
        raised = True
        assert "Chapter" in str(exc)
    assert raised, "expected OutlineError when no chapter sentinels are present"


def test_chapter_page_starts_threaded_through(tmp_path: Path) -> None:
    """When chapter_page_starts is supplied, chapter outline carries real PDF pages."""
    toc = _write_toc(
        tmp_path,
        """
        Chapter 1
        Title One...........................................................1-1
        Section A...........................................................1-2
        Chapter 2
        Title Two...........................................................2-1
        """,
    )
    result = parse_toc_file(toc, chapter_page_starts={1: 20, 2: 35})
    chap_pages = {int(c.code): c.page_start for c in result.chapters}
    assert chap_pages == {1: 20, 2: 35}
