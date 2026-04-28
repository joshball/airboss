"""Unit tests for the prompt-flow sidecar reader.

Hard-fails on missing or malformed inputs; no skip-with-warning.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from ingest import paths as paths_module
from ingest.config_loader import HandbookConfig
from ingest.outline import OutlineNode
from ingest.sections_via_sidecar import (
    PROMPT_PROVENANCE,
    SidecarMalformedError,
    SidecarMissingError,
    load_chapter_sidecars,
)


def _make_config() -> HandbookConfig:
    return HandbookConfig(
        document_slug="testbook",
        edition="TEST-EDITION",
        title="Test Book",
        publisher="FAA",
        kind="handbook",
        source_url="https://example.invalid/test.pdf",
    )


def _chapter_node(ordinal: int) -> OutlineNode:
    return OutlineNode(
        level="chapter",
        code=str(ordinal),
        title=f"Chapter {ordinal}",
        page_start=10 * ordinal,
        page_end=10 * ordinal + 9,
        parent_code=None,
        ordinal=ordinal,
    )


def _seed_chapter(
    repo_root: Path,
    config: HandbookConfig,
    ordinal: int,
    json_payload,
    model_self_report: str = "claude-opus-4-7",
) -> Path:
    chap_dir = (
        repo_root
        / "handbooks"
        / config.document_slug
        / config.edition
        / f"{ordinal:02d}"
    )
    chap_dir.mkdir(parents=True, exist_ok=True)
    (chap_dir / "_llm_section_tree.json").write_text(
        json_payload if isinstance(json_payload, str) else json.dumps(json_payload),
        encoding="utf-8",
    )
    (chap_dir / "_model_self_report.txt").write_text(
        model_self_report + "\n", encoding="utf-8"
    )
    return chap_dir


def test_well_formed_json_parses_to_section_tree_nodes(
    tmp_path: Path, monkeypatch
) -> None:
    monkeypatch.setattr(paths_module, "repo_root", lambda: tmp_path)
    config = _make_config()
    payload = [
        {"title": "Atmosphere", "level": 1, "page_anchor": "12-2", "line_offset": 5},
        {"title": "Coriolis", "level": 1, "page_anchor": "12-3", "line_offset": 50},
    ]
    _seed_chapter(tmp_path, config, 12, payload)
    chapter_nodes = [_chapter_node(12)]
    result = load_chapter_sidecars(config, chapter_nodes)
    assert len(result.chapters) == 1
    chap = result.chapters[0]
    assert chap.chapter_ordinal == 12
    assert chap.model_self_report == "claude-opus-4-7"
    assert len(chap.nodes) == 2
    assert chap.nodes[0].title == "Atmosphere"
    assert chap.nodes[0].provenance == PROMPT_PROVENANCE
    # Sorted by line_offset ascending.
    assert chap.nodes[0].title == "Atmosphere"
    assert chap.nodes[1].title == "Coriolis"


def test_missing_json_raises_sidecar_missing_error(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(paths_module, "repo_root", lambda: tmp_path)
    config = _make_config()
    chapter_nodes = [_chapter_node(1)]
    # Don't seed anything. Both files are missing.
    with pytest.raises(SidecarMissingError) as excinfo:
        load_chapter_sidecars(config, chapter_nodes)
    assert "chapter 1" in str(excinfo.value)


def test_missing_model_self_report_raises_sidecar_missing_error(
    tmp_path: Path, monkeypatch
) -> None:
    monkeypatch.setattr(paths_module, "repo_root", lambda: tmp_path)
    config = _make_config()
    chap_dir = (
        tmp_path / "handbooks" / config.document_slug / config.edition / "01"
    )
    chap_dir.mkdir(parents=True)
    (chap_dir / "_llm_section_tree.json").write_text(
        json.dumps([{"title": "X", "level": 1, "line_offset": 0}]), encoding="utf-8"
    )
    # Intentionally do NOT write _model_self_report.txt.
    with pytest.raises(SidecarMissingError) as excinfo:
        load_chapter_sidecars(config, [_chapter_node(1)])
    assert "_model_self_report.txt" in str(excinfo.value)


def test_malformed_json_raises_sidecar_malformed_error(
    tmp_path: Path, monkeypatch
) -> None:
    monkeypatch.setattr(paths_module, "repo_root", lambda: tmp_path)
    config = _make_config()
    _seed_chapter(tmp_path, config, 1, "this is not json")
    with pytest.raises(SidecarMalformedError):
        load_chapter_sidecars(config, [_chapter_node(1)])


def test_non_array_json_raises_sidecar_malformed_error(
    tmp_path: Path, monkeypatch
) -> None:
    monkeypatch.setattr(paths_module, "repo_root", lambda: tmp_path)
    config = _make_config()
    _seed_chapter(tmp_path, config, 1, {"not": "an array"})
    with pytest.raises(SidecarMalformedError) as excinfo:
        load_chapter_sidecars(config, [_chapter_node(1)])
    assert "must be a JSON array" in str(excinfo.value)


def test_entry_without_title_raises(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(paths_module, "repo_root", lambda: tmp_path)
    config = _make_config()
    _seed_chapter(tmp_path, config, 1, [{"title": "", "level": 1}])
    with pytest.raises(SidecarMalformedError) as excinfo:
        load_chapter_sidecars(config, [_chapter_node(1)])
    assert "title" in str(excinfo.value)


def test_entry_with_invalid_level_raises(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(paths_module, "repo_root", lambda: tmp_path)
    config = _make_config()
    _seed_chapter(tmp_path, config, 1, [{"title": "X", "level": 7}])
    with pytest.raises(SidecarMalformedError) as excinfo:
        load_chapter_sidecars(config, [_chapter_node(1)])
    assert "level" in str(excinfo.value)


def test_empty_model_self_report_raises(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(paths_module, "repo_root", lambda: tmp_path)
    config = _make_config()
    chap_dir = (
        tmp_path / "handbooks" / config.document_slug / config.edition / "01"
    )
    chap_dir.mkdir(parents=True)
    (chap_dir / "_llm_section_tree.json").write_text(
        json.dumps([{"title": "X", "level": 1, "line_offset": 0}]), encoding="utf-8"
    )
    (chap_dir / "_model_self_report.txt").write_text("\n", encoding="utf-8")
    with pytest.raises(SidecarMalformedError):
        load_chapter_sidecars(config, [_chapter_node(1)])


def test_l3_clamped_to_l2(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(paths_module, "repo_root", lambda: tmp_path)
    config = _make_config()
    _seed_chapter(
        tmp_path, config, 1, [{"title": "Deep", "level": 3, "line_offset": 0}]
    )
    result = load_chapter_sidecars(config, [_chapter_node(1)])
    assert result.chapters[0].nodes[0].level == 2
