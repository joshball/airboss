/**
 * Time / calendar helpers shared across BCs.
 *
 * "Local midnight" is the pivot every day-boundary aggregation needs:
 * streaks, attemptedToday, per-day memory-item counters. The math here
 * survives DST transitions (an hour gains or loses on that day, but the
 * pivot still reads as 00:00 on the learner's calendar).
 */

import { DEFAULT_USER_TIMEZONE } from '@ab/constants';

// Re-export the canonical MS_PER_* constants from @ab/constants so existing
// `@ab/utils` consumers keep working but the single source of truth lives
// with the rest of the constants. New callers should import directly from
// @ab/constants.
export { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE, MS_PER_SECOND } from '@ab/constants';

/**
 * UTC instant representing midnight at the start of the local day in `tz`
 * that contains `d`. For a user in America/Denver, `userStartOfDay(now)`
 * returns the UTC timestamp that reads as 00:00 on that learner's calendar.
 *
 * Approach: format `d` in the target timezone twice -- once as an ISO date
 * (`YYYY-MM-DD`) and once as `YYYY-MM-DD HH:mm:ss`. The difference between
 * the second reading parsed as UTC and the original UTC instant is the
 * timezone offset. Subtracting that offset from local-midnight-parsed-as-UTC
 * yields the true UTC instant of local midnight. Survives DST transitions.
 *
 * @param d -- the instant whose local calendar day we want
 * @param tz -- IANA timezone; defaults to the platform default
 */
export function userStartOfDay(d: Date, tz: string = DEFAULT_USER_TIMEZONE): Date {
	const localDate = d.toLocaleDateString('en-CA', { timeZone: tz });
	const localClock = d.toLocaleString('sv-SE', { timeZone: tz });
	const localClockAsUtc = new Date(`${localClock.replace(' ', 'T')}Z`);
	const offsetMs = localClockAsUtc.getTime() - d.getTime();
	const midnightAsUtc = new Date(`${localDate}T00:00:00Z`);
	return new Date(midnightAsUtc.getTime() - offsetMs);
}
