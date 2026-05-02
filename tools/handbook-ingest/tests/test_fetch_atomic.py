"""Atomicity tests for the handbook + errata PDF fetchers.

Per ADR 021 §Atomicity, every cache writer must use a tmp+rename pattern so
a SIGINT / network drop / kill mid-write never leaves a half-written PDF at
the canonical cache path. These tests stub `urllib.request.urlopen` so we
never hit the network.

Coverage:

- Happy path: a successful fetch lands at the canonical path with no
  `.part` sibling.
- Failure path: an exception mid-download removes the `.part` file before
  re-raising, leaving the canonical path absent.
"""

from __future__ import annotations

import io
from pathlib import Path
from unittest.mock import patch

import pytest

from ingest import apply_errata as apply_errata_mod
from ingest import fetch as fetch_mod
from ingest.config_loader import HandbookConfig
from ingest.handbooks.base import ErrataConfig


def _config(tmp_path: Path) -> HandbookConfig:
    return HandbookConfig(
        document_slug="testbook",
        edition="TEST-EDITION",
        title="Test Book",
        publisher="FAA",
        kind="handbook",
        source_url="https://example.invalid/test.pdf",
    )


class _FakeResponse:
    """Stub for `urllib.request.urlopen()`'s context-manager return value."""

    def __init__(self, body: bytes, *, fail_after: int | None = None) -> None:
        self._stream = io.BytesIO(body)
        self._fail_after = fail_after
        self._read_count = 0

    def __enter__(self) -> _FakeResponse:
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def read(self, n: int) -> bytes:
        self._read_count += 1
        if self._fail_after is not None and self._read_count > self._fail_after:
            raise OSError("simulated network drop")
        return self._stream.read(n)


def _patch_cache_root(tmp_path: Path):
    """Re-route the handbook cache root to a temp dir for the test."""
    return patch.dict("os.environ", {"AIRBOSS_HANDBOOK_CACHE": str(tmp_path)})


def test_fetch_pdf_success_lands_at_canonical_path_no_part_sibling(tmp_path: Path) -> None:
    """ADR 021: after a successful fetch, the .part side file must be gone."""
    config = _config(tmp_path)
    body = b"%PDF-1.4 fake bytes"

    with _patch_cache_root(tmp_path), patch(
        "urllib.request.urlopen",
        return_value=_FakeResponse(body),
    ):
        result = fetch_mod.fetch_pdf(config)

    assert result.path.is_file(), "canonical PDF must exist after success"
    assert result.path.read_bytes() == body
    part = result.path.with_name(result.path.name + ".part")
    assert not part.exists(), "ADR 021: .part side file must be renamed away"


def test_fetch_pdf_failure_removes_partial_file(tmp_path: Path) -> None:
    """A mid-download exception must clean up the .part file before propagating."""
    config = _config(tmp_path)

    # Body large enough that the read loop runs at least twice; fail on the
    # second read so the first chunk has already landed in the .part file.
    body = b"X" * (2 * 1024 * 1024)
    with _patch_cache_root(tmp_path), patch(
        "urllib.request.urlopen",
        return_value=_FakeResponse(body, fail_after=1),
    ):
        with pytest.raises(OSError, match="simulated network drop"):
            fetch_mod.fetch_pdf(config)

    # The canonical path must NOT exist (rename never ran).
    expected_target = (
        tmp_path / "handbooks" / "testbook" / "TEST-EDITION" / "TEST-EDITION.pdf"
    )
    assert not expected_target.exists(), "rename must not land a partial file"
    # The .part side file must have been cleaned up.
    part = expected_target.with_name(expected_target.name + ".part")
    assert not part.exists(), "ADR 021: .part must be removed on failure"


def test_apply_errata_download_success_no_part_sibling(tmp_path: Path) -> None:
    """ADR 021: the errata-PDF fetch path must also use tmp+rename."""
    config = _config(tmp_path)
    errata = ErrataConfig(
        id="addendum-a",
        source_url="https://example.invalid/errata-a.pdf",
        published_at="2026-04-01",
        parser="default",
    )
    body = b"%PDF-1.4 errata bytes"

    with _patch_cache_root(tmp_path), patch(
        "urllib.request.urlopen",
        return_value=_FakeResponse(body),
    ):
        target_path, sha, _fetched_at = apply_errata_mod._download_errata_pdf(
            config, errata
        )

    assert target_path.is_file()
    assert target_path.read_bytes() == body
    assert isinstance(sha, str) and len(sha) == 64
    part = target_path.with_name(target_path.name + ".part")
    assert not part.exists(), "ADR 021: .part side file must be renamed away"


def test_apply_errata_download_failure_removes_partial(tmp_path: Path) -> None:
    """A mid-download exception on the errata path must clean its .part file."""
    config = _config(tmp_path)
    errata = ErrataConfig(
        id="addendum-fail",
        source_url="https://example.invalid/errata-fail.pdf",
        published_at="2026-04-01",
        parser="default",
    )
    body = b"X" * (2 * 1024 * 1024)
    with _patch_cache_root(tmp_path), patch(
        "urllib.request.urlopen",
        return_value=_FakeResponse(body, fail_after=1),
    ):
        with pytest.raises(OSError, match="simulated network drop"):
            apply_errata_mod._download_errata_pdf(config, errata)

    expected_target = (
        tmp_path
        / "handbooks"
        / "testbook"
        / "TEST-EDITION"
        / "TEST-EDITION-errata-addendum-fail.pdf"
    )
    assert not expected_target.exists(), "rename must not land a partial file"
    part = expected_target.with_name(expected_target.name + ".part")
    assert not part.exists(), "ADR 021: .part must be removed on failure"
