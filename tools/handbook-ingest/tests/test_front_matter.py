"""Unit tests for the front-matter segmenter (WP-HANDBOOK-RE-EXTRACTION-V2 1C).

`extract_front_matter` is exercised via integration tests against synthetic
PDFs (skipped here -- no fitz fixture). The pure segmentation logic in
`_segment_front_matter` is the surface tested here: given a list of
(page_num, text) tuples, walk the lines and cut a new segment at each
recognized marker.
"""

from __future__ import annotations

from ingest.front_matter import (
    FrontMatterSection,
    _front_matter_code,
    _segment_front_matter,
    front_matter_body_filename,
    front_matter_body_relpath_under_edition,
    front_matter_chapter_slug,
    hash_text_sha256,
)


def make_pages(*page_texts: str) -> list[tuple[int, str]]:
    return [(idx + 1, text) for idx, text in enumerate(page_texts)]


class TestSegmentFrontMatter:
    def test_single_cover_page_when_no_markers(self) -> None:
        pages = make_pages("Title page\n\nFAA-H-8083-15B\nU.S. Department of Transportation")
        out = _segment_front_matter(pages)
        assert len(out) == 1
        assert out[0].slug == "cover"
        assert out[0].title == "Cover"
        assert out[0].ordinal == 0
        assert out[0].pdf_page_start == 1
        assert out[0].pdf_page_end == 1
        assert "Title page" in out[0].body_md

    def test_marker_opens_new_segment(self) -> None:
        pages = make_pages(
            "Title page\nFAA-H-8083-15B",
            "Preface\nThis handbook describes\nthe NAS in detail.",
        )
        out = _segment_front_matter(pages)
        assert [s.slug for s in out] == ["cover", "preface"]
        assert out[0].pdf_page_end == 2  # cover sticks until first marker
        assert out[1].pdf_page_start == 2
        assert "describes" in out[1].body_md

    def test_multiple_markers_in_order(self) -> None:
        pages = make_pages(
            "Cover\nFAA-H-8083-15B",
            "Preface\nFirst preface line.",
            "Acknowledgments\nThanks to contributors.",
            "Introduction\nIs an instrument rating necessary?",
        )
        out = _segment_front_matter(pages)
        slugs = [s.slug for s in out]
        assert slugs == ["cover", "preface", "acknowledgments", "introduction"]
        for ordinal, sec in enumerate(out):
            assert sec.ordinal == ordinal

    def test_marker_recognition_case_insensitive(self) -> None:
        pages = make_pages("PREFACE\nUpper case", "preface\nlower case")
        out = _segment_front_matter(pages)
        # First "PREFACE" opens segment; second "preface" doesn't
        # (segments[-1] is already 'preface' so the dedupe in the loop
        # body keeps us in the same segment -- hits the `marker_slug !=
        # segments[-1]['slug']` guard).
        assert [s.slug for s in out] == ["cover", "preface"]
        assert "Upper case" in out[1].body_md
        assert "lower case" in out[1].body_md

    def test_marker_must_be_standalone_line(self) -> None:
        # A line "the introduction explains..." must NOT match `^introduction$`.
        pages = make_pages("the introduction explains the NAS\nbody text continues")
        out = _segment_front_matter(pages)
        assert len(out) == 1
        assert out[0].slug == "cover"

    def test_acknowledgments_variant_spelling(self) -> None:
        pages = make_pages("Cover", "Acknowledgements\nBritish spelling.")
        out = _segment_front_matter(pages)
        assert [s.slug for s in out] == ["cover", "acknowledgments"]

    def test_page_numbers_stripped_from_body(self) -> None:
        pages = make_pages(
            "Cover\nFAA-H-8083-15B",
            "Preface\nReal text\niii\n3\nMore real text",
        )
        out = _segment_front_matter(pages)
        body = out[1].body_md
        # Roman + arabic page-number-only lines stripped.
        assert "iii" not in body.split("\n")
        assert "3" not in body.split("\n")
        assert "Real text" in body
        assert "More real text" in body

    def test_faa_banner_stripped(self) -> None:
        pages = make_pages("Preface\nReal text\nInstrument Flying Handbook FAA-H-8083-15B 1-1\nMore real text")
        out = _segment_front_matter(pages)
        # `Preface` is on the first line, so it opens the second segment;
        # everything after the marker lands in `preface`.
        preface_body = out[1].body_md
        # The FAA banner line gets stripped.
        assert "FAA-H-8083" not in preface_body
        assert "Real text" in preface_body and "More real text" in preface_body

    def test_empty_pages_produces_empty_list(self) -> None:
        out = _segment_front_matter([])
        assert out == []


class TestCodeAndPathHelpers:
    def test_front_matter_code_uses_zero_namespace(self) -> None:
        # Ordinal 0 (cover) -> "0.1"; ordinal 1 (preface) -> "0.2".
        assert _front_matter_code(0) == "0.1"
        assert _front_matter_code(1) == "0.2"
        assert _front_matter_code(4) == "0.5"

    def test_chapter_slug_uses_section_slug(self) -> None:
        sec = FrontMatterSection(
            slug="introduction",
            title="Introduction",
            ordinal=3,
            body_md="hi",
            pdf_page_start=10,
            pdf_page_end=12,
        )
        assert front_matter_chapter_slug(sec) == "introduction"

    def test_body_filename_zero_pads_ordinal(self) -> None:
        sec = FrontMatterSection(
            slug="preface",
            title="Preface",
            ordinal=2,
            body_md="",
            pdf_page_start=1,
            pdf_page_end=1,
        )
        assert front_matter_body_filename(sec) == "02-preface.md"

    def test_relpath_uses_front_matter_dir(self) -> None:
        sec = FrontMatterSection(
            slug="introduction",
            title="Introduction",
            ordinal=3,
            body_md="",
            pdf_page_start=1,
            pdf_page_end=1,
        )
        assert front_matter_body_relpath_under_edition(sec) == "front-matter/03-introduction.md"


class TestHashTextSha256:
    def test_deterministic_hash(self) -> None:
        h1 = hash_text_sha256("hello world")
        h2 = hash_text_sha256("hello world")
        assert h1 == h2
        # Different content -> different hash.
        assert hash_text_sha256("hello") != h1

    def test_hash_is_64_hex_chars(self) -> None:
        h = hash_text_sha256("anything")
        assert len(h) == 64
        assert all(c in "0123456789abcdef" for c in h)
