/**
 * v2 temporal derivation surface test plan (TruthModel v2 step 3).
 *
 * Asserts:
 *   - `deriveMetarAt` === `deriveMetar(sampleTruthAt(...))` and round-trips
 *     through the parser with zero warnings.
 *   - `deriveMetarSequence` emits one METAR per step, each round-trip clean.
 *   - `deriveTafSequence` emits one TAF per issue time.
 *   - `deriveAirmetTimeline` records issue/cancel events lined up with the
 *     hazard-zone lifecycle.
 *   - `buildTimeline` pre-renders one v1-shape snapshot per step.
 *   - the v2 wrappers never touch the existing deriveX signatures.
 */

import { describe, expect, it } from 'vitest';
import { deriveMetar } from '../products/metar';
import {
	buildTimeline,
	deriveAirmetTimeline,
	deriveMetarAt,
	deriveMetarSequence,
	deriveTafSequence,
} from '../products/temporal';
import { sampleTruthAt } from '../truth/time';
import type { TruthModel } from '../truth/types';

/** A v2 truth model with a moving front + a hazard zone with a lifecycle. */
function v2Truth(): TruthModel {
	return {
		scenarioId: 'temporal-derivation-fixture',
		validAt: '2026-03-14T12:00:00Z',
		primaryTimeZone: 'America/Chicago',
		narrative: 'Synthetic v2 fixture exercising the temporal derivation surface.',
		stations: {
			KICT: { icao: 'KICT', lon: -97.43, lat: 37.65, elevationFt: 1333, name: 'Wichita' },
			KTOP: { icao: 'KTOP', lon: -95.62, lat: 39.07, elevationFt: 881, name: 'Topeka' },
		},
		synoptic: {
			pressureSystems: [
				{ id: 'L-plains', kind: 'L', lon: -99, lat: 42, centralPressureMb: 1000, motionDegTrue: 90, motionKt: 20 },
			],
			fronts: [
				{
					id: 'cf-1',
					kind: 'cold',
					points: [
						[-101, 40],
						[-101.5, 38],
						[-102, 36],
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
					[-99, 35],
					[-90, 35],
					[-90, 43],
					[-99, 43],
					[-99, 35],
				],
				surfaceTempC: 17,
				surfaceDewpointC: 12,
				stability: 'conditionally-unstable',
				surfaceWindDirDeg: 200,
				surfaceWindKt: 12,
				meanCloudCover: 'SCT',
				meanCloudBaseFtAgl: 5000,
				meanCloudTopFtAgl: 12000,
			},
			{
				id: 'cold',
				classification: 'cP',
				polygon: [
					[-110, 35],
					[-101, 35],
					[-101, 43],
					[-110, 43],
					[-110, 35],
				],
				surfaceTempC: 5,
				surfaceDewpointC: -2,
				stability: 'stable',
				surfaceWindDirDeg: 320,
				surfaceWindKt: 18,
				meanCloudCover: 'OVC',
				meanCloudBaseFtAgl: 2500,
				meanCloudTopFtAgl: 7000,
			},
		],
		upperLevel: { jetAxis: [], jetMaxKt: 0, windByAltitude: [] },
		convection: { cells: [], frontalBand: null, capeJperKgByStation: { KICT: 600, KTOP: 500 } },
		diurnal: { solarNoonUtcHour: 18, mixingHeightFtMsl: 6000, nocturnalInversion: false },
		hazardZones: [
			{
				id: 'hz-turb',
				kind: 'turbulence',
				polygon: [
					[-99, 36],
					[-96, 36],
					[-96, 40],
					[-99, 40],
					[-99, 36],
				],
				altitudeBandFtMsl: { min: 6000, max: 24000 },
				source: 'Synthetic cold-sector turbulence.',
				severity: 'moderate',
			},
		],
		terrain: { ridges: [] },
		routeStations: ['KICT', 'KTOP'],
		fbStations: ['KICT', 'KTOP'],
		tafValidHours: 12,
		evolution: {
			start: '2026-03-14T12:00:00Z',
			end: '2026-03-14T16:00:00Z',
			stepMinutes: 60,
			fronts: [
				{
					id: 'cf-1',
					pointsAtStart: [
						[-101, 40],
						[-101.5, 38],
						[-102, 36],
					],
					motion: { kind: 'constant', bearingDeg: 110, speedKt: 15 },
				},
			],
			cells: [],
			airMassMotion: [{ airMassId: 'cold', motion: { bearingDeg: 110, speedKt: 18 } }],
			hazardLifecycle: [
				{
					hazardZoneId: 'hz-turb',
					onsetAt: '2026-03-14T13:00:00Z',
					endAt: '2026-03-14T15:00:00Z',
				},
			],
		},
	};
}

describe('deriveMetarAt', () => {
	it('equals deriveMetar on the sampled snapshot', () => {
		const truth = v2Truth();
		const t = '2026-03-14T14:00:00Z';
		const direct = deriveMetar(sampleTruthAt(truth, t), 'KICT', t);
		const viaWrapper = deriveMetarAt(truth, 'KICT', t);
		expect(viaWrapper.raw).toBe(direct.raw);
	});

	it('round-trips through the METAR parser with zero warnings', () => {
		const truth = v2Truth();
		const m = deriveMetarAt(truth, 'KICT', '2026-03-14T14:00:00Z');
		expect(m.parsed.warnings).toEqual([]);
	});

	it('collapses to deriveMetar on a v1 truth model (no evolution)', () => {
		const truth = v2Truth();
		const { evolution: _evolution, ...v1 } = truth;
		const t = v1.validAt;
		const viaWrapper = deriveMetarAt(v1, 'KICT', t);
		const direct = deriveMetar(v1, 'KICT', t);
		expect(viaWrapper.raw).toBe(direct.raw);
	});
});

describe('deriveMetarSequence', () => {
	it('emits one METAR per hourly step across the window (inclusive)', () => {
		const truth = v2Truth();
		const sequence = deriveMetarSequence(truth, 'KICT');
		// 12Z..16Z at 60 min -> 5 timestamps.
		expect(sequence).toHaveLength(5);
	});

	it('emits round-trip-clean METARs at every step', () => {
		const truth = v2Truth();
		for (const m of deriveMetarSequence(truth, 'KTOP')) {
			expect(m.parsed.warnings).toEqual([]);
		}
	});

	it('honors a custom step size', () => {
		const truth = v2Truth();
		// 12Z..16Z at 120 min -> 12Z, 14Z, 16Z = 3.
		const sequence = deriveMetarSequence(truth, 'KICT', { stepMinutes: 120 });
		expect(sequence).toHaveLength(3);
	});

	it('throws on a v1 truth model', () => {
		const { evolution: _evolution, ...v1 } = v2Truth();
		expect(() => deriveMetarSequence(v1, 'KICT')).toThrow(/evolution/);
	});
});

describe('deriveTafSequence', () => {
	it('emits one TAF per issue time', () => {
		const truth = v2Truth();
		const tafs = deriveTafSequence(truth, 'KICT', {
			issueTimes: ['2026-03-14T12:00:00Z', '2026-03-14T15:00:00Z'],
		});
		expect(tafs).toHaveLength(2);
	});

	it('emits round-trip-clean TAFs', () => {
		const truth = v2Truth();
		const tafs = deriveTafSequence(truth, 'KICT', { issueTimes: ['2026-03-14T12:00:00Z'] });
		for (const taf of tafs) {
			expect(taf.parsed.warnings).toEqual([]);
		}
	});
});

describe('deriveAirmetTimeline', () => {
	it('records an issue + cancel event lined up with the hazard lifecycle', () => {
		const truth = v2Truth();
		const timeline = deriveAirmetTimeline(truth);
		expect(timeline).toHaveLength(1);
		const entry = timeline[0];
		if (entry === undefined) throw new Error('unreachable');
		expect(entry.advisory.fromHazardZoneId).toBe('hz-turb');
		// Hazard onsets at 13Z, ends at 15Z. The advisory is seen 13Z + 14Z;
		// 15Z is the end instant which the lifecycle excludes (exclusive end).
		const issue = entry.events.find((e) => e.kind === 'issue');
		const cancel = entry.events.find((e) => e.kind === 'cancel');
		expect(issue?.at).toBe('2026-03-14T13:00:00.000Z');
		expect(cancel).toBeDefined();
	});
});

describe('buildTimeline', () => {
	it('pre-renders one v1-shape snapshot per step', () => {
		const truth = v2Truth();
		const timeline = buildTimeline(truth);
		expect(timeline).toHaveLength(5);
		for (const snapshot of timeline) {
			expect(snapshot.truth.evolution).toBeUndefined();
		}
	});

	it('reports elapsed hours since the window start', () => {
		const truth = v2Truth();
		const timeline = buildTimeline(truth);
		expect(timeline[0]?.hoursSinceStart).toBe(0);
		expect(timeline[timeline.length - 1]?.hoursSinceStart).toBe(4);
	});
});
