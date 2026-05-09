"""Tests for the YAML-sidecar reader the figures pipeline pulls from.

The TS side (`scripts/ingest-review/export-overrides.ts`) writes the
sidecar; this module reads it. Stability + parse-error contract live
here so a future TS change that broke the round-trip would surface
either as a serializer test failure (yaml-sidecar.test.ts) or a parser
test failure (this file), not as a silent ingest regression.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pytest

from ingest.overrides_loader import (
    ACTION_MARK_NO_FIGURE,
    ACTION_PAIR,
    CAPTION_ORPHAN_KIND,
    IMAGE_ORPHAN_KIND,
    OverridesIndex,
    OverridesParseError,
    filter_warnings,
    load_sidecar,
    parse_sidecar,
    sidecar_path_for,
)


SAMPLE_YAML = """\
# Header comment.
overrides:
  - external_id: aaa111
    kind: handbook.caption-orphan
    action: pair
    payload:
      figureId: fig-1
      imagePage: 82
      imageXref: 1234
  - external_id: bbb222
    kind: handbook.caption-orphan
    action: mark-no-figure
    payload: {}
"""


def test_parse_sidecar_round_trip() -> None:
    idx = parse_sidecar(SAMPLE_YAML)
    assert not idx.is_empty
    aaa = idx.get("aaa111")
    assert aaa is not None
    assert aaa.kind == CAPTION_ORPHAN_KIND
    assert aaa.action == ACTION_PAIR
    assert aaa.payload == {"figureId": "fig-1", "imagePage": 82, "imageXref": 1234}
    bbb = idx.get("bbb222")
    assert bbb is not None
    assert bbb.action == ACTION_MARK_NO_FIGURE
    assert bbb.payload == {}


def test_parse_empty_yaml() -> None:
    assert parse_sidecar("").is_empty
    assert parse_sidecar("# only a comment\n").is_empty
    assert parse_sidecar("overrides:\n").is_empty


def test_parse_rejects_unknown_kind() -> None:
    with pytest.raises(OverridesParseError):
        parse_sidecar(
            """\
overrides:
  - external_id: x
    kind: handbook.bogus
    action: pair
    payload: {}
"""
        )


def test_parse_rejects_unknown_action() -> None:
    with pytest.raises(OverridesParseError):
        parse_sidecar(
            """\
overrides:
  - external_id: x
    kind: handbook.caption-orphan
    action: not-a-real-action
    payload: {}
"""
        )


def test_load_sidecar_missing_file_returns_empty(tmp_path: Path) -> None:
    p = tmp_path / "missing.yaml"
    assert load_sidecar(p).is_empty


def test_load_sidecar_present_file(tmp_path: Path) -> None:
    p = tmp_path / "ifh-overrides.yaml"
    p.write_text(SAMPLE_YAML, encoding="utf-8")
    assert load_sidecar(p).get("aaa111") is not None


def test_sidecar_path_for_handbook_slug() -> None:
    repo = Path("/repo")
    p = sidecar_path_for(repo, "ifh")
    assert p == repo / "scripts" / "sources" / "config" / "handbooks" / "ifh-overrides.yaml"


@dataclass
class FakeWarning:
    id: str
    code: str


def test_filter_warnings_drops_overridden_ids() -> None:
    overrides = parse_sidecar(SAMPLE_YAML)
    warnings = [
        FakeWarning(id="aaa111", code="caption-without-figure"),
        FakeWarning(id="ccc333", code="caption-without-figure"),
    ]
    kept, applied = filter_warnings(warnings, overrides)
    assert [w.id for w in kept] == ["ccc333"]
    assert [a.external_id for a in applied] == ["aaa111"]


def test_filter_warnings_no_op_for_empty_overrides() -> None:
    warnings = [FakeWarning(id="x", code="caption-without-figure")]
    kept, applied = filter_warnings(warnings, OverridesIndex())
    assert kept == warnings
    assert applied == []


def test_overrides_index_kind_filters() -> None:
    yaml_text = """\
overrides:
  - external_id: cap1
    kind: handbook.caption-orphan
    action: pair
    payload:
      figureId: fig-x
      imagePage: 1
      imageXref: 1
  - external_id: img1
    kind: handbook.image-orphan
    action: pair
    payload:
      captionExternalId: c1
      captionPage: 1
"""
    idx = parse_sidecar(yaml_text)
    cap = list(idx.caption_orphan_overrides())
    img = list(idx.image_orphan_overrides())
    assert [c.external_id for c in cap] == ["cap1"]
    assert [i.external_id for i in img] == ["img1"]
