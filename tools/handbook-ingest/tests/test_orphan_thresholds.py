"""Per-handbook orphan-budget regression test.

Locks in the figure-pairing pipeline's orphan rate so future ingest
changes can't silently regress. Reads each handbook's live
``handbooks/<slug>/<edition>/warnings.json`` and asserts the count of
``caption-without-figure`` and ``figure-without-caption`` warnings stays
at or below the per-handbook budget defined in ``ORPHAN_BUDGET``.

Budget evolution (per ``docs/work-packages/handbook-figure-pairing``):

- Phase 1 (this file lands): budgets = today's pre-fix counts so the test
  passes on main.
- Phase 2 (regex fix): tighten after re-extraction.
- Phase 3 (cross-section dict): tighten again.
- Phase 4 (image floor): tighten one last time.
- Final state: total caption orphans <= 200, total image orphans <= 100
  across the fleet (per spec.md "Success criteria").
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

CAPTION_CODE = 'caption-without-figure'
IMAGE_CODE = 'figure-without-caption'

# Per-handbook orphan budgets. Keys are document slugs (matching
# ``handbooks/<slug>/``); values carry the maximum acceptable count of
# each warning code. Tighten these as each phase ships.
ORPHAN_BUDGET: dict[str, dict[str, int]] = {
	# Phase 6 final budgets: measured post-fix counts plus a small slack
	# margin so an FAA reissue with one or two new captions doesn't fail
	# the build. Tighten further if the actual counts ever drift below
	# these caps and stay there across multiple re-ingests.
	'afh': {'caption_without_figure': 5, 'figure_without_caption': 5},
	'aviation-instructor': {'caption_without_figure': 5, 'figure_without_caption': 5},
	'avwx': {'caption_without_figure': 10, 'figure_without_caption': 10},
	'ifh': {'caption_without_figure': 10, 'figure_without_caption': 10},
	'iph': {'caption_without_figure': 15, 'figure_without_caption': 10},
	'phak': {'caption_without_figure': 25, 'figure_without_caption': 15},
	'risk-management': {'caption_without_figure': 5, 'figure_without_caption': 5},
}

# Final fleet-wide ceiling (spec.md success criteria 1 + 2). Asserted as
# a separate test so it surfaces independently of the per-handbook check.
TOTAL_CAPTION_ORPHANS_MAX = 200
TOTAL_IMAGE_ORPHANS_MAX = 100


def _repo_root() -> Path:
	here = Path(__file__).resolve()
	for parent in [here, *here.parents]:
		if (parent / 'package.json').is_file() and (parent / 'tools').is_dir():
			return parent
	raise RuntimeError(f'Could not locate airboss repo root from {here}')


def _warnings_path(slug: str) -> Path:
	"""Resolve ``handbooks/<slug>/<edition>/warnings.json`` for a slug.

	Each handbook ingest emits exactly one edition tree; we glob the
	first match so the test doesn't have to encode the edition tag.
	"""
	root = _repo_root() / 'handbooks' / slug
	candidates = sorted(root.glob('*/warnings.json'))
	if not candidates:
		raise FileNotFoundError(f'No warnings.json under handbooks/{slug}/*/')
	return candidates[0]


def _count_warnings(path: Path) -> tuple[int, int]:
	with path.open('r', encoding='utf-8') as fh:
		payload = json.load(fh)
	caption = 0
	image = 0
	for warn in payload.get('warnings', []):
		code = warn.get('code')
		if code == CAPTION_CODE:
			caption += 1
		elif code == IMAGE_CODE:
			image += 1
	return caption, image


@pytest.mark.parametrize('slug', sorted(ORPHAN_BUDGET))
def test_handbook_orphan_count_within_budget(slug: str) -> None:
	budget = ORPHAN_BUDGET[slug]
	path = _warnings_path(slug)
	caption, image = _count_warnings(path)
	assert caption <= budget['caption_without_figure'], (
		f'{slug}: {caption} caption-without-figure warnings exceeds '
		f"budget {budget['caption_without_figure']} (file: {path})"
	)
	assert image <= budget['figure_without_caption'], (
		f'{slug}: {image} figure-without-caption warnings exceeds '
		f"budget {budget['figure_without_caption']} (file: {path})"
	)


def test_total_orphans_within_fleet_ceiling() -> None:
	"""Spec success criteria 1 + 2: fleet totals stay under 200 / 100.

	With the figure-pairing WP shipped, both per-handbook budgets sum
	to well under the spec's fleet-wide ceiling. This test fails
	loudly if a future ingest change inflates the per-handbook caps
	past the spec's promise.
	"""
	totals_caption = sum(b['caption_without_figure'] for b in ORPHAN_BUDGET.values())
	totals_image = sum(b['figure_without_caption'] for b in ORPHAN_BUDGET.values())
	assert totals_caption <= TOTAL_CAPTION_ORPHANS_MAX, (
		f'Fleet caption-without-figure budget {totals_caption} exceeds the '
		f'spec ceiling of {TOTAL_CAPTION_ORPHANS_MAX}.'
	)
	assert totals_image <= TOTAL_IMAGE_ORPHANS_MAX, (
		f'Fleet figure-without-caption budget {totals_image} exceeds the '
		f'spec ceiling of {TOTAL_IMAGE_ORPHANS_MAX}.'
	)


def test_post_fix_targets_documented() -> None:
	"""Affirm that the spec's fleet-wide success targets are encoded
	in this file and remain reachable from the per-handbook caps.

	The phase-6 tightening pass must drive ``sum(caption_without_figure
	per handbook)`` to <= 200 and ``sum(figure_without_caption per
	handbook)`` to <= 100. This test fails noisily if the constants are
	deleted or weakened.
	"""
	assert TOTAL_CAPTION_ORPHANS_MAX == 200
	assert TOTAL_IMAGE_ORPHANS_MAX == 100
