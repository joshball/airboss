"""Tests for atomic-rename behavior in `ingest.fetch.fetch_pdf`.

ADR 021 requires that the cache layout never expose a partially-written
PDF at the canonical path. The fetcher streams body bytes into a sibling
`.part` file and only renames over the canonical path after the body is
fully written. We exercise three cases:

  1. Happy path: a successful download lands at the canonical path with
     no `.part` sibling left behind.
  2. Mid-write failure: when the on-disk write raises mid-stream, no
     canonical file exists and no `.part` sibling lingers.
  3. Existing dest replaced: when the canonical file already exists,
     `force=True` rewrites it atomically without exposing partial bytes.

These tests target the atomic file-write logic specifically; HTTP-layer
behavior (allowlists, redirects, content-type, sha pin, byte cap) lives
in `test_http_fetch.py`. We patch `ingest.fetch.fetch_url_bytes` so the
network stack is never engaged.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from ingest import paths as paths_module
from ingest.config_loader import HandbookConfig
from ingest.fetch import fetch_pdf
from ingest.http_fetch import FetchedBody


def _make_config() -> HandbookConfig:
    return HandbookConfig(
        document_slug="testbook",
        edition="TEST-EDITION",
        title="Test Book",
        publisher="FAA",
        kind="handbook",
        source_url="https://www.faa.gov/test.pdf",
    )


@pytest.fixture
def patched_cache(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    """Point the cache root at a tmp directory so we can inspect writes."""
    monkeypatch.setenv("AIRBOSS_HANDBOOK_CACHE", str(tmp_path))
    # `cache_root()` reads from env each call; nothing else to patch.
    return tmp_path


def _stub_fetch(payload: bytes) -> object:
    """Build a `fetch_url_bytes` stub that returns `payload` without I/O."""

    def _fake(url: str, **_kwargs: object) -> FetchedBody:
        return FetchedBody(body=payload, final_url=url, sha256='', content_type='application/pdf')

    return _fake


def test_fetch_pdf_happy_path_leaves_no_part_sibling(
    monkeypatch: pytest.MonkeyPatch, patched_cache: Path
) -> None:
    config = _make_config()
    payload = b"%PDF-1.7\n%%EOF\n"
    target_dir = paths_module.cache_edition_root(config.document_slug, config.edition)

    monkeypatch.setattr('ingest.fetch.fetch_url_bytes', _stub_fetch(payload))
    result = fetch_pdf(config, force=True)

    target = target_dir / f"{config.edition}.pdf"
    assert target.is_file(), "canonical PDF must exist after a successful fetch"
    assert target.read_bytes() == payload
    assert result.size_bytes == len(payload)
    # Atomicity hygiene: no `.part` left dangling.
    part = target.with_suffix(target.suffix + ".part")
    assert not part.exists(), f"unexpected .part sibling at {part}"


def test_fetch_pdf_mid_write_failure_leaves_no_partial_dest(
    monkeypatch: pytest.MonkeyPatch, patched_cache: Path
) -> None:
    """Simulate a disk-write failure during the staged write of `.part`.

    `fetch_pdf` is contractually responsible for cleaning up `<target>.part`
    when the staged write fails; the canonical path must not exist either.
    We force `Path.write_bytes` to raise on the partial path while letting
    every other Path call through.
    """
    config = _make_config()
    target_dir = paths_module.cache_edition_root(config.document_slug, config.edition)
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / f"{config.edition}.pdf"
    part = target.with_suffix(target.suffix + ".part")

    monkeypatch.setattr('ingest.fetch.fetch_url_bytes', _stub_fetch(b"partial-bytes-"))

    real_write_bytes = Path.write_bytes

    def _raising_write_bytes(self: Path, data: bytes) -> int:
        if self == part:
            raise OSError("simulated mid-stream failure")
        return real_write_bytes(self, data)

    monkeypatch.setattr(Path, 'write_bytes', _raising_write_bytes)

    with pytest.raises(OSError, match="simulated mid-stream failure"):
        fetch_pdf(config, force=True)

    # Canonical path is absent -- no half-written PDF survives.
    assert not target.exists(), f"canonical path must NOT exist after a mid-stream failure: {target}"
    # And the `.part` sibling was unlinked by the except block.
    assert not part.exists(), f".part sibling must be cleaned up after a failure: {part}"


def test_fetch_pdf_replaces_existing_dest_atomically(
    monkeypatch: pytest.MonkeyPatch, patched_cache: Path
) -> None:
    config = _make_config()
    target_dir = paths_module.cache_edition_root(config.document_slug, config.edition)
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / f"{config.edition}.pdf"
    target.write_bytes(b"OLD-BYTES")

    new_payload = b"%PDF-NEW\n%%EOF\n"
    monkeypatch.setattr('ingest.fetch.fetch_url_bytes', _stub_fetch(new_payload))

    fetch_pdf(config, force=True)

    assert target.read_bytes() == new_payload
    part = target.with_suffix(target.suffix + ".part")
    assert not part.exists()
