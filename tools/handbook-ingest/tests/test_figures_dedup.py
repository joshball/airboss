"""Unit tests for SHA-256 figure deduplication.

Coverage:

- Three byte-identical PNGs at different paths -> one canonical file
  on disk, three records all pointing at the canonical path, dedup
  metadata reports two canonicalized + accurate freed_bytes.
- Records whose bytes differ stay distinct; metadata reports zero
  dedup activity.
- Canonical pick prefers the deepest section_code (a `5.1.2` record
  wins over a `5.1` record wins over a `5`).
- Empty input returns empty output and zero metadata.
"""

from __future__ import annotations

from pathlib import Path

from ingest.figures import FigureRecord
from ingest.figures_dedup import deduplicate_figures


def _write_png(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)


def _record(asset_path: Path, *, section_code: str, ordinal: int) -> FigureRecord:
    return FigureRecord(
        section_code=section_code,
        ordinal=ordinal,
        caption=f"Figure {section_code}-{ordinal}. test",
        asset_path=asset_path,
        width=100,
        height=80,
    )


def test_three_identical_pngs_collapse_to_one_canonical(tmp_path: Path) -> None:
    """Three identical PNGs at different paths -> one canonical, three records all
    pointing at the canonical asset_path. Two PNGs deleted; freed_bytes accurate."""
    payload = b"\x89PNG\r\n\x1a\n" + b"identical-bytes" * 32
    a = tmp_path / "fig-5-00-a.png"
    b = tmp_path / "fig-5-1-00-b.png"
    c = tmp_path / "fig-5-1-2-00-c.png"
    for p in (a, b, c):
        _write_png(p, payload)
    redundant_size = a.stat().st_size

    records = [
        _record(a, section_code="5", ordinal=0),
        _record(b, section_code="5.1", ordinal=0),
        _record(c, section_code="5.1.2", ordinal=0),
    ]

    out, meta = deduplicate_figures(records)

    # Canonical is the deepest section (5.1.2 -> path c).
    assert all(r.asset_path == c for r in out)
    # Two redundant files removed from disk; canonical kept.
    assert not a.exists()
    assert not b.exists()
    assert c.exists()
    assert meta == {"canonicalized": 2, "freed_bytes": redundant_size * 2}


def test_distinct_bytes_pass_through_unchanged(tmp_path: Path) -> None:
    a = tmp_path / "fig-5-00-a.png"
    b = tmp_path / "fig-5-1-00-b.png"
    _write_png(a, b"\x89PNG-distinct-A" * 16)
    _write_png(b, b"\x89PNG-distinct-B" * 16)

    records = [
        _record(a, section_code="5", ordinal=0),
        _record(b, section_code="5.1", ordinal=0),
    ]

    out, meta = deduplicate_figures(records)

    assert [r.asset_path for r in out] == [a, b]
    assert a.exists()
    assert b.exists()
    assert meta == {"canonicalized": 0, "freed_bytes": 0}


def test_canonical_prefers_deeper_section_then_lex_order(tmp_path: Path) -> None:
    """Tie-breaking: depth desc, then section_code asc, then ordinal asc."""
    payload = b"\x89PNG-shared" * 64
    shallow_5 = tmp_path / "shallow.png"
    shallow_6 = tmp_path / "shallow-6.png"
    deeper_5_2 = tmp_path / "deeper-5-2.png"
    deeper_5_1 = tmp_path / "deeper-5-1.png"
    for p in (shallow_5, shallow_6, deeper_5_2, deeper_5_1):
        _write_png(p, payload)

    records = [
        _record(shallow_5, section_code="5", ordinal=0),
        _record(shallow_6, section_code="6", ordinal=0),
        _record(deeper_5_2, section_code="5.2", ordinal=0),
        _record(deeper_5_1, section_code="5.1", ordinal=0),
    ]

    out, meta = deduplicate_figures(records)

    # Canonical: deepest depth first; both 5.1 and 5.2 are depth 1, but
    # 5.1 sorts before 5.2 lexicographically -> 5.1 wins.
    assert all(r.asset_path == deeper_5_1 for r in out)
    assert deeper_5_1.exists()
    assert not shallow_5.exists()
    assert not shallow_6.exists()
    assert not deeper_5_2.exists()
    assert meta["canonicalized"] == 3


def test_empty_input_returns_empty_metadata() -> None:
    out, meta = deduplicate_figures([])
    assert out == []
    assert meta == {"canonicalized": 0, "freed_bytes": 0}
