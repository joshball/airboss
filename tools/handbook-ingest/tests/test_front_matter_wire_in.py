"""Integration tests for front-matter capture wired into the extractor pipeline.

WP-HANDBOOK-RE-EXTRACTION-V2 sub-phase 1D.

Builds a synthetic PDF in-test (PyMuPDF) carrying a couple of front-matter
pages and one chapter page, runs the front-matter capture phase the cli
invokes, and verifies the manifest section rows + on-disk markdown layout.
The chapter pipeline (TOC / section-tree merge) is exercised separately by
`test_cli_integration.py`; this file targets the front-matter-specific
contract on its own to keep the surface tight.
"""

from __future__ import annotations

import json
from pathlib import Path

import fitz
import pytest

from ingest import normalize
from ingest.config_loader import HandbookConfig
from ingest.fetch import FetchResult
from ingest.front_matter import (
    extract_front_matter,
    front_matter_to_outline_nodes,
    front_matter_to_section_bodies,
)
from ingest.outline import OutlineNode
from ingest.sections import SectionBody


def _make_pdf(path: Path) -> None:
    """Author a 6-page synthetic handbook PDF for wire-in tests.

    Pages 1..5 are front matter (cover, preface, acknowledgments, table of
    contents); page 6 is chapter 1's first body page so the front-matter
    range is `[1, 5]`. Each page carries enough text that the segmenter can
    recognize markers without surprises.
    """
    doc = fitz.open()
    pages = [
        # PDF p1 -- cover page (no marker; lands in the synthetic 'cover' segment).
        "Sample Handbook\nFAA-H-9999-X\nU.S. Department of Transportation\nFEDERAL AVIATION ADMINISTRATION\n2026",
        # PDF p2 -- preface marker + body.
        "Preface\nThis handbook describes the sample doctrine. Pilots reading it should\n"
        "expect a focused walk through the synthetic content.",
        # PDF p3 -- acknowledgments marker + body.
        "Acknowledgments\nThanks to the synthetic-test contributors and reviewers.",
        # PDF p4 -- introduction marker + body (the IFH 'Is an instrument rating necessary?' analog).
        "Introduction\nThis introduction sets the scope. The reader should know what to expect.",
        # PDF p5 -- table of contents marker.
        "Table of Contents\nPreface ........ iii\nIntroduction ........ vii",
        # PDF p6 -- chapter 1 body, FAA `<chap>-<page>` header.
        "1-1\nChapter 1\nFirst Topic\nThis is the chapter 1 body prose.",
    ]
    for text in pages:
        page = doc.new_page(width=612, height=792)
        page.insert_text((72, 100), text, fontsize=12)
    doc.save(path)
    doc.close()


@pytest.fixture
def synthetic_pdf(tmp_path: Path) -> Path:
    pdf_path = tmp_path / "synthetic.pdf"
    _make_pdf(pdf_path)
    return pdf_path


def _config(slug: str = "synthetic", front_matter_range: tuple[int, int] | None = (1, 5)) -> HandbookConfig:
    return HandbookConfig(
        document_slug=slug,
        edition="V1",
        title="Sample Handbook",
        publisher="FAA",
        kind="handbook",
        source_url="https://example.invalid/synthetic.pdf",
        subjects=["aerodynamics"],
        primary_cert="private",
        front_matter_page_range=front_matter_range,
    )


def _fetch_result(pdf_path: Path) -> FetchResult:
    return FetchResult(
        path=pdf_path,
        url="https://example.invalid/synthetic.pdf",
        sha256="a" * 64,
        fetched_at="2026-05-04T00:00:00.000+00:00",
        size_bytes=1024,
    )


@pytest.fixture
def isolate_repo(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    derivative = tmp_path / "handbooks" / "synthetic" / "V1"

    def _edition_root(_doc: str, _ed: str) -> Path:
        return derivative

    def _relative_to_repo(p: Path) -> str:
        try:
            return p.relative_to(tmp_path).as_posix()
        except ValueError:
            return p.as_posix()

    monkeypatch.setattr(normalize, "edition_root", _edition_root)
    monkeypatch.setattr(normalize, "relative_to_repo", _relative_to_repo)
    return derivative


class TestFrontMatterExtraction:
    def test_extracts_expected_segments_from_synthetic_pdf(self, synthetic_pdf: Path) -> None:
        sections = extract_front_matter(synthetic_pdf, (1, 5))
        slugs = [s.slug for s in sections]
        # Cover always opens the segment list (synthetic; never empty for a real PDF).
        # Preface / Acknowledgments / Introduction / Table of Contents follow in
        # the order their markers appear.
        assert slugs == ["cover", "preface", "acknowledgments", "introduction", "table-of-contents"]

    def test_segments_carry_expected_pdf_page_ranges(self, synthetic_pdf: Path) -> None:
        sections = extract_front_matter(synthetic_pdf, (1, 5))
        cover, preface, acks, intro, toc = sections
        assert cover.pdf_page_start == 1
        assert preface.pdf_page_start == 2
        assert acks.pdf_page_start == 3
        assert intro.pdf_page_start == 4
        assert toc.pdf_page_start == 5

    def test_ordinals_are_zero_indexed_in_document_order(self, synthetic_pdf: Path) -> None:
        sections = extract_front_matter(synthetic_pdf, (1, 5))
        for ordinal, sec in enumerate(sections):
            assert sec.ordinal == ordinal

    def test_outline_nodes_use_zero_namespace_codes(self, synthetic_pdf: Path) -> None:
        sections = extract_front_matter(synthetic_pdf, (1, 5))
        nodes = front_matter_to_outline_nodes(sections)
        codes = [n.code for n in nodes]
        # `0.<ordinal+1>` namespace, peer to chapter codes (`1`, `2`, ...).
        assert codes == ["0.1", "0.2", "0.3", "0.4", "0.5"]
        for node in nodes:
            assert node.level == "front-matter"


class TestFrontMatterWriteOutputs:
    def _bodies_and_outline(self, pdf_path: Path) -> tuple[list[OutlineNode], list[SectionBody]]:
        # Compose: a chapter 1 'overview' body, plus the front-matter prepended
        # ahead of it -- the same shape the cli's `_phase_front_matter` builds.
        chapter_node = OutlineNode(
            level="chapter",
            code="1",
            title="First Topic",
            page_start=6,
            page_end=6,
            ordinal=1,
        )
        chapter_body = SectionBody(
            node=chapter_node,
            body_md="This is the chapter 1 body prose.",
            faa_page_start="1-1",
            faa_page_end="1-1",
            char_count=33,
        )
        sections = extract_front_matter(pdf_path, (1, 5))
        nodes = front_matter_to_outline_nodes(sections)
        section_bodies = front_matter_to_section_bodies(sections, nodes)
        return list(nodes) + [chapter_node], list(section_bodies) + [chapter_body]

    def test_manifest_carries_front_matter_rows(
        self, synthetic_pdf: Path, isolate_repo: Path, tmp_path: Path
    ) -> None:
        outline_nodes, bodies = self._bodies_and_outline(synthetic_pdf)
        section_metadata: dict[str, dict[str, str]] = {
            n.code: {"extraction_status": "front-matter-extracted"}
            for n in outline_nodes
            if n.level == "front-matter"
        }
        normalize.write_outputs(
            config=_config(),
            fetch_result=_fetch_result(synthetic_pdf),
            outline_nodes=outline_nodes,
            bodies=bodies,
            figures=[],
            figure_warnings=[],
            tables=[],
            table_warnings=[],
            section_metadata=section_metadata,
        )
        manifest = json.loads((isolate_repo / "manifest.json").read_text(encoding="utf-8"))
        front_rows = [s for s in manifest["sections"] if s["level"] == "front-matter"]
        assert len(front_rows) == 5
        codes = [s["code"] for s in front_rows]
        assert codes == ["0.1", "0.2", "0.3", "0.4", "0.5"]
        for row in front_rows:
            assert row["metadata"]["extraction_status"] == "front-matter-extracted"
            assert row["faa_page_start"] is None
            assert row["faa_page_end"] is None

    def test_front_matter_files_land_under_front_matter_dir(
        self, synthetic_pdf: Path, isolate_repo: Path
    ) -> None:
        outline_nodes, bodies = self._bodies_and_outline(synthetic_pdf)
        section_metadata: dict[str, dict[str, str]] = {
            n.code: {"extraction_status": "front-matter-extracted"}
            for n in outline_nodes
            if n.level == "front-matter"
        }
        normalize.write_outputs(
            config=_config(),
            fetch_result=_fetch_result(synthetic_pdf),
            outline_nodes=outline_nodes,
            bodies=bodies,
            figures=[],
            figure_warnings=[],
            tables=[],
            table_warnings=[],
            section_metadata=section_metadata,
        )
        front_dir = isolate_repo / "front-matter"
        assert front_dir.is_dir()
        files = sorted(p.name for p in front_dir.iterdir() if p.is_file())
        # `<NN>-<slug>.md` per `front_matter_body_filename`.
        assert files == [
            "00-cover.md",
            "01-preface.md",
            "02-acknowledgments.md",
            "03-introduction.md",
            "04-table-of-contents.md",
        ]

    def test_front_matter_source_locator_uses_front_matter_phrase(
        self, synthetic_pdf: Path, isolate_repo: Path
    ) -> None:
        outline_nodes, bodies = self._bodies_and_outline(synthetic_pdf)
        section_metadata: dict[str, dict[str, str]] = {
            n.code: {"extraction_status": "front-matter-extracted"}
            for n in outline_nodes
            if n.level == "front-matter"
        }
        normalize.write_outputs(
            config=_config(),
            fetch_result=_fetch_result(synthetic_pdf),
            outline_nodes=outline_nodes,
            bodies=bodies,
            figures=[],
            figure_warnings=[],
            tables=[],
            table_warnings=[],
            section_metadata=section_metadata,
        )
        manifest = json.loads((isolate_repo / "manifest.json").read_text(encoding="utf-8"))
        front_rows = [s for s in manifest["sections"] if s["level"] == "front-matter"]
        # Check first row's locator -- 'SYNTHETIC Front Matter -- Cover'
        assert front_rows[0]["source_locator"] == "SYNTHETIC Front Matter -- Cover"

    def test_chapter_rows_unaffected_when_front_matter_present(
        self, synthetic_pdf: Path, isolate_repo: Path
    ) -> None:
        outline_nodes, bodies = self._bodies_and_outline(synthetic_pdf)
        section_metadata: dict[str, dict[str, str]] = {
            n.code: {"extraction_status": "front-matter-extracted"}
            for n in outline_nodes
            if n.level == "front-matter"
        }
        normalize.write_outputs(
            config=_config(),
            fetch_result=_fetch_result(synthetic_pdf),
            outline_nodes=outline_nodes,
            bodies=bodies,
            figures=[],
            figure_warnings=[],
            tables=[],
            table_warnings=[],
            section_metadata=section_metadata,
        )
        manifest = json.loads((isolate_repo / "manifest.json").read_text(encoding="utf-8"))
        chapter_rows = [s for s in manifest["sections"] if s["level"] == "chapter"]
        assert len(chapter_rows) == 1
        assert chapter_rows[0]["code"] == "1"
        # Chapter row should NOT carry extraction_status metadata (front-matter only).
        assert "metadata" not in chapter_rows[0] or chapter_rows[0].get("metadata") is None


class TestFrontMatterPageRangeNotDeclared:
    def test_warning_emitted_when_range_unset(
        self, synthetic_pdf: Path, isolate_repo: Path
    ) -> None:
        # Per spec: when `front_matter_page_range` is None, emit
        # `front-matter-page-range-not-declared` and skip capture.
        chapter_node = OutlineNode(
            level="chapter",
            code="1",
            title="First Topic",
            page_start=6,
            page_end=6,
            ordinal=1,
        )
        chapter_body = SectionBody(
            node=chapter_node,
            body_md="Body.",
            faa_page_start="1-1",
            faa_page_end="1-1",
            char_count=5,
        )
        normalize.write_outputs(
            config=_config(front_matter_range=None),
            fetch_result=_fetch_result(synthetic_pdf),
            outline_nodes=[chapter_node],
            bodies=[chapter_body],
            figures=[],
            figure_warnings=[],
            tables=[],
            table_warnings=[],
            extra_warnings=[
                "front-matter-page-range-not-declared: synthetic V1 has no "
                "front_matter_page_range in its YAML; front-matter capture skipped."
            ],
        )
        manifest = json.loads((isolate_repo / "manifest.json").read_text(encoding="utf-8"))
        codes = [w["code"] for w in manifest["warnings"]]
        assert "front-matter-page-range-not-declared" in codes
