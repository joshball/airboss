/**
 * Phase B test plan -- TAF derivation (WXENG-13).
 *
 * - KORD's TAF for the spike scenario has exactly one FM group within +/- 1
 *   hour of the projected front-arrival time.
 * - KSTL's TAF (warm sector, front passes east) has no FM group.
 * - The FM transition's wind direction matches the post-frontal mass.
 */

import { describe, expect, it } from 'vitest';
import { deriveTaf } from '../products/taf';
import { advanceTruth } from '../truth/advance';
import { findAirMass } from '../truth/geometry';
import { FRONTAL_XC_MARCH } from '../truth/scenarios/frontal-xc-march';

const SPIKE = FRONTAL_XC_MARCH;

describe('deriveTaf -- post-frontal arrival (KORD)', () => {
	it('round-trips clean with zero warnings', () => {
		const t = deriveTaf(SPIKE, 'KORD', { validHours: 12 });
		expect(t.parsed.warnings).toEqual([]);
	});

	it('contains exactly one FM group matching the projected front-arrival hour', () => {
		const t = deriveTaf(SPIKE, 'KORD', { validHours: 12 });
		const fmPeriods = t.parsed.periods.filter((p) => p.kind === 'FM');
		expect(fmPeriods.length).toBe(1);

		// Compute the projected front-arrival hour at KORD by walking advanceTruth
		// in 1-hour steps until the air mass under KORD changes.
		const ord = SPIKE.stations.KORD;
		if (ord === undefined) throw new Error('expected KORD in spike');
		const initialMass = findAirMass(SPIKE, [ord.lon, ord.lat]);
		expect(initialMass).not.toBeNull();
		let arrivalHour: number | null = null;
		for (let h = 1; h <= 12; h += 1) {
			const evolved = advanceTruth(SPIKE, h);
			const am = findAirMass(evolved, [ord.lon, ord.lat]);
			if (am !== null && am.id !== initialMass?.id) {
				arrivalHour = h;
				break;
			}
		}
		expect(arrivalHour).not.toBeNull();
		if (arrivalHour === null) throw new Error('unreachable');

		const fm = fmPeriods[0];
		if (fm === undefined) throw new Error('unreachable');
		const fmHour = new Date(fm.start).getUTCHours();
		const projectedHour = (new Date(SPIKE.validAt).getUTCHours() + arrivalHour) % 24;
		const diff = Math.min(Math.abs(fmHour - projectedHour), 24 - Math.abs(fmHour - projectedHour));
		expect(diff).toBeLessThanOrEqual(1);
	});

	it('the FM transition wind direction matches the post-frontal cP mass', () => {
		const t = deriveTaf(SPIKE, 'KORD', { validHours: 12 });
		const fm = t.parsed.periods.find((p) => p.kind === 'FM');
		expect(fm).toBeDefined();
		const coldMass = SPIKE.airMasses.find((a) => a.classification === 'cP');
		expect(coldMass).toBeDefined();
		if (fm === undefined || coldMass === undefined) throw new Error('unreachable');
		expect(fm.wind?.directionDeg).toBe(coldMass.surfaceWindDirDeg);
	});
});

describe('deriveTaf -- post-frontal already (KSPI / KMLI)', () => {
	it('KSPI is already deep in the cold sector and never re-transitions', () => {
		const t = deriveTaf(SPIKE, 'KSPI', { validHours: 12 });
		expect(t.parsed.warnings).toEqual([]);
		const fmPeriods = t.parsed.periods.filter((p) => p.kind === 'FM');
		expect(fmPeriods.length).toBe(0);
	});

	it('KMLI is already deep in the cold sector and never re-transitions', () => {
		const t = deriveTaf(SPIKE, 'KMLI', { validHours: 12 });
		expect(t.parsed.warnings).toEqual([]);
		const fmPeriods = t.parsed.periods.filter((p) => p.kind === 'FM');
		expect(fmPeriods.length).toBe(0);
	});
});
