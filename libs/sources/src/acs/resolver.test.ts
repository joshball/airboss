import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetRegistry, withTestEditions, withTestEntries } from '../registry/__test_helpers__.ts';
import type { Edition, SourceEntry, SourceId } from '../types.ts';
import { ACS_RESOLVER } from './resolver.ts';

const ELEMENT_ID = 'airboss-ref:acs/ppl-airplane-6c/area-05/task-a/elem-k01' as SourceId;
const TASK_ID = 'airboss-ref:acs/ppl-airplane-6c/area-05/task-a' as SourceId;
const CFI_ELEMENT_ID = 'airboss-ref:acs/cfi-airplane-25/area-01/task-a/elem-r01' as SourceId;
const PUBLICATION_ID = 'airboss-ref:acs/ppl-airplane-6c' as SourceId;

function makeEntry(id: SourceId, overrides: Partial<SourceEntry> = {}): SourceEntry {
	return {
		id,
		corpus: 'acs',
		canonical_short: 'PPL ACS V.A.K1',
		canonical_formal: 'Private Pilot -- Airplane ACS (FAA-S-ACS-6C), Area V Task A Element K1',
		canonical_title: 'Aerodynamics of steep turns',
		last_amended_date: new Date('2026-04-27T00:00:00Z'),
		lifecycle: 'accepted',
		...overrides,
	};
}

const editionRecord: Edition = {
	id: 'ppl-airplane-6c',
	published_date: new Date('2023-11-01T00:00:00Z'),
	source_url: 'https://www.faa.gov/training_testing/testing/acs/private_airplane_acs_6.pdf',
};

describe('ACS_RESOLVER', () => {
	beforeEach(() => {
		resetRegistry();
	});

	afterEach(() => {
		resetRegistry();
	});

	it('parses an element locator via the resolver', () => {
		const parsed = ACS_RESOLVER.parseLocator('ppl-airplane-6c/area-05/task-a/elem-k01');
		expect(parsed.kind).toBe('ok');
		if (parsed.kind !== 'ok') return;
		expect(parsed.acs).toEqual({
			slug: 'ppl-airplane-6c',
			area: '05',
			task: 'a',
			elementTriad: 'k',
			elementOrdinal: '01',
		});
	});

	it('formats citations across all three styles', () => {
		const entry = makeEntry(ELEMENT_ID);
		expect(ACS_RESOLVER.formatCitation(entry, 'short')).toBe('PPL ACS V.A.K1');
		expect(ACS_RESOLVER.formatCitation(entry, 'formal')).toContain('FAA-S-ACS-6C');
		expect(ACS_RESOLVER.formatCitation(entry, 'title')).toBe('Aerodynamics of steep turns');
	});

	it('builds a per-publication live URL for ppl-airplane-6c', () => {
		expect(ACS_RESOLVER.getLiveUrl(ELEMENT_ID, 'ppl-airplane-6c')).toBe(
			'https://www.faa.gov/training_testing/testing/acs/private_airplane_acs_6.pdf',
		);
	});

	it('builds a per-publication live URL for cfi-airplane-25', () => {
		expect(ACS_RESOLVER.getLiveUrl(CFI_ELEMENT_ID, 'cfi-airplane-25')).toBe(
			'https://www.faa.gov/training_testing/testing/acs/cfi_airplane_acs_25.pdf',
		);
	});

	it('returns null for a SourceId that does not start with the acs prefix', () => {
		expect(
			ACS_RESOLVER.getLiveUrl('airboss-ref:handbooks/phak/8083-25C/12/3' as SourceId, 'ppl-airplane-6c'),
		).toBeNull();
	});

	it('returns null for an unparseable acs locator', () => {
		expect(ACS_RESOLVER.getLiveUrl('airboss-ref:acs/' as SourceId, 'ppl-airplane-6c')).toBeNull();
	});

	it('getDerivativeContent returns null when no manifest exists for the requested slug', () => {
		// `cfi-airplane-25` is not the slice we ingest at this seed layer -- the
		// slice ships only the PPL publication we actually have on disk. Asking
		// for a SourceId carrying an un-ingested slug returns null. Real-tree
		// resolution is exercised by the smoke test in `smoke.test.ts`.
		expect(ACS_RESOLVER.getDerivativeContent(CFI_ELEMENT_ID, 'cfi-airplane-25')).toBeNull();
	});

	it('getIndexedContent returns null when no manifest exists for the requested slug', async () => {
		expect(await ACS_RESOLVER.getIndexedContent(CFI_ELEMENT_ID, 'cfi-airplane-25')).toBeNull();
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
			[PUBLICATION_ID, [editionRecord, { ...editionRecord, id: 'ppl-airplane-7' }]],
		]);
		withTestEntries(entries, () => {
			withTestEditions(editions, () => {
				expect(ACS_RESOLVER.getCurrentEdition()).toBe('ppl-airplane-7');
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
