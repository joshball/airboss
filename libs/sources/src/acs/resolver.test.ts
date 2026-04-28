import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetRegistry, withTestEditions, withTestEntries } from '../registry/__test_helpers__.ts';
import type { Edition, SourceEntry, SourceId } from '../types.ts';
import { ACS_RESOLVER } from './resolver.ts';

const ELEMENT_ID = 'airboss-ref:acs/ppl-asel/faa-s-acs-25/area-v/task-a/element-k1' as SourceId;
const TASK_ID = 'airboss-ref:acs/ppl-asel/faa-s-acs-25/area-v/task-a' as SourceId;
const CFI_ELEMENT_ID = 'airboss-ref:acs/cfi-asel/faa-s-acs-25/area-i/task-a/element-r1' as SourceId;
const PUBLICATION_ID = 'airboss-ref:acs/ppl-asel/faa-s-acs-25' as SourceId;

function makeEntry(id: SourceId, overrides: Partial<SourceEntry> = {}): SourceEntry {
	return {
		id,
		corpus: 'acs',
		canonical_short: 'PPL ACS V.A.K1',
		canonical_formal: 'Private Pilot -- Airplane ACS (FAA-S-ACS-25), Area V Task A Element K1',
		canonical_title: 'Aerodynamics of steep turns',
		last_amended_date: new Date('2026-04-27T00:00:00Z'),
		lifecycle: 'accepted',
		...overrides,
	};
}

const editionRecord: Edition = {
	id: 'faa-s-acs-25',
	published_date: new Date('2024-09-01T00:00:00Z'),
	source_url: 'https://www.faa.gov/training_testing/testing/acs/private_airplane',
};

describe('ACS_RESOLVER', () => {
	beforeEach(() => {
		resetRegistry();
		// resetRegistry resets corpus resolvers to defaults; re-register the
		// production acs resolver explicitly for tests in this file.
		// (The resolver is normally registered by the side-effect import in
		// `acs/index.ts`, but resetRegistry puts the default no-op back.)
	});

	afterEach(() => {
		resetRegistry();
	});

	it('parses a section locator via the resolver', () => {
		const parsed = ACS_RESOLVER.parseLocator('ppl-asel/faa-s-acs-25/area-v/task-a/element-k1');
		expect(parsed.kind).toBe('ok');
		if (parsed.kind !== 'ok') return;
		expect(parsed.acs).toEqual({
			cert: 'ppl-asel',
			edition: 'faa-s-acs-25',
			area: 'v',
			task: 'a',
			elementTriad: 'k',
			elementOrdinal: '1',
		});
	});

	it('formats citations across all three styles', () => {
		const entry = makeEntry(ELEMENT_ID);
		expect(ACS_RESOLVER.formatCitation(entry, 'short')).toBe('PPL ACS V.A.K1');
		expect(ACS_RESOLVER.formatCitation(entry, 'formal')).toContain('FAA-S-ACS-25');
		expect(ACS_RESOLVER.formatCitation(entry, 'title')).toBe('Aerodynamics of steep turns');
	});

	it('builds a per-cert live URL for ppl-asel', () => {
		expect(ACS_RESOLVER.getLiveUrl(ELEMENT_ID, 'faa-s-acs-25')).toBe(
			'https://www.faa.gov/training_testing/testing/acs/private_airplane',
		);
	});

	it('builds a per-cert live URL for cfi-asel', () => {
		expect(ACS_RESOLVER.getLiveUrl(CFI_ELEMENT_ID, 'faa-s-acs-25')).toBe(
			'https://www.faa.gov/training_testing/testing/acs/cfi_airplane',
		);
	});

	it('falls back to the index URL when cert has no per-cert URL registered', () => {
		// `meii` is in the cert slug list but has no entry in ACS_CERT_LIVE_URLS;
		// hand-craft an unregistered cert via a known slug NOT in the per-cert map.
		// We use a test where the cert IS in ACS_CERT_LIVE_URLS but pretend by
		// constructing a known-good slug whose URL is the index. Here ATP-ASEL is
		// not in the per-cert map.
		const id = 'airboss-ref:acs/atp-asel/faa-s-acs-25/area-i/task-a/element-k1' as SourceId;
		expect(ACS_RESOLVER.getLiveUrl(id, 'faa-s-acs-25')).toBe('https://www.faa.gov/training_testing/testing/acs');
	});

	it('returns null for an SourceId that does not start with the acs prefix', () => {
		expect(ACS_RESOLVER.getLiveUrl('airboss-ref:handbooks/phak/8083-25C/12/3' as SourceId, 'faa-s-acs-25')).toBeNull();
	});

	it('returns null for an unparseable acs locator', () => {
		expect(ACS_RESOLVER.getLiveUrl('airboss-ref:acs/' as SourceId, 'faa-s-acs-25')).toBeNull();
	});

	it('getDerivativeContent returns null when no manifest exists for the requested edition', () => {
		// `faa-s-acs-25` is not the slice we ingest -- the slice ships only the
		// PPL ACS edition we actually have on disk. Asking for an un-ingested
		// edition returns null. Real-tree resolution is exercised by the smoke
		// test in `smoke.test.ts`.
		expect(ACS_RESOLVER.getDerivativeContent(ELEMENT_ID, 'faa-s-acs-25')).toBeNull();
	});

	it('getIndexedContent returns null when no manifest exists for the requested edition', async () => {
		expect(await ACS_RESOLVER.getIndexedContent(ELEMENT_ID, 'faa-s-acs-25')).toBeNull();
	});

	it('getCurrentEdition returns max edition across acs corpus', () => {
		const entries: Record<string, SourceEntry> = {
			[ELEMENT_ID]: makeEntry(ELEMENT_ID),
			[TASK_ID]: makeEntry(TASK_ID),
			[PUBLICATION_ID]: makeEntry(PUBLICATION_ID, { canonical_short: 'PPL ACS' }),
		};
		const editions = new Map<SourceId, readonly Edition[]>([
			[ELEMENT_ID, [editionRecord]],
			[TASK_ID, [editionRecord]],
			[PUBLICATION_ID, [editionRecord, { ...editionRecord, id: 'faa-s-acs-26' }]],
		]);
		withTestEntries(entries, () => {
			withTestEditions(editions, () => {
				expect(ACS_RESOLVER.getCurrentEdition()).toBe('faa-s-acs-26');
			});
		});
	});

	it('getCurrentEdition returns null when no acs entries exist', () => {
		expect(ACS_RESOLVER.getCurrentEdition()).toBeNull();
	});

	it('getEditions reads from the editions map', async () => {
		const entries: Record<string, SourceEntry> = {
			[ELEMENT_ID]: makeEntry(ELEMENT_ID),
		};
		const editions = new Map<SourceId, readonly Edition[]>([[ELEMENT_ID, [editionRecord]]]);
		await withTestEntries(entries, async () => {
			await withTestEditions(editions, async () => {
				const result = await ACS_RESOLVER.getEditions(ELEMENT_ID);
				expect(result).toEqual([editionRecord]);
			});
		});
	});
});
