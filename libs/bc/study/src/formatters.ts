/**
 * Display formatters for the review surface.
 *
 * Kept in the BC so the session runner, the review route, and any future
 * admin queue UI share a single source of truth for "next-review interval"
 * copy. Never format dates inline at call sites.
 */

import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE } from '@ab/constants';

/**
 * Format a "next interval" delta (ms in the future) as a short chicklet
 * string: `<10min`, `1h`, `3d`, `2mo`, `1y`.
 *
 * Rules:
 * - Negative / zero -> `now`
 * - Under 10 minutes -> `<10min`
 * - Under 1 hour -> `{n}min` (rounded)
 * - Under 2 days -> `{n}h` (rounded; uses whole hours)
 * - Under 60 days -> `{n}d`
 * - Under 2 years -> `{n}mo`
 * - Otherwise -> `{n}y`
 *
 * Deliberately compact so the rating chicklet stays single-line on narrow
 * viewports. Power users who want the exact date hover the chicklet and see
 * {@link formatNextIntervalAbsolute}.
 */
export function formatNextInterval(deltaMs: number): string {
	if (!Number.isFinite(deltaMs) || deltaMs <= 0) return 'now';
	if (deltaMs < 10 * MS_PER_MINUTE) return '<10min';
	if (deltaMs < MS_PER_HOUR) return `${Math.round(deltaMs / MS_PER_MINUTE)}min`;
	if (deltaMs < 2 * MS_PER_DAY) return `${Math.round(deltaMs / MS_PER_HOUR)}h`;
	if (deltaMs < 60 * MS_PER_DAY) return `${Math.round(deltaMs / MS_PER_DAY)}d`;
	if (deltaMs < 2 * 365 * MS_PER_DAY) return `${Math.round(deltaMs / (30 * MS_PER_DAY))}mo`;
	return `${Math.round(deltaMs / (365 * MS_PER_DAY))}y`;
}

/**
 * Format an absolute due date for the hover tooltip on a rating chicklet.
 * Locale-aware, short-date style (e.g. `Apr 27, 2026, 3:42 PM`). Rendered
 * inside a `title` attribute so the browser's tooltip shows the exact due
 * time without a JS-rendered popover.
 */
export function formatNextIntervalAbsolute(dueAt: Date): string {
	return dueAt.toLocaleString(undefined, {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	});
}
