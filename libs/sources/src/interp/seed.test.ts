/**
 * Phase 10 -- interp manifest seed loader tests.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetRegistry } from '../registry/__test_helpers__.ts';
import { productionRegistry } from '../registry/index.ts';
import type { SourceId } from '../types.ts';
import { seedInterpFromManifest } from './seed.ts';

let tmpRoot: string;
let manifestPath: string;

beforeEach(() => {
	tmpRoot = mkdtempSync(join(tmpdir(), 'interp-seed-'));
	manifestPath = join(tmpRoot, 'manifest.yaml');
	resetRegistry();
});

afterEach(() => {
	rmSync(tmpRoot, { recursive: true, force: true });
	resetRegistry();
});

describe('seedInterpFromManifest', () => {
	it('registers entries from a known-good manifest', async () => {
		writeFileSync(
			manifestPath,
			`interp:
  - id: chief-counsel/mangiamele-2009
    canonical_short: Mangiamele (2009)
    canonical_formal: FAA Chief Counsel Interpretation, Mangiamele (2009)
    canonical_title: Mangiamele -- Compensation or Hire
    editions:
      - id: '2009'
        lifecycle: accepted
`,
			'utf-8',
		);

		const report = await seedInterpFromManifest({ manifestPath });
		expect(report.entriesRegistered).toBe(1);
		expect(report.editionsRegistered).toBe(1);
		expect(report.skipReasons).toEqual([]);
		expect(report.promotionBatchId).not.toBeNull();

		const id = 'airboss-ref:interp/chief-counsel/mangiamele-2009' as SourceId;
		expect(productionRegistry.hasEntry(id)).toBe(true);
		expect(productionRegistry.hasEdition(id, '2009')).toBe(true);

		const entry = productionRegistry.getEntry(id);
		expect(entry?.lifecycle).toBe('accepted');
		expect(entry?.canonical_short).toBe('Mangiamele (2009)');
	});

	it('rejects malformed entries with a skip reason; valid siblings still register', async () => {
		writeFileSync(
			manifestPath,
			`interp:
  - id: not-a-real-locator
    canonical_short: bad
    canonical_formal: bad
    canonical_title: bad
    editions:
      - id: '2020'
        lifecycle: accepted
  - id: chief-counsel/walker-2017
    canonical_short: Walker (2017)
    canonical_formal: FAA Chief Counsel Interpretation, Walker (2017)
    canonical_title: Walker
    editions:
      - id: '2017'
        lifecycle: accepted
`,
			'utf-8',
		);

		const report = await seedInterpFromManifest({ manifestPath });
		expect(report.skipReasons.length).toBe(1);
		expect(report.skipReasons[0]).toContain('not-a-real-locator');
		expect(report.entriesRegistered).toBe(1);

		const goodId = 'airboss-ref:interp/chief-counsel/walker-2017' as SourceId;
		expect(productionRegistry.hasEntry(goodId)).toBe(true);
	});

	it('is idempotent: re-running adds no new entries', async () => {
		writeFileSync(
			manifestPath,
			`interp:
  - id: chief-counsel/hicks-2009
    canonical_short: Hicks (2009)
    canonical_formal: FAA Chief Counsel Interpretation, Hicks (2009)
    canonical_title: Hicks -- Flight Review Applicability
    editions:
      - id: '2009'
        lifecycle: accepted
`,
			'utf-8',
		);
		const first = await seedInterpFromManifest({ manifestPath });
		expect(first.entriesRegistered).toBe(1);

		const second = await seedInterpFromManifest({ manifestPath });
		expect(second.entriesRegistered).toBe(0);
		expect(second.entriesAlreadyAccepted).toBe(1);
		expect(second.promotionBatchId).toBeNull();
	});

	it('throws when the manifest is missing', async () => {
		await expect(seedInterpFromManifest({ manifestPath: join(tmpRoot, 'absent.yaml') })).rejects.toThrow(
			/manifest not found/,
		);
	});

	it('uses the bundled manifest by default and registers every authored entry', async () => {
		const report = await seedInterpFromManifest();
		expect(report.entriesRegistered).toBeGreaterThan(0);
		expect(report.skipReasons).toEqual([]);
		const known = 'airboss-ref:interp/chief-counsel/mangiamele-2009' as SourceId;
		expect(productionRegistry.hasEntry(known)).toBe(true);
	});
});
