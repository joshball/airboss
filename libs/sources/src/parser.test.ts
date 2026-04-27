import { describe, expect, test } from 'vitest';
import { isParseError, parseIdentifier } from './parser.ts';

describe('parseIdentifier (ADR 019 §1.1 + §1.1.1)', () => {
	test('P-01: canonical path-rootless with single-segment locator + ?at=', () => {
		const result = parseIdentifier('airboss-ref:regs/cfr-14/91/103?at=2026');
		expect(isParseError(result)).toBe(false);
		if (isParseError(result)) return;
		expect(result.corpus).toBe('regs');
		expect(result.locator).toBe('cfr-14/91/103');
		expect(result.pin).toBe('2026');
		expect(result.raw).toBe('airboss-ref:regs/cfr-14/91/103?at=2026');
	});

	test('P-02: multi-segment locator parsed as opaque string; pin populated', () => {
		const result = parseIdentifier('airboss-ref:regs/cfr-14/91/103/b/1/i?at=2026');
		expect(isParseError(result)).toBe(false);
		if (isParseError(result)) return;
		expect(result.corpus).toBe('regs');
		expect(result.locator).toBe('cfr-14/91/103/b/1/i');
		expect(result.pin).toBe('2026');
	});

	test('P-03: slug-encoded edition (no ?at=) -- pin is null; row 1 decides', () => {
		const result = parseIdentifier('airboss-ref:ac/61-65/j');
		expect(isParseError(result)).toBe(false);
		if (isParseError(result)) return;
		expect(result.corpus).toBe('ac');
		expect(result.locator).toBe('61-65/j');
		expect(result.pin).toBe(null);
	});

	test('P-04: path-absolute is rejected with specific message', () => {
		const result = parseIdentifier('airboss-ref:/regs/cfr-14/91/103?at=2026');
		expect(isParseError(result)).toBe(true);
		if (!isParseError(result)) return;
		expect(result.kind).toBe('path-absolute');
		expect(result.message).toMatch(/path-absolute/);
	});

	test('P-05: authority-based is rejected with specific message', () => {
		const result = parseIdentifier('airboss-ref://regs/cfr-14/91/103?at=2026');
		expect(isParseError(result)).toBe(true);
		if (!isParseError(result)) return;
		expect(result.kind).toBe('authority-based');
		expect(result.message).toMatch(/authority-based/);
	});

	test('P-06: leading + trailing whitespace is trimmed before parsing', () => {
		const result = parseIdentifier('  airboss-ref:regs/cfr-14/91/103?at=2026  ');
		expect(isParseError(result)).toBe(false);
		if (isParseError(result)) return;
		expect(result.corpus).toBe('regs');
		expect(result.locator).toBe('cfr-14/91/103');
		expect(result.pin).toBe('2026');
	});

	test('P-07: unknown: magic prefix is recognised by the parser', () => {
		const result = parseIdentifier('airboss-ref:unknown/cost-sharing-letter');
		expect(isParseError(result)).toBe(false);
		if (isParseError(result)) return;
		expect(result.corpus).toBe('unknown');
		expect(result.locator).toBe('cost-sharing-letter');
		expect(result.pin).toBe(null);
	});

	test('P-08: bare scheme with no corpus or locator is rejected', () => {
		const result = parseIdentifier('airboss-ref:');
		expect(isParseError(result)).toBe(true);
		if (!isParseError(result)) return;
		expect(result.kind).toBe('empty-corpus');
	});

	test('P-09: corpus only with empty locator is rejected', () => {
		const result = parseIdentifier('airboss-ref:regs/');
		expect(isParseError(result)).toBe(true);
		if (!isParseError(result)) return;
		expect(result.kind).toBe('empty-locator');
	});

	test('P-09b: no slash at all (corpus without locator)', () => {
		const result = parseIdentifier('airboss-ref:regs');
		expect(isParseError(result)).toBe(true);
		if (!isParseError(result)) return;
		expect(result.kind).toBe('empty-locator');
	});

	test('P-10: ?at=unpinned parses with pin === "unpinned"', () => {
		const result = parseIdentifier('airboss-ref:regs/cfr-14/91/103?at=unpinned');
		expect(isParseError(result)).toBe(false);
		if (isParseError(result)) return;
		expect(result.pin).toBe('unpinned');
	});

	test('P-11: non-airboss-ref URL is rejected', () => {
		const result = parseIdentifier('https://www.ecfr.gov/current/title-14/section-91.103');
		expect(isParseError(result)).toBe(true);
		if (!isParseError(result)) return;
		expect(result.kind).toBe('not-airboss-ref');
	});

	test('P-12: pin with year-month edition format', () => {
		const result = parseIdentifier('airboss-ref:aim/5-1-7?at=2026-09');
		expect(isParseError(result)).toBe(false);
		if (isParseError(result)) return;
		expect(result.pin).toBe('2026-09');
	});

	test('P-13: pin with date-precision edition format', () => {
		const result = parseIdentifier('airboss-ref:plates/KAPA/ils-rwy-35R?at=2026-09-15');
		expect(isParseError(result)).toBe(false);
		if (isParseError(result)) return;
		expect(result.pin).toBe('2026-09-15');
	});

	test('P-14: percent-encoded pin value is decoded', () => {
		const result = parseIdentifier('airboss-ref:regs/cfr-14/91/103?at=2026%2D09');
		expect(isParseError(result)).toBe(false);
		if (isParseError(result)) return;
		expect(result.pin).toBe('2026-09');
	});

	test('P-15: ?at= with empty value is malformed', () => {
		const result = parseIdentifier('airboss-ref:regs/cfr-14/91/103?at=');
		expect(isParseError(result)).toBe(true);
		if (!isParseError(result)) return;
		expect(result.kind).toBe('malformed-query');
	});

	test('P-16: query with extra params is tolerated; only `at` is read', () => {
		const result = parseIdentifier('airboss-ref:regs/cfr-14/91/103?at=2026&note=informal');
		expect(isParseError(result)).toBe(false);
		if (isParseError(result)) return;
		expect(result.pin).toBe('2026');
	});

	test('P-17: NTSB-style locator (no dotted hierarchy)', () => {
		const result = parseIdentifier('airboss-ref:ntsb/WPR23LA123/probable-cause');
		expect(isParseError(result)).toBe(false);
		if (isParseError(result)) return;
		expect(result.corpus).toBe('ntsb');
		expect(result.locator).toBe('WPR23LA123/probable-cause');
	});

	test('P-18: empty string is rejected as not-airboss-ref', () => {
		const result = parseIdentifier('');
		expect(isParseError(result)).toBe(true);
		if (!isParseError(result)) return;
		expect(result.kind).toBe('not-airboss-ref');
	});

	test('P-19: a string that is whitespace-only is rejected', () => {
		const result = parseIdentifier('   ');
		expect(isParseError(result)).toBe(true);
		if (!isParseError(result)) return;
		expect(result.kind).toBe('not-airboss-ref');
	});
});
