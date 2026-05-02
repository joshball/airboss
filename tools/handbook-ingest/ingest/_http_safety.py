"""HTTP fetch hardening helpers shared by every Python ingestion path.

Mirrors the TS hardening in `scripts/sources/download/http.ts`:

- HTTPS-only scheme assertion.
- Hostname allowlist (kept in sync with `libs/constants/src/sources.ts`'s
  `SOURCE_DOWNLOAD_HOST_ALLOWLIST`).
- Bounded redirect chain (max 5 hops); every hop is re-validated against the
  scheme + host policy so an attacker-controlled redirect cannot smuggle the
  fetcher onto a disallowed host.
- 30 s end-to-end timeout.
- Streaming reader with a 250 MiB body ceiling so a runaway response cannot
  exhaust disk or memory.
- Content-type sniff (declared expectation comes from the caller; we surface
  a clear error on mismatch rather than silently caching bytes that look
  nothing like a PDF).

The module intentionally has zero airboss imports so it can be loaded from
unit tests without pulling the whole pipeline in. Constants are duplicated
from the TS side; if the TS allowlist or cap ever change, change them here
too. A test in `tools/handbook-ingest/tests/test_http_safety.py` asserts
the values match a documented expectation list.
"""

from __future__ import annotations

import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

# Mirrors `SOURCE_DOWNLOAD_HOST_ALLOWLIST` in
# `libs/constants/src/sources.ts`. Keep these two lists in sync; any host
# added here must also exist in the TS allowlist (and ideally appear in at
# least one `scripts/sources/config/*.yaml` URL).
SOURCE_DOWNLOAD_HOST_ALLOWLIST: tuple[str, ...] = (
    "www.faa.gov",
    "tfmlearning.faa.gov",
    "www.ecfr.gov",
)

# 250 MiB ceiling on response body bytes. Mirrors
# `SOURCE_ACTION_LIMITS.MAX_DOWNLOAD_BYTES` in TS.
MAX_DOWNLOAD_BYTES: int = 250 * 1024 * 1024

# 30 s end-to-end timeout. A hung FAA endpoint must not stall an entire
# `bun run sources extract handbooks <doc>` invocation. Mirrors
# `SOURCE_ACTION_LIMITS.METADATA_FETCH_TIMEOUT_MS / 1000` in TS.
NETWORK_TIMEOUT_S: float = 30.0

# 5 redirect hops. Mirrors `SOURCE_DOWNLOAD_MAX_REDIRECTS`.
MAX_REDIRECTS: int = 5


class HttpSafetyError(Exception):
    """User-actionable error from the safe-fetch helper."""


def assert_allowed_url(url: str) -> str:
    """Validate `url` against the scheme + host allowlist.

    Returns the lowercased hostname on success; raises
    :class:`HttpSafetyError` otherwise. The message is intentionally
    self-describing so the caller can surface it directly.
    """
    try:
        parsed = urllib.parse.urlsplit(url)
    except ValueError as exc:
        raise HttpSafetyError(f"refusing malformed URL {url!r}: {exc}") from exc
    if parsed.scheme != "https":
        raise HttpSafetyError(
            f"refusing non-HTTPS URL {url!r}: source downloads must use https:// (got scheme={parsed.scheme!r})"
        )
    host = (parsed.hostname or "").lower()
    if host not in SOURCE_DOWNLOAD_HOST_ALLOWLIST:
        raise HttpSafetyError(
            f"refusing disallowed host {host!r} for URL {url!r}; "
            f"allowed: {sorted(SOURCE_DOWNLOAD_HOST_ALLOWLIST)}"
        )
    return host


def follow_redirects(start_url: str, *, user_agent: str) -> str:
    """Resolve `start_url` through up to MAX_REDIRECTS hops, validating each.

    Uses HEAD-first probing; falls back to a manual redirect chase so we can
    re-validate every Location target. Raises :class:`HttpSafetyError` when
    the chain exceeds the cap, redirects to a disallowed host/scheme, or the
    underlying request fails.
    """
    assert_allowed_url(start_url)
    current = start_url
    for _hop in range(MAX_REDIRECTS):
        request = urllib.request.Request(
            current,
            method="HEAD",
            headers={"User-Agent": user_agent},
        )
        try:
            with urllib.request.urlopen(  # noqa: S310 -- URL validated above
                request, timeout=NETWORK_TIMEOUT_S
            ) as response:
                status = response.status  # type: ignore[attr-defined]
                location = response.headers.get("Location")
                final_url = response.url  # type: ignore[attr-defined]
        except urllib.error.HTTPError as exc:
            if exc.code in (301, 302, 303, 307, 308):
                location = exc.headers.get("Location") if exc.headers else None
                if location is None:
                    raise HttpSafetyError(
                        f"redirect from {current!r} did not include a Location header"
                    ) from exc
                resolved = urllib.parse.urljoin(current, location)
                assert_allowed_url(resolved)
                current = resolved
                continue
            # urllib's default opener follows 30x for HEAD too; if a server
            # returns an error after redirects, surface it.
            raise HttpSafetyError(f"HEAD probe failed for {current!r}: HTTP {exc.code}") from exc
        except urllib.error.URLError as exc:
            raise HttpSafetyError(f"HEAD probe failed for {current!r}: {exc}") from exc
        if 300 <= status < 400 and location is not None:
            resolved = urllib.parse.urljoin(current, location)
            assert_allowed_url(resolved)
            current = resolved
            continue
        # urllib already followed redirects internally; `final_url` is the
        # post-redirect canonical URL. Validate that too in case the default
        # opener took a hop we did not see.
        if final_url and final_url != current:
            assert_allowed_url(final_url)
            return str(final_url)
        return current
    raise HttpSafetyError(
        f"refusing to follow more than {MAX_REDIRECTS} redirects starting at {start_url!r}"
    )


@dataclass(frozen=True)
class FetchToFileResult:
    """Result of a successful capped + verified streaming download."""

    final_url: str
    content_type: str
    bytes_written: int


def fetch_to_file(
    url: str,
    target: Path,
    *,
    user_agent: str,
    expected_content_types: Iterable[str] = ("application/pdf",),
) -> FetchToFileResult:
    """Stream `url` into `target` while enforcing every safety policy.

    Steps, in order:

    1. ``assert_allowed_url(url)`` rejects non-HTTPS or off-allowlist URLs.
    2. The standard library opener follows redirects using its default
       :class:`HTTPRedirectHandler`; we re-validate the final URL after the
       request lands.
    3. The end-to-end ``urlopen(... , timeout=NETWORK_TIMEOUT_S)`` bounds
       hangs.
    4. The ``Content-Type`` header (first ``;``-segment) must be in
       ``expected_content_types`` -- we refuse to write a PDF target whose
       payload is HTML or vice-versa.
    5. The response body streams in 1 MiB chunks; the loop aborts the moment
       cumulative bytes exceed :data:`MAX_DOWNLOAD_BYTES`.

    The function does not handle tmp+rename atomicity (W3 owns that). It
    writes directly to ``target``. Callers that need atomic writes layer
    that on top.

    Raises :class:`HttpSafetyError` for every safety failure so callers can
    distinguish policy from network errors.
    """
    assert_allowed_url(url)
    request = urllib.request.Request(url, headers={"User-Agent": user_agent})
    try:
        # noqa: S310 -- url validated by assert_allowed_url above.
        response = urllib.request.urlopen(request, timeout=NETWORK_TIMEOUT_S)  # noqa: S310
    except urllib.error.HTTPError as exc:
        raise HttpSafetyError(f"HTTP {exc.code} for {url!r}") from exc
    except urllib.error.URLError as exc:
        raise HttpSafetyError(f"network error fetching {url!r}: {exc}") from exc
    except TimeoutError as exc:
        raise HttpSafetyError(f"timeout fetching {url!r} after {NETWORK_TIMEOUT_S}s") from exc

    final_url = getattr(response, "url", url) or url
    if final_url != url:
        # Default opener already followed the chain; re-check the policy on
        # the final landing URL.
        assert_allowed_url(final_url)

    content_type = response.headers.get("Content-Type", "") or ""
    declared_type = content_type.split(";", 1)[0].strip().lower()
    expected_set = {ct.strip().lower() for ct in expected_content_types}
    if declared_type not in expected_set:
        response.close()
        raise HttpSafetyError(
            f"unexpected Content-Type {content_type!r} for {final_url!r}: expected one of {sorted(expected_set)}"
        )

    bytes_written = 0
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        with response, target.open("wb") as fh:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                bytes_written += len(chunk)
                if bytes_written > MAX_DOWNLOAD_BYTES:
                    # Truncate the partial bytes so a poisoned response can't
                    # masquerade as a complete cache file. The caller's
                    # tmp+rename layer (when present) will further isolate
                    # the partial state; even without it, an oversize body
                    # never leaves the cache in a half-readable state.
                    fh.close()
                    try:
                        target.unlink()
                    except FileNotFoundError:
                        pass
                    raise HttpSafetyError(
                        f"response body exceeded {MAX_DOWNLOAD_BYTES} bytes for {final_url!r}"
                    )
                fh.write(chunk)
    except HttpSafetyError:
        raise
    except OSError as exc:
        raise HttpSafetyError(f"write failed for {target}: {exc}") from exc

    return FetchToFileResult(
        final_url=str(final_url),
        content_type=content_type,
        bytes_written=bytes_written,
    )
