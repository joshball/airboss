/**
 * Zod runtime guards for `hangar.sync_log.rev_snapshot`.
 *
 * Read-side returns null on mismatch (safe degradation).
 * Write-side throws ZodError (fail loud).
 * Both pass null/undefined through unchanged.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { assertRevSnapshot, parseRevSnapshot, RevSnapshotSchema } from './schema-types';

describe('parseRevSnapshot', () => {
	it('accepts a well-formed snapshot', () => {
		const snap = { references: { 'ref-a': 1, 'ref-b': 5 }, sources: { 'src-a': 2 } };
		expect(parseRevSnapshot(snap)).toEqual(snap);
	});

	it('accepts empty maps', () => {
		expect(parseRevSnapshot({ references: {}, sources: {} })).toEqual({ references: {}, sources: {} });
	});

	it('returns null for null', () => {
		expect(parseRevSnapshot(null)).toBeNull();
	});

	it('returns null for undefined', () => {
		expect(parseRevSnapshot(undefined)).toBeNull();
	});

	it('returns null when a rev value is not a number', () => {
		expect(parseRevSnapshot({ references: { a: 'one' }, sources: {} })).toBeNull();
	});

	it('returns null when a rev value is negative', () => {
		expect(parseRevSnapshot({ references: { a: -1 }, sources: {} })).toBeNull();
	});

	it('returns null when a rev value is fractional', () => {
		expect(parseRevSnapshot({ references: { a: 1.5 }, sources: {} })).toBeNull();
	});

	it('returns null when an extra unknown top-level key is present (strict mode)', () => {
		expect(parseRevSnapshot({ references: {}, sources: {}, extra: {} })).toBeNull();
	});

	it('returns null when a top-level key is missing', () => {
		expect(parseRevSnapshot({ references: {} })).toBeNull();
	});

	it('returns null when the value is a primitive', () => {
		expect(parseRevSnapshot('not-an-object')).toBeNull();
		expect(parseRevSnapshot(42)).toBeNull();
		expect(parseRevSnapshot(true)).toBeNull();
	});
});

describe('assertRevSnapshot', () => {
	it('returns the parsed object on a well-formed input', () => {
		const snap = { references: { 'ref-a': 3 }, sources: { 'src-z': 0 } };
		expect(assertRevSnapshot(snap)).toEqual(snap);
	});

	it('returns null for null / undefined (no snapshot to persist)', () => {
		expect(assertRevSnapshot(null)).toBeNull();
		expect(assertRevSnapshot(undefined)).toBeNull();
	});

	it('throws ZodError on malformed shape', () => {
		expect(() => assertRevSnapshot({ references: { a: 'oops' }, sources: {} })).toThrow(z.ZodError);
	});

	it('throws ZodError on extra top-level key (strict)', () => {
		expect(() => assertRevSnapshot({ references: {}, sources: {}, extra: 1 })).toThrow(z.ZodError);
	});

	it('throws ZodError on negative rev', () => {
		expect(() => assertRevSnapshot({ references: { a: -2 }, sources: {} })).toThrow(z.ZodError);
	});
});

describe('RevSnapshotSchema (direct)', () => {
	it('exposes a Zod schema with safeParse', () => {
		expect(RevSnapshotSchema.safeParse({ references: {}, sources: {} }).success).toBe(true);
		expect(RevSnapshotSchema.safeParse({ references: 'no', sources: {} }).success).toBe(false);
	});
});
