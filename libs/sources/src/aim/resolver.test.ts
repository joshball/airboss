import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withTestEditions, withTestEntries } from '../registry/__test_helpers__.ts';
import type { Edition, SourceEntry, SourceId } from '../types.ts';
import { __aim_resolver_internal__, AIM_RESOLVER, setAimDerivativeRoot } from './resolver.ts';

const FIXTURE_ROOT = join(process.cwd(), 'tests/fixtures/aim/aim-fixture/aim');

const PARAGRAPH_ID = 'airboss-ref:aim/5-1-7' as SourceId;
const SECTION_ID = 'airboss-ref:aim/5-1' as SourceId;
const CHAPTER_ID = 'airboss-ref:aim/5' as SourceId;
const GLOSSARY_ID = 'airboss-ref:aim/glossary/pilot-in-command' as SourceId;
const APPENDIX_ID = 'airboss-ref:aim/appendix-1' as SourceId;

function makeEntry(id: SourceId, overrides: Partial<SourceEntry> = {}): SourceEntry {
	return {
		id,
		corpus: 'aim',
		canonical_short: 'AIM 5-1-7',
		canonical_formal: 'Aeronautical Information Manual, Chapter 5, Section 1, Paragraph 7',
		canonical_title: 'Pilot Responsibility upon Clearance Issuance',
		last_amended_date: new Date('2026-09-01T00:00:00Z'),
		lifecycle: 'accepted',
		...overrides,
	};
}

const editionRecord: Edition = {
	id: '2026-09',
	published_date: new Date('2026-09-01T00:00:00Z'),
	source_url: 'https://www.faa.gov/air_traffic/publications/atpubs/aim_html/',
};

describe('AIM_RESOLVER', () => {
	beforeEach(() => {
		setAimDerivativeRoot(FIXTURE_ROOT);
		__aim_resolver_internal__.clearManifestCache();
	});

	afterEach(() => {
		setAimDerivativeRoot(join(process.cwd(), 'aim'));
		__aim_resolver_internal__.clearManifestCache();
	});

	it('parses a paragraph locator', () => {
		const parsed = AIM_RESOLVER.parseLocator('5-1-7');
		expect(parsed.kind).toBe('ok');
		if (parsed.kind !== 'ok') return;
		expect(parsed.aim).toEqual({ chapter: '5', section: '1', paragraph: '7' });
	});

	it('parses a glossary locator', () => {
		const parsed = AIM_RESOLVER.parseLocator('glossary/pilot-in-command');
		expect(parsed.kind).toBe('ok');
		if (parsed.kind !== 'ok') return;
		expect(parsed.aim).toEqual({ glossarySlug: 'pilot-in-command' });
	});

	it('formats citations', () => {
		const entry = makeEntry(PARAGRAPH_ID);
		expect(AIM_RESOLVER.formatCitation(entry, 'short')).toBe('AIM 5-1-7');
		expect(AIM_RESOLVER.formatCitation(entry, 'title')).toBe('Pilot Responsibility upon Clearance Issuance');
	});

	it('builds the live URL', () => {
		expect(AIM_RESOLVER.getLiveUrl(PARAGRAPH_ID, '2026-09')).toBe(
			'https://www.faa.gov/air_traffic/publications/atpubs/',
		);
	});

	it('reads derivative content for a paragraph', () => {
		const text = AIM_RESOLVER.getDerivativeContent(PARAGRAPH_ID, '2026-09');
		expect(text).not.toBeNull();
		expect(text).toContain('Pilot Responsibility upon Clearance Issuance');
	});

	it('reads derivative content for a section', () => {
		const text = AIM_RESOLVER.getDerivativeContent(SECTION_ID, '2026-09');
		expect(text).not.toBeNull();
		expect(text).toContain('Preflight');
	});

	it('reads derivative content for a chapter', () => {
		const text = AIM_RESOLVER.getDerivativeContent(CHAPTER_ID, '2026-09');
		expect(text).not.toBeNull();
		expect(text).toContain('Air Traffic Procedures');
	});

	it('reads derivative content for a glossary entry', () => {
		const text = AIM_RESOLVER.getDerivativeContent(GLOSSARY_ID, '2026-09');
		expect(text).not.toBeNull();
		expect(text).toContain('Pilot In Command');
	});

	it('reads derivative content for an appendix', () => {
		const text = AIM_RESOLVER.getDerivativeContent(APPENDIX_ID, '2026-09');
		expect(text).not.toBeNull();
		expect(text).toContain('Bird/Other Wildlife Strike Reporting');
	});

	it('returns null for an unknown locator', () => {
		const text = AIM_RESOLVER.getDerivativeContent('airboss-ref:aim/99-9-9' as SourceId, '2026-09');
		expect(text).toBeNull();
	});

	it('returns null for an unknown edition', () => {
		const text = AIM_RESOLVER.getDerivativeContent(PARAGRAPH_ID, '1999-01');
		expect(text).toBeNull();
	});

	it('returns null for a non-aim SourceId', () => {
		const text = AIM_RESOLVER.getDerivativeContent('airboss-ref:regs/cfr-14/91/103' as SourceId, '2026-09');
		expect(text).toBeNull();
	});

	it('builds indexed content with the body text', async () => {
		const indexed = await AIM_RESOLVER.getIndexedContent(PARAGRAPH_ID, '2026-09');
		expect(indexed).not.toBeNull();
		expect(indexed?.normalizedText).toContain('Pilot Responsibility upon Clearance Issuance');
	});

	it('getCurrentEdition returns max edition across aim corpus', () => {
		const entries: Record<string, SourceEntry> = {
			[PARAGRAPH_ID]: makeEntry(PARAGRAPH_ID),
		};
		const editions = new Map<SourceId, readonly Edition[]>([[PARAGRAPH_ID, [editionRecord]]]);
		withTestEntries(entries, () => {
			withTestEditions(editions, () => {
				expect(AIM_RESOLVER.getCurrentEdition()).toBe('2026-09');
			});
		});
	});

	it('getCurrentEdition returns null when no aim entries are populated', () => {
		withTestEntries({}, () => {
			withTestEditions(new Map(), () => {
				expect(AIM_RESOLVER.getCurrentEdition()).toBeNull();
			});
		});
	});

	it('getCurrentEdition returns the max edition when multiple are populated', () => {
		const olderEdition: Edition = {
			id: '2026-04',
			published_date: new Date('2026-04-01T00:00:00Z'),
			source_url: 'https://example.invalid/',
		};
		const entries: Record<string, SourceEntry> = {
			[PARAGRAPH_ID]: makeEntry(PARAGRAPH_ID),
		};
		const editions = new Map<SourceId, readonly Edition[]>([[PARAGRAPH_ID, [olderEdition, editionRecord]]]);
		withTestEntries(entries, () => {
			withTestEditions(editions, () => {
				expect(AIM_RESOLVER.getCurrentEdition()).toBe('2026-09');
			});
		});
	});

	it('getEditions reads from the editions map', async () => {
		const entries: Record<string, SourceEntry> = {
			[PARAGRAPH_ID]: makeEntry(PARAGRAPH_ID),
		};
		const editions = new Map<SourceId, readonly Edition[]>([[PARAGRAPH_ID, [editionRecord]]]);
		await withTestEntries(entries, async () => {
			await withTestEditions(editions, async () => {
				const result = await AIM_RESOLVER.getEditions(PARAGRAPH_ID);
				expect(result).toEqual([editionRecord]);
			});
		});
	});
});
