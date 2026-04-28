/**
 * Phase 10 -- statutes manifest seed loader tests.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetRegistry } from '../registry/__test_helpers__.ts';
import { productionRegistry } from '../registry/index.ts';
import type { SourceId } from '../types.ts';
import { seedStatutesFromManifest } from './seed.ts';

let tmpRoot: string;
let manifestPath: string;

beforeEach(() => {
	tmpRoot = mkdtempSync(join(tmpdir(), 'statutes-seed-'));
	manifestPath = join(tmpRoot, 'manifest.yaml');
	resetRegistry();
});

afterEach(() => {
	rmSync(tmpRoot, { recursive: true, force: true });
	resetRegistry();
});

describe('seedStatutesFromManifest', () => {
	it('registers entries from a known-good manifest', async () => {
		writeFileSync(
			manifestPath,
			`statutes:
  - id: usc-49/40103
    canonical_short: 49 USC § 40103
    canonical_formal: 49 U.S.C. § 40103, Sovereignty and Use of Airspace
    canonical_title: Sovereignty and Use of Airspace
    editions:
      - id: '2018'
        lifecycle: accepted
`,
			'utf-8',
		);

		const report = await seedStatutesFromManifest({ manifestPath });
		expect(report.entriesRegistered).toBe(1);
		expect(report.skipReasons).toEqual([]);

		const id = 'airboss-ref:statutes/usc-49/40103' as SourceId;
		expect(productionRegistry.hasEntry(id)).toBe(true);
		expect(productionRegistry.getEntry(id)?.lifecycle).toBe('accepted');
	});

	it('rejects malformed entries with a skip reason', async () => {
		writeFileSync(
			manifestPath,
			`statutes:
  - id: 'not-a-title/x'
    canonical_short: bad
    canonical_formal: bad
    canonical_title: bad
    editions:
      - id: '2020'
        lifecycle: accepted
`,
			'utf-8',
		);

		const report = await seedStatutesFromManifest({ manifestPath });
		expect(report.entriesRegistered).toBe(0);
		expect(report.skipReasons.length).toBe(1);
	});

	it('is idempotent: re-running adds no new entries', async () => {
		writeFileSync(
			manifestPath,
			`statutes:
  - id: usc-49/44701
    canonical_short: 49 USC § 44701
    canonical_formal: 49 U.S.C. § 44701, General Requirements for Aviation Safety
    canonical_title: General Requirements for Aviation Safety
    editions:
      - id: '2018'
        lifecycle: accepted
`,
			'utf-8',
		);
		const first = await seedStatutesFromManifest({ manifestPath });
		expect(first.entriesRegistered).toBe(1);

		const second = await seedStatutesFromManifest({ manifestPath });
		expect(second.entriesRegistered).toBe(0);
		expect(second.entriesAlreadyAccepted).toBe(1);
	});

	it('throws when the manifest is missing', async () => {
		await expect(seedStatutesFromManifest({ manifestPath: join(tmpRoot, 'absent.yaml') })).rejects.toThrow(
			/manifest not found/,
		);
	});

	it('uses the bundled manifest by default and registers every authored entry', async () => {
		const report = await seedStatutesFromManifest();
		expect(report.entriesRegistered).toBeGreaterThan(0);
		expect(report.skipReasons).toEqual([]);
		const known = 'airboss-ref:statutes/usc-49/40103' as SourceId;
		expect(productionRegistry.hasEntry(known)).toBe(true);
	});
});
