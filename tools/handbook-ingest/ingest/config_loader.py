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


def load_config(document_slug: str) -> HandbookConfig:
    config_path = config_dir() / f"{document_slug}.yaml"
    if not config_path.is_file():
        raise FileNotFoundError(
            f"Missing handbook config: {config_path}. "
            f"Author one before running ingestion for `{document_slug}`."
        )
    raw = yaml.safe_load(config_path.read_text())
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
    )


def resolve_config_path(document_slug: str) -> Path:
    return config_dir() / f"{document_slug}.yaml"
