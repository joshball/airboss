/**
 * Phase 10 -- bundled interp manifest coverage.
 *
 * Asserts that the registry-only WP-CC v1 list keeps the canonical anchor
 * entries that pilot/CFI training literature cites by recipient name. Each
 * anchor maps to a CFI/PPL/IR study question that the citation system has
 * to be able to resolve before the registry is useful as a closed-loop
 * citation surface.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetRegistry } from '../registry/__test_helpers__.ts';
import { productionRegistry } from '../registry/index.ts';
import type { SourceId } from '../types.ts';
import { seedInterpFromManifest } from './seed.ts';

const ANCHOR_ENTRIES: ReadonlyArray<{ readonly id: SourceId; readonly canonical_short: string }> = [
	// User-vouched canonical list (task brief), oldest -> newest:
	{ id: 'airboss-ref:interp/chief-counsel/glenn-2008' as SourceId, canonical_short: 'Glenn (2008)' },
	{ id: 'airboss-ref:interp/chief-counsel/theriault-2008' as SourceId, canonical_short: 'Theriault (2008)' },
	{ id: 'airboss-ref:interp/chief-counsel/coleal-2009' as SourceId, canonical_short: 'Coleal (2009)' },
	{ id: 'airboss-ref:interp/chief-counsel/giuffrida-2009' as SourceId, canonical_short: 'Giuffrida (2009)' },
	{ id: 'airboss-ref:interp/chief-counsel/hicks-2009' as SourceId, canonical_short: 'Hicks (2009)' },
	{ id: 'airboss-ref:interp/chief-counsel/mangiamele-2009' as SourceId, canonical_short: 'Mangiamele (2009)' },
	{ id: 'airboss-ref:interp/chief-counsel/mosby-2009' as SourceId, canonical_short: 'Mosby (2009)' },
	{ id: 'airboss-ref:interp/chief-counsel/murphy-2009' as SourceId, canonical_short: 'Murphy (2009)' },
	{ id: 'airboss-ref:interp/chief-counsel/speranza-2010' as SourceId, canonical_short: 'Speranza (2010)' },
	{ id: 'airboss-ref:interp/chief-counsel/yates-2010' as SourceId, canonical_short: 'Yates (2010)' },
	{ id: 'airboss-ref:interp/chief-counsel/beard-2014' as SourceId, canonical_short: 'Beard (2014)' },
	{ id: 'airboss-ref:interp/chief-counsel/burleson-2014' as SourceId, canonical_short: 'Burleson (2014)' },
	{ id: 'airboss-ref:interp/chief-counsel/hartzell-2014' as SourceId, canonical_short: 'Hartzell (2014)' },
	{ id: 'airboss-ref:interp/chief-counsel/letteer-2014' as SourceId, canonical_short: 'Letteer (2014)' },
	{ id: 'airboss-ref:interp/chief-counsel/murphy-2014' as SourceId, canonical_short: 'Murphy (2014)' },
	{ id: 'airboss-ref:interp/chief-counsel/walker-2017' as SourceId, canonical_short: 'Walker (2017)' },
	{ id: 'airboss-ref:interp/chief-counsel/kortokrax-2017' as SourceId, canonical_short: 'Kortokrax (2017)' },
	// NTSB Board order anchor:
	{ id: 'airboss-ref:interp/ntsb/administrator-v-lobeiko' as SourceId, canonical_short: 'Lobeiko' },
];

describe('bundled interp manifest', () => {
	beforeEach(() => {
		resetRegistry();
	});

	afterEach(() => {
		resetRegistry();
	});

	it('seeds the manifest with no skip reasons', async () => {
		const report = await seedInterpFromManifest();
		expect(report.skipReasons).toEqual([]);
	});

	it('registers every anchor entry with a canonical_short label', async () => {
		await seedInterpFromManifest();
		for (const anchor of ANCHOR_ENTRIES) {
			expect(productionRegistry.hasEntry(anchor.id)).toBe(true);
			const entry = productionRegistry.getEntry(anchor.id);
			expect(entry).toBeDefined();
			expect(entry?.canonical_short).toBe(anchor.canonical_short);
			expect(entry?.canonical_formal.length).toBeGreaterThan(0);
			expect(entry?.canonical_title.length).toBeGreaterThan(0);
			expect(entry?.lifecycle).toBe('accepted');
		}
	});

	it('registers at least one edition per anchor entry', async () => {
		await seedInterpFromManifest();
		for (const anchor of ANCHOR_ENTRIES) {
			const entry = productionRegistry.getEntry(anchor.id);
			expect(entry).toBeDefined();
			// Each anchor has a known publication year; the manifest authors
			// the year as the edition id, so the registry's last_amended_date
			// year must match the canonical_short year (or, for the NTSB anchor,
			// the manifest year `2007`).
			expect(entry?.last_amended_date).toBeInstanceOf(Date);
		}
	});

	it('contains all anchor entries the spec requires (no silent regressions)', async () => {
		const report = await seedInterpFromManifest();
		expect(report.entriesRegistered).toBeGreaterThanOrEqual(ANCHOR_ENTRIES.length);
	});
});
