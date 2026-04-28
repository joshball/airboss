"""Tests for the YAML `errata:` list loaded by config_loader."""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from ingest.config_loader import _load_errata_list, load_config
from ingest.handbooks.base import ErrataConfig


def test_afh_yaml_loads_mosaic_entry() -> None:
    config = load_config('afh')
    assert len(config.errata) == 1
    entry = config.errata[0]
    assert isinstance(entry, ErrataConfig)
    assert entry.id == 'mosaic'
    assert entry.source_url.endswith('AFH_Addendum_(MOSAIC).pdf')
    assert entry.source_url.startswith('https://')
    assert entry.published_at == '2025-10-20'
    assert entry.parser == 'additive-paragraph'


def test_phak_yaml_loads_mosaic_entry() -> None:
    config = load_config('phak')
    assert len(config.errata) == 1
    assert config.errata[0].id == 'mosaic'
    assert config.errata[0].source_url.endswith('PHAK_Addendum_(MOSAIC).pdf')


def test_avwx_yaml_loads_empty_errata_list() -> None:
    config = load_config('avwx')
    assert config.errata == []


def test_missing_errata_field_loads_as_empty_list(tmp_path: Path) -> None:
    """Backward compat: a YAML with no `errata:` field still loads."""
    src = tmp_path / 'fakebook.yaml'
    src.write_text(
        yaml.safe_dump(
            {
                'document_slug': 'fakebook',
                'edition': 'X-1A',
                'title': 'Fake',
                'source_url': 'https://x.test/x.pdf',
            }
        )
    )
    raw = yaml.safe_load(src.read_text())
    assert _load_errata_list(raw.get('errata'), src) == []


def test_invalid_id_format_rejected(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match='kebab-case'):
        _load_errata_list(
            [
                {
                    'id': 'BadID',
                    'source_url': 'https://x.test/x.pdf',
                    'published_at': '2026-01-01',
                    'parser': 'additive-paragraph',
                }
            ],
            tmp_path / 'config.yaml',
        )


def test_duplicate_ids_rejected(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match='duplicates'):
        _load_errata_list(
            [
                {
                    'id': 'mosaic',
                    'source_url': 'https://x.test/a.pdf',
                    'published_at': '2026-01-01',
                    'parser': 'additive-paragraph',
                },
                {
                    'id': 'mosaic',
                    'source_url': 'https://x.test/b.pdf',
                    'published_at': '2026-02-01',
                    'parser': 'additive-paragraph',
                },
            ],
            tmp_path / 'config.yaml',
        )


def test_non_https_url_rejected(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match='HTTPS'):
        _load_errata_list(
            [
                {
                    'id': 'mosaic',
                    'source_url': 'http://x.test/insecure.pdf',
                    'published_at': '2026-01-01',
                    'parser': 'additive-paragraph',
                }
            ],
            tmp_path / 'config.yaml',
        )


def test_invalid_date_rejected(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match='ISO 8601'):
        _load_errata_list(
            [
                {
                    'id': 'mosaic',
                    'source_url': 'https://x.test/a.pdf',
                    'published_at': 'October 2025',
                    'parser': 'additive-paragraph',
                }
            ],
            tmp_path / 'config.yaml',
        )


def test_missing_required_field_rejected(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match='missing required keys'):
        _load_errata_list(
            [
                {
                    'id': 'mosaic',
                    'source_url': 'https://x.test/a.pdf',
                    'parser': 'additive-paragraph',
                    # missing published_at
                }
            ],
            tmp_path / 'config.yaml',
        )


def test_entries_sorted_by_published_at(tmp_path: Path) -> None:
    out = _load_errata_list(
        [
            {
                'id': 'second',
                'source_url': 'https://x.test/b.pdf',
                'published_at': '2026-03-01',
                'parser': 'additive-paragraph',
            },
            {
                'id': 'first',
                'source_url': 'https://x.test/a.pdf',
                'published_at': '2026-01-01',
                'parser': 'additive-paragraph',
            },
        ],
        tmp_path / 'config.yaml',
    )
    assert [e.id for e in out] == ['first', 'second']


def test_id_length_bounds_enforced(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match='3-32'):
        _load_errata_list(
            [
                {
                    'id': 'ab',  # too short
                    'source_url': 'https://x.test/a.pdf',
                    'published_at': '2026-01-01',
                    'parser': 'additive-paragraph',
                }
            ],
            tmp_path / 'config.yaml',
        )
