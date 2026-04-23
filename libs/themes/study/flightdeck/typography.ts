/**
 * study/flightdeck typography.
 *
 * Dashboard routes still want a sharper, more operational feel than the
 * reading-column study pages, but the all-mono compact pack was too far
 * from the rest of the product and ended up feeling undersized on laptop
 * screens. Flightdeck now keeps the shared sans-first base pack and only
 * leans on mono as an accent through chrome + data labels.
 */

import type { TypographyPack } from '../../contract';
import { AIRBOSS_STANDARD_PACK } from '../../core/typography-packs';

export const typography: TypographyPack = {
	...AIRBOSS_STANDARD_PACK,
	packId: 'study-flightdeck-balanced',
	bundles: {
		reading: {
			body: {
				...AIRBOSS_STANDARD_PACK.bundles.reading.body,
				size: '1rem',
				lineHeight: 1.55,
			},
			lead: {
				...AIRBOSS_STANDARD_PACK.bundles.reading.lead,
				size: '1.125rem',
				lineHeight: 1.45,
			},
			caption: {
				...AIRBOSS_STANDARD_PACK.bundles.reading.caption,
				size: '0.875rem',
				lineHeight: 1.45,
			},
			quote: AIRBOSS_STANDARD_PACK.bundles.reading.quote,
		},
		heading: {
			1: {
				...AIRBOSS_STANDARD_PACK.bundles.heading[1],
				size: '1.875rem',
				lineHeight: 1.1,
				tracking: '-0.02em',
			},
			2: {
				...AIRBOSS_STANDARD_PACK.bundles.heading[2],
				size: '1.5rem',
				lineHeight: 1.15,
				tracking: '-0.02em',
			},
			3: {
				...AIRBOSS_STANDARD_PACK.bundles.heading[3],
				size: '1.125rem',
				lineHeight: 1.25,
			},
			4: {
				...AIRBOSS_STANDARD_PACK.bundles.heading[4],
				size: '1rem',
				lineHeight: 1.4,
			},
			5: {
				...AIRBOSS_STANDARD_PACK.bundles.heading[5],
				size: '0.9375rem',
				lineHeight: 1.4,
			},
			6: {
				...AIRBOSS_STANDARD_PACK.bundles.heading[6],
				size: '0.875rem',
				lineHeight: 1.4,
			},
		},
		ui: {
			control: {
				...AIRBOSS_STANDARD_PACK.bundles.ui.control,
				size: '1rem',
			},
			label: {
				...AIRBOSS_STANDARD_PACK.bundles.ui.label,
				size: '0.9375rem',
				lineHeight: 1.45,
			},
			caption: {
				...AIRBOSS_STANDARD_PACK.bundles.ui.caption,
				size: '0.8125rem',
				lineHeight: 1.4,
				tracking: '0.06em',
			},
			badge: {
				...AIRBOSS_STANDARD_PACK.bundles.ui.badge,
				size: '0.8125rem',
			},
		},
		code: AIRBOSS_STANDARD_PACK.bundles.code,
		definition: {
			term: {
				...AIRBOSS_STANDARD_PACK.bundles.definition.term,
				size: '1rem',
				lineHeight: 1.45,
			},
			body: {
				...AIRBOSS_STANDARD_PACK.bundles.definition.body,
				size: '1rem',
				lineHeight: 1.55,
			},
		},
	},
};
