"""Unit tests for the compare script.

We feed two hand-built section trees and assert the agreement bucket,
diff lists, and rendered markdown shape. No PDF, no API.
"""

from __future__ import annotations

from ingest.config_loader import HandbookConfig
from ingest.section_tree import SectionTreeNode
from ingest.sections_compare import compare_strategies


def _toc(chap: int, level: int, title: str) -> SectionTreeNode:
    return SectionTreeNode(
        chapter_ordinal=chap, level=level, title=title, provenance="toc", confidence=1.0
    )


def _llm(chap: int, level: int, title: str) -> SectionTreeNode:
    return SectionTreeNode(
        chapter_ordinal=chap, level=level, title=title, provenance="llm", confidence=1.0
    )


def test_full_agreement_buckets_correctly() -> None:
    toc = [_toc(12, 1, "Atmosphere"), _toc(12, 1, "Coriolis Force")]
    llm = [_llm(12, 1, "Atmosphere"), _llm(12, 1, "Coriolis Force")]
    result = compare_strategies(toc, llm, {12: "Weather Theory"})
    assert len(result.chapters) == 1
    ch = result.chapters[0]
    assert ch.agreement == "full"
    assert ch.toc_only == []
    assert ch.llm_only == []
    assert len(ch.matches) == 2


def test_partial_agreement_when_llm_misses_one() -> None:
    toc = [_toc(12, 1, "Atmosphere"), _toc(12, 1, "Density Altitude")]
    llm = [_llm(12, 1, "Atmosphere")]
    result = compare_strategies(toc, llm, {12: "Weather Theory"})
    ch = result.chapters[0]
    assert ch.agreement in {"partial", "low"}
    assert any(n.title == "Density Altitude" for n in ch.toc_only)
    assert ch.llm_only == []


def test_level_disagreement_recorded() -> None:
    toc = [_toc(12, 1, "Lift")]
    llm = [_llm(12, 2, "Lift")]
    result = compare_strategies(toc, llm, {12: "Weather Theory"})
    ch = result.chapters[0]
    assert len(ch.level_disagreements) == 1
    toc_n, llm_n = ch.level_disagreements[0]
    assert toc_n.level == 1 and llm_n.level == 2


def test_markdown_renders_per_chapter_detail() -> None:
    toc = [_toc(12, 1, "Atmosphere"), _toc(12, 1, "Density Altitude")]
    llm = [_llm(12, 1, "Atmosphere")]
    result = compare_strategies(toc, llm, {12: "Weather Theory"})
    config = HandbookConfig(
        document_slug="phak",
        edition="FAA-H-8083-25C",
        title="PHAK",
        publisher="FAA",
        kind="handbook",
        source_url="https://example.invalid/phak.pdf",
    )
    md = result.to_markdown(config)
    assert "# PHAK FAA-H-8083-25C section-tree comparison" in md
    assert "Chapter 12 -- Weather Theory" in md
    assert "Density Altitude" in md
    assert "**TOC strategy** (2 entries):" in md
    assert "**LLM strategy** (1 entries):" in md
