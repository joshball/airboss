"""Unit tests for the prompt-set emitter.

Covers per-design.md test plan:

- `out/` contains all expected files.
- `meta.json` template SHA-256s match actual file hashes in `out/`.
- `meta.json.config.config_yaml_sha256` matches `out/_config.yaml`.
- Re-running overwrites `out/` and produces a fresh archive snapshot.
- `archive=False` skips the snapshot.
- Two runs in the same minute produce `archive/<run-id>/` and `archive/<run-id>-2/`.
- Per-chapter prompt has all nine placeholders substituted.
- `_run.md` lists chapter prompt paths and references `_parameters.md`
  (does not restate its rules).
"""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path

import pytest

from ingest import paths as paths_module
from ingest.chapter_plaintext import write_chapter_sidecars
from ingest.config_loader import HandbookConfig
from ingest.outline import OutlineNode
from ingest.prompt_emit import (
    ARCHIVE_SUBDIR,
    CONFIG_SNAPSHOT_FILENAME,
    CONTRACT_FILENAME,
    META_FILENAME,
    PARAMETERS_FILENAME,
    PROMPTS_OUT_DIRNAME,
    README_FILENAME,
    RUN_FILENAME,
    emit_prompts,
)
from ingest.sections import SectionBody


@pytest.fixture
def fake_repo(tmp_path: Path, monkeypatch) -> Path:
    """Redirect repo_root + prompt-emit prompts-out into tmp_path."""
    fake_root = tmp_path / "repo"
    fake_root.mkdir()
    # The handbook-ingest tool reads template files from
    # tools/handbook-ingest/ingest/prompts/section-extraction/. The real
    # repo root holds those files; we redirect repo_root() (used for
    # relative_to_repo) to tmp_path while the prompt_emit module finds
    # templates via __file__-relative paths. Also redirect the prompt-
    # emitter's `prompts-out/` root to tmp_path so we don't pollute the
    # real tools dir.
    monkeypatch.setattr(paths_module, "repo_root", lambda: fake_root)
    # The prompt_emit module reads `_prompts_out_root()` -> module-relative
    # `tools/handbook-ingest/prompts-out/`. Patch the function so writes
    # land in tmp_path.
    import ingest.prompt_emit as pe

    monkeypatch.setattr(pe, "_prompts_out_root", lambda: fake_root / PROMPTS_OUT_DIRNAME)
    # Also patch resolve_config_path so `_config.yaml` snapshot has a real
    # source. We write a minimal fake YAML for the test handbook below.
    return fake_root


def _make_config_with_yaml(fake_repo: Path) -> HandbookConfig:
    config_dir_in_test = fake_repo / "config"
    config_dir_in_test.mkdir(parents=True, exist_ok=True)
    yaml_path = config_dir_in_test / "testbook.yaml"
    yaml_path.write_text(
        "document_slug: testbook\nedition: TEST-EDITION\nsection_strategy: prompt\n",
        encoding="utf-8",
    )
    # The prompt_emit module calls `resolve_config_path(slug)` which reads
    # from `ingest/config/<slug>.yaml`. We need to pre-load via monkeypatch
    # in the test that uses this; for simplicity, return both.
    return HandbookConfig(
        document_slug="testbook",
        edition="TEST-EDITION",
        title="Test Book",
        publisher="FAA",
        kind="handbook",
        source_url="https://example.invalid/test.pdf",
        section_strategy="prompt",
        chapter_text_max_chars=60000,
    )


def _patch_resolve_config_path(monkeypatch, fake_repo: Path) -> None:
    """Make `resolve_config_path` find a fake YAML inside fake_repo/config/."""
    import ingest.prompt_emit as pe

    yaml_path = fake_repo / "config" / "testbook.yaml"
    yaml_path.parent.mkdir(parents=True, exist_ok=True)
    yaml_path.write_text(
        "document_slug: testbook\nedition: TEST-EDITION\nsection_strategy: prompt\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(pe, "resolve_config_path", lambda slug: yaml_path)


def _chapter_node(ordinal: int, title: str) -> OutlineNode:
    return OutlineNode(
        level="chapter",
        code=str(ordinal),
        title=title,
        page_start=10 + ordinal,
        page_end=20 + ordinal,
        parent_code=None,
        ordinal=ordinal,
    )


def _section_body(node: OutlineNode, body_md: str) -> SectionBody:
    return SectionBody(
        node=node,
        body_md=body_md,
        faa_page_start=f"{node.ordinal}-1",
        faa_page_end=f"{node.ordinal}-{len(body_md) // 100}",
        char_count=len(body_md),
    )


def _setup_three_chapters(fake_repo: Path, monkeypatch) -> tuple[
    HandbookConfig, list[OutlineNode], list[SectionBody], list
]:
    config = _make_config_with_yaml(fake_repo)
    _patch_resolve_config_path(monkeypatch, fake_repo)
    chapters = [_chapter_node(i, f"Chapter {i} Title") for i in (1, 2, 3)]
    bodies = [_section_body(c, f"Body {c.ordinal} contents " * 50) for c in chapters]
    sidecars = write_chapter_sidecars(config, bodies)
    return config, chapters, bodies, sidecars


def test_out_dir_contains_all_expected_files(fake_repo: Path, monkeypatch) -> None:
    config, chapters, bodies, sidecars = _setup_three_chapters(fake_repo, monkeypatch)
    result = emit_prompts(
        config,
        chapter_nodes=chapters,
        chapter_bodies=bodies,
        sidecars=sidecars,
        source_pdf_sha256="deadbeef" * 8,
    )
    out = result.out_dir
    expected = {
        RUN_FILENAME,
        PARAMETERS_FILENAME,
        CONTRACT_FILENAME,
        CONFIG_SNAPSHOT_FILENAME,
        META_FILENAME,
        README_FILENAME,
    }
    actual = {p.name for p in out.iterdir()}
    assert expected.issubset(actual)
    skip_names = {RUN_FILENAME, PARAMETERS_FILENAME, CONTRACT_FILENAME, README_FILENAME}
    chapter_files = [
        p for p in out.iterdir() if p.suffix == ".md" and p.name not in skip_names
    ]
    assert len(chapter_files) == 3


def test_meta_template_sha_matches_actual_files(fake_repo: Path, monkeypatch) -> None:
    config, chapters, bodies, sidecars = _setup_three_chapters(fake_repo, monkeypatch)
    result = emit_prompts(
        config,
        chapter_nodes=chapters,
        chapter_bodies=bodies,
        sidecars=sidecars,
        source_pdf_sha256="cafe" * 16,
    )
    meta = json.loads(result.meta_path.read_text(encoding="utf-8"))
    parameters_actual = hashlib.sha256(
        (result.out_dir / PARAMETERS_FILENAME).read_bytes()
    ).hexdigest()
    contract_actual = hashlib.sha256(
        (result.out_dir / CONTRACT_FILENAME).read_bytes()
    ).hexdigest()
    config_actual = hashlib.sha256(
        (result.out_dir / CONFIG_SNAPSHOT_FILENAME).read_bytes()
    ).hexdigest()
    assert meta["templates"]["parameters_md_sha256"] == parameters_actual
    assert meta["templates"]["section_tree_md_sha256"] == contract_actual
    assert meta["config"]["config_yaml_sha256"] == config_actual
    assert meta["source_pdf_sha256"] == "cafe" * 16


def test_per_chapter_prompt_has_all_nine_placeholders(
    fake_repo: Path, monkeypatch
) -> None:
    config, chapters, bodies, sidecars = _setup_three_chapters(fake_repo, monkeypatch)
    result = emit_prompts(
        config,
        chapter_nodes=chapters,
        chapter_bodies=bodies,
        sidecars=sidecars,
        source_pdf_sha256="aa" * 32,
    )
    text = result.chapter_prompt_paths[0].read_text(encoding="utf-8")
    # `chapter_ordinal` (substituted as int 1)
    assert "chapter 1" in text
    # `title`
    assert "Chapter 1 Title" in text
    # `document_slug`
    assert "`testbook`" in text
    # `edition`
    assert "`TEST-EDITION`" in text
    # `page_range`
    assert "1-1" in text
    # `sidecar_path`
    assert "_chapter_plaintext.txt" in text
    # `sidecar_sha256`
    assert sidecars[0].sha256 in text
    # `output_path`
    assert "_llm_section_tree.json" in text
    # `contract_path`
    assert "_section_tree_contract.md" in text


def test_run_md_lists_all_chapter_prompts_and_references_parameters(
    fake_repo: Path, monkeypatch
) -> None:
    config, chapters, bodies, sidecars = _setup_three_chapters(fake_repo, monkeypatch)
    result = emit_prompts(
        config,
        chapter_nodes=chapters,
        chapter_bodies=bodies,
        sidecars=sidecars,
        source_pdf_sha256="00" * 32,
    )
    run_text = (result.out_dir / RUN_FILENAME).read_text(encoding="utf-8")
    # Names every chapter prompt path.
    for prompt in result.chapter_prompt_paths:
        assert prompt.name in run_text
    # References parameters.md (single source of truth).
    assert "_parameters.md" in run_text
    # Names the compare follow-up command.
    assert "--strategy compare" in run_text
    # Includes the fresh-CC-session note.
    assert "fresh" in run_text.lower()


def test_archive_skipped_when_archive_false(fake_repo: Path, monkeypatch) -> None:
    config, chapters, bodies, sidecars = _setup_three_chapters(fake_repo, monkeypatch)
    result = emit_prompts(
        config,
        chapter_nodes=chapters,
        chapter_bodies=bodies,
        sidecars=sidecars,
        source_pdf_sha256="00" * 32,
        archive=False,
    )
    assert result.archive_dir is None
    archive_root = result.out_dir.parent / ARCHIVE_SUBDIR
    # When archive=False on the very first run, archive/ should not exist.
    assert not archive_root.exists()


def test_archive_default_creates_run_id_dir(fake_repo: Path, monkeypatch) -> None:
    config, chapters, bodies, sidecars = _setup_three_chapters(fake_repo, monkeypatch)
    result = emit_prompts(
        config,
        chapter_nodes=chapters,
        chapter_bodies=bodies,
        sidecars=sidecars,
        source_pdf_sha256="00" * 32,
    )
    assert result.archive_dir is not None
    assert result.archive_dir.is_dir()
    assert result.archive_dir.name == result.run_id
    out_files = {p.name for p in result.out_dir.iterdir()}
    archive_files = {p.name for p in result.archive_dir.iterdir()}
    assert out_files == archive_files


def test_collision_suffix_for_same_minute_runs(fake_repo: Path, monkeypatch) -> None:
    config, chapters, bodies, sidecars = _setup_three_chapters(fake_repo, monkeypatch)
    fixed_now = datetime(2026, 4, 28, 14, 32, 18, tzinfo=UTC)
    r1 = emit_prompts(
        config,
        chapter_nodes=chapters,
        chapter_bodies=bodies,
        sidecars=sidecars,
        source_pdf_sha256="00" * 32,
        now=fixed_now,
    )
    r2 = emit_prompts(
        config,
        chapter_nodes=chapters,
        chapter_bodies=bodies,
        sidecars=sidecars,
        source_pdf_sha256="00" * 32,
        now=fixed_now,
    )
    assert r1.run_id == "20260428-1432"
    assert r2.run_id == "20260428-1432-2"
    r3 = emit_prompts(
        config,
        chapter_nodes=chapters,
        chapter_bodies=bodies,
        sidecars=sidecars,
        source_pdf_sha256="00" * 32,
        now=fixed_now,
    )
    assert r3.run_id == "20260428-1432-3"


def test_rerun_overwrites_out_dir(fake_repo: Path, monkeypatch) -> None:
    config, chapters, bodies, sidecars = _setup_three_chapters(fake_repo, monkeypatch)
    r1 = emit_prompts(
        config,
        chapter_nodes=chapters,
        chapter_bodies=bodies,
        sidecars=sidecars,
        source_pdf_sha256="00" * 32,
    )
    # Plant a stale file inside out/ that the next run should remove.
    stale = r1.out_dir / "stale-leftover.md"
    stale.write_text("stale", encoding="utf-8")
    assert stale.is_file()
    emit_prompts(
        config,
        chapter_nodes=chapters,
        chapter_bodies=bodies,
        sidecars=sidecars,
        source_pdf_sha256="00" * 32,
    )
    assert not stale.exists()


def test_meta_chapter_count_matches_input(fake_repo: Path, monkeypatch) -> None:
    config, chapters, bodies, sidecars = _setup_three_chapters(fake_repo, monkeypatch)
    result = emit_prompts(
        config,
        chapter_nodes=chapters,
        chapter_bodies=bodies,
        sidecars=sidecars,
        source_pdf_sha256="00" * 32,
    )
    meta = json.loads(result.meta_path.read_text(encoding="utf-8"))
    assert len(meta["chapters"]) == 3
    assert {c["ordinal"] for c in meta["chapters"]} == {1, 2, 3}
    for chap_meta, sidecar in zip(meta["chapters"], sidecars, strict=True):
        assert chap_meta["sidecar_sha256"] == sidecar.sha256
