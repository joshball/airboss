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
 * Reading the bundle here -- not deriving live -- keeps the page load fast
 * and means the replay surface consumes exactly the same artifacts the CLI
 * produces.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireAuth } from '@ab/auth';
import { WX_SCENARIO_LABELS, WX_SCENARIO_VALUES, WX_TIMELINE_BUNDLE, type WxScenario } from '@ab/constants';
import { loadScenario } from '@ab/wx-engine/server';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

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
		} catch {
			isTemporal = false;
		}
		if (!isTemporal) continue;
		const timelinePath = resolve(
			REPO_ROOT,
			'data',
			'wx-scenarios',
			slug,
			WX_TIMELINE_BUNDLE.TIMELINE,
		);
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

/** Shape of the on-disk `timeline.json` the CLI writes. */
interface TimelineJson {
	scenarioId: string;
	window: { start: string; end: string; stepMinutes: number };
	snapshots: {
		at: string;
		zulu: string;
		hoursSinceStart: number;
		metars: { station: string; raw: string }[];
		charts: { kind: string; file: string }[];
	}[];
}

/** Shape of one entry in `products/taf-sequence.json`. */
interface TafSequenceEntry {
	issuedAt: string;
	station: string;
	raw: string;
}

/**
 * Read + assemble the replay bundle for one scenario from its on-disk
 * timeline artifacts. Throws a 409 when the timeline bundle has not been
 * built yet (`wx-scenario build <slug> --timeline`).
 */
function loadReplayBundle(slug: WxScenario): ReplayBundle {
	const bundleDir = resolve(REPO_ROOT, 'data', 'wx-scenarios', slug);
	const timelinePath = resolve(bundleDir, WX_TIMELINE_BUNDLE.TIMELINE);
	if (!existsSync(timelinePath)) {
		throw error(
			409,
			`The timeline bundle for "${slug}" has not been built. Run: bun run wx-scenario build ${slug} --timeline`,
		);
	}

	const timeline = JSON.parse(readFileSync(timelinePath, 'utf8')) as TimelineJson;

	const steps: ReplayStep[] = timeline.snapshots.map((snap) => {
		const charts: { kind: string; svg: string }[] = [];
		for (const chart of snap.charts) {
			const svgPath = resolve(bundleDir, chart.file);
			if (!existsSync(svgPath)) continue;
			charts.push({ kind: chart.kind, svg: readFileSync(svgPath, 'utf8') });
		}
		return {
			at: snap.at,
			zulu: snap.zulu,
			hoursSinceStart: snap.hoursSinceStart,
			metars: snap.metars,
			charts,
		};
	});

	// TAF sequence -- optional context. Absent on an older bundle; tolerate.
	const tafs: ReplayTaf[] = [];
	const tafPath = resolve(bundleDir, WX_TIMELINE_BUNDLE.PRODUCTS_DIR, WX_TIMELINE_BUNDLE.TAF_SEQUENCE);
	if (existsSync(tafPath)) {
		const tafSeq = JSON.parse(readFileSync(tafPath, 'utf8')) as TafSequenceEntry[];
		for (const entry of tafSeq) {
			tafs.push({ station: entry.station, issuedZulu: zuluLabel(entry.issuedAt), raw: entry.raw });
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

/** Compress an ISO timestamp to a `DDHHZ` label. */
function zuluLabel(iso: string): string {
	const d = new Date(iso);
	const day = String(d.getUTCDate()).padStart(2, '0');
	const hour = String(d.getUTCHours()).padStart(2, '0');
	const min = d.getUTCMinutes();
	return `${day}${hour}${min === 0 ? '' : String(min).padStart(2, '0')}Z`;
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

	const bundle = loadReplayBundle(requested);
	return { mode: 'replay' as const, scenarios, bundle };
};
