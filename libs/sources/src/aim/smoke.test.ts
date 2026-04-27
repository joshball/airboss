/**
 * Phase 7 -- validator smoke test.
 *
 * The publish-gate proof: with the aim corpus ingested, an
 * `airboss-ref:aim/...` URL in a lesson resolves with zero ERROR findings.
 * Before Phase 7 lands, the same URL would have triggered row-2 ERROR
 * (entry not in registry); this test is the proof that Phase 7 closed the
 * gate for AIM references.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateReferences } from '../check.ts';
import { resetRegistry } from '../registry/__test_helpers__.ts';
import { productionRegistry } from '../registry/index.ts';
import { runAimIngest } from './ingest.ts';
import { setAimDerivativeRoot } from './resolver.ts';

const FIXTURE_ROOT = join(process.cwd(), 'tests/fixtures/aim/aim-fixture/aim');

let lessonRoot: string;

beforeEach(() => {
	lessonRoot = mkdtempSync(join(tmpdir(), 'aim-smoke-lessons-'));
	resetRegistry();
	setAimDerivativeRoot(FIXTURE_ROOT);
});

afterEach(() => {
	setAimDerivativeRoot(join(process.cwd(), 'aim'));
	rmSync(lessonRoot, { recursive: true, force: true });
	resetRegistry();
});

describe('phase-7 validator smoke', () => {
	it('validates a lesson citing airboss-ref:aim/5-1-7?at=2026-09 with zero ERRORs', async () => {
		await runAimIngest({ edition: '2026-09', derivativeRoot: FIXTURE_ROOT });

		const lessonsDir = join(lessonRoot, 'course', 'regulations');
		mkdirSync(lessonsDir, { recursive: true });
		const lessonContent = `---
title: Smoke test
week: 1
section_order: "01"
---

# Smoke test

Pilot responsibility upon clearance is described in [@cite](airboss-ref:aim/5-1-7?at=2026-09).
`;
		writeFileSync(join(lessonsDir, 'smoke.md'), lessonContent, 'utf-8');

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
		await runAimIngest({ edition: '2026-09', derivativeRoot: FIXTURE_ROOT });

		const lessonsDir = join(lessonRoot, 'course', 'regulations');
		mkdirSync(lessonsDir, { recursive: true });
		writeFileSync(
			join(lessonsDir, 'chapter.md'),
			`---
title: Chapter
week: 1
section_order: "01"
---

[@title](airboss-ref:aim/5?at=2026-09)
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

	it('validates a glossary reference with zero ERRORs', async () => {
		await runAimIngest({ edition: '2026-09', derivativeRoot: FIXTURE_ROOT });

		const lessonsDir = join(lessonRoot, 'course', 'regulations');
		mkdirSync(lessonsDir, { recursive: true });
		writeFileSync(
			join(lessonsDir, 'glossary.md'),
			`---
title: Glossary
week: 1
section_order: "01"
---

[@cite](airboss-ref:aim/glossary/pilot-in-command?at=2026-09)
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

	it('validates an appendix reference with zero ERRORs', async () => {
		await runAimIngest({ edition: '2026-09', derivativeRoot: FIXTURE_ROOT });

		const lessonsDir = join(lessonRoot, 'course', 'regulations');
		mkdirSync(lessonsDir, { recursive: true });
		writeFileSync(
			join(lessonsDir, 'appendix.md'),
			`---
title: Appendix
week: 1
section_order: "01"
---

[@cite](airboss-ref:aim/appendix-1?at=2026-09)
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
