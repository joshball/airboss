/**
 * Test plan -- AIRMET text-bulletin emitter (`deriveAirmetBulletins`).
 *
 * - One bulletin per AIRMET family present; families emitted SIERRA/TANGO/ZULU.
 * - Header / reference / block grammar matches FAA AC 00-45H AIRMET format.
 * - Polygon vertices emitted in `Nxxxx Wxxxxx` notation; closed loop.
 * - Conditions lines map hazard kind correctly (IFR / MTN OBSCN / TURB / ICE).
 * - Altitude bands zero-padded / FL-tagged per FAA convention.
 * - Multiple hazards in one family share a bulletin, one block each.
 * - Issuance + valid times round-trip the advisory's window.
 */

import { AIRMET_FAMILIES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { deriveAirmets } from '../products/airmet';
import { deriveAirmetBulletins } from '../products/airmet-text';
import type { AirmetAdvisory } from '../products/types';
import { FRONTAL_XC_MARCH } from '../truth/scenarios/frontal-xc-march';
import type { HazardZone, TruthModel } from '../truth/types';

const SPIKE = FRONTAL_XC_MARCH;

/** Build a four-family hazard-zone set for exercising every AIRMET subject. */
function fourFamilyTruth(): TruthModel {
	const zones: HazardZone[] = [
		{
			id: 'HZ-ifr',
			kind: 'ifr',
			polygon: [
				[-90, 40],
				[-89, 40],
				[-89, 41],
				[-90, 40],
			],
			altitudeBandFtMsl: { min: 0, max: 4000 },
			source: 'test',
			severity: 'moderate',
		},
		{
			id: 'HZ-mtnobsc',
			kind: 'mountain-obscuration',
			polygon: [
				[-105, 39],
				[-104, 39],
				[-104, 40],
				[-105, 39],
			],
			altitudeBandFtMsl: { min: 0, max: 12000 },
			source: 'test',
			severity: 'moderate',
		},
		{
			id: 'HZ-turb',
			kind: 'turbulence',
			polygon: [
				[-95, 35],
				[-93, 35],
				[-93, 37],
				[-95, 35],
			],
			altitudeBandFtMsl: { min: 6000, max: 24000 },
			source: 'test',
			severity: 'moderate',
		},
		{
			id: 'HZ-icing',
			kind: 'icing',
			polygon: [
				[-85, 41],
				[-83, 41],
				[-83, 43],
				[-85, 41],
			],
			altitudeBandFtMsl: { min: 0, max: 12000 },
			source: 'test',
			severity: 'moderate',
		},
	];
	return { ...SPIKE, hazardZones: zones };
}

describe('deriveAirmetBulletins -- spike scenario (frontal-xc-march)', () => {
	const airmets = deriveAirmets(SPIKE);
	const bulletins = deriveAirmetBulletins(airmets);

	it('emits one bulletin per AIRMET family present', () => {
		// The spike has an IFR (Sierra) zone and two turbulence (Tango) zones.
		const families = bulletins.map((b) => b.family);
		expect(families).toEqual([AIRMET_FAMILIES.SIERRA, AIRMET_FAMILIES.TANGO]);
	});

	it('every bulletin starts with the WA type+region line', () => {
		for (const b of bulletins) {
			const firstLine = b.raw.split('\n')[0] ?? '';
			expect(firstLine).toMatch(/^KCI[STZ] WA \d{6}$/);
		}
	});

	it('every bulletin carries the AIRMET reference line with VALID UNTIL', () => {
		for (const b of bulletins) {
			const lines = b.raw.split('\n');
			expect(lines[1]).toMatch(/^AIRMET (SIERRA|TANGO|ZULU) UPDT \d+ FOR .+ VALID UNTIL \d{6}$/);
		}
	});

	it('emits one hazard block per advisory in the family', () => {
		const tango = bulletins.find((b) => b.family === AIRMET_FAMILIES.TANGO);
		expect(tango).toBeDefined();
		if (tango === undefined) throw new Error('unreachable');
		// Two turbulence zones -> two AIRMET TURB... blocks.
		const blockCount = tango.raw.split('\n').filter((l) => l.startsWith('AIRMET TURB...')).length;
		expect(blockCount).toBe(2);
		expect(tango.fromHazardZoneIds.length).toBe(2);
	});

	it('emits the FROM ... TO ... polygon chain in N/W vertex notation', () => {
		const sierra = bulletins.find((b) => b.family === AIRMET_FAMILIES.SIERRA);
		expect(sierra).toBeDefined();
		if (sierra === undefined) throw new Error('unreachable');
		const fromLine = sierra.raw.split('\n').find((l) => l.startsWith('FROM '));
		expect(fromLine).toBeDefined();
		if (fromLine === undefined) throw new Error('unreachable');
		expect(fromLine).toMatch(/^FROM N\d{4} W\d{5}( TO N\d{4} W\d{5})+$/);
	});

	it('closes the polygon -- first vertex repeated as last', () => {
		const sierra = bulletins.find((b) => b.family === AIRMET_FAMILIES.SIERRA);
		if (sierra === undefined) throw new Error('unreachable');
		const fromLine = sierra.raw.split('\n').find((l) => l.startsWith('FROM ')) ?? '';
		const vertices = fromLine.replace(/^FROM /, '').split(' TO ');
		expect(vertices.length).toBeGreaterThanOrEqual(4);
		expect(vertices[0]).toBe(vertices[vertices.length - 1]);
	});

	it('SIERRA IFR block carries the ceiling/visibility conditions line', () => {
		const sierra = bulletins.find((b) => b.family === AIRMET_FAMILIES.SIERRA);
		if (sierra === undefined) throw new Error('unreachable');
		expect(sierra.raw).toContain('CIG BLW 010 AND/OR VIS BLW 3SM PCPN/BR.');
	});

	it('every block carries a CONDS CONTG outlook line', () => {
		for (const b of bulletins) {
			const outlooks = b.raw.split('\n').filter((l) => l.startsWith('CONDS CONTG BYD '));
			expect(outlooks.length).toBe(b.fromHazardZoneIds.length);
			for (const line of outlooks) {
				expect(line).toMatch(/^CONDS CONTG BYD \d{4}Z THRU \d{4}Z\.$/);
			}
		}
	});

	it('issuance + valid window round-trip the advisory window', () => {
		const sierra = bulletins.find((b) => b.family === AIRMET_FAMILIES.SIERRA);
		if (sierra === undefined) throw new Error('unreachable');
		const sourceAdvisory = airmets.find((a) => a.kind === AIRMET_FAMILIES.SIERRA);
		expect(sourceAdvisory).toBeDefined();
		if (sourceAdvisory === undefined) throw new Error('unreachable');
		expect(sierra.validFrom).toBe(sourceAdvisory.validFrom);
		expect(sierra.validTo).toBe(sourceAdvisory.validTo);
		expect(sierra.issuedAt).toBe(sourceAdvisory.validFrom);
	});
});

describe('deriveAirmetBulletins -- hazard-subject mapping', () => {
	const truth = fourFamilyTruth();
	const bulletins = deriveAirmetBulletins(deriveAirmets(truth));

	it('produces SIERRA, TANGO, ZULU bulletins for the four-family set', () => {
		expect(bulletins.map((b) => b.family)).toEqual([
			AIRMET_FAMILIES.SIERRA,
			AIRMET_FAMILIES.TANGO,
			AIRMET_FAMILIES.ZULU,
		]);
	});

	it('SIERRA bulletin combines IFR + MTN OBSCN -- one reference line, two blocks', () => {
		const sierra = bulletins.find((b) => b.family === AIRMET_FAMILIES.SIERRA);
		if (sierra === undefined) throw new Error('unreachable');
		expect(sierra.raw).toContain('FOR IFR AND MTN OBSCN VALID UNTIL');
		expect(sierra.raw).toContain('AIRMET IFR...');
		expect(sierra.raw).toContain('AIRMET MTN OBSCN...');
		expect(sierra.raw).toContain('MTNS OBSC BY CLDS/PCPN/BR.');
	});

	it('TANGO bulletin uses the OCNL MOD TURB conditions line with a zero-padded band', () => {
		const tango = bulletins.find((b) => b.family === AIRMET_FAMILIES.TANGO);
		if (tango === undefined) throw new Error('unreachable');
		// 6000-24000 ft MSL -> `060 AND FL240`.
		expect(tango.raw).toContain('OCNL MOD TURB BTN 060 AND FL240.');
	});

	it('ZULU bulletin uses the MOD ICE conditions line', () => {
		const zulu = bulletins.find((b) => b.family === AIRMET_FAMILIES.ZULU);
		if (zulu === undefined) throw new Error('unreachable');
		// 0-12000 ft MSL -> `SFC AND 120`.
		expect(zulu.raw).toContain('MOD ICE BTN SFC AND 120.');
	});
});

describe('deriveAirmetBulletins -- edge cases', () => {
	it('returns an empty array when there are no advisories', () => {
		expect(deriveAirmetBulletins([])).toEqual([]);
	});

	it('orders bulletins SIERRA before TANGO before ZULU regardless of input order', () => {
		const advisories = deriveAirmets(fourFamilyTruth());
		// Reverse the advisory order; emission order must stay canonical.
		const reversed: AirmetAdvisory[] = [...advisories].reverse();
		const bulletins = deriveAirmetBulletins(reversed);
		expect(bulletins.map((b) => b.family)).toEqual([
			AIRMET_FAMILIES.SIERRA,
			AIRMET_FAMILIES.TANGO,
			AIRMET_FAMILIES.ZULU,
		]);
	});

	it('emits the AND-ABOVE band form for an open-topped hazard zone', () => {
		const openTop: HazardZone = {
			id: 'HZ-turb-opentop',
			kind: 'turbulence',
			polygon: [
				[-95, 35],
				[-93, 35],
				[-93, 37],
				[-95, 35],
			],
			altitudeBandFtMsl: { min: 18000, max: null },
			source: 'test',
			severity: 'moderate',
		};
		const truth: TruthModel = { ...SPIKE, hazardZones: [openTop] };
		const bulletins = deriveAirmetBulletins(deriveAirmets(truth));
		const tango = bulletins[0];
		expect(tango).toBeDefined();
		if (tango === undefined) throw new Error('unreachable');
		expect(tango.raw).toContain('OCNL MOD TURB BTN FL180 AND ABOVE.');
	});
});
