"""Load `<slug>-overrides.yaml` sidecars during figure extraction.

Read-only consumer for the hangar `/ingest-review` queue's exported
overrides. The TS side (`scripts/ingest-review/export-overrides.ts`)
writes the sidecar; this module reads it during ``extract_figures`` so a
clean re-extract honours every manually-resolved orphan.

Sidecar shape (mirrored in
`docs/work-packages/hangar-ingest-review-queue/design.md`):

    overrides:
      - external_id: b8fa45834d84872b
        kind: handbook.caption-orphan
        action: pair
        payload:
          image_page: 82
          image_xref: 1234
          figure_id: fig-4-7-00

Per-action behavior:

  - ``handbook.caption-orphan`` ``pair``: the orphan caption is paired
    with the image at ``(image_page, image_xref)``; the image is removed
    from the orphan candidate set if it would have been listed.
  - ``handbook.caption-orphan`` ``mark-no-figure``: the caption is
    suppressed from the warnings list (intentional legend caption / sub-
    figure header).
  - ``handbook.caption-orphan`` ``mark-false-caption``: the caption is
    suppressed (regex false positive that survived the line anchor).
  - ``handbook.image-orphan`` ``pair``: the image is paired with the
    caption at ``(caption_external_id, caption_page)``.
  - ``handbook.image-orphan`` ``mark-extraneous`` / ``mark-decorative``:
    the image is suppressed from the orphan list.

This module does not WRITE anything -- it only filters / mutates the
in-memory figure + warning arrays the rest of ``figures.py`` produces.

Per the WP design (DB-first, YAML on export), the sidecar is loaded
non-fatally: a missing file or malformed YAML degrades to "no overrides
loaded" with a warning, never an exception. The pipeline keeps running.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

import yaml


CAPTION_ORPHAN_KIND = "handbook.caption-orphan"
IMAGE_ORPHAN_KIND = "handbook.image-orphan"

ACTION_PAIR = "pair"
ACTION_MARK_NO_FIGURE = "mark-no-figure"
ACTION_MARK_FALSE_CAPTION = "mark-false-caption"
ACTION_MARK_EXTRANEOUS = "mark-extraneous"
ACTION_MARK_DECORATIVE = "mark-decorative"


@dataclass(frozen=True)
class OverrideEntry:
    external_id: str
    kind: str
    action: str
    payload: dict


@dataclass
class OverridesIndex:
    """Indexed view of a sidecar's contents.

    Keyed by ``external_id`` so the figure pairing pass can look up an
    override by the warning row's id.
    """

    by_external_id: dict[str, OverrideEntry] = field(default_factory=dict)

    @property
    def is_empty(self) -> bool:
        return len(self.by_external_id) == 0

    def get(self, external_id: str) -> OverrideEntry | None:
        return self.by_external_id.get(external_id)

    def caption_orphan_overrides(self) -> Iterable[OverrideEntry]:
        for entry in self.by_external_id.values():
            if entry.kind == CAPTION_ORPHAN_KIND:
                yield entry

    def image_orphan_overrides(self) -> Iterable[OverrideEntry]:
        for entry in self.by_external_id.values():
            if entry.kind == IMAGE_ORPHAN_KIND:
                yield entry


def sidecar_path_for(repo_root: Path, slug: str) -> Path:
    """Compute the canonical sidecar path for a handbook slug."""
    return (
        repo_root
        / "scripts"
        / "sources"
        / "config"
        / "handbooks"
        / f"{slug}-overrides.yaml"
    )


def load_sidecar(path: Path) -> OverridesIndex:
    """Read and parse a sidecar. Missing or empty -> empty index.

    Malformed YAML / unknown action / unknown kind raises
    ``OverridesParseError`` so the caller can decide whether to fail
    the run or proceed without overrides.
    """
    if not path.exists():
        return OverridesIndex()
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as err:
        raise OverridesParseError(f"failed to read {path}: {err}") from err
    return parse_sidecar(text, source_path=path)


def parse_sidecar(text: str, *, source_path: Path | None = None) -> OverridesIndex:
    if not text.strip():
        return OverridesIndex()
    try:
        parsed = yaml.safe_load(text)
    except yaml.YAMLError as err:
        loc = f" at {source_path}" if source_path else ""
        raise OverridesParseError(f"malformed YAML{loc}: {err}") from err
    if parsed is None:
        return OverridesIndex()
    if not isinstance(parsed, dict):
        raise OverridesParseError("sidecar root must be a mapping")
    raw_overrides = parsed.get("overrides")
    if raw_overrides is None:
        return OverridesIndex()
    if not isinstance(raw_overrides, list):
        raise OverridesParseError("sidecar `overrides` must be a list")
    out: dict[str, OverrideEntry] = {}
    for i, raw in enumerate(raw_overrides):
        if not isinstance(raw, dict):
            raise OverridesParseError(f"overrides[{i}]: expected mapping")
        external_id = raw.get("external_id")
        kind = raw.get("kind")
        action = raw.get("action")
        payload = raw.get("payload", {}) or {}
        if not isinstance(external_id, str) or not external_id:
            raise OverridesParseError(
                f"overrides[{i}]: external_id must be a non-empty string"
            )
        if kind not in (CAPTION_ORPHAN_KIND, IMAGE_ORPHAN_KIND):
            raise OverridesParseError(
                f"overrides[{i}]: unknown kind '{kind}'"
            )
        if action not in (
            ACTION_PAIR,
            ACTION_MARK_NO_FIGURE,
            ACTION_MARK_FALSE_CAPTION,
            ACTION_MARK_EXTRANEOUS,
            ACTION_MARK_DECORATIVE,
        ):
            raise OverridesParseError(
                f"overrides[{i}]: unknown action '{action}'"
            )
        if not isinstance(payload, dict):
            raise OverridesParseError(
                f"overrides[{i}]: payload must be a mapping"
            )
        out[external_id] = OverrideEntry(
            external_id=external_id,
            kind=str(kind),
            action=str(action),
            payload=dict(payload),
        )
    return OverridesIndex(by_external_id=out)


def filter_warnings(
    warnings: list,
    overrides: OverridesIndex,
) -> tuple[list, list[OverrideEntry]]:
    """Remove warnings whose external_id has an override in the sidecar.

    Returns a tuple of (kept_warnings, applied_entries).

    The warning's external id is the warnings.json `id` field. Tests
    seed FigureWarning shims with an `id` attribute so this function
    works against both the real producer's emit and the test fixture.
    """
    if overrides.is_empty:
        return warnings, []
    kept: list = []
    applied: list[OverrideEntry] = []
    for w in warnings:
        warning_id = getattr(w, "id", None)
        if warning_id is None:
            kept.append(w)
            continue
        entry = overrides.get(warning_id)
        if entry is None:
            kept.append(w)
            continue
        applied.append(entry)
    return kept, applied


class OverridesParseError(ValueError):
    """Raised on malformed sidecar input."""

    pass
