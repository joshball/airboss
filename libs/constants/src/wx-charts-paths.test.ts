/**
 * Tests for the wx-charts reference-fixture path helpers + the shared
 * `chartsRootDir` (ADR 027 PR 3, with the symmetric filename disambiguation
 * pass applied to reference-fixtures).
 *
 * Pins the **nested layout**: reference fixtures live under
 * `data/charts/wx/reference-fixtures/wx-<chart-kind>-<date-zulu>/` with
 * disambiguated `wx-<chart-kind>-<date-zulu>-{spec.yaml, chart.svg,
 * meta.json}` filenames inside, mirroring the wx-scenarios convention.
 */

import { describe, expect, it } from 'vitest';
import { WX_CHART_SLUG_REGEX } from './wx-charts';
import {
	chartArtifactFilename,
	chartSlugToDir,
	chartSpecFilename,
	chartsRootDir,
	referenceFixtureArtifactPath,
	referenceFixtureChartDir,
	referenceFixtureChartSlug,
	WX_CHART_FAMILIES,
} from './wx-charts-paths';
import { WX_CHART_ARTIFACTS, wxScenarioChartSlug } from './wx-engine-paths';

describe('WX_CHART_FAMILIES', () => {
	it('enumerates the three on-disk family directories under data/charts/wx/', () => {
		expect(WX_CHART_FAMILIES.REFERENCE_FIXTURES).toBe('reference-fixtures');
		expect(WX_CHART_FAMILIES.WX_SCENARIOS).toBe('wx-scenarios');
		expect(WX_CHART_FAMILIES.MOCKUPS).toBe('mockups');
	});
});

describe('chartsRootDir', () => {
	it('returns repoRoot/data/charts/wx', () => {
		expect(chartsRootDir('/repo')).toBe('/repo/data/charts/wx');
	});
});

describe('referenceFixtureChartSlug', () => {
	it('builds slugs for the 5 date-stamped reference-fixture tests under the new nested layout', () => {
		expect(referenceFixtureChartSlug('surface-analysis', '2024-12-23-12z')).toBe(
			'reference-fixtures/wx-surface-analysis-2024-12-23-12z',
		);
		expect(referenceFixtureChartSlug('metar-plot-grid', '2024-01-13-12z')).toBe(
			'reference-fixtures/wx-metar-plot-grid-2024-01-13-12z',
		);
		expect(referenceFixtureChartSlug('pirep-plot-grid', '2024-05-21-22z')).toBe(
			'reference-fixtures/wx-pirep-plot-grid-2024-05-21-22z',
		);
		expect(referenceFixtureChartSlug('radar-mosaic', '2024-05-21-22z')).toBe(
			'reference-fixtures/wx-radar-mosaic-2024-05-21-22z',
		);
		expect(referenceFixtureChartSlug('winds-aloft-fb', '2024-05-21-18z')).toBe(
			'reference-fixtures/wx-winds-aloft-fb-2024-05-21-18z',
		);
	});

	it('handles a frame-modified chart kind passed as a joined string', () => {
		expect(referenceFixtureChartSlug('prog-chart-12hr', '2024-12-23-12z')).toBe(
			'reference-fixtures/wx-prog-chart-12hr-2024-12-23-12z',
		);
	});

	it('matches WX_CHART_SLUG_REGEX', () => {
		const slug = referenceFixtureChartSlug('surface-analysis', '2024-12-23-12z');
		expect(WX_CHART_SLUG_REGEX.test(slug)).toBe(true);
	});
});

describe('referenceFixtureChartDir', () => {
	it('joins chartsRootDir with the reference-fixtures subtree and slug-named directory', () => {
		expect(referenceFixtureChartDir('/repo', 'surface-analysis', '2024-12-23-12z')).toBe(
			'/repo/data/charts/wx/reference-fixtures/wx-surface-analysis-2024-12-23-12z',
		);
	});
});

describe('referenceFixtureArtifactPath', () => {
	it('joins the fixture dir with the disambiguated artifact filename', () => {
		expect(referenceFixtureArtifactPath('/repo', 'surface-analysis', '2024-12-23-12z', WX_CHART_ARTIFACTS.SPEC)).toBe(
			'/repo/data/charts/wx/reference-fixtures/wx-surface-analysis-2024-12-23-12z/wx-surface-analysis-2024-12-23-12z-spec.yaml',
		);
		expect(referenceFixtureArtifactPath('/repo', 'surface-analysis', '2024-12-23-12z', WX_CHART_ARTIFACTS.CHART)).toBe(
			'/repo/data/charts/wx/reference-fixtures/wx-surface-analysis-2024-12-23-12z/wx-surface-analysis-2024-12-23-12z-chart.svg',
		);
		expect(referenceFixtureArtifactPath('/repo', 'surface-analysis', '2024-12-23-12z', WX_CHART_ARTIFACTS.META)).toBe(
			'/repo/data/charts/wx/reference-fixtures/wx-surface-analysis-2024-12-23-12z/wx-surface-analysis-2024-12-23-12z-meta.json',
		);
	});

	it('handles a frame-modified chart kind in the disambiguated filename', () => {
		expect(referenceFixtureArtifactPath('/repo', 'prog-chart-12hr', '2024-12-23-12z', WX_CHART_ARTIFACTS.SPEC)).toBe(
			'/repo/data/charts/wx/reference-fixtures/wx-prog-chart-12hr-2024-12-23-12z/wx-prog-chart-12hr-2024-12-23-12z-spec.yaml',
		);
	});
});

describe('chartSlugToDir', () => {
	it('maps a reference-fixture slug to its nested directory', () => {
		expect(chartSlugToDir('/repo', 'reference-fixtures/wx-surface-analysis-2024-12-23-12z')).toBe(
			'/repo/data/charts/wx/reference-fixtures/wx-surface-analysis-2024-12-23-12z',
		);
	});

	it('maps a wx-scenarios slug to its nested directory', () => {
		const scenarioSlug = wxScenarioChartSlug('frontal-xc-march', 'surface-analysis');
		expect(chartSlugToDir('/repo', scenarioSlug)).toBe(
			'/repo/data/charts/wx/wx-scenarios/frontal-xc-march/surface-analysis',
		);
	});

	it('is the inverse of the slug builders', () => {
		const dirA = referenceFixtureChartDir('/repo', 'surface-analysis', '2024-12-23-12z');
		const slugA = referenceFixtureChartSlug('surface-analysis', '2024-12-23-12z');
		expect(chartSlugToDir('/repo', slugA)).toBe(dirA);
	});
});

describe('chartSpecFilename + chartArtifactFilename', () => {
	it('wx-scenarios slugs disambiguate by tail segments', () => {
		expect(chartSpecFilename('wx-scenarios/frontal-xc-march/surface-analysis')).toBe(
			'frontal-xc-march-surface-analysis-spec.yaml',
		);
		expect(chartArtifactFilename('wx-scenarios/frontal-xc-march/cva', WX_CHART_ARTIFACTS.CHART)).toBe(
			'frontal-xc-march-cva-chart.svg',
		);
		expect(chartArtifactFilename('wx-scenarios/frontal-xc-march/taf-kstl', WX_CHART_ARTIFACTS.META)).toBe(
			'frontal-xc-march-taf-kstl-meta.json',
		);
	});

	it('reference-fixture slugs disambiguate by slug tail', () => {
		expect(chartSpecFilename('reference-fixtures/wx-surface-analysis-2024-12-23-12z')).toBe(
			'wx-surface-analysis-2024-12-23-12z-spec.yaml',
		);
		expect(
			chartArtifactFilename('reference-fixtures/wx-surface-analysis-2024-12-23-12z', WX_CHART_ARTIFACTS.CHART),
		).toBe('wx-surface-analysis-2024-12-23-12z-chart.svg');
		expect(
			chartArtifactFilename('reference-fixtures/wx-surface-analysis-2024-12-23-12z', WX_CHART_ARTIFACTS.META),
		).toBe('wx-surface-analysis-2024-12-23-12z-meta.json');
	});
});
