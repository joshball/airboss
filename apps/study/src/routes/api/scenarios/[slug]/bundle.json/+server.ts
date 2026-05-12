/**
 * Streams a wx-engine scenario briefing pack as JSON.
 *
 * # URL shape
 *
 * `GET /api/scenarios/<slug>/bundle.json`
 *
 * Backs the `<ScenarioPanel slug="...">` component, which is mounted by the
 * course-step `:::scenario` directive (see `libs/help/src/markdown/block.ts`
 * for the parser side). The slug must be one of `WX_SCENARIO_VALUES`; any
 * other value 400s before any fs work.
 *
 * # Bundle shape
 *
 * The route reads four artefacts from `data/wx-scenarios/<slug>/`:
 *
 * - `truth.json`        scenario narrative, validAt, station table
 * - `commentary.json`   pedagogical callouts (truth-anchored)
 * - `products/metars.json`, `products/tafs.json`, `products/airmets.json`,
 *   `products/pireps.json`, `products/fb-bulletin.json`   product data
 *
 * Each file is opportunistically loaded -- a missing product file is
 * surfaced as `null` rather than failing the whole request, so a scenario
 * that hasn't been built end-to-end still renders the portions it has.
 *
 * # Browser safety
 *
 * `+server.ts` is server-only; `node:fs/promises` + `node:path` are
 * statically importable here. `wxScenarioBundleDir` from `@ab/constants`
 * lazy-loads `node:path` itself, but only call sites in server modules
 * trigger that path.
 */

import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WX_SCENARIO_VALUES, type WxScenario, wxScenarioBundleDir, wxScenarioChartSlug } from '@ab/constants';
import { createLogger } from '@ab/utils';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const log = createLogger('study:scenarios');
const HERE = dirname(fileURLToPath(import.meta.url));
// apps/study/src/routes/api/scenarios/[slug]/bundle.json -> repo root is
// seven levels up. Mirrors the math in api/charts/[...slug]/+server.ts.
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..', '..', '..', '..');

const WX_SCENARIO_SLUG_SET = new Set<string>(WX_SCENARIO_VALUES);

const PRODUCT_FILES = ['metars.json', 'tafs.json', 'airmets.json', 'pireps.json', 'fb-bulletin.json'] as const;

type ProductKey = (typeof PRODUCT_FILES)[number];

export interface ScenarioBundle {
	scenarioId: WxScenario;
	truth: unknown | null;
	commentary: unknown | null;
	products: Record<ProductKey, unknown | null>;
	/** Chart slugs (`wx-scenarios/<id>/<kind>`) the engine has built for this
	 *  scenario, derived from `data/wx-scenarios/<slug>/charts/`. Empty when
	 *  the chart tree is missing. The panel mounts each via `<CourseStepChart>`. */
	chartSlugs: string[];
}

async function readJsonOrNull(filePath: string): Promise<unknown | null> {
	try {
		const raw = await readFile(filePath, 'utf-8');
		return JSON.parse(raw) as unknown;
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
		throw err;
	}
}

async function listChartKinds(chartsDir: string): Promise<string[]> {
	try {
		const entries = await readdir(chartsDir, { withFileTypes: true });
		return entries
			.filter((e) => e.isDirectory())
			.map((e) => e.name)
			.sort();
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
		throw err;
	}
}

export const GET: RequestHandler = async ({ params, locals }) => {
	const slug = params.slug ?? '';
	if (!WX_SCENARIO_SLUG_SET.has(slug)) {
		log.warn('scenario-bundle invalid slug', {
			requestId: locals.requestId,
			userId: locals.user?.id ?? null,
			metadata: { slug },
		});
		throw error(400, `Unknown scenario '${slug}'`);
	}
	const scenarioId = slug as WxScenario;
	const dir = wxScenarioBundleDir(REPO_ROOT, scenarioId);

	const truthPath = resolve(dir, 'truth.json');
	const commentaryPath = resolve(dir, 'commentary.json');
	const productPaths = PRODUCT_FILES.map((name) => ({ name, path: resolve(dir, 'products', name) }));
	const chartsDir = resolve(dir, 'charts');

	const [truth, commentary, chartKinds, ...productValues] = await Promise.all([
		readJsonOrNull(truthPath),
		readJsonOrNull(commentaryPath),
		listChartKinds(chartsDir),
		...productPaths.map((p) => readJsonOrNull(p.path)),
	]);

	if (truth === null) {
		// truth.json is the load-bearing artefact -- without it the panel has
		// nothing to render. Treat as 404 rather than an empty bundle.
		throw error(404, `Scenario bundle not built: ${slug}`);
	}

	const products = Object.fromEntries(PRODUCT_FILES.map((name, idx) => [name, productValues[idx] ?? null])) as Record<
		ProductKey,
		unknown | null
	>;

	const chartSlugs = chartKinds.map((kind) => wxScenarioChartSlug(scenarioId, kind));

	const bundle: ScenarioBundle = {
		scenarioId,
		truth,
		commentary,
		products,
		chartSlugs,
	};

	return json(bundle, {
		headers: {
			// Scenario bundles are content-addressed by slug; the build-output
			// pipeline regenerates the whole bundle when the scenario truth or
			// products change. One-hour cache matches the chart endpoint.
			'Cache-Control': 'public, max-age=3600',
		},
	});
};
