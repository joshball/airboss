#!/usr/bin/env python3
"""Print a markdown table of figure-pairing orphan counts per handbook.

Walks every `handbooks/*/*/warnings.json` in the repo and counts the two
codes the figure-pairing pipeline emits:

- ``caption-without-figure`` -- a "Figure N-N." header was matched in the
  PDF text but the geometric pairing pass found no image to pair with it.
- ``figure-without-caption`` -- an image was extracted but no caption was
  matched within the section's page range.

Use this as the deterministic reference for the
``handbook-figure-pairing`` work package. The pre-fix baseline is captured
in ``docs/work-packages/handbook-figure-pairing/baseline.md``; running this
tool after a re-extraction shows the post-fix delta.
"""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

CAPTION_CODE = 'caption-without-figure'
IMAGE_CODE = 'figure-without-caption'


def _repo_root() -> Path:
	here = Path(__file__).resolve()
	for parent in [here, *here.parents]:
		if (parent / 'package.json').is_file() and (parent / 'tools').is_dir():
			return parent
	raise RuntimeError(f'Could not locate airboss repo root from {here}')


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


def main() -> int:
	root = _repo_root()
	handbooks_dir = root / 'handbooks'
	rows: list[tuple[str, int, int]] = []
	totals_caption = 0
	totals_image = 0
	for warnings_path in sorted(handbooks_dir.glob('*/*/warnings.json')):
		# .../handbooks/<slug>/<edition>/warnings.json
		slug = warnings_path.parts[-3]
		edition = warnings_path.parts[-2]
		caption, image = _count_warnings(warnings_path)
		rows.append((f'{slug} ({edition})', caption, image))
		totals_caption += caption
		totals_image += image

	# Group rows by slug for stable output. The directory iteration is
	# already sorted, but printing the slug+edition keeps readers honest
	# about which edition the count was measured against.
	print('| Handbook | caption-without-figure | figure-without-caption |')
	print('| -------- | ---------------------- | ---------------------- |')
	for label, caption, image in rows:
		print(f'| {label} | {caption} | {image} |')
	print(f'| **Total** | **{totals_caption}** | **{totals_image}** |')
	return 0


if __name__ == '__main__':
	sys.exit(main())
