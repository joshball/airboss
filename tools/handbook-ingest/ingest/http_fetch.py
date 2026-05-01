"""Hardened HTTP fetch helper for handbook ingest.

Cluster-E hardening (parity with the TS path in `scripts/sources/download/`):

- Connection / read timeout (60 s) so a hung FAA endpoint cannot stall the
  whole ingest run.
- Bounded redirect chain (max 5 hops). Every hop is checked: scheme must be
  ``https``, host must be in :data:`ALLOWED_HOSTS`. A 302 to a non-FAA host
  or to plain HTTP raises immediately.
- Body byte cap (250 MiB by default; matches
  ``SOURCE_ACTION_LIMITS.MAX_DOWNLOAD_BYTES`` in ``libs/constants/src/sources.ts``).
  Streams chunk-by-chunk and aborts the moment the running byte count
  exceeds the cap.
- Optional Content-Type allowlist (default: PDF) so the publisher silently
  serving HTML in place of a PDF fails loudly.
- Optional SHA-256 verification against a YAML-pinned digest. Verification
  happens BEFORE the bytes land on disk, so a poisoned redirect / DNS attack
  cannot pollute the cache with the wrong document.

Callers:
    - :func:`ingest.fetch.fetch_pdf`
    - :func:`ingest.apply_errata._download_errata_pdf`

The actual file-write is left to the caller; this module returns the bytes
(and optional verified SHA) so downstream code can apply its own atomic-write
strategy (tmp + ``os.replace``).
"""

from __future__ import annotations

import hashlib
from collections.abc import Iterable
from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from urllib.response import addinfourl

# ---------------------------------------------------------------------------
# Hardening knobs
# ---------------------------------------------------------------------------

#: Wall-clock cap for the whole fetch. Matches NETWORK_TIMEOUT_MS / 2 on the
#: TS side so Python timeouts are not visibly different from TS timeouts.
NETWORK_TIMEOUT_S = 60

#: Hard cap on a single response body. 250 MiB matches
#: ``SOURCE_ACTION_LIMITS.MAX_DOWNLOAD_BYTES`` in ``libs/constants/src/sources.ts``.
#: Adjust both constants together.
MAX_DOWNLOAD_BYTES = 250 * 1024 * 1024

#: Allowed scheme on every redirect hop.
ALLOWED_SCHEME = 'https'

#: Hostname allowlist on every redirect hop. Mirrors
#: ``SOURCE_FETCH_ALLOWED_HOSTS`` in ``libs/constants/src/sources.ts``.
#: Add a host here only when a new YAML config introduces a new upstream.
ALLOWED_HOSTS: frozenset[str] = frozenset({'www.faa.gov', 'www.ecfr.gov'})

#: Maximum redirect hops we will follow.
MAX_REDIRECTS = 5

#: Read-loop chunk size (1 MiB; same as the prior implementation).
READ_CHUNK_SIZE = 1024 * 1024

#: Default User-Agent. Advertises the tool honestly.
DEFAULT_USER_AGENT = 'airboss-handbook-ingest/0.1'

#: Default content-type allowlist for `fetch_url_bytes`. Caller can override.
DEFAULT_PDF_CONTENT_TYPES: frozenset[str] = frozenset({'application/pdf', 'application/x-pdf'})


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------


class FetchError(Exception):
    """Raised when the fetch fails any hardening check or transport step."""


class FetchSchemeError(FetchError):
    """Raised when a redirect hop has a non-HTTPS scheme."""


class FetchHostError(FetchError):
    """Raised when a redirect hop lands on a non-allowlisted host."""


class FetchSizeError(FetchError):
    """Raised when the response body would exceed `max_bytes`."""


class FetchContentTypeError(FetchError):
    """Raised when the response Content-Type is not in the allowlist."""


class FetchChecksumError(FetchError):
    """Raised when the downloaded SHA-256 disagrees with the pinned value."""


# ---------------------------------------------------------------------------
# Same-host / scheme-checking redirect handler
# ---------------------------------------------------------------------------


class _RestrictedRedirectHandler(HTTPRedirectHandler):
    """Override urllib's default redirect handler to enforce our allowlist.

    The default handler follows up to 30 redirects with no scheme / host
    check; we cap at :data:`MAX_REDIRECTS` and reject any hop that:

    - is not ``https``
    - lands on a host not in :data:`ALLOWED_HOSTS`
    """

    max_redirections = MAX_REDIRECTS

    def __init__(self, allowed_hosts: Iterable[str]) -> None:
        super().__init__()
        self._allowed_hosts = frozenset(allowed_hosts)

    def redirect_request(  # type: ignore[override]
        self,
        req: Request,
        fp: addinfourl,
        code: int,
        msg: str,
        headers,  # noqa: ANN001 - urllib types this loosely
        newurl: str,
    ) -> Request | None:
        new_split = urlsplit(newurl)
        if new_split.scheme.lower() != ALLOWED_SCHEME:
            raise FetchSchemeError(
                f"refused redirect: {new_split.scheme!r} is not allowed (only {ALLOWED_SCHEME!r}) "
                f"at {newurl} from {req.full_url}"
            )
        host = new_split.hostname or ''
        if host not in self._allowed_hosts:
            raise FetchHostError(
                f"refused redirect: host {host!r} is not in the allowlist "
                f"{sorted(self._allowed_hosts)} at {newurl} from {req.full_url}"
            )
        return super().redirect_request(req, fp, code, msg, headers, newurl)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class FetchedBody:
    """Result of a hardened fetch: bytes + observed metadata."""

    body: bytes
    final_url: str
    sha256: str
    content_type: str | None


def fetch_url_bytes(
    url: str,
    *,
    user_agent: str = DEFAULT_USER_AGENT,
    expected_sha256: str | None = None,
    allowed_content_types: Iterable[str] | None = None,
    max_bytes: int = MAX_DOWNLOAD_BYTES,
    timeout_s: int = NETWORK_TIMEOUT_S,
    allowed_hosts: Iterable[str] = ALLOWED_HOSTS,
) -> FetchedBody:
    """Fetch ``url`` and return the bytes after applying every hardening check.

    Hardening order (fail fast):

    1. Initial URL scheme must be ``https``; host must be in ``allowed_hosts``.
    2. Each redirect hop checked the same way (via the redirect handler).
    3. Wall-clock timeout = ``timeout_s``.
    4. Response Content-Length (if reported) must not exceed ``max_bytes``.
    5. Response body streamed in :data:`READ_CHUNK_SIZE` chunks; abort the
       moment the running total exceeds ``max_bytes``.
    6. Response Content-Type (if ``allowed_content_types`` is set) must be in
       the allowlist.
    7. SHA-256 of the body computed; if ``expected_sha256`` is provided, it
       must match.

    Returns the body bytes plus observed metadata. The caller writes the
    bytes to disk however it sees fit (this module deliberately does not
    own the on-disk path so the tmp+rename atomicity step can live in the
    caller, per the W3 / W-cluster-E split).
    """

    _assert_initial_url_allowed(url, allowed_hosts)

    request = Request(url, headers={'User-Agent': user_agent})
    opener = build_opener(_RestrictedRedirectHandler(allowed_hosts))

    try:
        response = opener.open(request, timeout=timeout_s)
    except (HTTPError, URLError) as exc:
        raise FetchError(f"fetch failed for {url}: {exc}") from exc

    final_url = response.geturl()
    content_type = response.headers.get('Content-Type')

    declared_length = response.headers.get('Content-Length')
    if declared_length is not None:
        try:
            declared = int(declared_length)
        except ValueError:
            declared = -1
        if declared >= 0 and declared > max_bytes:
            response.close()
            raise FetchSizeError(
                f"refusing to download {url}: Content-Length {declared} exceeds cap {max_bytes}"
            )

    chunks: list[bytes] = []
    received = 0
    hasher = hashlib.sha256()

    try:
        while True:
            chunk = response.read(READ_CHUNK_SIZE)
            if not chunk:
                break
            received += len(chunk)
            if received > max_bytes:
                raise FetchSizeError(
                    f"download body exceeded {max_bytes} bytes for {url}; aborting"
                )
            hasher.update(chunk)
            chunks.append(chunk)
    finally:
        response.close()

    if allowed_content_types is not None:
        ct_set = frozenset(c.lower() for c in allowed_content_types)
        ct_main = (content_type or '').split(';')[0].strip().lower()
        if ct_main not in ct_set:
            raise FetchContentTypeError(
                f"unexpected Content-Type {content_type!r} for {final_url}; "
                f"expected one of {sorted(ct_set)}"
            )

    body = b''.join(chunks)
    sha = hasher.hexdigest()

    if expected_sha256 is not None and sha.lower() != expected_sha256.lower():
        raise FetchChecksumError(
            f"SHA-256 mismatch for {final_url}: got {sha}, expected {expected_sha256}"
        )

    return FetchedBody(body=body, final_url=final_url, sha256=sha, content_type=content_type)


def _assert_initial_url_allowed(url: str, allowed_hosts: Iterable[str]) -> None:
    parts = urlsplit(url)
    if parts.scheme.lower() != ALLOWED_SCHEME:
        raise FetchSchemeError(
            f"refused fetch: {parts.scheme!r} is not allowed (only {ALLOWED_SCHEME!r}) for {url}"
        )
    host = parts.hostname or ''
    allowed = frozenset(allowed_hosts)
    if host not in allowed:
        raise FetchHostError(
            f"refused fetch: host {host!r} is not in the allowlist {sorted(allowed)} for {url}"
        )
