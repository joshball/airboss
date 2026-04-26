/**
 * Formatters for the sim history dashboard. Pure functions; tested in
 * `format.test.ts`. Lifted out of the page so the runes file stays
 * presentational and the math is reviewable in isolation.
 */

import { SIM_SCENARIO_OUTCOMES, type SimScenarioOutcome } from '@ab/constants';
import type { Tone } from '@ab/themes';

/** Human-friendly outcome label for the dashboard cell. */
export function formatOutcomeLabel(outcome: string): string {
	switch (outcome) {
		case SIM_SCENARIO_OUTCOMES.SUCCESS:
			return 'Pass';
		case SIM_SCENARIO_OUTCOMES.FAILURE:
			return 'Fail';
		case SIM_SCENARIO_OUTCOMES.ABORTED:
			return 'Aborted';
		case SIM_SCENARIO_OUTCOMES.RUNNING:
			return 'In progress';
		default:
			return outcome;
	}
}

/**
 * Status tone for an outcome -- maps to the shared `Tone` vocabulary
 * (`@ab/themes/tones`) so the dashboard's outcome chip uses the same
 * wash/edge tokens as every other status indicator in the app.
 */
export function outcomeTone(outcome: string): Tone {
	switch (outcome) {
		case SIM_SCENARIO_OUTCOMES.SUCCESS:
			return 'success';
		case SIM_SCENARIO_OUTCOMES.FAILURE:
			return 'danger';
		case SIM_SCENARIO_OUTCOMES.ABORTED:
			return 'warning';
		default:
			return 'default';
	}
}

/** Narrow a stored text outcome to the typed enum. Falls back when unknown. */
export function asScenarioOutcome(value: string): SimScenarioOutcome | null {
	const matches = (Object.values(SIM_SCENARIO_OUTCOMES) as readonly string[]).includes(value);
	return matches ? (value as SimScenarioOutcome) : null;
}

/**
 * Render a `0..1` grade as a whole-number percentage with the `%` suffix,
 * or an em-dash when the grade is missing (scenario declared no grading
 * block, or evaluator failed). Clamps to `[0, 100]` so a stray
 * out-of-range value never paints "120%".
 */
export function formatGradePercent(total: number | null | undefined): string {
	if (total === null || total === undefined || Number.isNaN(total)) return '-';
	const clamped = Math.max(0, Math.min(1, total));
	return `${Math.round(clamped * 100)}%`;
}

/**
 * Format elapsed seconds as `m:ss`. Negative values clamp to zero so a
 * float-precision tick at the start of a run can't paint `-1:59`.
 */
export function formatElapsed(seconds: number): string {
	const safe = Math.max(0, Math.floor(seconds));
	const minutes = Math.floor(safe / 60);
	const secs = safe % 60;
	return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

const RELATIVE_THRESHOLDS_SECONDS = [
	{ unit: 'second', limit: 60, divisor: 1 },
	{ unit: 'minute', limit: 60 * 60, divisor: 60 },
	{ unit: 'hour', limit: 60 * 60 * 24, divisor: 60 * 60 },
	{ unit: 'day', limit: 60 * 60 * 24 * 30, divisor: 60 * 60 * 24 },
	{ unit: 'month', limit: 60 * 60 * 24 * 365, divisor: 60 * 60 * 24 * 30 },
] as const;

/**
 * Format a past timestamp as a coarse relative string ("3 minutes ago").
 * Designed for a list of recent attempts; for older rows the absolute
 * date (via `formatAbsoluteDate`) reads better in a debrief context.
 */
export function formatRelativeTime(when: Date, now: Date = new Date()): string {
	const diffSeconds = Math.max(0, Math.floor((now.getTime() - when.getTime()) / 1000));
	if (diffSeconds < 5) return 'just now';
	for (const tier of RELATIVE_THRESHOLDS_SECONDS) {
		if (diffSeconds < tier.limit) {
			const value = Math.max(1, Math.floor(diffSeconds / tier.divisor));
			return `${value} ${tier.unit}${value === 1 ? '' : 's'} ago`;
		}
	}
	const years = Math.max(1, Math.floor(diffSeconds / (60 * 60 * 24 * 365)));
	return `${years} year${years === 1 ? '' : 's'} ago`;
}

const GRADING_KIND_LABELS: Record<string, string> = {
	altitude_hold: 'Altitude hold',
	heading_hold: 'Heading hold',
	airspeed_hold: 'Airspeed hold',
	stall_margin: 'Stall margin',
	reaction_time: 'Reaction time',
	ideal_path_match: 'Ideal path match',
};

/**
 * Human-readable label for a `GradingComponentKind`. Unknown kinds (older
 * rows from a since-renamed evaluator) render as a sentence-cased token
 * rather than the raw snake_case identifier.
 */
export function formatGradingKind(kind: string): string {
	const known = GRADING_KIND_LABELS[kind];
	if (known) return known;
	return kind.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

/** Compact absolute-date string ("Apr 26, 14:03") used in tooltips/details. */
export function formatAbsoluteDate(when: Date): string {
	const date = when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	const time = when.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
	return `${date}, ${time}`;
}
