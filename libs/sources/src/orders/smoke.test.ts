/**
 * Phase 10 next slice -- orders corpus smoke test.
 *
 * The publish-gate proof: with the orders manifest seeded, an
 * `airboss-ref:orders/...` URL in a lesson resolves with zero ERROR findings.
 * Before this slice landed, the same URL would have triggered row-2 ERROR
 * (entry not in registry); this test is the proof that the manifest seeder
 * closed the gate for orders references.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateReferences } from '../check.ts';
import { resetRegistry } from '../registry/__test_helpers__.ts';
import { productionRegistry } from '../registry/index.ts';
import { seedOrdersFromManifest } from './seed.ts';

let lessonRoot: string;

beforeEach(() => {
	lessonRoot = mkdtempSync(join(tmpdir(), 'orders-smoke-lessons-'));
	resetRegistry();
});

afterEach(() => {
	rmSync(lessonRoot, { recursive: true, force: true });
	resetRegistry();
});

describe('phase-10 orders validator smoke', () => {
	it('validates a lesson citing airboss-ref:orders/faa/2150-3?at=2018-04 with zero ERRORs', async () => {
		const seedReport = await seedOrdersFromManifest();
		expect(seedReport.entriesRegistered).toBeGreaterThan(0);

		const lessonsDir = join(lessonRoot, 'course', 'regulations');
		mkdirSync(lessonsDir, { recursive: true });
		const lessonContent = `---
title: Orders smoke test
week: 1
section_order: "01"
---

# Orders smoke test

The compliance philosophy is detailed in [@cite](airboss-ref:orders/faa/2150-3?at=2018-04).
`;
		writeFileSync(join(lessonsDir, 'orders-smoke.md'), lessonContent, 'utf-8');

		const report = validateReferences({
			registry: productionRegistry,
			contentPaths: ['course/regulations'],
			cwd: lessonRoot,
		});

		const errors = report.findings.filter((f) => f.severity === 'error');
		expect(errors).toEqual([]);
		expect(report.identifiersFound).toBe(1);
	});

	it('validates an unpinned orders citation with zero ERRORs', async () => {
		await seedOrdersFromManifest();

		const lessonsDir = join(lessonRoot, 'course', 'regulations');
		mkdirSync(lessonsDir, { recursive: true });
		const lessonContent = `---
title: Orders unpinned smoke
week: 1
section_order: "01"
---

FSIMS provides ASI guidance: [@cite](airboss-ref:orders/faa/8900-1).
`;
		writeFileSync(join(lessonsDir, 'orders-unpinned.md'), lessonContent, 'utf-8');

		const report = validateReferences({
			registry: productionRegistry,
			contentPaths: ['course/regulations'],
			cwd: lessonRoot,
		});

		const errors = report.findings.filter((f) => f.severity === 'error');
		expect(errors).toEqual([]);
	});
});
