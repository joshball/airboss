/**
 * AIRMET explain tests. The lib accepts the `AirmetAdvisory` shape from
 * wx-engine; the catalog stores the raw text + a parsed-JSON sidecar.
 * For this unit test we construct an advisory shape directly so we
 * don't take a runtime dep on the catalog JSON's parsed-polygon block.
 */

import type { AirmetAdvisory } from '@ab/wx-engine';
import { describe, expect, it } from 'vitest';
import { explainAirmet } from '../airmet';

describe('explainAirmet', () => {
	it('produces annotations for a basic AIRMET Sierra IFR advisory', () => {
		const advisory: AirmetAdvisory = {
			id: 'test-sierra-ifr',
			kind: 'airmet-sierra-ifr',
			label: 'AIRMET SIERRA - IFR',
			rings: [
				[
					[-123, 47],
					[-122, 46],
					[-120, 46],
					[-123, 47],
				],
			],
			validFrom: '2026-05-12T14:45:00Z',
			validTo: '2026-05-12T21:00:00Z',
			fromHazardZoneId: 'ifr-test-zone',
		};
		const annotations = explainAirmet(advisory);
		expect(annotations.length).toBeGreaterThan(0);
		expect(annotations.some((a) => a.family === 'airmet-kind')).toBe(true);
		expect(annotations.some((a) => a.family === 'airmet-validity')).toBe(true);
		expect(annotations.some((a) => a.family === 'airmet-ring')).toBe(true);
	});
});
