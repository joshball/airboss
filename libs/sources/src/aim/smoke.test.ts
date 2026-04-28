/**
 * Phase 7 -- AIM corpus smoke test.
 *
 * The publish-gate proof: with the aim corpus ingested, an
 * `airboss-ref:aim/...` URL in a lesson resolves with zero ERROR findings.
 * Before Phase 7 lands, the same URL would have triggered row-2 ERROR
 * (entry not in registry); these tests are the proof that Phase 7 closed the
 * gate for AIM references.
 *
 * Three cases:
 *   1. AIM alone (real ingested corpus + a paragraph reference) -- the
 *      single-corpus happy path.
 *   2. AIM paragraph (chapter-section-paragraph triplet) -- exercises the full
 *      depth of the AIM locator hierarchy.
 *   3. Cross-corpus (AIM + regs in one lesson) -- proves the per-corpus
 *      resolvers compose without stepping on each other.
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
import { runAimIngest } from './ingest.ts';
import { setAimDerivativeRoot } from './resolver.ts';

const REPO_ROOT = process.cwd();
const AIM_DERIVATIVE_ROOT = join(REPO_ROOT, 'aim');
const AIM_EDITION = '2026-04';

let lessonRoot: string;

beforeEach(() => {
	lessonRoot = mkdtempSync(join(tmpdir(), 'aim-smoke-lessons-'));
	resetRegistry();
});

afterEach(() => {
	setAimDerivativeRoot(join(process.cwd(), 'aim'));
	rmSync(lessonRoot, { recursive: true, force: true });
	resetRegistry();
});

async function ingestRealAimCorpus(): Promise<void> {
	setAimDerivativeRoot(AIM_DERIVATIVE_ROOT);
	await runAimIngest({ edition: AIM_EDITION, derivativeRoot: AIM_DERIVATIVE_ROOT });
}

describe('phase-7 AIM validator smoke', () => {
	it('validates a lesson citing airboss-ref:aim/5-1?at=2026-04 with zero ERRORs (AIM alone, section-level)', async () => {
		await ingestRealAimCorpus();

		const lessonsDir = join(lessonRoot, 'course', 'regulations');
		mkdirSync(lessonsDir, { recursive: true });
		const lessonContent = `---
title: AIM smoke test
week: 1
section_order: "01"
---

# AIM smoke test

Preflight procedures live in [@cite](airboss-ref:aim/5-1?at=2026-04).
`;
		writeFileSync(join(lessonsDir, 'aim-smoke.md'), lessonContent, 'utf-8');

		const report = validateReferences({
			registry: productionRegistry,
			contentPaths: ['course/regulations'],
			cwd: lessonRoot,
		});

		const errors = report.findings.filter((f) => f.severity === 'error');
		expect(errors).toEqual([]);
		expect(report.identifiersFound).toBe(1);
	});

	it('validates a paragraph-level reference airboss-ref:aim/5-1-7?at=2026-04 with zero ERRORs', async () => {
		await ingestRealAimCorpus();

		const lessonsDir = join(lessonRoot, 'course', 'regulations');
		mkdirSync(lessonsDir, { recursive: true });
		writeFileSync(
			join(lessonsDir, 'aim-paragraph.md'),
			`---
title: AIM paragraph smoke
week: 1
section_order: "01"
---

The composite flight plan procedure appears in [@cite](airboss-ref:aim/5-1-7?at=2026-04).
`,
			'utf-8',
		);

		const report = validateReferences({
			registry: productionRegistry,
			contentPaths: ['course/regulations'],
			cwd: lessonRoot,
		});

		const errors = report.findings.filter((f) => f.severity === 'error');
		expect(errors).toEqual([]);
		expect(report.identifiersFound).toBe(1);
	});

	it('validates a lesson citing both aim and regs corpora with zero ERRORs (cross-corpus)', async () => {
		// Cross-corpus proof: ingest both, then validate a lesson that mixes
		// citations from both corpora.
		await ingestRealAimCorpus();

		const regsTmp = mkdtempSync(join(tmpdir(), 'aim-smoke-regs-'));
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
title: AIM + regs cross-corpus smoke
week: 1
section_order: "01"
---

The IFR clearance acceptance procedure in [@cite](airboss-ref:aim/5-1-7?at=2026-04)
references the underlying regulation [@cite](airboss-ref:regs/cfr-14/61/3?at=2026).
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
	}, 60000); // 60s: ingesting CFR-14 fixture is the slow step
});
