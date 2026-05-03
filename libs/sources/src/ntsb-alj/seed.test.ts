/**
 * NTSB-ALJ manifest seed loader tests.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetRegistry } from '../registry/__test_helpers__.ts';
import { productionRegistry } from '../registry/index.ts';
import type { SourceId } from '../types.ts';
import { seedNtsbAljFromManifest } from './seed.ts';

let tmpRoot: string;
let manifestPath: string;

beforeEach(() => {
	tmpRoot = mkdtempSync(join(tmpdir(), 'ntsb-alj-seed-'));
	manifestPath = join(tmpRoot, 'manifest.yaml');
	resetRegistry();
});

afterEach(() => {
	rmSync(tmpRoot, { recursive: true, force: true });
	resetRegistry();
});

describe('seedNtsbAljFromManifest', () => {
	it('registers entries from a known-good manifest', async () => {
		writeFileSync(
			manifestPath,
			`ntsb-alj:
  - id: ea-5567
    canonical_short: EA-5567
    canonical_formal: NTSB Order EA-5567
    canonical_title: NTSB Administrative Law Judge Ruling EA-5567
    editions:
      - id: '2011'
        lifecycle: accepted
`,
			'utf-8',
		);

		const report = await seedNtsbAljFromManifest({ manifestPath });
		expect(report.entriesRegistered).toBe(1);
		expect(report.skipReasons).toEqual([]);

		const id = 'airboss-ref:ntsb-alj/ea-5567' as SourceId;
		expect(productionRegistry.hasEntry(id)).toBe(true);
		expect(productionRegistry.getEntry(id)?.lifecycle).toBe('accepted');
	});

	it('rejects malformed entries with a skip reason', async () => {
		writeFileSync(
			manifestPath,
			`ntsb-alj:
  - id: xy-1234
    canonical_short: bad
    canonical_formal: bad
    canonical_title: bad
    editions:
      - id: '2020'
        lifecycle: accepted
`,
			'utf-8',
		);

		const report = await seedNtsbAljFromManifest({ manifestPath });
		expect(report.entriesRegistered).toBe(0);
		expect(report.skipReasons.length).toBe(1);
		expect(report.skipReasons[0]).toContain('locator parse');
	});

	it('rejects entries missing canonical fields', async () => {
		writeFileSync(
			manifestPath,
			`ntsb-alj:
  - id: ea-5567
    editions:
      - id: '2011'
        lifecycle: accepted
`,
			'utf-8',
		);

		const report = await seedNtsbAljFromManifest({ manifestPath });
		expect(report.entriesRegistered).toBe(0);
		expect(report.skipReasons.length).toBe(1);
		expect(report.skipReasons[0]).toContain('canonical_short');
	});

	it('is idempotent: re-running adds no new entries', async () => {
		writeFileSync(
			manifestPath,
			`ntsb-alj:
  - id: ea-5704
    canonical_short: EA-5704
    canonical_formal: NTSB Order EA-5704
    canonical_title: NTSB Administrative Law Judge Ruling EA-5704
    editions:
      - id: '2014'
        lifecycle: accepted
`,
			'utf-8',
		);

		const first = await seedNtsbAljFromManifest({ manifestPath });
		expect(first.entriesRegistered).toBe(1);

		const second = await seedNtsbAljFromManifest({ manifestPath });
		expect(second.entriesRegistered).toBe(0);
		expect(second.entriesAlreadyAccepted).toBe(1);
	});

	it('throws when the manifest is missing', async () => {
		await expect(seedNtsbAljFromManifest({ manifestPath: join(tmpRoot, 'absent.yaml') })).rejects.toThrow(
			/manifest not found/,
		);
	});

	it('throws when the manifest top-level key is missing', async () => {
		writeFileSync(manifestPath, 'something-else: []\n', 'utf-8');
		await expect(seedNtsbAljFromManifest({ manifestPath })).rejects.toThrow(/ntsb-alj:/);
	});

	it('uses the bundled manifest by default and registers every authored entry', async () => {
		const report = await seedNtsbAljFromManifest();
		expect(report.entriesRegistered).toBeGreaterThan(0);
		expect(report.skipReasons).toEqual([]);
		const known = 'airboss-ref:ntsb-alj/ea-5567' as SourceId;
		expect(productionRegistry.hasEntry(known)).toBe(true);
	});
});
