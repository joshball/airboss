/**
 * Phase B test plan -- Winds & Temps Aloft (FB) derivation (WXENG-15).
 *
 * - Spike scenario emits 5 stations x 9 altitudes = 45 rows.
 * - High-elevation rule: synthetic station at terrainElevationFt=5000 skips
 *   the 3000-ft row.
 * - Every direction in [0, 360); every speed in [0, 199] (FAA encoding cap).
 * - Output round-trips with zero warnings.
 */

import { describe, expect, it } from 'vitest';
import { deriveFbGrid } from '../products/winds-aloft';
import { FRONTAL_XC_MARCH } from '../truth/scenarios/frontal-xc-march';
import type { TruthModel } from '../truth/types';

const SPIKE = FRONTAL_XC_MARCH;

describe('deriveFbGrid -- spike scenario', () => {
	it('round-trips with zero warnings', () => {
		const fb = deriveFbGrid(SPIKE, SPIKE.fbStations);
		expect(fb.parsed.warnings).toEqual([]);
	});

	it('emits one row per altitude per station -- 5 stations x 9 altitudes = 45 rows', () => {
		const fb = deriveFbGrid(SPIKE, SPIKE.fbStations);
		expect(fb.parsed.stations.length).toBe(5);
		const totalRows = fb.parsed.stations.reduce((acc, s) => acc + s.rows.length, 0);
		expect(totalRows).toBe(45);
	});

	it('every direction in [0, 360) and every speed in [0, 199]', () => {
		const fb = deriveFbGrid(SPIKE, SPIKE.fbStations);
		for (const s of fb.parsed.stations) {
			for (const r of s.rows) {
				if (r.directionDeg !== null) {
					expect(r.directionDeg).toBeGreaterThanOrEqual(0);
					expect(r.directionDeg).toBeLessThan(360);
				}
				expect(r.speedKt).toBeGreaterThanOrEqual(0);
				expect(r.speedKt).toBeLessThanOrEqual(199);
			}
		}
	});

	it('emits a fixed-width FT header followed by per-station rows', () => {
		const fb = deriveFbGrid(SPIKE, SPIKE.fbStations);
		const lines = fb.raw.split('\n');
		// `DATA BASED ON ...`, `VALID ... FOR USE ...`, blank, FT header, then rows.
		expect(lines[0]).toMatch(/^DATA BASED ON /);
		expect(lines[1]).toMatch(/^VALID /);
		expect(lines[2]).toBe('');
		expect(lines[3]).toMatch(/^\s+FT\s+3000\s+6000/);
	});
});

describe('deriveFbGrid -- high-elevation skip rule', () => {
	it('skips low altitudes for a station above the 1500 ft AGL threshold', () => {
		const truth: TruthModel = {
			...SPIKE,
			stations: {
				...SPIKE.stations,
				// Aspen, CO elevation 7820 ft -- 3000 ft and 6000 ft rows
				// fall below station + 1500 ft AGL and are skipped.
				KASE: { icao: 'KASE', lon: -106.87, lat: 39.22, elevationFt: 7820, name: 'Aspen Pitkin County' },
			},
			fbStations: ['KASE'],
		};
		const fb = deriveFbGrid(truth, truth.fbStations);
		expect(fb.parsed.warnings).toEqual([]);
		expect(fb.parsed.stations.length).toBe(1);
		// The raw bulletin emits blank column placeholders for the skipped
		// altitudes -- the row begins with whitespace where 3000 + 6000 ft
		// data would normally sit. The parser's whitespace-splitting reads
		// the surviving columns; we assert on the raw emit form instead.
		const lines = fb.raw.split('\n');
		const aseLine = lines.find((l) => l.startsWith('ASE'));
		expect(aseLine).toBeDefined();
		if (aseLine === undefined) throw new Error('unreachable');
		// At KASE elevation 7820 ft, the 3000 / 6000 / 9000 ft rows fall below
		// station + 1500 ft AGL and become blank columns. The 12000 ft row is
		// the first emitted column.
		const afterPrefix = aseLine.slice('ASE '.length);
		expect(afterPrefix.slice(0, 14)).toMatch(/^\s+$/);
		const stn = fb.parsed.stations[0];
		if (stn === undefined) throw new Error('unreachable');
		// 9 standard altitudes - 3 skipped (3000 / 6000 / 9000) = 6 surviving.
		expect(stn.rows.length).toBe(6);
	});
});
