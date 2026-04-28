/**
 * Phase 10 -- asrs manifest seed loader tests.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetRegistry } from '../registry/__test_helpers__.ts';
import { productionRegistry } from '../registry/index.ts';
import type { SourceId } from '../types.ts';
import { seedAsrsFromManifest } from './seed.ts';

let tmpRoot: string;
let manifestPath: string;

beforeEach(() => {
	tmpRoot = mkdtempSync(join(tmpdir(), 'asrs-seed-'));
	manifestPath = join(tmpRoot, 'manifest.yaml');
	resetRegistry();
});

afterEach(() => {
	rmSync(tmpRoot, { recursive: true, force: true });
	resetRegistry();
});

describe('seedAsrsFromManifest', () => {
	it('returns a zero-entry report when the manifest list is empty', async () => {
		writeFileSync(manifestPath, 'asrs: []\n', 'utf-8');
		const report = await seedAsrsFromManifest({ manifestPath });
		expect(report.entriesRegistered).toBe(0);
		expect(report.editionsRegistered).toBe(0);
		expect(report.skipReasons).toEqual([]);
		expect(report.promotionBatchId).toBeNull();
	});

	it('registers entries from a known-good manifest', async () => {
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
`,
			'utf-8',
		);

		const report = await seedAsrsFromManifest({ manifestPath });
		expect(report.entriesRegistered).toBe(1);
		expect(report.skipReasons).toEqual([]);

		const id = 'airboss-ref:asrs/1234567' as SourceId;
		expect(productionRegistry.hasEntry(id)).toBe(true);
	});

	it('rejects malformed ACNs', async () => {
		writeFileSync(
			manifestPath,
			`asrs:
  - id: 'not-an-acn'
    canonical_short: x
    canonical_formal: x
    canonical_title: x
    editions:
      - id: '2024-05-01'
        lifecycle: accepted
`,
			'utf-8',
		);

		const report = await seedAsrsFromManifest({ manifestPath });
		expect(report.entriesRegistered).toBe(0);
		expect(report.skipReasons.length).toBe(1);
	});

	it('throws when the manifest is missing', async () => {
		await expect(seedAsrsFromManifest({ manifestPath: join(tmpRoot, 'absent.yaml') })).rejects.toThrow(
			/manifest not found/,
		);
	});

	it('loads the bundled manifest without error (demand-driven, may be empty)', async () => {
		const report = await seedAsrsFromManifest();
		expect(report.skipReasons).toEqual([]);
		expect(report.entriesRegistered).toBeGreaterThanOrEqual(0);
	});
});
