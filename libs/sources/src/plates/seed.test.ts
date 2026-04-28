/**
 * Phase 10 -- plates manifest seed loader tests.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetRegistry } from '../registry/__test_helpers__.ts';
import { productionRegistry } from '../registry/index.ts';
import type { SourceId } from '../types.ts';
import { seedPlatesFromManifest } from './seed.ts';

let tmpRoot: string;
let manifestPath: string;

beforeEach(() => {
	tmpRoot = mkdtempSync(join(tmpdir(), 'plates-seed-'));
	manifestPath = join(tmpRoot, 'manifest.yaml');
	resetRegistry();
});

afterEach(() => {
	rmSync(tmpRoot, { recursive: true, force: true });
	resetRegistry();
});

describe('seedPlatesFromManifest', () => {
	it('registers entries from a known-good manifest', async () => {
		writeFileSync(
			manifestPath,
			`plates:
  - id: KAPA/ils-rwy-35R
    canonical_short: KAPA ILS RWY 35R
    canonical_formal: Centennial Airport (KAPA) ILS or LOC RWY 35R
    canonical_title: KAPA ILS RWY 35R
    editions:
      - id: '2026-03-19'
        lifecycle: accepted
`,
			'utf-8',
		);

		const report = await seedPlatesFromManifest({ manifestPath });
		expect(report.entriesRegistered).toBe(1);
		expect(report.skipReasons).toEqual([]);

		const id = 'airboss-ref:plates/KAPA/ils-rwy-35R' as SourceId;
		expect(productionRegistry.hasEntry(id)).toBe(true);
		expect(productionRegistry.getEntry(id)?.lifecycle).toBe('accepted');
	});

	it('rejects malformed entries with a skip reason', async () => {
		writeFileSync(
			manifestPath,
			`plates:
  - id: 'lowercase-airport/foo'
    canonical_short: bad
    canonical_formal: bad
    canonical_title: bad
    editions:
      - id: '2020'
        lifecycle: accepted
`,
			'utf-8',
		);

		const report = await seedPlatesFromManifest({ manifestPath });
		expect(report.entriesRegistered).toBe(0);
		expect(report.skipReasons.length).toBe(1);
	});

	it('is idempotent: re-running adds no new entries', async () => {
		writeFileSync(
			manifestPath,
			`plates:
  - id: KSFO/ils-rwy-28R
    canonical_short: KSFO ILS RWY 28R
    canonical_formal: San Francisco International (KSFO) ILS or LOC RWY 28R
    canonical_title: KSFO ILS RWY 28R
    editions:
      - id: '2026-03-19'
        lifecycle: accepted
`,
			'utf-8',
		);
		const first = await seedPlatesFromManifest({ manifestPath });
		expect(first.entriesRegistered).toBe(1);

		const second = await seedPlatesFromManifest({ manifestPath });
		expect(second.entriesRegistered).toBe(0);
		expect(second.entriesAlreadyAccepted).toBe(1);
	});

	it('throws when the manifest is missing', async () => {
		await expect(seedPlatesFromManifest({ manifestPath: join(tmpRoot, 'absent.yaml') })).rejects.toThrow(
			/manifest not found/,
		);
	});

	it('uses the bundled manifest by default and registers every authored entry', async () => {
		const report = await seedPlatesFromManifest();
		expect(report.entriesRegistered).toBeGreaterThan(0);
		expect(report.skipReasons).toEqual([]);
		const known = 'airboss-ref:plates/KAPA/ils-rwy-35R' as SourceId;
		expect(productionRegistry.hasEntry(known)).toBe(true);
	});
});
