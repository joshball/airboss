/**
 * Phase 10 -- statutes corpus smoke test.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateReferences } from '../check.ts';
import { resetRegistry } from '../registry/__test_helpers__.ts';
import { productionRegistry } from '../registry/index.ts';
import { seedStatutesFromManifest } from './seed.ts';

let lessonRoot: string;

beforeEach(() => {
	lessonRoot = mkdtempSync(join(tmpdir(), 'statutes-smoke-lessons-'));
	resetRegistry();
});

afterEach(() => {
	rmSync(lessonRoot, { recursive: true, force: true });
	resetRegistry();
});

describe('phase-10 statutes validator smoke', () => {
	it('validates a lesson citing airboss-ref:statutes/usc-49/40103 with zero ERRORs', async () => {
		const seedReport = await seedStatutesFromManifest();
		expect(seedReport.entriesRegistered).toBeGreaterThan(0);

		const lessonsDir = join(lessonRoot, 'course', 'regulations');
		mkdirSync(lessonsDir, { recursive: true });
		const lessonContent = `---
title: statutes smoke test
week: 1
section_order: "01"
---

A reference: [@cite](airboss-ref:statutes/usc-49/40103).
`;
		writeFileSync(join(lessonsDir, 'statutes-smoke.md'), lessonContent, 'utf-8');

		const report = validateReferences({
			registry: productionRegistry,
			contentPaths: ['course/regulations'],
			cwd: lessonRoot,
		});

		const errors = report.findings.filter((f) => f.severity === 'error');
		expect(errors).toEqual([]);
		expect(report.identifiersFound).toBe(1);
	});
});
