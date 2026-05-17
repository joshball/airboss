// @browser-globals: server-only -- never imported by client .svelte
/**
 * The wx-charts census adapter -- a Phase-2 Layer-1 derived-state adapter.
 *
 * Inventories every weather-chart type the symbology library defines
 * (`CHART_TYPE_VALUES`) and derives a coverage state per type from what
 * exists on disk in `libs/wx-charts/`:
 *
 *   derived-state rule
 *   ------------------
 *   `rendered`            -- the chart type has a renderer source module
 *                            AND a dedicated `__tests__/<type>.test.ts`
 *                            file exercising it.
 *   `rendered-shared-test` -- the chart type has a renderer source module
 *                            but is only exercised by a shared test file
 *                            (the three GOES satellite types share
 *                            `satellite.test.ts`; the advisory overlay is
 *                            tested as `airmet-sigmet.test.ts`).
 *   `unrendered`          -- the chart type is enumerated in CHART_TYPES
 *                            but has no renderer module.
 *
 * The rule answers the spec's "which product types are rendered" question
 * with a fact computable today, no new metadata: a chart type a learner can
 * actually be shown is one with a renderer module and test coverage.
 *
 * Gap view / intent view are honest Phase-3 placeholders (`census` mode):
 * the `layerTwoPending` block carries the labelled message, `gaps` and
 * `next` stay genuinely empty.
 *
 * Server-only: reads `node:fs`. Called from `+page.server.ts` and tests.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { CHART_TYPE_LABELS, CHART_TYPE_VALUES, type ChartType, ROUTES } from '@ab/constants';
import type { CensusItem, CensusMetric, CorpusCensus, DocLink } from '../types';
import { layerTwoPending } from './layer-two.server';
import { repoRoot } from './repo-root.server';

const WX_CHARTS_DIR = 'libs/wx-charts';
const CHARTS_SRC = `${WX_CHARTS_DIR}/src/charts`;
const CHARTS_TESTS = `${WX_CHARTS_DIR}/src/__tests__`;

/**
 * Chart-type -> renderer source filename (without `.ts`).
 *
 * The renderer module name does not always equal the chart-type slug: the
 * advisory overlay renders AIRMET / SIGMET (`airmet-sigmet`) and the GOES
 * satellite types use abbreviated filenames (`satellite-vis` / `-wv`). This
 * map is the single place the divergence is recorded.
 */
const RENDERER_MODULE: Record<ChartType, string> = {
	'surface-analysis': 'surface-analysis',
	'radar-mosaic': 'radar-mosaic',
	'advisory-overlay': 'airmet-sigmet',
	'metar-plot-grid': 'metar-plot-grid',
	'pirep-plot-grid': 'pirep-plot-grid',
	'winds-aloft-fb': 'winds-aloft-fb',
	'prog-chart': 'prog-chart',
	gfa: 'gfa',
	'convective-outlook': 'convective-outlook',
	cva: 'cva',
	'taf-timeline': 'taf-timeline',
	'turbulence-gairmet': 'turbulence-gairmet',
	'turbulence-gtg': 'turbulence-gtg',
	'icing-gairmet': 'icing-gairmet',
	'icing-cip': 'icing-cip',
	'icing-fip': 'icing-fip',
	'freezing-level': 'freezing-level',
	'satellite-ir': 'satellite-ir',
	'satellite-visible': 'satellite-vis',
	'satellite-water-vapor': 'satellite-wv',
};

/** The coverage state of one chart type. */
type ChartCoverage = 'rendered' | 'rendered-shared-test' | 'unrendered';

/** Derive the coverage state for one chart type by inspecting the source tree. */
function chartCoverage(type: ChartType): ChartCoverage {
	const moduleName = RENDERER_MODULE[type];
	const rendererExists = existsSync(join(repoRoot(), CHARTS_SRC, `${moduleName}.ts`));
	if (!rendererExists) return 'unrendered';
	const dedicatedTest = existsSync(join(repoRoot(), CHARTS_TESTS, `${moduleName}.test.ts`));
	return dedicatedTest ? 'rendered' : 'rendered-shared-test';
}

/** The governing documents for the wx-charts corpus. */
const WX_CHARTS_DOCS: DocLink[] = [
	{
		label: 'wx-chart symbology library -- spec',
		href: ROUTES.HANGAR_DOCS_PATH('docs/work-packages/wx-chart-symbology-library/spec.md'),
		role: 'Defines the chart-type set, the layer-band substrate contract, and the renderer API surface.',
	},
	{
		label: 'ADR 027 -- wx-charts artifact layout',
		href: ROUTES.HANGAR_DOCS_PATH('docs/decisions/027-wx-charts-artifact-layout/decision.md'),
		role: 'Governs the basemap layer order and the reference-fixture / wx-scenario chart-artifact slug families.',
	},
];

/**
 * Build the wx-charts census. Inventories every CHART_TYPES value; derives a
 * coverage state from renderer-module + test-file presence on disk.
 */
export function wxChartsCensus(): CorpusCensus {
	const items: CensusItem[] = CHART_TYPE_VALUES.map((type) => {
		const coverage = chartCoverage(type);
		const detail =
			coverage === 'rendered'
				? 'Renderer module present with a dedicated test file.'
				: coverage === 'rendered-shared-test'
					? 'Renderer module present; exercised by a shared test file rather than a dedicated one.'
					: 'Enumerated in CHART_TYPES but no renderer module is present.';
		return {
			id: type,
			label: CHART_TYPE_LABELS[type],
			derivedState: coverage,
			detail,
		};
	});

	const chartTypeCount = items.length;
	const renderedCount = items.filter((item) => item.derivedState === 'rendered').length;
	const sharedTestCount = items.filter((item) => item.derivedState === 'rendered-shared-test').length;
	const unrenderedCount = items.filter((item) => item.derivedState === 'unrendered').length;
	const withRendererCount = renderedCount + sharedTestCount;

	const metrics: CensusMetric[] = [
		{
			key: 'chart-types',
			label: 'Chart types',
			value: chartTypeCount,
			whatItMeasures:
				'The number of distinct weather-chart product types the symbology library enumerates -- surface analysis, radar mosaic, prog charts, GFA, the icing and turbulence forecast cluster, and the GOES satellite trio.',
			whyItMatters:
				'Chart types are the visual weather-product vocabulary. A pilot reads a preflight briefing as a stack of these products; a type the library does not enumerate is one the platform can never render or drill.',
			whatToDo: {
				text: 'Add a chart type by extending CHART_TYPES in libs/constants and authoring its renderer -- see the wx-chart symbology library spec.',
				href: ROUTES.HANGAR_DOCS_PATH('docs/work-packages/wx-chart-symbology-library/spec.md'),
			},
		},
		{
			key: 'rendered-chart-types',
			label: 'Chart types with a renderer',
			value: `${withRendererCount} / ${chartTypeCount}`,
			whatItMeasures:
				'How many chart types have a renderer source module in libs/wx-charts. An "unrendered" type is enumerated in the constant set but has no code that can draw it.',
			whyItMatters:
				unrenderedCount === 0
					? 'Every enumerated chart type has a renderer -- the library can draw the full weather-product vocabulary it claims.'
					: `${unrenderedCount} chart type${unrenderedCount === 1 ? ' is' : 's are'} enumerated but unrendered: the constant promises a product the library cannot actually draw, so any surface that offers it fails at render time.`,
			whatToDo: {
				text: 'Author the missing renderer modules, or drop the unrendered types from CHART_TYPES until their renderers ship.',
				href: ROUTES.HANGAR_DOCS_PATH('docs/work-packages/wx-chart-symbology-library/tasks.md'),
			},
		},
		{
			key: 'dedicated-test-coverage',
			label: 'Chart types with a dedicated test',
			value: `${renderedCount} / ${chartTypeCount}`,
			whatItMeasures:
				'How many chart types have their own `__tests__/<type>.test.ts` file. The rest with renderers are covered only by a shared test file (the three GOES satellite types share one; the advisory overlay is tested under its AIRMET / SIGMET module name).',
			whyItMatters:
				sharedTestCount === 0
					? 'Every chart type with a renderer has its own dedicated test -- a regression in one renderer is isolated to its own failing test.'
					: `${sharedTestCount} chart type${sharedTestCount === 1 ? ' is' : 's are'} covered only by a shared test file. A regression in one of them surfaces in a test named for a sibling, which slows diagnosis -- the failing test does not name the broken renderer.`,
			whatToDo: {
				text: 'Split shared chart-renderer tests into per-type files so a failing test names the exact renderer that regressed.',
				href: ROUTES.HANGAR_DOCS_PATH(`${CHARTS_TESTS}/`),
			},
		},
	];

	return {
		id: 'wx-charts',
		label: 'wx charts / symbology',
		whatItIs:
			'The weather-chart renderer library -- one renderer per chart type (surface analysis, radar, prog, GFA, the icing and turbulence forecast products, GOES satellite) plus the shared aviation symbology primitives.',
		whyItExists:
			'A preflight weather briefing is read as a stack of standard chart products. The symbology library renders those products from truth data so the platform can show, and drill, the exact visuals a pilot meets in the wild.',
		location: `${WX_CHARTS_DIR}/`,
		mode: 'census',
		stateRule:
			'A chart type is "rendered" when it has a renderer source module plus a dedicated test file; "rendered-shared-test" when it has a renderer but is only exercised by a shared test file; "unrendered" when it is enumerated in CHART_TYPES but has no renderer module.',
		docs: WX_CHARTS_DOCS,
		items,
		metrics,
		gaps: [],
		next: [],
		layerTwoPending: layerTwoPending('wx charts / symbology'),
	};
}
