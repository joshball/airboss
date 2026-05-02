"""Cluster-E hardening tests for ingest.http_fetch.

Verifies the Python-side parity with the TS hardening:
    - HTTPS-only scheme
    - hostname allowlist (initial URL + every redirect hop)
    - body byte cap
    - Content-Type allowlist
    - SHA-256 verification against a YAML pin
"""

from __future__ import annotations

import hashlib
import http.server
import socket
import threading
from collections.abc import Iterator
from contextlib import contextmanager

import pytest

from ingest.http_fetch import (
    DEFAULT_PDF_CONTENT_TYPES,
    FetchChecksumError,
    FetchContentTypeError,
    FetchHostError,
    FetchSchemeError,
    FetchSizeError,
    fetch_url_bytes,
)

# ---------------------------------------------------------------------------
# Tiny in-process HTTP server used by the integration-style tests below.
#
# Plain HTTP (no TLS) so we can drive the redirect / size-cap paths without
# certificate plumbing. Tests pass the server's hostname (`localhost`) into
# `allowed_hosts` and pass `allowed_scheme` is locked to https in the module
# (so tests have to provide a scheme override-via-handler-host loop). We
# work around it by patching the scheme assertion via the constants ladder:
# the no-TLS server is only used for redirect / size / content-type behavior;
# the scheme + initial-host checks are tested with mock URLs that never need
# a network round trip.
# ---------------------------------------------------------------------------


class _Handler(http.server.BaseHTTPRequestHandler):
    routes: dict[str, tuple[int, dict[str, str], bytes]] = {}

    def log_message(self, *_args, **_kwargs) -> None:  # noqa: ANN001 - signature mandated by stdlib
        return  # silence default access logging

    def do_GET(self) -> None:  # noqa: N802 - stdlib name
        spec = self.routes.get(self.path)
        if spec is None:
            self.send_response(404)
            self.end_headers()
            return
        status, headers, body = spec
        self.send_response(status)
        for k, v in headers.items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)


@contextmanager
def _serve(routes: dict[str, tuple[int, dict[str, str], bytes]]) -> Iterator[int]:
    _Handler.routes = routes
    sock = socket.socket()
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
    sock.close()
    server = http.server.HTTPServer(('127.0.0.1', port), _Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield port
    finally:
        server.shutdown()
        thread.join(timeout=2)


# ---------------------------------------------------------------------------
# Scheme + initial-host checks (no network)
# ---------------------------------------------------------------------------


def test_refuses_initial_url_with_non_https_scheme() -> None:
    with pytest.raises(FetchSchemeError, match='not allowed'):
        fetch_url_bytes('http://www.faa.gov/file.pdf')


def test_refuses_initial_url_with_disallowed_host() -> None:
    with pytest.raises(FetchHostError, match='not in the allowlist'):
        fetch_url_bytes('https://attacker.example/file.pdf')


def test_allows_initial_url_with_explicit_host_override() -> None:
    # We bypass the scheme check by NOT actually contacting the host; the
    # initial-allowlist check passes because we expand the allowlist. The
    # scheme is still https. The actual urlopen will fail (no DNS / not
    # connectable in a sandbox) -- we just verify the *guard* logic does
    # not reject the URL pre-network.
    with pytest.raises(Exception) as excinfo:
        fetch_url_bytes(
            'https://example.test/file.pdf',
            allowed_hosts=['example.test'],
            timeout_s=1,
        )
    # The error is FetchError (transport-level), NOT FetchHostError.
    assert not isinstance(excinfo.value, FetchHostError | FetchSchemeError)


# ---------------------------------------------------------------------------
# Body cap + content-type + SHA, exercised via the in-process HTTP server.
#
# The scheme guard would normally reject http://; tests pass an `_assert`
# bypass via a patched constant. To keep the public API clean we just hand
# the helper an https-flavored URL but actually serve via 127.0.0.1; we
# rely on the test relaxing scheme via direct call into `fetch_url_bytes`
# with `allowed_scheme` overridden when we add that knob below.
#
# Easier route: bypass the scheme guard for these mechanical tests by
# directly exercising the post-scheme code via a private helper. Since we
# kept `_assert_initial_url_allowed` private, we'll instead use the
# urllib-level test seam: run the server on `localhost` with a custom
# allowed-hosts list, and bypass the scheme requirement by patching the
# module constant for this single test (acceptable because we don't
# expose the patched helper outside the test boundary).
# ---------------------------------------------------------------------------


def _patch_scheme(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr('ingest.http_fetch.ALLOWED_SCHEME', 'http')


def test_caps_body_at_max_bytes(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_scheme(monkeypatch)
    payload = b'x' * 4096
    with _serve(
        {
            '/big': (
                200,
                {'Content-Type': 'application/pdf', 'Content-Length': str(len(payload))},
                payload,
            ),
        },
    ) as port:
        with pytest.raises(FetchSizeError, match='exceeds cap|exceeded'):
            fetch_url_bytes(
                f'http://localhost:{port}/big',
                allowed_hosts=['localhost'],
                allowed_content_types=DEFAULT_PDF_CONTENT_TYPES,
                max_bytes=1024,
            )


def test_rejects_unexpected_content_type(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_scheme(monkeypatch)
    with _serve(
        {'/x': (200, {'Content-Type': 'text/html; charset=utf-8'}, b'<html/>')},
    ) as port:
        with pytest.raises(FetchContentTypeError, match='unexpected Content-Type'):
            fetch_url_bytes(
                f'http://localhost:{port}/x',
                allowed_hosts=['localhost'],
                allowed_content_types=DEFAULT_PDF_CONTENT_TYPES,
            )


def test_returns_body_when_pdf_content_type_matches(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_scheme(monkeypatch)
    payload = b'%PDF-1.4 ...'
    with _serve(
        {'/p': (200, {'Content-Type': 'application/pdf'}, payload)},
    ) as port:
        result = fetch_url_bytes(
            f'http://localhost:{port}/p',
            allowed_hosts=['localhost'],
            allowed_content_types=DEFAULT_PDF_CONTENT_TYPES,
        )
        assert result.body == payload
        assert result.sha256 == hashlib.sha256(payload).hexdigest()


def test_verifies_pinned_sha256(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_scheme(monkeypatch)
    payload = b'%PDF-1.4 OK'
    sha = hashlib.sha256(payload).hexdigest()
    with _serve(
        {'/p': (200, {'Content-Type': 'application/pdf'}, payload)},
    ) as port:
        url = f'http://localhost:{port}/p'
        result = fetch_url_bytes(
            url,
            allowed_hosts=['localhost'],
            allowed_content_types=DEFAULT_PDF_CONTENT_TYPES,
            expected_sha256=sha,
        )
        assert result.sha256 == sha

        # Mismatch SHA -> raise.
        with pytest.raises(FetchChecksumError, match='SHA-256 mismatch'):
            fetch_url_bytes(
                url,
                allowed_hosts=['localhost'],
                allowed_content_types=DEFAULT_PDF_CONTENT_TYPES,
                expected_sha256='0' * 64,
            )


def test_refuses_redirect_to_disallowed_host(monkeypatch: pytest.MonkeyPatch) -> None:
    """A 302 to a host outside the allowlist is rejected by the redirect handler."""
    _patch_scheme(monkeypatch)
    # Start with an in-allowlist host; redirect to an out-of-allowlist host.
    with _serve(
        {
            '/start': (302, {'Location': 'http://attacker.example/poisoned.pdf'}, b''),
        },
    ) as port:
        with pytest.raises(FetchHostError, match='not in the allowlist'):
            fetch_url_bytes(
                f'http://localhost:{port}/start',
                allowed_hosts=['localhost'],  # NOTE: attacker.example NOT in list
                allowed_content_types=DEFAULT_PDF_CONTENT_TYPES,
            )
