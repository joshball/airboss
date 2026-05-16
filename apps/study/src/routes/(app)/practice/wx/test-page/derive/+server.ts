/**
 * POST `/practice/wx/test-page/derive` -- the live-regen endpoint for the
 * truth-model authoring sandbox (Drill Phase 4).
 *
 * Takes the sandbox slider state, builds a single-station `TruthModel`
 * (via the pure `truthFromSliders` mapper), re-derives a METAR + TAF, and
 * re-renders the wx-charts METAR-plot SVG. The derivation + render are
 * server-only (`@ab/wx-engine/server`, `@ab/wx-charts/server`), which is
 * why they live in this `+server.ts` and not in the page component.
 *
 * Admin-only: re-gated via `requireRole` -- the page-server load already
 * gates the page, and this endpoint is reachable independently so it gets
 * its own guard.
 *
 * The TAF derivation can throw on extreme slider combinations the METAR
 * tolerates; that is caught and returned as `tafError` so the page can
 * surface it inline rather than failing the whole request.
 */

import { existsSync } from 'node:fs';
import { dirname, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireRole } from '@ab/auth';
import { CHART_TYPES, ROLES } from '@ab/constants';
import { createLogger } from '@ab/utils';
import { CHART_RENDERERS } from '@ab/wx-charts/server';
import { deriveMetar, deriveMetarPlotChart, deriveTaf, truthModelSchema } from '@ab/wx-engine/server';
import { error, json } from '@sveltejs/kit';
import { sandboxSliderStateSchema } from '../_lib/schema';
import { truthFromSliders } from '../_lib/truth-from-sliders';
import type { SandboxDeriveResult } from '../_lib/types';
import type { RequestHandler } from './$types';

const log = createLogger('study:wx-test-page-derive');

/**
 * Walk up from this module to the repo root -- the first ancestor directory
 * holding a `bun.lock`. Robust to route-nesting changes; a hand-counted
 * `'..' x N` would silently break the basemap paths if the route moved.
 */
function findRepoRoot(): string {
	let dir = dirname(fileURLToPath(import.meta.url));
	while (dir !== parse(dir).root) {
		if (existsSync(resolve(dir, 'bun.lock'))) return dir;
		dir = dirname(dir);
	}
	throw new Error('wx-test-page derive: could not locate repo root (no bun.lock found)');
}

const REPO_ROOT = findRepoRoot();
const BASEMAP_PATH = resolve(REPO_ROOT, 'data', 'references', 'basemaps', 'us-states-10m.json');
const CONTEXT_BASEMAP_PATH = resolve(REPO_ROOT, 'data', 'references', 'basemaps', 'north-america-context-50m.json');

/** Stamped into chart provenance. The sandbox is not a persisted artifact. */
const SANDBOX_LIBRARY_VERSION = 'wx-test-page-sandbox';

export const POST: RequestHandler = async (event) => {
	requireRole(event, ROLES.ADMIN);

	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		throw error(400, 'Request body must be JSON');
	}

	const parsed = sandboxSliderStateSchema.safeParse(body);
	if (!parsed.success) {
		throw error(400, `Invalid slider state: ${parsed.error.issues.map((i) => i.message).join('; ')}`);
	}

	// Build + validate the truth model. A schema failure here is a mapper
	// bug, not user input -- surface it as a 500 with the detail.
	const truthCandidate = truthFromSliders(parsed.data);
	const truthResult = truthModelSchema.safeParse(truthCandidate);
	if (!truthResult.success) {
		log.error('sandbox truth model failed schema validation', {
			requestId: event.locals.requestId,
			userId: event.locals.user?.id ?? null,
			metadata: { issues: truthResult.error.issues.map((i) => i.message) },
		});
		throw error(500, 'Sandbox truth model failed validation -- this is a mapper bug');
	}
	const truth = truthResult.data;
	const stationIcao = truth.routeStations[0];
	if (stationIcao === undefined) throw error(500, 'Sandbox truth model has no route station');

	// METAR -- always derivable for the sandbox lever ranges.
	let metarRaw: string;
	let metarPlotSvg: string;
	try {
		const metar = deriveMetar(truth, stationIcao);
		metarRaw = metar.raw;

		// Re-render the METAR-plot chart. `deriveMetarPlotChart` returns a
		// spec + inline source bytes; the renderer maps source keys to
		// bytes and pulls the basemap from disk.
		const artifact = deriveMetarPlotChart(truth, [metar], truth.scenarioId);
		// The METAR-plot artifact carries exactly one source -- the observations
		// JSON the spec references as `sources.observations`. Assert that
		// invariant rather than letting a last-wins loop hide a future change.
		if (artifact.sources.length !== 1) {
			throw error(500, `Expected one METAR-plot source, got ${artifact.sources.length}`);
		}
		const sourcesByKey: Record<string, string> = { observations: artifact.sources[0].bytes };
		const renderer = CHART_RENDERERS[CHART_TYPES.METAR_PLOT_GRID];
		const spec = renderer.schema.parse(artifact.spec);
		const rendered = await renderer.render({
			spec: spec as never,
			sources: sourcesByKey,
			basemapPath: BASEMAP_PATH,
			contextBasemapPath: CONTEXT_BASEMAP_PATH,
			libraryVersion: SANDBOX_LIBRARY_VERSION,
		});
		metarPlotSvg = rendered.svg;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.warn('sandbox METAR derivation/render failed', {
			requestId: event.locals.requestId,
			userId: event.locals.user?.id ?? null,
			metadata: { message },
		});
		throw error(422, `METAR derivation failed: ${message}`);
	}

	// TAF -- may throw on extreme combinations; capture rather than fail.
	let tafRaw: string | null = null;
	let tafError: string | null = null;
	try {
		const taf = deriveTaf(truth, stationIcao, { validHours: truth.tafValidHours });
		tafRaw = taf.raw;
	} catch (err) {
		tafError = err instanceof Error ? err.message : String(err);
	}

	const result: SandboxDeriveResult = {
		metarRaw,
		tafRaw,
		tafError,
		chartSvg: metarPlotSvg,
	};
	return json(result);
};
