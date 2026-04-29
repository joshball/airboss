"""Tests for the chapter-aware fields on HandbookConfig.

Per the chapter-source-ingestion WP, every handbook YAML grows:
  - whole_doc (optional but required when chapter_pdfs is set)
  - chapter_pdfs (optional; absent for Class C handbooks)
  - excluded_assets (always present, default empty list)
"""

from __future__ import annotations

import textwrap
from pathlib import Path

import pytest

from ingest.config_loader import (
    AncillarySpec,
    ChapterPdfsConfig,
    ConfigError,
    HandbookConfig,
    WholeDocConfig,
    load_config,
    resolve_config_path,
)
from ingest.paths import config_dir


def test_phak_loads_chapter_pdfs_two_hop() -> None:
    cfg = load_config("phak")
    assert cfg.whole_doc is not None
    assert cfg.whole_doc.url.endswith("faa-h-8083-25c.pdf")
    assert cfg.whole_doc.filename == "FAA-H-8083-25C.pdf"
    assert cfg.chapter_pdfs is not None
    # Two-hop scrape: index_url + chapter_page_pattern, no direct_pattern.
    assert cfg.chapter_pdfs.index_url is not None
    assert cfg.chapter_pdfs.chapter_page_pattern == "chapter-{N}-"
    assert cfg.chapter_pdfs.direct_pattern is None
    assert cfg.chapter_pdfs.chapter_count == 17
    assert cfg.chapter_pdfs.ancillary == []
    assert cfg.excluded_assets == []


def test_afh_loads_chapter_pdfs_direct_with_ancillaries() -> None:
    cfg = load_config("afh")
    assert cfg.whole_doc is not None
    assert cfg.chapter_pdfs is not None
    assert cfg.chapter_pdfs.direct_pattern is not None
    assert "{NN}_afh_ch{N}.pdf" in cfg.chapter_pdfs.direct_pattern
    assert cfg.chapter_pdfs.chapter_count == 18
    assert cfg.chapter_pdfs.file_ordinal_offset == 1
    assert {a.kind for a in cfg.chapter_pdfs.ancillary} == {"front", "glossary", "index"}


def test_avwx_has_no_chapter_pdfs_class_c() -> None:
    cfg = load_config("avwx")
    assert cfg.whole_doc is not None
    assert cfg.chapter_pdfs is None
    assert cfg.excluded_assets == []


def test_chapter_pdfs_rejects_mixed_direct_and_index(tmp_path: Path) -> None:
    raw = textwrap.dedent(
        """
        document_slug: bogus
        edition: T1
        title: Bogus
        kind: handbook
        whole_doc:
          url: https://example.test/bogus.pdf
          filename: bogus.pdf
        source_url: https://example.test/bogus.pdf
        chapter_pdfs:
          direct_pattern: https://example.test/{N}.pdf
          index_url: https://example.test/idx
          chapter_page_pattern: chapter-{N}-
          chapter_count: 3
        """
    ).lstrip()
    target = config_dir() / "bogus.yaml"
    try:
        target.write_text(raw, encoding="utf-8")
        with pytest.raises(ConfigError, match="cannot mix"):
            load_config("bogus")
    finally:
        if target.exists():
            target.unlink()


def test_chapter_pdfs_rejects_missing_pattern(tmp_path: Path) -> None:
    raw = textwrap.dedent(
        """
        document_slug: bogus2
        edition: T1
        title: Bogus
        kind: handbook
        whole_doc:
          url: https://example.test/bogus.pdf
          filename: bogus.pdf
        source_url: https://example.test/bogus.pdf
        chapter_pdfs:
          chapter_count: 3
        """
    ).lstrip()
    target = config_dir() / "bogus2.yaml"
    try:
        target.write_text(raw, encoding="utf-8")
        with pytest.raises(ConfigError, match="direct_pattern or index_url"):
            load_config("bogus2")
    finally:
        if target.exists():
            target.unlink()


def test_excluded_assets_must_be_list(tmp_path: Path) -> None:
    raw = textwrap.dedent(
        """
        document_slug: bogus3
        edition: T1
        title: Bogus
        kind: handbook
        source_url: https://example.test/bogus.pdf
        excluded_assets: not-a-list
        """
    ).lstrip()
    target = config_dir() / "bogus3.yaml"
    try:
        target.write_text(raw, encoding="utf-8")
        with pytest.raises(ConfigError, match="excluded_assets must be a list"):
            load_config("bogus3")
    finally:
        if target.exists():
            target.unlink()
