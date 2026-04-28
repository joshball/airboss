"""Per-handbook YAML config loader.

Each handbook has a config file at `ingest/config/<doc>.yaml` that pins the
source URL, edition tag, optional page-offset map, and optional outline
overrides for sections the FAA's PDF outline mangles.

The `errata:` list (post-WP `apply-errata-and-afh-mosaic`) is the
declarative source of truth for FAA-published amendments to a handbook
edition. Each entry names the parser layout the engine should dispatch
to. See ADR 020 for the cumulative-vs-incremental policy.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

import yaml

from .handbooks.base import ErrataConfig
from .paths import config_dir

# Section-tree extraction strategy selector.
#
# - `toc`     -- deterministic Python parser of the printed Table of Contents
#                (`sections_via_toc.py`). Default for all shipped handbooks.
# - `prompt`  -- emit a self-contained prompt set under `prompts-out/`; the
#                user pastes the orchestrator into a fresh Claude Code session
#                and sub-agents fan out one-per-chapter. No API key.
# - `compare` -- read the per-chapter sidecars produced by the prompt flow,
#                run the TOC strategy, render a markdown diff report.
SECTION_STRATEGY_TOC = "toc"
SECTION_STRATEGY_PROMPT = "prompt"
SECTION_STRATEGY_COMPARE = "compare"
VALID_STRATEGIES = frozenset({SECTION_STRATEGY_TOC, SECTION_STRATEGY_PROMPT, SECTION_STRATEGY_COMPARE})

# How far back from a target PDF page to walk while looking for a parseable
# FAA page header before falling back to `pdf_page - page_offset`. Five pages
# clears a multi-page figure spread, a chapter summary that omits the page
# header, or the trailing glossary stub that ends a handbook.
PAGE_LABEL_WALK_BACK_DEFAULT = 5

# Allowed keys inside a `chapter_overrides[<ord>]` block. Keep this narrow so
# YAML typos fail loud (KeyError) rather than silently silencing later parser
# fixes. Each value is a printed FAA page reference verbatim, e.g. "17-100".
CHAPTER_OVERRIDE_KEYS = frozenset({"faa_page_start", "faa_page_end"})

# Default for `prompt.chapter_text_max_chars`. Cap input to ~60K chars so
# every per-chapter prompt fits comfortably in a sub-agent's context budget.
DEFAULT_CHAPTER_TEXT_MAX_CHARS = 60000


class ConfigError(ValueError):
    """Raised when a YAML config carries an invalid or removed setting."""


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
    # Section-tree extraction strategy. See module-level docstring for the
    # set of valid values; default = `toc` (deterministic).
    section_strategy: str = SECTION_STRATEGY_TOC
    # Per-chapter input cap for the `prompt` strategy's plaintext sidecar.
    # Truncates from the END so the chapter head is always intact.
    chapter_text_max_chars: int = DEFAULT_CHAPTER_TEXT_MAX_CHARS
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
    # Declarative errata list. Each entry is one FAA-published amendment to
    # this edition; the apply pipeline iterates this in `published_at` order.
    # Validation rules: id is kebab-case 3-32 chars; source_url is HTTPS;
    # published_at is ISO 8601 date; parser names a registered layout.
    errata: list[ErrataConfig] = field(default_factory=list)
    # Raw YAML payload, exposed so strategy modules can read their own blocks
    # (`toc`, `heading_style`, `prompt`) without each one re-parsing the file.
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
    if section_strategy not in VALID_STRATEGIES:
        if section_strategy == "llm":
            raise ConfigError(
                f"{config_path}: section_strategy: llm has been removed. "
                f"Rename to `prompt` (no API key required). "
                f"See docs/agents/section-extraction-prompt-strategy.md."
            )
        if section_strategy == "per_chapter":
            raise ConfigError(
                f"{config_path}: section_strategy: per_chapter has been removed. "
                f"Use `toc`, `prompt`, or `compare` for the whole handbook. "
                f"See docs/agents/section-extraction-prompt-strategy.md."
            )
        raise ConfigError(
            f"{config_path}: unknown section_strategy {section_strategy!r}. "
            f"Valid: {sorted(VALID_STRATEGIES)}."
        )

    if "per_chapter_section_strategy" in raw:
        raise ConfigError(
            f"{config_path}: `per_chapter_section_strategy` has been removed. "
            f"The per-chapter strategy mix is no longer supported; pick a single "
            f"`section_strategy` for the whole handbook. Delete the field. "
            f"See docs/agents/section-extraction-prompt-strategy.md."
        )

    prompt_raw = raw.get("prompt")
    if prompt_raw is None and "llm" in raw:
        raise ConfigError(
            f"{config_path}: the `llm:` config block has been renamed to `prompt:`. "
            f"Rename the YAML key (the `chapter_text_max_chars` field is unchanged). "
            f"See docs/agents/section-extraction-prompt-strategy.md."
        )
    if prompt_raw is None:
        prompt_raw = {}
    if not isinstance(prompt_raw, dict):
        raise ConfigError(
            f"{config_path}: the `prompt:` block must be a mapping (got "
            f"{type(prompt_raw).__name__})."
        )
    chapter_text_max_chars_raw = prompt_raw.get("chapter_text_max_chars", DEFAULT_CHAPTER_TEXT_MAX_CHARS)
    if not isinstance(chapter_text_max_chars_raw, int) or chapter_text_max_chars_raw <= 0:
        raise ConfigError(
            f"{config_path}: prompt.chapter_text_max_chars must be a positive int "
            f"(got {chapter_text_max_chars_raw!r})."
        )

    chapter_overrides_raw = raw.get("chapter_overrides") or {}
    if not isinstance(chapter_overrides_raw, dict):
        raise ConfigError(
            f"chapter_overrides in {config_path} must be a mapping, got {type(chapter_overrides_raw).__name__}."
        )
    chapter_overrides: dict[int, dict[str, str]] = {}
    for k, v in chapter_overrides_raw.items():
        if not isinstance(v, dict):
            raise ConfigError(
                f"chapter_overrides[{k}] in {config_path} must be a mapping of field -> value."
            )
        unknown = set(v.keys()) - CHAPTER_OVERRIDE_KEYS
        if unknown:
            raise ConfigError(
                f"chapter_overrides[{k}] in {config_path} has unknown keys {sorted(unknown)!r}; "
                f"allowed keys: {sorted(CHAPTER_OVERRIDE_KEYS)!r}."
            )
        chapter_overrides[int(k)] = {str(kk): str(vv) for kk, vv in v.items()}

    walk_back_raw = raw.get("page_label_walk_back", PAGE_LABEL_WALK_BACK_DEFAULT)
    walk_back = int(walk_back_raw)
    if walk_back < 0:
        raise ConfigError(
            f"page_label_walk_back in {config_path} must be >= 0 (got {walk_back})."
        )

    errata = _load_errata_list(raw.get("errata"), config_path)

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
        chapter_text_max_chars=int(chapter_text_max_chars_raw),
        chapter_cover_strip_enabled=bool(cover_strip_raw.get("enabled", False)),
        chapter_cover_strip_max_lines=int(cover_strip_raw.get("max_lines", 6)),
        chapter_overrides=chapter_overrides,
        page_label_walk_back=walk_back,
        errata=errata,
        raw_yaml=raw,
    )


def resolve_config_path(document_slug: str) -> Path:
    return config_dir() / f"{document_slug}.yaml"


_ERRATA_ID_PATTERN = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
_ISO_DATE_PATTERN = re.compile(r'^\d{4}-\d{2}-\d{2}$')


def _load_errata_list(raw: object, config_path: Path) -> list[ErrataConfig]:
    """Parse and validate the YAML `errata:` list.

    Returns an empty list when the field is absent (backward-compatible
    with pre-WP YAML configs). Validates each entry per the rules in
    spec.md Validation table:

    - id: kebab-case, 3-32 chars, unique within the list
    - source_url: HTTPS
    - published_at: ISO 8601 date
    - parser: registered layout name (the membership check happens at
      apply time so this loader stays decoupled from the parser registry).
    """
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise ValueError(
            f"errata in {config_path} must be a list; got {type(raw).__name__}."
        )
    seen_ids: set[str] = set()
    out: list[ErrataConfig] = []
    for idx, entry in enumerate(raw):
        if not isinstance(entry, dict):
            raise ValueError(
                f"errata[{idx}] in {config_path} must be a mapping; got {type(entry).__name__}."
            )
        required = ('id', 'source_url', 'published_at', 'parser')
        missing = [k for k in required if k not in entry]
        if missing:
            raise ValueError(
                f"errata[{idx}] in {config_path} is missing required keys: {missing}."
            )
        eid = str(entry['id'])
        if not _ERRATA_ID_PATTERN.match(eid) or not (3 <= len(eid) <= 32):
            raise ValueError(
                f"errata[{idx}].id={eid!r} in {config_path} must be kebab-case, 3-32 chars."
            )
        if eid in seen_ids:
            raise ValueError(
                f"errata[{idx}].id={eid!r} in {config_path} duplicates an earlier entry."
            )
        seen_ids.add(eid)
        url = str(entry['source_url'])
        if not url.startswith('https://'):
            raise ValueError(
                f"errata[{idx}].source_url={url!r} in {config_path} must be HTTPS."
            )
        published_at = str(entry['published_at'])
        if not _ISO_DATE_PATTERN.match(published_at):
            raise ValueError(
                f"errata[{idx}].published_at={published_at!r} in {config_path} must be ISO 8601 date."
            )
        parser = str(entry['parser'])
        if not parser.strip():
            raise ValueError(
                f"errata[{idx}].parser in {config_path} must be a non-empty layout name."
            )
        out.append(
            ErrataConfig(
                id=eid,
                source_url=url,
                published_at=published_at,
                parser=parser,
            )
        )
    # Order by published_at so apply-pipeline iteration is deterministic.
    out.sort(key=lambda e: e.published_at)
    return out
