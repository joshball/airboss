// @browser-globals: server-only -- never imported by client .svelte
/**
 * v2 timeline-bundle assembler.
 *
 * `buildTimelineBundle(truth, options)` walks a v2 `TruthModel`'s evolution
 * window and assembles the full "scenario package" described in the plan's
 * "Scenario packages" section:
 *
 *   - `timeline`        every hourly v1 snapshot (via `sampleTruthAt`)
 *   - `metarSequence`   one METAR per station per hour
 *   - `tafSequence`     one TAF per station per standard issue time
 *   - `pirepEvents`     time-stamped PIREP reports across the window
 *   - `airmetTimeline`  advisory issue/extend/cancel events
 *   - `charts`          per-hour SVG charts (surface-analysis + metar-plot)
 *
 * Server-only: the assembler renders charts to SVG via `@ab/wx-charts/server`
 * and wraps the server-only `deriveX` derivations. The CLI (`scripts/
 * wx-scenario/build.ts`) calls `buildTimelineBundle` then `writeTimelineBundle`.
 *
 * Round-trip parser validation is inherited: every METAR / TAF emitted comes
 * straight from `deriveMetar` / `deriveTaf`, which re-parse their own output
 * through `@ab/wx-charts` with zero warnings.
 *
 * See `docs/work/plans/2026-05-14-truth-model-v2-temporal.md`.
 */

import {
	CHART_TYPES,
	type ChartType,
	WX_TEMPORAL_DEFAULT_STEP_MINUTES,
	WX_TEMPORAL_MS_PER_HOUR,
	WX_TIMELINE_BUNDLE,
	WX_TIMELINE_CHART_KINDS,
	type WxTimelineChartKind,
} from '@ab/constants';
import { CHART_RENDERERS } from '@ab/wx-charts/server';
import { deriveMetarPlotChart } from '../charts/metar-plot';
import { deriveSurfaceAnalysisChart } from '../charts/surface-analysis';
import type { ChartArtifact } from '../charts/types';
import { sampleTruthAt } from '../truth/time';
import type { TruthModel } from '../truth/types';
import { deriveMetar } from './metar';
import { derivePireps } from './pirep';
import { type AirmetTimelineEntry, deriveAirmetTimeline, deriveTafSequence } from './temporal';
import type { DerivedMetar, DerivedPirep, DerivedTaf } from './types';

/** Milliseconds per minute -- step-size conversion. */
const MS_PER_MINUTE = 60_000;

/**
 * Resolve the evolution window of a v2 truth model. Throws when the model
 * carries no `evolution` block -- `--timeline` is v2-only by contract.
 */
function requireEvolution(truth: TruthModel): { start: string; end: string; stepMinutes: number } {
	if (truth.evolution === undefined) {
		throw new Error(
			'wx-scenario build --timeline requires a v2 scenario with an `evolution` block; this scenario is v1-only',
		);
	}
	return truth.evolution;
}

/**
 * Enumerate the timestamps of an evolution window at a given step size.
 * Inclusive of both endpoints; the final step may be shorter than
 * `stepMinutes` so `end` is always emitted. Mirrors `temporal.ts`.
 */
function enumerateTimestamps(startIso: string, endIso: string, stepMinutes: number): string[] {
	const startMs = new Date(startIso).getTime();
	const endMs = new Date(endIso).getTime();
	const stepMs = stepMinutes * MS_PER_MINUTE;
	const timestamps: string[] = [];
	for (let ms = startMs; ms < endMs; ms += stepMs) {
		timestamps.push(new Date(ms).toISOString());
	}
	timestamps.push(new Date(endMs).toISOString());
	return timestamps;
}

/**
 * Compress an ISO timestamp to a zulu hour label (`DDHHZ`). Used to name the
 * per-hour chart subdirectory (`charts/<ZULU>/`).
 */
export function zuluHourLabel(iso: string): string {
	const d = new Date(iso);
	const day = String(d.getUTCDate()).padStart(2, '0');
	const hour = String(d.getUTCHours()).padStart(2, '0');
	const min = d.getUTCMinutes();
	const minLabel = min === 0 ? '' : String(min).padStart(2, '0');
	return `${day}${hour}${minLabel}Z`;
}

// ----------------------------------------------------------------
// Bundle data shapes
// ----------------------------------------------------------------

/** One hourly v1 snapshot inside the timeline window. */
export interface TimelineBundleSnapshot {
	/** The timestamp (UTC ISO). */
	at: string;
	/** Zulu hour label, matching the per-hour chart subdirectory name. */
	zulu: string;
	/** Hours elapsed since the evolution start. */
	hoursSinceStart: number;
	/** The v1-shape truth model at this instant (no `evolution` block). */
	truth: TruthModel;
}

/** A METAR derived for one station at one timestamp. */
export interface TimelineMetarSample {
	at: string;
	zulu: string;
	station: string;
	raw: string;
}

/** A TAF derived as issued at one issue time. */
export interface TimelineTafSample {
	issuedAt: string;
	station: string;
	raw: string;
}

/** A time-stamped PIREP event. */
export interface TimelinePirepEvent {
	/** The timestamp the PIREP was filed (UTC ISO). */
	at: string;
	zulu: string;
	raw: string;
	lon: number;
	lat: number;
}

/** One per-hour rendered chart. */
export interface TimelineChart {
	at: string;
	zulu: string;
	kind: WxTimelineChartKind;
	/** The rendered SVG document. */
	svg: string;
}

/** The full assembled timeline bundle. */
export interface TimelineBundle {
	scenarioId: string;
	window: { start: string; end: string; stepMinutes: number };
	snapshots: TimelineBundleSnapshot[];
	metarSequence: TimelineMetarSample[];
	tafSequence: TimelineTafSample[];
	pirepEvents: TimelinePirepEvent[];
	airmetTimeline: AirmetTimelineEntry[];
	charts: TimelineChart[];
}

/** Options for `buildTimelineBundle`. */
export interface BuildTimelineBundleOptions {
	/** Override the native step size (minutes). Defaults to the scenario's. */
	stepMinutes?: number;
	/** Filesystem path to the substrate basemap (`us-states-10m.json`). */
	basemapPath: string;
	/** Filesystem path to the North-America context basemap (optional). */
	contextBasemapPath?: string;
	/** Stamped into chart provenance. */
	libraryVersion?: string;
}

/** Default `libraryVersion` stamp for timeline-bundle charts. */
const TIMELINE_LIBRARY_VERSION = 'wx-engine-timeline';

// ----------------------------------------------------------------
// Standard TAF issue times
// ----------------------------------------------------------------

/**
 * Standard TAF issue times for a scenario window. TAFs are issued at the
 * synoptic hours 00/06/12/18Z. The bundle issues a TAF at the last synoptic
 * hour at or before `start` (so an early TAF forecasts the front at its
 * slower initial speed -- the "TAF-vs-actuals" divergence the drills exploit)
 * and at every synoptic hour inside the window.
 */
function standardTafIssueTimes(startIso: string, endIso: string): string[] {
	const startMs = new Date(startIso).getTime();
	const endMs = new Date(endIso).getTime();
	const synopticHours = [0, 6, 12, 18];
	const issueTimes: string[] = [];

	// The synoptic hour at or before `start`. Hour 0 (`0000Z`) is always a
	// member, so the filtered list is never empty -- the first synoptic hour
	// of `start`'s own UTC day is the prior issue.
	const startDate = new Date(startIso);
	const priorHour = synopticHours.filter((h) => h <= startDate.getUTCHours()).at(-1) ?? 0;
	const priorIssue = new Date(
		Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate(), priorHour, 0, 0),
	);
	issueTimes.push(priorIssue.toISOString());

	// Every synoptic hour strictly inside (start, end].
	let cursor = priorIssue.getTime() + 6 * WX_TEMPORAL_MS_PER_HOUR;
	while (cursor <= endMs) {
		if (cursor > startMs) issueTimes.push(new Date(cursor).toISOString());
		cursor += 6 * WX_TEMPORAL_MS_PER_HOUR;
	}
	return issueTimes;
}

// ----------------------------------------------------------------
// Chart rendering
// ----------------------------------------------------------------

/**
 * Map a chart artifact's `sources[]` onto the renderer's source map. The
 * renderer keys its `sources` input by the spec's `sources` object keys;
 * each spec source URI (`cache://scenarios/<id>/<name>.json`) is matched to
 * the artifact source whose `path` shares the same basename.
 */
function sourceMapFromArtifact(artifact: ChartArtifact): Record<string, string> {
	const spec = artifact.spec as { sources?: Record<string, string> };
	const specSources = spec.sources ?? {};
	const byBasename = new Map<string, string>();
	for (const src of artifact.sources) {
		const base = src.path.split('/').at(-1) ?? src.path;
		byBasename.set(base, src.bytes);
	}
	const map: Record<string, string> = {};
	for (const [key, uri] of Object.entries(specSources)) {
		const base = uri.split('/').at(-1) ?? uri;
		const bytes = byBasename.get(base);
		if (bytes === undefined) {
			throw new Error(`timeline-bundle: chart source '${key}' (${uri}) has no matching artifact source`);
		}
		map[key] = bytes;
	}
	return map;
}

/** Render a single chart artifact to an SVG document. */
async function renderArtifact(
	artifact: ChartArtifact,
	chartType: ChartType,
	options: BuildTimelineBundleOptions,
): Promise<string> {
	const renderer = CHART_RENDERERS[chartType];
	const spec = renderer.schema.parse(artifact.spec);
	const rendered = await renderer.render({
		spec: spec as never,
		sources: sourceMapFromArtifact(artifact),
		basemapPath: options.basemapPath,
		contextBasemapPath: options.contextBasemapPath,
		libraryVersion: options.libraryVersion ?? TIMELINE_LIBRARY_VERSION,
	});
	return rendered.svg;
}

// ----------------------------------------------------------------
// Bundle assembler
// ----------------------------------------------------------------

/**
 * Assemble the full v2 timeline bundle for a temporal scenario. Requires a
 * v2 `TruthModel` carrying an `evolution` block; throws otherwise.
 *
 * The assembler is deterministic: identical truth literal + identical
 * options yield a byte-identical bundle (chart rendering is the only
 * I/O-touching step and it reads only the static basemap files).
 */
export async function buildTimelineBundle(
	truth: TruthModel,
	options: BuildTimelineBundleOptions,
): Promise<TimelineBundle> {
	const evolution = requireEvolution(truth);
	const stepMinutes = options.stepMinutes ?? evolution.stepMinutes ?? WX_TEMPORAL_DEFAULT_STEP_MINUTES;
	const startMs = new Date(evolution.start).getTime();
	const timestamps = enumerateTimestamps(evolution.start, evolution.end, stepMinutes);

	// --- Snapshots: one v1 truth model per timestamp. ---
	const snapshots: TimelineBundleSnapshot[] = timestamps.map((at) => ({
		at,
		zulu: zuluHourLabel(at),
		hoursSinceStart: (new Date(at).getTime() - startMs) / WX_TEMPORAL_MS_PER_HOUR,
		truth: sampleTruthAt(truth, at),
	}));

	// --- METAR sequence: one METAR per station per hour. ---
	const metarSequence: TimelineMetarSample[] = [];
	for (const snap of snapshots) {
		for (const station of snap.truth.fbStations) {
			const metar: DerivedMetar = deriveMetar(snap.truth, station, snap.at);
			metarSequence.push({ at: snap.at, zulu: snap.zulu, station, raw: metar.raw });
		}
	}

	// --- TAF sequence: one TAF per station per standard issue time. ---
	const issueTimes = standardTafIssueTimes(evolution.start, evolution.end);
	const tafSequence: TimelineTafSample[] = [];
	for (const station of truth.fbStations) {
		const tafs: DerivedTaf[] = deriveTafSequence(truth, station, { issueTimes });
		tafs.forEach((taf, idx) => {
			const issuedAt = issueTimes[idx];
			if (issuedAt === undefined) return;
			tafSequence.push({ issuedAt, station, raw: taf.raw });
		});
	}

	// --- PIREP events: time-stamped reports across the window. ---
	// Each hourly snapshot's PIREPs are anchored to that snapshot's instant.
	const pirepEvents: TimelinePirepEvent[] = [];
	const seenPirepRaw = new Set<string>();
	for (const snap of snapshots) {
		const pireps: DerivedPirep[] = derivePireps(snap.truth);
		for (const pirep of pireps) {
			if (seenPirepRaw.has(pirep.raw)) continue;
			seenPirepRaw.add(pirep.raw);
			pirepEvents.push({ at: snap.at, zulu: snap.zulu, raw: pirep.raw, lon: pirep.lon, lat: pirep.lat });
		}
	}

	// --- AIRMET timeline: advisory issue/extend/cancel events. ---
	const airmetTimeline = deriveAirmetTimeline(truth, { stepMinutes });

	// --- Per-hour charts: surface-analysis + metar-plot for each snapshot. ---
	const charts: TimelineChart[] = [];
	for (const snap of snapshots) {
		const metars = snap.truth.fbStations.map((station) => deriveMetar(snap.truth, station, snap.at));
		for (const kind of WX_TIMELINE_CHART_KINDS) {
			const { artifact, chartType } = deriveTimelineChart(kind, snap.truth, metars);
			const svg = await renderArtifact(artifact, chartType, options);
			charts.push({ at: snap.at, zulu: snap.zulu, kind, svg });
		}
	}

	return {
		scenarioId: truth.scenarioId,
		window: { start: evolution.start, end: evolution.end, stepMinutes },
		snapshots,
		metarSequence,
		tafSequence,
		pirepEvents,
		airmetTimeline,
		charts,
	};
}

/** Derive the chart artifact + renderer chart-type for one timeline chart kind. */
function deriveTimelineChart(
	kind: WxTimelineChartKind,
	truth: TruthModel,
	metars: DerivedMetar[],
): { artifact: ChartArtifact; chartType: ChartType } {
	if (kind === 'surface-analysis') {
		return {
			artifact: deriveSurfaceAnalysisChart(truth, metars, truth.scenarioId),
			chartType: CHART_TYPES.SURFACE_ANALYSIS,
		};
	}
	return {
		artifact: deriveMetarPlotChart(truth, metars, truth.scenarioId),
		chartType: CHART_TYPES.METAR_PLOT_GRID,
	};
}

// ----------------------------------------------------------------
// Bundle writer
// ----------------------------------------------------------------

type NodeFs = {
	existsSync: (p: string) => boolean;
	mkdirSync: (p: string, opts: { recursive: boolean }) => void;
	writeFileSync: (p: string, data: string) => void;
};
type NodePath = { resolve: (...parts: string[]) => string; dirname: (p: string) => string };
type GetBuiltinModule = (spec: string) => unknown;

/** Lazy-load a Node built-in via `process.getBuiltinModule`. Mirrors `engine.ts`. */
function loadBuiltin<T>(spec: string): T {
	const proc = (typeof process !== 'undefined' ? process : undefined) as
		| (NodeJS.Process & { getBuiltinModule?: GetBuiltinModule })
		| undefined;
	const getBuiltin = proc?.getBuiltinModule;
	if (typeof getBuiltin !== 'function') {
		throw new Error(`wx-engine: ${spec} unavailable in this runtime (no process.getBuiltinModule)`);
	}
	return getBuiltin(spec) as T;
}

/**
 * Write the assembled timeline bundle into `data/wx-scenarios/<slug>/`:
 *
 *   timeline.json
 *   products/metar-sequence.json
 *   products/taf-sequence.json
 *   products/pirep-events.json
 *   products/airmet-timeline.json
 *   charts/<ZULU>/<kind>.svg
 *
 * Additive to the v1 bundle the engine's `writeScenarioBundle` already wrote:
 * the v1 `truth.json` / `products/*` / `commentary.*` are left untouched.
 */
export function writeTimelineBundle(bundle: TimelineBundle, bundleDir: string): void {
	const fs = loadBuiltin<NodeFs>('node:fs');
	const path = loadBuiltin<NodePath>('node:path');

	const write = (p: string, content: string): void => {
		const dir = path.dirname(p);
		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(p, content);
	};

	write(path.resolve(bundleDir, WX_TIMELINE_BUNDLE.TIMELINE), `${JSON.stringify(timelineJson(bundle), null, 2)}\n`);

	const productsDir = path.resolve(bundleDir, WX_TIMELINE_BUNDLE.PRODUCTS_DIR);
	write(
		path.resolve(productsDir, WX_TIMELINE_BUNDLE.METAR_SEQUENCE),
		`${JSON.stringify(bundle.metarSequence, null, 2)}\n`,
	);
	write(path.resolve(productsDir, WX_TIMELINE_BUNDLE.TAF_SEQUENCE), `${JSON.stringify(bundle.tafSequence, null, 2)}\n`);
	write(path.resolve(productsDir, WX_TIMELINE_BUNDLE.PIREP_EVENTS), `${JSON.stringify(bundle.pirepEvents, null, 2)}\n`);
	write(
		path.resolve(productsDir, WX_TIMELINE_BUNDLE.AIRMET_TIMELINE),
		`${JSON.stringify(bundle.airmetTimeline, null, 2)}\n`,
	);

	const chartsDir = path.resolve(bundleDir, WX_TIMELINE_BUNDLE.CHARTS_DIR);
	for (const chart of bundle.charts) {
		write(path.resolve(chartsDir, chart.zulu, `${chart.kind}.svg`), chart.svg);
	}
}

/**
 * The serialized `timeline.json` shape. The full truth snapshot is included
 * per timestamp so any `deriveX` consumer can re-derive without re-running
 * the engine; the SVG charts live as files under `charts/<ZULU>/`.
 */
function timelineJson(bundle: TimelineBundle): unknown {
	return {
		scenarioId: bundle.scenarioId,
		window: bundle.window,
		snapshots: bundle.snapshots.map((s) => ({
			at: s.at,
			zulu: s.zulu,
			hoursSinceStart: s.hoursSinceStart,
			truth: s.truth,
			metars: bundle.metarSequence.filter((m) => m.at === s.at).map((m) => ({ station: m.station, raw: m.raw })),
			charts: bundle.charts
				.filter((c) => c.at === s.at)
				.map((c) => ({ kind: c.kind, file: `${WX_TIMELINE_BUNDLE.CHARTS_DIR}/${s.zulu}/${c.kind}.svg` })),
		})),
	};
}
