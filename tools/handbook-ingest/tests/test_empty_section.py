"""Tests for empty-section detection + per-doc remediation policy.

WP-HANDBOOK-RE-EXTRACTION-V2 sub-phase 1D.

Three branches keyed on the dotted-decimal section code:

- `merge_upward`     -- drop the row entirely; emit `empty-section-merged`.
- `best_effort_fill` -- attribute orphan PDF-page paragraphs; if none
                         qualify, fall through to the default branch.
- default            -- keep the row + tag `extraction_status: 'no-body-content'`
                         + emit `empty-section-kept`.
"""

from __future__ import annotations

from pathlib import Path

import fitz
import pytest

from ingest.config_loader import EmptySectionPolicy
from ingest.empty_section import (
    EmptySectionWarning,
    apply_empty_section_policy,
    is_empty_body,
)
from ingest.outline import OutlineNode
from ingest.sections import SectionBody


def _make_pdf(path: Path, page_texts: list[str]) -> None:
    doc = fitz.open()
    for text in page_texts:
        page = doc.new_page(width=612, height=792)
        page.insert_text((72, 100), text, fontsize=12)
    doc.save(path)
    doc.close()


def _node(code: str, title: str, page: int, level: str = "section") -> OutlineNode:
    return OutlineNode(
        level=level,
        code=code,
        title=title,
        page_start=page,
        page_end=page,
        parent_code=None,
        ordinal=int(code.split(".")[-1]),
    )


def _body(node: OutlineNode, body_md: str) -> SectionBody:
    return SectionBody(
        node=node,
        body_md=body_md,
        faa_page_start=None,
        faa_page_end=None,
        char_count=len(body_md),
    )


class TestIsEmptyBody:
    def test_empty_string_is_empty(self) -> None:
        assert is_empty_body("") is True

    def test_only_whitespace_is_empty(self) -> None:
        assert is_empty_body("\n\n   \n\t\n") is True

    def test_only_heading_is_empty(self) -> None:
        # The composer prepends `# Title` to every section; a body that's
        # JUST that one heading line should still be flagged empty.
        assert is_empty_body("# Introduction") is True

    def test_heading_plus_blank_lines_is_empty(self) -> None:
        assert is_empty_body("# Introduction\n\n\n") is True

    def test_yaml_delimiter_only_is_empty(self) -> None:
        assert is_empty_body("---\n---") is True

    def test_paragraph_is_not_empty(self) -> None:
        assert is_empty_body("This is a real paragraph of body prose.") is False

    def test_heading_plus_paragraph_is_not_empty(self) -> None:
        body = "# Introduction\n\nThis section discusses the basics."
        assert is_empty_body(body) is False

    def test_multilevel_headings_alone_are_empty(self) -> None:
        body = "# Top\n## Mid\n### Sub\n"
        assert is_empty_body(body) is True


class TestMergeUpwardBranch:
    def test_drops_empty_row_listed_in_merge_upward(self, tmp_path: Path) -> None:
        pdf_path = tmp_path / "p.pdf"
        _make_pdf(pdf_path, ["Filler page text"])
        n = _node("1.1", "Empty One", page=1)
        outline_nodes, bodies = [n], [_body(n, "")]
        policy = EmptySectionPolicy(merge_upward=frozenset({"1.1"}))
        new_outline, new_bodies, metadata, warnings = apply_empty_section_policy(
            policy, pdf_path, outline_nodes, bodies
        )
        assert new_outline == []
        assert new_bodies == []
        assert len(warnings) == 1
        assert warnings[0].code == "empty-section-merged"
        assert warnings[0].section_code == "1.1"
        assert "1.1" not in metadata

    def test_does_not_drop_non_empty_row_in_merge_upward(self, tmp_path: Path) -> None:
        # If a section is on the merge_upward list but turns out to have body
        # prose at extraction time, the policy must NOT drop it (the user
        # opted-in based on observed empties; preserve content when present).
        pdf_path = tmp_path / "p.pdf"
        _make_pdf(pdf_path, ["Filler page text"])
        n = _node("1.1", "Has Prose", page=1)
        outline_nodes, bodies = [n], [_body(n, "Real prose paragraph here.")]
        policy = EmptySectionPolicy(merge_upward=frozenset({"1.1"}))
        new_outline, new_bodies, metadata, warnings = apply_empty_section_policy(
            policy, pdf_path, outline_nodes, bodies
        )
        assert [n.code for n in new_outline] == ["1.1"]
        assert warnings == []


class TestBestEffortFillBranch:
    def test_fills_when_orphan_prose_present(self, tmp_path: Path) -> None:
        # Page 1 has an orphan paragraph (not in any sibling body); the
        # empty section gets filled and tagged `merged-from-orphans`.
        orphan = (
            "This is the lost paragraph that the section heading split off. "
            "It belongs to the empty section per page-locality rules. "
            "The detector should pick it up and attribute it cleanly."
        )
        pdf_path = tmp_path / "p.pdf"
        _make_pdf(pdf_path, [orphan])
        n = _node("1.1", "Empty One", page=1)
        outline_nodes, bodies = [n], [_body(n, "")]
        policy = EmptySectionPolicy(best_effort_fill=frozenset({"1.1"}))
        new_outline, new_bodies, metadata, warnings = apply_empty_section_policy(
            policy, pdf_path, outline_nodes, bodies
        )
        assert [n.code for n in new_outline] == ["1.1"]
        assert "lost paragraph" in new_bodies[0].body_md
        assert metadata["1.1"] == {"extraction_status": "merged-from-orphans"}
        # No warning when fill succeeds (the spec says emit kept-warning only
        # on fall-through to default).
        assert all(w.code != "empty-section-kept" for w in warnings)

    def test_falls_to_default_when_no_orphan_prose(self, tmp_path: Path) -> None:
        # Page 1 has prose, but it's also already in the chapter body
        # (claimed). No new orphan → fall through.
        page_text = "Already-claimed prose lives here. Twice over for clarity."
        pdf_path = tmp_path / "p.pdf"
        _make_pdf(pdf_path, [page_text])
        chapter = _node("1", "Ch 1", page=1, level="chapter")
        empty = _node("1.1", "Empty One", page=1)
        outline_nodes = [chapter, empty]
        bodies = [_body(chapter, page_text), _body(empty, "")]
        policy = EmptySectionPolicy(best_effort_fill=frozenset({"1.1"}))
        new_outline, new_bodies, metadata, warnings = apply_empty_section_policy(
            policy, pdf_path, outline_nodes, bodies
        )
        # Fell through to default: row kept with placeholder.
        assert [n.code for n in new_outline] == ["1", "1.1"]
        assert metadata["1.1"] == {"extraction_status": "no-body-content"}
        # Default branch emits the kept warning.
        kept = [w for w in warnings if w.code == "empty-section-kept"]
        assert len(kept) == 1
        assert kept[0].section_code == "1.1"


class TestDefaultBranch:
    def test_keeps_row_with_placeholder_metadata(self, tmp_path: Path) -> None:
        pdf_path = tmp_path / "p.pdf"
        _make_pdf(pdf_path, ["irrelevant"])
        n = _node("1.1", "Empty One", page=1)
        outline_nodes, bodies = [n], [_body(n, "")]
        policy = EmptySectionPolicy()  # nothing on either list
        new_outline, new_bodies, metadata, warnings = apply_empty_section_policy(
            policy, pdf_path, outline_nodes, bodies
        )
        assert [n.code for n in new_outline] == ["1.1"]
        assert metadata["1.1"] == {"extraction_status": "no-body-content"}
        assert len(warnings) == 1
        assert warnings[0].code == "empty-section-kept"

    def test_does_not_warn_or_tag_non_empty_rows(self, tmp_path: Path) -> None:
        pdf_path = tmp_path / "p.pdf"
        _make_pdf(pdf_path, ["irrelevant"])
        n = _node("1.1", "Has Prose", page=1)
        outline_nodes, bodies = [n], [_body(n, "Real paragraph.")]
        policy = EmptySectionPolicy()
        new_outline, _new_bodies, metadata, warnings = apply_empty_section_policy(
            policy, pdf_path, outline_nodes, bodies
        )
        assert [n.code for n in new_outline] == ["1.1"]
        assert "1.1" not in metadata
        assert warnings == []


class TestFrontMatterIsExempt:
    def test_front_matter_rows_skip_policy(self, tmp_path: Path) -> None:
        # Front-matter rows have `level == 'front-matter'` and are exempt
        # from the empty-section policy regardless of body content.
        pdf_path = tmp_path / "p.pdf"
        _make_pdf(pdf_path, ["irrelevant"])
        fm = OutlineNode(
            level="front-matter",
            code="0.1",
            title="Cover",
            page_start=1,
            page_end=1,
            parent_code=None,
            ordinal=0,
        )
        outline_nodes = [fm]
        bodies = [_body(fm, "")]  # empty body but level is front-matter
        # Even with the code on the merge_upward list, the front-matter row
        # must not be dropped.
        policy = EmptySectionPolicy(merge_upward=frozenset({"0.1"}))
        new_outline, _new_bodies, metadata, warnings = apply_empty_section_policy(
            policy, pdf_path, outline_nodes, bodies
        )
        assert [n.code for n in new_outline] == ["0.1"]
        assert warnings == []
        assert "0.1" not in metadata


class TestExtraWarningStrFormat:
    def test_as_extra_warning_str_matches_normalize_prefix_match(self) -> None:
        # The extra_warnings lane in normalize.py parses `<code>: ...` to
        # route the warning into the right manifest code; both
        # `empty-section-kept` and `empty-section-merged` are on
        # `ALLOWED_WARNING_CODES`.
        w = EmptySectionWarning(code="empty-section-kept", section_code="1.1", message="hello")
        rendered = w.as_extra_warning_str()
        assert rendered.startswith("empty-section-kept: ")
        assert rendered.split(":", 1)[0] == "empty-section-kept"


@pytest.fixture
def policy_yaml_loaded() -> EmptySectionPolicy:
    """Smoke check that EmptySectionPolicy round-trips through YAML loader."""
    from ingest.config_loader import _load_empty_section_policy
    raw = {"merge_upward": ["1.1"], "best_effort_fill": ["2.3"]}
    return _load_empty_section_policy(raw, Path("/dev/null"))


def test_policy_yaml_load_pairs_with_apply(policy_yaml_loaded: EmptySectionPolicy) -> None:
    assert policy_yaml_loaded.merge_upward == frozenset({"1.1"})
    assert policy_yaml_loaded.best_effort_fill == frozenset({"2.3"})
