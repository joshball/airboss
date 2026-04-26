"""Repo-path and cache-path helpers.

Per ADR 018 (source artifact storage policy, Flavor D), source PDFs live in a
developer-local cache directory **outside the repo**, while extracted
derivatives (markdown, figures, tables, manifest.json) stay inline. This
module exposes both anchors so callers don't have to know the policy detail:

- `edition_root(...)` -> in-repo derivative tree (`handbooks/<doc>/<edition>/`)
- `cache_edition_root(...)` -> developer-local source cache
  (`$AIRBOSS_HANDBOOK_CACHE/handbooks/<doc>/<edition>/`)
"""

from __future__ import annotations

import os
from pathlib import Path

DEFAULT_CACHE_DIR = "~/Documents/airboss-handbook-cache/"
"""Default developer-local cache for source artifacts (ADR 018, Flavor D)."""

CACHE_ENV_VAR = "AIRBOSS_HANDBOOK_CACHE"
"""Environment variable that overrides the cache root."""


def repo_root() -> Path:
    """Walk upward from this file until we find the repo's `package.json`.

    The handbook-ingest tool lives at `tools/handbook-ingest/`; resolving the
    repo root from `__file__` keeps the logic stable across worktrees and
    avoids relying on the user's CWD.
    """
    here = Path(__file__).resolve()
    for parent in [here, *here.parents]:
        if (parent / "package.json").is_file() and (parent / "tools").is_dir():
            return parent
    raise RuntimeError(f"Could not locate airboss repo root from {here}")


def handbooks_root() -> Path:
    """Repo-relative path to the per-edition handbook derivative tree."""
    return repo_root() / "handbooks"


def edition_root(document_slug: str, edition: str) -> Path:
    """In-repo derivative output directory for a single (document_slug, edition)."""
    return handbooks_root() / document_slug / edition


def cache_root() -> Path:
    """Resolve the developer-local source-artifact cache root.

    Reads `$AIRBOSS_HANDBOOK_CACHE` if set; falls back to the default
    `~/Documents/airboss-handbook-cache/`. The directory is auto-created on
    first use by callers that pair this with `ensure_dir`.
    """
    raw = os.environ.get(CACHE_ENV_VAR, DEFAULT_CACHE_DIR)
    return Path(os.path.expanduser(raw)).resolve()


def cache_handbooks_root() -> Path:
    """Per-handbook subtree inside the source cache."""
    return cache_root() / "handbooks"


def cache_edition_root(document_slug: str, edition: str) -> Path:
    """Cache directory for a single (document_slug, edition) source.pdf."""
    return cache_handbooks_root() / document_slug / edition


def config_dir() -> Path:
    """Per-handbook YAML configs."""
    return Path(__file__).resolve().parent / "config"


def ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def relative_to_repo(path: Path) -> str:
    """Repo-relative POSIX path, used in manifest entries + section frontmatter."""
    return os.path.relpath(path, repo_root()).replace(os.sep, "/")
