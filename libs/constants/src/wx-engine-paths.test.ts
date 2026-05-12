/**
 * Tests for the wx-engine scenario chart path helpers (ADR 027).
 *
 * These pin the **current flat layout** -- helpers must return strings
 * byte-identical to the inline templates they replaced. The ADR 027
 * follow-on PR shifts the layout; that PR ships an updated test fixture
 * for the nested shape.
 */

import { describe, expect, it } from 'vitest';
import {
	WX_CHART_ARTIFACT_VALUES,
	WX_CHART_ARTIFACTS,
	wxScenarioArtifactPath,
	wxScenarioBundleDir,
	wxScenarioChartDir,
	wxScenarioChartSlug,
} from './wx-engine-paths';

describe('wxScenarioChartSlug', () => {
	it('builds the current flat layout for the canonical single-segment kinds', () => {
		expect(wxScenarioChartSlug('frontal-xc-march', 'surface-analysis')).toBe(
			'wx-scenario-frontal-xc-march-surface-analysis',
		);
		expect(wxScenarioChartSlug('frontal-xc-march', 'cva')).toBe('wx-scenario-frontal-xc-march-cva');
		expect(wxScenarioChartSlug('summer-thunderstorms-tx', 'metar-plot')).toBe(
			'wx-scenario-summer-thunderstorms-tx-metar-plot',
		);
	});

	it('passes through caller-joined multi-segment chart kinds (taf, prog)', () => {
		// taf-timeline encodes the station: chart kind = `taf-<station-lowercased>`
		expect(wxScenarioChartSlug('frontal-xc-march', 'taf-kstl')).toBe('wx-scenario-frontal-xc-march-taf-kstl');
		expect(wxScenarioChartSlug('marine-stratus-pacific-nw', 'taf-kpdx')).toBe(
			'wx-scenario-marine-stratus-pacific-nw-taf-kpdx',
		);

		// prog-chart encodes the lead hours: chart kind = `prog-<N>hr`
		expect(wxScenarioChartSlug('frontal-xc-march', 'prog-12hr')).toBe('wx-scenario-frontal-xc-march-prog-12hr');
		expect(wxScenarioChartSlug('winter-icing-great-lakes', 'prog-24hr')).toBe(
			'wx-scenario-winter-icing-great-lakes-prog-24hr',
		);
	});

	it('matches WX_CHART_SLUG_REGEX shape (starts with wx-)', () => {
		const slug = wxScenarioChartSlug('frontal-xc-march', 'airmet-sigmet');
		expect(slug.startsWith('wx-')).toBe(true);
		expect(slug).toMatch(/^wx-[a-z0-9][a-z0-9-]*[a-z0-9]$/);
	});
});

describe('wxScenarioChartDir', () => {
	it('joins repoRoot with the chart slug under data/charts/wx', () => {
		expect(wxScenarioChartDir('/repo', 'frontal-xc-march', 'surface-analysis')).toBe(
			'/repo/data/charts/wx/wx-scenario-frontal-xc-march-surface-analysis',
		);
	});

	it('handles multi-segment chart kinds', () => {
		expect(wxScenarioChartDir('/repo', 'frontal-xc-march', 'taf-kstl')).toBe(
			'/repo/data/charts/wx/wx-scenario-frontal-xc-march-taf-kstl',
		);
		expect(wxScenarioChartDir('/repo', 'frontal-xc-march', 'prog-12hr')).toBe(
			'/repo/data/charts/wx/wx-scenario-frontal-xc-march-prog-12hr',
		);
	});

	it('normalizes repoRoot trailing slashes via node:path.join', () => {
		// node:path.join collapses duplicate separators
		expect(wxScenarioChartDir('/repo/', 'frontal-xc-march', 'cva')).toBe(
			'/repo/data/charts/wx/wx-scenario-frontal-xc-march-cva',
		);
	});
});

describe('wxScenarioArtifactPath', () => {
	it('joins the chart dir with the artifact filename', () => {
		expect(wxScenarioArtifactPath('/repo', 'frontal-xc-march', 'surface-analysis', WX_CHART_ARTIFACTS.SPEC)).toBe(
			'/repo/data/charts/wx/wx-scenario-frontal-xc-march-surface-analysis/spec.yaml',
		);
		expect(wxScenarioArtifactPath('/repo', 'frontal-xc-march', 'cva', WX_CHART_ARTIFACTS.CHART)).toBe(
			'/repo/data/charts/wx/wx-scenario-frontal-xc-march-cva/chart.svg',
		);
		expect(wxScenarioArtifactPath('/repo', 'frontal-xc-march', 'cva', WX_CHART_ARTIFACTS.META)).toBe(
			'/repo/data/charts/wx/wx-scenario-frontal-xc-march-cva/meta.json',
		);
	});

	it('accepts every WX_CHART_ARTIFACT_VALUES entry', () => {
		for (const artifact of WX_CHART_ARTIFACT_VALUES) {
			const path = wxScenarioArtifactPath('/repo', 'frontal-xc-march', 'cva', artifact);
			expect(path).toBe(`/repo/data/charts/wx/wx-scenario-frontal-xc-march-cva/${artifact}`);
		}
	});
});

describe('wxScenarioBundleDir', () => {
	it('returns the data/wx-scenarios bundle root (not the charts mirror)', () => {
		// The bundle dir holds truth.json + products/ + commentary -- distinct
		// from the chart-artifact mirror under data/charts/wx/.
		expect(wxScenarioBundleDir('/repo', 'frontal-xc-march')).toBe('/repo/data/wx-scenarios/frontal-xc-march');
		expect(wxScenarioBundleDir('/repo', 'summer-thunderstorms-tx')).toBe(
			'/repo/data/wx-scenarios/summer-thunderstorms-tx',
		);
	});

	it('is distinct from wxScenarioChartDir', () => {
		const bundle = wxScenarioBundleDir('/repo', 'frontal-xc-march');
		const chart = wxScenarioChartDir('/repo', 'frontal-xc-march', 'surface-analysis');
		expect(bundle).not.toBe(chart);
		expect(bundle.includes('charts/wx')).toBe(false);
		expect(chart.includes('charts/wx')).toBe(true);
	});
});

describe('WX_CHART_ARTIFACTS', () => {
	it('enumerates the three on-disk artifact filenames', () => {
		expect(WX_CHART_ARTIFACTS.SPEC).toBe('spec.yaml');
		expect(WX_CHART_ARTIFACTS.CHART).toBe('chart.svg');
		expect(WX_CHART_ARTIFACTS.META).toBe('meta.json');
		expect(WX_CHART_ARTIFACT_VALUES).toEqual(['spec.yaml', 'chart.svg', 'meta.json']);
	});
});
