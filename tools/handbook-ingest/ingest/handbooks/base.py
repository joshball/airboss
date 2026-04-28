"""Per-handbook plugin base class and shared types.

A :class:`HandbookPlugin` owns three quirks per book:

1. Discovery: the FAA parent page URL plus regex patterns matching
   addendum/errata links on that page.
2. Errata parsing: dispatch to a registered :class:`ErrataParser` keyed
   by layout name (``additive-paragraph``, etc.). Override only when a
   handbook needs custom logic the layout-keyed parser registry can't
   express.
3. Body normalization hooks: optional pre/post hooks that wrap the
   shared normalization pipeline (default: passthrough).

The plugin layer is deliberately thin. Most variability still flows
through the YAML config; this layer covers the cases YAML can't express
cleanly (executable rules, regex pattern lists).
"""

from __future__ import annotations

import re
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..errata_parsers.base import ErrataParser


# Allowed values for ErrataPatch.kind. Mirrors the TypeScript discriminated
# union in libs/bc/study/src/handbooks-errata.ts. Constraining at the
# plugin layer (not via DB CHECK) matches the project ADR practice.
PATCH_KIND_ADD_SUBSECTION = 'add_subsection'
PATCH_KIND_APPEND_PARAGRAPH = 'append_paragraph'
PATCH_KIND_REPLACE_PARAGRAPH = 'replace_paragraph'

PATCH_KINDS = frozenset(
    {
        PATCH_KIND_ADD_SUBSECTION,
        PATCH_KIND_APPEND_PARAGRAPH,
        PATCH_KIND_REPLACE_PARAGRAPH,
    }
)


class UnknownHandbookError(Exception):
    """Raised when :func:`get_handbook` can't resolve a slug."""


@dataclass(frozen=True)
class ErrataPatch:
    """One patch produced by an :class:`ErrataParser`.

    Coordinates: ``chapter`` is the chapter ordinal as a zero-padded
    string (`"02"`); ``section_anchor`` is the human-readable section
    title used to locate the affected ``handbook_section`` row;
    ``target_page`` is the printed FAA page format (`"2-4"`), not the
    PDF page integer.
    """

    kind: str
    chapter: str
    section_anchor: str
    target_page: str
    new_heading: str | None
    original_text: str | None
    replacement_text: str

    def __post_init__(self) -> None:
        if self.kind not in PATCH_KINDS:
            raise ValueError(
                f"ErrataPatch.kind must be one of {sorted(PATCH_KINDS)}; got {self.kind!r}"
            )
        if self.kind == PATCH_KIND_ADD_SUBSECTION and self.new_heading is None:
            raise ValueError(
                "ErrataPatch.kind == 'add_subsection' requires a non-null `new_heading`."
            )
        if not self.replacement_text.strip():
            raise ValueError("ErrataPatch.replacement_text must be non-empty.")


@dataclass(frozen=True)
class ErrataConfig:
    """One entry from the YAML ``errata:`` list, post-load."""

    id: str
    source_url: str
    published_at: str
    parser: str


@dataclass(frozen=True)
class ErrataDismissal:
    """One entry from the YAML ``dismissed_errata:`` list, post-load.

    A dismissal silences a discovery candidate the user has reviewed and
    decided is not real (a duplicate URL, a misclassified PDF, an artifact
    that turned out to be unrelated). Discovery uses these as a stop-list:
    matching candidates stay in `dismissed` status across re-runs and
    never re-open the GitHub issue.

    A dismissal entry must specify either ``url`` or ``sha256`` (or both);
    the YAML loader rejects entries with neither. ``reason`` is a free-form
    note retained for audit; the discovery dispatcher prints it next to the
    dismissed candidate in the report.
    """

    url: str | None
    sha256: str | None
    reason: str


class HandbookPlugin(ABC):
    """Base class for per-handbook plugins.

    Subclasses set the ``slug`` class attribute and implement at minimum
    :meth:`discovery_url` and :meth:`discovery_link_patterns`. The
    default :meth:`parse_errata` dispatches to the layout-keyed parser
    registry; override only when a handbook needs custom logic.
    """

    slug: str = ''

    @abstractmethod
    def discovery_url(self) -> str:
        """FAA parent page URL for this handbook (used by discovery scan)."""

    @abstractmethod
    def discovery_link_patterns(self) -> list[re.Pattern[str]]:
        """Regex patterns matching errata/addendum URLs on the parent page.

        Multiple patterns allowed because FAA naming is inconsistent
        across handbooks (some use ``Addendum``, some ``Errata``, some
        ``Change``).
        """

    def parse_errata(self, pdf_path: Path, errata: ErrataConfig) -> list[ErrataPatch]:
        """Parse the errata PDF into a list of :class:`ErrataPatch`.

        Default implementation dispatches to the parser registry keyed
        by ``errata.parser``. Override only when a handbook needs custom
        logic the layout-keyed parsers can't express.
        """
        # Local import keeps the module load order forgiving (parser
        # registry is allowed to import handbook types).
        from ..errata_parsers import get_parser

        parser: ErrataParser = get_parser(errata.parser)
        return parser.parse(pdf_path, errata)

    def body_quirks_pre(self, body_md: str, *, chapter: int) -> str:
        """Hook for per-book pre-normalization. Default: passthrough.

        The engine calls this before the shared normalization pipeline
        runs on a chapter body. Override when a book ships layout
        artifacts (running banners, multi-line cover residue) that the
        shared pipeline can't strip generically.
        """
        del chapter
        return body_md

    def body_quirks_post(self, body_md: str, *, chapter: int) -> str:
        """Hook for per-book post-normalization. Default: passthrough."""
        del chapter
        return body_md
