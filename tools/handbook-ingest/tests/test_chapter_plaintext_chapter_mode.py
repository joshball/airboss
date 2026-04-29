"""Tests for chapter-PDF mode of `write_chapter_sidecars` (chapter-source-ingestion WP).

When the handbook YAML carries `chapter_pdfs` AND chapter PDFs exist in the
source cache (under `<cache>/handbooks/<slug>/<edition>/<edition>-ch<NN>.pdf`),
the sidecar text is built from the chapter PDF directly with no truncation
cap. When the chapter PDFs are absent, the function falls back to the
whole-doc + page-range path (covered by `test_chapter_plaintext.py`).
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from ingest import chapter_plaintext as cp
from ingest import paths as paths_module
from ingest.chapter_plaintext import write_chapter_sidecars
from ingest.config_loader import ChapterPdfsConfig, HandbookConfig


def _make_config_with_chapter_pdfs(chapter_count: int = 2) -> HandbookConfig:
    return HandbookConfig(
        document_slug="testbook",
        edition="TEST-EDITION",
        title="Test Book",
        publisher="FAA",
        kind="handbook",
        source_url="https://example.invalid/test.pdf",
        chapter_pdfs=ChapterPdfsConfig(
            chapter_count=chapter_count,
            direct_pattern="https://example.invalid/{NN}_ch{N}.pdf",
        ),
        chapter_text_max_chars=100,  # tiny cap; chapter mode must IGNORE it
    )


def test_chapter_mode_activates_when_pdfs_cached(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("AIRBOSS_HANDBOOK_CACHE", str(tmp_path / "cache"))
    monkeypatch.setattr(paths_module, "repo_root", lambda: tmp_path)
    # Stub the PyMuPDF extractor to avoid needing real PDFs in the test.
    monkeypatch.setattr(
        cp,
        "_extract_pdf_plaintext",
        lambda path: f"Chapter content from {path.name}\n" + ("X" * 5000),
    )
    config = _make_config_with_chapter_pdfs(chapter_count=2)
    cache_dir = tmp_path / "cache" / "handbooks" / config.document_slug / config.edition
    cache_dir.mkdir(parents=True)
    (cache_dir / f"{config.edition}-ch01.pdf").write_bytes(b"PDF1")
    (cache_dir / f"{config.edition}-ch02.pdf").write_bytes(b"PDF2")

    sidecars = write_chapter_sidecars(config, chapter_bodies=[])
    assert len(sidecars) == 2
    written = sidecars[0].path.read_text(encoding="utf-8")
    assert "Chapter content from" in written
    # Chapter-mode IGNORES the 100-char cap.
    assert sidecars[0].char_count > 100


def test_chapter_mode_falls_back_when_pdfs_missing(tmp_path: Path, monkeypatch) -> None:
    """When the YAML declares chapter_pdfs but no PDFs are cached, the
    whole-doc + page-range path runs (covered by the legacy tests).
    Verified here by ensuring write_chapter_sidecars does NOT call the
    chapter-PDF extractor."""
    monkeypatch.setenv("AIRBOSS_HANDBOOK_CACHE", str(tmp_path / "cache"))
    monkeypatch.setattr(paths_module, "repo_root", lambda: tmp_path)

    extractor_calls: list[Path] = []

    def boom(path: Path) -> str:
        extractor_calls.append(path)
        return ""

    monkeypatch.setattr(cp, "_extract_pdf_plaintext", boom)
    config = _make_config_with_chapter_pdfs()
    # No chapter PDFs are pre-populated; cache dir is empty.
    sidecars = write_chapter_sidecars(config, chapter_bodies=[])
    assert sidecars == []
    assert extractor_calls == []


def test_chapter_mode_skipped_when_no_chapter_pdfs_config(tmp_path: Path, monkeypatch) -> None:
    """Class C handbooks (chapter_pdfs is None) always use whole-doc mode."""
    monkeypatch.setenv("AIRBOSS_HANDBOOK_CACHE", str(tmp_path / "cache"))
    monkeypatch.setattr(paths_module, "repo_root", lambda: tmp_path)

    extractor_calls: list[Path] = []

    def boom(path: Path) -> str:
        extractor_calls.append(path)
        return ""

    monkeypatch.setattr(cp, "_extract_pdf_plaintext", boom)
    config = HandbookConfig(
        document_slug="classc",
        edition="X",
        title="ClassC",
        publisher="FAA",
        kind="handbook",
        source_url="https://example.invalid/x.pdf",
    )
    sidecars = write_chapter_sidecars(config, chapter_bodies=[])
    assert sidecars == []
    assert extractor_calls == []
