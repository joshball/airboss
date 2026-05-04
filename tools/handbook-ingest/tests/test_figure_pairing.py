"""Unit tests for the figure-caption geometric pairing logic.

Exercises `_pair_caption_with_image` directly with synthetic `_CaptionLoc`
+ `_ImageLoc` records so we don't need a real PDF. The full extractor is
covered by the CLI integration test; this is the unit-level cover for the
three-tier pairing strategy.
"""

from __future__ import annotations

from ingest.figures import _CaptionLoc, _ImageLoc, _pair_caption_with_image, _vertical_distance


def img(page: int, idx: int, top_y: float, bottom_y: float) -> _ImageLoc:
    return _ImageLoc(
        page_num=page,
        idx=idx,
        png_bytes=b"",
        width=200,
        height=200,
        top_y=top_y,
        bottom_y=bottom_y,
    )


def cap(page: int, top_y: float, text: str = "Figure 1-1. Test.") -> _CaptionLoc:
    return _CaptionLoc(page_num=page, caption=text, top_y=top_y)


class TestVerticalDistance:
    def test_caption_inside_image_rect_is_zero(self) -> None:
        # Caption baseline at y=350 with image spanning 300..400 -> inside.
        assert _vertical_distance(350.0, img(0, 0, 300.0, 400.0)) == 0.0

    def test_caption_directly_above_image(self) -> None:
        # Caption at y=290; image starts at y=300. Distance = 10.
        assert _vertical_distance(290.0, img(0, 0, 300.0, 400.0)) == 10.0

    def test_caption_directly_below_image(self) -> None:
        # Caption at y=410; image ends at y=400. Distance = 10.
        assert _vertical_distance(410.0, img(0, 0, 300.0, 400.0)) == 10.0


class TestPairCaptionWithImage:
    def test_tier1_same_page_picks_closest_image(self) -> None:
        # Two images on the page; caption is closer to the second one.
        # Encounter order would have picked the first (idx=0) -- geometric
        # proximity picks the second (idx=1).
        images = {
            0: [
                img(0, 0, 100.0, 200.0),  # far from caption
                img(0, 1, 480.0, 580.0),  # close to caption
            ],
        }
        result = _pair_caption_with_image(cap(0, 460.0), images, set())
        assert result is not None
        assert result.idx == 1

    def test_tier1_skips_used_images(self) -> None:
        images = {
            0: [
                img(0, 0, 100.0, 200.0),
                img(0, 1, 480.0, 580.0),
            ],
        }
        # Idx 1 already used -> falls back to idx 0.
        result = _pair_caption_with_image(cap(0, 460.0), images, {(0, 1)})
        assert result is not None
        assert result.idx == 0

    def test_tier2_prior_page_when_same_page_empty(self) -> None:
        images = {
            0: [img(0, 0, 100.0, 200.0)],
            # Caption on page 1 with no images; falls back to page 0.
        }
        result = _pair_caption_with_image(cap(1, 50.0), images, set())
        assert result is not None
        assert result.page_num == 0

    def test_tier3_next_page_wider_rect_retry(self) -> None:
        # Caption on page 0; figure paginated to page 1 (FAA AC pattern).
        images = {
            1: [img(1, 0, 100.0, 200.0)],
        }
        result = _pair_caption_with_image(cap(0, 50.0), images, set())
        assert result is not None
        assert result.page_num == 1
        assert result.idx == 0

    def test_returns_none_when_no_candidates(self) -> None:
        result = _pair_caption_with_image(cap(0, 50.0), {}, set())
        assert result is None

    def test_returns_none_when_only_used_candidates(self) -> None:
        images = {0: [img(0, 0, 100.0, 200.0)]}
        result = _pair_caption_with_image(cap(0, 50.0), images, {(0, 0)})
        assert result is None

    def test_same_page_geometric_beats_prior_page_encounter_order(self) -> None:
        # Both pages have unused images; same-page wins regardless of position.
        images = {
            0: [img(0, 0, 1.0, 1.0)],  # tiny "image" on prior page
            1: [img(1, 0, 100.0, 200.0)],  # well-positioned same-page image
        }
        result = _pair_caption_with_image(cap(1, 150.0), images, set())
        assert result is not None
        assert result.page_num == 1

    def test_tier_priority_order(self) -> None:
        # Same-page > prior-page > next-page.
        images = {
            0: [img(0, 0, 100.0, 200.0)],  # prior
            1: [img(1, 0, 100.0, 200.0)],  # same as caption
            2: [img(2, 0, 100.0, 200.0)],  # next
        }
        result = _pair_caption_with_image(cap(1, 150.0), images, set())
        assert result is not None
        assert result.page_num == 1
