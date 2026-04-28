"""Aviation Weather Handbook plugin.

AvWX 28B ships proper PDF bookmarks (28 chapters, dotted codes); the
shared engine handles the bookmark-driven outline. This plugin holds
the discovery surface only. AvWX has no published errata as of the
28B release (April 2026).
"""

from __future__ import annotations

import re

from .base import HandbookPlugin


class AvwxHandbook(HandbookPlugin):
    """Plugin for the AvWX (FAA-H-8083-28)."""

    slug = 'avwx'

    def discovery_url(self) -> str:
        return (
            'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/'
            'aviation_weather_handbook'
        )

    def discovery_link_patterns(self) -> list[re.Pattern[str]]:
        # FAA has not published AvWX 28B errata as of April 2026. The
        # patterns are speculative but match the convention observed on
        # PHAK and AFH parent pages.
        return [
            re.compile(r'AvWX[_-]?Addendum.*\.pdf', re.IGNORECASE),
            re.compile(r'(Aviation[_-]?Weather|FAA-H-8083-28)[_-]?Addendum.*\.pdf', re.IGNORECASE),
            re.compile(r'AvWX[_-]?Errata.*\.pdf', re.IGNORECASE),
        ]
