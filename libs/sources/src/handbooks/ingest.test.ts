import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetRegistry } from '../registry/__test_helpers__.ts';
import { getEntryLifecycle } from '../registry/lifecycle.ts';
import { getSources } from '../registry/sources.ts';
import type { SourceId } from '../types.ts';
import { parseCliArgs, runHandbookIngest } from './ingest.ts';

const FIXTURE_ROOT = join(process.cwd(), 'tests/fixtures/handbooks/phak-fixture');

describe('parseCliArgs', () => {
	it('parses valid args', () => {
		const result = parseCliArgs(['--doc=phak', '--edition=8083-25C']);
		if ('error' in result) throw new Error('expected ok');
		expect(result.doc).toBe('phak');
		expect(result.edition).toBe('8083-25C');
	});

	it('parses --out=', () => {
		const result = parseCliArgs(['--doc=phak', '--edition=8083-25C', '--out=/tmp/handbooks']);
		if ('error' in result) throw new Error('expected ok');
		expect(result.derivativeRoot).toBe('/tmp/handbooks');
	});

	it('rejects unknown args', () => {
		const result = parseCliArgs(['--bogus']);
		expect('error' in result).toBe(true);
	});

	it('handles --help', () => {
		const result = parseCliArgs(['--help']);
		if ('error' in result) throw new Error('expected ok');
		expect(result.help).toBe(true);
	});
});

describe('runHandbookIngest', () => {
	beforeEach(() => {
		resetRegistry();
	});
	afterEach(() => {
		resetRegistry();
	});

	it('ingests a handbook from the fixture manifest', async () => {
		const report = await runHandbookIngest({
			doc: 'phak',
			edition: '8083-25C',
			derivativeRoot: FIXTURE_ROOT,
		});
		expect(report.entriesIngested).toBe(4); // 1 chapter + 2 sections + 1 subsection
		expect(report.entriesAlreadyAccepted).toBe(0);
		expect(report.promotionBatchId).not.toBeNull();
		expect(report.doc).toBe('phak');
		expect(report.edition).toBe('8083-25C');
	});

	it('promotes entries to accepted lifecycle', async () => {
		await runHandbookIngest({ doc: 'phak', edition: '8083-25C', derivativeRoot: FIXTURE_ROOT });
		expect(getEntryLifecycle('airboss-ref:handbooks/phak/8083-25C/1' as SourceId)).toBe('accepted');
		expect(getEntryLifecycle('airboss-ref:handbooks/phak/8083-25C/1/2' as SourceId)).toBe('accepted');
		expect(getEntryLifecycle('airboss-ref:handbooks/phak/8083-25C/1/2/1' as SourceId)).toBe('accepted');
	});

	it('builds canonical citation strings', async () => {
		await runHandbookIngest({ doc: 'phak', edition: '8083-25C', derivativeRoot: FIXTURE_ROOT });
		const sources = getSources();
		const sectionEntry = sources['airboss-ref:handbooks/phak/8083-25C/1/2' as SourceId];
		expect(sectionEntry).toBeDefined();
		if (sectionEntry === undefined) return;
		expect(sectionEntry.canonical_short).toBe('PHAK Ch.1.2');
		expect(sectionEntry.canonical_title).toBe('History of Flight');
		expect(sectionEntry.canonical_formal).toContain("Pilot's Handbook of Aeronautical Knowledge");
		expect(sectionEntry.canonical_formal).toContain('FAA-H-8083-25C');
		expect(sectionEntry.canonical_formal).toContain('Chapter 1, Section 2');
	});

	it('is idempotent (second run is a no-op)', async () => {
		await runHandbookIngest({ doc: 'phak', edition: '8083-25C', derivativeRoot: FIXTURE_ROOT });
		const second = await runHandbookIngest({
			doc: 'phak',
			edition: '8083-25C',
			derivativeRoot: FIXTURE_ROOT,
		});
		expect(second.entriesIngested).toBe(0);
		expect(second.entriesAlreadyAccepted).toBe(4);
		expect(second.promotionBatchId).toBeNull();
	});

	it('throws when doc/edition combination is unknown', async () => {
		await expect(runHandbookIngest({ doc: 'phak', edition: '8083-99Z', derivativeRoot: FIXTURE_ROOT })).rejects.toThrow(
			/unknown doc\/edition/,
		);
	});

	it('throws when manifest is missing', async () => {
		await expect(
			runHandbookIngest({ doc: 'phak', edition: '8083-25C', derivativeRoot: '/tmp/nonexistent-handbooks' }),
		).rejects.toThrow(/manifest not found/);
	});
});
