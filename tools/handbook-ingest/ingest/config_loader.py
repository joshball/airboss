"""Per-handbook YAML config loader.

Each handbook has a config file at `ingest/config/<doc>.yaml` that pins the
source URL, edition tag, optional page-offset map, and optional outline
overrides for sections the FAA's PDF outline mangles.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import yaml

from .paths import config_dir

# Section-tree extraction strategy selector. Drives sections_via_toc.py vs
# sections_via_llm.py vs (toc, with chapter-cover-strip applied) sections.py.
SECTION_STRATEGY_TOC = "toc"
SECTION_STRATEGY_LLM = "llm"
SECTION_STRATEGY_PER_CHAPTER = "per_chapter"
SECTION_STRATEGY_VALUES = (
    SECTION_STRATEGY_TOC,
    SECTION_STRATEGY_LLM,
    SECTION_STRATEGY_PER_CHAPTER,
)

# How far back from a target PDF page to walk while looking for a parseable
# FAA page header before falling back to `pdf_page - page_offset`. Five pages
# clears a multi-page figure spread, a chapter summary that omits the page
# header, or the trailing glossary stub that ends a handbook.
PAGE_LABEL_WALK_BACK_DEFAULT = 5

# Allowed keys inside a `chapter_overrides[<ord>]` block. Keep this narrow so
# YAML typos fail loud (KeyError) rather than silently silencing later parser
# fixes. Each value is a printed FAA page reference verbatim, e.g. "17-100".
CHAPTER_OVERRIDE_KEYS = frozenset({"faa_page_start", "faa_page_end"})


@dataclass(frozen=True)
class HandbookConfig:
    """Static config describing a handbook + edition."""

    document_slug: str
    edition: str
    title: str
    publisher: str
    kind: str
    source_url: str
    expected_pages: int | None = None
    page_offset: int = 0
    outline_overrides: list[dict[str, object]] = field(default_factory=list)
    figure_prefix_pattern: str = r"Figure (\d+)-(\d+)\."
    table_prefix_pattern: str = r"Table (\d+)-(\d+)\."
    # `bookmark` (default) reads PyMuPDF's get_toc(); `content` falls back to
    # scanning page text for FAA-style chapter-page headers when the PDF's
    # bookmark tree is mangled (PHAK 25C is the v1 reason this exists).
    outline_strategy: str = "bookmark"
    # Per-chapter title corrections when the auto-detector produces a partial
    # or wrong title. Keyed by chapter number (string in YAML); applied after
    # the content scan in detect_outline_from_text.
    title_overrides: dict[str, str] = field(default_factory=dict)
    # Section-tree extraction strategy. `toc` = Option 3 (deterministic Python),
    # `llm` = Option 4 (Claude-assisted), `per_chapter` = honor per_chapter_override.
    # Default = `toc` (deterministic). See `phak.yaml` for the per-chapter override
    # shape.
    section_strategy: str = SECTION_STRATEGY_TOC
    # Per-chapter override for `section_strategy`. Keyed by chapter ordinal
    # (string in YAML). Used when `section_strategy = per_chapter`.
    per_chapter_section_strategy: dict[int, str] = field(default_factory=dict)
    # Strip the chapter cover-page boilerplate (the "Chapter N" sentinel and
    # the title repeated above the introduction) from the chapter markdown.
    # See `normalize._strip_cover_residue` for the heuristic.
    chapter_cover_strip_enabled: bool = False
    chapter_cover_strip_max_lines: int = 6
    # Per-chapter explicit overrides for fields the parser can't recover from
    # the PDF. Keyed by chapter ordinal (int). Today only `faa_page_start` /
    # `faa_page_end` are honored. Used to short-circuit the page-label
    # walk-back when a chapter's last page lacks any parseable FAA header
    # within the walk-back window. See ADR notes / Phase 15 fix-C.
    chapter_overrides: dict[int, dict[str, str]] = field(default_factory=dict)
    # How many PDF pages to walk backward from a target page when reading the
    # printed FAA page label. 0 disables the walk-back (the legacy behavior).
    page_label_walk_back: int = PAGE_LABEL_WALK_BACK_DEFAULT
    # Raw YAML payload, exposed so strategy modules can read their own blocks
    # (`toc`, `heading_style`, `llm`) without each one re-parsing the file.
    raw_yaml: dict[str, object] = field(default_factory=dict)


def load_config(document_slug: str) -> HandbookConfig:
    config_path = config_dir() / f"{document_slug}.yaml"
    if not config_path.is_file():
        raise FileNotFoundError(
            f"Missing handbook config: {config_path}. "
            f"Author one before running ingestion for `{document_slug}`."
        )
    raw = yaml.safe_load(config_path.read_text())
    cover_strip_raw = raw.get("chapter_cover_strip") or {}
    if not isinstance(cover_strip_raw, dict):
        cover_strip_raw = {}
    section_strategy = str(raw.get("section_strategy", SECTION_STRATEGY_TOC))
    if section_strategy not in SECTION_STRATEGY_VALUES:
        raise ValueError(
            f"Invalid section_strategy {section_strategy!r} in {config_path}. "
            f"Must be one of {SECTION_STRATEGY_VALUES!r}."
        )
    per_chapter_raw = raw.get("per_chapter_section_strategy") or {}
    if not isinstance(per_chapter_raw, dict):
        per_chapter_raw = {}
    per_chapter: dict[int, str] = {}
    for k, v in per_chapter_raw.items():
        kk = int(k)
        vv = str(v)
        if vv not in (SECTION_STRATEGY_TOC, SECTION_STRATEGY_LLM):
            raise ValueError(
                f"per_chapter_section_strategy[{k}]={v!r} in {config_path} must be 'toc' or 'llm'."
            )
        per_chapter[kk] = vv

    chapter_overrides_raw = raw.get("chapter_overrides") or {}
    if not isinstance(chapter_overrides_raw, dict):
        raise ValueError(
            f"chapter_overrides in {config_path} must be a mapping, got {type(chapter_overrides_raw).__name__}."
        )
    chapter_overrides: dict[int, dict[str, str]] = {}
    for k, v in chapter_overrides_raw.items():
        if not isinstance(v, dict):
            raise ValueError(
                f"chapter_overrides[{k}] in {config_path} must be a mapping of field -> value."
            )
        unknown = set(v.keys()) - CHAPTER_OVERRIDE_KEYS
        if unknown:
            raise ValueError(
                f"chapter_overrides[{k}] in {config_path} has unknown keys {sorted(unknown)!r}; "
                f"allowed keys: {sorted(CHAPTER_OVERRIDE_KEYS)!r}."
            )
        chapter_overrides[int(k)] = {str(kk): str(vv) for kk, vv in v.items()}

    walk_back_raw = raw.get("page_label_walk_back", PAGE_LABEL_WALK_BACK_DEFAULT)
    walk_back = int(walk_back_raw)
    if walk_back < 0:
        raise ValueError(
            f"page_label_walk_back in {config_path} must be >= 0 (got {walk_back})."
        )

    return HandbookConfig(
        document_slug=raw["document_slug"],
        edition=raw["edition"],
        title=raw["title"],
        publisher=raw.get("publisher", "FAA"),
        kind=raw.get("kind", "handbook"),
        source_url=raw["source_url"],
        expected_pages=raw.get("expected_pages"),
        page_offset=raw.get("page_offset", 0),
        outline_overrides=list(raw.get("outline_overrides", [])),
        figure_prefix_pattern=raw.get("figure_prefix_pattern", r"Figure (\d+)-(\d+)\."),
        table_prefix_pattern=raw.get("table_prefix_pattern", r"Table (\d+)-(\d+)\."),
        outline_strategy=raw.get("outline_strategy", "bookmark"),
        title_overrides={str(k): str(v) for k, v in (raw.get("title_overrides") or {}).items()},
        section_strategy=section_strategy,
        per_chapter_section_strategy=per_chapter,
        chapter_cover_strip_enabled=bool(cover_strip_raw.get("enabled", False)),
        chapter_cover_strip_max_lines=int(cover_strip_raw.get("max_lines", 6)),
        chapter_overrides=chapter_overrides,
        page_label_walk_back=walk_back,
        raw_yaml=raw,
    )


def resolve_config_path(document_slug: str) -> Path:
    return config_dir() / f"{document_slug}.yaml"
