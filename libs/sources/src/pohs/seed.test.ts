/**
 * Phase 10 -- pohs manifest seed loader tests.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetRegistry } from '../registry/__test_helpers__.ts';
import { productionRegistry } from '../registry/index.ts';
import type { SourceId } from '../types.ts';
import { seedPohsFromManifest } from './seed.ts';

let tmpRoot: string;
let manifestPath: string;

beforeEach(() => {
	tmpRoot = mkdtempSync(join(tmpdir(), 'pohs-seed-'));
	manifestPath = join(tmpRoot, 'manifest.yaml');
	resetRegistry();
});

afterEach(() => {
	rmSync(tmpRoot, { recursive: true, force: true });
	resetRegistry();
});

describe('seedPohsFromManifest', () => {
	it('registers entries from a known-good manifest', async () => {
		writeFileSync(
			manifestPath,
			`pohs:
  - id: c172s
    canonical_short: Cessna 172S POH
    canonical_formal: Cessna 172S Pilot's Operating Handbook
    canonical_title: Cessna 172S POH
    editions:
      - id: '2020-01'
        lifecycle: accepted
`,
			'utf-8',
		);

		const report = await seedPohsFromManifest({ manifestPath });
		expect(report.entriesRegistered).toBe(1);
		expect(report.skipReasons).toEqual([]);

		const id = 'airboss-ref:pohs/c172s' as SourceId;
		expect(productionRegistry.hasEntry(id)).toBe(true);
		expect(productionRegistry.getEntry(id)?.lifecycle).toBe('accepted');
	});

	it('rejects malformed entries with a skip reason', async () => {
		writeFileSync(
			manifestPath,
			`pohs:
  - id: BAD-AIRCRAFT-SLUG-UPPERCASE
    canonical_short: bad
    canonical_formal: bad
    canonical_title: bad
    editions:
      - id: '2020'
        lifecycle: accepted
`,
			'utf-8',
		);

		const report = await seedPohsFromManifest({ manifestPath });
		expect(report.entriesRegistered).toBe(0);
		expect(report.skipReasons.length).toBe(1);
	});

	it('is idempotent: re-running adds no new entries', async () => {
		writeFileSync(
			manifestPath,
			`pohs:
  - id: sr22
    canonical_short: Cirrus SR22 POH
    canonical_formal: Cirrus SR22 Pilot's Operating Handbook
    canonical_title: Cirrus SR22 POH
    editions:
      - id: '2022-03'
        lifecycle: accepted
`,
			'utf-8',
		);
		const first = await seedPohsFromManifest({ manifestPath });
		expect(first.entriesRegistered).toBe(1);

		const second = await seedPohsFromManifest({ manifestPath });
		expect(second.entriesRegistered).toBe(0);
		expect(second.entriesAlreadyAccepted).toBe(1);
	});

	it('throws when the manifest is missing', async () => {
		await expect(seedPohsFromManifest({ manifestPath: join(tmpRoot, 'absent.yaml') })).rejects.toThrow(
			/manifest not found/,
		);
	});

	it('uses the bundled manifest by default and registers every authored entry', async () => {
		const report = await seedPohsFromManifest();
		expect(report.entriesRegistered).toBeGreaterThan(0);
		expect(report.skipReasons).toEqual([]);
		const known = 'airboss-ref:pohs/c172s' as SourceId;
		expect(productionRegistry.hasEntry(known)).toBe(true);
	});
});
