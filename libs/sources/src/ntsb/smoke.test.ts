/**
 * Phase 10 next slice -- ntsb corpus smoke test.
 *
 * Publish-gate proof: with the ntsb manifest seeded, an `airboss-ref:ntsb/...`
 * URL in a lesson resolves with zero ERROR findings.
 *
 * Demand-driven status: the bundled manifest currently ships empty because
 * the airboss content corpus does not yet cite NTSB reports. The smoke test
 * therefore writes a temporary manifest with a representative NTSB ID,
 * seeds against it, and validates a lesson that cites the same ID. This
 * proves the loader-validator loop end-to-end without authoring fictional
 * citations into the bundled manifest. When real NTSB citations land, this
 * test will additionally exercise the bundled manifest path.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateReferences } from '../check.ts';
import { resetRegistry } from '../registry/__test_helpers__.ts';
import { productionRegistry } from '../registry/index.ts';
import { seedNtsbFromManifest } from './seed.ts';

let tmpRoot: string;
let lessonRoot: string;
let manifestPath: string;

beforeEach(() => {
	tmpRoot = mkdtempSync(join(tmpdir(), 'ntsb-smoke-'));
	lessonRoot = mkdtempSync(join(tmpdir(), 'ntsb-smoke-lessons-'));
	manifestPath = join(tmpRoot, 'manifest.yaml');
	resetRegistry();
});

afterEach(() => {
	rmSync(tmpRoot, { recursive: true, force: true });
	rmSync(lessonRoot, { recursive: true, force: true });
	resetRegistry();
});

describe('phase-10 ntsb validator smoke', () => {
	it('validates a lesson citing airboss-ref:ntsb/<id> with zero ERRORs', async () => {
		writeFileSync(
			manifestPath,
			`ntsb:
  - id: WPR23LA123
    canonical_short: NTSB WPR23LA123
    canonical_formal: NTSB Aviation Accident Report WPR23LA123
    canonical_title: NTSB Accident Report WPR23LA123
    editions:
      - id: '2024-01-15'
        lifecycle: accepted
        source_url: https://data.ntsb.gov/carol-main-public/basic-search?queryString=WPR23LA123
`,
			'utf-8',
		);

		const seedReport = await seedNtsbFromManifest({ manifestPath });
		expect(seedReport.entriesRegistered).toBe(1);

		const lessonsDir = join(lessonRoot, 'course', 'regulations');
		mkdirSync(lessonsDir, { recursive: true });
		const lessonContent = `---
title: NTSB smoke test
week: 1
section_order: "01"
---

# NTSB smoke test

A relevant accident is [@cite](airboss-ref:ntsb/WPR23LA123).
`;
		writeFileSync(join(lessonsDir, 'ntsb-smoke.md'), lessonContent, 'utf-8');

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
