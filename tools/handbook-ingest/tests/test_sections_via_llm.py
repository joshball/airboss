"""Unit tests for the LLM strategy.

The Claude API is stubbed via a fake `ClaudeCaller` so tests don't make
network calls. We verify:
- prompt SHA-256 is reported
- malformed JSON yields a warning, not a crash
- well-formed JSON converts to the right `SectionTreeNode` shape
- raw response files land in the expected location when enabled
"""

from __future__ import annotations

import json
from pathlib import Path

from ingest.config_loader import HandbookConfig
from ingest.outline import OutlineNode
from ingest.sections_via_llm import (
    ClaudeCaller,
    _entries_to_nodes,
    _parse_response_json,
    extract_via_llm,
)


def _make_config(tmp_path: Path) -> HandbookConfig:
    """Build a minimal HandbookConfig pointing extraction output at tmp_path."""

    return HandbookConfig(
        document_slug="testbook",
        edition="TEST-EDITION",
        title="Test Book",
        publisher="FAA",
        kind="handbook",
        source_url="https://example.invalid/test.pdf",
    )


class FakeCaller(ClaudeCaller):
    """Records the prompt + returns a canned response."""

    def __init__(self, response: str, in_tokens: int = 100, out_tokens: int = 50) -> None:
        super().__init__(api_key="fake")
        self.response = response
        self.in_tokens = in_tokens
        self.out_tokens = out_tokens
        self.calls: list[str] = []

    def call(self, prompt: str) -> tuple[str, int, int]:
        self.calls.append(prompt)
        return self.response, self.in_tokens, self.out_tokens


def test_parse_response_strips_markdown_fencing() -> None:
    payload = '```json\n[{"title":"X","level":1,"page_anchor":null,"line_offset":0,"parent_title":null}]\n```'
    parsed = _parse_response_json(payload)
    assert isinstance(parsed, list)
    assert parsed[0]["title"] == "X"


def test_parse_response_rejects_non_array() -> None:
    import pytest

    from ingest.sections_via_llm import LlmResponseError

    with pytest.raises(LlmResponseError):
        _parse_response_json('{"not": "an array"}')


def test_entries_to_nodes_filters_invalid() -> None:
    entries = [
        {"title": "Good", "level": 1, "page_anchor": "12-7", "line_offset": 0, "parent_title": None},
        {"title": "", "level": 1},  # empty title -> drop
        {"title": "Bad Level", "level": 7},  # out of range -> drop
        {"level": 1},  # missing title -> drop
    ]
    nodes = _entries_to_nodes(entries, chapter_ordinal=12)
    assert len(nodes) == 1
    assert nodes[0].title == "Good"
    assert nodes[0].page_anchor == "12-7"
    assert nodes[0].provenance == "llm"


def test_entries_to_nodes_sorts_by_line_offset() -> None:
    entries = [
        {"title": "B", "level": 1, "line_offset": 50},
        {"title": "A", "level": 1, "line_offset": 10},
        {"title": "C", "level": 1, "line_offset": 100},
    ]
    nodes = _entries_to_nodes(entries, chapter_ordinal=1)
    assert [n.title for n in nodes] == ["A", "B", "C"]


def test_extract_via_llm_writes_response_file(tmp_path: Path, monkeypatch) -> None:
    """End-to-end with a stub caller: response lands on disk under repo edition_root."""

    # Redirect repo_root to tmp_path so file writes don't pollute the repo.
    import ingest.paths as paths_module
    import ingest.sections_via_llm as llm_module

    monkeypatch.setattr(paths_module, "repo_root", lambda: tmp_path)
    monkeypatch.setattr(llm_module, "edition_root", lambda d, e: tmp_path / "handbooks" / d / e)

    chapter_node = OutlineNode(
        level="chapter",
        code="12",
        title="Weather Theory",
        page_start=285,
        page_end=310,
        parent_code=None,
        ordinal=12,
    )
    config = _make_config(tmp_path)
    response = json.dumps(
        [
            {
                "title": "Atmosphere",
                "level": 1,
                "page_anchor": "12-2",
                "line_offset": 5,
                "parent_title": None,
            },
            {
                "title": "Coriolis Force",
                "level": 1,
                "page_anchor": "12-3",
                "line_offset": 50,
                "parent_title": None,
            },
        ]
    )
    caller = FakeCaller(response=response, in_tokens=1000, out_tokens=200)

    result = extract_via_llm(
        config,
        chapters=[chapter_node],
        chapter_bodies={12: "Atmosphere is a blanket of air...\n...Coriolis Force..."},
        api_caller=caller,
    )

    assert len(result.nodes) == 2
    assert result.nodes[0].chapter_ordinal == 12
    assert result.nodes[0].provenance == "llm"
    assert result.input_tokens == 1000
    assert result.output_tokens == 200
    assert result.prompt_sha256 != ""
    assert len(caller.calls) == 1
    # Verify the prompt template substitution worked.
    assert "Weather Theory" in caller.calls[0]
    assert "Atmosphere is a blanket of air" in caller.calls[0]

    response_path = tmp_path / "handbooks" / "testbook" / "TEST-EDITION" / "12" / "_llm_section_tree.json"
    assert response_path.is_file()
    saved = json.loads(response_path.read_text())
    assert saved[0]["title"] == "Atmosphere"


def test_extract_via_llm_handles_malformed_response(tmp_path: Path, monkeypatch) -> None:
    import ingest.paths as paths_module
    import ingest.sections_via_llm as llm_module

    monkeypatch.setattr(paths_module, "repo_root", lambda: tmp_path)
    monkeypatch.setattr(llm_module, "edition_root", lambda d, e: tmp_path / "handbooks" / d / e)

    chapter_node = OutlineNode(
        level="chapter",
        code="1",
        title="Intro",
        page_start=16,
        page_end=39,
        parent_code=None,
        ordinal=1,
    )
    config = _make_config(tmp_path)
    caller = FakeCaller(response="this is not json")
    result = extract_via_llm(
        config,
        chapters=[chapter_node],
        chapter_bodies={1: "body"},
        api_caller=caller,
    )
    assert result.nodes == []
    assert any("malformed" in w for w in result.warnings)
