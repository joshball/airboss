import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetRegistry } from '../registry/__test_helpers__.ts';
import { __editions_internal__ } from '../registry/editions.ts';
import { getEntryLifecycle, listBatches } from '../registry/lifecycle.ts';
import { __sources_internal__ } from '../registry/sources.ts';
import type { SourceId } from '../types.ts';
import { PHASE_3_REVIEWER_ID, parseCliArgs, runIngest } from './ingest.ts';
import { setRegsDerivativeRoot } from './resolver.ts';

const FIXTURE_PATH = join(process.cwd(), 'tests/fixtures/cfr/title-14-2026-fixture.xml');

let tmpRoot: string;

beforeEach(() => {
	tmpRoot = mkdtempSync(join(tmpdir(), 'cfr-ingest-'));
	resetRegistry();
	setRegsDerivativeRoot(tmpRoot);
});

afterEach(() => {
	setRegsDerivativeRoot(join(process.cwd(), 'regulations'));
	rmSync(tmpRoot, { recursive: true, force: true });
	resetRegistry();
});

describe('runIngest against title-14 fixture', () => {
	it('populates SOURCES with parts, subparts, sections', async () => {
		const report = await runIngest({
			title: '14',
			editionDate: '2026-01-01',
			outRoot: tmpRoot,
			fixturePath: FIXTURE_PATH,
		});
		expect(report.entriesIngested).toBeGreaterThan(0);

		const sources = __sources_internal__.getActiveTable();
		expect(sources['airboss-ref:regs/cfr-14/91/103' as SourceId]).toBeDefined();
		expect(sources['airboss-ref:regs/cfr-14/91/subpart-b' as SourceId]).toBeDefined();
		expect(sources['airboss-ref:regs/cfr-14/91' as SourceId]).toBeDefined();
		expect(sources['airboss-ref:regs/cfr-14/61' as SourceId]).toBeDefined();
	});

	it('populates EDITIONS', async () => {
		await runIngest({
			title: '14',
			editionDate: '2026-01-01',
			outRoot: tmpRoot,
			fixturePath: FIXTURE_PATH,
		});

		const editionsMap = __editions_internal__.getActiveTable();
		const editions = editionsMap.get('airboss-ref:regs/cfr-14/91/103' as SourceId) ?? [];
		expect(editions).toHaveLength(1);
		expect(editions[0]?.id).toBe('2026');
	});

	it('promotes entries to accepted under PHASE_3_REVIEWER_ID', async () => {
		const report = await runIngest({
			title: '14',
			editionDate: '2026-01-01',
			outRoot: tmpRoot,
			fixturePath: FIXTURE_PATH,
		});
		expect(report.promotionBatchId).not.toBeNull();
		expect(getEntryLifecycle('airboss-ref:regs/cfr-14/91/103' as SourceId)).toBe('accepted');

		const batches = listBatches();
		const ourBatch = batches.find((b) => b.id === report.promotionBatchId);
		expect(ourBatch?.reviewerId).toBe(PHASE_3_REVIEWER_ID);
		expect(ourBatch?.toLifecycle).toBe('accepted');
	});

	it('writes derivative tree to outRoot', async () => {
		await runIngest({
			title: '14',
			editionDate: '2026-01-01',
			outRoot: tmpRoot,
			fixturePath: FIXTURE_PATH,
		});
		expect(existsSync(join(tmpRoot, 'cfr-14/2026-01-01/91/91-103.md'))).toBe(true);
		expect(existsSync(join(tmpRoot, 'cfr-14/2026-01-01/manifest.json'))).toBe(true);
		expect(existsSync(join(tmpRoot, 'cfr-14/2026-01-01/sections.json'))).toBe(true);
	});

	it('records the source URL as the fixture path', async () => {
		const report = await runIngest({
			title: '14',
			editionDate: '2026-01-01',
			outRoot: tmpRoot,
			fixturePath: FIXTURE_PATH,
		});
		const editions = __editions_internal__.getActiveTable().get('airboss-ref:regs/cfr-14/91/103' as SourceId) ?? [];
		expect(editions[0]?.source_url).toContain('file://');
		expect(report.editionDir).toContain('cfr-14/2026-01-01');
	});
});

describe('parseCliArgs', () => {
	it('parses --edition + --title + --out', () => {
		const result = parseCliArgs(['--edition=2026-01-01', '--title=14', '--out=/tmp/x']);
		expect('error' in result).toBe(false);
		if ('error' in result) return;
		expect(result.editionDate).toBe('2026-01-01');
		expect(result.title).toBe('14');
		expect(result.outRoot).toBe('/tmp/x');
	});

	it('parses --fixture', () => {
		const result = parseCliArgs(['--fixture=tests/fixtures/cfr/title-14-2026-fixture.xml']);
		expect('error' in result).toBe(false);
		if ('error' in result) return;
		expect(result.fixturePath).toBe('tests/fixtures/cfr/title-14-2026-fixture.xml');
	});

	it('rejects unknown args', () => {
		const result = parseCliArgs(['--bogus']);
		expect('error' in result).toBe(true);
	});

	it('rejects --title=other', () => {
		const result = parseCliArgs(['--title=7']);
		expect('error' in result).toBe(true);
	});

	it('parses --help', () => {
		const result = parseCliArgs(['--help']);
		expect('error' in result).toBe(false);
		if ('error' in result) return;
		expect(result.help).toBe(true);
	});
});
