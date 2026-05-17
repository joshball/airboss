/**
 * v2 temporal sampler test plan -- `sampleTruthAt` (TruthModel v2 step 2).
 *
 * Asserts:
 *   - Identity: a v1 truth model (no `evolution`) sampled at its own
 *     `validAt` deep-equals itself.
 *   - Identity holds for every existing v1 scenario, at any timestamp.
 *   - Front translation: a constant-motion front advances by motion x time
 *     and agrees with `advanceTruth` at an hour boundary.
 *   - Piecewise front motion: the displacement is the sum of per-segment
 *     translations and the speed change is observable.
 *   - Cell lifecycle: a temporal cell is absent before genesis and after
 *     dissipation, present in between, and translates with its motion.
 *   - Pre-frontal convection activates at `onsetAt`, not before.
 *   - Air-mass motion: a polygon translates; wind/temp drift applies.
 *   - Hazard lifecycle: a zone is absent before onset / after end.
 *   - Determinism: two calls with identical inputs are byte-equal.
 *   - The returned snapshot is a v1 model (`evolution` stripped).
 */

import { describe, expect, it } from 'vitest';
import { advanceTruth } from '../truth/advance';
import { DENSE_FOG_RADIATION_CENTRAL_VALLEY } from '../truth/scenarios/dense-fog-radiation-central-valley';
import { FRONTAL_XC_MARCH } from '../truth/scenarios/frontal-xc-march';
import { MARINE_STRATUS_PACIFIC_NW } from '../truth/scenarios/marine-stratus-pacific-nw';
import { MOUNTAIN_WAVE_ROCKIES } from '../truth/scenarios/mountain-wave-rockies';
import { SUMMER_THUNDERSTORMS_TX } from '../truth/scenarios/summer-thunderstorms-tx';
import { WINTER_ICING_GREAT_LAKES } from '../truth/scenarios/winter-icing-great-lakes';
import { sampleTruthAt } from '../truth/time';
import type { TruthModel } from '../truth/types';

const V1_SCENARIOS: TruthModel[] = [
	FRONTAL_XC_MARCH,
	SUMMER_THUNDERSTORMS_TX,
	WINTER_ICING_GREAT_LAKES,
	MOUNTAIN_WAVE_ROCKIES,
	MARINE_STRATUS_PACIFIC_NW,
	DENSE_FOG_RADIATION_CENTRAL_VALLEY,
];

const KM_PER_DEG_LAT = 111;
const KM_PER_NM = 1.852;

/** Build a minimal v2 truth model for focused evolution tests. */
function v2Fixture(overrides: Partial<TruthModel> = {}): TruthModel {
	const base: TruthModel = {
		scenarioId: 'v2-fixture',
		validAt: '2026-03-14T12:00:00Z',
		primaryTimeZone: 'America/Chicago',
		narrative: 'Synthetic fixture for sampleTruthAt evolution tests.',
		stations: {
			KICT: { icao: 'KICT', lon: -97.43, lat: 37.65, elevationFt: 1333, name: 'Wichita' },
		},
		synoptic: {
			pressureSystems: [],
			fronts: [
				{
					id: 'cf-1',
					kind: 'cold',
					points: [
						[-99, 39],
						[-99.5, 37],
						[-100, 35],
					],
					pipSide: 'E',
					motionDegTrue: 110,
					motionKt: 15,
					intensity: 'moderate',
				},
			],
		},
		airMasses: [
			{
				id: 'warm',
				classification: 'mT',
				polygon: [
					[-97, 35],
					[-95, 35],
					[-95, 40],
					[-97, 40],
				],
				surfaceTempC: 18,
				surfaceDewpointC: 12,
				stability: 'conditionally-unstable',
				surfaceWindDirDeg: 200,
				surfaceWindKt: 12,
				meanCloudCover: 'SCT',
				meanCloudBaseFtAgl: 5000,
				meanCloudTopFtAgl: 12000,
			},
		],
		upperLevel: { jetAxis: [], jetMaxKt: 0, windByAltitude: [] },
		convection: { cells: [], frontalBand: null, capeJperKgByStation: {} },
		diurnal: { solarNoonUtcHour: 18, mixingHeightFtMsl: 6000, nocturnalInversion: false },
		hazardZones: [
			{
				id: 'hz-tsra',
				kind: 'turbulence',
				polygon: [
					[-98, 36],
					[-96, 36],
					[-96, 39],
					[-98, 39],
					[-98, 36],
				],
				altitudeBandFtMsl: { min: 0, max: 30000 },
				source: 'Synthetic pre-frontal convection band.',
				severity: 'moderate',
			},
		],
		terrain: { ridges: [] },
		routeStations: ['KICT'],
		fbStations: ['KICT'],
		tafValidHours: 8,
	};
	return { ...base, ...overrides };
}

describe('sampleTruthAt -- identity property', () => {
	it('returns the v1 model verbatim when sampled at its own validAt', () => {
		const result = sampleTruthAt(FRONTAL_XC_MARCH, FRONTAL_XC_MARCH.validAt);
		expect(result).toBe(FRONTAL_XC_MARCH);
		expect(result).toEqual(FRONTAL_XC_MARCH);
	});

	it('is the identity for every v1 scenario at its validAt', () => {
		for (const scenario of V1_SCENARIOS) {
			const result = sampleTruthAt(scenario, scenario.validAt);
			expect(result).toEqual(scenario);
		}
	});

	it('is the identity for a v1 model at an arbitrary later timestamp', () => {
		// No `evolution` block -> no temporal rules -> the model is returned
		// unchanged regardless of `t`.
		const later = '2026-03-19T23:00:00Z';
		const result = sampleTruthAt(FRONTAL_XC_MARCH, later);
		expect(result).toEqual(FRONTAL_XC_MARCH);
	});
});

describe('sampleTruthAt -- front translation', () => {
	it('translates a constant-motion temporal front by motion x elapsed time', () => {
		const truth = v2Fixture({
			evolution: {
				start: '2026-03-14T12:00:00Z',
				end: '2026-03-14T20:00:00Z',
				stepMinutes: 60,
				fronts: [
					{
						id: 'cf-1',
						pointsAtStart: [
							[-99, 39],
							[-99.5, 37],
							[-100, 35],
						],
						motion: { kind: 'constant', bearingDeg: 90, speedKt: 20 },
					},
				],
				cells: [],
				airMassMotion: [],
				hazardLifecycle: [],
			},
		});
		// 4 hours at 20 kt due east -> 80 nm east, no latitude change.
		const sampled = sampleTruthAt(truth, '2026-03-14T16:00:00Z');
		const front = sampled.synoptic.fronts[0];
		if (front === undefined) throw new Error('unreachable');
		const distKm = 80 * KM_PER_NM;
		const firstPoint = front.points[0];
		if (firstPoint === undefined) throw new Error('unreachable');
		const expectedLon = -99 + distKm / (KM_PER_DEG_LAT * Math.cos((39 * Math.PI) / 180));
		expect(firstPoint[0]).toBeCloseTo(expectedLon, 4);
		expect(firstPoint[1]).toBeCloseTo(39, 6);
	});

	it('agrees with advanceTruth for a constant-motion front at an hour boundary', () => {
		const truth = v2Fixture({
			evolution: {
				start: '2026-03-14T12:00:00Z',
				end: '2026-03-14T20:00:00Z',
				stepMinutes: 60,
				fronts: [
					{
						id: 'cf-1',
						pointsAtStart: [
							[-99, 39],
							[-99.5, 37],
							[-100, 35],
						],
						motion: { kind: 'constant', bearingDeg: 110, speedKt: 15 },
					},
				],
				cells: [],
				airMassMotion: [],
				hazardLifecycle: [],
			},
		});
		const sampled = sampleTruthAt(truth, '2026-03-14T15:00:00Z');
		const advanced = advanceTruth(truth, 3);
		const sampledFront = sampled.synoptic.fronts[0];
		const advancedFront = advanced.synoptic.fronts[0];
		if (sampledFront === undefined || advancedFront === undefined) throw new Error('unreachable');
		sampledFront.points.forEach((point, i) => {
			const ref = advancedFront.points[i];
			if (ref === undefined) throw new Error('unreachable');
			expect(point[0]).toBeCloseTo(ref[0], 6);
			expect(point[1]).toBeCloseTo(ref[1], 6);
		});
	});

	it('accumulates piecewise segment translations and resolves intensity', () => {
		const truth = v2Fixture({
			evolution: {
				start: '2026-03-14T12:00:00Z',
				end: '2026-03-14T20:00:00Z',
				stepMinutes: 60,
				fronts: [
					{
						id: 'cf-1',
						pointsAtStart: [
							[-99, 39],
							[-99.5, 37],
							[-100, 35],
						],
						motion: {
							kind: 'piecewise',
							segments: [
								{ until: '2026-03-14T15:00:00Z', bearingDeg: 90, speedKt: 10 },
								{ until: '2026-03-14T20:00:00Z', bearingDeg: 90, speedKt: 30 },
							],
						},
						intensitySchedule: [
							{ at: '2026-03-14T12:00:00Z', intensity: 'moderate' },
							{ at: '2026-03-14T16:00:00Z', intensity: 'strong' },
						],
					},
				],
				cells: [],
				airMassMotion: [],
				hazardLifecycle: [],
			},
		});
		// At 18:00Z: segment 1 = 3h x 10 kt = 30 nm; segment 2 = 3h x 30 kt = 90 nm.
		// Total = 120 nm east.
		const sampled = sampleTruthAt(truth, '2026-03-14T18:00:00Z');
		const front = sampled.synoptic.fronts[0];
		if (front === undefined) throw new Error('unreachable');
		const point = front.points[0];
		if (point === undefined) throw new Error('unreachable');
		const distKm = 120 * KM_PER_NM;
		const expectedLon = -99 + distKm / (KM_PER_DEG_LAT * Math.cos((39 * Math.PI) / 180));
		expect(point[0]).toBeCloseTo(expectedLon, 4);
		expect(front.intensity).toBe('strong');
	});

	it('uses the v1 fallback intensity before the first schedule entry', () => {
		const truth = v2Fixture({
			evolution: {
				start: '2026-03-14T12:00:00Z',
				end: '2026-03-14T20:00:00Z',
				stepMinutes: 60,
				fronts: [
					{
						id: 'cf-1',
						pointsAtStart: [
							[-99, 39],
							[-99.5, 37],
						],
						motion: { kind: 'constant', bearingDeg: 90, speedKt: 10 },
						intensitySchedule: [{ at: '2026-03-14T16:00:00Z', intensity: 'strong' }],
					},
				],
				cells: [],
				airMassMotion: [],
				hazardLifecycle: [],
			},
		});
		const sampled = sampleTruthAt(truth, '2026-03-14T14:00:00Z');
		const front = sampled.synoptic.fronts[0];
		if (front === undefined) throw new Error('unreachable');
		// v1 front intensity in the fixture is 'moderate'.
		expect(front.intensity).toBe('moderate');
	});
});

describe('sampleTruthAt -- cell lifecycle', () => {
	const truth = v2Fixture({
		evolution: {
			start: '2026-03-14T12:00:00Z',
			end: '2026-03-14T20:00:00Z',
			stepMinutes: 60,
			fronts: [],
			cells: [
				{
					id: 'cell-a',
					initialLon: -97,
					initialLat: 37,
					genesisAt: '2026-03-14T14:00:00Z',
					dissipatesAt: '2026-03-14T18:00:00Z',
					motion: { bearingDeg: 90, speedKt: 20 },
					intensityCurve: 'building',
				},
			],
			airMassMotion: [],
			hazardLifecycle: [],
		},
	});

	it('omits a cell before its genesis', () => {
		const sampled = sampleTruthAt(truth, '2026-03-14T13:00:00Z');
		expect(sampled.convection.cells).toEqual([]);
	});

	it('includes a cell during its active window', () => {
		const sampled = sampleTruthAt(truth, '2026-03-14T15:00:00Z');
		expect(sampled.convection.cells).toHaveLength(1);
		expect(sampled.convection.cells[0]).toMatchObject({ id: 'cell-a' });
	});

	it('omits a cell after it dissipates', () => {
		const sampled = sampleTruthAt(truth, '2026-03-14T19:00:00Z');
		expect(sampled.convection.cells).toEqual([]);
	});

	it('translates an active cell by motion x time-since-genesis', () => {
		// 2 hours after genesis at 20 kt due east -> 40 nm east.
		const sampled = sampleTruthAt(truth, '2026-03-14T16:00:00Z');
		const cell = sampled.convection.cells[0];
		if (cell === undefined) throw new Error('unreachable');
		const distKm = 40 * KM_PER_NM;
		const expectedLon = -97 + distKm / (KM_PER_DEG_LAT * Math.cos((37 * Math.PI) / 180));
		expect(cell.lon).toBeCloseTo(expectedLon, 4);
		expect(cell.lat).toBeCloseTo(37, 6);
	});

	it('ramps a building cell intensity from low toward peak', () => {
		const early = sampleTruthAt(truth, '2026-03-14T14:00:00Z').convection.cells[0];
		const late = sampleTruthAt(truth, '2026-03-14T18:00:00Z').convection.cells[0];
		if (early === undefined || late === undefined) throw new Error('unreachable');
		expect(early.peakDbz).toBeLessThan(late.peakDbz);
	});
});

describe('sampleTruthAt -- pre-frontal convection', () => {
	const truth = v2Fixture({
		evolution: {
			start: '2026-03-14T12:00:00Z',
			end: '2026-03-14T20:00:00Z',
			stepMinutes: 60,
			fronts: [
				{
					id: 'cf-1',
					pointsAtStart: [
						[-99, 39],
						[-99.5, 37],
					],
					motion: { kind: 'constant', bearingDeg: 110, speedKt: 15 },
					prefrontalConvection: {
						leadDistanceNm: 60,
						onsetAt: '2026-03-14T15:00:00Z',
						cellTemplate: { radiusKm: 12, peakDbz: 50, motionMatchesFront: true },
					},
				},
			],
			cells: [],
			airMassMotion: [],
			hazardLifecycle: [],
		},
	});

	it('spawns no pre-frontal cells before onset', () => {
		const sampled = sampleTruthAt(truth, '2026-03-14T14:00:00Z');
		expect(sampled.convection.cells).toEqual([]);
	});

	it('spawns pre-frontal cells at and after onset', () => {
		const sampled = sampleTruthAt(truth, '2026-03-14T16:00:00Z');
		expect(sampled.convection.cells.length).toBeGreaterThan(0);
		expect(sampled.convection.cells.every((c) => c.id.includes('prefront'))).toBe(true);
		expect(sampled.convection.cells.every((c) => c.peakDbz === 50)).toBe(true);
	});
});

describe('sampleTruthAt -- air-mass motion', () => {
	it('translates an air-mass polygon and drifts its wind / temperature', () => {
		const truth = v2Fixture({
			evolution: {
				start: '2026-03-14T12:00:00Z',
				end: '2026-03-14T20:00:00Z',
				stepMinutes: 60,
				fronts: [],
				cells: [],
				airMassMotion: [
					{
						airMassId: 'warm',
						motion: { bearingDeg: 90, speedKt: 10 },
						surfaceWindShift: { perHour: { dirDeg: 5, speedKt: 1 } },
						temperatureDriftCPerHour: -0.5,
					},
				],
				hazardLifecycle: [],
			},
		});
		const sampled = sampleTruthAt(truth, '2026-03-14T16:00:00Z');
		const airMass = sampled.airMasses[0];
		if (airMass === undefined) throw new Error('unreachable');
		// 4 hours: wind dir +20deg, wind +4kt, temp -2C.
		expect(airMass.surfaceWindDirDeg).toBeCloseTo(220, 6);
		expect(airMass.surfaceWindKt).toBeCloseTo(16, 6);
		expect(airMass.surfaceTempC).toBeCloseTo(16, 6);
		// Polygon translated east -> first vertex lon increases.
		const v0 = airMass.polygon[0];
		if (v0 === undefined) throw new Error('unreachable');
		expect(v0[0]).toBeGreaterThan(-97);
	});

	it('leaves an air mass without a motion rule unchanged', () => {
		const truth = v2Fixture({
			evolution: {
				start: '2026-03-14T12:00:00Z',
				end: '2026-03-14T20:00:00Z',
				stepMinutes: 60,
				fronts: [],
				cells: [],
				airMassMotion: [],
				hazardLifecycle: [],
			},
		});
		const sampled = sampleTruthAt(truth, '2026-03-14T18:00:00Z');
		expect(sampled.airMasses).toEqual(truth.airMasses);
	});
});

describe('sampleTruthAt -- hazard lifecycle', () => {
	const truth = v2Fixture({
		evolution: {
			start: '2026-03-14T12:00:00Z',
			end: '2026-03-14T20:00:00Z',
			stepMinutes: 60,
			fronts: [],
			cells: [],
			airMassMotion: [],
			hazardLifecycle: [
				{
					hazardZoneId: 'hz-tsra',
					onsetAt: '2026-03-14T15:00:00Z',
					endAt: '2026-03-14T19:00:00Z',
					severitySchedule: [
						{ at: '2026-03-14T15:00:00Z', severity: 'moderate' },
						{ at: '2026-03-14T17:00:00Z', severity: 'severe' },
					],
				},
			],
		},
	});

	it('omits a hazard zone before onset', () => {
		const sampled = sampleTruthAt(truth, '2026-03-14T14:00:00Z');
		expect(sampled.hazardZones).toEqual([]);
	});

	it('includes a hazard zone during its active window', () => {
		const sampled = sampleTruthAt(truth, '2026-03-14T16:00:00Z');
		expect(sampled.hazardZones).toHaveLength(1);
		expect(sampled.hazardZones[0]?.severity).toBe('moderate');
	});

	it('escalates severity per the schedule', () => {
		const sampled = sampleTruthAt(truth, '2026-03-14T18:00:00Z');
		expect(sampled.hazardZones[0]?.severity).toBe('severe');
	});

	it('omits a hazard zone after it ends', () => {
		const sampled = sampleTruthAt(truth, '2026-03-14T20:00:00Z');
		expect(sampled.hazardZones).toEqual([]);
	});
});

describe('sampleTruthAt -- snapshot shape + determinism', () => {
	const truth = v2Fixture({
		evolution: {
			start: '2026-03-14T12:00:00Z',
			end: '2026-03-14T20:00:00Z',
			stepMinutes: 60,
			fronts: [
				{
					id: 'cf-1',
					pointsAtStart: [
						[-99, 39],
						[-99.5, 37],
					],
					motion: { kind: 'constant', bearingDeg: 110, speedKt: 15 },
				},
			],
			cells: [],
			airMassMotion: [],
			hazardLifecycle: [],
		},
	});

	it('strips the evolution block from the returned snapshot', () => {
		const sampled = sampleTruthAt(truth, '2026-03-14T15:00:00Z');
		expect(sampled.evolution).toBeUndefined();
		expect(sampled.validAt).toBe('2026-03-14T15:00:00Z');
	});

	it('does not mutate the input', () => {
		const snapshot = JSON.parse(JSON.stringify(truth));
		sampleTruthAt(truth, '2026-03-14T17:00:00Z');
		expect(truth).toEqual(snapshot);
	});

	it('is deterministic -- identical inputs yield byte-equal output', () => {
		const a = sampleTruthAt(truth, '2026-03-14T16:30:00Z');
		const b = sampleTruthAt(truth, '2026-03-14T16:30:00Z');
		expect(JSON.stringify(a)).toBe(JSON.stringify(b));
	});
});
