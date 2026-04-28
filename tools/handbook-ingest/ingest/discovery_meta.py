"""Emit per-handbook discovery metadata as JSON for the TS dispatcher.

The TypeScript discover-errata orchestrator under ``scripts/sources/discover/``
needs three pieces of per-handbook state that live on the Python side:

1. Plugin-side regex patterns (``HandbookPlugin.discovery_link_patterns``)
2. The applied-errata URL list (YAML ``errata:``) -- a discovered candidate
   whose URL matches an applied entry should be marked ``applied``, not
   re-flagged.
3. The dismissed-errata stop-list (YAML ``dismissed_errata:``) -- forces
   matching candidates to ``dismissed`` across re-runs.

Subprocess + JSON is the existing TS<->Python boundary in this repo; FFI
would invent a precedent. See design.md "Why subprocess JSON between TS
and Python, not an FFI binding."

Usage::

    python -m ingest.discovery_meta phak afh ...

emits a single JSON document on stdout. With no arguments, emits metadata
for every handbook with a YAML config (the union of registered plugins
and configured slugs).
"""

from __future__ import annotations

import json
import sys

from .config_loader import HandbookConfig, load_config
from .handbooks import REGISTRY, get_handbook
from .paths import config_dir


def _slugs_with_yaml() -> list[str]:
    """Return the slugs for which a YAML config exists on disk."""
    return sorted(p.stem for p in config_dir().glob('*.yaml'))


def _emit_for_slug(slug: str) -> dict[str, object]:
    plugin = None
    if slug in REGISTRY:
        plugin = get_handbook(slug)
    config: HandbookConfig | None = None
    try:
        config = load_config(slug)
    except FileNotFoundError:
        config = None

    discovery_url: str | None = None
    link_patterns: list[str] = []
    if plugin is not None:
        discovery_url = plugin.discovery_url()
        link_patterns = [p.pattern for p in plugin.discovery_link_patterns()]

    applied_urls: list[dict[str, str]] = []
    dismissed_urls: list[dict[str, str | None]] = []
    if config is not None:
        applied_urls = [
            {'url': e.source_url, 'errata_id': e.id}
            for e in config.errata
        ]
        dismissed_urls = [
            {'url': d.url, 'sha256': d.sha256, 'reason': d.reason}
            for d in config.dismissed_errata
        ]

    return {
        'slug': slug,
        'has_plugin': plugin is not None,
        'has_yaml': config is not None,
        'discovery_url': discovery_url,
        'link_patterns': link_patterns,
        'applied': applied_urls,
        'dismissed': dismissed_urls,
    }


def main(argv: list[str]) -> int:
    if argv:
        slugs = argv
    else:
        # Union of YAML-configured slugs and registered plugins -- catches
        # both "I have config but no plugin" and "I have a plugin but no
        # config" so the TS side gets every handbook the Python side knows
        # about.
        slugs = sorted(set(_slugs_with_yaml()) | set(REGISTRY.keys()))

    payload = {'handbooks': [_emit_for_slug(s) for s in slugs]}
    json.dump(payload, sys.stdout)
    sys.stdout.write('\n')
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
