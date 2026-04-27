/**
 * Phase 5 -- validator row-6 round-trip integration test.
 *
 * Source of truth: ADR 019 §1.5 row 6 ("pin > 1 edition older than current
 * accepted -> WARNING") and §5 (versioning workflow).
 *
 * Ingests both the 2026 and 2027 fixtures, asserts `getEditionDistance` is
 * meaningful, validates a synthetic lesson with an old pin to confirm the
 * row-6 WARNING fires, then runs the rewriter to advance the pin and
 * confirms the warning clears.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateReferences } from '../check.ts';
import { resetRegistry } from '../registry/__test_helpers__.ts';
import { registerCorpusResolver } from '../registry/corpus-resolver.ts';
import { __editions_internal__ } from '../registry/editions.ts';
import { productionRegistry } from '../registry/index.ts';
import { runIngest } from '../regs/ingest.ts';
import { REGS_RESOLVER, setRegsDerivativeRoot } from '../regs/resolver.ts';
import type { Edition, SourceId } from '../types.ts';
import { clearBodyHashCache } from './body-hasher.ts';
import { runRewrite } from './lesson-rewriter.ts';
import type { DiffOutcome, DiffOutcomeKind, DiffReport } from './types.ts';

const FIXTURE_2026 = join(process.cwd(), 'tests/fixtures/cfr/title-14-2026-fixture.xml');
const FIXTURE_2027 = join(process.cwd(), 'tests/fixtures/cfr/title-14-2027-fixture.xml');

let tmpRoot: string;
let lessonRoot: string;

beforeEach(async () => {
	resetRegistry();
	registerCorpusResolver(REGS_RESOLVER);
	clearBodyHashCache();
	tmpRoot = mkdtempSync(join(tmpdir(), 'edition-distance-'));
	lessonRoot = join(tmpRoot, 'course/regulations');
	mkdirSync(lessonRoot, { recursive: true });
	setRegsDerivativeRoot(join(tmpRoot, 'regulations'));
	await runIngest({
		title: '14',
		editionDate: '2026-01-01',
		outRoot: join(tmpRoot, 'regulations'),
		fixturePath: FIXTURE_2026,
	});
	await runIngest({
		title: '14',
		editionDate: '2027-01-01',
		outRoot: join(tmpRoot, 'regulations'),
		fixturePath: FIXTURE_2027,
	});
});

afterEach(() => {
	rmSync(tmpRoot, { recursive: true, force: true });
	resetRegistry();
	clearBodyHashCache();
});

describe('getEditionDistance integration', () => {
	it('reports distance == 1 for a one-edition-old pin', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103' as SourceId;
		const distance = productionRegistry.getEditionDistance(id, '2026');
		expect(distance).toBe(1);
	});

	it('reports distance == 0 when pin is the current accepted edition', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103' as SourceId;
		const distance = productionRegistry.getEditionDistance(id, '2027');
		expect(distance).toBe(0);
	});

	it('returns null for an unknown pin', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103' as SourceId;
		const distance = productionRegistry.getEditionDistance(id, '1999');
		expect(distance).toBeNull();
	});
});

describe('validator row-6 WARNING and rewrite round-trip', () => {
	it('fires row-6 for a pin two editions stale, and clears it after rewrite', () => {
		// Synthesize a third edition slug ahead of 2026 + 2027 so distance is > 1.
		// We add a 2025 edition record to the existing entry by mutating the
		// editions map. Adding via `__editions_internal__` keeps the test honest:
		// the production resolver computes `currentAccepted` from the editions
		// map, so pinning to '2025' against [2025, 2026, 2027] gives distance 2.
		const id = 'airboss-ref:regs/cfr-14/91/103' as SourceId;
		const editionsMap = __editions_internal__.getActiveTable();
		const current = editionsMap.get(id) ?? [];
		const augmented: readonly Edition[] = [
			{ id: '2025', published_date: new Date('2025-01-01'), source_url: 'https://x' },
			...current,
		];
		editionsMap.set(id, augmented);

		// Current accepted is the largest slug -- '2027'. Distance from 2025 is 2.
		expect(productionRegistry.getEditionDistance(id, '2025')).toBe(2);

		// Author a temp lesson pinned at 2025.
		const lesson = join(lessonRoot, 'lesson-stale.md');
		writeFileSync(
			lesson,
			'---\ntitle: Stale\n---\n\nSee [@cite](airboss-ref:regs/cfr-14/91/103?at=2025) for preflight action.\n',
		);

		// Validate -- expect row-6 WARNING.
		const report = validateReferences({ cwd: tmpRoot, contentPaths: ['course/regulations'] });
		const row6 = report.findings.filter((f) => f.ruleId === 6);
		expect(row6.length).toBeGreaterThanOrEqual(1);
		expect(row6[0]?.severity).toBe('warning');

		// Build a synthetic auto-advance report to feed the rewriter.
		const counts: Record<DiffOutcomeKind, number> = {
			'auto-advance': 1,
			'needs-review': 0,
			'alias-silent': 0,
			'alias-content': 0,
			'alias-cross': 0,
			'alias-split': 0,
			'alias-merge': 0,
			'missing-old': 0,
			'missing-new': 0,
		};
		const outcome: DiffOutcome = {
			pair: { id, corpus: 'regs', oldEdition: '2025', newEdition: '2027' },
			kind: 'auto-advance',
			oldHash: 'a',
			newHash: 'a',
		};
		const synthReport: DiffReport = {
			schemaVersion: 1,
			corpus: 'regs',
			editionPair: { old: '2025', new: '2027' },
			generatedAt: new Date().toISOString(),
			counts,
			outcomes: [outcome],
		};
		const rewriteResult = runRewrite(synthReport, { cwd: tmpRoot, skipGitCheck: true });
		expect(rewriteResult.filesRewritten).toBe(1);
		expect(rewriteResult.occurrencesAdvanced).toBe(1);

		// Re-validate -- row-6 should be clear.
		const report2 = validateReferences({ cwd: tmpRoot, contentPaths: ['course/regulations'] });
		const row6After = report2.findings.filter((f) => f.ruleId === 6);
		expect(row6After).toEqual([]);
	});
});
