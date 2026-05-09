"""Unit tests for the per-handbook plugin registry."""

from __future__ import annotations

import pytest

from ingest.handbooks import (
    REGISTRY,
    AfhHandbook,
    AviationInstructorHandbook,
    AvwxHandbook,
    HandbookPlugin,
    PhakHandbook,
    UnknownHandbookError,
    get_handbook,
)

# Source of truth for the registered handbook slugs. New handbooks should
# extend this list (and the corresponding `REGISTRY` entry) together so the
# membership / discovery / error-message tests stay in sync.
KNOWN_SLUGS: list[str] = ['afh', 'aviation-instructor', 'avwx', 'phak']


def test_registry_resolves_all_known_handbooks() -> None:
    assert isinstance(get_handbook('phak'), PhakHandbook)
    assert isinstance(get_handbook('afh'), AfhHandbook)
    assert isinstance(get_handbook('avwx'), AvwxHandbook)
    assert isinstance(get_handbook('aviation-instructor'), AviationInstructorHandbook)


def test_registry_membership_matches_known_slugs() -> None:
    assert sorted(REGISTRY.keys()) == KNOWN_SLUGS


def test_unknown_slug_raises_typed_error_with_available_slugs() -> None:
    with pytest.raises(UnknownHandbookError) as excinfo:
        get_handbook('unknown-handbook')
    msg = str(excinfo.value)
    assert "unknown-handbook" in msg
    # The available list helps the user discover the right slug; every
    # registered slug must appear so the operator can pick one without
    # cross-referencing source.
    for slug in KNOWN_SLUGS:
        assert slug in msg, f"expected slug {slug!r} in error message: {msg!r}"


@pytest.mark.parametrize('slug', KNOWN_SLUGS)
def test_each_plugin_exposes_discovery_surface(slug: str) -> None:
    plugin = get_handbook(slug)
    assert isinstance(plugin, HandbookPlugin)
    assert plugin.slug == slug
    url = plugin.discovery_url()
    assert url.startswith('https://www.faa.gov/')
    patterns = plugin.discovery_link_patterns()
    assert isinstance(patterns, list)
    assert all(p.search is not None for p in patterns)
    # Slug-anchored: the patterns should at least contain a slug-derived
    # token (case-insensitively) so e.g. AFH patterns don't catch PHAK URLs.
    # AvWX patterns use 'Aviation_Weather'; aviation-instructor patterns
    # use 'AIH' or 'aviation_instructor'.
    pattern_text = ' '.join(p.pattern for p in patterns).lower()
    slug_tokens = [slug, 'aviation', 'aih']
    assert any(token in pattern_text for token in slug_tokens), (
        f"plugin {slug!r} discovery patterns must reference one of {slug_tokens}: {pattern_text!r}"
    )


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
