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

from .handbooks.base import ErrataConfig, ErrataDismissal
from .paths import config_dir

# Section-tree extraction strategy selector.
#
# - `toc`              -- deterministic Python parser of the printed Table of
#                         Contents (`sections_via_toc.py`). Default for all
#                         shipped handbooks.
# - `toc-file-sidecar` -- deterministic parser of a hand-extracted TOC
#                         markdown file at `toc_file:`. Used when the
#                         embedded TOC is empty AND no chapter PDFs ship
#                         (IFH FAA-H-8083-15B is the canonical instance).
#                         Implementation: `sections_via_toc_file.py`.
# - `prompt`           -- emit a self-contained prompt set under
#                         `prompts-out/`; the user pastes the orchestrator
#                         into a fresh Claude Code session and sub-agents
#                         fan out one-per-chapter. No API key.
# - `compare`          -- read the per-chapter sidecars produced by the
#                         prompt flow, run the TOC strategy, render a
#                         markdown diff report.
SECTION_STRATEGY_TOC = "toc"
SECTION_STRATEGY_TOC_FILE_SIDECAR = "toc-file-sidecar"
SECTION_STRATEGY_PROMPT = "prompt"
SECTION_STRATEGY_COMPARE = "compare"
VALID_STRATEGIES = frozenset({
    SECTION_STRATEGY_TOC,
    SECTION_STRATEGY_TOC_FILE_SIDECAR,
    SECTION_STRATEGY_PROMPT,
    SECTION_STRATEGY_COMPARE,
})

# Outline strategies. Driven by the same YAML key that the Python ingest
# already understands (`outline_strategy:`); we expose the literal values
# here so the CLI can validate them.
#
# - `bookmark`         -- read PyMuPDF's `get_toc()`. Default.
# - `content`          -- scan body pages for FAA `<chap>-<page>` headers.
# - `toc-file-sidecar` -- read the chapter outline from a hand-extracted
#                         markdown TOC sidecar (paired with the same
#                         section strategy of the same name).
OUTLINE_STRATEGY_BOOKMARK = "bookmark"
OUTLINE_STRATEGY_CONTENT = "content"
OUTLINE_STRATEGY_TOC_FILE_SIDECAR = "toc-file-sidecar"
VALID_OUTLINE_STRATEGIES = frozenset({
    OUTLINE_STRATEGY_BOOKMARK,
    OUTLINE_STRATEGY_CONTENT,
    OUTLINE_STRATEGY_TOC_FILE_SIDECAR,
})

# How far back from a target PDF page to walk while looking for a parseable
# FAA page header before falling back to `pdf_page - page_offset`. Five pages
# clears a multi-page figure spread, a chapter summary that omits the page
# header, or the trailing glossary stub that ends a handbook.
PAGE_LABEL_WALK_BACK_DEFAULT = 5

# Allowed keys inside a `chapter_overrides[<ord>]` block. Keep this narrow so
# YAML typos fail loud (KeyError) rather than silently silencing later parser
# fixes. Each value is a printed FAA page reference verbatim, e.g. "17-100".
CHAPTER_OVERRIDE_KEYS = frozenset({"faa_page_start", "faa_page_end"})

# Allowed `primary_cert` values. Mirrors `CERT_APPLICABILITIES` in
# `libs/constants/src/reference-tags.ts`. The TS-side schema validates the
# manifest against the same list; keeping the Python set in sync at write
# time avoids producing a manifest the seeder will later reject.
PRIMARY_CERT_VALUES = frozenset(
    {
        "student",
        "sport",
        "recreational",
        "private",
        "instrument",
        "commercial",
        "cfi",
        "cfii",
        "atp",
        "all",
    }
)

# NOTE: `prompt.chapter_text_max_chars` has no module-level default.
# The value is empirical (longest chapter * 1.2, rounded up to next 25K) and
# must be set explicitly in any handbook YAML configured for
# `section_strategy: prompt`. A silent default would re-introduce the
# Phase-1 truncation bug that ate the back half of 11/17 phak chapters.
# See docs/work-packages/section-extraction-contract-v2/spec.md.
# Use tools/handbook-ingest/measure_chapter_sizes.py to size the cap.


class ConfigError(ValueError):
    """Raised when a YAML config carries an invalid or removed setting."""


@dataclass(frozen=True)
class WholeDocConfig:
    """Whole-doc PDF source (the bundled handbook PDF)."""

    url: str
    filename: str


@dataclass(frozen=True)
class AncillarySpec:
    """One ancillary PDF (front, toc, glossary, index, appendix) the publisher
    distributes alongside per-chapter PDFs."""

    kind: str
    url: str
    appendix_id: str | None = None


@dataclass(frozen=True)
class ChapterPdfsConfig:
    """Per-handbook chapter-PDF distribution. Two variants:

    - Direct pattern: `direct_pattern` is a URL template with `{N}` (chapter
      ordinal) and `{NN}` (zero-padded `N + file_ordinal_offset`).
    - Two-hop scrape: `index_url` + `chapter_page_pattern` (substring with
      `{N}`) describes the publisher's per-chapter HTML page layout; the
      scraper finds chapter pages by ordinal-prefix-match and reads the
      single .pdf link out of each.
    """

    chapter_count: int
    direct_pattern: str | None = None
    index_url: str | None = None
    chapter_page_pattern: str | None = None
    file_ordinal_offset: int = 0
    ancillary: list[AncillarySpec] = field(default_factory=list)


@dataclass(frozen=True)
class EmptySectionPolicy:
    """Per-doc empty-section remediation lists keyed by section code.

    Both fields default to empty (every empty section takes the default
    `keep-with-placeholder` path). Codes here are the dotted-decimal
    section codes (`"1.1"`, `"5.3.2"`) -- NOT chapter ordinals.

    Per WP-HANDBOOK-RE-EXTRACTION-V2 Sub-phase 1C.
    """

    merge_upward: frozenset[str] = field(default_factory=frozenset)
    """Section codes whose empty rows should be dropped from the
    section tree entirely. Emit `empty-section-merged` warning."""

    best_effort_fill: frozenset[str] = field(default_factory=frozenset)
    """Section codes whose empty rows should be filled from same-page
    orphan paragraphs. If no orphans found, fall to the default policy."""


@dataclass(frozen=True)
class HandbookConfig:
    """Static config describing a handbook + edition."""

    document_slug: str
    edition: str
    title: str
    publisher: str
    kind: str
    source_url: str
    # Library-index aviation-topic subjects (1..3 entries). Required so that
    # re-running ingest doesn't drop the field from the manifest.
    subjects: list[str] = field(default_factory=list)
    # Optional library-by-cert placement. Mirrors `referenceEntrySchema.primary_cert`
    # in `scripts/db/seed-references.ts` and the section-tree manifest schema
    # in `libs/bc/study/src/manifest-validation.ts`. The seeder forwards this
    # to `study.reference.primary_cert`; the DB CHECK constraint is the
    # storage safety net. None / null = cert-agnostic.
    primary_cert: str | None = None
    # Per chapter-source-ingestion WP: optional whole-doc descriptor (when
    # present, supersedes `source_url` for download-side use). The TS
    # downloader reads `whole_doc.url`; legacy code reads `source_url`. Both
    # must point at the same URL.
    whole_doc: WholeDocConfig | None = None
    # Optional per-chapter PDF distribution. None = Class C (whole-doc only,
    # page-range slicing for section extraction).
    chapter_pdfs: ChapterPdfsConfig | None = None
    # Operator stop-list: URL substrings to skip even if the publisher serves them.
    excluded_assets: list[str] = field(default_factory=list)
    expected_pages: int | None = None
    page_offset: int = 0
    outline_overrides: list[dict[str, object]] = field(default_factory=list)
    figure_prefix_pattern: str = r"^\s*Figure (\d+)-(\d+)\."
    table_prefix_pattern: str = r"Table (\d+)-(\d+)\."
    # `bookmark` (default) reads PyMuPDF's get_toc(); `content` falls back to
    # scanning page text for FAA-style chapter-page headers when the PDF's
    # bookmark tree is mangled (PHAK 25C is the v1 reason this exists).
    # `toc-file-sidecar` reads the chapter outline from a hand-extracted
    # markdown TOC at `toc_file:` -- used by IFH where the embedded TOC is
    # empty and no chapter PDFs ship.
    outline_strategy: str = "bookmark"
    # Optional path (relative to the repo root) to a hand-extracted TOC
    # markdown file, consumed by the `toc-file-sidecar` outline + section
    # strategies. Required when either strategy is selected; ignored
    # otherwise.
    toc_file: str | None = None
    # Optional regex applied to L1 bookmark titles when
    # `outline_strategy: bookmark`. When set, only L1 entries whose title
    # matches survive in the outline; their L2/L3 descendants ride along.
    # All other L1 entries (and their descendants) are dropped before the
    # chapter counter ticks, so chapter ordinals match the printed handbook
    # numbering. Used when a publisher's bookmark tree intermixes
    # front-matter / back-matter L1 entries (Preface, Introduction, Glossary,
    # Index, Appendix Introduction) with the chapters proper. Example for
    # RMH: `'^(Chapter \\d+|Appendix [A-Z])\\b'`. None disables the filter
    # (default), preserving the legacy "every L1 is a chapter" behavior.
    bookmark_chapter_filter: str | None = None
    # Per-chapter title corrections when the auto-detector produces a partial
    # or wrong title. Keyed by chapter number (string in YAML); applied after
    # the content scan in detect_outline_from_text.
    title_overrides: dict[str, str] = field(default_factory=dict)
    # Section-tree extraction strategy. See module-level docstring for the
    # set of valid values; default = `toc` (deterministic).
    section_strategy: str = SECTION_STRATEGY_TOC
    # Per-chapter input cap for the `prompt` strategy's plaintext sidecar.
    # Truncates from the END so the chapter head is always intact. Required
    # when `section_strategy == prompt`; ignored otherwise (None is fine).
    # No silent default -- see the module-level note above.
    chapter_text_max_chars: int | None = None
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
    # Discovery dismissal stop-list. Each entry silences a discovery
    # candidate the user reviewed and decided is not a real errata. The
    # discovery dispatcher reads this list to mark matching candidates as
    # `dismissed` across re-runs (idempotent; no GitHub issue re-open).
    dismissed_errata: list[ErrataDismissal] = field(default_factory=list)
    # Per-handbook hints surfaced to the LLM section-extraction prompt
    # (Phase 3 of section-extraction-contract-v2). Free-form strings the
    # prompt-emit flow renders verbatim into a "Handbook hints" block on
    # each per-chapter prompt. Used to capture handbook-specific quirks
    # the contract's generic difficult-cases catalog doesn't cover (e.g.
    # "PHAK ch 17 nests Vestibular Illusions under Spatial Disorientation
    # but the printed TOC flattens both"). Empty / None for handbooks
    # without observed quirks.
    extraction_hints: list[str] = field(default_factory=list)
    # Front-matter page range (1-indexed PDF page numbers, inclusive)
    # spanning the cover .. last-page-before-chapter-1. Captured per
    # WP-HANDBOOK-RE-EXTRACTION-V2 Sub-phase 1C.
    #
    # When set, the extractor emits synthetic depth-0 sections under a
    # `front-matter/` subdirectory carrying cover, preface,
    # acknowledgments, the substantive prose introduction, and (optional)
    # the verbatim FAA TOC. The pages are discriminated empirically by
    # inspecting each PDF's outline + first body page; values are
    # committed to the per-doc YAML.
    #
    # When unset / None, the extractor emits a
    # `front-matter-page-range-not-declared` warning once and skips
    # front-matter capture for that doc. The per-doc YAML is the
    # canonical authoring location.
    front_matter_page_range: tuple[int, int] | None = None
    # Empty-section policy. Per-WP Sub-phase 1C, the extractor decides
    # what to do with sections whose body has no paragraph-level prose:
    #
    # - `merge_upward[]`     -- drop the row entirely; emit
    #                            `empty-section-merged` warning. Keyed by
    #                            section CODE (e.g. `"1.1"`).
    # - `best_effort_fill[]` -- attribute orphan paragraphs from the same
    #                            PDF page; if no orphans found, fall to
    #                            the default. Keyed by section CODE.
    # - default              -- keep with placeholder + emit
    #                            `empty-section-kept` warning + tag the
    #                            section row's metadata with
    #                            `extraction_status: 'no-body-content'`.
    #
    # Empty / None means "all empty sections take the default path"
    # (keep with placeholder).
    empty_section_policy: EmptySectionPolicy = field(default_factory=lambda: EmptySectionPolicy())
    # OCR-leak detection toggle. When True (default), the writer scans every
    # section body for runs of 8+ consecutive 1-2-character tokens (the
    # IFH 2/5 phonetic-alphabet figure leak pattern), elides them, and
    # emits one `ocr-leak-in-section-body` warning per span. Set to False
    # in the YAML to disable for a doc that's known to contain legitimate
    # short-token sequences (e.g. a glossary of single-letter callsigns).
    # Per WP-HANDBOOK-RE-EXTRACTION-V2 sub-phase 1D.
    ocr_leak_detection_enabled: bool = True
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

    outline_strategy = str(raw.get("outline_strategy", OUTLINE_STRATEGY_BOOKMARK))
    if outline_strategy not in VALID_OUTLINE_STRATEGIES:
        raise ConfigError(
            f"{config_path}: unknown outline_strategy {outline_strategy!r}. "
            f"Valid: {sorted(VALID_OUTLINE_STRATEGIES)}."
        )

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
    chapter_text_max_chars_raw = prompt_raw.get("chapter_text_max_chars")
    if chapter_text_max_chars_raw is None:
        # Required for prompt-mode handbooks; optional for toc/compare since
        # the cap is unused when no per-chapter sidecar is written.
        if section_strategy == SECTION_STRATEGY_PROMPT:
            raise ConfigError(
                f"{config_path}: prompt.chapter_text_max_chars is required when "
                f"section_strategy is `prompt`. Measure with "
                f"tools/handbook-ingest/measure_chapter_sizes.py and set the cap "
                f"to longest_chapter * 1.2 rounded up to the next 25K. See "
                f"docs/work-packages/section-extraction-contract-v2/spec.md."
            )
    elif not isinstance(chapter_text_max_chars_raw, int) or chapter_text_max_chars_raw <= 0:
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
    dismissed_errata = _load_dismissed_errata_list(raw.get("dismissed_errata"), config_path)
    extraction_hints = _load_extraction_hints(raw.get("extraction_hints"), config_path)
    whole_doc = _load_whole_doc(raw.get("whole_doc"), config_path)
    chapter_pdfs = _load_chapter_pdfs(raw.get("chapter_pdfs"), config_path)
    excluded_assets_raw = raw.get("excluded_assets", [])
    if not isinstance(excluded_assets_raw, list):
        raise ConfigError(
            f"{config_path}: excluded_assets must be a list (got {type(excluded_assets_raw).__name__})."
        )

    # source_url is required by legacy callers; if the YAML omits it we fall
    # back to whole_doc.url so the migration path is safe.
    source_url = raw.get("source_url")
    if source_url is None and whole_doc is not None:
        source_url = whole_doc.url
    if source_url is None:
        raise ConfigError(f"{config_path}: must specify source_url or whole_doc.url.")

    subjects_raw = raw.get("subjects") or []
    if not isinstance(subjects_raw, list) or not all(isinstance(s, str) for s in subjects_raw):
        raise ConfigError(f"{config_path}: 'subjects' must be a list of strings.")
    if not (1 <= len(subjects_raw) <= 3):
        raise ConfigError(
            f"{config_path}: 'subjects' must contain 1..3 aviation-topic values "
            f"(got {len(subjects_raw)}). See AVIATION_TOPIC_VALUES in libs/constants."
        )

    primary_cert = _load_primary_cert(raw.get("primary_cert"), config_path)
    bookmark_chapter_filter = _load_bookmark_chapter_filter(
        raw.get("bookmark_chapter_filter"), config_path
    )

    # Optional `toc_file:` -- relative path to a hand-extracted TOC markdown.
    # Required when outline_strategy or section_strategy is `toc-file-sidecar`.
    toc_file_raw = raw.get("toc_file")
    if toc_file_raw is not None and not isinstance(toc_file_raw, str):
        raise ConfigError(
            f"{config_path}: 'toc_file' must be a string path or null "
            f"(got {type(toc_file_raw).__name__})."
        )
    needs_toc_file = (
        outline_strategy == OUTLINE_STRATEGY_TOC_FILE_SIDECAR
        or section_strategy == SECTION_STRATEGY_TOC_FILE_SIDECAR
    )
    if needs_toc_file and not (toc_file_raw and toc_file_raw.strip()):
        raise ConfigError(
            f"{config_path}: 'toc_file' is required when outline_strategy or "
            f"section_strategy is 'toc-file-sidecar'."
        )

    front_matter_page_range = _load_front_matter_page_range(
        raw.get("front_matter_page_range"), config_path
    )
    empty_section_policy = _load_empty_section_policy(
        raw.get("empty_section_policy"), config_path
    )

    return HandbookConfig(
        document_slug=raw["document_slug"],
        edition=raw["edition"],
        title=raw["title"],
        publisher=raw.get("publisher", "FAA"),
        kind=raw.get("kind", "handbook"),
        source_url=source_url,
        subjects=[str(s) for s in subjects_raw],
        primary_cert=primary_cert,
        whole_doc=whole_doc,
        chapter_pdfs=chapter_pdfs,
        excluded_assets=[str(s) for s in excluded_assets_raw],
        expected_pages=raw.get("expected_pages"),
        page_offset=raw.get("page_offset", 0),
        outline_overrides=list(raw.get("outline_overrides", [])),
        figure_prefix_pattern=raw.get("figure_prefix_pattern", r"^\s*Figure (\d+)-(\d+)\."),
        table_prefix_pattern=raw.get("table_prefix_pattern", r"Table (\d+)-(\d+)\."),
        outline_strategy=outline_strategy,
        toc_file=(toc_file_raw.strip() if isinstance(toc_file_raw, str) and toc_file_raw.strip() else None),
        bookmark_chapter_filter=bookmark_chapter_filter,
        title_overrides={str(k): str(v) for k, v in (raw.get("title_overrides") or {}).items()},
        section_strategy=section_strategy,
        chapter_text_max_chars=(
            int(chapter_text_max_chars_raw) if chapter_text_max_chars_raw is not None else None
        ),
        chapter_cover_strip_enabled=bool(cover_strip_raw.get("enabled", False)),
        chapter_cover_strip_max_lines=int(cover_strip_raw.get("max_lines", 6)),
        chapter_overrides=chapter_overrides,
        page_label_walk_back=walk_back,
        errata=errata,
        dismissed_errata=dismissed_errata,
        extraction_hints=extraction_hints,
        front_matter_page_range=front_matter_page_range,
        empty_section_policy=empty_section_policy,
        ocr_leak_detection_enabled=bool(raw.get("ocr_leak_detection_enabled", True)),
        raw_yaml=raw,
    )


def resolve_config_path(document_slug: str) -> Path:
    return config_dir() / f"{document_slug}.yaml"


_VALID_ANCILLARY_KINDS = frozenset({"front", "toc", "glossary", "index", "appendix"})


def _load_whole_doc(raw: object, config_path: Path) -> WholeDocConfig | None:
    if raw is None:
        return None
    if not isinstance(raw, dict):
        raise ConfigError(
            f"{config_path}: whole_doc must be a mapping (got {type(raw).__name__})."
        )
    url = raw.get("url")
    filename = raw.get("filename")
    if not isinstance(url, str) or not url.startswith("https://"):
        raise ConfigError(f"{config_path}: whole_doc.url must be an HTTPS URL.")
    if not isinstance(filename, str) or not filename:
        raise ConfigError(f"{config_path}: whole_doc.filename must be a non-empty string.")
    return WholeDocConfig(url=url, filename=filename)


def _load_chapter_pdfs(raw: object, config_path: Path) -> ChapterPdfsConfig | None:
    if raw is None:
        return None
    if not isinstance(raw, dict):
        raise ConfigError(
            f"{config_path}: chapter_pdfs must be a mapping (got {type(raw).__name__})."
        )
    chapter_count_raw = raw.get("chapter_count")
    if not isinstance(chapter_count_raw, int) or chapter_count_raw <= 0:
        raise ConfigError(
            f"{config_path}: chapter_pdfs.chapter_count must be a positive int "
            f"(got {chapter_count_raw!r})."
        )
    direct_pattern = raw.get("direct_pattern")
    index_url = raw.get("index_url")
    chapter_page_pattern = raw.get("chapter_page_pattern")
    if direct_pattern is not None and (index_url is not None or chapter_page_pattern is not None):
        raise ConfigError(
            f"{config_path}: chapter_pdfs cannot mix direct_pattern with index_url/chapter_page_pattern."
        )
    if direct_pattern is None and index_url is None:
        raise ConfigError(
            f"{config_path}: chapter_pdfs must specify either direct_pattern or index_url + chapter_page_pattern."
        )
    if index_url is not None and not isinstance(chapter_page_pattern, str):
        raise ConfigError(
            f"{config_path}: chapter_pdfs.chapter_page_pattern is required when index_url is set."
        )
    file_ordinal_offset_raw = raw.get("file_ordinal_offset", 0)
    if not isinstance(file_ordinal_offset_raw, int) or file_ordinal_offset_raw < 0:
        raise ConfigError(
            f"{config_path}: chapter_pdfs.file_ordinal_offset must be a non-negative int."
        )
    ancillary_raw = raw.get("ancillary", [])
    if not isinstance(ancillary_raw, list):
        raise ConfigError(
            f"{config_path}: chapter_pdfs.ancillary must be a list (got {type(ancillary_raw).__name__})."
        )
    ancillary: list[AncillarySpec] = []
    for idx, entry in enumerate(ancillary_raw):
        if not isinstance(entry, dict):
            raise ConfigError(
                f"{config_path}: chapter_pdfs.ancillary[{idx}] must be a mapping."
            )
        kind = entry.get("kind")
        if kind not in _VALID_ANCILLARY_KINDS:
            raise ConfigError(
                f"{config_path}: chapter_pdfs.ancillary[{idx}].kind={kind!r} -- "
                f"valid: {sorted(_VALID_ANCILLARY_KINDS)}."
            )
        url = entry.get("url")
        if not isinstance(url, str) or not url.startswith("https://"):
            raise ConfigError(
                f"{config_path}: chapter_pdfs.ancillary[{idx}].url must be an HTTPS URL."
            )
        appendix_id_raw = entry.get("appendix_id")
        appendix_id = str(appendix_id_raw) if appendix_id_raw is not None else None
        ancillary.append(AncillarySpec(kind=kind, url=url, appendix_id=appendix_id))
    return ChapterPdfsConfig(
        chapter_count=chapter_count_raw,
        direct_pattern=str(direct_pattern) if direct_pattern is not None else None,
        index_url=str(index_url) if index_url is not None else None,
        chapter_page_pattern=str(chapter_page_pattern) if chapter_page_pattern is not None else None,
        file_ordinal_offset=file_ordinal_offset_raw,
        ancillary=ancillary,
    )


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


_SHA256_PATTERN = re.compile(r'^[0-9a-f]{64}$')


def _load_dismissed_errata_list(raw: object, config_path: Path) -> list[ErrataDismissal]:
    """Parse and validate the YAML ``dismissed_errata:`` list.

    Each entry must specify ``url`` and/or ``sha256``; entries with neither
    are rejected (silent dismissals would be invisible from the YAML side).
    ``reason`` is a free-form note retained for audit and surfaced in the
    discovery report so future readers see why the entry was suppressed.
    """
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise ValueError(
            f"dismissed_errata in {config_path} must be a list; "
            f"got {type(raw).__name__}."
        )
    out: list[ErrataDismissal] = []
    for idx, entry in enumerate(raw):
        if not isinstance(entry, dict):
            raise ValueError(
                f"dismissed_errata[{idx}] in {config_path} must be a mapping; "
                f"got {type(entry).__name__}."
            )
        url_raw = entry.get('url')
        sha_raw = entry.get('sha256')
        url = str(url_raw) if url_raw is not None else None
        sha256 = str(sha_raw) if sha_raw is not None else None
        if url is None and sha256 is None:
            raise ValueError(
                f"dismissed_errata[{idx}] in {config_path} must specify "
                f"`url`, `sha256`, or both."
            )
        if url is not None and not url.startswith('https://'):
            raise ValueError(
                f"dismissed_errata[{idx}].url={url!r} in {config_path} "
                f"must be HTTPS."
            )
        if sha256 is not None and not _SHA256_PATTERN.match(sha256):
            raise ValueError(
                f"dismissed_errata[{idx}].sha256={sha256!r} in {config_path} "
                f"must be a hex SHA-256 (64 lowercase hex chars)."
            )
        reason = str(entry.get('reason', '')).strip()
        out.append(ErrataDismissal(url=url, sha256=sha256, reason=reason))
    return out


def _load_extraction_hints(raw: object, config_path: Path) -> list[str]:
    """Parse the YAML ``extraction_hints:`` block.

    The block is an optional list of free-form strings the prompt-emit flow
    surfaces verbatim to the LLM section-extraction sub-agents (Phase 3 of
    section-extraction-contract-v2). Used to capture handbook-specific
    quirks the contract's generic difficult-cases catalog doesn't cover.

    Empty / missing / null all produce an empty list. List entries must be
    non-empty strings; anything else hard-fails so YAML typos surface
    immediately.
    """
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise ConfigError(
            f"extraction_hints in {config_path} must be a list of strings; "
            f"got {type(raw).__name__}."
        )
    out: list[str] = []
    for idx, entry in enumerate(raw):
        if not isinstance(entry, str):
            raise ConfigError(
                f"extraction_hints[{idx}] in {config_path} must be a string; "
                f"got {type(entry).__name__}."
            )
        cleaned = entry.strip()
        if not cleaned:
            raise ConfigError(
                f"extraction_hints[{idx}] in {config_path} is empty; "
                f"omit the entry instead of leaving an empty string."
            )
        out.append(cleaned)
    return out


def _load_primary_cert(raw: object, config_path: Path) -> str | None:
    """Parse the YAML ``primary_cert:`` field.

    None / missing produces None (cert-agnostic). When set, the value must
    be one of :data:`PRIMARY_CERT_VALUES`. The TS-side schema in
    ``libs/bc/study/src/manifest-validation.ts`` re-validates against the
    same list when the manifest is consumed by the seeder; keeping the two
    in sync is part of the migration to YAML-as-source-of-truth (#390).
    """
    if raw is None:
        return None
    if not isinstance(raw, str):
        raise ConfigError(
            f"primary_cert in {config_path} must be a string or null; "
            f"got {type(raw).__name__}."
        )
    if raw not in PRIMARY_CERT_VALUES:
        raise ConfigError(
            f"primary_cert={raw!r} in {config_path} is not one of "
            f"{sorted(PRIMARY_CERT_VALUES)!r}."
        )
    return raw


_SECTION_CODE_RE = re.compile(r"^[0-9]+(?:\.[0-9]+){0,2}$")


def _load_front_matter_page_range(raw: object, config_path: Path) -> tuple[int, int] | None:
    """Parse the YAML ``front_matter_page_range:`` field.

    Expected shape: ``[start, end]`` where both are positive 1-indexed PDF
    page numbers and ``end >= start``. None / missing produces None
    (the extractor emits a `front-matter-page-range-not-declared`
    warning at run-time and skips front-matter capture).

    Per WP-HANDBOOK-RE-EXTRACTION-V2 Sub-phase 1C.
    """
    if raw is None:
        return None
    if not isinstance(raw, list) or len(raw) != 2:
        raise ConfigError(
            f"front_matter_page_range in {config_path} must be a 2-element list "
            f"[start, end] (got {raw!r})."
        )
    start_raw, end_raw = raw
    if not isinstance(start_raw, int) or not isinstance(end_raw, int):
        raise ConfigError(
            f"front_matter_page_range[start, end] in {config_path} must be ints "
            f"(got {type(start_raw).__name__}, {type(end_raw).__name__})."
        )
    if start_raw < 1:
        raise ConfigError(
            f"front_matter_page_range start={start_raw} in {config_path} must be >= 1 "
            f"(1-indexed PDF page)."
        )
    if end_raw < start_raw:
        raise ConfigError(
            f"front_matter_page_range end={end_raw} in {config_path} must be "
            f">= start={start_raw}."
        )
    return (start_raw, end_raw)


def _load_empty_section_policy(raw: object, config_path: Path) -> EmptySectionPolicy:
    """Parse the YAML ``empty_section_policy:`` block.

    Shape::

        empty_section_policy:
          merge_upward: ['1.1', '5.3']
          best_effort_fill: ['7.2']

    Both lists default to empty. Codes must be dotted-decimal section
    codes (NOT chapter ordinals). A code listed in both lists is a
    config error -- the policy must be unambiguous per code.

    Per WP-HANDBOOK-RE-EXTRACTION-V2 Sub-phase 1C.
    """
    if raw is None:
        return EmptySectionPolicy()
    if not isinstance(raw, dict):
        raise ConfigError(
            f"empty_section_policy in {config_path} must be a mapping "
            f"(got {type(raw).__name__})."
        )
    unknown = set(raw.keys()) - {"merge_upward", "best_effort_fill"}
    if unknown:
        raise ConfigError(
            f"empty_section_policy in {config_path} has unknown keys "
            f"{sorted(unknown)!r}; allowed: ['merge_upward', 'best_effort_fill']."
        )
    merge_upward = _load_section_code_list(raw.get("merge_upward"), "merge_upward", config_path)
    best_effort_fill = _load_section_code_list(
        raw.get("best_effort_fill"), "best_effort_fill", config_path
    )
    overlap = set(merge_upward) & set(best_effort_fill)
    if overlap:
        raise ConfigError(
            f"empty_section_policy in {config_path}: codes {sorted(overlap)!r} appear in "
            f"both `merge_upward` and `best_effort_fill`. Pick one policy per code."
        )
    return EmptySectionPolicy(
        merge_upward=frozenset(merge_upward),
        best_effort_fill=frozenset(best_effort_fill),
    )


def _load_section_code_list(raw: object, field_name: str, config_path: Path) -> list[str]:
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise ConfigError(
            f"empty_section_policy.{field_name} in {config_path} must be a list "
            f"(got {type(raw).__name__})."
        )
    out: list[str] = []
    seen: set[str] = set()
    for idx, item in enumerate(raw):
        if not isinstance(item, str) or not _SECTION_CODE_RE.match(item):
            raise ConfigError(
                f"empty_section_policy.{field_name}[{idx}] in {config_path} must be a "
                f"dotted-decimal section code (e.g. '1.1', '5.3.2'); got {item!r}."
            )
        if item in seen:
            raise ConfigError(
                f"empty_section_policy.{field_name} in {config_path}: code {item!r} "
                f"is listed twice."
            )
        seen.add(item)
        out.append(item)
    return out


def _load_bookmark_chapter_filter(raw: object, config_path: Path) -> str | None:
    """Parse the YAML ``bookmark_chapter_filter:`` field.

    Optional regex. None / missing disables the filter. When set, must be
    a non-empty string that compiles as a Python regex. The matcher applies
    to L1 bookmark titles in :func:`outline.parse_outline` to filter out
    front-matter / back-matter bookmarks (Preface, Glossary, Index, ...).
    """
    if raw is None:
        return None
    if not isinstance(raw, str):
        raise ConfigError(
            f"bookmark_chapter_filter in {config_path} must be a string or null; "
            f"got {type(raw).__name__}."
        )
    cleaned = raw.strip()
    if not cleaned:
        raise ConfigError(
            f"bookmark_chapter_filter in {config_path} is empty; omit the "
            f"field instead of leaving an empty string."
        )
    try:
        re.compile(cleaned)
    except re.error as exc:
        raise ConfigError(
            f"bookmark_chapter_filter in {config_path} is not a valid regex: {exc}"
        ) from exc
    return cleaned
