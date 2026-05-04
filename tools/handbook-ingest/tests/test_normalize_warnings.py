"""Unit tests for the warning-emission additions in `normalize.write_outputs`.

WP-HANDBOOK-RE-EXTRACTION-V2 Sub-phase 1A:

- Every warning now carries a stable `id` (16 hex chars) computed from
  ``<code>|<section_code or "">|<message[:50]>`` so the hangar warning-triage
  dashboard can persist triage state across re-extractions.
- A sibling ``warnings.json`` file is written next to ``manifest.json`` in
  the per-edition derivative root. Schema matches `handbookWarningsFileSchema`
  on the TS side.

These tests exercise the warning-emission contract directly. The full
write_outputs flow (markdown composition, frontmatter, etc.) is exercised
through the integration / CLI tests; here we keep the surface tight and
deterministic.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from ingest import normalize
from ingest.config_loader import HandbookConfig
from ingest.fetch import FetchResult
from ingest.figures import FigureWarning
from ingest.outline import OutlineNode
from ingest.sections import SectionBody
from ingest.tables import TableWarning


def _config() -> HandbookConfig:
    return HandbookConfig(
        document_slug="phak",
        edition="FAA-H-8083-25C",
        title="Pilot's Handbook of Aeronautical Knowledge",
        publisher="FAA",
        kind="handbook",
        source_url="https://www.faa.gov/test.pdf",
        subjects=["aerodynamics"],
        primary_cert="private",
    )


def _fetch_result(tmp_path: Path) -> FetchResult:
    return FetchResult(
        path=tmp_path / "phak.pdf",
        url="https://www.faa.gov/test.pdf",
        sha256="a" * 64,
        fetched_at="2026-05-04T00:00:00.000+00:00",
        size_bytes=1024,
    )


def _outline_node() -> OutlineNode:
    return OutlineNode(
        level="chapter",
        code="1",
        title="Introduction to Flying",
        page_start=1,
        page_end=10,
        ordinal=1,
    )


def _body() -> SectionBody:
    return SectionBody(
        node=_outline_node(),
        body_md="Sample body paragraph.",
        faa_page_start="1-1",
        faa_page_end="1-2",
        char_count=22,
    )


@pytest.fixture
def isolate_repo(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    """Redirect the in-repo derivative writes into ``tmp_path``.

    Both `edition_root` and `relative_to_repo` are imported by name into
    `normalize`, so we patch the bound symbols on the `normalize` module
    rather than reaching into `paths`.
    """

    derivative = tmp_path / "handbooks" / "phak" / "FAA-H-8083-25C"

    def _edition_root(_doc: str, _ed: str) -> Path:
        return derivative

    def _relative_to_repo(p: Path) -> str:
        try:
            return p.relative_to(tmp_path).as_posix()
        except ValueError:
            return p.as_posix()

    monkeypatch.setattr(normalize, "edition_root", _edition_root)
    monkeypatch.setattr(normalize, "relative_to_repo", _relative_to_repo)
    return derivative


class TestComputeWarningId:
    def test_id_is_16_lowercase_hex(self) -> None:
        out = normalize.compute_warning_id(
            "caption-without-figure", "12", "Caption `Figure 12-1.` had no paired image."
        )
        assert len(out) == 16
        assert all(c in "0123456789abcdef" for c in out)

    def test_id_is_stable_across_calls(self) -> None:
        a = normalize.compute_warning_id("caption-without-figure", "12", "msg")
        b = normalize.compute_warning_id("caption-without-figure", "12", "msg")
        assert a == b

    def test_id_changes_with_code(self) -> None:
        a = normalize.compute_warning_id("caption-without-figure", "12", "msg")
        b = normalize.compute_warning_id("figure-without-caption", "12", "msg")
        assert a != b

    def test_id_changes_with_section_code(self) -> None:
        a = normalize.compute_warning_id("caption-without-figure", "12", "msg")
        b = normalize.compute_warning_id("caption-without-figure", "13", "msg")
        assert a != b

    def test_id_only_uses_first_50_chars_of_message(self) -> None:
        prefix = "x" * 50
        a = normalize.compute_warning_id("caption-without-figure", "12", prefix + "ABC")
        b = normalize.compute_warning_id("caption-without-figure", "12", prefix + "XYZ")
        assert a == b

    def test_id_treats_none_section_code_as_empty(self) -> None:
        a = normalize.compute_warning_id("caption-without-figure", None, "msg")
        b = normalize.compute_warning_id("caption-without-figure", "", "msg")
        assert a == b


class TestWriteOutputsWarnings:
    def test_emits_warnings_json_sibling(self, isolate_repo: Path, tmp_path: Path) -> None:
        figure_warnings = [
            FigureWarning(
                code="caption-without-figure",
                section_code="1",
                message="Caption `Figure 1-1.` on page 1-3 had no paired image.",
            ),
        ]
        table_warnings = [
            TableWarning(
                code="table-empty",
                section_code="1",
                message="Empty table detected on page 1-7.",
            ),
        ]

        summary = normalize.write_outputs(
            config=_config(),
            fetch_result=_fetch_result(tmp_path),
            outline_nodes=[_outline_node()],
            bodies=[_body()],
            figures=[],
            figure_warnings=figure_warnings,
            tables=[],
            table_warnings=table_warnings,
            extra_warnings=None,
        )

        assert summary.warnings == 2
        assert summary.warnings_path == isolate_repo / "warnings.json"
        assert summary.warnings_path.is_file()

        data = json.loads(summary.warnings_path.read_text(encoding="utf-8"))
        assert data["schema_version"] == 1
        assert data["document_slug"] == "phak"
        assert data["edition"] == "FAA-H-8083-25C"
        # manifest_sha256 matches the on-disk manifest.
        manifest_sha = hashlib.sha256(summary.manifest_path.read_bytes()).hexdigest()
        assert data["manifest_sha256"] == manifest_sha
        # Every warning has an id matching the regex enforced TS-side.
        for w in data["warnings"]:
            assert isinstance(w["id"], str)
            assert len(w["id"]) == 16
            assert all(c in "0123456789abcdef" for c in w["id"])

    def test_warnings_in_manifest_carry_ids(self, isolate_repo: Path, tmp_path: Path) -> None:
        figure_warnings = [
            FigureWarning(
                code="figure-without-caption",
                section_code="1",
                message="Image on page 1-2 (index 0) had no paired caption.",
            ),
        ]
        normalize.write_outputs(
            config=_config(),
            fetch_result=_fetch_result(tmp_path),
            outline_nodes=[_outline_node()],
            bodies=[_body()],
            figures=[],
            figure_warnings=figure_warnings,
            tables=[],
            table_warnings=[],
            extra_warnings=None,
        )
        manifest = json.loads((isolate_repo / "manifest.json").read_text(encoding="utf-8"))
        assert manifest["warnings"], "expected at least one warning on the manifest"
        for w in manifest["warnings"]:
            assert "id" in w, "every manifest warning must carry an id"
            assert len(w["id"]) == 16

    def test_extra_warnings_route_to_strategy_codes(self, isolate_repo: Path, tmp_path: Path) -> None:
        # `toc-verify: ...` prefix routes to `toc-verify`; unrecognized prefixes
        # fall back to `section-strategy`.
        extra = [
            "toc-verify: chapter 1 title='X': could not locate body page for anchor 1-1",
            "page-label: pdf_page=42 walk-back exhausted",
            "completely-novel-prefix: should fall back to section-strategy",
        ]
        normalize.write_outputs(
            config=_config(),
            fetch_result=_fetch_result(tmp_path),
            outline_nodes=[_outline_node()],
            bodies=[_body()],
            figures=[],
            figure_warnings=[],
            tables=[],
            table_warnings=[],
            extra_warnings=extra,
        )
        manifest = json.loads((isolate_repo / "manifest.json").read_text(encoding="utf-8"))
        codes = [w["code"] for w in manifest["warnings"]]
        assert "toc-verify" in codes
        assert "page-label" in codes
        assert codes.count("section-strategy") == 1

    def test_unknown_emitter_code_raises(self, isolate_repo: Path, tmp_path: Path) -> None:
        # If `figures.py` or `tables.py` ever emits a code not on
        # ALLOWED_WARNING_CODES, the writer must hard-fail rather than silently
        # producing a manifest the TS validator will reject.
        figure_warnings = [
            FigureWarning(
                code="brand-new-code-no-one-added-to-vocab",
                section_code="1",
                message="boom",
            ),
        ]
        with pytest.raises(ValueError, match="unknown warning code"):
            normalize.write_outputs(
                config=_config(),
                fetch_result=_fetch_result(tmp_path),
                outline_nodes=[_outline_node()],
                bodies=[_body()],
                figures=[],
                figure_warnings=figure_warnings,
                tables=[],
                table_warnings=[],
                extra_warnings=None,
            )

    def test_warnings_json_sorted_for_deterministic_diffs(
        self, isolate_repo: Path, tmp_path: Path
    ) -> None:
        # Warnings are written in `(code, section_code, id)` order so
        # re-running the extractor without changes produces a byte-identical
        # warnings.json.
        figure_warnings = [
            FigureWarning(
                code="figure-without-caption",
                section_code="2",
                message="Image on page 2-1 (index 0) had no paired caption.",
            ),
            FigureWarning(
                code="caption-without-figure",
                section_code="1",
                message="Caption `Figure 1-1.` on page 1-3 had no paired image.",
            ),
            FigureWarning(
                code="caption-without-figure",
                section_code="2",
                message="Caption `Figure 2-1.` on page 2-7 had no paired image.",
            ),
        ]
        node2 = OutlineNode(
            level="chapter", code="2", title="Aircraft", page_start=11, page_end=20, ordinal=2
        )
        body2 = SectionBody(
            node=node2, body_md="x", faa_page_start="2-1", faa_page_end="2-1", char_count=1
        )
        normalize.write_outputs(
            config=_config(),
            fetch_result=_fetch_result(tmp_path),
            outline_nodes=[_outline_node(), node2],
            bodies=[_body(), body2],
            figures=[],
            figure_warnings=figure_warnings,
            tables=[],
            table_warnings=[],
            extra_warnings=None,
        )
        data = json.loads((isolate_repo / "warnings.json").read_text(encoding="utf-8"))
        codes = [(w["code"], w["section_code"]) for w in data["warnings"]]
        assert codes == sorted(codes)
