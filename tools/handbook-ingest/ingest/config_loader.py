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
        raw_yaml=raw,
    )


def resolve_config_path(document_slug: str) -> Path:
    return config_dir() / f"{document_slug}.yaml"
