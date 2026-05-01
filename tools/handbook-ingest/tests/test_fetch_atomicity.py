"""Tests for atomic-rename behavior in `ingest.fetch.fetch_pdf`.

ADR 021 requires that the cache layout never expose a partially-written
PDF at the canonical path. The fetcher streams body bytes into a sibling
`.part` file and only renames over the canonical path after the body is
fully written. We exercise three cases:

  1. Happy path: a successful download lands at the canonical path with
     no `.part` sibling left behind.
  2. Mid-write failure: when the response stream raises mid-read, no
     canonical file exists and no `.part` sibling lingers.
  3. Existing dest replaced: when the canonical file already exists,
     `force=True` rewrites it atomically without exposing partial bytes.
"""

from __future__ import annotations

import io
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest

from ingest import paths as paths_module
from ingest.config_loader import HandbookConfig
from ingest.fetch import fetch_pdf


def _make_config() -> HandbookConfig:
    return HandbookConfig(
        document_slug="testbook",
        edition="TEST-EDITION",
        title="Test Book",
        publisher="FAA",
        kind="handbook",
        source_url="https://example.invalid/test.pdf",
    )


class _FakeResponse:
    """Minimal `urllib.request.urlopen` context-manager stand-in."""

    def __init__(self, payload: bytes) -> None:
        self._buf = io.BytesIO(payload)

    def __enter__(self) -> _FakeResponse:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def read(self, n: int = -1) -> bytes:
        return self._buf.read(n)


class _FailingResponse:
    """Reads some bytes then raises -- simulates a mid-stream network drop."""

    def __init__(self, partial: bytes) -> None:
        self._buf = io.BytesIO(partial)
        self._raised = False

    def __enter__(self) -> _FailingResponse:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def read(self, n: int = -1) -> bytes:
        if self._raised:
            raise OSError("simulated mid-stream failure")
        chunk = self._buf.read(n)
        if not chunk:
            # The buffer is drained; raise instead of returning b"" so the
            # writer never sees EOF and never falls into its rename path.
            self._raised = True
            raise OSError("simulated mid-stream failure")
        return chunk


@pytest.fixture
def patched_cache(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    """Point the cache root at a tmp directory so we can inspect writes."""
    monkeypatch.setenv("AIRBOSS_HANDBOOK_CACHE", str(tmp_path))
    # `cache_root()` reads from env each call; nothing else to patch.
    return tmp_path


def test_fetch_pdf_happy_path_leaves_no_part_sibling(patched_cache: Path) -> None:
    config = _make_config()
    payload = b"%PDF-1.7\n%%EOF\n"
    target_dir = paths_module.cache_edition_root(config.document_slug, config.edition)

    def _fake_urlopen(_request: Any, *_args: object, **_kwargs: object) -> _FakeResponse:
        return _FakeResponse(payload)

    with patch("ingest.fetch.urllib.request.urlopen", _fake_urlopen):
        result = fetch_pdf(config, force=True)

    target = target_dir / f"{config.edition}.pdf"
    assert target.is_file(), "canonical PDF must exist after a successful fetch"
    assert target.read_bytes() == payload
    assert result.size_bytes == len(payload)
    # Atomicity hygiene: no `.part` left dangling.
    part = target.with_suffix(target.suffix + ".part")
    assert not part.exists(), f"unexpected .part sibling at {part}"


def test_fetch_pdf_mid_write_failure_leaves_no_partial_dest(patched_cache: Path) -> None:
    config = _make_config()
    target_dir = paths_module.cache_edition_root(config.document_slug, config.edition)

    def _fake_urlopen(_request: Any, *_args: object, **_kwargs: object) -> _FailingResponse:
        return _FailingResponse(b"partial-bytes-")

    with patch("ingest.fetch.urllib.request.urlopen", _fake_urlopen):
        with pytest.raises(OSError, match="simulated mid-stream failure"):
            fetch_pdf(config, force=True)

    target = target_dir / f"{config.edition}.pdf"
    part = target.with_suffix(target.suffix + ".part")
    # Canonical path is absent -- no half-written PDF survives.
    assert not target.exists(), f"canonical path must NOT exist after a mid-stream failure: {target}"
    # And the `.part` sibling was unlinked by the except block.
    assert not part.exists(), f".part sibling must be cleaned up after a failure: {part}"


def test_fetch_pdf_replaces_existing_dest_atomically(patched_cache: Path) -> None:
    config = _make_config()
    target_dir = paths_module.cache_edition_root(config.document_slug, config.edition)
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / f"{config.edition}.pdf"
    target.write_bytes(b"OLD-BYTES")

    new_payload = b"%PDF-NEW\n%%EOF\n"

    def _fake_urlopen(_request: Any, *_args: object, **_kwargs: object) -> _FakeResponse:
        return _FakeResponse(new_payload)

    with patch("ingest.fetch.urllib.request.urlopen", _fake_urlopen):
        fetch_pdf(config, force=True)

    assert target.read_bytes() == new_payload
    part = target.with_suffix(target.suffix + ".part")
    assert not part.exists()
