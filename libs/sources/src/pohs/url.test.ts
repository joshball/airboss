import { describe, expect, it } from 'vitest';
import type { SourceId } from '../types.ts';
import { getPohsLiveUrl } from './url.ts';

describe('getPohsLiveUrl', () => {
	it('returns null for a whole-POH locator (no formula)', () => {
		const id = 'airboss-ref:pohs/c172s' as SourceId;
		expect(getPohsLiveUrl(id, 'unspecified')).toBe(null);
	});

	it('returns null for a section locator', () => {
		const id = 'airboss-ref:pohs/c172s/section-2' as SourceId;
		expect(getPohsLiveUrl(id, 'unspecified')).toBe(null);
	});

	it('returns null for an emergency procedure locator', () => {
		const id = 'airboss-ref:pohs/pa-28-181/emergency/engine-fire' as SourceId;
		expect(getPohsLiveUrl(id, 'unspecified')).toBe(null);
	});

	it('returns null even with an edition pin', () => {
		const id = 'airboss-ref:pohs/c172s?at=2018-04' as SourceId;
		expect(getPohsLiveUrl(id, '2018-04')).toBe(null);
	});

	it('returns null for a non-pohs SourceId', () => {
		const id = 'airboss-ref:ac/61-65/j' as SourceId;
		expect(getPohsLiveUrl(id, 'unspecified')).toBe(null);
	});
});
