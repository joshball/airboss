import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetRegistry } from '../registry/__test_helpers__.ts';
import { runIngest } from '../regs/ingest.ts';
import { setRegsDerivativeRoot } from '../regs/resolver.ts';
import { clearBodyHashCache } from './body-hasher.ts';
import { findAutoAdvanceCandidates, findNeedsReviewCandidates, runDiffJob } from './diff-job.ts';

const FIXTURE_2026 = join(process.cwd(), 'tests/fixtures/cfr/title-14-2026-fixture.xml');
const FIXTURE_2027 = join(process.cwd(), 'tests/fixtures/cfr/title-14-2027-fixture.xml');

let tmpRoot: string;

beforeEach(async () => {
	resetRegistry();
	clearBodyHashCache();
	tmpRoot = mkdtempSync(join(tmpdir(), 'diff-job-'));
	setRegsDerivativeRoot(tmpRoot);
	await runIngest({
		title: '14',
		editionDate: '2026-01-01',
		outRoot: tmpRoot,
		fixturePath: FIXTURE_2026,
	});
	await runIngest({
		title: '14',
		editionDate: '2027-01-01',
		outRoot: tmpRoot,
		fixturePath: FIXTURE_2027,
	});
});

afterEach(() => {
	rmSync(tmpRoot, { recursive: true, force: true });
	resetRegistry();
	clearBodyHashCache();
});

describe('runDiffJob', () => {
	it('partitions outcomes for the 2026/2027 fixture pair', () => {
		const result = runDiffJob({ corpus: 'regs', outRoot: tmpRoot, skipWrite: true });
		expect(result.report.editionPair).toEqual({ old: '2026', new: '2027' });
		expect(result.report.outcomes.length).toBeGreaterThan(0);

		// §61.3, §61.5, §91.103, §91.149 are byte-identical -> auto-advance
		const autoAdvanceIds = findAutoAdvanceCandidates(result.report).map((o) => o.pair.id);
		expect(autoAdvanceIds).toContain('airboss-ref:regs/cfr-14/61/3');
		expect(autoAdvanceIds).toContain('airboss-ref:regs/cfr-14/61/5');
		expect(autoAdvanceIds).toContain('airboss-ref:regs/cfr-14/91/103');
		expect(autoAdvanceIds).toContain('airboss-ref:regs/cfr-14/91/149');

		// §91.1 was amended -> needs-review
		const needsReviewIds = findNeedsReviewCandidates(result.report).map((o) => o.pair.id);
		expect(needsReviewIds).toContain('airboss-ref:regs/cfr-14/91/1');
	});

	it('writes a JSON report to disk by default', () => {
		const outPath = join(tmpRoot, 'report.json');
		const result = runDiffJob({ corpus: 'regs', outRoot: tmpRoot, outPath });
		expect(result.reportPath).toBe(outPath);

		const content = require('node:fs').readFileSync(outPath, 'utf-8') as string;
		const parsed = JSON.parse(content);
		expect(parsed.schemaVersion).toBe(1);
		expect(parsed.corpus).toBe('regs');
		expect(parsed.editionPair).toEqual({ old: '2026', new: '2027' });
		expect(parsed.counts).toBeDefined();
	});

	it('skipWrite leaves no files behind', () => {
		const before = require('node:fs').readdirSync(tmpRoot);
		const result = runDiffJob({ corpus: 'regs', outRoot: tmpRoot, skipWrite: true });
		const after = require('node:fs').readdirSync(tmpRoot);
		expect(after).toEqual(before);
		expect(result.reportPath).toBeNull();
	});

	it('returns empty report when corpus has no two editions', () => {
		resetRegistry();
		clearBodyHashCache();
		const result = runDiffJob({ corpus: 'regs', outRoot: tmpRoot, skipWrite: true });
		expect(result.report.outcomes).toEqual([]);
	});

	it('emits diff snippets for needs-review entries', () => {
		const result = runDiffJob({ corpus: 'regs', outRoot: tmpRoot, skipWrite: true });
		const review = findNeedsReviewCandidates(result.report);
		const target = review.find((o) => o.pair.id === 'airboss-ref:regs/cfr-14/91/1');
		expect(target?.diffSnippet).toBeDefined();
		expect(target?.diffSnippet?.length ?? 0).toBeGreaterThan(0);
	});
});
