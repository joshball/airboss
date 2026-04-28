/**
 * Phase 10 -- tcds manifest seed loader tests.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetRegistry } from '../registry/__test_helpers__.ts';
import { productionRegistry } from '../registry/index.ts';
import type { SourceId } from '../types.ts';
import { seedTcdsFromManifest } from './seed.ts';

let tmpRoot: string;
let manifestPath: string;

beforeEach(() => {
	tmpRoot = mkdtempSync(join(tmpdir(), 'tcds-seed-'));
	manifestPath = join(tmpRoot, 'manifest.yaml');
	resetRegistry();
});

afterEach(() => {
	rmSync(tmpRoot, { recursive: true, force: true });
	resetRegistry();
});

describe('seedTcdsFromManifest', () => {
	it('registers entries from a known-good manifest', async () => {
		writeFileSync(
			manifestPath,
			`tcds:
  - id: 3a12
    canonical_short: TCDS 3A12
    canonical_formal: FAA Type Certificate Data Sheet 3A12 (Cessna 172)
    canonical_title: TCDS 3A12 (Cessna 172)
    editions:
      - id: '2020'
        lifecycle: accepted
`,
			'utf-8',
		);

		const report = await seedTcdsFromManifest({ manifestPath });
		expect(report.entriesRegistered).toBe(1);
		expect(report.skipReasons).toEqual([]);

		const id = 'airboss-ref:tcds/3a12' as SourceId;
		expect(productionRegistry.hasEntry(id)).toBe(true);
		expect(productionRegistry.getEntry(id)?.lifecycle).toBe('accepted');
	});

	it('rejects malformed entries with a skip reason', async () => {
		writeFileSync(
			manifestPath,
			`tcds:
  - id: '!!!'
    canonical_short: bad
    canonical_formal: bad
    canonical_title: bad
    editions:
      - id: '2020'
        lifecycle: accepted
`,
			'utf-8',
		);

		const report = await seedTcdsFromManifest({ manifestPath });
		expect(report.entriesRegistered).toBe(0);
		expect(report.skipReasons.length).toBe(1);
	});

	it('is idempotent: re-running adds no new entries', async () => {
		writeFileSync(
			manifestPath,
			`tcds:
  - id: a4ce
    canonical_short: TCDS A4CE
    canonical_formal: FAA Type Certificate Data Sheet A4CE (Diamond DA40)
    canonical_title: TCDS A4CE (Diamond DA40)
    editions:
      - id: '2021'
        lifecycle: accepted
`,
			'utf-8',
		);
		const first = await seedTcdsFromManifest({ manifestPath });
		expect(first.entriesRegistered).toBe(1);

		const second = await seedTcdsFromManifest({ manifestPath });
		expect(second.entriesRegistered).toBe(0);
		expect(second.entriesAlreadyAccepted).toBe(1);
	});

	it('throws when the manifest is missing', async () => {
		await expect(seedTcdsFromManifest({ manifestPath: join(tmpRoot, 'absent.yaml') })).rejects.toThrow(
			/manifest not found/,
		);
	});

	it('uses the bundled manifest by default and registers every authored entry', async () => {
		const report = await seedTcdsFromManifest();
		expect(report.entriesRegistered).toBeGreaterThan(0);
		expect(report.skipReasons).toEqual([]);
		const known = 'airboss-ref:tcds/3a12' as SourceId;
		expect(productionRegistry.hasEntry(known)).toBe(true);
	});
});
