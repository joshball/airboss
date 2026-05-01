"""Download + checksum the source PDF for a handbook edition.

Per ADR 021 (source cache flat naming, supersedes ADR 018's filename layout)
the source PDF lives in the developer-local cache at
`$AIRBOSS_HANDBOOK_CACHE/handbooks/<doc>/<edition>/<edition>.pdf` (default
`~/Documents/airboss-handbook-cache/...`), **not** in the repo. The repo-root
`.gitignore` blocks accidental staging; the matching `.gitattributes` LFS
filter line is dormant plumbing for the day the policy flips.

We always recompute the SHA-256 after download so the manifest reflects the
bytes on disk, not whatever the URL served when an extractor first ran. The
manifest's `source_checksum` is the audit trail.

Hardening (cluster E): the network branch flows through
:func:`ingest.http_fetch.fetch_url_bytes`, which adds:
    - 60 s timeout
    - max-redirects=5 with same-scheme (`https`) and host-allowlist enforcement
    - 250 MiB body cap
    - PDF Content-Type check
    - optional SHA-256 verification against a YAML pin (when present)
"""

from __future__ import annotations

import hashlib
import urllib.request
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from .config_loader import HandbookConfig
from .http_fetch import (
    DEFAULT_PDF_CONTENT_TYPES,
    DEFAULT_USER_AGENT,
    FetchError,
    fetch_url_bytes,
)
from .paths import cache_edition_root, ensure_dir

__all__ = ['FetchResult', 'fetch_pdf']

# Re-export so legacy callers / tests that imported `urllib.request` from this
# module keep working. New code should not rely on this; use `http_fetch`.
_ = urllib.request


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
    `$AIRBOSS_HANDBOOK_CACHE/handbooks/<doc>/<edition>/<edition>.pdf`
    (default cache root: `~/Documents/airboss-handbook-cache/`). If the file
    already exists in the cache, we re-use it (no network round trip) and
    record its current SHA-256. `force=True` re-downloads even when cached.

    The SHA-256 is computed after the bytes land so the manifest records the
    as-stored checksum.
    """
    target_dir = ensure_dir(cache_edition_root(config.document_slug, config.edition))
    target = target_dir / f"{config.edition}.pdf"
    if target.is_file() and not force:
        sha = _sha256_of(target)
        return FetchResult(
            path=target,
            url=config.source_url,
            sha256=sha,
            fetched_at=datetime.now(tz=UTC).isoformat(),
            size_bytes=target.stat().st_size,
        )

    try:
        fetched = fetch_url_bytes(
            config.source_url,
            user_agent=DEFAULT_USER_AGENT,
            allowed_content_types=DEFAULT_PDF_CONTENT_TYPES,
        )
    except FetchError as exc:
        raise FetchError(f"fetch_pdf failed for {config.document_slug}/{config.edition}: {exc}") from exc

    # Atomic write: stage into `<target>.part`, then rename. POSIX rename is
    # atomic on the same filesystem, so a SIGINT or write error leaves either
    # the prior file or no file -- never a partially-written destination.
    # Required by ADR 021.
    partial = target.with_suffix(target.suffix + ".part")
    try:
        partial.write_bytes(fetched.body)
        partial.replace(target)
    except BaseException:
        partial.unlink(missing_ok=True)
        raise


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
