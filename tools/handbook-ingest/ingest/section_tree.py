"""Shared section-tree contract for the TOC and prompt-flow strategies.

`sections_via_toc.py` (deterministic Python parser) and
`sections_via_sidecar.py` (reads the per-chapter JSON written by sub-agents
during the paste-driven prompt run) both emit a flat list of
`SectionTreeNode` records keyed off a chapter ordinal. The compare script
(`sections_compare.py`) diffs the two trees per chapter; the section
strategy resolved in `<doc>.yaml -> section_strategy` decides which list
seeds the `handbook_section` rows.

A node in the tree carries:

- `chapter_ordinal`     -- 1-indexed chapter number (e.g. 12 for "Chapter 12")
- `level`               -- 1 (top-level under chapter) | 2 (sub) | 3 (sub-sub)
- `title`               -- exact heading text from the source
- `parent_title`        -- title of the strictly shallower nearest ancestor;
                            None at level 1
- `page_anchor`         -- "12-7" style FAA-printed page reference, or None
- `ordinal`             -- within-parent sort order, 1-indexed
- `provenance`          -- "toc" | "prompt" -- which strategy produced the row
- `confidence`          -- optional 0..1 score (TOC verify Levenshtein,
                            prompt-flow currently always 1.0)

Determinism: both strategies sort the emitted list by
`(chapter_ordinal, ordinal-walk)` so re-runs produce stable diffs.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

# Strategy provenance. Kept here (not in `constants` lib) because both Python
# extractors emit it and the TS side never sees it.
STRATEGY_TOC: Literal["toc"] = "toc"
STRATEGY_PROMPT: Literal["prompt"] = "prompt"

# Code derivation. Both strategies build the deterministic dotted citation
# code from chapter_ordinal + the within-parent ordinal walk; this helper is
# the single source of truth.


@dataclass
class SectionTreeNode:
    """One row in a section/sub-section tree, before code derivation."""

    chapter_ordinal: int
    """1-indexed chapter number."""

    level: int
    """1 = top-level under chapter; 2 = sub; 3 = sub-sub."""

    title: str
    """Exact heading text as it appears in the source."""

    parent_title: str | None = None
    """Title of the nearest strictly-shallower heading; None at level 1."""

    page_anchor: str | None = None
    """FAA-printed page reference like "12-7"; None when not visible."""

    ordinal: int = 0
    """Within-parent sort order. Assigned by `derive_codes` so callers can
    leave it 0 at construction time."""

    provenance: str = ""
    """Which strategy produced this row: "toc" or "llm"."""

    confidence: float = 1.0
    """Heading-verify similarity for TOC strategy; 1.0 for LLM."""

    extra: dict[str, str] = field(default_factory=dict)
    """Strategy-private metadata (e.g. TOC raw line offset, LLM line offset)."""


def derive_codes(nodes: list[SectionTreeNode]) -> dict[int, str]:
    """Walk a tree-ordered node list and return `{node_index: dotted_code}`.

    Codes are deterministic from the order the nodes appear in `nodes` and
    their `level` fields (see module docstring for the contract):

        chapter_ordinal=12, level=1, ordinal=1 -> "12.1"
        chapter_ordinal=12, level=1, ordinal=2 -> "12.2"
        chapter_ordinal=12, level=2 (under 12.2), ordinal=1 -> "12.2.1"
        chapter_ordinal=12, level=2 (under 12.2), ordinal=2 -> "12.2.2"

    The chapter row itself is NOT in `nodes`; it lives at code = str(chapter_ordinal)
    and is emitted by the existing chapter-only outline. This function only
    derives codes for level 1+ entries beneath each chapter.

    Side effect: assigns `ordinal` on each node so the caller can persist it.
    """
    codes: dict[int, str] = {}
    # counters[level-1] tracks the within-level position relative to the
    # current parent at that level. Reset deeper counters when a shallower
    # entry advances. Indexed 0=L1, 1=L2, 2=L3.
    counters = [0, 0, 0]
    # parent_codes[depth-1] holds the dotted code prefix at that depth.
    parent_codes: list[str] = ["", "", ""]
    last_chapter: int | None = None
    for idx, node in enumerate(nodes):
        if last_chapter is None or node.chapter_ordinal != last_chapter:
            # New chapter -- reset all counters.
            counters = [0, 0, 0]
            parent_codes = [str(node.chapter_ordinal), "", ""]
            last_chapter = node.chapter_ordinal
        if node.level < 1 or node.level > 3:
            raise ValueError(f"section level out of range (1-3): {node.level} for title={node.title!r}")
        depth_idx = node.level - 1
        counters[depth_idx] += 1
        # Reset deeper counters when this level advances.
        for deeper in range(depth_idx + 1, 3):
            counters[deeper] = 0
            parent_codes[deeper] = ""
        node.ordinal = counters[depth_idx]
        # Compose dotted code from parent code + this counter.
        if depth_idx == 0:
            code = f"{node.chapter_ordinal}.{counters[0]}"
        else:
            parent_prefix = parent_codes[depth_idx - 1] or str(node.chapter_ordinal)
            code = f"{parent_prefix}.{counters[depth_idx]}"
        parent_codes[depth_idx] = code
        codes[idx] = code
    return codes
