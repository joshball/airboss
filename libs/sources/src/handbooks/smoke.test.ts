/**
 * Phase 6 -- validator smoke test.
 *
 * The publish-gate proof: with the handbooks corpus ingested, an
 * `airboss-ref:handbooks/...` URL in a lesson resolves with zero ERROR
 * findings. Before Phase 6 lands, the same URL would have triggered row-2
 * ERROR (entry not in registry); this test is the proof that Phase 6 closed
 * the gate for handbook references.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateReferences } from '../check.ts';
import { resetRegistry } from '../registry/__test_helpers__.ts';
import { productionRegistry } from '../registry/index.ts';
import { runHandbookIngest } from './ingest.ts';
import { setHandbooksDerivativeRoot } from './resolver.ts';

const FIXTURE_ROOT = join(process.cwd(), 'tests/fixtures/handbooks/phak-fixture');

let lessonRoot: string;

beforeEach(() => {
	lessonRoot = mkdtempSync(join(tmpdir(), 'handbooks-smoke-lessons-'));
	resetRegistry();
	setHandbooksDerivativeRoot(FIXTURE_ROOT);
});

afterEach(() => {
	setHandbooksDerivativeRoot(join(process.cwd(), 'handbooks'));
	rmSync(lessonRoot, { recursive: true, force: true });
	resetRegistry();
});

describe('phase-6 validator smoke', () => {
	it('validates a lesson citing airboss-ref:handbooks/phak/8083-25C/1/2 with zero ERRORs', async () => {
		// 1. Ingest the fixture so the registry has chapter 1, section 1.2 etc.
		await runHandbookIngest({
			doc: 'phak',
			edition: '8083-25C',
			derivativeRoot: FIXTURE_ROOT,
		});

		// 2. Write a temp lesson that cites the section
		const lessonsDir = join(lessonRoot, 'course', 'regulations');
		mkdirSync(lessonsDir, { recursive: true });
		const lessonContent = `---
title: Smoke test
week: 1
section_order: "01"
---

# Smoke test

The earliest aviation history is described in [@cite](airboss-ref:handbooks/phak/8083-25C/1/2).
`;
		writeFileSync(join(lessonsDir, 'smoke.md'), lessonContent, 'utf-8');

		// 3. Run the validator
		const report = validateReferences({
			registry: productionRegistry,
			contentPaths: ['course/regulations'],
			cwd: lessonRoot,
		});

		const errors = report.findings.filter((f) => f.severity === 'error');
		expect(errors).toEqual([]);
		expect(report.identifiersFound).toBe(1);
	});

	it('validates a chapter-level reference with zero ERRORs', async () => {
		await runHandbookIngest({
			doc: 'phak',
			edition: '8083-25C',
			derivativeRoot: FIXTURE_ROOT,
		});

		const lessonsDir = join(lessonRoot, 'course', 'regulations');
		mkdirSync(lessonsDir, { recursive: true });
		writeFileSync(
			join(lessonsDir, 'chapter.md'),
			`---
title: Chapter
week: 1
section_order: "01"
---

[@title](airboss-ref:handbooks/phak/8083-25C/1)
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
	});

	it('validates a subsection reference with zero ERRORs', async () => {
		await runHandbookIngest({
			doc: 'phak',
			edition: '8083-25C',
			derivativeRoot: FIXTURE_ROOT,
		});

		const lessonsDir = join(lessonRoot, 'course', 'regulations');
		mkdirSync(lessonsDir, { recursive: true });
		writeFileSync(
			join(lessonsDir, 'sub.md'),
			`---
title: Subsection
week: 1
section_order: "01"
---

[@cite](airboss-ref:handbooks/phak/8083-25C/1/2/1)
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
	});
});
