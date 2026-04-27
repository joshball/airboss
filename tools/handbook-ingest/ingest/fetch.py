"""Download + checksum the source PDF for a handbook edition.

Per ADR 018 (source artifact storage policy, Flavor D) the source PDF lives in
the developer-local cache at
`$AIRBOSS_HANDBOOK_CACHE/handbooks/<doc>/<edition>/source.pdf` (default
`~/Documents/airboss-handbook-cache/...`), **not** in the repo. The repo-root
`.gitignore` blocks accidental staging; the matching `.gitattributes` LFS
filter line is dormant plumbing for the day the policy flips.

We always recompute the SHA-256 after download so the manifest reflects the
bytes on disk, not whatever the URL served when an extractor first ran. The
manifest's `source_checksum` is the audit trail.
"""

from __future__ import annotations

import hashlib
import urllib.request
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from .config_loader import HandbookConfig
from .paths import cache_edition_root, ensure_dir


@dataclass(frozen=True)
class FetchResult:
    """Records what `fetch_pdf` produced for the manifest."""

    path: Path
    url: str
    sha256: str
    fetched_at: str
    size_bytes: int


def fetch_pdf(config: HandbookConfig, *, force: bool = False) -> FetchResult:
    """Resolve / download the source PDF into the developer-local cache.

    The PDF lands at
    `$AIRBOSS_HANDBOOK_CACHE/handbooks/<doc>/<edition>/source.pdf`
    (default cache root: `~/Documents/airboss-handbook-cache/`). If the file
    already exists in the cache, we re-use it (no network round trip) and
    record its current SHA-256. `force=True` re-downloads even when cached.

    The SHA-256 is computed after the bytes land so the manifest records the
    as-stored checksum.
    """
    target_dir = ensure_dir(cache_edition_root(config.document_slug, config.edition))
    target = target_dir / "source.pdf"
    if target.is_file() and not force:
        sha = _sha256_of(target)
        return FetchResult(
            path=target,
            url=config.source_url,
            sha256=sha,
            fetched_at=datetime.now(tz=UTC).isoformat(),
            size_bytes=target.stat().st_size,
        )

    request = urllib.request.Request(config.source_url, headers={"User-Agent": "airboss-handbook-ingest/0.1"})
    with urllib.request.urlopen(request) as response, target.open("wb") as fh:
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            fh.write(chunk)
    sha = _sha256_of(target)
    return FetchResult(
        path=target,
        url=config.source_url,
        sha256=sha,
        fetched_at=datetime.now(tz=UTC).isoformat(),
        size_bytes=target.stat().st_size,
    )


def _sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        while True:
            chunk = fh.read(1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()
