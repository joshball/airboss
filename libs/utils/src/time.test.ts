/**
 * Unit tests for userStartOfDay.
 *
 * No DB, no module-level setup -- just the pure function under a handful
 * of fixed instants across timezones and a DST transition in America/Denver.
 */

import { DEFAULT_USER_TIMEZONE } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE, MS_PER_SECOND, userStartOfDay } from './time';

describe('userStartOfDay', () => {
	it('returns the UTC instant that reads as local midnight in the target tz', () => {
		// 2026-04-15 14:30 UTC is 2026-04-15 08:30 America/Denver (MDT, UTC-6).
		// Local midnight for that day is 2026-04-15 00:00 MDT -> 2026-04-15 06:00 UTC.
		const d = new Date('2026-04-15T14:30:00Z');
		const start = userStartOfDay(d, 'America/Denver');
		expect(start.toISOString()).toBe('2026-04-15T06:00:00.000Z');
	});

	it('defaults tz to DEFAULT_USER_TIMEZONE when omitted', () => {
		const d = new Date('2026-04-15T14:30:00Z');
		expect(userStartOfDay(d).toISOString()).toBe(userStartOfDay(d, DEFAULT_USER_TIMEZONE).toISOString());
	});

	it('handles the UTC timezone without offset drift', () => {
		const d = new Date('2026-04-15T14:30:00Z');
		const start = userStartOfDay(d, 'UTC');
		expect(start.toISOString()).toBe('2026-04-15T00:00:00.000Z');
	});

	it('returns a UTC instant that round-trips through Intl as local midnight', () => {
		// Pick a post-spring-forward instant (2026-03-09 is MDT in Denver).
		const d = new Date('2026-03-09T15:00:00Z'); // 09:00 MDT
		const start = userStartOfDay(d, 'America/Denver');
		const asLocal = start.toLocaleString('sv-SE', { timeZone: 'America/Denver' });
		expect(asLocal).toBe('2026-03-09 00:00:00');
	});

	it('returns local midnight for a fixed-offset timezone', () => {
		// America/Phoenix does not observe DST -- MST (UTC-7) year-round.
		const d = new Date('2026-07-15T18:00:00Z'); // 11:00 MST
		const start = userStartOfDay(d, 'America/Phoenix');
		expect(start.toISOString()).toBe('2026-07-15T07:00:00.000Z');
	});
});

describe('time constants', () => {
	it('MS_PER_SECOND is 1000', () => {
		expect(MS_PER_SECOND).toBe(1000);
	});

	it('MS_PER_MINUTE is 60 seconds', () => {
		expect(MS_PER_MINUTE).toBe(60 * MS_PER_SECOND);
	});

	it('MS_PER_HOUR is 60 minutes', () => {
		expect(MS_PER_HOUR).toBe(60 * MS_PER_MINUTE);
	});

	it('MS_PER_DAY is 24 hours', () => {
		expect(MS_PER_DAY).toBe(24 * MS_PER_HOUR);
	});

	it('MS_PER_DAY matches the inline expression it replaces', () => {
		expect(MS_PER_DAY).toBe(24 * 60 * 60 * 1000);
	});
});
