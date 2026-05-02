"""Tests for the chapter-aware fields on HandbookConfig.

Per the chapter-source-ingestion WP, every handbook YAML grows:
  - whole_doc (optional but required when chapter_pdfs is set)
  - chapter_pdfs (optional; absent for Class C handbooks)
  - excluded_assets (always present, default empty list)

Bogus-fixture tests use `tmp_path` + `monkeypatch.setattr(config_loader_module,
'config_dir', ...)` so malformed YAML never lands in the production canonical
config dir at `scripts/sources/config/handbooks/`. An interrupted run, a
`pytest -x --pdb` quit, or a `pytest -n auto` race must not poison the real
downloader.
"""

from __future__ import annotations

import textwrap
from pathlib import Path

import pytest

from ingest import config_loader as config_loader_module
from ingest.config_loader import (
    AncillarySpec,
    ChapterPdfsConfig,
    ConfigError,
    HandbookConfig,
    WholeDocConfig,
    load_config,
    resolve_config_path,
)


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


def _write_bogus(tmp_path: Path, slug: str, body: str) -> None:
    """Write a bogus YAML into an isolated config dir under tmp_path.

    Callers must monkeypatch `config_loader_module.config_dir` to return
    `tmp_path` before invoking `load_config(slug)`. Using `tmp_path` (which
    pytest cleans automatically) keeps malformed YAML out of the production
    `scripts/sources/config/handbooks/` directory regardless of how the test
    exits (interrupt, debugger quit, parallel race).
    """
    (tmp_path / f"{slug}.yaml").write_text(body, encoding="utf-8")


def test_chapter_pdfs_rejects_mixed_direct_and_index(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setattr(config_loader_module, "config_dir", lambda: tmp_path)
    _write_bogus(
        tmp_path,
        "bogus",
        textwrap.dedent(
            """
            document_slug: bogus
            edition: T1
            title: Bogus
            kind: handbook
            whole_doc:
              url: https://example.test/bogus.pdf
              filename: bogus.pdf
            source_url: https://example.test/bogus.pdf
            subjects:
              - aerodynamics
            chapter_pdfs:
              direct_pattern: https://example.test/{N}.pdf
              index_url: https://example.test/idx
              chapter_page_pattern: chapter-{N}-
              chapter_count: 3
            """
        ).lstrip(),
    )
    with pytest.raises(ConfigError, match="cannot mix"):
        load_config("bogus")


def test_chapter_pdfs_rejects_missing_pattern(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setattr(config_loader_module, "config_dir", lambda: tmp_path)
    _write_bogus(
        tmp_path,
        "bogus2",
        textwrap.dedent(
            """
            document_slug: bogus2
            edition: T1
            title: Bogus
            kind: handbook
            whole_doc:
              url: https://example.test/bogus.pdf
              filename: bogus.pdf
            source_url: https://example.test/bogus.pdf
            subjects:
              - aerodynamics
            chapter_pdfs:
              chapter_count: 3
            """
        ).lstrip(),
    )
    with pytest.raises(ConfigError, match="direct_pattern or index_url"):
        load_config("bogus2")


def test_excluded_assets_must_be_list(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setattr(config_loader_module, "config_dir", lambda: tmp_path)
    _write_bogus(
        tmp_path,
        "bogus3",
        textwrap.dedent(
            """
            document_slug: bogus3
            edition: T1
            title: Bogus
            kind: handbook
            source_url: https://example.test/bogus.pdf
            subjects:
              - aerodynamics
            excluded_assets: not-a-list
            """
        ).lstrip(),
    )
    with pytest.raises(ConfigError, match="excluded_assets must be a list"):
        load_config("bogus3")
