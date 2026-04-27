"""Unit tests for the page-label walk-back fallback in sections.py.

We mock the PyMuPDF document so the tests stay deterministic and don't need
a real PDF on disk. Coverage:

- Direct read returns the FAA-style header verbatim.
- Walk-back recovers a header from a prior PDF page when the target page
  has no parseable header, and emits a warning naming both pages.
- After exhausting `walk_back`, the resolver falls back to
  `pdf_page - page_offset` and emits a warning so the failure is visible.
- An explicit `chapter_overrides[ord].faa_page_end` short-circuits all
  three above paths and emits no warning.
- Front-matter pages (pdf_page <= page_offset) return None without warning.
"""

from __future__ import annotations

from dataclasses import dataclass

from ingest.sections import _read_header_at, _resolve_page_label


@dataclass
class _StubPage:
    text: str

    def get_text(self, kind: str) -> str:
        assert kind == "text"
        return self.text


@dataclass
class _StubDoc:
    pages: list[_StubPage]

    @property
    def page_count(self) -> int:
        return len(self.pages)

    def load_page(self, idx: int) -> _StubPage:
        return self.pages[idx]


def _doc_with_headers(headers: list[str | None]) -> _StubDoc:
    """Build a stub document where each page's first line is the FAA header,
    or no FAA header at all when the entry is None."""
    pages = []
    for h in headers:
        if h is None:
            pages.append(_StubPage(text="(no page header here)\nbody body body\n"))
        else:
            pages.append(_StubPage(text=f"{h}\nChapter Title Goes Here\n"))
    return _StubDoc(pages=pages)


def test_read_header_at_picks_up_dotted_page_anchor() -> None:
    doc = _doc_with_headers(["12-7"])
    assert _read_header_at(doc, 1) == "12-7"


def test_read_header_at_returns_none_when_absent() -> None:
    doc = _doc_with_headers([None])
    assert _read_header_at(doc, 1) is None


def test_resolve_page_label_direct_read_no_warning() -> None:
    doc = _doc_with_headers(["12-7"])
    warnings: list[str] = []
    label = _resolve_page_label(
        doc=doc,
        pdf_page=1,
        page_offset=0,
        walk_back=5,
        override_value=None,
        node_code="12",
        end_label="end",
        warnings=warnings,
    )
    assert label == "12-7"
    assert warnings == []


def test_resolve_page_label_walk_back_recovers_prior_header() -> None:
    """Chapter 17's last PDF page has no header; walking back finds 17-100."""
    # Three pages: page 1 -> 17-99, page 2 -> 17-100, page 3 -> no header.
    doc = _doc_with_headers(["17-99", "17-100", None])
    warnings: list[str] = []
    label = _resolve_page_label(
        doc=doc,
        pdf_page=3,
        page_offset=0,
        walk_back=5,
        override_value=None,
        node_code="17",
        end_label="end",
        warnings=warnings,
    )
    assert label == "17-100"
    assert len(warnings) == 1
    assert "node 17" in warnings[0]
    assert "PDF p3" in warnings[0]
    assert "17-100" in warnings[0]
    assert "walk-back 1" in warnings[0]


def test_resolve_page_label_walk_back_exhausted_falls_back_with_warning() -> None:
    """No header within the walk-back window -> offset-derived fallback + warning."""
    doc = _doc_with_headers([None, None, None, None, None, None])
    warnings: list[str] = []
    label = _resolve_page_label(
        doc=doc,
        pdf_page=6,
        page_offset=2,
        walk_back=3,
        override_value=None,
        node_code="17",
        end_label="end",
        warnings=warnings,
    )
    # 6 - 2 = 4 (offset-derived raw page).
    assert label == "4"
    assert len(warnings) == 1
    assert "no parseable FAA header within 3 pages" in warnings[0]
    assert "chapter_overrides" in warnings[0]


def test_resolve_page_label_override_short_circuits_everything() -> None:
    """An explicit override wins regardless of what the PDF says."""
    doc = _doc_with_headers([None, None, None])
    warnings: list[str] = []
    label = _resolve_page_label(
        doc=doc,
        pdf_page=3,
        page_offset=0,
        walk_back=5,
        override_value="17-100",
        node_code="17",
        end_label="end",
        warnings=warnings,
    )
    assert label == "17-100"
    assert warnings == []


def test_resolve_page_label_front_matter_returns_none() -> None:
    """Pages inside the front-matter region (<= page_offset) return None."""
    doc = _doc_with_headers([None, None, None])
    warnings: list[str] = []
    label = _resolve_page_label(
        doc=doc,
        pdf_page=2,
        page_offset=5,
        walk_back=0,
        override_value=None,
        node_code="0",
        end_label="start",
        warnings=warnings,
    )
    assert label is None


def test_resolve_page_label_walk_back_zero_disables_recovery() -> None:
    """walk_back=0 falls straight through to the offset-derived fallback."""
    doc = _doc_with_headers(["17-99", None])
    warnings: list[str] = []
    label = _resolve_page_label(
        doc=doc,
        pdf_page=2,
        page_offset=0,
        walk_back=0,
        override_value=None,
        node_code="17",
        end_label="end",
        warnings=warnings,
    )
    assert label == "2"
    assert len(warnings) == 1
