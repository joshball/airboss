import { describe, expect, it } from 'vitest';
import type { SourceId } from '../types.ts';
import { getPlatesLiveUrl } from './url.ts';

describe('getPlatesLiveUrl', () => {
	it('returns the dTPP landing page for a plate locator', () => {
		const id = 'airboss-ref:plates/KAPA/ils-rwy-35R' as SourceId;
		const url = getPlatesLiveUrl(id, 'unspecified');
		expect(url).toContain('faa.gov');
		expect(url).toContain('dtpp');
	});

	it('returns the dTPP landing page for an airport diagram', () => {
		const id = 'airboss-ref:plates/KSFO/airport-diagram' as SourceId;
		const url = getPlatesLiveUrl(id, 'unspecified');
		expect(url).toContain('dtpp');
	});

	it('strips the ?at= pin before parsing', () => {
		const id = 'airboss-ref:plates/KAPA/ils-rwy-35R?at=2026-04-23' as SourceId;
		const url = getPlatesLiveUrl(id, '2026-04-23');
		expect(url).toContain('faa.gov');
	});

	it('returns null for a non-plates SourceId', () => {
		const id = 'airboss-ref:ac/61-65/j' as SourceId;
		expect(getPlatesLiveUrl(id, 'unspecified')).toBe(null);
	});

	it('returns null for a malformed plates locator', () => {
		const id = 'airboss-ref:plates/KAPA' as SourceId;
		expect(getPlatesLiveUrl(id, 'unspecified')).toBe(null);
	});
});
