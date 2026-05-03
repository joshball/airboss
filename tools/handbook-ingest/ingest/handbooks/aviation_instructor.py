"""Aviation Instructor's Handbook plugin.

AIH 2020 (FAA-H-8083-9) ships proper PDF bookmarks (551 entries with chapter
titles in the canonical "Chapter N: Title" form) so the bookmark outline
strategy produces the right tree without a content scan. The shared engine
handles all extraction via the YAML config; this plugin holds the discovery
surface only.
"""

from __future__ import annotations

import re

from .base import HandbookPlugin


class AviationInstructorHandbook(HandbookPlugin):
    """Plugin for the AIH (FAA-H-8083-9)."""

    slug = 'aviation-instructor'

    def discovery_url(self) -> str:
        return (
            'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/'
            'aviation_instructors_handbook'
        )

    def discovery_link_patterns(self) -> list[re.Pattern[str]]:
        # FAA filename conventions for AIH addenda are not currently
        # observed (no errata as of 2026-05-03). Cover the canonical
        # FAA naming forms so future amendments surface in `discover-errata`
        # without a code change.
        return [
            re.compile(r'AIH[_-]?Addendum.*\.pdf', re.IGNORECASE),
            re.compile(r'AIH[_-]?Errata.*\.pdf', re.IGNORECASE),
            re.compile(r'AIH[_-]?Changes.*\.pdf', re.IGNORECASE),
            re.compile(r'aviation[_-]?instructor[s]?[_-]?handbook[_-]?addendum.*\.pdf', re.IGNORECASE),
            re.compile(r'aviation[_-]?instructor[s]?[_-]?handbook[_-]?errata.*\.pdf', re.IGNORECASE),
        ]
