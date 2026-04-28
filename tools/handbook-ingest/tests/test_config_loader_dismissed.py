"""Round-trip tests for the YAML `dismissed_errata:` list.

The dismissal list backs the discovery dispatcher's stop-list (WP
`apply-errata-and-afh-mosaic` phase R7). A single line in YAML must
silence a candidate across re-runs without needing additional state.
"""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from ingest.config_loader import _load_dismissed_errata_list, load_config
from ingest.handbooks.base import ErrataDismissal


def _write_yaml(tmp_path: Path, body: dict) -> Path:
    path = tmp_path / 'fixture.yaml'
    path.write_text(yaml.safe_dump(body), encoding='utf-8')
    return path


def test_dismissed_field_round_trips_with_url() -> None:
    raw = [
        {
            'url': 'https://www.faa.gov/some/path/false-positive.pdf',
            'reason': 'press release, not an errata',
        }
    ]
    out = _load_dismissed_errata_list(raw, Path('test.yaml'))
    assert out == [
        ErrataDismissal(
            url='https://www.faa.gov/some/path/false-positive.pdf',
            sha256=None,
            reason='press release, not an errata',
        )
    ]


def test_dismissed_field_round_trips_with_sha256() -> None:
    sha = 'a' * 64
    raw = [{'sha256': sha, 'reason': 'matches a known unrelated artifact'}]
    out = _load_dismissed_errata_list(raw, Path('test.yaml'))
    assert out == [ErrataDismissal(url=None, sha256=sha, reason='matches a known unrelated artifact')]


def test_dismissed_field_round_trips_with_both() -> None:
    sha = 'b' * 64
    raw = [{'url': 'https://www.faa.gov/x.pdf', 'sha256': sha, 'reason': ''}]
    out = _load_dismissed_errata_list(raw, Path('test.yaml'))
    assert out == [
        ErrataDismissal(url='https://www.faa.gov/x.pdf', sha256=sha, reason='')
    ]


def test_dismissed_field_rejects_entry_with_neither_url_nor_sha256() -> None:
    with pytest.raises(ValueError, match='must specify'):
        _load_dismissed_errata_list([{'reason': 'no anchor'}], Path('test.yaml'))


def test_dismissed_field_rejects_non_https_url() -> None:
    with pytest.raises(ValueError, match='HTTPS'):
        _load_dismissed_errata_list(
            [{'url': 'http://example.com/x.pdf'}], Path('test.yaml')
        )


def test_dismissed_field_rejects_malformed_sha256() -> None:
    with pytest.raises(ValueError, match='SHA-256'):
        _load_dismissed_errata_list([{'sha256': 'not-a-hash'}], Path('test.yaml'))


def test_dismissed_field_rejects_non_list_root() -> None:
    with pytest.raises(ValueError, match='must be a list'):
        _load_dismissed_errata_list({'url': 'https://x'}, Path('test.yaml'))


def test_dismissed_field_absent_returns_empty_list() -> None:
    assert _load_dismissed_errata_list(None, Path('test.yaml')) == []


def test_full_config_round_trips_dismissed_field(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """End-to-end: load_config picks up dismissed_errata when present."""
    body = {
        'document_slug': 'phak',
        'edition': 'FAA-H-8083-25C',
        'title': 'PHAK',
        'kind': 'handbook',
        'source_url': 'https://www.faa.gov/x.pdf',
        'dismissed_errata': [
            {
                'url': 'https://www.faa.gov/sites/x/y/false-positive.pdf',
                'reason': 'unrelated press release',
            }
        ],
    }
    fixture_dir = tmp_path / 'config'
    fixture_dir.mkdir()
    (fixture_dir / 'phak.yaml').write_text(yaml.safe_dump(body), encoding='utf-8')

    from ingest import config_loader as config_loader_module

    monkeypatch.setattr(config_loader_module, 'config_dir', lambda: fixture_dir)

    config = load_config('phak')
    assert len(config.dismissed_errata) == 1
    assert config.dismissed_errata[0].url == 'https://www.faa.gov/sites/x/y/false-positive.pdf'
    assert config.dismissed_errata[0].reason == 'unrelated press release'
