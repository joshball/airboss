/**
 * Phase 10 -- forms corpus smoke test.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateReferences } from '../check.ts';
import { resetRegistry } from '../registry/__test_helpers__.ts';
import { productionRegistry } from '../registry/index.ts';
import { seedFormsFromManifest } from './seed.ts';

let lessonRoot: string;

beforeEach(() => {
	lessonRoot = mkdtempSync(join(tmpdir(), 'forms-smoke-lessons-'));
	resetRegistry();
});

afterEach(() => {
	rmSync(lessonRoot, { recursive: true, force: true });
	resetRegistry();
});

describe('phase-10 forms validator smoke', () => {
	it('validates a lesson citing airboss-ref:forms/8710-1 with zero ERRORs', async () => {
		const seedReport = await seedFormsFromManifest();
		expect(seedReport.entriesRegistered).toBeGreaterThan(0);

		const lessonsDir = join(lessonRoot, 'course', 'regulations');
		mkdirSync(lessonsDir, { recursive: true });
		const lessonContent = `---
title: forms smoke test
week: 1
section_order: "01"
---

A reference: [@cite](airboss-ref:forms/8710-1).
`;
		writeFileSync(join(lessonsDir, 'forms-smoke.md'), lessonContent, 'utf-8');

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
