/**
 * Constants for the weather-chart library. The chart-type and layer-band
 * sets are closed contracts -- changing the set requires a substrate
 * version bump and `bun run charts build --all`. These tests guard the
 * shape so a typo or accidental drop is caught at the constant boundary.
 */

import { describe, expect, it } from 'vitest';
import {
	CHART_TYPE_LABELS,
	CHART_TYPE_VALUES,
	CHART_TYPES,
	FAA_FLIGHT_CATEGORIES,
	FAA_FLIGHT_CATEGORY_VALUES,
	LAYER_BAND_VALUES,
	LAYER_BANDS,
	WX_CHART_SLUG_REGEX,
	WX_CHART_SVG_HARD_LIMIT_BYTES,
	WX_CHART_SVG_WARN_BYTES,
} from './wx-charts';

describe('CHART_TYPES', () => {
	it('enumerates all v1 chart types (20 total)', () => {
		// 10 PPL ACS Task C K2 cluster types + G-AIRMET turbulence + GTG (#783)
		// + G-AIRMET icing + CIP + FIP + freezing-level (#785) + TAF timeline
		// (#784) + GOES IR / VIS / WV satellite (#786) = 20.
		expect(CHART_TYPE_VALUES).toHaveLength(20);
	});

	it('every value has a matching label', () => {
		for (const v of CHART_TYPE_VALUES) {
			expect(CHART_TYPE_LABELS[v].length).toBeGreaterThan(0);
		}
	});

	it('values are unique', () => {
		const set = new Set(CHART_TYPE_VALUES);
		expect(set.size).toBe(CHART_TYPE_VALUES.length);
	});

	it('includes the Phase A surface-analysis type', () => {
		expect(CHART_TYPE_VALUES).toContain(CHART_TYPES.SURFACE_ANALYSIS);
	});

	it('includes the Phase F satellite types (IR, visible, water vapor)', () => {
		expect(CHART_TYPE_VALUES).toContain(CHART_TYPES.SATELLITE_IR);
		expect(CHART_TYPE_VALUES).toContain(CHART_TYPES.SATELLITE_VISIBLE);
		expect(CHART_TYPE_VALUES).toContain(CHART_TYPES.SATELLITE_WATER_VAPOR);
	});

	it('includes the icing + freezing-level forecast types', () => {
		expect(CHART_TYPE_VALUES).toContain(CHART_TYPES.ICING_GAIRMET);
		expect(CHART_TYPE_VALUES).toContain(CHART_TYPES.ICING_CIP);
		expect(CHART_TYPE_VALUES).toContain(CHART_TYPES.ICING_FIP);
		expect(CHART_TYPE_VALUES).toContain(CHART_TYPES.FREEZING_LEVEL);
	});
});

describe('LAYER_BANDS', () => {
	it('enumerates exactly nine bands', () => {
		expect(LAYER_BAND_VALUES).toHaveLength(9);
	});

	it('preserves canonical z-order: background first, chrome last', () => {
		expect(LAYER_BAND_VALUES[0]).toBe(LAYER_BANDS.BACKGROUND);
		expect(LAYER_BAND_VALUES[LAYER_BAND_VALUES.length - 1]).toBe(LAYER_BANDS.CHROME);
	});

	it('basemap-borders sits below raster-overlay; basemap-re-stroke sits above it', () => {
		const borders = LAYER_BAND_VALUES.indexOf(LAYER_BANDS.BASEMAP_BORDERS);
		const raster = LAYER_BAND_VALUES.indexOf(LAYER_BANDS.RASTER_OVERLAY);
		const restroke = LAYER_BAND_VALUES.indexOf(LAYER_BANDS.BASEMAP_RE_STROKE);
		expect(borders).toBeLessThan(raster);
		expect(raster).toBeLessThan(restroke);
	});
});

describe('FAA_FLIGHT_CATEGORIES', () => {
	it('exposes the four canonical categories', () => {
		expect(FAA_FLIGHT_CATEGORY_VALUES).toEqual(['VFR', 'MVFR', 'IFR', 'LIFR']);
		expect(FAA_FLIGHT_CATEGORIES.VFR).toBe('VFR');
	});
});

describe('WX_CHART_SLUG_REGEX (ADR 027 PR 3 layout)', () => {
	it('accepts the canonical reference-fixture slug', () => {
		expect(WX_CHART_SLUG_REGEX.test('reference-fixtures/wx-surface-analysis-2024-12-23-12z')).toBe(true);
		expect(WX_CHART_SLUG_REGEX.test('reference-fixtures/wx-prog-chart-12hr-2024-12-23-12z')).toBe(true);
	});

	it('accepts wx-scenarios path-shaped slugs', () => {
		expect(WX_CHART_SLUG_REGEX.test('wx-scenarios/frontal-xc-march/surface-analysis')).toBe(true);
		expect(WX_CHART_SLUG_REGEX.test('wx-scenarios/frontal-xc-march/taf-kstl')).toBe(true);
		expect(WX_CHART_SLUG_REGEX.test('wx-scenarios/dense-fog-radiation-central-valley/g-airmet-icing')).toBe(true);
	});

	it('rejects uppercase and underscores', () => {
		expect(WX_CHART_SLUG_REGEX.test('WX_SURFACE_2024')).toBe(false);
		expect(WX_CHART_SLUG_REGEX.test('Wx-surface-analysis')).toBe(false);
		expect(WX_CHART_SLUG_REGEX.test('wx-scenarios/Frontal/surface-analysis')).toBe(false);
	});

	it('rejects legacy flat slugs without a family prefix', () => {
		expect(WX_CHART_SLUG_REGEX.test('wx-surface-analysis-2024-12-23-12z')).toBe(false);
		expect(WX_CHART_SLUG_REGEX.test('wx-scenario-frontal-xc-march-surface-analysis')).toBe(false);
		expect(WX_CHART_SLUG_REGEX.test('surface-analysis-2024-12-23-12z')).toBe(false);
	});

	it('rejects empty segments', () => {
		expect(WX_CHART_SLUG_REGEX.test('wx-scenarios/frontal-xc-march/')).toBe(false);
		expect(WX_CHART_SLUG_REGEX.test('wx-scenarios//surface-analysis')).toBe(false);
		expect(WX_CHART_SLUG_REGEX.test('reference-fixtures/')).toBe(false);
	});
});

describe('output budgets', () => {
	it('warn budget is 500 KB', () => {
		expect(WX_CHART_SVG_WARN_BYTES).toBe(500 * 1024);
	});

	it('hard limit is 5 MB', () => {
		expect(WX_CHART_SVG_HARD_LIMIT_BYTES).toBe(5 * 1024 * 1024);
	});

	it('warn < hard limit', () => {
		expect(WX_CHART_SVG_WARN_BYTES).toBeLessThan(WX_CHART_SVG_HARD_LIMIT_BYTES);
	});
});
