/**
 * Phase 10 -- interp corpus smoke test.
 *
 * Publish-gate proof: with the interp manifest seeded, an
 * `airboss-ref:interp/...` URL in a lesson resolves with zero ERROR findings.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateReferences } from '../check.ts';
import { resetRegistry } from '../registry/__test_helpers__.ts';
import { productionRegistry } from '../registry/index.ts';
import { seedInterpFromManifest } from './seed.ts';

let lessonRoot: string;

beforeEach(() => {
	lessonRoot = mkdtempSync(join(tmpdir(), 'interp-smoke-lessons-'));
	resetRegistry();
});

afterEach(() => {
	rmSync(lessonRoot, { recursive: true, force: true });
	resetRegistry();
});

describe('phase-10 interp validator smoke', () => {
	it('validates a lesson citing airboss-ref:interp/chief-counsel/mangiamele-2009 with zero ERRORs', async () => {
		const seedReport = await seedInterpFromManifest();
		expect(seedReport.entriesRegistered).toBeGreaterThan(0);

		const lessonsDir = join(lessonRoot, 'course', 'regulations');
		mkdirSync(lessonsDir, { recursive: true });
		const lessonContent = `---
title: Interp smoke test
week: 1
section_order: "01"
---

A relevant interpretation is [@cite](airboss-ref:interp/chief-counsel/mangiamele-2009).
`;
		writeFileSync(join(lessonsDir, 'interp-smoke.md'), lessonContent, 'utf-8');

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
