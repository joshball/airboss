/**
 * Streams wx-charts SVG bytes from `data/charts/wx/<slug>/<filename>` to the
 * browser. Backs `<CourseStepChart slug="...">` and any future call site that
 * wants to embed a chart by slug.
 *
 * # URL shape
 *
 * `GET /api/charts/<slug>/chart.svg`
 *
 * Mirrors the handbook-asset endpoint at `routes/handbook-asset/[...path]/`:
 * a single catch-all whose trailing segment names the artifact. Today only
 * `chart.svg` is reachable; `meta.json` / `spec.yaml` are intentionally NOT
 * served (they're authoring artifacts, not browser-visible content).
 *
 * # Slug validation
 *
 * Two chart families exist under `data/charts/wx/`:
 *   - `wx-scenarios/<scenario-id>/<chart-kind>`
 *   - `reference-fixtures/wx-<chart-kind>-<date-zulu>`
 *
 * Any slug that doesn't start with one of those prefixes, or that contains
 * `..` or an absolute fragment, is rejected with 400 before any fs work.
 *
 * # Path resolution
 *
 * Uses `chartSlugToDir` + `chartArtifactFilename` from `@ab/constants` so the
 * filename disambiguation rule (`<scenario-id>-<chart-kind>-chart.svg` for
 * the scenario family, bare `chart.svg` for the reference-fixture family)
 * stays owned in one place. After joining, the resolved path is re-checked
 * against the charts root: a slug that survives lexical validation but still
 * resolves outside the corpus (defence in depth) returns 404.
 *
 * # Browser safety
 *
 * `+server.ts` only ever runs server-side, so `node:fs/promises` and
 * `node:path` may be imported statically. The path helpers in
 * `@ab/constants` lazy-load `node:path` themselves; this file is the only
 * direct `node:fs` user.
 */

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chartArtifactFilename, chartSlugToDir, chartsRootDir, WX_CHART_ARTIFACTS } from '@ab/constants';
import { createLogger } from '@ab/utils';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const log = createLogger('study:charts');
const HERE = dirname(fileURLToPath(import.meta.url));
// apps/study/src/routes/api/charts/[...slug] -> repo root is seven levels up.
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..', '..', '..', '..');
const CHARTS_ROOT = chartsRootDir(REPO_ROOT);

// Trailing artifact segment the URL grammar requires. Today this is the
// only artifact we serve; spec.yaml / meta.json stay off the wire because
// they're authoring inputs/outputs, not browser-visible content.
const ARTIFACT_SUFFIX = `/${WX_CHART_ARTIFACTS.CHART}`;

// Chart slugs are path-shaped: lowercase letters, digits, hyphens, slashes.
// Bands the URL space tightly so the catch-all can't be turned into an
// arbitrary fs read even if a future helper learns to handle weirder slugs.
const SLUG_SHAPE = /^[a-z0-9-/]+$/;
const VALID_SLUG_PREFIXES = ['wx-scenarios/', 'reference-fixtures/'] as const;

function validateSlug(slug: string): boolean {
	if (slug === '') return false;
	if (slug.includes('..')) return false;
	if (slug.startsWith('/')) return false;
	if (!SLUG_SHAPE.test(slug)) return false;
	return VALID_SLUG_PREFIXES.some((prefix) => slug.startsWith(prefix));
}

export const GET: RequestHandler = async ({ params, locals }) => {
	const raw = params.slug ?? '';
	if (!raw.endsWith(ARTIFACT_SUFFIX)) {
		// The URL grammar is `/api/charts/<slug>/chart.svg`. Anything else is
		// either a typo or a probe; 404 is the right answer and avoids leaking
		// "this prefix is reserved" via a 400.
		throw error(404, 'Not found');
	}
	const slug = raw.slice(0, -ARTIFACT_SUFFIX.length);
	if (!validateSlug(slug)) {
		log.warn('chart-route invalid slug', {
			requestId: locals.requestId,
			userId: locals.user?.id ?? null,
			metadata: { slug },
		});
		throw error(400, 'Invalid chart slug');
	}

	const dir = chartSlugToDir(REPO_ROOT, slug);
	// Defence in depth: even after the lexical check, confirm the resolved
	// directory still lives under the charts root. A future change to
	// `chartSlugToDir` that started honouring absolute or escape-style slugs
	// would otherwise turn this endpoint into an arbitrary fs read.
	if (!dir.startsWith(`${CHARTS_ROOT}/`) && dir !== CHARTS_ROOT) {
		throw error(400, 'Invalid chart slug');
	}

	const filename = chartArtifactFilename(slug, WX_CHART_ARTIFACTS.CHART);
	const svgPath = resolve(dir, filename);

	try {
		const svg = await readFile(svgPath, 'utf-8');
		return new Response(svg, {
			headers: {
				'Content-Type': 'image/svg+xml',
				// Charts are content-addressed by slug; a re-render lands at a
				// new slug rather than overwriting in place. One-hour cache is
				// the same shape we use for other slug-keyed asset routes and
				// keeps the dev iteration loop snappy.
				'Cache-Control': 'public, max-age=3600',
			},
		});
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			throw error(404, `Chart not found: ${slug}`);
		}
		throw err;
	}
};
