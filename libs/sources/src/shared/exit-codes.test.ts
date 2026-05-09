import { describe, expect, test } from 'vitest';
import { classifySkipReasons, INGEST_EXIT_CODES, isSoftSkip } from './exit-codes.ts';

describe('INGEST_EXIT_CODES', () => {
	test('EX-01: 0 OK, 1 HARD_SKIPS, 2 BAD_ARGS, 3 SHA_MISMATCH', () => {
		expect(INGEST_EXIT_CODES.OK).toBe(0);
		expect(INGEST_EXIT_CODES.HARD_SKIPS).toBe(1);
		expect(INGEST_EXIT_CODES.BAD_ARGS).toBe(2);
		expect(INGEST_EXIT_CODES.SHA_MISMATCH).toBe(3);
	});
});

describe('isSoftSkip', () => {
	test('EX-02: AC unrevisioned soft-skip recognised', () => {
		expect(
			isSoftSkip('ac-91-92: edition is null -- unrevisioned ACs are rejected by ADR 019 §1.2 validator (skip)'),
		).toBe(true);
	});

	test('EX-03: ACS slug-filter mismatch is soft', () => {
		expect(isSoftSkip("acs/foo: slug 'bar' not in --slug filter (skip)")).toBe(true);
		expect(isSoftSkip("acs/foo: slug 'bar' not in ACS_PUBLICATION_SLUGS (skip)")).toBe(true);
	});

	test('EX-04: missing per-corpus manifest is soft (operator did not run downloader)', () => {
		expect(isSoftSkip('ac/manifest.json: per-corpus manifest not found (skip)')).toBe(true);
	});

	test('EX-05: extraction errors are HARD skips', () => {
		expect(isSoftSkip('ac/61-65/j: extraction failed -- TypeError: cannot read property')).toBe(false);
		expect(isSoftSkip('acs/ppl-airplane-acs-6c: parsed 0 task blocks -- heading regexes did not match (skip)')).toBe(
			false,
		);
		expect(isSoftSkip('aim/2026-04: ENOENT: file not found')).toBe(false);
	});

	test('EX-06: SHA mismatch is HARD skip', () => {
		expect(isSoftSkip('ac/61-65/j: SHA mismatch at /tmp/foo: manifest claims abc, cached bytes hash to def')).toBe(
			false,
		);
	});
});

describe('classifySkipReasons', () => {
	test('EX-07: splits into soft and hard buckets', () => {
		const result = classifySkipReasons([
			'ac/91-92: unrevisioned ACs are rejected (skip)',
			'ac/61-65/j: extraction failed -- bug',
			'acs/manifest.json: per-corpus manifest not found (skip)',
			'aim/2026-04: parse error',
		]);
		expect(result.soft).toHaveLength(2);
		expect(result.hard).toHaveLength(2);
	});

	test('EX-08: empty input produces empty buckets', () => {
		const result = classifySkipReasons([]);
		expect(result.soft).toEqual([]);
		expect(result.hard).toEqual([]);
	});
});
