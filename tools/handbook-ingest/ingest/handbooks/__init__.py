"""Per-handbook plugin registry.

Each FAA handbook gets one subclass of :class:`HandbookPlugin` that owns
that book's quirks: discovery URL/patterns, errata-parsing dispatch, and
optional pre/post normalization hooks. The engine looks up plugins by
slug via :func:`get_handbook`. New books = new file in this package +
one entry in :data:`REGISTRY`.

See `docs/work-packages/apply-errata-and-afh-mosaic/design.md` for the
architectural rationale. The pattern matches Drizzle BC modules in the
TypeScript half of the repo (one file per concern).
"""

from __future__ import annotations

from .afh import AfhHandbook
from .avwx import AvwxHandbook
from .base import (
    ErrataConfig,
    ErrataDismissal,
    ErrataPatch,
    HandbookPlugin,
    UnknownHandbookError,
)
from .phak import PhakHandbook

REGISTRY: dict[str, type[HandbookPlugin]] = {
    'phak': PhakHandbook,
    'afh': AfhHandbook,
    'avwx': AvwxHandbook,
}


def get_handbook(slug: str) -> HandbookPlugin:
    """Return the plugin instance for `slug`.

    Raises :class:`UnknownHandbookError` with the available slugs when the
    slug is not registered. Callers should treat the error as a typed
    contract: it is the only way the engine reports a missing plugin.
    """
    cls = REGISTRY.get(slug)
    if cls is None:
        available = sorted(REGISTRY.keys())
        raise UnknownHandbookError(
            f"No plugin registered for slug '{slug}'. Available: {available}"
        )
    return cls()


__all__ = [
    'REGISTRY',
    'ErrataConfig',
    'ErrataDismissal',
    'ErrataPatch',
    'HandbookPlugin',
    'UnknownHandbookError',
    'get_handbook',
    'PhakHandbook',
    'AfhHandbook',
    'AvwxHandbook',
]
