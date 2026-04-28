"""Pilot's Handbook of Aeronautical Knowledge plugin.

PHAK 25C ships per-chapter PDFs concatenated together. The bookmark
tree lists filenames (`03_phak_ch1.pdf`) rather than chapter titles, so
chapter boundaries come from the FAA-style ``<chap>-<page>`` page-text
header. That logic lives in the shared engine; the plugin holds only
the discovery surface (FAA page URL + addendum filename patterns) plus
the default errata-parser dispatch.
"""

from __future__ import annotations

import re

from .base import HandbookPlugin


class PhakHandbook(HandbookPlugin):
    """Plugin for the PHAK (FAA-H-8083-25)."""

    slug = 'phak'

    def discovery_url(self) -> str:
        return (
            'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/'
            'phak'
        )

    def discovery_link_patterns(self) -> list[re.Pattern[str]]:
        # FAA filename conventions for PHAK addenda observed in practice:
        #   - ``PHAK_Addendum_(MOSAIC).pdf`` (Oct 2025)
        #   - ``phak_addendum_a.pdf`` / ``..._b.pdf`` (PHAK 25B, lowercase)
        #   - ``phak_changes_<edition>.pdf`` for "summary of changes"
        # The patterns are case-insensitive and anchor on the slug so an
        # AFH addendum on the same parent page is not mis-classified.
        return [
            re.compile(r'PHAK[_-]?Addendum.*\.pdf', re.IGNORECASE),
            re.compile(r'PHAK[_-]?Errata.*\.pdf', re.IGNORECASE),
            re.compile(r'PHAK[_-]?Changes.*\.pdf', re.IGNORECASE),
        ]
