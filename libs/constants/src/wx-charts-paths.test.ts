/**
 * Tests for the wx-charts reference-fixture path helpers + the shared
 * `chartsRootDir` (ADR 027).
 *
 * Pins the **current flat layout**. The 5 date-stamped wx-charts test
 * fixtures (surface-analysis, metar-plot-grid, pirep-plot-grid,
 * radar-mosaic, winds-aloft-fb) reach into the helpers and must get back
 * byte-identical slugs to the prior inline strings.
 */

import { describe, expect, it } from 'vitest';
import {
	chartSlugToDir,
	chartsRootDir,
	referenceFixtureArtifactPath,
	referenceFixtureChartDir,
	referenceFixtureChartSlug,
} from './wx-charts-paths';
import { WX_CHART_ARTIFACTS, wxScenarioChartSlug } from './wx-engine-paths';

describe('chartsRootDir', () => {
	it('returns repoRoot/data/charts/wx', () => {
		expect(chartsRootDir('/repo')).toBe('/repo/data/charts/wx');
	});
});

describe('referenceFixtureChartSlug', () => {
	it('builds the slugs for the 5 date-stamped reference-fixture tests', () => {
		// Each pair below matches an existing on-disk fixture and the
		// corresponding wx-charts test SPEC.slug. PR 1 must NOT change any
		// of these strings.
		expect(referenceFixtureChartSlug('surface-analysis', '2024-12-23-12z')).toBe(
			'wx-surface-analysis-2024-12-23-12z',
		);
		expect(referenceFixtureChartSlug('metar-plot-grid', '2024-01-13-12z')).toBe(
			'wx-metar-plot-grid-2024-01-13-12z',
		);
		expect(referenceFixtureChartSlug('pirep-plot-grid', '2024-05-21-22z')).toBe(
			'wx-pirep-plot-grid-2024-05-21-22z',
		);
		expect(referenceFixtureChartSlug('radar-mosaic', '2024-05-21-22z')).toBe('wx-radar-mosaic-2024-05-21-22z');
		expect(referenceFixtureChartSlug('winds-aloft-fb', '2024-05-21-18z')).toBe(
			'wx-winds-aloft-fb-2024-05-21-18z',
		);
	});

	it('handles a frame-modified chart kind passed as a joined string', () => {
		// prog-chart-12hr is the joined form -- caller is responsible for
		// joining the frame into the kind segment.
		expect(referenceFixtureChartSlug('prog-chart-12hr', '2024-12-23-12z')).toBe(
			'wx-prog-chart-12hr-2024-12-23-12z',
		);
	});

	it('matches the WX_CHART_SLUG_REGEX wx- prefix shape', () => {
		const slug = referenceFixtureChartSlug('surface-analysis', '2024-12-23-12z');
		expect(slug.startsWith('wx-')).toBe(true);
	});
});

describe('referenceFixtureChartDir', () => {
	it('joins chartsRootDir with the reference-fixture slug', () => {
		expect(referenceFixtureChartDir('/repo', 'surface-analysis', '2024-12-23-12z')).toBe(
			'/repo/data/charts/wx/wx-surface-analysis-2024-12-23-12z',
		);
	});
});

describe('referenceFixtureArtifactPath', () => {
	it('joins the fixture dir with the artifact filename', () => {
		expect(
			referenceFixtureArtifactPath('/repo', 'surface-analysis', '2024-12-23-12z', WX_CHART_ARTIFACTS.SPEC),
		).toBe('/repo/data/charts/wx/wx-surface-analysis-2024-12-23-12z/spec.yaml');
		expect(
			referenceFixtureArtifactPath('/repo', 'surface-analysis', '2024-12-23-12z', WX_CHART_ARTIFACTS.CHART),
		).toBe('/repo/data/charts/wx/wx-surface-analysis-2024-12-23-12z/chart.svg');
		expect(
			referenceFixtureArtifactPath('/repo', 'surface-analysis', '2024-12-23-12z', WX_CHART_ARTIFACTS.META),
		).toBe('/repo/data/charts/wx/wx-surface-analysis-2024-12-23-12z/meta.json');
	});
});

describe('chartSlugToDir', () => {
	it('maps any chart slug to data/charts/wx/<slug> in the current layout', () => {
		// reference-fixture slug
		expect(chartSlugToDir('/repo', 'wx-surface-analysis-2024-12-23-12z')).toBe(
			'/repo/data/charts/wx/wx-surface-analysis-2024-12-23-12z',
		);
		// scenario slug (path matches what wxScenarioChartSlug builds)
		const scenarioSlug = wxScenarioChartSlug('frontal-xc-march', 'surface-analysis');
		expect(chartSlugToDir('/repo', scenarioSlug)).toBe(
			'/repo/data/charts/wx/wx-scenario-frontal-xc-march-surface-analysis',
		);
	});

	it('is the inverse of the slug builders -- chartSlugToDir(repo, slug) == <chartDir>', () => {
		const dirA = referenceFixtureChartDir('/repo', 'surface-analysis', '2024-12-23-12z');
		const slugA = referenceFixtureChartSlug('surface-analysis', '2024-12-23-12z');
		expect(chartSlugToDir('/repo', slugA)).toBe(dirA);
	});
});
