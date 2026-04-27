"""SHA-256 figure deduplication.

The figure extraction pass walks each section's page range and emits one
`FigureRecord` (and one PNG file under `<root>/figures/`) per caption it
finds. When a single PDF page backs multiple sections (common in AvWX,
where chapter intros and their first sub-section share leading pages),
the same bytes get extracted once per referencing section and saved
under N filenames. Result: 858 figures in AvWX collapse to 290 unique
SHA-256s; the rest are byte-identical duplicates.

This module runs after `extract_figures` and before `write_outputs`:

1. Computes SHA-256 of every emitted PNG.
2. Groups records by SHA-256.
3. For each group with size > 1, picks one canonical record (deepest
   section_code first, then section_code asc, then ordinal asc). The
   canonical's PNG file stays on disk; the redundant PNGs are deleted.
   Every record in the group gets its `asset_path` rewritten to point
   at the canonical file.
4. Returns the updated record list plus a metadata dict
   `{canonicalized: <int>, freed_bytes: <int>}` for the manifest.

Markdown rewrites are not needed here because per-section markdown is
re-rendered downstream from the (now-rewritten) record list inside
`normalize.write_outputs`. The repo `handbooks/<doc>/<edition>/figures/`
tree is the only place actual file deletes happen.
"""

from __future__ import annotations

import hashlib
from dataclasses import replace
from pathlib import Path

from .figures import FigureRecord


def deduplicate_figures(records: list[FigureRecord]) -> tuple[list[FigureRecord], dict[str, int]]:
    """Collapse byte-identical PNGs to one canonical file on disk.

    `records` is mutated only via record replacement; the returned list
    contains new `FigureRecord` instances with rewritten `asset_path`
    pointing at the canonical file. Original list elements are not
    modified in place.

    Returns:
        (updated_records, metadata) where `metadata` is
        `{"canonicalized": <count of redundant files removed>,
          "freed_bytes": <total bytes freed>}`.
    """
    if not records:
        return [], {"canonicalized": 0, "freed_bytes": 0}

    # 1. Hash every existing file. Records whose asset path is missing
    #    are passed through unchanged -- they are already broken and
    #    dedup is not the place to surface that.
    sha_by_index: dict[int, str | None] = {}
    for idx, rec in enumerate(records):
        sha_by_index[idx] = _sha256_of(rec.asset_path)

    # 2. Group record indexes by SHA-256.
    groups: dict[str, list[int]] = {}
    for idx, sha in sha_by_index.items():
        if sha is None:
            continue
        groups.setdefault(sha, []).append(idx)

    canonical_index_for: dict[int, int] = {}  # idx -> canonical idx
    canonicalized = 0
    freed_bytes = 0

    for sha, indexes in groups.items():
        if len(indexes) <= 1:
            canonical_index_for[indexes[0]] = indexes[0]
            continue
        canon_idx = _pick_canonical(records, indexes)
        canon_path = records[canon_idx].asset_path
        for idx in indexes:
            canonical_index_for[idx] = canon_idx
            if idx == canon_idx:
                continue
            redundant_path = records[idx].asset_path
            if redundant_path == canon_path:
                continue
            try:
                size = redundant_path.stat().st_size
            except OSError:
                size = 0
            try:
                redundant_path.unlink()
            except FileNotFoundError:
                # Already gone -- still count it as canonicalized so the
                # manifest reflects the intent of the pass.
                pass
            freed_bytes += size
            canonicalized += 1

    # 3. Emit a fresh record list with redundant rows pointed at the
    #    canonical file (preserves caption + ordinal + section_code so
    #    seed-side counts and per-section figure ordering are stable).
    rewritten: list[FigureRecord] = []
    for idx, rec in enumerate(records):
        canon_idx = canonical_index_for.get(idx, idx)
        if canon_idx == idx:
            rewritten.append(rec)
            continue
        canon_rec = records[canon_idx]
        rewritten.append(
            replace(
                rec,
                asset_path=canon_rec.asset_path,
                width=canon_rec.width,
                height=canon_rec.height,
            )
        )

    return rewritten, {"canonicalized": canonicalized, "freed_bytes": freed_bytes}


def _sha256_of(path: Path) -> str | None:
    """SHA-256 hex digest of `path` or None when the file is unreadable."""
    try:
        with path.open("rb") as fh:
            return hashlib.sha256(fh.read()).hexdigest()
    except (FileNotFoundError, OSError):
        return None


def _pick_canonical(records: list[FigureRecord], indexes: list[int]) -> int:
    """Pick the canonical index from a duplicate group.

    Sort key: (-section_depth, section_code, ordinal, asset_path).
    Negative depth puts the deepest-anchored section first (a `5.1.2`
    record beats a `5.1` record beats a `5`); ties resolve by ascending
    section_code, then ascending ordinal, then path string for full
    determinism.
    """

    def key(idx: int) -> tuple[int, str, int, str]:
        rec = records[idx]
        depth = rec.section_code.count(".")
        return (-depth, rec.section_code, rec.ordinal, str(rec.asset_path))

    return min(indexes, key=key)
