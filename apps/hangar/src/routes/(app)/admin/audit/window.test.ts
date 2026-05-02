/**
 * Unit coverage for {@link resolveAuditWindow}: the loader's URL-param
 * decoder. Verifies the resolution rule from the spec design.md:
 *
 *   1. Custom: any from/to value -> custom range, no preset.
 *   2. Preset: window= maps to a rolling lookback from `now`.
 *   3. Default: empty params -> 24h.
 */

import { AUDIT_OP_VALUES, AUDIT_OPS } from '@ab/audit';
import { AUDIT_TARGET_VALUES, AUDIT_TARGETS, AUDIT_WINDOW_DEFAULT, AUDIT_WINDOWS, QUERY_PARAMS } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { decodeAuditFilters, pickAllowedValue, resolveAuditWindow } from './filters';

const NOW = new Date('2026-04-30T12:00:00.000Z');

const HOUR_MS = 60 * 60 * 1000;

describe('resolveAuditWindow', () => {
	it('applies the default 24h window for an empty URL', () => {
		const r = resolveAuditWindow(new URLSearchParams(), NOW);
		expect(r.window).toBe(AUDIT_WINDOW_DEFAULT);
		expect(r.from).toBeDefined();
		expect(r.to).toBeUndefined();
		expect(r.from?.getTime()).toBe(NOW.getTime() - 24 * HOUR_MS);
	});

	it('honours each preset', () => {
		const cases: { preset: string; expectMs: number }[] = [
			{ preset: AUDIT_WINDOWS.HOUR_1, expectMs: HOUR_MS },
			{ preset: AUDIT_WINDOWS.HOUR_24, expectMs: 24 * HOUR_MS },
			{ preset: AUDIT_WINDOWS.DAY_7, expectMs: 7 * 24 * HOUR_MS },
			{ preset: AUDIT_WINDOWS.DAY_30, expectMs: 30 * 24 * HOUR_MS },
		];
		for (const { preset, expectMs } of cases) {
			const params = new URLSearchParams();
			params.set(QUERY_PARAMS.AUDIT_WINDOW, preset);
			const r = resolveAuditWindow(params, NOW);
			expect(r.window).toBe(preset);
			expect(r.from?.getTime()).toBe(NOW.getTime() - expectMs);
			expect(r.to).toBeUndefined();
		}
	});

	it('drops the time bound for window=all', () => {
		const params = new URLSearchParams();
		params.set(QUERY_PARAMS.AUDIT_WINDOW, AUDIT_WINDOWS.ALL);
		const r = resolveAuditWindow(params, NOW);
		expect(r.window).toBe(AUDIT_WINDOWS.ALL);
		expect(r.from).toBeUndefined();
		expect(r.to).toBeUndefined();
	});

	it('treats from / to as custom regardless of window param', () => {
		const params = new URLSearchParams();
		params.set(QUERY_PARAMS.AUDIT_WINDOW, AUDIT_WINDOWS.HOUR_24);
		params.set(QUERY_PARAMS.AUDIT_FROM, '2026-04-01T00:00:00.000Z');
		params.set(QUERY_PARAMS.AUDIT_TO, '2026-04-30T00:00:00.000Z');
		const r = resolveAuditWindow(params, NOW);
		expect(r.window).toBe(AUDIT_WINDOWS.CUSTOM);
		expect(r.from?.toISOString()).toBe('2026-04-01T00:00:00.000Z');
		expect(r.to?.toISOString()).toBe('2026-04-30T00:00:00.000Z');
	});

	it('falls back to default when window=custom but no from/to supplied', () => {
		const params = new URLSearchParams();
		params.set(QUERY_PARAMS.AUDIT_WINDOW, AUDIT_WINDOWS.CUSTOM);
		const r = resolveAuditWindow(params, NOW);
		expect(r.window).toBe(AUDIT_WINDOW_DEFAULT);
		expect(r.from?.getTime()).toBe(NOW.getTime() - 24 * HOUR_MS);
	});

	it('ignores an unknown window value and falls back to default', () => {
		const params = new URLSearchParams();
		params.set(QUERY_PARAMS.AUDIT_WINDOW, 'fortnight');
		const r = resolveAuditWindow(params, NOW);
		expect(r.window).toBe(AUDIT_WINDOW_DEFAULT);
		expect(r.from?.getTime()).toBe(NOW.getTime() - 24 * HOUR_MS);
	});

	it('ignores an unparseable from/to and falls back to default', () => {
		const params = new URLSearchParams();
		params.set(QUERY_PARAMS.AUDIT_FROM, 'not-a-date');
		const r = resolveAuditWindow(params, NOW);
		expect(r.window).toBe(AUDIT_WINDOW_DEFAULT);
		expect(r.from?.getTime()).toBe(NOW.getTime() - 24 * HOUR_MS);
	});
});

describe('pickAllowedValue', () => {
	it('returns undefined for null / empty', () => {
		expect(pickAllowedValue(null, AUDIT_OP_VALUES)).toBeUndefined();
		expect(pickAllowedValue('', AUDIT_OP_VALUES)).toBeUndefined();
	});

	it('returns undefined for an unrecognised value', () => {
		expect(pickAllowedValue('verb', AUDIT_OP_VALUES)).toBeUndefined();
	});

	it('returns the value when it is in the allow-list', () => {
		expect(pickAllowedValue(AUDIT_OPS.CREATE, AUDIT_OP_VALUES)).toBe(AUDIT_OPS.CREATE);
		expect(pickAllowedValue(AUDIT_TARGETS.HANGAR_REFERENCE, AUDIT_TARGET_VALUES)).toBe(AUDIT_TARGETS.HANGAR_REFERENCE);
	});
});

describe('decodeAuditFilters', () => {
	it('returns all-undefined filters + default window for an empty URL', () => {
		const decoded = decodeAuditFilters(new URLSearchParams(), NOW);
		expect(decoded.actorId).toBeUndefined();
		expect(decoded.targetType).toBeUndefined();
		expect(decoded.targetId).toBeUndefined();
		expect(decoded.op).toBeUndefined();
		expect(decoded.cursor).toBeUndefined();
		expect(decoded.resolvedWindow.window).toBe(AUDIT_WINDOW_DEFAULT);
	});

	it('decodes a fully populated URL', () => {
		const params = new URLSearchParams();
		params.set(QUERY_PARAMS.AUDIT_ACTOR, 'usr_abby');
		params.set(QUERY_PARAMS.AUDIT_TARGET_TYPE, AUDIT_TARGETS.HANGAR_REFERENCE);
		params.set(QUERY_PARAMS.AUDIT_TARGET_ID, 'src_x');
		params.set(QUERY_PARAMS.AUDIT_OP, AUDIT_OPS.UPDATE);
		params.set(QUERY_PARAMS.AUDIT_WINDOW, AUDIT_WINDOWS.DAY_7);
		params.set(QUERY_PARAMS.AUDIT_CURSOR, '2026-04-30T00:00:00Z::aud_x');

		const decoded = decodeAuditFilters(params, NOW);
		expect(decoded.actorId).toBe('usr_abby');
		expect(decoded.targetType).toBe(AUDIT_TARGETS.HANGAR_REFERENCE);
		expect(decoded.targetId).toBe('src_x');
		expect(decoded.op).toBe(AUDIT_OPS.UPDATE);
		expect(decoded.cursor).toBe('2026-04-30T00:00:00Z::aud_x');
		expect(decoded.resolvedWindow.window).toBe(AUDIT_WINDOWS.DAY_7);
	});

	it('drops invalid op / target-type values silently', () => {
		const params = new URLSearchParams();
		params.set(QUERY_PARAMS.AUDIT_OP, 'verb');
		params.set(QUERY_PARAMS.AUDIT_TARGET_TYPE, 'study.fake');
		const decoded = decodeAuditFilters(params, NOW);
		expect(decoded.op).toBeUndefined();
		expect(decoded.targetType).toBeUndefined();
	});
});
