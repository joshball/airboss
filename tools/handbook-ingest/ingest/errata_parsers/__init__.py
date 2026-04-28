"""Layout-keyed errata parser registry.

Errata layouts have nameable archetypes that recur across handbooks
(MOSAIC's additive-paragraph form is identical for AFH and PHAK).
Parsers are keyed by *layout name*, not by handbook slug, so one parser
covers every handbook that uses that layout. The handbook plugin's
YAML config picks which parser by setting ``errata[].parser``.

See `docs/work-packages/apply-errata-and-afh-mosaic/design.md` for the
rationale (search "Why one parser file per layout").
"""

from __future__ import annotations

from .additive_paragraph import AdditiveParagraphParser
from .base import ErrataParser, UnknownErrataLayoutError
from .bullet_edits import BulletEditsParser

PARSERS: dict[str, type[ErrataParser]] = {
    'additive-paragraph': AdditiveParagraphParser,
    'bullet-edits': BulletEditsParser,
}


def get_parser(name: str) -> ErrataParser:
    """Return the parser instance for the given layout name."""
    cls = PARSERS.get(name)
    if cls is None:
        available = sorted(PARSERS.keys())
        raise ValueError(
            f"No parser registered for layout '{name}'. Available: {available}"
        )
    return cls()


__all__ = [
    'PARSERS',
    'AdditiveParagraphParser',
    'BulletEditsParser',
    'ErrataParser',
    'UnknownErrataLayoutError',
    'get_parser',
]
