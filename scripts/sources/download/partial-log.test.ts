/**
 * Tests for the partial-download recovery log.
 *
 * The log is the operator-facing artifact when one chapter PDF in a multi-step
 * handbook ingest fails mid-run. The 2am-debug test: re-run picks up failures,
 * surface counts, no resume mystery.
 */

import { appendFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	appendPartialDownload,
	clearPartialDownloads,
	dropPartialDownloads,
	PARTIAL_LOG_FILENAME,
	partialLogPath,
	planIdKey,
	readPartialDownloads,
} from './partial-log';
import type { DownloadPlan } from './plans';

function makePlan(overrides: Partial<DownloadPlan> = {}): DownloadPlan {
	return {
		corpus: 'handbooks',
		doc: 'phak',
		edition: 'FAA-H-8083-25C',
		url: 'https://example.test/phak-ch07.pdf',
		destPath: '/tmp/phak/FAA-H-8083-25C/FAA-H-8083-25C-ch07.pdf',
		extension: 'pdf',
		kind: 'chapter-pdf',
		ordinal: 7,
		section: null,
		ancillaryKind: null,
		chapterPageUrl: 'https://example.test/phak/chapter-7-aircraft-systems',
		...overrides,
	} as DownloadPlan;
}

describe('partial-download log', () => {
	let cacheRoot: string;

	beforeEach(() => {
		cacheRoot = mkdtempSync(join(tmpdir(), 'partial-log-test-'));
	});

	afterEach(() => {
		rmSync(cacheRoot, { recursive: true, force: true });
	});

	it('returns empty when no log exists yet', () => {
		expect(readPartialDownloads(cacheRoot)).toEqual([]);
	});

	it('appends one record per failure with the captured plan + error', () => {
		const plan = makePlan();
		appendPartialDownload(cacheRoot, plan, new Error('HTTP 404'));
		const records = readPartialDownloads(cacheRoot);
		expect(records).toHaveLength(1);
		expect(records[0]?.corpus).toBe('handbooks');
		expect(records[0]?.doc).toBe('phak');
		expect(records[0]?.kind).toBe('chapter-pdf');
		expect(records[0]?.ordinal).toBe(7);
		expect(records[0]?.url).toBe('https://example.test/phak-ch07.pdf');
		expect(records[0]?.error).toContain('HTTP 404');
		expect(records[0]?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});

	it('appends multiple records across calls without overwriting', () => {
		appendPartialDownload(cacheRoot, makePlan({ ordinal: 7 }), new Error('A'));
		appendPartialDownload(cacheRoot, makePlan({ ordinal: 8 }), new Error('B'));
		appendPartialDownload(cacheRoot, makePlan({ ordinal: 9 }), new Error('C'));
		const records = readPartialDownloads(cacheRoot);
		expect(records).toHaveLength(3);
		expect(records.map((r) => r.ordinal)).toEqual([7, 8, 9]);
	});

	it('writes to the canonical filename `.partial-download.log`', () => {
		appendPartialDownload(cacheRoot, makePlan(), new Error('boom'));
		expect(partialLogPath(cacheRoot)).toBe(join(cacheRoot, PARTIAL_LOG_FILENAME));
		expect(existsSync(partialLogPath(cacheRoot))).toBe(true);
	});

	it('clearPartialDownloads removes the log file', () => {
		appendPartialDownload(cacheRoot, makePlan(), new Error('boom'));
		expect(readPartialDownloads(cacheRoot)).toHaveLength(1);
		clearPartialDownloads(cacheRoot);
		expect(readPartialDownloads(cacheRoot)).toHaveLength(0);
		expect(existsSync(partialLogPath(cacheRoot))).toBe(false);
	});

	it('clearPartialDownloads is a no-op when the file does not exist', () => {
		expect(() => clearPartialDownloads(cacheRoot)).not.toThrow();
	});

	it('tolerates a corrupt trailing line without throwing', () => {
		appendPartialDownload(cacheRoot, makePlan({ ordinal: 1 }), new Error('A'));
		// Simulate a killed write: append a partial JSON line
		const path = partialLogPath(cacheRoot);
		appendFileSync(path, '{"corpus":"hand', 'utf-8');
		const records = readPartialDownloads(cacheRoot);
		expect(records).toHaveLength(1);
		expect(records[0]?.ordinal).toBe(1);
	});

	it('dropPartialDownloads removes only matching plan-id keys', () => {
		appendPartialDownload(cacheRoot, makePlan({ ordinal: 7 }), new Error('phak ch7'));
		appendPartialDownload(cacheRoot, makePlan({ ordinal: 8 }), new Error('phak ch8'));
		appendPartialDownload(cacheRoot, makePlan({ doc: 'afh', ordinal: 3 }), new Error('afh ch3'));
		const keepPhakCh7Only = new Set([
			planIdKey({ corpus: 'handbooks', doc: 'phak', kind: 'chapter-pdf', ordinal: 8 }),
			planIdKey({ corpus: 'handbooks', doc: 'afh', kind: 'chapter-pdf', ordinal: 3 }),
		]);
		dropPartialDownloads(cacheRoot, keepPhakCh7Only);
		const remaining = readPartialDownloads(cacheRoot);
		expect(remaining).toHaveLength(1);
		expect(remaining[0]?.doc).toBe('phak');
		expect(remaining[0]?.ordinal).toBe(7);
	});

	it('dropPartialDownloads removes the file when every record matches', () => {
		appendPartialDownload(cacheRoot, makePlan({ ordinal: 7 }), new Error('A'));
		dropPartialDownloads(
			cacheRoot,
			new Set([planIdKey({ corpus: 'handbooks', doc: 'phak', kind: 'chapter-pdf', ordinal: 7 })]),
		);
		expect(readPartialDownloads(cacheRoot)).toHaveLength(0);
		expect(existsSync(partialLogPath(cacheRoot))).toBe(false);
	});

	it('dropPartialDownloads is a no-op when the file does not exist', () => {
		expect(() => dropPartialDownloads(cacheRoot, new Set())).not.toThrow();
	});

	it('planIdKey is stable across record + plan shapes', () => {
		const planKey = planIdKey({ corpus: 'handbooks', doc: 'phak', kind: 'chapter-pdf', ordinal: 7 });
		appendPartialDownload(cacheRoot, makePlan({ ordinal: 7 }), new Error('boom'));
		const records = readPartialDownloads(cacheRoot);
		expect(records).toHaveLength(1);
		const recordKey = records[0] !== undefined ? planIdKey(records[0]) : '';
		expect(recordKey).toBe(planKey);
	});
});
