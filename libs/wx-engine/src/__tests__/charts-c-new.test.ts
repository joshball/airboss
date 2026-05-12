/**
 * Phase C unit tests for the C-new cluster (newly-authored chart-spec
 * derivations: GFA / convective-outlook / CVA / freezing-level /
 * G-AIRMET icing / G-AIRMET turbulence).
 *
 * The C-spike cluster lifts verbatim from the spike's working code, so
 * its correctness rides on the existing spike's recorded outputs and the
 * cross-cutting integration test (`charts-spike-parity.test.ts`). The
 * C-new cluster is fresh code; these tests assert the algorithmic
 * properties documented in tasks.md C.3 + test-plan.md WXENG-23 through
 * WXENG-27 before the next agent in the chain (Phase D / E) consumes
 * them.
 */

import { AIRMET_FAMILIES } from '@ab/constants';
import {
	deriveConvectiveOutlookChart,
	deriveCvaChart,
	deriveFreezingLevelChart,
	deriveGAirmetIcingChart,
	deriveGAirmetTurbulenceChart,
	deriveGfaChart,
	generateScenario,
} from '@ab/wx-engine/server';
import { describe, expect, it } from 'vitest';
import { FRONTAL_XC_MARCH } from '../truth/scenarios/frontal-xc-march';

interface PolygonHolder {
	rings: [number, number][][];
}

interface OutlookPolygon extends PolygonHolder {
	tier: string;
}

interface CvaPolygon extends PolygonHolder {
	category: string;
}

interface GairmetIcingArea extends PolygonHolder {
	intensity: string;
	altLow: number | undefined;
	altHigh: number | undefined;
}

interface GairmetTurbArea extends PolygonHolder {
	severity: string;
	topFl: number;
	bottomFl: number;
}

function jsonForFirstSource(chart: { sources: Array<{ bytes: string }> }): unknown {
	return JSON.parse(chart.sources[0]?.bytes ?? '{}');
}

describe('Phase C -- GFA derivation', () => {
	const bundle = generateScenario({ kind: 'frontal-xc-march' });
	const products = bundle.products;

	it('emits IFR area polygons for every Sierra-family AIRMET (WXENG-23)', () => {
		const chart = deriveGfaChart(FRONTAL_XC_MARCH, products.airmets, products.tafs, FRONTAL_XC_MARCH.scenarioId);
		const json = jsonForFirstSource(chart) as { polygons: Array<{ kind: string }> };
		const ifrPolygons = json.polygons.filter((p) => p.kind === 'ifr_area');
		const sierraCount = products.airmets.filter((a) => a.kind === AIRMET_FAMILIES.SIERRA).length;
		expect(ifrPolygons.length).toBe(sierraCount);
	});

	it('emits a precip_tstm polygon when the truth carries a frontal precipitation band', () => {
		const chart = deriveGfaChart(FRONTAL_XC_MARCH, products.airmets, products.tafs, FRONTAL_XC_MARCH.scenarioId);
		const json = jsonForFirstSource(chart) as { polygons: Array<{ kind: string }> };
		const tstmCount = json.polygons.filter((p) => p.kind === 'precip_tstm').length;
		expect(tstmCount).toBeGreaterThanOrEqual(1);
	});

	it('emits a slug of the form wx-scenarios/<id>/gfa', () => {
		const chart = deriveGfaChart(FRONTAL_XC_MARCH, products.airmets, products.tafs, FRONTAL_XC_MARCH.scenarioId);
		expect(chart.slug).toBe('wx-scenarios/frontal-xc-march/gfa');
	});
});

describe('Phase C -- convective-outlook derivation', () => {
	it('emits a tstm-tier polygon for the frontal precip band (WXENG-27)', () => {
		const chart = deriveConvectiveOutlookChart(FRONTAL_XC_MARCH, FRONTAL_XC_MARCH.scenarioId);
		const json = jsonForFirstSource(chart) as { polygons: OutlookPolygon[] };
		const tiers = json.polygons.map((p) => p.tier);
		expect(tiers.length).toBeGreaterThan(0);
		expect(tiers).toContain('tstm');
	});

	it('emits one polygon per cell at or above the dBZ threshold', () => {
		// Spike scenario has cells with peakDbz 48 + 42 -- both above 35
		// threshold. Each emits a polygon. Plus a frontal band polygon.
		const chart = deriveConvectiveOutlookChart(FRONTAL_XC_MARCH, FRONTAL_XC_MARCH.scenarioId);
		const json = jsonForFirstSource(chart) as { polygons: OutlookPolygon[] };
		expect(json.polygons.length).toBeGreaterThanOrEqual(2);
	});
});

describe('Phase C -- CVA derivation', () => {
	const bundle = generateScenario({ kind: 'frontal-xc-march' });
	const products = bundle.products;

	it('emits one observation per supplied METAR (WXENG-24)', () => {
		const chart = deriveCvaChart(FRONTAL_XC_MARCH, products.metars, FRONTAL_XC_MARCH.scenarioId);
		const json = jsonForFirstSource(chart) as {
			observations: Array<{ raw: string }>;
			polygons: CvaPolygon[];
		};
		expect(json.observations.length).toBe(products.metars.length);
	});

	it('lowers IFR hazard zones into CVA polygons with category IFR or LIFR', () => {
		const chart = deriveCvaChart(FRONTAL_XC_MARCH, products.metars, FRONTAL_XC_MARCH.scenarioId);
		const json = jsonForFirstSource(chart) as { polygons: CvaPolygon[] };
		const expectedIfr = FRONTAL_XC_MARCH.hazardZones.filter(
			(hz) => hz.kind === 'ifr' || hz.kind === 'mountain-obscuration',
		).length;
		expect(json.polygons.length).toBe(expectedIfr);
		for (const p of json.polygons) {
			expect(p.category === 'IFR' || p.category === 'LIFR').toBe(true);
		}
	});
});

describe('Phase C -- freezing-level derivation', () => {
	it('computes background freezing-level via temp/altitude interpolation (WXENG-25)', () => {
		const chart = deriveFreezingLevelChart(FRONTAL_XC_MARCH, FRONTAL_XC_MARCH.scenarioId);
		const json = jsonForFirstSource(chart) as {
			synth: { north_floor_ft: number; south_ceiling_ft: number; bumps: Array<{ amplitude_ft: number }> };
		};
		// Spike scenario: 3000 ft -> 5C, 6000 -> 0C, 9000 -> -5C -- background freezing level near 6000 ft.
		expect(json.synth.south_ceiling_ft).toBeGreaterThan(json.synth.north_floor_ft);
		const midpoint = (json.synth.north_floor_ft + json.synth.south_ceiling_ft) / 2;
		expect(midpoint).toBeGreaterThanOrEqual(3000);
		expect(midpoint).toBeLessThanOrEqual(9000);
	});

	it('emits negative-amplitude bumps for every icing hazard zone', () => {
		const chart = deriveFreezingLevelChart(FRONTAL_XC_MARCH, FRONTAL_XC_MARCH.scenarioId);
		const json = jsonForFirstSource(chart) as {
			synth: { bumps: Array<{ amplitude_ft: number }> };
		};
		const icingCount = FRONTAL_XC_MARCH.hazardZones.filter((hz) => hz.kind === 'icing').length;
		expect(json.synth.bumps.length).toBe(icingCount);
		for (const bump of json.synth.bumps) {
			expect(bump.amplitude_ft).toBeLessThan(0);
		}
	});
});

describe('Phase C -- G-AIRMET icing derivation', () => {
	const bundle = generateScenario({ kind: 'frontal-xc-march' });
	const products = bundle.products;

	it('emits only Zulu-family AIRMETs (WXENG-26)', () => {
		const chart = deriveGAirmetIcingChart(FRONTAL_XC_MARCH, products.airmets, FRONTAL_XC_MARCH.scenarioId);
		const json = jsonForFirstSource(chart) as { areas: GairmetIcingArea[] };
		const zuluCount = products.airmets.filter((a) => a.kind === AIRMET_FAMILIES.ZULU).length;
		expect(json.areas.length).toBe(zuluCount);
		for (const area of json.areas) {
			expect(['icing-light', 'icing-light-mod', 'icing-moderate', 'icing-severe']).toContain(area.intensity);
		}
	});
});

describe('Phase C -- G-AIRMET turbulence derivation', () => {
	const bundle = generateScenario({ kind: 'frontal-xc-march' });
	const products = bundle.products;

	it('emits only Tango-family AIRMETs (WXENG-26)', () => {
		const chart = deriveGAirmetTurbulenceChart(FRONTAL_XC_MARCH, products.airmets, FRONTAL_XC_MARCH.scenarioId);
		const json = jsonForFirstSource(chart) as { areas: GairmetTurbArea[] };
		const tangoCount = products.airmets.filter((a) => a.kind === AIRMET_FAMILIES.TANGO).length;
		expect(json.areas.length).toBe(tangoCount);
		for (const area of json.areas) {
			expect(['light', 'moderate', 'severe']).toContain(area.severity);
			expect(area.topFl).toBeGreaterThanOrEqual(area.bottomFl);
		}
	});
});
