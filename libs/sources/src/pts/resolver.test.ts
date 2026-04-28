import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetRegistry, withTestEditions, withTestEntries } from '../registry/__test_helpers__.ts';
import type { Edition, SourceEntry, SourceId } from '../types.ts';
import { PTS_RESOLVER } from './resolver.ts';

const ELEMENT_ID = 'airboss-ref:pts/cfii-airplane-9e/area-05/task-a/elem-01' as SourceId;
const TASK_ID = 'airboss-ref:pts/cfii-airplane-9e/area-05/task-a' as SourceId;
const PUBLICATION_ID = 'airboss-ref:pts/cfii-airplane-9e' as SourceId;

function makeEntry(id: SourceId, overrides: Partial<SourceEntry> = {}): SourceEntry {
	return {
		id,
		corpus: 'pts',
		canonical_short: 'CFII PTS V.A.1',
		canonical_formal: 'Flight Instructor Instrument PTS (FAA-S-8081-9E), Area V Task A Objective 1',
		canonical_title: 'Aerodynamics of holding patterns',
		last_amended_date: new Date('2026-04-27T00:00:00Z'),
		lifecycle: 'accepted',
		...overrides,
	};
}

const editionRecord: Edition = {
	id: 'cfii-airplane-9e',
	published_date: new Date('2023-11-01T00:00:00Z'),
	source_url: 'https://www.faa.gov/training_testing/testing/acs/cfi_instrument_pts_9.pdf',
};

describe('PTS_RESOLVER', () => {
	beforeEach(() => {
		resetRegistry();
	});

	afterEach(() => {
		resetRegistry();
	});

	it('parses an element locator via the resolver', () => {
		const parsed = PTS_RESOLVER.parseLocator('cfii-airplane-9e/area-05/task-a/elem-01');
		expect(parsed.kind).toBe('ok');
		if (parsed.kind !== 'ok') return;
		expect(parsed.pts).toEqual({
			slug: 'cfii-airplane-9e',
			area: '05',
			task: 'a',
			elementOrdinal: '01',
		});
	});

	it('formats citations across all three styles', () => {
		const entry = makeEntry(ELEMENT_ID);
		expect(PTS_RESOLVER.formatCitation(entry, 'short')).toBe('CFII PTS V.A.1');
		expect(PTS_RESOLVER.formatCitation(entry, 'formal')).toContain('FAA-S-8081-9E');
		expect(PTS_RESOLVER.formatCitation(entry, 'title')).toBe('Aerodynamics of holding patterns');
	});

	it('builds a per-publication live URL for cfii-airplane-9e', () => {
		expect(PTS_RESOLVER.getLiveUrl(ELEMENT_ID, 'cfii-airplane-9e')).toBe(
			'https://www.faa.gov/training_testing/testing/acs/cfi_instrument_pts_9.pdf',
		);
	});

	it('returns null for a SourceId that does not start with the pts prefix', () => {
		expect(
			PTS_RESOLVER.getLiveUrl('airboss-ref:handbooks/phak/8083-25C/12/3' as SourceId, 'cfii-airplane-9e'),
		).toBeNull();
	});

	it('returns null for an unparseable pts locator', () => {
		expect(PTS_RESOLVER.getLiveUrl('airboss-ref:pts/' as SourceId, 'cfii-airplane-9e')).toBeNull();
	});

	it('getDerivativeContent returns null (PTS PDF ingestion ships in a follow-on)', () => {
		expect(PTS_RESOLVER.getDerivativeContent(ELEMENT_ID, 'cfii-airplane-9e')).toBeNull();
	});

	it('getIndexedContent returns null (PTS PDF ingestion ships in a follow-on)', async () => {
		expect(await PTS_RESOLVER.getIndexedContent(ELEMENT_ID, 'cfii-airplane-9e')).toBeNull();
	});

	it('getCurrentEdition returns max edition across pts corpus', () => {
		const entries: Record<string, SourceEntry> = {
			[ELEMENT_ID]: makeEntry(ELEMENT_ID),
			[TASK_ID]: makeEntry(TASK_ID),
			[PUBLICATION_ID]: makeEntry(PUBLICATION_ID, { canonical_short: 'CFII PTS' }),
		};
		// Lexical max: 'cfii-airplane-9f' beats 'cfii-airplane-9e'.
		const editions = new Map<SourceId, readonly Edition[]>([
			[ELEMENT_ID, [editionRecord]],
			[TASK_ID, [editionRecord]],
			[PUBLICATION_ID, [editionRecord, { ...editionRecord, id: 'cfii-airplane-9f' }]],
		]);
		withTestEntries(entries, () => {
			withTestEditions(editions, () => {
				expect(PTS_RESOLVER.getCurrentEdition()).toBe('cfii-airplane-9f');
			});
		});
	});

	it('getCurrentEdition returns null when no pts entries exist', () => {
		expect(PTS_RESOLVER.getCurrentEdition()).toBeNull();
	});

	it('getEditions reads from the editions map', async () => {
		const entries: Record<string, SourceEntry> = {
			[ELEMENT_ID]: makeEntry(ELEMENT_ID),
		};
		const editions = new Map<SourceId, readonly Edition[]>([[ELEMENT_ID, [editionRecord]]]);
		await withTestEntries(entries, async () => {
			await withTestEditions(editions, async () => {
				const result = await PTS_RESOLVER.getEditions(ELEMENT_ID);
				expect(result).toEqual([editionRecord]);
			});
		});
	});
});
