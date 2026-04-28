"""Unit tests for the per-handbook plugin registry."""

from __future__ import annotations

import pytest

from ingest.handbooks import (
    REGISTRY,
    AfhHandbook,
    AvwxHandbook,
    HandbookPlugin,
    PhakHandbook,
    UnknownHandbookError,
    get_handbook,
)


def test_registry_resolves_all_three_known_handbooks() -> None:
    assert isinstance(get_handbook('phak'), PhakHandbook)
    assert isinstance(get_handbook('afh'), AfhHandbook)
    assert isinstance(get_handbook('avwx'), AvwxHandbook)


def test_registry_membership_matches_known_slugs() -> None:
    assert sorted(REGISTRY.keys()) == ['afh', 'avwx', 'phak']


def test_unknown_slug_raises_typed_error_with_available_slugs() -> None:
    with pytest.raises(UnknownHandbookError) as excinfo:
        get_handbook('unknown-handbook')
    msg = str(excinfo.value)
    assert "unknown-handbook" in msg
    # The available list helps the user discover the right slug; the
    # exact wording is documented in the plugin module.
    assert 'phak' in msg and 'afh' in msg and 'avwx' in msg


@pytest.mark.parametrize('slug', ['phak', 'afh', 'avwx'])
def test_each_plugin_exposes_discovery_surface(slug: str) -> None:
    plugin = get_handbook(slug)
    assert isinstance(plugin, HandbookPlugin)
    assert plugin.slug == slug
    url = plugin.discovery_url()
    assert url.startswith('https://www.faa.gov/')
    patterns = plugin.discovery_link_patterns()
    assert isinstance(patterns, list)
    assert all(p.search is not None for p in patterns)
    # Slug-anchored: the patterns should at least contain the slug
    # token (case-insensitively) so AFH patterns don't catch PHAK URLs.
    pattern_text = ' '.join(p.pattern for p in patterns).lower()
    assert slug in pattern_text or 'aviation' in pattern_text  # AvWX uses 'Aviation_Weather'


def test_phak_pattern_matches_mosaic_addendum_url() -> None:
    plugin = get_handbook('phak')
    url = 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/PHAK_Addendum_(MOSAIC).pdf'
    assert any(p.search(url) for p in plugin.discovery_link_patterns())


def test_afh_pattern_matches_mosaic_addendum_url() -> None:
    plugin = get_handbook('afh')
    url = 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/AFH_Addendum_(MOSAIC).pdf'
    assert any(p.search(url) for p in plugin.discovery_link_patterns())


def test_phak_patterns_do_not_match_afh_addendum() -> None:
    plugin = get_handbook('phak')
    afh_url = 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/AFH_Addendum_(MOSAIC).pdf'
    assert not any(p.search(afh_url) for p in plugin.discovery_link_patterns())


def test_default_body_quirks_are_passthrough() -> None:
    plugin = get_handbook('phak')
    assert plugin.body_quirks_pre('hello', chapter=1) == 'hello'
    assert plugin.body_quirks_post('world', chapter=2) == 'world'
