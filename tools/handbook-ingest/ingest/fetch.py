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

Network safety lives in `_http_safety.py`: HTTPS-only assertion, host
allowlist, redirect cap, end-to-end timeout, body-size ceiling, and a
content-type sniff. `fetch_pdf` calls into the helper rather than touching
`urllib.request.urlopen` directly so future hardening lands in one place.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from ._http_safety import HttpSafetyError, fetch_to_file
from .config_loader import HandbookConfig
from .paths import cache_edition_root, ensure_dir

_USER_AGENT = "airboss-handbook-ingest/0.1"


class FetchError(Exception):
    """Raised when the safe-fetch helper rejects the operation.

    A separate exception type from :class:`HttpSafetyError` so the CLI layer
    can distinguish policy failures from genuine network errors when
    presenting the message to the operator.
    """


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

    A YAML-pinned ``sha256:`` is honoured when present on the handbook
    config: the freshly-downloaded bytes must match before the file is
    considered settled, otherwise :class:`FetchError` is raised and the
    cache file is removed (poisoned response cannot promote into the
    canonical cache name).
    """
    target_dir = ensure_dir(cache_edition_root(config.document_slug, config.edition))
    target = target_dir / f"{config.edition}.pdf"
    if target.is_file() and not force:
        sha = _sha256_of(target)
        _verify_pinned_sha(config, sha, target)
        return FetchResult(
            path=target,
            url=config.source_url,
            sha256=sha,
            fetched_at=datetime.now(tz=UTC).isoformat(),
            size_bytes=target.stat().st_size,
        )

    try:
        result = fetch_to_file(
            config.source_url,
            target,
            user_agent=_USER_AGENT,
            expected_content_types=("application/pdf",),
        )
    except HttpSafetyError as exc:
        raise FetchError(str(exc)) from exc

    sha = _sha256_of(target)
    _verify_pinned_sha(config, sha, target)
    return FetchResult(
        path=target,
        url=result.final_url,
        sha256=sha,
        fetched_at=datetime.now(tz=UTC).isoformat(),
        size_bytes=target.stat().st_size,
    )


def _verify_pinned_sha(config: HandbookConfig, computed_sha: str, target: Path) -> None:
    """If the YAML config carries a `sha256:` pin, verify it before settling.

    Mismatch surfaces as :class:`FetchError` and the on-disk file is
    removed; the operator must re-run with the correct pin or accept that
    the source has rotated. The check is a no-op when no pin is present.
    """
    pinned = getattr(config, "source_sha256", None)
    if not pinned:
        return
    if not isinstance(pinned, str) or len(pinned) != 64:
        # Defensive: an out-of-shape pin is a config error, not a safety
        # hit. Surface it clearly so the operator can fix the YAML.
        raise FetchError(
            f"handbook config carries malformed sha256 pin {pinned!r}; expected 64-char hex digest"
        )
    if pinned.lower() != computed_sha.lower():
        try:
            target.unlink()
        except FileNotFoundError:
            pass
        raise FetchError(
            f"sha256 mismatch for {target}: expected {pinned}, got {computed_sha}; cache file removed"
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
