/**
 * Phase 10 (slice) -- ACS corpus smoke test.
 *
 * The publish-gate proof: with the ACS corpus ingested, an
 * `airboss-ref:acs/...` URL in a lesson resolves with zero ERROR findings.
 * Before this slice landed, the same URL would have triggered row-2 ERROR
 * (entry not in registry); the test below is the proof that ACS Lane D
 * closed the gate for PPL Airplane ACS references under the cert-syllabus
 * WP locked-Q7 locator format.
 *
 * Also covers cross-corpus resolution: a single lesson cites both
 * `airboss-ref:acs/...` AND `airboss-ref:regs/...`; both must validate clean
 * after their respective ingests run, proving the corpus resolvers compose
 * without stepping on each other.
 *
 * Slice scope: `ppl-airplane-6c` only. Other publications are skipped with
 * explicit reasons by the ingest until additional slug mappings are wired
 * into `ACS_DETECTED_EDITION_TO_SLUG`.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateReferences } from '../check.ts';
import { resetRegistry } from '../registry/__test_helpers__.ts';
import { productionRegistry } from '../registry/index.ts';
import { runIngest as runRegsIngest } from '../regs/ingest.ts';
import { setRegsDerivativeRoot } from '../regs/resolver.ts';
import { runAcsIngest } from './ingest.ts';
import { setAcsDerivativeRoot } from './resolver.ts';

const REPO_ROOT = process.cwd();
const ACS_DERIVATIVE_ROOT = join(REPO_ROOT, 'acs');

let lessonRoot: string;

beforeEach(() => {
	lessonRoot = mkdtempSync(join(tmpdir(), 'acs-smoke-lessons-'));
	resetRegistry();
});

afterEach(() => {
	setAcsDerivativeRoot(join(process.cwd(), 'acs'));
	rmSync(lessonRoot, { recursive: true, force: true });
	resetRegistry();
});

async function ingestRealAcsCorpus(): Promise<void> {
	setAcsDerivativeRoot(ACS_DERIVATIVE_ROOT);
	const cacheRoot =
		process.env.AIRBOSS_HANDBOOK_CACHE ?? join(process.env.HOME ?? '', 'Documents', 'airboss-handbook-cache');
	await runAcsIngest({ cacheRoot, derivativeRoot: ACS_DERIVATIVE_ROOT });
}

describe('phase-10 ACS validator smoke (ppl-airplane-6c slice)', () => {
	it('validates a lesson citing an ACS task with zero ERRORs', async () => {
		await ingestRealAcsCorpus();

		const lessonsDir = join(lessonRoot, 'course', 'regulations');
		mkdirSync(lessonsDir, { recursive: true });
		const lessonContent = `---
title: ACS task smoke test
week: 1
section_order: "01"
---

# ACS task smoke test

Pilot Qualifications is covered in [@cite](airboss-ref:acs/ppl-airplane-6c/area-01/task-a).
`;
		writeFileSync(join(lessonsDir, 'acs-task.md'), lessonContent, 'utf-8');

		const report = validateReferences({
			registry: productionRegistry,
			contentPaths: ['course/regulations'],
			cwd: lessonRoot,
		});

		const errors = report.findings.filter((f) => f.severity === 'error');
		expect(errors).toEqual([]);
		expect(report.identifiersFound).toBe(1);
	});

	it('validates a lesson citing an ACS K/R/S element with zero ERRORs', async () => {
		await ingestRealAcsCorpus();

		const lessonsDir = join(lessonRoot, 'course', 'regulations');
		mkdirSync(lessonsDir, { recursive: true });
		const lessonContent = `---
title: ACS element smoke test
week: 1
section_order: "01"
---

The recordkeeping requirement is captured in
[@cite](airboss-ref:acs/ppl-airplane-6c/area-01/task-a/elem-k01).
`;
		writeFileSync(join(lessonsDir, 'acs-element.md'), lessonContent, 'utf-8');

		const report = validateReferences({
			registry: productionRegistry,
			contentPaths: ['course/regulations'],
			cwd: lessonRoot,
		});

		const errors = report.findings.filter((f) => f.severity === 'error');
		expect(errors).toEqual([]);
		expect(report.identifiersFound).toBe(1);
	});

	it('validates a lesson citing both acs and regs corpora with zero ERRORs', async () => {
		// Cross-corpus proof: ingest both, then validate a lesson that mixes
		// citations from each. Mirror of Lane C's `ac/smoke.test.ts` pattern.
		await ingestRealAcsCorpus();

		const regsTmp = mkdtempSync(join(tmpdir(), 'acs-smoke-regs-'));
		setRegsDerivativeRoot(regsTmp);
		const fixturePath = join(REPO_ROOT, 'tests/fixtures/cfr/title-14-2026-fixture.xml');
		await runRegsIngest({
			title: '14',
			editionDate: '2026-04-22',
			fixturePath,
			outRoot: regsTmp,
		});

		const lessonsDir = join(lessonRoot, 'course', 'regulations');
		mkdirSync(lessonsDir, { recursive: true });
		const lessonContent = `---
title: Cross-corpus smoke
week: 1
section_order: "01"
---

The pilot-qualification standard is in
[@cite](airboss-ref:acs/ppl-airplane-6c/area-01/task-a); the underlying
regulation is [@cite](airboss-ref:regs/cfr-14/61/3?at=2026).
`;
		writeFileSync(join(lessonsDir, 'cross-corpus.md'), lessonContent, 'utf-8');

		const report = validateReferences({
			registry: productionRegistry,
			contentPaths: ['course/regulations'],
			cwd: lessonRoot,
		});

		const errors = report.findings.filter((f) => f.severity === 'error');
		expect(errors).toEqual([]);
		expect(report.identifiersFound).toBe(2);

		rmSync(regsTmp, { recursive: true, force: true });
	}, 60000); // 60s timeout: ingesting CFR-14 fixture is the slow step
});
