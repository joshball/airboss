/**
 * Phase 10 -- sectionals manifest seed loader tests.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetRegistry } from '../registry/__test_helpers__.ts';
import { productionRegistry } from '../registry/index.ts';
import type { SourceId } from '../types.ts';
import { seedSectionalsFromManifest } from './seed.ts';

let tmpRoot: string;
let manifestPath: string;

beforeEach(() => {
	tmpRoot = mkdtempSync(join(tmpdir(), 'sectionals-seed-'));
	manifestPath = join(tmpRoot, 'manifest.yaml');
	resetRegistry();
});

afterEach(() => {
	rmSync(tmpRoot, { recursive: true, force: true });
	resetRegistry();
});

describe('seedSectionalsFromManifest', () => {
	it('registers entries from a known-good manifest', async () => {
		writeFileSync(
			manifestPath,
			`sectionals:
  - id: denver
    canonical_short: Denver Sectional
    canonical_formal: Denver VFR Sectional Chart
    canonical_title: Denver VFR Sectional
    editions:
      - id: '2026-03-19'
        lifecycle: accepted
`,
			'utf-8',
		);

		const report = await seedSectionalsFromManifest({ manifestPath });
		expect(report.entriesRegistered).toBe(1);
		expect(report.skipReasons).toEqual([]);

		const id = 'airboss-ref:sectionals/denver' as SourceId;
		expect(productionRegistry.hasEntry(id)).toBe(true);
		expect(productionRegistry.getEntry(id)?.lifecycle).toBe('accepted');
	});

	it('rejects malformed entries with a skip reason', async () => {
		writeFileSync(
			manifestPath,
			`sectionals:
  - id: 'BAD UPPERCASE'
    canonical_short: bad
    canonical_formal: bad
    canonical_title: bad
    editions:
      - id: '2020'
        lifecycle: accepted
`,
			'utf-8',
		);

		const report = await seedSectionalsFromManifest({ manifestPath });
		expect(report.entriesRegistered).toBe(0);
		expect(report.skipReasons.length).toBe(1);
	});

	it('is idempotent: re-running adds no new entries', async () => {
		writeFileSync(
			manifestPath,
			`sectionals:
  - id: seattle
    canonical_short: Seattle Sectional
    canonical_formal: Seattle VFR Sectional Chart
    canonical_title: Seattle VFR Sectional
    editions:
      - id: '2026-03-19'
        lifecycle: accepted
`,
			'utf-8',
		);
		const first = await seedSectionalsFromManifest({ manifestPath });
		expect(first.entriesRegistered).toBe(1);

		const second = await seedSectionalsFromManifest({ manifestPath });
		expect(second.entriesRegistered).toBe(0);
		expect(second.entriesAlreadyAccepted).toBe(1);
	});

	it('throws when the manifest is missing', async () => {
		await expect(seedSectionalsFromManifest({ manifestPath: join(tmpRoot, 'absent.yaml') })).rejects.toThrow(
			/manifest not found/,
		);
	});

	it('uses the bundled manifest by default and registers every authored entry', async () => {
		const report = await seedSectionalsFromManifest();
		expect(report.entriesRegistered).toBeGreaterThan(0);
		expect(report.skipReasons).toEqual([]);
		const known = 'airboss-ref:sectionals/denver' as SourceId;
		expect(productionRegistry.hasEntry(known)).toBe(true);
	});
});
