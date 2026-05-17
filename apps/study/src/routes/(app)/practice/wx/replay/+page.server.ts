/**
 * Server load for `/practice/wx/replay`.
 *
 * The replay surface lets a student step through a temporal weather
 * scenario hour by hour, watching the METAR/TAF/chart update and recording
 * a go/no-go decision at each step. Step 7 of the TruthModel v2 plan.
 *
 * Two modes:
 *   - No `?scenario=` query param: a picker -- the list of temporal
 *     scenarios (those carrying an `evolution` block).
 *   - `?scenario=<slug>`: the full timeline bundle for that scenario,
 *     server-loaded from `data/wx-scenarios/<slug>/` (the artifacts the
 *     `wx-scenario build --timeline` CLI emits in step 5).
 *
 * The timeline bundle stores per-hour chart SPECS (not rendered SVGs, per
 * ADR 018). This loader reads each spec + its source bytes and renders the
 * chart to SVG on demand via `@ab/wx-charts/server` -- the same pattern the
 * test-page derive endpoint uses. Rendering server-side keeps the page
 * payload as inline SVG strings; only the source changes from "read SVG
 * file" to "render spec".
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireAuth } from '@ab/auth';
import {
	type ChartType,
	WX_SCENARIO_LABELS,
	WX_SCENARIO_VALUES,
	WX_TIMELINE_BUNDLE,
	type WxScenario,
} from '@ab/constants';
import { createLogger } from '@ab/utils';
import { CHART_RENDERERS } from '@ab/wx-charts/server';
import { loadScenario, zuluHourLabel } from '@ab/wx-engine/server';
import { error } from '@sveltejs/kit';
import { parse as parseYaml } from 'yaml';
import type { PageServerLoad } from './$types';

const log = createLogger('study:wx-replay');

/**
 * Walk up to the repo root (first ancestor holding `bun.lock`). Robust to
 * route-nesting changes; mirrors the test-page derive endpoint.
 */
function findRepoRoot(): string {
	let dir = dirname(fileURLToPath(import.meta.url));
	while (dir !== parse(dir).root) {
		if (existsSync(resolve(dir, 'bun.lock'))) return dir;
		dir = dirname(dir);
	}
	throw new Error('wx-replay: could not locate repo root (no bun.lock found)');
}

const REPO_ROOT = findRepoRoot();

/** Substrate basemap for rendering per-hour timeline charts. */
const BASEMAP_PATH = resolve(REPO_ROOT, 'data', 'references', 'basemaps', 'us-states-10m.json');
/** North-America context basemap (fills the Lambert cone). */
const CONTEXT_BASEMAP_PATH = resolve(REPO_ROOT, 'data', 'references', 'basemaps', 'north-america-context-50m.json');

/** Stamped into chart provenance. The replay charts are rendered on demand. */
const REPLAY_LIBRARY_VERSION = 'wx-engine-timeline-replay';

/** One temporal scenario the picker can offer. */
interface TemporalScenarioOption {
	slug: WxScenario;
	label: string;
	/** Whether the timeline bundle has been built (`build --timeline`). */
	bundleReady: boolean;
}

/** Enumerate every registered scenario that carries a v2 `evolution` block. */
function temporalScenarioOptions(): TemporalScenarioOption[] {
	const options: TemporalScenarioOption[] = [];
	for (const slug of WX_SCENARIO_VALUES) {
		let isTemporal = false;
		try {
			isTemporal = loadScenario(slug).evolution !== undefined;
		} catch (err) {
			// `loadScenario` throws on a genuinely broken scenario literal (a
			// malformed `evolution` block fails the Zod schema). Swallowing it
			// silently would make a broken v2 scenario vanish from the picker
			// with no signal -- log it so the failure surfaces in the server
			// logs even though the picker still skips the scenario.
			isTemporal = false;
			log.error(
				'failed to load scenario for temporal picker',
				{ metadata: { slug } },
				err instanceof Error ? err : new Error(String(err)),
			);
		}
		if (!isTemporal) continue;
		const timelinePath = resolve(REPO_ROOT, 'data', 'wx-scenarios', slug, WX_TIMELINE_BUNDLE.TIMELINE);
		options.push({ slug, label: WX_SCENARIO_LABELS[slug], bundleReady: existsSync(timelinePath) });
	}
	return options;
}

/** A METAR shown at one replay step. */
interface ReplayMetar {
	station: string;
	raw: string;
}

/** A TAF shown alongside the replay (issued before/at the step). */
interface ReplayTaf {
	station: string;
	issuedZulu: string;
	raw: string;
}

/** One per-hour step in the replay. */
interface ReplayStep {
	at: string;
	zulu: string;
	hoursSinceStart: number;
	metars: ReplayMetar[];
	/** Inline SVG charts for this hour, keyed by chart kind. */
	charts: { kind: string; svg: string }[];
}

/** The full replay payload for one scenario. */
interface ReplayBundle {
	slug: WxScenario;
	label: string;
	window: { start: string; end: string; stepMinutes: number };
	steps: ReplayStep[];
	/** Every TAF issued across the window (shown as forecasting context). */
	tafs: ReplayTaf[];
}

/** One per-hour chart entry inside the on-disk `timeline.json`. */
interface TimelineChartEntry {
	kind: string;
	/** wx-charts renderer chart-type the spec validates against. */
	chartType: ChartType;
	/** Bundle-relative path to the chart spec (`<kind>.spec.yaml`). */
	specFile: string;
	/** Bundle-relative path to the chart's source-bytes directory. */
	sourcesDir: string;
	/** Source-file basenames the spec's `cache://` URIs reference. */
	sources: string[];
}

/** Shape of the on-disk `timeline.json` the CLI writes. */
interface TimelineJson {
	scenarioId: string;
	window: { start: string; end: string; stepMinutes: number };
	snapshots: {
		at: string;
		zulu: string;
		hoursSinceStart: number;
		metars: { station: string; raw: string }[];
		charts: TimelineChartEntry[];
	}[];
}

/** Shape of one entry in `products/taf-sequence.json`. */
interface TafSequenceEntry {
	issuedAt: string;
	station: string;
	raw: string;
}

/** Guard: is a chart-type a registered wx-charts renderer key? */
function isChartType(value: string): value is ChartType {
	return value in CHART_RENDERERS;
}

/**
 * Map a chart spec's `sources` object onto the renderer's source map. The
 * renderer keys its `sources` input by the spec's `sources` object keys;
 * each spec source URI (`cache://scenarios/<id>/<name>.json`) resolves to
 * the on-disk source file whose basename matches. Mirrors the basename
 * match the timeline-bundle assembler uses when it stores the sources.
 */
function sourceMapFromSpec(spec: unknown, sourcesDir: string): Record<string, string> {
	const specSources = (spec as { sources?: Record<string, string> }).sources ?? {};
	const map: Record<string, string> = {};
	for (const [key, uri] of Object.entries(specSources)) {
		const base = uri.split('/').at(-1) ?? uri;
		const srcPath = resolve(sourcesDir, base);
		if (!existsSync(srcPath)) {
			throw new Error(`wx-replay: chart source '${key}' (${uri}) -- no file at ${srcPath}`);
		}
		map[key] = readFileSync(srcPath, 'utf8');
	}
	return map;
}

/**
 * Render one per-hour timeline chart spec to an inline SVG string. Reads
 * the spec + its source bytes off disk, then renders via the registered
 * wx-charts renderer -- exactly the on-demand pattern the test-page derive
 * endpoint uses. Returns `null` when the spec file is absent (older bundle).
 */
async function renderTimelineChart(bundleDir: string, chart: TimelineChartEntry): Promise<string | null> {
	const specPath = resolve(bundleDir, chart.specFile);
	if (!existsSync(specPath)) return null;
	if (!isChartType(chart.chartType)) {
		throw new Error(`wx-replay: unknown chart-type "${chart.chartType}" for ${chart.specFile}`);
	}
	const specRaw: unknown = parseYaml(readFileSync(specPath, 'utf8'));
	const renderer = CHART_RENDERERS[chart.chartType];
	const spec = renderer.schema.parse(specRaw);
	const sourcesDir = resolve(bundleDir, chart.sourcesDir);
	const rendered = await renderer.render({
		spec: spec as never,
		sources: sourceMapFromSpec(specRaw, sourcesDir),
		basemapPath: BASEMAP_PATH,
		contextBasemapPath: CONTEXT_BASEMAP_PATH,
		libraryVersion: REPLAY_LIBRARY_VERSION,
	});
	return rendered.svg;
}

/**
 * Read + assemble the replay bundle for one scenario from its on-disk
 * timeline artifacts. Throws a 409 when the timeline bundle has not been
 * built yet (`wx-scenario build <slug> --timeline`).
 *
 * Per-hour charts are stored as specs (ADR 018) and rendered to SVG on
 * demand here -- server-side, so the page still receives inline SVG.
 */
async function loadReplayBundle(slug: WxScenario): Promise<ReplayBundle> {
	const bundleDir = resolve(REPO_ROOT, 'data', 'wx-scenarios', slug);
	const timelinePath = resolve(bundleDir, WX_TIMELINE_BUNDLE.TIMELINE);
	if (!existsSync(timelinePath)) {
		throw error(
			409,
			`The timeline bundle for "${slug}" has not been built. Run: bun run wx-scenario build ${slug} --timeline`,
		);
	}

	const timeline = JSON.parse(readFileSync(timelinePath, 'utf8')) as TimelineJson;

	const steps: ReplayStep[] = await Promise.all(
		timeline.snapshots.map(async (snap) => {
			const charts: { kind: string; svg: string }[] = [];
			for (const chart of snap.charts) {
				const svg = await renderTimelineChart(bundleDir, chart);
				if (svg === null) continue;
				charts.push({ kind: chart.kind, svg });
			}
			return {
				at: snap.at,
				zulu: snap.zulu,
				hoursSinceStart: snap.hoursSinceStart,
				metars: snap.metars,
				charts,
			};
		}),
	);

	// TAF sequence -- optional context. Absent on an older bundle; tolerate.
	const tafs: ReplayTaf[] = [];
	const tafPath = resolve(bundleDir, WX_TIMELINE_BUNDLE.PRODUCTS_DIR, WX_TIMELINE_BUNDLE.TAF_SEQUENCE);
	if (existsSync(tafPath)) {
		const tafSeq = JSON.parse(readFileSync(tafPath, 'utf8')) as TafSequenceEntry[];
		for (const entry of tafSeq) {
			tafs.push({ station: entry.station, issuedZulu: zuluHourLabel(entry.issuedAt), raw: entry.raw });
		}
	}

	return {
		slug,
		label: WX_SCENARIO_LABELS[slug],
		window: timeline.window,
		steps,
		tafs,
	};
}

/** Guard: is a raw query value a registered scenario slug? */
function isWxScenario(value: string): value is WxScenario {
	return (WX_SCENARIO_VALUES as readonly string[]).includes(value);
}

export const load: PageServerLoad = async (event) => {
	requireAuth(event);

	const scenarios = temporalScenarioOptions();
	const requested = event.url.searchParams.get('scenario');

	if (requested === null || requested.length === 0) {
		return { mode: 'picker' as const, scenarios, bundle: null };
	}

	if (!isWxScenario(requested)) {
		throw error(400, `Unknown scenario "${requested}".`);
	}
	const option = scenarios.find((s) => s.slug === requested);
	if (option === undefined) {
		throw error(400, `"${requested}" is not a temporal scenario -- it has no evolution block.`);
	}

	const bundle = await loadReplayBundle(requested);
	return { mode: 'replay' as const, scenarios, bundle };
};
