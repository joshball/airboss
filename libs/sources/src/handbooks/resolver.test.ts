import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withTestEditions, withTestEntries } from '../registry/__test_helpers__.ts';
import type { Edition, SourceEntry, SourceId } from '../types.ts';
import { __handbooks_resolver_internal__, HANDBOOKS_RESOLVER, setHandbooksDerivativeRoot } from './resolver.ts';

const FIXTURE_ROOT = join(process.cwd(), 'tests/fixtures/handbooks/phak-fixture');

const SECTION_ID = 'airboss-ref:handbooks/phak/8083-25C/1/2' as SourceId;
const CHAPTER_ID = 'airboss-ref:handbooks/phak/8083-25C/1' as SourceId;
const SUBSECTION_ID = 'airboss-ref:handbooks/phak/8083-25C/1/2/1' as SourceId;

function makeEntry(id: SourceId, overrides: Partial<SourceEntry> = {}): SourceEntry {
	return {
		id,
		corpus: 'handbooks',
		canonical_short: 'PHAK Ch.1.2',
		canonical_formal: "Pilot's Handbook of Aeronautical Knowledge (FAA-H-8083-25C), Chapter 1, Section 2",
		canonical_title: 'History of Flight',
		last_amended_date: new Date('2026-04-27T00:00:00Z'),
		lifecycle: 'accepted',
		...overrides,
	};
}

const editionRecord: Edition = {
	id: '8083-25C',
	published_date: new Date('2026-04-27T00:00:00Z'),
	source_url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/faa-h-8083-25c.pdf',
};

describe('HANDBOOKS_RESOLVER', () => {
	beforeEach(() => {
		setHandbooksDerivativeRoot(FIXTURE_ROOT);
		__handbooks_resolver_internal__.clearManifestCache();
	});

	afterEach(() => {
		setHandbooksDerivativeRoot(join(process.cwd(), 'handbooks'));
		__handbooks_resolver_internal__.clearManifestCache();
	});

	it('parses a section locator', () => {
		const parsed = HANDBOOKS_RESOLVER.parseLocator('phak/8083-25C/1/2');
		expect(parsed.kind).toBe('ok');
		if (parsed.kind !== 'ok') return;
		expect(parsed.handbooks).toEqual({ doc: 'phak', edition: '8083-25C', chapter: '1', section: '2' });
	});

	it('formats citations', () => {
		const entry = makeEntry(SECTION_ID);
		expect(HANDBOOKS_RESOLVER.formatCitation(entry, 'short')).toBe('PHAK Ch.1.2');
		expect(HANDBOOKS_RESOLVER.formatCitation(entry, 'title')).toBe('History of Flight');
	});

	it('builds the live URL', () => {
		expect(HANDBOOKS_RESOLVER.getLiveUrl(SECTION_ID, '8083-25C')).toBe(
			'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak',
		);
	});

	it('reads derivative content for a section', () => {
		const text = HANDBOOKS_RESOLVER.getDerivativeContent(SECTION_ID, '8083-25C');
		expect(text).not.toBeNull();
		expect(text).toContain('History of Flight');
	});

	it('reads derivative content for a chapter', () => {
		const text = HANDBOOKS_RESOLVER.getDerivativeContent(CHAPTER_ID, '8083-25C');
		expect(text).not.toBeNull();
		expect(text).toContain('Introduction to Flying');
	});

	it('reads derivative content for a subsection', () => {
		const text = HANDBOOKS_RESOLVER.getDerivativeContent(SUBSECTION_ID, '8083-25C');
		expect(text).not.toBeNull();
		expect(text).toContain('Transcontinental Air Mail Route');
	});

	it('returns null for an unknown locator', () => {
		const text = HANDBOOKS_RESOLVER.getDerivativeContent(
			'airboss-ref:handbooks/phak/8083-25C/99/9' as SourceId,
			'8083-25C',
		);
		expect(text).toBeNull();
	});

	it('returns null for a figure (no manifest entry)', () => {
		const text = HANDBOOKS_RESOLVER.getDerivativeContent(
			'airboss-ref:handbooks/phak/8083-25C/fig-12-7' as SourceId,
			'8083-25C',
		);
		expect(text).toBeNull();
	});

	it('returns null for an unknown doc / edition', () => {
		const text = HANDBOOKS_RESOLVER.getDerivativeContent(
			'airboss-ref:handbooks/phak/8083-99Z/1/2' as SourceId,
			'8083-99Z',
		);
		expect(text).toBeNull();
	});

	it('builds indexed content with the body text', async () => {
		const indexed = await HANDBOOKS_RESOLVER.getIndexedContent(SECTION_ID, '8083-25C');
		expect(indexed).not.toBeNull();
		expect(indexed?.normalizedText).toContain('History of Flight');
	});

	it('getCurrentEdition returns max edition across handbooks corpus', () => {
		const entries: Record<string, SourceEntry> = {
			[SECTION_ID]: makeEntry(SECTION_ID),
		};
		const editions = new Map<SourceId, readonly Edition[]>([[SECTION_ID, [editionRecord]]]);
		withTestEntries(entries, () => {
			withTestEditions(editions, () => {
				expect(HANDBOOKS_RESOLVER.getCurrentEdition()).toBe('8083-25C');
			});
		});
	});

	it('getEditions reads from the editions map', async () => {
		const entries: Record<string, SourceEntry> = {
			[SECTION_ID]: makeEntry(SECTION_ID),
		};
		const editions = new Map<SourceId, readonly Edition[]>([[SECTION_ID, [editionRecord]]]);
		await withTestEntries(entries, async () => {
			await withTestEditions(editions, async () => {
				const result = await HANDBOOKS_RESOLVER.getEditions(SECTION_ID);
				expect(result).toEqual([editionRecord]);
			});
		});
	});
});
