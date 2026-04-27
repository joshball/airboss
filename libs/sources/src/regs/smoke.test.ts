/**
 * Phase 3 -- validator smoke test.
 *
 * The publish gate proof: with the regs corpus ingested, an `airboss-ref:regs/...`
 * URL in a lesson resolves with zero ERROR findings. Before Phase 3 lands, the
 * same URL would have triggered row-2 ERROR (entry not in registry); this test
 * is the proof that Phase 3 closed the gate.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateReferences } from '../check.ts';
import { resetRegistry } from '../registry/__test_helpers__.ts';
import { productionRegistry } from '../registry/index.ts';
import { runIngest } from './ingest.ts';
import { setRegsDerivativeRoot } from './resolver.ts';

const FIXTURE_PATH = join(process.cwd(), 'tests/fixtures/cfr/title-14-2026-fixture.xml');

let tmpRoot: string;
let lessonRoot: string;

beforeEach(() => {
	tmpRoot = mkdtempSync(join(tmpdir(), 'cfr-smoke-'));
	lessonRoot = mkdtempSync(join(tmpdir(), 'cfr-smoke-lessons-'));
	resetRegistry();
	setRegsDerivativeRoot(tmpRoot);
});

afterEach(() => {
	setRegsDerivativeRoot(join(process.cwd(), 'regulations'));
	rmSync(tmpRoot, { recursive: true, force: true });
	rmSync(lessonRoot, { recursive: true, force: true });
	resetRegistry();
});

describe('phase-3 validator smoke', () => {
	it('validates a lesson citing airboss-ref:regs/cfr-14/91/103?at=2026 with zero ERRORs', async () => {
		// 1. Ingest the fixture so the registry has 91.103 + edition 2026
		await runIngest({
			title: '14',
			editionDate: '2026-01-01',
			outRoot: tmpRoot,
			fixturePath: FIXTURE_PATH,
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

Per [@cite](airboss-ref:regs/cfr-14/91/103?at=2026), the PIC must become familiar with all available information before any flight.
`;
		writeFileSync(join(lessonsDir, 'smoke.md'), lessonContent, 'utf-8');

		// 3. Run the validator
		const report = validateReferences({
			registry: productionRegistry,
			contentPaths: ['course/regulations'],
			cwd: lessonRoot,
		});

		const errors = report.findings.filter((f) => f.severity === 'error');
		const warnings = report.findings.filter((f) => f.severity === 'warning');

		expect(errors).toEqual([]);
		expect(warnings).toEqual([]);
		expect(report.identifiersFound).toBe(1);
	});

	it('still ERRORs on a stale-pin reference (older than current edition)', async () => {
		// Ingest 2026 only -- a 2024 pin is unknown and should ERROR (no such edition).
		await runIngest({
			title: '14',
			editionDate: '2026-01-01',
			outRoot: tmpRoot,
			fixturePath: FIXTURE_PATH,
		});

		const lessonsDir = join(lessonRoot, 'course', 'regulations');
		mkdirSync(lessonsDir, { recursive: true });
		writeFileSync(
			join(lessonsDir, 'stale.md'),
			`---
title: Stale
week: 1
section_order: "01"
---

[@cite](airboss-ref:regs/cfr-14/91/103?at=2024)
`,
			'utf-8',
		);

		const report = validateReferences({
			registry: productionRegistry,
			contentPaths: ['course/regulations'],
			cwd: lessonRoot,
		});
		const errors = report.findings.filter((f) => f.severity === 'error');
		expect(errors.length).toBeGreaterThan(0);
	});
});
