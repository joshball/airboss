/**
 * Phase B test plan -- PIREP derivation (WXENG-16).
 *
 * - Spike scenario emits 3 PIREPs (matches recorded
 *   data/wx-scenarios/frontal-xc-march/products/pireps.json).
 * - The KSPI PIREP near the Tango polygon carries MOD chop.
 * - The KMLI PIREP carries LGT chop in the cold sector.
 * - The KORD PIREP carries LGT chop with smooth-below remarks.
 * - Every PIREP round-trips with zero warnings.
 */

import { describe, expect, it } from 'vitest';
import { derivePireps } from '../products/pirep';
import { FRONTAL_XC_MARCH } from '../truth/scenarios/frontal-xc-march';

const SPIKE = FRONTAL_XC_MARCH;

describe('derivePireps -- spike scenario', () => {
	it('emits 3 PIREPs', () => {
		const pireps = derivePireps(SPIKE);
		expect(pireps.length).toBe(3);
	});

	it('every PIREP round-trips with zero warnings', () => {
		const pireps = derivePireps(SPIKE);
		for (const p of pireps) {
			expect(p.parsed.warnings).toEqual([]);
		}
	});

	it('the KSPI PIREP carries MOD turbulence', () => {
		const pireps = derivePireps(SPIKE);
		const spi = pireps.find((p) => p.parsed.station === 'KSPI');
		expect(spi).toBeDefined();
		if (spi === undefined) throw new Error('unreachable');
		expect(spi.parsed.kind).toBe('UUA');
		expect(spi.parsed.turbulence?.intensity).toBe('MOD');
		expect(spi.parsed.weather).toContain('RA');
	});

	it('the KORD PIREP carries LGT chop with smooth-below remarks', () => {
		const pireps = derivePireps(SPIKE);
		const ord = pireps.find((p) => p.parsed.station === 'KORD');
		expect(ord).toBeDefined();
		if (ord === undefined) throw new Error('unreachable');
		expect(ord.parsed.turbulence?.intensity).toBe('LGT');
		expect(ord.parsed.remarks).toContain('SMOOTH BELOW');
	});

	it('the KMLI PIREP carries LGT chop in the post-frontal cold sector', () => {
		const pireps = derivePireps(SPIKE);
		const mli = pireps.find((p) => p.parsed.station === 'KMLI');
		expect(mli).toBeDefined();
		if (mli === undefined) throw new Error('unreachable');
		expect(mli.parsed.turbulence?.intensity).toBe('LGT');
	});

	it('every PIREP location is anchored near its station within 1 deg', () => {
		const pireps = derivePireps(SPIKE);
		for (const p of pireps) {
			const station = SPIKE.stations[p.parsed.station];
			expect(station).toBeDefined();
			if (station === undefined) throw new Error('unreachable');
			expect(Math.abs(p.lon - station.lon)).toBeLessThanOrEqual(1);
			expect(Math.abs(p.lat - station.lat)).toBeLessThanOrEqual(1);
		}
	});
});
