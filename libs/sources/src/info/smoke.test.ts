/**
 * Phase 10 -- info corpus smoke test.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateReferences } from '../check.ts';
import { resetRegistry } from '../registry/__test_helpers__.ts';
import { productionRegistry } from '../registry/index.ts';
import { seedInfoFromManifest } from './seed.ts';

let lessonRoot: string;

beforeEach(() => {
	lessonRoot = mkdtempSync(join(tmpdir(), 'info-smoke-lessons-'));
	resetRegistry();
});

afterEach(() => {
	rmSync(lessonRoot, { recursive: true, force: true });
	resetRegistry();
});

describe('phase-10 info validator smoke', () => {
	it('validates a lesson citing airboss-ref:info/21010 with zero ERRORs', async () => {
		const seedReport = await seedInfoFromManifest();
		expect(seedReport.entriesRegistered).toBeGreaterThan(0);

		const lessonsDir = join(lessonRoot, 'course', 'regulations');
		mkdirSync(lessonsDir, { recursive: true });
		const lessonContent = `---
title: info smoke test
week: 1
section_order: "01"
---

A reference: [@cite](airboss-ref:info/21010).
`;
		writeFileSync(join(lessonsDir, 'info-smoke.md'), lessonContent, 'utf-8');

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
