/**
 * Pure prose helper for the Today panel on `/study`.
 *
 * Consumes only a `TodayBriefing` value object built by the loader; no
 * DB, no fetch, no environment access. Renders a small bag of strings:
 *
 *   { headline, body, cta }
 *
 * Vitest asserts the exact strings against the worked-examples table in
 * `design.md`. Day-count -- the "you've been working on this for N days"
 * clause -- is prepended to focus-state prose when `dayCount` is non-null
 * (per Decision Q6 and SH-3a).
 *
 * Templates are deterministic (no LLM, no randomness). Two reasons:
 *
 *   1. Auditability: an exact-string test is the cheapest way to lock the
 *      voice of the page across reviewers.
 *   2. Latency / cost: SSR-time prose generation should be free.
 */

import { ROUTES } from '@ab/constants';
import type { TodayBriefing, TodayPrimaryCitation, TodayReason } from './today-types';

export interface RenderedToday {
	headline: string;
	body: string;
	cta: { label: string; href: string } | null;
}

/** Public entry point: turn a `TodayBriefing` into rendered text. */
export function renderTodayProse(briefing: TodayBriefing): RenderedToday {
	switch (briefing.kind) {
		case 'no-goal':
			// `+page.svelte` should not call `renderTodayProse` for `no-goal`
			// since the banner replaces the Today panel. Returning empty
			// strings keeps the function total without throwing.
			return { headline: '', body: '', cta: null };
		case 'caught_up':
			return {
				headline: '',
				body: "You're caught up. Pick a topic from the map to dig in.",
				cta: null,
			};
		case 'focus':
			return renderFocus(briefing);
	}
}

interface FocusBriefing extends Extract<TodayBriefing, { kind: 'focus' }> {}

function renderFocus(b: FocusBriefing): RenderedToday {
	const headline = b.leafTitle;
	const dayClause = b.dayCount !== null ? buildDayClause(b.dayCount) : '';
	const primary = b.primaryCitation;

	// Template selection. The order is deliberate (precedence high -> low):
	//
	//   1. `never_attempted` -- if the leaf has zero attempts, percentages are
	//      meaningless; render the "haven't started" prose.
	//   2. `overdue` -- if cards are overdue, that's the call to action.
	//   3. `partial` shape -- triggered by the loader having real per-method
	//      percentages OR an explicit `partial` reason. The dominant
	//      `low_accuracy` reason renders as a sub-clause. This wins over the
	//      bare `low_accuracy` template once we have mixed-coverage data.
	//   4. `low_accuracy` (bare) -- only when no per-method percentage data is
	//      present, so we have nothing better to say.
	const neverAttempted = b.reasons.find((r) => r.kind === 'never_attempted');
	const overdue = b.reasons.find((r) => r.kind === 'overdue');
	const lowAccuracy = b.reasons.find((r) => r.kind === 'low_accuracy');
	const partial = b.reasons.find((r) => r.kind === 'partial');
	// Partial template fires only when there are multiple non-null percentages
	// or scenario shows zero. A single non-null pct (e.g. only recall) plus a
	// bare low_accuracy reason should use the dedicated low_accuracy template
	// so the prose stays focused -- matches design.md example 4.
	const nonNullPctCount =
		(b.methodPercentages.recall !== null ? 1 : 0) +
		(b.methodPercentages.calculation !== null ? 1 : 0) +
		(b.methodPercentages.scenario !== null ? 1 : 0);
	const hasPartialData = nonNullPctCount >= 2;

	let core = '';

	if (neverAttempted !== undefined) {
		core =
			primary !== null ? `You haven't started this yet. ${citationCovers(primary)}` : "You haven't started this yet.";
	} else if (overdue !== undefined && overdue.dueCards !== undefined) {
		core = `${overdue.dueCards} cards due on this. Review them when you have a few minutes.`;
	} else if (partial !== undefined || hasPartialData) {
		core = renderPartial(b);
	} else if (lowAccuracy !== undefined && lowAccuracy.accuracy !== undefined && lowAccuracy.dataPoints !== undefined) {
		const misses = Math.round((1 - lowAccuracy.accuracy) * lowAccuracy.dataPoints);
		const surface = lowAccuracy.method === 'scenario' ? 'in scenarios' : 'on the cards';
		core =
			primary !== null
				? `You miss this ${misses} out of ${lowAccuracy.dataPoints} times ${surface}. Try reviewing ${primary.label}.`
				: `You miss this ${misses} out of ${lowAccuracy.dataPoints} times ${surface}.`;
	} else {
		core = renderPartial(b);
	}

	const body = dayClause === '' ? core : `${dayClause} ${core}`;

	return {
		headline,
		body,
		cta: { label: 'Open this topic', href: ROUTES.KNOWLEDGE_SLUG(b.focusNodeSlug) },
	};
}

function buildDayClause(dayCount: number): string {
	if (dayCount <= 0) return '';
	if (dayCount === 1) return "You've been working on this for 1 day.";
	return `You've been working on this for ${dayCount} days.`;
}

function citationCovers(c: TodayPrimaryCitation): string {
	return `${c.label} covers it.`;
}

/**
 * Partial-coverage prose. Renders percentages for the recall / calculation
 * pills and a "next gap" sub-clause only when one `low_accuracy` reason
 * dominates (single specific-method reason). Per the spec note on the
 * worked-examples table.
 */
function renderPartial(b: FocusBriefing): string {
	const recallPct = methodPct(b, 'recall');
	const calcPct = methodPct(b, 'calculation');
	const scenarioPct = methodPct(b, 'scenario');

	const segments: string[] = [];

	const numericParts: string[] = [];
	if (recallPct !== null) numericParts.push(`${recallPct}% understood`);
	if (calcPct !== null && calcPct > 0) numericParts.push(`${calcPct}% memorized`);

	if (numericParts.length > 0) {
		segments.push(`You're ${numericParts.join(', ')}.`);
	}

	if (scenarioPct === 0 || scenarioPct === null) {
		segments.push('No practice yet.');
		// Tie-break for the "scenario zero, recall mastered" worked example:
		// suggest a scenario when nothing else dominates.
		if (recallPct === 100 && (calcPct === null || calcPct === 0)) {
			segments.push('Try a scenario.');
			return segments.join(' ');
		}
	}

	const dominant = findDominantLowAccuracy(b.reasons);
	if (dominant !== null && dominant.accuracy !== undefined && dominant.dataPoints !== undefined) {
		const misses = Math.round((1 - dominant.accuracy) * dominant.dataPoints);
		const gapLabel = formatGapLabel(b.leafTitle, dominant);
		segments.push(`The next gap is ${gapLabel} -- you miss it ${misses} out of ${dominant.dataPoints} times.`);
	}

	return segments.join(' ');
}

function methodPct(b: FocusBriefing, method: 'recall' | 'calculation' | 'scenario'): number | null {
	return b.methodPercentages[method];
}

/**
 * Returns the single `low_accuracy` reason if (and only if) it's the only
 * specific-method weakness in the list. The worked-examples note: "The
 * 'next gap' sub-clause is omitted unless one pill clearly dominates."
 */
function findDominantLowAccuracy(reasons: readonly TodayReason[]): TodayReason | null {
	const lows = reasons.filter((r) => r.kind === 'low_accuracy' && r.method !== undefined);
	if (lows.length !== 1) return null;
	return lows[0] ?? null;
}

/**
 * Compose the gap-noun phrase. We can't introspect a leaf title for a
 * structural sub-noun without authored metadata, so we simplify the leaf
 * title to its trailing fragment after a `--` separator (matching the
 * worked-examples shape: "Weight & balance -- arm and moment" -> the next
 * gap is "the arm-and-moment formula"). Falls back to the leaf title.
 */
function formatGapLabel(leafTitle: string, reason: TodayReason): string {
	const parts = leafTitle.split('--').map((s) => s.trim());
	const tail = parts.length > 1 ? parts[parts.length - 1] : leafTitle;
	const slug = (tail ?? leafTitle).toLowerCase().replace(/\s+/g, '-');
	const noun = reason.method === 'calculation' ? 'formula' : 'concept';
	return `the ${slug} ${noun}`;
}
