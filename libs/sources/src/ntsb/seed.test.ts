/**
 * Phase 10 next slice -- ntsb manifest seed loader tests.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetRegistry } from '../registry/__test_helpers__.ts';
import { productionRegistry } from '../registry/index.ts';
import type { SourceId } from '../types.ts';
import { seedNtsbFromManifest } from './seed.ts';

let tmpRoot: string;
let manifestPath: string;

beforeEach(() => {
	tmpRoot = mkdtempSync(join(tmpdir(), 'ntsb-seed-'));
	manifestPath = join(tmpRoot, 'manifest.yaml');
	resetRegistry();
});

afterEach(() => {
	rmSync(tmpRoot, { recursive: true, force: true });
	resetRegistry();
});

describe('seedNtsbFromManifest', () => {
	it('returns a zero-entry report when the manifest list is empty', async () => {
		writeFileSync(manifestPath, 'ntsb: []\n', 'utf-8');
		const report = await seedNtsbFromManifest({ manifestPath });
		expect(report.entriesRegistered).toBe(0);
		expect(report.editionsRegistered).toBe(0);
		expect(report.skipReasons).toEqual([]);
		expect(report.promotionBatchId).toBeNull();
	});

	it('registers entries from a known-good manifest', async () => {
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

		const report = await seedNtsbFromManifest({ manifestPath });
		expect(report.entriesRegistered).toBe(1);
		expect(report.editionsRegistered).toBe(1);
		expect(report.skipReasons).toEqual([]);

		const id = 'airboss-ref:ntsb/WPR23LA123' as SourceId;
		expect(productionRegistry.hasEntry(id)).toBe(true);
		expect(productionRegistry.hasEdition(id, '2024-01-15')).toBe(true);

		const entry = productionRegistry.getEntry(id);
		expect(entry?.lifecycle).toBe('accepted');
		expect(entry?.canonical_short).toBe('NTSB WPR23LA123');
	});

	it('rejects malformed NTSB IDs', async () => {
		writeFileSync(
			manifestPath,
			`ntsb:
  - id: not-an-ntsb-id
    canonical_short: x
    canonical_formal: x
    canonical_title: x
    editions:
      - id: '2024-01-15'
        lifecycle: accepted
`,
			'utf-8',
		);

		const report = await seedNtsbFromManifest({ manifestPath });
		expect(report.entriesRegistered).toBe(0);
		expect(report.skipReasons.length).toBe(1);
		expect(report.skipReasons[0]).toContain('not-an-ntsb-id');
	});

	it('is idempotent: re-running adds no new entries', async () => {
		writeFileSync(
			manifestPath,
			`ntsb:
  - id: CEN24FA045
    canonical_short: NTSB CEN24FA045
    canonical_formal: NTSB Aviation Accident Report CEN24FA045
    canonical_title: NTSB Accident Report CEN24FA045
    editions:
      - id: '2024-06-10'
        lifecycle: accepted
`,
			'utf-8',
		);
		const first = await seedNtsbFromManifest({ manifestPath });
		expect(first.entriesRegistered).toBe(1);

		const second = await seedNtsbFromManifest({ manifestPath });
		expect(second.entriesRegistered).toBe(0);
		expect(second.entriesAlreadyAccepted).toBe(1);
		expect(second.promotionBatchId).toBeNull();
	});

	it('throws when the manifest is missing', async () => {
		await expect(seedNtsbFromManifest({ manifestPath: join(tmpRoot, 'absent.yaml') })).rejects.toThrow(
			/manifest not found/,
		);
	});

	it('loads the bundled manifest without error (demand-driven, may be empty)', async () => {
		const report = await seedNtsbFromManifest();
		expect(report.skipReasons).toEqual([]);
		expect(report.entriesRegistered).toBeGreaterThanOrEqual(0);
	});
});
