"""Unit tests for `outline._apply_chapter_filter`.

The bookmark_chapter_filter is the WP-RMH knob that lets a handbook drop
front-matter / back-matter L1 entries (Preface, Glossary, Index, ...)
before chapter ordinals are derived. This test pins the filter behavior
without needing an actual PDF -- we synthesize a TOC tuple list that
mirrors what PyMuPDF returns from `get_toc()`.
"""

from __future__ import annotations

from ingest.outline import _apply_chapter_filter


def test_filter_keeps_chapter_l1_and_descendants() -> None:
    toc = [
        (1, "Preface", 3),
        (1, "Introduction", 4),
        (1, "Chapter 1: Risk", 10),
        (2, "Introduction", 10),
        (2, "PAVE", 11),
        (3, "Pilot", 11),
        (1, "Chapter 2: Personal Minimums", 13),
        (2, "Steps", 13),
        (1, "Glossary", 73),
        (1, "Index", 77),
    ]
    out = _apply_chapter_filter(toc, r"^(Chapter \d+|Appendix [A-Z])\b")
    titles = [(d, t) for d, t, _ in out]
    assert titles == [
        (1, "Chapter 1: Risk"),
        (2, "Introduction"),
        (2, "PAVE"),
        (3, "Pilot"),
        (1, "Chapter 2: Personal Minimums"),
        (2, "Steps"),
    ]


def test_filter_strips_descendants_of_unmatched_l1() -> None:
    toc = [
        (1, "Preface", 3),
        (2, "Subsection of Preface", 3),  # must be dropped
        (1, "Chapter 1: Risk", 10),
        (2, "Body", 10),
    ]
    out = _apply_chapter_filter(toc, r"^Chapter")
    assert (2, "Subsection of Preface", 3) not in out
    assert (2, "Body", 10) in out


def test_filter_keeps_appendices() -> None:
    toc = [
        (1, "Chapter 8: ADM", 54),
        (2, "Body", 54),
        (1, "Appendix Introduction", 58),  # don't keep
        (2, "Scope", 58),  # dropped because parent rejected
        (1, "Appendix A: Training", 59),
        (2, "Body", 59),
    ]
    out = _apply_chapter_filter(toc, r"^(Chapter \d+|Appendix [A-Z])\b")
    titles = [t for _, t, _ in out]
    assert "Appendix Introduction" not in titles
    assert "Scope" not in titles
    assert "Appendix A: Training" in titles


def test_filter_handles_leading_whitespace_in_titles() -> None:
    toc = [
        (1, "  Chapter 1: Risk", 10),  # PyMuPDF sometimes leaks leading space
        (2, "Body", 10),
    ]
    out = _apply_chapter_filter(toc, r"^Chapter")
    titles = [t for _, t, _ in out]
    assert "  Chapter 1: Risk" in titles
    assert "Body" in titles


def test_filter_returns_empty_when_no_match() -> None:
    toc = [
        (1, "Preface", 3),
        (1, "Glossary", 73),
    ]
    out = _apply_chapter_filter(toc, r"^Chapter")
    assert out == []
