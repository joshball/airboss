"""Errata parser base class and shared exceptions."""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..handbooks.base import ErrataConfig, ErrataPatch


class UnknownErrataLayoutError(Exception):
    """Raised when an errata parser cannot recognize the addendum format.

    The parser should populate the message with the markers it expected
    but did not find so the caller can decide whether the layout has
    drifted or whether a new parser archetype is needed.
    """


class ErrataParser(ABC):
    """Base class for errata layout parsers.

    Subclasses are stateless: instantiate, call :meth:`parse` once per
    PDF. The parser inspects the PDF text and emits a list of
    :class:`ErrataPatch`. It must raise :class:`UnknownErrataLayoutError`
    when the markers it expects are not present (rather than silently
    returning an empty list, which would mask a layout regression).
    """

    name: str = ''

    @abstractmethod
    def parse(self, pdf_path: Path, errata: ErrataConfig) -> list[ErrataPatch]:
        """Extract patches from the errata PDF.

        Args:
            pdf_path: Filesystem path to the cached errata PDF.
            errata:  YAML-derived metadata for this erratum (id,
                source_url, published_at, parser).

        Returns:
            One :class:`ErrataPatch` per discrete change instructed by
            the addendum. Order follows document order.

        Raises:
            UnknownErrataLayoutError: when the parser's archetype
                markers are absent from the PDF.
        """
