/**
 * `@ab/wx-drill/server` -- temporal-drill bundle builder.
 *
 * Server-only: runs the wx-engine (`@ab/wx-engine/server`) to derive the
 * METAR / TAF sequences and the per-hour front geometry for a v2 scenario,
 * then packs them into the slim, browser-safe `TemporalDrillBundle` the pure
 * generators in `temporal-drill.ts` consume.
 *
 * No chart rendering -- the temporal drill only needs encoded text + front
 * polylines, so this is far lighter than the full timeline-bundle CLI.
 */

import {
	WX_SCENARIO_LABELS,
	WX_TEMPORAL_DEFAULT_STEP_MINUTES,
	WX_TEMPORAL_MS_PER_HOUR,
	type WxScenario,
} from '@ab/constants';
import { sampleTruthAt } from '@ab/wx-engine';
import { deriveMetarSequence, deriveTafSequence, loadScenario } from '@ab/wx-engine/server';
import type { TemporalDrillBundle, TemporalMetar, TemporalSnapshot, TemporalTaf } from './temporal-types';

/** Milliseconds per minute. */
const MS_PER_MINUTE = 60_000;

/** Standard synoptic TAF issue hours (UTC). */
const SYNOPTIC_HOURS = [0, 6, 12, 18];

/** Compress an ISO timestamp to a `DDHHZ` zulu label. */
function zulu(iso: string): string {
	const d = new Date(iso);
	const day = String(d.getUTCDate()).padStart(2, '0');
	const hour = String(d.getUTCHours()).padStart(2, '0');
	const min = d.getUTCMinutes();
	return `${day}${hour}${min === 0 ? '' : String(min).padStart(2, '0')}Z`;
}

/** Enumerate the snapshot timestamps of an evolution window. */
function enumerateTimestamps(startIso: string, endIso: string, stepMinutes: number): string[] {
	const startMs = new Date(startIso).getTime();
	const endMs = new Date(endIso).getTime();
	const stepMs = stepMinutes * MS_PER_MINUTE;
	const out: string[] = [];
	for (let ms = startMs; ms < endMs; ms += stepMs) out.push(new Date(ms).toISOString());
	out.push(new Date(endMs).toISOString());
	return out;
}

/** Standard TAF issue times: the synoptic hour at/before start, then every 6h. */
function tafIssueTimes(startIso: string, endIso: string): string[] {
	const startDate = new Date(startIso);
	const endMs = new Date(endIso).getTime();
	const startMs = startDate.getTime();
	const priorHour = SYNOPTIC_HOURS.filter((h) => h <= startDate.getUTCHours()).at(-1) ?? 0;
	const priorIssue = new Date(
		Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate(), priorHour, 0, 0),
	);
	const out = [priorIssue.toISOString()];
	let cursor = priorIssue.getTime() + 6 * WX_TEMPORAL_MS_PER_HOUR;
	while (cursor <= endMs) {
		if (cursor > startMs) out.push(new Date(cursor).toISOString());
		cursor += 6 * WX_TEMPORAL_MS_PER_HOUR;
	}
	return out;
}

/**
 * Build the temporal-drill bundle for one v2 scenario. Throws when the
 * scenario carries no `evolution` block -- the temporal drill is v2-only.
 */
export function buildTemporalDrillBundle(slug: WxScenario): TemporalDrillBundle {
	const truth = loadScenario(slug);
	if (truth.evolution === undefined) {
		throw new Error(`wx-drill: temporal drill requires a v2 scenario; "${slug}" has no \`evolution\` block`);
	}
	const evolution = truth.evolution;
	const stepMinutes = evolution.stepMinutes ?? WX_TEMPORAL_DEFAULT_STEP_MINUTES;

	// --- METAR sequence: one per station per hour. ---
	// The METAR DDHHMMZ stamp is observation-truncated (rounded to :53), so we
	// walk the window timestamps to get the canonical ISO instants and pair
	// them with each station's derived sequence by index.
	const timestamps = enumerateTimestamps(evolution.start, evolution.end, stepMinutes);
	const metars: TemporalMetar[] = [];
	for (const station of truth.fbStations) {
		const seq = deriveMetarSequence(truth, station, { stepMinutes });
		seq.forEach((metar, idx) => {
			const at = timestamps[idx];
			if (at === undefined) return;
			metars.push({ at, zulu: zulu(at), station, raw: metar.raw });
		});
	}

	// --- TAF sequence: one per station per standard issue time. ---
	const issueTimes = tafIssueTimes(evolution.start, evolution.end);
	const tafs: TemporalTaf[] = [];
	for (const station of truth.fbStations) {
		const seq = deriveTafSequence(truth, station, { issueTimes });
		seq.forEach((taf, idx) => {
			const issuedAt = issueTimes[idx];
			if (issuedAt === undefined) return;
			tafs.push({ issuedAt, issuedZulu: zulu(issuedAt), station, raw: taf.raw });
		});
	}

	// --- Snapshots: front geometry at each timestamp. ---
	const snapshots: TemporalSnapshot[] = timestamps.map((at) => {
		const sampled = sampleTruthAt(truth, at);
		return {
			at,
			zulu: zulu(at),
			fronts: sampled.synoptic.fronts.map((f) => ({
				id: f.id,
				kind: f.kind,
				points: f.points.map((p) => [p[0], p[1]] as [number, number]),
				pipSide: f.pipSide,
			})),
		};
	});

	// --- Stations: fixed positions for the spatial exercise. ---
	const stations = truth.fbStations
		.map((icao) => truth.stations[icao])
		.filter((s): s is NonNullable<typeof s> => s !== undefined)
		.map((s) => ({ icao: s.icao, lon: s.lon, lat: s.lat, name: s.name }));

	return {
		scenarioSlug: slug,
		label: WX_SCENARIO_LABELS[slug],
		window: { start: evolution.start, end: evolution.end, stepMinutes },
		metars,
		tafs,
		snapshots,
		stations,
	};
}

/** Build temporal-drill bundles for a set of scenario slugs (v2-only). */
export function buildTemporalDrillBundles(slugs: readonly WxScenario[]): TemporalDrillBundle[] {
	return slugs.map(buildTemporalDrillBundle);
}
