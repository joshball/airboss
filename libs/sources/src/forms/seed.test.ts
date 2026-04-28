/**
 * Phase 10 -- forms manifest seed loader tests.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetRegistry } from '../registry/__test_helpers__.ts';
import { productionRegistry } from '../registry/index.ts';
import type { SourceId } from '../types.ts';
import { seedFormsFromManifest } from './seed.ts';

let tmpRoot: string;
let manifestPath: string;

beforeEach(() => {
	tmpRoot = mkdtempSync(join(tmpdir(), 'forms-seed-'));
	manifestPath = join(tmpRoot, 'manifest.yaml');
	resetRegistry();
});

afterEach(() => {
	rmSync(tmpRoot, { recursive: true, force: true });
	resetRegistry();
});

describe('seedFormsFromManifest', () => {
	it('registers entries from a known-good manifest', async () => {
		writeFileSync(
			manifestPath,
			`forms:
  - id: 8710-1
    canonical_short: FAA 8710-1
    canonical_formal: FAA Form 8710-1, Airman Certificate Application
    canonical_title: Airman Certificate Application
    editions:
      - id: '2017-08'
        lifecycle: accepted
`,
			'utf-8',
		);

		const report = await seedFormsFromManifest({ manifestPath });
		expect(report.entriesRegistered).toBe(1);
		expect(report.skipReasons).toEqual([]);

		const id = 'airboss-ref:forms/8710-1' as SourceId;
		expect(productionRegistry.hasEntry(id)).toBe(true);
		expect(productionRegistry.getEntry(id)?.lifecycle).toBe('accepted');
	});

	it('rejects malformed entries with a skip reason', async () => {
		writeFileSync(
			manifestPath,
			`forms:
  - id: 'foo-bar-baz'
    canonical_short: bad
    canonical_formal: bad
    canonical_title: bad
    editions:
      - id: '2020'
        lifecycle: accepted
`,
			'utf-8',
		);

		const report = await seedFormsFromManifest({ manifestPath });
		expect(report.entriesRegistered).toBe(0);
		expect(report.skipReasons.length).toBe(1);
	});

	it('is idempotent: re-running adds no new entries', async () => {
		writeFileSync(
			manifestPath,
			`forms:
  - id: 8500-9
    canonical_short: FAA 8500-9
    canonical_formal: FAA Form 8500-9, Application for Medical Certificate
    canonical_title: Application for Medical Certificate
    editions:
      - id: '2018-04'
        lifecycle: accepted
`,
			'utf-8',
		);
		const first = await seedFormsFromManifest({ manifestPath });
		expect(first.entriesRegistered).toBe(1);

		const second = await seedFormsFromManifest({ manifestPath });
		expect(second.entriesRegistered).toBe(0);
		expect(second.entriesAlreadyAccepted).toBe(1);
	});

	it('throws when the manifest is missing', async () => {
		await expect(seedFormsFromManifest({ manifestPath: join(tmpRoot, 'absent.yaml') })).rejects.toThrow(
			/manifest not found/,
		);
	});

	it('uses the bundled manifest by default and registers every authored entry', async () => {
		const report = await seedFormsFromManifest();
		expect(report.entriesRegistered).toBeGreaterThan(0);
		expect(report.skipReasons).toEqual([]);
		const known = 'airboss-ref:forms/8710-1' as SourceId;
		expect(productionRegistry.hasEntry(known)).toBe(true);
	});
});
