/**
 * Phase A test plan -- truth-model Zod schema (WXENG-1 and WXENG-2).
 *
 * Validates that:
 *   - the lifted `frontal-xc-march` scenario passes `truthModelSchema`
 *   - polygon-min-vertices, CONUS-bounds, and required-severity rules reject
 *     intentionally malformed literals
 */

import { describe, expect, it } from 'vitest';
import { FRONTAL_XC_MARCH } from '../truth/scenarios/frontal-xc-march';
import { truthModelSchema } from '../truth/schema';
import type { TruthModel } from '../truth/types';

describe('truthModelSchema', () => {
	it('accepts the lifted frontal-xc-march scenario', () => {
		const parsed = truthModelSchema.safeParse(FRONTAL_XC_MARCH);
		expect(parsed.success).toBe(true);
	});

	it('rejects an air-mass polygon with only 2 vertices', () => {
		const broken: TruthModel = {
			...FRONTAL_XC_MARCH,
			airMasses: [
				{
					...(FRONTAL_XC_MARCH.airMasses[0] ?? {
						id: 'AM-stub',
						classification: 'mT',
						polygon: [],
						surfaceTempC: 0,
						surfaceDewpointC: 0,
						stability: 'stable',
						surfaceWindDirDeg: 0,
						surfaceWindKt: 0,
						meanCloudCover: 'SKC',
						meanCloudBaseFtAgl: null,
						meanCloudTopFtAgl: null,
					}),
					polygon: [
						[0, 0],
						[1, 1],
					],
				},
			],
		};
		const parsed = truthModelSchema.safeParse(broken);
		expect(parsed.success).toBe(false);
		if (!parsed.success) {
			const issuePaths = parsed.error.issues.map((issue) => issue.path.join('.'));
			expect(issuePaths.some((p) => p.startsWith('airMasses.0.polygon'))).toBe(true);
		}
	});

	it('rejects a station with longitude outside the CONUS bounds', () => {
		const broken: TruthModel = {
			...FRONTAL_XC_MARCH,
			stations: {
				...FRONTAL_XC_MARCH.stations,
				KBAD: { icao: 'KBAD', lon: -200, lat: 30, elevationFt: 100, name: 'Out of CONUS' },
			},
		};
		const parsed = truthModelSchema.safeParse(broken);
		expect(parsed.success).toBe(false);
		if (!parsed.success) {
			const issuePaths = parsed.error.issues.map((issue) => issue.path.join('.'));
			expect(issuePaths.some((p) => p.startsWith('stations.KBAD'))).toBe(true);
		}
	});

	it('rejects a station with latitude outside the CONUS bounds', () => {
		const broken: TruthModel = {
			...FRONTAL_XC_MARCH,
			stations: {
				...FRONTAL_XC_MARCH.stations,
				KARC: { icao: 'KARC', lon: -100, lat: 80, elevationFt: 100, name: 'Arctic' },
			},
		};
		const parsed = truthModelSchema.safeParse(broken);
		expect(parsed.success).toBe(false);
	});

	it('rejects a hazard zone with missing severity', () => {
		// The `severity` field is required at the type level. Construct a
		// scenario literal with severity intentionally missing using a
		// type-erased copy so the schema's runtime validation fires.
		const baseHazard = FRONTAL_XC_MARCH.hazardZones[0];
		expect(baseHazard).toBeDefined();
		if (!baseHazard) return;
		const hazardCopy = { ...baseHazard } as { severity?: typeof baseHazard.severity } & Omit<
			typeof baseHazard,
			'severity'
		>;
		delete hazardCopy.severity;
		const broken = {
			...FRONTAL_XC_MARCH,
			hazardZones: [hazardCopy],
		};
		const parsed = truthModelSchema.safeParse(broken);
		expect(parsed.success).toBe(false);
		if (!parsed.success) {
			const issuePaths = parsed.error.issues.map((issue) => issue.path.join('.'));
			expect(issuePaths.some((p) => p.startsWith('hazardZones.0.severity'))).toBe(true);
		}
	});

	it('rejects a hazard zone whose polygon ring does not close', () => {
		const baseHazard = FRONTAL_XC_MARCH.hazardZones[0];
		expect(baseHazard).toBeDefined();
		if (!baseHazard) return;
		const broken: TruthModel = {
			...FRONTAL_XC_MARCH,
			hazardZones: [
				{
					...baseHazard,
					polygon: [
						[-90, 39],
						[-89, 41],
						[-91, 42],
						// missing closure -- first/last differ
					],
				},
			],
		};
		const parsed = truthModelSchema.safeParse(broken);
		expect(parsed.success).toBe(false);
	});
});
