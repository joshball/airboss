/**
 * Phase B test plan -- AIRMET derivation (WXENG-14).
 *
 * - Spike scenario produces one AIRMET per hazard zone (3 in the spike).
 * - Every ring closes (first point repeated as last).
 * - Every `fromHazardZoneId` resolves to a real hazard zone.
 * - Family mapping: ifr/mountain-obscuration -> Sierra; turbulence -> Tango;
 *   icing -> Zulu.
 */

import { AIRMET_FAMILIES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { deriveAirmets } from '../products/airmet';
import { FRONTAL_XC_MARCH } from '../truth/scenarios/frontal-xc-march';
import type { HazardZone, TruthModel } from '../truth/types';

const SPIKE = FRONTAL_XC_MARCH;

describe('deriveAirmets', () => {
	it('produces one AIRMET per hazard zone in the spike scenario', () => {
		const airmets = deriveAirmets(SPIKE);
		expect(airmets.length).toBe(SPIKE.hazardZones.length);
		expect(airmets.length).toBe(3);
	});

	it('closes every ring (first point repeated as last)', () => {
		const airmets = deriveAirmets(SPIKE);
		for (const a of airmets) {
			expect(a.rings.length).toBeGreaterThanOrEqual(1);
			for (const ring of a.rings) {
				expect(ring.length).toBeGreaterThanOrEqual(4);
				const first = ring[0];
				const last = ring[ring.length - 1];
				expect(first).toBeDefined();
				expect(last).toBeDefined();
				if (first === undefined || last === undefined) throw new Error('unreachable');
				expect(first[0]).toBe(last[0]);
				expect(first[1]).toBe(last[1]);
			}
		}
	});

	it('every fromHazardZoneId resolves to a real hazard zone', () => {
		const airmets = deriveAirmets(SPIKE);
		const zoneIds = new Set(SPIKE.hazardZones.map((z) => z.id));
		for (const a of airmets) {
			expect(zoneIds.has(a.fromHazardZoneId)).toBe(true);
		}
	});

	it('maps hazard kind to AIRMET family correctly', () => {
		const variants: HazardZone[] = [
			{
				id: 'HZ-test-ifr',
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
				id: 'HZ-test-mtnobsc',
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
				id: 'HZ-test-turb',
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
				id: 'HZ-test-icing',
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
		const truth: TruthModel = { ...SPIKE, hazardZones: variants };
		const airmets = deriveAirmets(truth);
		expect(airmets.length).toBe(4);
		const byZone: Record<string, string> = {};
		for (const a of airmets) byZone[a.fromHazardZoneId] = a.kind;
		expect(byZone['HZ-test-ifr']).toBe(AIRMET_FAMILIES.SIERRA);
		expect(byZone['HZ-test-mtnobsc']).toBe(AIRMET_FAMILIES.SIERRA);
		expect(byZone['HZ-test-turb']).toBe(AIRMET_FAMILIES.TANGO);
		expect(byZone['HZ-test-icing']).toBe(AIRMET_FAMILIES.ZULU);
	});
});
