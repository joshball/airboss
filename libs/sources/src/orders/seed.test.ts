/**
 * Phase 10 next slice -- orders manifest seed loader tests.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetRegistry } from '../registry/__test_helpers__.ts';
import { productionRegistry } from '../registry/index.ts';
import type { SourceId } from '../types.ts';
import { seedOrdersFromManifest } from './seed.ts';

let tmpRoot: string;
let manifestPath: string;

beforeEach(() => {
	tmpRoot = mkdtempSync(join(tmpdir(), 'orders-seed-'));
	manifestPath = join(tmpRoot, 'manifest.yaml');
	resetRegistry();
});

afterEach(() => {
	rmSync(tmpRoot, { recursive: true, force: true });
	resetRegistry();
});

describe('seedOrdersFromManifest', () => {
	it('registers entries from a known-good manifest', async () => {
		writeFileSync(
			manifestPath,
			`orders:
  - id: faa/2150-3
    canonical_short: FAA Order 2150.3
    canonical_formal: FAA Order 2150.3, Compliance and Enforcement Program
    canonical_title: Compliance and Enforcement Program
    editions:
      - id: '2018-04'
        lifecycle: accepted
`,
			'utf-8',
		);

		const report = await seedOrdersFromManifest({ manifestPath });
		expect(report.entriesRegistered).toBe(1);
		expect(report.editionsRegistered).toBe(1);
		expect(report.skipReasons).toEqual([]);
		expect(report.promotionBatchId).not.toBeNull();

		const id = 'airboss-ref:orders/faa/2150-3' as SourceId;
		expect(productionRegistry.hasEntry(id)).toBe(true);
		expect(productionRegistry.hasEdition(id, '2018-04')).toBe(true);

		const entry = productionRegistry.getEntry(id);
		expect(entry?.lifecycle).toBe('accepted');
		expect(entry?.canonical_short).toBe('FAA Order 2150.3');
	});

	it('rejects malformed entries with a skip reason; valid siblings still register', async () => {
		writeFileSync(
			manifestPath,
			`orders:
  - id: not-a-real-locator
    canonical_short: bad
    canonical_formal: bad
    canonical_title: bad
    editions:
      - id: '2020'
        lifecycle: accepted
  - id: faa/8260-3
    canonical_short: FAA Order 8260.3
    canonical_formal: FAA Order 8260.3, TERPS
    canonical_title: TERPS
    editions:
      - id: '2024-08'
        lifecycle: accepted
`,
			'utf-8',
		);

		const report = await seedOrdersFromManifest({ manifestPath });
		expect(report.skipReasons.length).toBe(1);
		expect(report.skipReasons[0]).toContain('not-a-real-locator');
		expect(report.entriesRegistered).toBe(1);

		const goodId = 'airboss-ref:orders/faa/8260-3' as SourceId;
		expect(productionRegistry.hasEntry(goodId)).toBe(true);
		const badId = 'airboss-ref:orders/not-a-real-locator' as SourceId;
		expect(productionRegistry.hasEntry(badId)).toBe(false);
	});

	it('is idempotent: re-running adds no new entries', async () => {
		writeFileSync(
			manifestPath,
			`orders:
  - id: faa/8900-1
    canonical_short: FAA Order 8900.1
    canonical_formal: FAA Order 8900.1, FSIMS
    canonical_title: FSIMS
    editions:
      - id: '2026'
        lifecycle: accepted
`,
			'utf-8',
		);

		const first = await seedOrdersFromManifest({ manifestPath });
		expect(first.entriesRegistered).toBe(1);

		const second = await seedOrdersFromManifest({ manifestPath });
		// Second run sees the lifecycle overlay and skips re-promoting.
		expect(second.entriesAlreadyAccepted).toBe(1);
		expect(second.entriesRegistered).toBe(0);
		expect(second.promotionBatchId).toBeNull();
	});

	it('rejects malformed edition lifecycle', async () => {
		writeFileSync(
			manifestPath,
			`orders:
  - id: faa/2150-3
    canonical_short: x
    canonical_formal: x
    canonical_title: x
    editions:
      - id: '2018-04'
        lifecycle: bogus
`,
			'utf-8',
		);

		const report = await seedOrdersFromManifest({ manifestPath });
		expect(report.entriesRegistered).toBe(0);
		expect(report.skipReasons.length).toBe(1);
		expect(report.skipReasons[0]).toContain('lifecycle');
	});

	it('throws when the manifest is missing', async () => {
		await expect(seedOrdersFromManifest({ manifestPath: join(tmpRoot, 'absent.yaml') })).rejects.toThrow(
			/manifest not found/,
		);
	});

	it('uses the bundled manifest by default and registers every authored order', async () => {
		const report = await seedOrdersFromManifest();
		expect(report.entriesRegistered).toBeGreaterThan(0);
		expect(report.skipReasons).toEqual([]);
		// Spot-check a known order in the bundled manifest.
		const known = 'airboss-ref:orders/faa/2150-3' as SourceId;
		expect(productionRegistry.hasEntry(known)).toBe(true);
	});
});
