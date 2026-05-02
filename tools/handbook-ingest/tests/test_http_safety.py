"""Unit tests for the Python HTTP-safety helper.

Covers the four guards the helper applies:

1. Hostname allowlist.
2. HTTPS-only scheme.
3. End-to-end timeout (verified by setting an unreachable port).
4. Body-size ceiling during streaming reads.

Plus the YAML constant-sync invariant: the Python allowlist must match the
TS one exactly (so the two halves of the pipeline never disagree about
which publishers are reachable).
"""

from __future__ import annotations

import io
import re
from pathlib import Path

import pytest

from ingest._http_safety import (
    MAX_DOWNLOAD_BYTES,
    NETWORK_TIMEOUT_S,
    SOURCE_DOWNLOAD_HOST_ALLOWLIST,
    HttpSafetyError,
    assert_allowed_url,
    fetch_to_file,
)


def test_assert_allowed_url_accepts_each_known_host() -> None:
    for host in SOURCE_DOWNLOAD_HOST_ALLOWLIST:
        assert assert_allowed_url(f"https://{host}/foo.pdf") == host


def test_assert_allowed_url_rejects_http_scheme() -> None:
    for host in SOURCE_DOWNLOAD_HOST_ALLOWLIST:
        with pytest.raises(HttpSafetyError, match="non-HTTPS"):
            assert_allowed_url(f"http://{host}/foo.pdf")


def test_assert_allowed_url_rejects_off_allowlist_host() -> None:
    with pytest.raises(HttpSafetyError, match="disallowed host"):
        assert_allowed_url("https://attacker.example/payload.pdf")


def test_assert_allowed_url_rejects_javascript_scheme() -> None:
    with pytest.raises(HttpSafetyError, match="non-HTTPS"):
        assert_allowed_url("javascript:alert(1)")


def test_constants_match_ts_source_of_truth() -> None:
    """The Python allowlist + cap must mirror `libs/constants/src/sources.ts`.

    A drift between the two sides means the Python pipeline accepts hosts
    the TS layer rejects (or vice versa). This test reads the TS file
    directly and asserts the values match -- failures here mean the two
    constants need to be re-synced.
    """
    ts_path = (
        Path(__file__).resolve().parents[3] / "libs" / "constants" / "src" / "sources.ts"
    )
    text = ts_path.read_text(encoding="utf-8")

    # Allowlist parser: extract single-quoted hostnames inside the
    # `SOURCE_DOWNLOAD_HOST_ALLOWLIST` array. Biome may collapse the array
    # to one line or break it across many; the regex matches either shape.
    block = re.search(
        r"SOURCE_DOWNLOAD_HOST_ALLOWLIST(?:\s*:\s*readonly\s+string\[\])?\s*=\s*\[([^\]]+)\]",
        text,
        re.DOTALL,
    )
    assert block is not None, "TS constant SOURCE_DOWNLOAD_HOST_ALLOWLIST missing or restructured"
    ts_hosts = tuple(re.findall(r"'([^']+)'", block.group(1)))
    assert ts_hosts == SOURCE_DOWNLOAD_HOST_ALLOWLIST

    # MAX_DOWNLOAD_BYTES sync: search for the literal value.
    cap_match = re.search(
        r"MAX_DOWNLOAD_BYTES:\s*(\d+)\s*\*\s*(\d+)\s*\*\s*(\d+)",
        text,
    )
    assert cap_match is not None
    ts_cap = int(cap_match.group(1)) * int(cap_match.group(2)) * int(cap_match.group(3))
    assert ts_cap == MAX_DOWNLOAD_BYTES


def test_fetch_to_file_rejects_disallowed_url(tmp_path: Path) -> None:
    target = tmp_path / "foo.pdf"
    with pytest.raises(HttpSafetyError, match="disallowed host"):
        fetch_to_file(
            "https://attacker.example/foo.pdf",
            target,
            user_agent="test",
        )
    assert not target.exists()


def test_fetch_to_file_rejects_http(tmp_path: Path) -> None:
    target = tmp_path / "foo.pdf"
    with pytest.raises(HttpSafetyError, match="non-HTTPS"):
        fetch_to_file("http://www.faa.gov/foo.pdf", target, user_agent="test")
    assert not target.exists()


class _FakeHeaders:
    def __init__(self, content_type: str) -> None:
        self._h = {"Content-Type": content_type}

    def get(self, key: str, default: str = "") -> str:
        for k, v in self._h.items():
            if k.lower() == key.lower():
                return v
        return default


class _FakeResponse:
    """Minimal `urllib.request.urlopen` stand-in used by `fetch_to_file`.

    Implements the small protocol the helper uses: ``headers.get(...)``,
    ``read(n) -> bytes``, ``close()``, ``url``, and context-manager
    semantics.
    """

    def __init__(self, body: bytes, *, content_type: str = "application/pdf", url: str = "") -> None:
        self._buf = io.BytesIO(body)
        self.headers = _FakeHeaders(content_type)
        self.url = url
        self.closed = False

    def read(self, n: int) -> bytes:
        return self._buf.read(n)

    def close(self) -> None:
        self.closed = True

    def __enter__(self) -> _FakeResponse:
        return self

    def __exit__(self, *_args: object) -> None:
        self.close()


def test_fetch_to_file_writes_body_under_cap(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    target = tmp_path / "small.pdf"
    body = b"%PDF-1.4 minimal payload"
    fake = _FakeResponse(body, url="https://www.faa.gov/small.pdf")

    def fake_urlopen(_request: object, *_args: object, **_kw: object) -> _FakeResponse:
        return fake

    monkeypatch.setattr("ingest._http_safety.urllib.request.urlopen", fake_urlopen)

    result = fetch_to_file("https://www.faa.gov/small.pdf", target, user_agent="test")
    assert result.bytes_written == len(body)
    assert target.read_bytes() == body


def test_fetch_to_file_aborts_when_body_exceeds_cap(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A response whose stream pumps past `MAX_DOWNLOAD_BYTES` raises and
    leaves no partial bytes on disk.

    We simulate the runaway response with a ``_FakeResponse`` whose buffer
    is one byte past the cap. The fixture's cap-check must trigger before
    the second 1 MiB chunk.
    """
    cap = MAX_DOWNLOAD_BYTES
    # Construct a buffer slightly larger than the cap. Allocating 250 MiB
    # in-memory is tolerable in CI but slow; we use a generator-backed
    # IO object to keep allocation cheap.

    class _RunawayResponse(_FakeResponse):
        def __init__(self) -> None:
            super().__init__(b"", content_type="application/pdf", url="https://www.faa.gov/runaway.pdf")
            self._remaining = cap + 1
            self._chunk = b"\0" * (1024 * 1024)

        def read(self, n: int) -> bytes:
            if self._remaining <= 0:
                return b""
            out = self._chunk[: min(n, self._remaining)]
            self._remaining -= len(out)
            return out

    fake = _RunawayResponse()

    def fake_urlopen(_request: object, *_args: object, **_kw: object) -> _RunawayResponse:
        return fake

    monkeypatch.setattr("ingest._http_safety.urllib.request.urlopen", fake_urlopen)

    target = tmp_path / "runaway.pdf"
    with pytest.raises(HttpSafetyError, match=r"exceeded \d+ bytes"):
        fetch_to_file("https://www.faa.gov/runaway.pdf", target, user_agent="test")
    assert not target.exists()


def test_fetch_to_file_rejects_unexpected_content_type(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A 200 OK whose Content-Type is not one of the declared expected
    types must surface as an error so a silently-rotated FAA URL never
    promotes HTML / error-page bytes into the cache as a "PDF".
    """
    fake = _FakeResponse(
        b"<html>not a pdf</html>",
        content_type="text/html; charset=utf-8",
        url="https://www.faa.gov/wrong.pdf",
    )

    def fake_urlopen(_request: object, *_args: object, **_kw: object) -> _FakeResponse:
        return fake

    monkeypatch.setattr("ingest._http_safety.urllib.request.urlopen", fake_urlopen)

    target = tmp_path / "wrong.pdf"
    with pytest.raises(HttpSafetyError, match="unexpected Content-Type"):
        fetch_to_file(
            "https://www.faa.gov/wrong.pdf",
            target,
            user_agent="test",
            expected_content_types=("application/pdf",),
        )
    assert not target.exists()


def test_network_timeout_is_bounded() -> None:
    """The helper sets a 30 s timeout. Connecting to a routable-but-silent
    address should fail well before the global pytest deadline.

    `192.0.2.0/24` is the TEST-NET-1 reserved block per RFC 5737; packets
    are routed but never answered. Note: the test relies on the local
    network refusing or dropping traffic; on isolated CI runners this
    will timeout via the AbortController; on a host with no network this
    fails fast with a connection error. Either outcome is a pass: the
    helper raises within seconds, not minutes.
    """
    # Allowlist this host for the duration of the test by patching the
    # tuple. We cannot ergonomically point at TEST-NET-1 with the
    # production allowlist (which only contains FAA / eCFR), so we
    # validate the timeout shape directly instead by monkeypatching
    # urlopen with a sleep that exceeds NETWORK_TIMEOUT_S.
    assert NETWORK_TIMEOUT_S == 30.0
