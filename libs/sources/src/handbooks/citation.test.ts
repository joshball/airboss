import { describe, expect, it } from 'vitest';
import type { SourceEntry, SourceId } from '../types.ts';
import { formatHandbooksCitation } from './citation.ts';

function makeEntry(overrides: Partial<SourceEntry>): SourceEntry {
	return {
		id: 'airboss-ref:handbooks/phak/8083-25C/12/3' as SourceId,
		corpus: 'handbooks',
		canonical_short: 'PHAK Ch.12.3',
		canonical_formal: "Pilot's Handbook of Aeronautical Knowledge (FAA-H-8083-25C), Chapter 12, Section 3",
		canonical_title: 'Coriolis Force',
		last_amended_date: new Date('2026-01-01T00:00:00Z'),
		lifecycle: 'accepted',
		...overrides,
	};
}

describe('formatHandbooksCitation', () => {
	it('returns canonical_short for "short" style', () => {
		expect(formatHandbooksCitation(makeEntry({}), 'short')).toBe('PHAK Ch.12.3');
	});

	it('returns canonical_formal for "formal" style', () => {
		expect(formatHandbooksCitation(makeEntry({}), 'formal')).toBe(
			"Pilot's Handbook of Aeronautical Knowledge (FAA-H-8083-25C), Chapter 12, Section 3",
		);
	});

	it('returns canonical_title for "title" style', () => {
		expect(formatHandbooksCitation(makeEntry({}), 'title')).toBe('Coriolis Force');
	});

	it('handles a chapter-level entry', () => {
		const chapter = makeEntry({
			id: 'airboss-ref:handbooks/phak/8083-25C/12' as SourceId,
			canonical_short: 'PHAK Ch.12',
			canonical_formal: "Pilot's Handbook of Aeronautical Knowledge (FAA-H-8083-25C), Chapter 12",
			canonical_title: 'Weather Theory',
		});
		expect(formatHandbooksCitation(chapter, 'short')).toBe('PHAK Ch.12');
		expect(formatHandbooksCitation(chapter, 'title')).toBe('Weather Theory');
	});

	it('handles a chapter intro entry', () => {
		const intro = makeEntry({
			id: 'airboss-ref:handbooks/afh/8083-3C/5/intro' as SourceId,
			canonical_short: 'AFH Ch.5 intro',
			canonical_formal: 'Airplane Flying Handbook (FAA-H-8083-3C), Chapter 5, Introduction',
			canonical_title: 'Maintaining Aircraft Control',
		});
		expect(formatHandbooksCitation(intro, 'short')).toBe('AFH Ch.5 intro');
	});
});
