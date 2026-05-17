/**
 * `@ab/wx-drill` -- temporal exercise generators.
 *
 * Pure functions over a `TemporalDrillBundle`. Three exercise kinds, one per
 * generator, all from the plan's "Drill exercises" section:
 *
 *   sequence-change  three METARs from one station -> "what changed?"
 *   taf-vs-actuals   a TAF + the actual METAR -> "where did the TAF miss?"
 *   front-position   front motion -> "which airport is behind the front?"
 *
 * Browser-safe: no fs, no `deriveX`, no Node built-ins. Re-parsing the raw
 * products through `@ab/wx-charts` (`parseMetar` / `parseTaf`) is the only
 * dependency, and that barrel is itself browser-safe.
 *
 * Deterministic: `buildTemporalPack` is seeded; identical bundle + seed
 * yields identical exercises in identical order.
 *
 * See `docs/work/plans/2026-05-14-truth-model-v2-temporal.md`.
 */

import { WX_TEMPORAL_FRONT_POSITION_DISTRACTOR_CAP } from '@ab/constants';
import { type ParsedMetar, parseMetar } from '@ab/wx-charts';
import { mulberry32 } from './prng';
import type {
	TemporalDrillBundle,
	TemporalDrillPack,
	TemporalExercise,
	TemporalFrontSnapshot,
	TemporalMetar,
} from './temporal-types';

// ----------------------------------------------------------------
// Option shuffling
// ----------------------------------------------------------------

/** A correct/distractor option pre-shuffle. */
interface RawOption {
	text: string;
	correct: boolean;
}

/** Seeded Fisher-Yates shuffle so the correct option is not always first. */
function shuffleOptions(rand: () => number, options: RawOption[]): RawOption[] {
	const out = [...options];
	for (let i = out.length - 1; i > 0; i -= 1) {
		const j = Math.floor(rand() * (i + 1));
		const a = out[i];
		const b = out[j];
		if (a === undefined || b === undefined) continue;
		out[i] = b;
		out[j] = a;
	}
	return out;
}

// ----------------------------------------------------------------
// METAR field summaries
// ----------------------------------------------------------------

/** A compact human description of a parsed METAR's significant fields. */
function describeMetar(parsed: ParsedMetar): string {
	const parts: string[] = [];
	if (parsed.wind !== null) {
		const w = parsed.wind;
		const dir = w.variable ? 'VRB' : `${String(w.directionDeg ?? 0).padStart(3, '0')}deg`;
		const gust = w.gustKt !== null ? ` gusting ${w.gustKt}` : '';
		parts.push(`wind ${dir} ${w.speedKt}kt${gust}`);
	}
	if (parsed.visibilitySM !== null) parts.push(`${parsed.visibilitySM}SM visibility`);
	if (parsed.weather.length > 0) parts.push(`weather ${parsed.weather.join(' ')}`);
	const lowest = lowestCeiling(parsed);
	if (lowest !== null) parts.push(`ceiling ${lowest}ft`);
	return parts.join(', ');
}

/** Lowest BKN/OVC layer base, in ft AGL; `null` when none reported. */
function lowestCeiling(parsed: ParsedMetar): number | null {
	let lowest: number | null = null;
	for (const layer of parsed.clouds) {
		if (layer.cover !== 'BKN' && layer.cover !== 'OVC') continue;
		if (layer.heightFtAgl === null) continue;
		if (lowest === null || layer.heightFtAgl < lowest) lowest = layer.heightFtAgl;
	}
	return lowest;
}

/**
 * Enumerate the field-level changes between two parsed METARs. Each entry is
 * a human sentence describing one change; the list is empty when the two
 * observations are materially identical.
 */
function metarChanges(a: ParsedMetar, b: ParsedMetar): string[] {
	const changes: string[] = [];

	const windA = a.wind;
	const windB = b.wind;
	if (windA !== null && windB !== null) {
		if (windB.speedKt !== windA.speedKt) {
			changes.push(`wind speed ${windA.speedKt}kt -> ${windB.speedKt}kt`);
		}
		const gustA = windA.gustKt ?? 0;
		const gustB = windB.gustKt ?? 0;
		if (gustB !== gustA) {
			changes.push(gustB > 0 ? `gusts appeared (G${gustB}kt)` : 'gusts subsided');
		}
		if ((windA.directionDeg ?? -1) !== (windB.directionDeg ?? -1)) {
			changes.push(
				`wind shifted ${String(windA.directionDeg ?? 0).padStart(3, '0')}deg -> ${String(
					windB.directionDeg ?? 0,
				).padStart(3, '0')}deg`,
			);
		}
	}

	if (a.visibilitySM !== null && b.visibilitySM !== null && a.visibilitySM !== b.visibilitySM) {
		changes.push(`visibility ${a.visibilitySM}SM -> ${b.visibilitySM}SM`);
	}

	const wxA = a.weather.join(' ');
	const wxB = b.weather.join(' ');
	if (wxA !== wxB) {
		if (wxB.length > 0 && wxA.length === 0) changes.push(`${wxB} began`);
		else if (wxB.length === 0 && wxA.length > 0) changes.push(`${wxA} ended`);
		else changes.push(`present weather ${wxA || 'none'} -> ${wxB || 'none'}`);
	}

	const ceilA = lowestCeiling(a);
	const ceilB = lowestCeiling(b);
	if (ceilA !== ceilB) {
		const fa = ceilA === null ? 'no ceiling' : `${ceilA}ft`;
		const fb = ceilB === null ? 'no ceiling' : `${ceilB}ft`;
		changes.push(`ceiling ${fa} -> ${fb}`);
	}

	return changes;
}

// ----------------------------------------------------------------
// Exercise 1: sequence-change
// ----------------------------------------------------------------

/**
 * "Here are three METARs from <station> at T0/T1/T2. What changed between T1
 * and T2?" The correct option is the actual field-delta; distractors are
 * plausible-but-wrong deltas drawn from other transitions in the sequence.
 */
function buildSequenceChangeExercises(
	bundle: TemporalDrillBundle,
	rand: () => number,
	startIndex: number,
): TemporalExercise[] {
	const exercises: TemporalExercise[] = [];
	const byStation = groupMetarsByStation(bundle.metars);
	let index = startIndex;

	for (const [station, seq] of byStation) {
		// Need at least three observations to pose a three-METAR exercise.
		if (seq.length < 3) continue;
		// Pick the RICHEST transition (most field changes) so the exercise
		// lands on the pedagogically interesting moment -- the front passage,
		// not an incidental wind tick.
		let bestI = -1;
		let bestChanges: string[] = [];
		for (let i = 1; i < seq.length - 1; i += 1) {
			const t1 = seq[i];
			const t2 = seq[i + 1];
			if (t1 === undefined || t2 === undefined) continue;
			const changes = metarChanges(parseMetar(t1.raw), parseMetar(t2.raw));
			if (changes.length > bestChanges.length) {
				bestChanges = changes;
				bestI = i;
			}
		}
		if (bestI < 0 || bestChanges.length === 0) continue;

		const t0 = seq[bestI - 1];
		const t1 = seq[bestI];
		const t2 = seq[bestI + 1];
		if (t0 === undefined || t1 === undefined || t2 === undefined) continue;
		const correctText = bestChanges.join('; ');
		const distractors = collectDistractorChanges(seq, bestI, correctText);
		if (distractors.length < 2) continue;

		const options = shuffleOptions(rand, [
			{ text: correctText, correct: true },
			{ text: distractors[0] ?? 'no material change', correct: false },
			{ text: distractors[1] ?? 'no material change', correct: false },
		]);

		exercises.push({
			index,
			kind: 'sequence-change',
			scenarioSlug: bundle.scenarioSlug,
			prompt: `Here are three METARs from ${station} at ${t0.zulu}, ${t1.zulu}, and ${t2.zulu}. What changed between ${t1.zulu} and ${t2.zulu}?`,
			products: [
				{ label: `${station} ${t0.zulu}`, raw: t0.raw },
				{ label: `${station} ${t1.zulu}`, raw: t1.raw },
				{ label: `${station} ${t2.zulu}`, raw: t2.raw },
			],
			options,
			explanation: `Between ${t1.zulu} and ${t2.zulu} at ${station}: ${correctText}. Compare the two observations field by field -- ${describeMetar(parseMetar(t2.raw))}.`,
		});
		index += 1;
	}
	return exercises;
}

/**
 * Gather change-summaries from other transitions in the sequence to serve as
 * distractors. Skips the transition that produced `correctText`.
 */
function collectDistractorChanges(seq: TemporalMetar[], correctI: number, correctText: string): string[] {
	const out: string[] = [];
	for (let i = 1; i < seq.length; i += 1) {
		if (i === correctI + 1) continue;
		const a = seq[i - 1];
		const b = seq[i];
		if (a === undefined || b === undefined) continue;
		const changes = metarChanges(parseMetar(a.raw), parseMetar(b.raw));
		const text = changes.length > 0 ? changes.join('; ') : 'no material change';
		if (text !== correctText && !out.includes(text)) out.push(text);
	}
	// Always have a "nothing changed" distractor available as a fallback.
	if (!out.includes('no material change') && out.length < 2) out.push('no material change');
	return out;
}

/** Group METAR samples by station, preserving timestamp order. */
function groupMetarsByStation(metars: TemporalMetar[]): Map<string, TemporalMetar[]> {
	const byStation = new Map<string, TemporalMetar[]>();
	for (const m of metars) {
		const list = byStation.get(m.station) ?? [];
		list.push(m);
		byStation.set(m.station, list);
	}
	for (const list of byStation.values()) {
		list.sort((x, y) => new Date(x.at).getTime() - new Date(y.at).getTime());
	}
	return byStation;
}

// ----------------------------------------------------------------
// Exercise 2: taf-vs-actuals
// ----------------------------------------------------------------

/**
 * "Here is the <issue> TAF for <station> and the actual <time> METAR. Where
 * did the TAF get it wrong?" The bundle's early TAFs forecast the front at
 * its slower initial speed, so the late METARs diverge -- exactly the
 * pedagogy the v2 plan calls for.
 */
function buildTafVsActualsExercises(
	bundle: TemporalDrillBundle,
	rand: () => number,
	startIndex: number,
): TemporalExercise[] {
	const exercises: TemporalExercise[] = [];
	const byStation = groupMetarsByStation(bundle.metars);
	let index = startIndex;

	for (const taf of bundle.tafs) {
		const seq = byStation.get(taf.station);
		if (seq === undefined || seq.length === 0) continue;
		// Compare against the LAST observation in the window -- the one the
		// early TAF is least likely to have called correctly.
		const actual = seq[seq.length - 1];
		if (actual === undefined) continue;
		// Only pose the exercise when the TAF was issued before the actual.
		if (new Date(taf.issuedAt).getTime() >= new Date(actual.at).getTime()) continue;

		const p = parseMetar(actual.raw);
		const tafCovers = tafForecastSummary(taf.raw);
		const actualSummary = describeMetar(p);

		const correctText = `the actual ${actual.zulu} conditions (${actualSummary}) arrived ahead of what the ${taf.issuedZulu} TAF forecast`;
		const options = shuffleOptions(rand, [
			{ text: correctText, correct: true },
			{ text: 'the TAF nailed it -- the actuals match the forecast period exactly', correct: false },
			{ text: 'the actual conditions were calmer than the TAF predicted', correct: false },
		]);

		exercises.push({
			index,
			kind: 'taf-vs-actuals',
			scenarioSlug: bundle.scenarioSlug,
			prompt: `Here is the ${taf.issuedZulu} TAF for ${taf.station} and the actual ${actual.zulu} METAR. Where did the TAF get it wrong?`,
			products: [
				{ label: `${taf.station} TAF (issued ${taf.issuedZulu})`, raw: taf.raw },
				{ label: `${taf.station} METAR ${actual.zulu}`, raw: actual.raw },
			],
			options,
			explanation: `The ${taf.issuedZulu} TAF forecast ${tafCovers}. The actual ${actual.zulu} observation shows ${actualSummary}. The TAF was issued before the front accelerated, so the real conditions arrived earlier and stronger than the forecast assumed.`,
		});
		index += 1;
	}
	return exercises;
}

/** A one-line summary of a TAF's first forecast period (the issue-time call). */
function tafForecastSummary(raw: string): string {
	// The first body line after the validity group is the prevailing forecast.
	const tokens = raw.split(/\s+/);
	// Drop `TAF`, station, issue group, validity group; keep the rest of the
	// first period up to the first change group (FM/TEMPO/BECMG/PROB).
	const body: string[] = [];
	let seenValidity = false;
	for (const tok of tokens.slice(2)) {
		if (!seenValidity && /^\d{4}\/\d{4}$/.test(tok)) {
			seenValidity = true;
			continue;
		}
		if (!seenValidity) continue;
		if (/^(FM\d{6}|TEMPO|BECMG|PROB\d{2})$/.test(tok)) break;
		body.push(tok);
	}
	return body.length > 0 ? body.join(' ') : 'the prevailing conditions';
}

// ----------------------------------------------------------------
// Exercise 3: front-position
// ----------------------------------------------------------------

/**
 * "<Front kind> moving <bearing>/<speed>. Pick the airport behind the front
 * at <time>." The bundle's front snapshots carry the evolved polyline; the
 * correct answer is the station on the post-frontal side at the target hour.
 */
function buildFrontPositionExercises(
	bundle: TemporalDrillBundle,
	rand: () => number,
	startIndex: number,
): TemporalExercise[] {
	const exercises: TemporalExercise[] = [];
	let index = startIndex;

	// Use a late snapshot so the front has actually swept past some stations.
	const snapshot = bundle.snapshots[bundle.snapshots.length - 2] ?? bundle.snapshots.at(-1);
	if (snapshot === undefined) return exercises;
	const front = snapshot.fronts[0];
	if (front === undefined || front.points.length < 2) return exercises;
	if (bundle.stations.length < 3) return exercises;

	// Classify every station relative to the front at this hour.
	const behind: typeof bundle.stations = [];
	const ahead: typeof bundle.stations = [];
	for (const st of bundle.stations) {
		if (frontSide([st.lon, st.lat], front) === 'behind') behind.push(st);
		else ahead.push(st);
	}
	if (behind.length === 0 || ahead.length < 2) return exercises;

	const correctStation = behind[0];
	if (correctStation === undefined) return exercises;
	const distractors = ahead.slice(0, WX_TEMPORAL_FRONT_POSITION_DISTRACTOR_CAP);

	const options = shuffleOptions(rand, [
		{ text: `${correctStation.icao} (${correctStation.name})`, correct: true },
		...distractors.map((d) => ({ text: `${d.icao} (${d.name})`, correct: false })),
	]);

	exercises.push({
		index,
		kind: 'front-position',
		scenarioSlug: bundle.scenarioSlug,
		prompt: `A ${front.kind} front is sweeping across the route. By ${snapshot.zulu}, which airport is BEHIND the front (in the post-frontal air mass)?`,
		products: [],
		options,
		explanation: `At ${snapshot.zulu} the ${front.kind} front lies along the line from (${fmtPoint(front.points[0])}) to (${fmtPoint(front.points[front.points.length - 1])}). ${correctStation.icao} sits on the post-frontal side -- the front has already passed it. The other airports are still in the pre-frontal air mass.`,
	});
	index += 1;
	return exercises;
}

/** Format a lon/lat point for an explanation string. */
function fmtPoint(p: [number, number] | undefined): string {
	if (p === undefined) return '?, ?';
	return `${p[0].toFixed(1)}, ${p[1].toFixed(1)}`;
}

/**
 * Classify a point as `ahead` (pre-frontal, pip side) or `behind`
 * (post-frontal) relative to a front polyline. Mirrors the cross-product
 * logic in `libs/wx-engine/src/truth/geometry.ts` `sideOfFront`, kept local
 * so this module stays browser-safe (no `@ab/wx-engine` value import).
 */
function frontSide(point: [number, number], front: TemporalFrontSnapshot): 'ahead' | 'behind' {
	let nearestI = 0;
	let nearestD = Number.POSITIVE_INFINITY;
	for (let i = 0; i < front.points.length - 1; i += 1) {
		const a = front.points[i];
		const b = front.points[i + 1];
		if (a === undefined || b === undefined) continue;
		const mx = (a[0] + b[0]) / 2;
		const my = (a[1] + b[1]) / 2;
		const d = (point[0] - mx) ** 2 + (point[1] - my) ** 2;
		if (d < nearestD) {
			nearestD = d;
			nearestI = i;
		}
	}
	const a = front.points[nearestI];
	const b = front.points[nearestI + 1];
	if (a === undefined || b === undefined) return 'ahead';
	const segDx = b[0] - a[0];
	const segDy = b[1] - a[1];
	const cross = segDx * (point[1] - a[1]) - segDy * (point[0] - a[0]);
	// pipSide vector points toward the warm (pre-frontal) sector.
	const pip = pipVector(front.pipSide);
	const perpX = -segDy;
	const perpY = segDx;
	const pipIsLeft = perpX * pip[0] + perpY * pip[1] >= 0;
	const pointIsLeft = cross >= 0;
	// Same side as the pip => pre-frontal (ahead); opposite => post-frontal.
	return pipIsLeft === pointIsLeft ? 'ahead' : 'behind';
}

/** Unit-ish vector for a cardinal pip side. */
function pipVector(side: 'N' | 'S' | 'E' | 'W'): [number, number] {
	switch (side) {
		case 'N':
			return [0, 1];
		case 'S':
			return [0, -1];
		case 'E':
			return [1, 0];
		case 'W':
			return [-1, 0];
	}
}

// ----------------------------------------------------------------
// Pack assembly
// ----------------------------------------------------------------

/** Options for `buildTemporalPack`. */
export interface BuildTemporalPackInput {
	bundles: TemporalDrillBundle[];
	seed: number;
	/** Cap on the number of exercises. When omitted, all generated are kept. */
	count?: number;
}

/**
 * Assemble a temporal drill pack: run all three generators over every
 * bundle, then ROUND-ROBIN across the three kinds so a `--count` trim keeps
 * every exercise kind represented (a naive concat would let the larger
 * `taf-vs-actuals` set crowd out `front-position` entirely). Deterministic
 * for a fixed `(bundles, seed)`.
 */
export function buildTemporalPack(input: BuildTemporalPackInput): TemporalDrillPack {
	const rand = mulberry32(input.seed);
	const sequenceChange: TemporalExercise[] = [];
	const tafVsActuals: TemporalExercise[] = [];
	const frontPosition: TemporalExercise[] = [];

	for (const bundle of input.bundles) {
		sequenceChange.push(...buildSequenceChangeExercises(bundle, rand, 0));
		tafVsActuals.push(...buildTafVsActualsExercises(bundle, rand, 0));
		frontPosition.push(...buildFrontPositionExercises(bundle, rand, 0));
	}

	// Round-robin: one from each kind per cycle until all three are drained.
	const buckets = [sequenceChange, tafVsActuals, frontPosition];
	const interleaved: TemporalExercise[] = [];
	let drained = false;
	while (!drained) {
		drained = true;
		for (const bucket of buckets) {
			const next = bucket.shift();
			if (next !== undefined) {
				interleaved.push(next);
				drained = false;
			}
		}
	}

	const trimmed = input.count !== undefined ? interleaved.slice(0, input.count) : interleaved;
	// Re-index so the displayed numbering is contiguous after the trim.
	const exercises = trimmed.map((ex, i) => ({ ...ex, index: i }));

	return {
		generatedAt: new Date().toISOString(),
		seed: input.seed,
		scenarioSlugs: input.bundles.map((b) => b.scenarioSlug),
		exercises,
	};
}

/** Render a temporal drill pack to markdown for the CLI's `.md` output. */
export function renderTemporalDrillMarkdown(pack: TemporalDrillPack): string {
	const lines: string[] = [];
	lines.push('# Temporal weather drill');
	lines.push('');
	lines.push(`Generated ${pack.generatedAt} from scenarios=${pack.scenarioSlugs.join(',')}, seed=${pack.seed}.`);
	lines.push('');
	lines.push(`${pack.exercises.length} sequence-based exercises.`);
	lines.push('');

	for (const ex of pack.exercises) {
		lines.push(`## Exercise ${ex.index + 1} -- ${ex.kind}`);
		lines.push('');
		lines.push(ex.prompt);
		lines.push('');
		for (const product of ex.products) {
			lines.push(`**${product.label}**`);
			lines.push('');
			lines.push('```text');
			lines.push(product.raw);
			lines.push('```');
			lines.push('');
		}
		lines.push('Options:');
		lines.push('');
		for (const opt of ex.options) {
			lines.push(`- ${opt.correct ? '[x]' : '[ ]'} ${opt.text}`);
		}
		lines.push('');
		lines.push(`**Explanation:** ${ex.explanation}`);
		lines.push('');
	}
	return lines.join('\n');
}
