import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetRegistry } from '../registry/__test_helpers__.ts';
import { getEntryLifecycle } from '../registry/lifecycle.ts';
import { getSources } from '../registry/sources.ts';
import type { SourceId } from '../types.ts';
import { parseCliArgs, runAimIngest } from './ingest.ts';

const FIXTURE_ROOT = join(process.cwd(), 'tests/fixtures/aim/aim-fixture/aim');

describe('parseCliArgs', () => {
	it('parses valid args', () => {
		const result = parseCliArgs(['--edition=2026-09']);
		if ('error' in result) throw new Error('expected ok');
		expect(result.edition).toBe('2026-09');
	});

	it('parses --out=', () => {
		const result = parseCliArgs(['--edition=2026-09', '--out=/tmp/aim']);
		if ('error' in result) throw new Error('expected ok');
		expect(result.derivativeRoot).toBe('/tmp/aim');
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

describe('runAimIngest', () => {
	beforeEach(() => {
		resetRegistry();
	});
	afterEach(() => {
		resetRegistry();
	});

	it('ingests an edition from the fixture manifest', async () => {
		const report = await runAimIngest({ edition: '2026-09', derivativeRoot: FIXTURE_ROOT });
		expect(report.entriesIngested).toBe(6); // 1 chapter + 1 section + 2 paragraphs + 1 glossary + 1 appendix
		expect(report.entriesAlreadyAccepted).toBe(0);
		expect(report.promotionBatchId).not.toBeNull();
		expect(report.edition).toBe('2026-09');
	});

	it('promotes entries to accepted lifecycle', async () => {
		await runAimIngest({ edition: '2026-09', derivativeRoot: FIXTURE_ROOT });
		expect(getEntryLifecycle('airboss-ref:aim/5' as SourceId)).toBe('accepted');
		expect(getEntryLifecycle('airboss-ref:aim/5-1' as SourceId)).toBe('accepted');
		expect(getEntryLifecycle('airboss-ref:aim/5-1-7' as SourceId)).toBe('accepted');
		expect(getEntryLifecycle('airboss-ref:aim/glossary/pilot-in-command' as SourceId)).toBe('accepted');
		expect(getEntryLifecycle('airboss-ref:aim/appendix-1' as SourceId)).toBe('accepted');
	});

	it('builds canonical citation strings for a paragraph', async () => {
		await runAimIngest({ edition: '2026-09', derivativeRoot: FIXTURE_ROOT });
		const sources = getSources();
		const entry = sources['airboss-ref:aim/5-1-7' as SourceId];
		expect(entry).toBeDefined();
		if (entry === undefined) return;
		expect(entry.canonical_short).toBe('AIM 5-1-7');
		expect(entry.canonical_title).toBe('Pilot Responsibility upon Clearance Issuance');
		expect(entry.canonical_formal).toBe('Aeronautical Information Manual, Chapter 5, Section 1, Paragraph 7');
	});

	it('builds canonical citation strings for a chapter', async () => {
		await runAimIngest({ edition: '2026-09', derivativeRoot: FIXTURE_ROOT });
		const sources = getSources();
		const entry = sources['airboss-ref:aim/5' as SourceId];
		expect(entry).toBeDefined();
		if (entry === undefined) return;
		expect(entry.canonical_short).toBe('AIM 5');
		expect(entry.canonical_formal).toBe('Aeronautical Information Manual, Chapter 5');
	});

	it('builds canonical citation strings for a section', async () => {
		await runAimIngest({ edition: '2026-09', derivativeRoot: FIXTURE_ROOT });
		const sources = getSources();
		const entry = sources['airboss-ref:aim/5-1' as SourceId];
		expect(entry).toBeDefined();
		if (entry === undefined) return;
		expect(entry.canonical_short).toBe('AIM 5-1');
		expect(entry.canonical_formal).toBe('Aeronautical Information Manual, Chapter 5, Section 1');
	});

	it('builds canonical citation strings for a glossary entry', async () => {
		await runAimIngest({ edition: '2026-09', derivativeRoot: FIXTURE_ROOT });
		const sources = getSources();
		const entry = sources['airboss-ref:aim/glossary/pilot-in-command' as SourceId];
		expect(entry).toBeDefined();
		if (entry === undefined) return;
		expect(entry.canonical_short).toBe('AIM Glossary - Pilot In Command');
		expect(entry.canonical_formal).toBe('Aeronautical Information Manual, Pilot/Controller Glossary, Pilot In Command');
		expect(entry.canonical_title).toBe('Pilot In Command');
	});

	it('builds canonical citation strings for an appendix', async () => {
		await runAimIngest({ edition: '2026-09', derivativeRoot: FIXTURE_ROOT });
		const sources = getSources();
		const entry = sources['airboss-ref:aim/appendix-1' as SourceId];
		expect(entry).toBeDefined();
		if (entry === undefined) return;
		expect(entry.canonical_short).toBe('AIM Appendix 1');
		expect(entry.canonical_formal).toBe('Aeronautical Information Manual, Appendix 1');
	});

	it('is idempotent (second run is a no-op)', async () => {
		await runAimIngest({ edition: '2026-09', derivativeRoot: FIXTURE_ROOT });
		const second = await runAimIngest({ edition: '2026-09', derivativeRoot: FIXTURE_ROOT });
		expect(second.entriesIngested).toBe(0);
		expect(second.entriesAlreadyAccepted).toBe(6);
		expect(second.promotionBatchId).toBeNull();
	});

	it('throws when manifest is missing', async () => {
		await expect(runAimIngest({ edition: '2026-09', derivativeRoot: '/tmp/nonexistent-aim' })).rejects.toThrow(
			/manifest not found/,
		);
	});
});
