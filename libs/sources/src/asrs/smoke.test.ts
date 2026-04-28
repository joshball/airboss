/**
 * Phase 10 -- asrs corpus smoke test.
 *
 * Demand-driven status: the bundled manifest is intentionally empty
 * because cherry-picking specific ACNs is content-curation work. The
 * smoke test writes a temporary manifest with a representative ACN,
 * seeds against it, and validates a lesson that cites the same ACN.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateReferences } from '../check.ts';
import { resetRegistry } from '../registry/__test_helpers__.ts';
import { productionRegistry } from '../registry/index.ts';
import { seedAsrsFromManifest } from './seed.ts';

let tmpRoot: string;
let lessonRoot: string;
let manifestPath: string;

beforeEach(() => {
	tmpRoot = mkdtempSync(join(tmpdir(), 'asrs-smoke-'));
	lessonRoot = mkdtempSync(join(tmpdir(), 'asrs-smoke-lessons-'));
	manifestPath = join(tmpRoot, 'manifest.yaml');
	resetRegistry();
});

afterEach(() => {
	rmSync(tmpRoot, { recursive: true, force: true });
	rmSync(lessonRoot, { recursive: true, force: true });
	resetRegistry();
});

describe('phase-10 asrs validator smoke', () => {
	it('validates a lesson citing airboss-ref:asrs/<acn> with zero ERRORs', async () => {
		writeFileSync(
			manifestPath,
			`asrs:
  - id: '1234567'
    canonical_short: ASRS 1234567
    canonical_formal: ASRS Aviation Safety Report 1234567
    canonical_title: ASRS Report 1234567
    editions:
      - id: '2024-05-01'
        lifecycle: accepted
        source_url: https://asrs.arc.nasa.gov/search/database.html
`,
			'utf-8',
		);

		const seedReport = await seedAsrsFromManifest({ manifestPath });
		expect(seedReport.entriesRegistered).toBe(1);

		const lessonsDir = join(lessonRoot, 'course', 'regulations');
		mkdirSync(lessonsDir, { recursive: true });
		const lessonContent = `---
title: ASRS smoke test
week: 1
section_order: "01"
---

A relevant report is [@cite](airboss-ref:asrs/1234567).
`;
		writeFileSync(join(lessonsDir, 'asrs-smoke.md'), lessonContent, 'utf-8');

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
