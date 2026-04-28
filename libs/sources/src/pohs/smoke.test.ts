/**
 * Phase 10 -- pohs corpus smoke test.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateReferences } from '../check.ts';
import { resetRegistry } from '../registry/__test_helpers__.ts';
import { productionRegistry } from '../registry/index.ts';
import { seedPohsFromManifest } from './seed.ts';

let lessonRoot: string;

beforeEach(() => {
	lessonRoot = mkdtempSync(join(tmpdir(), 'pohs-smoke-lessons-'));
	resetRegistry();
});

afterEach(() => {
	rmSync(lessonRoot, { recursive: true, force: true });
	resetRegistry();
});

describe('phase-10 pohs validator smoke', () => {
	it('validates a lesson citing airboss-ref:pohs/c172s with zero ERRORs', async () => {
		const seedReport = await seedPohsFromManifest();
		expect(seedReport.entriesRegistered).toBeGreaterThan(0);

		const lessonsDir = join(lessonRoot, 'course', 'regulations');
		mkdirSync(lessonsDir, { recursive: true });
		const lessonContent = `---
title: POH smoke test
week: 1
section_order: "01"
---

The aircraft handbook is [@cite](airboss-ref:pohs/c172s).
`;
		writeFileSync(join(lessonsDir, 'pohs-smoke.md'), lessonContent, 'utf-8');

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
