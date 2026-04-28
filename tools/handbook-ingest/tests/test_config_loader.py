"""Unit tests for the YAML config loader's strategy validation.

Covers:

- `section_strategy: llm` raises ConfigError with rename hint.
- Unknown strategy raises ConfigError listing valid options.
- `per_chapter_section_strategy` field raises ConfigError with removal note.
- `llm:` block (without `prompt:`) raises ConfigError with rename hint.
- `prompt:` block correctly populates `chapter_text_max_chars`.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from ingest import paths as paths_module
from ingest.config_loader import (
    DEFAULT_CHAPTER_TEXT_MAX_CHARS,
    SECTION_STRATEGY_PROMPT,
    SECTION_STRATEGY_TOC,
    ConfigError,
    load_config,
)


def _seed_yaml(tmp_path: Path, document_slug: str, body: str, monkeypatch) -> None:
    config_dir = tmp_path / "config"
    config_dir.mkdir(parents=True, exist_ok=True)
    (config_dir / f"{document_slug}.yaml").write_text(body, encoding="utf-8")
    monkeypatch.setattr(paths_module, "config_dir", lambda: config_dir)
    # `config_loader` does `from .paths import config_dir`, so it holds a
    # bound reference; patching `paths.config_dir` alone won't take effect
    # in the loader's namespace. Patch both.
    import ingest.config_loader as cl

    monkeypatch.setattr(cl, "config_dir", lambda: config_dir)


_VALID_HEADER = """
document_slug: test
edition: T-1
title: Test Handbook
publisher: FAA
kind: handbook
source_url: https://example.invalid/test.pdf
"""


def test_llm_strategy_raises_with_rename_hint(tmp_path: Path, monkeypatch) -> None:
    body = _VALID_HEADER + "section_strategy: llm\n"
    _seed_yaml(tmp_path, "test", body, monkeypatch)
    with pytest.raises(ConfigError) as excinfo:
        load_config("test")
    msg = str(excinfo.value)
    assert "section_strategy: llm" in msg
    assert "Rename to `prompt`" in msg
    assert "section-extraction-prompt-strategy.md" in msg


def test_per_chapter_strategy_raises_with_removal_hint(
    tmp_path: Path, monkeypatch
) -> None:
    body = _VALID_HEADER + "section_strategy: per_chapter\n"
    _seed_yaml(tmp_path, "test", body, monkeypatch)
    with pytest.raises(ConfigError) as excinfo:
        load_config("test")
    assert "per_chapter has been removed" in str(excinfo.value)


def test_unknown_strategy_lists_valid_options(tmp_path: Path, monkeypatch) -> None:
    body = _VALID_HEADER + "section_strategy: bogus\n"
    _seed_yaml(tmp_path, "test", body, monkeypatch)
    with pytest.raises(ConfigError) as excinfo:
        load_config("test")
    msg = str(excinfo.value)
    assert "unknown section_strategy" in msg
    assert "'toc'" in msg or "toc" in msg
    assert "prompt" in msg
    assert "compare" in msg


def test_per_chapter_section_strategy_field_raises(
    tmp_path: Path, monkeypatch
) -> None:
    body = (
        _VALID_HEADER
        + "section_strategy: toc\n"
        + "per_chapter_section_strategy:\n  1: toc\n"
    )
    _seed_yaml(tmp_path, "test", body, monkeypatch)
    with pytest.raises(ConfigError) as excinfo:
        load_config("test")
    assert "per_chapter_section_strategy` has been removed" in str(excinfo.value)


def test_legacy_llm_block_raises_with_rename_hint(
    tmp_path: Path, monkeypatch
) -> None:
    body = (
        _VALID_HEADER
        + "section_strategy: toc\n"
        + "llm:\n  chapter_text_max_chars: 60000\n"
    )
    _seed_yaml(tmp_path, "test", body, monkeypatch)
    with pytest.raises(ConfigError) as excinfo:
        load_config("test")
    msg = str(excinfo.value)
    assert "`llm:` config block has been renamed to `prompt:`" in msg


def test_prompt_block_populates_chapter_text_max_chars(
    tmp_path: Path, monkeypatch
) -> None:
    body = (
        _VALID_HEADER
        + "section_strategy: prompt\n"
        + "prompt:\n  chapter_text_max_chars: 12345\n"
    )
    _seed_yaml(tmp_path, "test", body, monkeypatch)
    config = load_config("test")
    assert config.section_strategy == SECTION_STRATEGY_PROMPT
    assert config.chapter_text_max_chars == 12345


def test_default_chapter_text_max_chars_when_block_missing(
    tmp_path: Path, monkeypatch
) -> None:
    body = _VALID_HEADER + "section_strategy: toc\n"
    _seed_yaml(tmp_path, "test", body, monkeypatch)
    config = load_config("test")
    assert config.section_strategy == SECTION_STRATEGY_TOC
    assert config.chapter_text_max_chars == DEFAULT_CHAPTER_TEXT_MAX_CHARS


def test_invalid_chapter_text_max_chars_raises(
    tmp_path: Path, monkeypatch
) -> None:
    body = (
        _VALID_HEADER
        + "section_strategy: prompt\n"
        + "prompt:\n  chapter_text_max_chars: -1\n"
    )
    _seed_yaml(tmp_path, "test", body, monkeypatch)
    with pytest.raises(ConfigError):
        load_config("test")
