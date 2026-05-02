import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ENV_VARS } from '@ab/constants';
import { db } from '@ab/db/connection';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promotionBatches } from '../db/schema.ts';
import { resetRegistry } from '../registry/__test_helpers__.ts';
import { __editions_internal__ } from '../registry/editions.ts';
import { getEntryLifecycle, listBatches } from '../registry/lifecycle.ts';
import { __sources_internal__ } from '../registry/sources.ts';
import type { SourceId } from '../types.ts';
import { PHASE_3_REVIEWER_ID, parseCliArgs, runIngest } from './ingest.ts';
import { setRegsDerivativeRoot } from './resolver.ts';

const FIXTURE_PATH = join(process.cwd(), 'tests/fixtures/cfr/title-14-2026-fixture.xml');

let tmpRoot: string;

async function deleteOurBatches(): Promise<void> {
	// Scoped cleanup so concurrent test files (e.g. lifecycle.test.ts under
	// reviewer 'jball') keep their own rows.
	await db.delete(promotionBatches).where(eq(promotionBatches.reviewerId, PHASE_3_REVIEWER_ID));
}

beforeEach(async () => {
	tmpRoot = mkdtempSync(join(tmpdir(), 'cfr-ingest-'));
	await deleteOurBatches();
	resetRegistry();
	setRegsDerivativeRoot(tmpRoot);
});

afterEach(async () => {
	setRegsDerivativeRoot(join(process.cwd(), 'regulations'));
	rmSync(tmpRoot, { recursive: true, force: true });
	await deleteOurBatches();
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

		const batches = await listBatches();
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

describe('runIngest against title-49 (multi-part aggregation)', () => {
	let originalCacheEnv: string | undefined;
	let cacheTmpRoot: string;

	beforeEach(() => {
		originalCacheEnv = process.env[ENV_VARS.AIRBOSS_HANDBOOK_CACHE];
		cacheTmpRoot = mkdtempSync(join(tmpdir(), 'cfr-49-cache-'));
		process.env[ENV_VARS.AIRBOSS_HANDBOOK_CACHE] = cacheTmpRoot;
	});

	afterEach(() => {
		if (originalCacheEnv === undefined) delete process.env[ENV_VARS.AIRBOSS_HANDBOOK_CACHE];
		else process.env[ENV_VARS.AIRBOSS_HANDBOOK_CACHE] = originalCacheEnv;
		rmSync(cacheTmpRoot, { recursive: true, force: true });
	});

	it('fetches each part separately and aggregates into one manifest', async () => {
		const part830Xml =
			'<?xml version="1.0"?>\n' +
			'<DIV5 N="830" TYPE="PART"><HEAD>PART 830&#x2014;NTSB REPORTING</HEAD>\n' +
			'<DIV6 N="A" TYPE="SUBPART"><HEAD>Subpart A&#x2014;General</HEAD>\n' +
			'<DIV8 N="830.1" TYPE="SECTION"><HEAD>&#xA7; 830.1 Applicability.</HEAD>\n' +
			'<P>This part contains rules.</P></DIV8></DIV6></DIV5>';
		const part1552Xml =
			'<?xml version="1.0"?>\n' +
			'<DIV5 N="1552" TYPE="PART"><HEAD>PART 1552&#x2014;FLIGHT TRAINING SECURITY</HEAD>\n' +
			'<DIV6 N="A" TYPE="SUBPART"><HEAD>Subpart A&#x2014;General</HEAD>\n' +
			'<DIV8 N="1552.1" TYPE="SECTION"><HEAD>&#xA7; 1552.1 Scope.</HEAD>\n' +
			'<P>This part includes requirements.</P></DIV8></DIV6></DIV5>';

		const fetched: string[] = [];
		const fetchImpl = async (url: string) => {
			fetched.push(url);
			let body = '';
			if (url.includes('part=830')) body = part830Xml;
			else if (url.includes('part=1552')) body = part1552Xml;
			else throw new Error(`unexpected fetch: ${url}`);
			return { ok: true, status: 200, text: async () => body };
		};

		const report = await runIngest({
			title: '49',
			editionDate: '2026-04-24',
			outRoot: tmpRoot,
			fetchImpl,
		});

		// Both parts fetched separately
		expect(fetched).toHaveLength(2);
		expect(fetched.some((u) => u.includes('part=830'))).toBe(true);
		expect(fetched.some((u) => u.includes('part=1552'))).toBe(true);

		// Aggregated into one manifest with both parts
		expect(report.entriesIngested).toBeGreaterThan(0);
		const sources = __sources_internal__.getActiveTable();
		expect(sources['airboss-ref:regs/cfr-49/830' as SourceId]).toBeDefined();
		expect(sources['airboss-ref:regs/cfr-49/1552' as SourceId]).toBeDefined();
		expect(sources['airboss-ref:regs/cfr-49/830/1' as SourceId]).toBeDefined();
		expect(sources['airboss-ref:regs/cfr-49/1552/1' as SourceId]).toBeDefined();

		// Single manifest covers both parts
		expect(existsSync(join(tmpRoot, 'cfr-49/2026-04-24/manifest.json'))).toBe(true);
		expect(existsSync(join(tmpRoot, 'cfr-49/2026-04-24/830/830-1.md'))).toBe(true);
		expect(existsSync(join(tmpRoot, 'cfr-49/2026-04-24/1552/1552-1.md'))).toBe(true);
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
