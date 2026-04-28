"""Airplane Flying Handbook plugin.

AFH 3C uses a content-driven outline strategy (the bookmark tree carries
file names, not chapter titles) and pins the FAA page header in each
page footer. All of that lives in the shared engine via the YAML config;
this plugin holds the discovery surface only.
"""

from __future__ import annotations

import re

from .base import HandbookPlugin


class AfhHandbook(HandbookPlugin):
    """Plugin for the AFH (FAA-H-8083-3)."""

    slug = 'afh'

    def discovery_url(self) -> str:
        return (
            'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/'
            'airplane_handbook'
        )

    def discovery_link_patterns(self) -> list[re.Pattern[str]]:
        # FAA filename conventions for AFH addenda observed in practice:
        #   - ``AFH_Addendum_(MOSAIC).pdf`` (Oct 2025)
        #   - ``afh_changes_<edition>.pdf`` for "summary of changes"
        return [
            re.compile(r'AFH[_-]?Addendum.*\.pdf', re.IGNORECASE),
            re.compile(r'AFH[_-]?Errata.*\.pdf', re.IGNORECASE),
            re.compile(r'AFH[_-]?Changes.*\.pdf', re.IGNORECASE),
        ]
