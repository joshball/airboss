import { describe, expect, it } from 'vitest';
import { looksLikeSvrWarning, parseSvrWarning } from '../parse-svr-warning';

const FIXTURE_SVR_KBOX = `WWUS51 KBOX 191945
SVRBOX
Severe Thunderstorm Warning
National Weather Service Boston/Norton MA
345 PM EDT Tue May 19 2026

The National Weather Service in Boston/Norton has issued a

* Severe Thunderstorm Warning for...
  Northern Litchfield County in northwest Connecticut...

* Until 2245Z.

* At 1945Z, a severe thunderstorm was located 5 miles east of
  Torrington, moving northeast at 30 mph.

HAZARD...60 mph wind gusts and quarter size hail.

LAT...LON 4174 7290 4185 7271 4196 7268 4179 7295`;

const REFERENCE_NOW = new Date('2026-05-19T20:00:00Z');

describe('looksLikeSvrWarning', () => {
	it('accepts a valid SVR bulletin', () => {
		expect(looksLikeSvrWarning(FIXTURE_SVR_KBOX)).toBe(true);
	});

	it('rejects a Convective SIGMET', () => {
		expect(looksLikeSvrWarning('WSUS31 KKCI 192055\nSIGE\nCONVECTIVE SIGMET 70E')).toBe(false);
	});
});

describe('parseSvrWarning', () => {
	it('parses the issuing office and Zulu validity', () => {
		const parsed = parseSvrWarning(FIXTURE_SVR_KBOX, { now: REFERENCE_NOW });
		expect(parsed.office).toBe('KBOX');
		expect(parsed.validFrom?.toISOString()).toBe('2026-05-19T19:45:00.000Z');
		expect(parsed.validUntil.toISOString()).toBe('2026-05-19T22:45:00.000Z');
	});

	it('parses the area description', () => {
		const parsed = parseSvrWarning(FIXTURE_SVR_KBOX, { now: REFERENCE_NOW });
		expect(parsed.areaDescription).toMatch(/Litchfield County/);
	});

	it('parses HAZARD wind + hail tags', () => {
		const parsed = parseSvrWarning(FIXTURE_SVR_KBOX, { now: REFERENCE_NOW });
		expect(parsed.maxWindMph).toBe(60);
		expect(parsed.maxHailIn).toBe(1.0);
		expect(parsed.tornadoPossible).toBe(false);
	});

	it('decodes the LAT...LON polygon into [lat, -lon] tuples', () => {
		const parsed = parseSvrWarning(FIXTURE_SVR_KBOX, { now: REFERENCE_NOW });
		expect(parsed.polygon).not.toBeNull();
		expect(parsed.polygon).toHaveLength(4);
		expect(parsed.polygon?.[0]).toEqual([41.74, -72.9]);
		expect(parsed.polygon?.[3]).toEqual([41.79, -72.95]);
	});

	it('accepts the GFA-co-attached "End: 2215 UTC" shorthand', () => {
		const SHORT = `SVRBOX
Severe Thunderstorm Warning
End:2215 UTC 19 May
Office:KBOX`;
		const parsed = parseSvrWarning(SHORT, { now: new Date('2026-05-19T21:00:00Z') });
		expect(parsed.office).toBe('KBOX');
		expect(parsed.validUntil.toISOString()).toBe('2026-05-19T22:15:00.000Z');
	});
});
