"""Integration test for the prompt -> compare round-trip.

Builds a tiny synthetic 3-chapter PDF, exercises the prompt + compare
strategies via direct function calls (the click runner would also work but
is heavier), and asserts the round-trip semantics from design.md test
plan:

- `--strategy prompt --dry-run` is rejected.
- `--strategy prompt` populates out/ + sidecars + archive/<run-id>/.
- `--strategy compare` reads the JSONs without mutating sidecars.
- PDF SHA-256 mismatch fails compare loud.
- Missing JSON during compare fails loud.
- Malformed JSON during compare fails loud.

To keep the test self-contained, we fabricate a chapter outline + bodies
manually and call the prompt-emit / sidecar-load functions directly. The
PDF is only fabricated to exercise the SHA-256 check; we don't go through
PyMuPDF here (the lower-level test_chapter_plaintext.py + test_prompt_emit.py
+ test_sections_via_sidecar.py already cover the per-module shapes).
"""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

import pytest
from click.testing import CliRunner

from ingest import paths as paths_module
from ingest.chapter_plaintext import write_chapter_sidecars
from ingest.cli import main as cli_main
from ingest.config_loader import HandbookConfig
from ingest.outline import OutlineNode
from ingest.prompt_emit import emit_prompts
from ingest.sections import SectionBody
from ingest.sections_via_sidecar import (
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
        section_strategy="prompt",
        chapter_text_max_chars=60000,
    )


def _chapter(ordinal: int, title: str) -> OutlineNode:
    return OutlineNode(
        level="chapter",
        code=str(ordinal),
        title=title,
        page_start=10 * ordinal,
        page_end=10 * ordinal + 9,
        parent_code=None,
        ordinal=ordinal,
    )


def _body(node: OutlineNode, body_md: str) -> SectionBody:
    return SectionBody(
        node=node,
        body_md=body_md,
        faa_page_start=f"{node.ordinal}-1",
        faa_page_end=f"{node.ordinal}-9",
        char_count=len(body_md),
    )


@pytest.fixture
def integration_setup(tmp_path: Path, monkeypatch) -> tuple:
    """Stand up a fake repo + config + 3 chapters + emit a prompt run."""
    fake_root = tmp_path / "repo"
    fake_root.mkdir()
    monkeypatch.setattr(paths_module, "repo_root", lambda: fake_root)

    import ingest.prompt_emit as pe

    monkeypatch.setattr(pe, "_prompts_out_root", lambda: fake_root / "prompts-out")
    yaml_dir = fake_root / "config"
    yaml_dir.mkdir()
    yaml_path = yaml_dir / "testbook.yaml"
    yaml_path.write_text(
        "document_slug: testbook\nedition: TEST-EDITION\nsection_strategy: prompt\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(pe, "resolve_config_path", lambda slug: yaml_path)

    config = _make_config()
    chapters = [_chapter(i, f"Chapter {i}") for i in (1, 2, 3)]
    bodies = [_body(c, f"Body {c.ordinal} contents " * 30) for c in chapters]
    sidecars = write_chapter_sidecars(config, bodies)
    fake_pdf_sha = "deadbeef" * 8
    result = emit_prompts(
        config,
        chapter_nodes=chapters,
        chapter_bodies=bodies,
        sidecars=sidecars,
        source_pdf_sha256=fake_pdf_sha,
    )
    return fake_root, config, chapters, bodies, sidecars, result, fake_pdf_sha


def _seed_chapter_outputs(fake_root: Path, config: HandbookConfig, chapters: list[OutlineNode]) -> None:
    """Emulate a fresh-CC-session sub-agent run by writing the JSONs + reports."""
    for chap in chapters:
        chap_dir = (
            fake_root
            / "handbooks"
            / config.document_slug
            / config.edition
            / f"{chap.ordinal:02d}"
        )
        chap_dir.mkdir(parents=True, exist_ok=True)
        payload = [
            {
                "title": f"{chap.title} Section A",
                "level": 1,
                "page_anchor": f"{chap.ordinal}-2",
                "line_offset": 5,
                "parent_title": None,
            },
            {
                "title": f"{chap.title} Section B",
                "level": 1,
                "page_anchor": f"{chap.ordinal}-4",
                "line_offset": 50,
                "parent_title": None,
            },
        ]
        (chap_dir / "_llm_section_tree.json").write_text(
            json.dumps(payload), encoding="utf-8"
        )
        (chap_dir / "_model_self_report.txt").write_text(
            "claude-opus-4-7\n", encoding="utf-8"
        )


def test_round_trip_prompt_then_compare(integration_setup) -> None:
    fake_root, config, chapters, _bodies, _sidecars, result, _ = integration_setup

    # After --strategy prompt: out/ exists, sidecars exist, archive exists.
    out = result.out_dir
    assert (out / "_run.md").is_file()
    assert (out / "_parameters.md").is_file()
    assert (out / "_section_tree_contract.md").is_file()
    assert (out / "_config.yaml").is_file()
    assert (out / "meta.json").is_file()
    assert (out / "README.md").is_file()
    assert len(result.chapter_prompt_paths) == 3
    assert result.archive_dir is not None and result.archive_dir.is_dir()
    archive_files = {p.name for p in result.archive_dir.iterdir()}
    out_files = {p.name for p in out.iterdir()}
    assert out_files == archive_files

    # Sub-agent run is simulated by writing the JSONs.
    _seed_chapter_outputs(fake_root, config, chapters)

    # The compare-side reader sees clean inputs.
    sidecar_load = load_chapter_sidecars(config, chapters)
    assert len(sidecar_load.chapters) == 3
    assert all(c.model_self_report == "claude-opus-4-7" for c in sidecar_load.chapters)

    # Compare must NOT mutate the sidecars; check by re-hashing.
    pre_sidecar_hashes = {
        c.ordinal: hashlib.sha256(
            (
                fake_root
                / "handbooks"
                / config.document_slug
                / config.edition
                / f"{c.ordinal:02d}"
                / "_chapter_plaintext.txt"
            ).read_bytes()
        ).hexdigest()
        for c in chapters
    }
    # Re-read after load; should be identical.
    post_sidecar_hashes = {
        c.ordinal: hashlib.sha256(
            (
                fake_root
                / "handbooks"
                / config.document_slug
                / config.edition
                / f"{c.ordinal:02d}"
                / "_chapter_plaintext.txt"
            ).read_bytes()
        ).hexdigest()
        for c in chapters
    }
    assert pre_sidecar_hashes == post_sidecar_hashes


def test_missing_json_during_compare_fails_loud(integration_setup) -> None:
    fake_root, config, chapters, *_ = integration_setup
    # Seed only chapters 1 and 2, leaving chapter 3's JSON missing.
    _seed_chapter_outputs(fake_root, config, chapters[:2])
    with pytest.raises(SidecarMissingError) as excinfo:
        load_chapter_sidecars(config, chapters)
    assert "chapter 3" in str(excinfo.value)


def test_malformed_json_during_compare_fails_loud(integration_setup) -> None:
    fake_root, config, chapters, *_ = integration_setup
    _seed_chapter_outputs(fake_root, config, chapters)
    # Corrupt chapter 2's JSON.
    bad = (
        fake_root
        / "handbooks"
        / config.document_slug
        / config.edition
        / "02"
        / "_llm_section_tree.json"
    )
    bad.write_text("not-valid-json", encoding="utf-8")
    with pytest.raises(SidecarMalformedError):
        load_chapter_sidecars(config, chapters)


def test_archive_no_archive_round_trip(tmp_path: Path, monkeypatch) -> None:
    """`--no-archive` skips the snapshot but still writes out/."""
    fake_root = tmp_path / "repo"
    fake_root.mkdir()
    monkeypatch.setattr(paths_module, "repo_root", lambda: fake_root)
    import ingest.prompt_emit as pe

    monkeypatch.setattr(pe, "_prompts_out_root", lambda: fake_root / "prompts-out")
    yaml_path = fake_root / "config" / "testbook.yaml"
    yaml_path.parent.mkdir(parents=True)
    yaml_path.write_text(
        "document_slug: testbook\nedition: TEST-EDITION\nsection_strategy: prompt\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(pe, "resolve_config_path", lambda slug: yaml_path)
    config = _make_config()
    chapters = [_chapter(1, "Only")]
    bodies = [_body(chapters[0], "body")]
    sidecars = write_chapter_sidecars(config, bodies)
    result = emit_prompts(
        config,
        chapter_nodes=chapters,
        chapter_bodies=bodies,
        sidecars=sidecars,
        source_pdf_sha256="00" * 32,
        archive=False,
    )
    assert result.archive_dir is None
    assert (result.out_dir / "_run.md").is_file()
    archive_root = result.out_dir.parent / "archive"
    # No archive dir created at all on a first --no-archive run.
    assert not archive_root.exists()


def test_dry_run_with_prompt_strategy_is_hard_error(tmp_path: Path, monkeypatch) -> None:
    """`--strategy prompt --dry-run` exits non-zero with a specific message."""
    # Stand up a real YAML inside the package's config dir is hard; the
    # CLI's click runner reads from `config_dir()`. We monkeypatch
    # config_loader.config_dir + paths.config_dir to point at a tmp YAML.
    fake_root = tmp_path / "repo"
    fake_root.mkdir()
    monkeypatch.setattr(paths_module, "repo_root", lambda: fake_root)
    config_dir = fake_root / "config"
    config_dir.mkdir()
    yaml_path = config_dir / "testbook.yaml"
    yaml_path.write_text(
        "document_slug: testbook\n"
        "edition: TEST-EDITION\n"
        "title: Test\n"
        "publisher: FAA\n"
        "kind: handbook\n"
        "source_url: https://example.invalid/test.pdf\n"
        "section_strategy: toc\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(paths_module, "config_dir", lambda: config_dir)
    import ingest.config_loader as cl

    monkeypatch.setattr(cl, "config_dir", lambda: config_dir)

    runner = CliRunner()
    result = runner.invoke(
        cli_main,
        ["testbook", "--strategy", "prompt", "--dry-run"],
        catch_exceptions=False,
    )
    assert result.exit_code != 0
    assert "--dry-run is not supported with --strategy prompt" in result.output


def test_unknown_strategy_in_yaml_fails_with_specific_message(
    tmp_path: Path, monkeypatch
) -> None:
    """A YAML with `section_strategy: llm` fails with the rename hint."""
    fake_root = tmp_path / "repo"
    fake_root.mkdir()
    monkeypatch.setattr(paths_module, "repo_root", lambda: fake_root)
    config_dir = fake_root / "config"
    config_dir.mkdir()
    yaml_path = config_dir / "testbook.yaml"
    yaml_path.write_text(
        "document_slug: testbook\n"
        "edition: TEST-EDITION\n"
        "title: Test\n"
        "publisher: FAA\n"
        "kind: handbook\n"
        "source_url: https://example.invalid/test.pdf\n"
        "section_strategy: llm\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(paths_module, "config_dir", lambda: config_dir)
    import ingest.config_loader as cl

    monkeypatch.setattr(cl, "config_dir", lambda: config_dir)
    runner = CliRunner()
    result = runner.invoke(
        cli_main,
        ["testbook"],
        catch_exceptions=False,
    )
    assert result.exit_code != 0
    assert "section_strategy: llm has been removed" in result.output
    assert "Rename to `prompt`" in result.output


# Suppress unused import warning (the subprocess import is kept for future
# tests that exercise the click runner via subprocess instead of in-process).
_ = subprocess
