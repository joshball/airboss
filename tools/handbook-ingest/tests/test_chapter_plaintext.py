"""Unit tests for the chapter-plaintext sidecar writer.

The sidecar writer is the prompt-flow's input source-of-truth: every byte
the sub-agents read came from `extract_sections` and was capped at
`HandbookConfig.chapter_text_max_chars`. Tests cover:

- Sidecar contents (head / tail) for a known body string.
- Truncation drops bytes past the cap, preserving the head.
- Only chapter-level bodies produce sidecars (sub-section bodies are
  skipped because the prompt flow operates at chapter granularity).
- SHA-256 matches the bytes written.
- Char count matches the bytes written.
"""

from __future__ import annotations

from pathlib import Path

from ingest import paths as paths_module
from ingest.chapter_plaintext import write_chapter_sidecars
from ingest.config_loader import HandbookConfig
from ingest.outline import OutlineNode
from ingest.sections import SectionBody


def _make_config(chapter_text_max_chars: int = 60000) -> HandbookConfig:
    return HandbookConfig(
        document_slug="testbook",
        edition="TEST-EDITION",
        title="Test Book",
        publisher="FAA",
        kind="handbook",
        source_url="https://example.invalid/test.pdf",
        chapter_text_max_chars=chapter_text_max_chars,
    )


def _chapter_node(ordinal: int, title: str) -> OutlineNode:
    return OutlineNode(
        level="chapter",
        code=str(ordinal),
        title=title,
        page_start=10,
        page_end=20,
        parent_code=None,
        ordinal=ordinal,
    )


def _section_body(node: OutlineNode, body_md: str) -> SectionBody:
    return SectionBody(
        node=node,
        body_md=body_md,
        faa_page_start="1-1",
        faa_page_end="1-24",
        char_count=len(body_md),
    )


def test_writes_one_sidecar_per_chapter(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(paths_module, "repo_root", lambda: tmp_path)
    config = _make_config()
    bodies = [
        _section_body(_chapter_node(1, "Intro"), "Chapter 1 body. " * 10),
        _section_body(_chapter_node(2, "Aero"), "Chapter 2 body. " * 10),
    ]
    sidecars = write_chapter_sidecars(config, bodies)
    assert len(sidecars) == 2
    paths = [s.path for s in sidecars]
    assert all(p.is_file() for p in paths)
    assert paths[0].name == "_chapter_plaintext.txt"
    assert paths[0].parent.name == "01"
    assert paths[1].parent.name == "02"


def test_sidecar_contents_match_body(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(paths_module, "repo_root", lambda: tmp_path)
    config = _make_config()
    body_text = "First paragraph.\n\nSecond paragraph."
    bodies = [_section_body(_chapter_node(1, "Intro"), body_text)]
    sidecars = write_chapter_sidecars(config, bodies)
    written = sidecars[0].path.read_text(encoding="utf-8")
    # Always ends with a single trailing newline.
    assert written == body_text + "\n"
    assert sidecars[0].char_count == len(written)


def test_truncation_drops_tail_past_cap(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(paths_module, "repo_root", lambda: tmp_path)
    head = "HEAD" + "X" * 100
    tail = "Y" * 100 + "TAIL"
    body_text = head + tail
    cap = len(head)  # truncate to exactly the head length
    config = _make_config(chapter_text_max_chars=cap)
    bodies = [_section_body(_chapter_node(1, "Intro"), body_text)]
    sidecars = write_chapter_sidecars(config, bodies)
    written = sidecars[0].path.read_text(encoding="utf-8")
    assert written.startswith("HEAD")
    assert "TAIL" not in written
    assert len(written) <= cap + 1  # +1 for trailing newline


def test_skips_non_chapter_bodies(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(paths_module, "repo_root", lambda: tmp_path)
    config = _make_config()
    chapter_node = _chapter_node(1, "Intro")
    section_node = OutlineNode(
        level="section",
        code="1.1",
        title="Sub",
        page_start=12,
        page_end=14,
        parent_code="1",
        ordinal=1,
    )
    bodies = [
        _section_body(chapter_node, "chapter body"),
        _section_body(section_node, "section body"),
    ]
    sidecars = write_chapter_sidecars(config, bodies)
    assert len(sidecars) == 1
    assert sidecars[0].chapter_ordinal == 1


def test_sha256_matches_written_bytes(tmp_path: Path, monkeypatch) -> None:
    import hashlib

    monkeypatch.setattr(paths_module, "repo_root", lambda: tmp_path)
    config = _make_config()
    bodies = [_section_body(_chapter_node(1, "Intro"), "hello world")]
    sidecars = write_chapter_sidecars(config, bodies)
    written = sidecars[0].path.read_bytes()
    assert sidecars[0].sha256 == hashlib.sha256(written).hexdigest()
