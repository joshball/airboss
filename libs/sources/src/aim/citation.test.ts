import { describe, expect, it } from 'vitest';
import type { SourceEntry, SourceId } from '../types.ts';
import { formatAimCitation } from './citation.ts';

function makeEntry(overrides: Partial<SourceEntry>): SourceEntry {
	return {
		id: 'airboss-ref:aim/5-1-7' as SourceId,
		corpus: 'aim',
		canonical_short: 'AIM 5-1-7',
		canonical_formal: 'Aeronautical Information Manual, Chapter 5, Section 1, Paragraph 7',
		canonical_title: 'Pilot Responsibility upon Clearance Issuance',
		last_amended_date: new Date('2026-09-01T00:00:00Z'),
		lifecycle: 'accepted',
		...overrides,
	};
}

describe('formatAimCitation', () => {
	it('returns canonical_short for "short" style', () => {
		expect(formatAimCitation(makeEntry({}), 'short')).toBe('AIM 5-1-7');
	});

	it('returns canonical_formal for "formal" style', () => {
		expect(formatAimCitation(makeEntry({}), 'formal')).toBe(
			'Aeronautical Information Manual, Chapter 5, Section 1, Paragraph 7',
		);
	});

	it('returns canonical_title for "title" style', () => {
		expect(formatAimCitation(makeEntry({}), 'title')).toBe('Pilot Responsibility upon Clearance Issuance');
	});

	it('handles a chapter-level entry', () => {
		const chapter = makeEntry({
			id: 'airboss-ref:aim/5' as SourceId,
			canonical_short: 'AIM 5',
			canonical_formal: 'Aeronautical Information Manual, Chapter 5',
			canonical_title: 'Air Traffic Procedures',
		});
		expect(formatAimCitation(chapter, 'short')).toBe('AIM 5');
		expect(formatAimCitation(chapter, 'title')).toBe('Air Traffic Procedures');
	});

	it('handles a section-level entry', () => {
		const section = makeEntry({
			id: 'airboss-ref:aim/5-1' as SourceId,
			canonical_short: 'AIM 5-1',
			canonical_formal: 'Aeronautical Information Manual, Chapter 5, Section 1',
			canonical_title: 'Preflight',
		});
		expect(formatAimCitation(section, 'short')).toBe('AIM 5-1');
	});

	it('handles a glossary entry', () => {
		const glossary = makeEntry({
			id: 'airboss-ref:aim/glossary/pilot-in-command' as SourceId,
			canonical_short: 'AIM Glossary - Pilot In Command',
			canonical_formal: 'Aeronautical Information Manual, Pilot/Controller Glossary, Pilot In Command',
			canonical_title: 'Pilot In Command',
		});
		expect(formatAimCitation(glossary, 'short')).toBe('AIM Glossary - Pilot In Command');
		expect(formatAimCitation(glossary, 'formal')).toBe(
			'Aeronautical Information Manual, Pilot/Controller Glossary, Pilot In Command',
		);
	});

	it('handles an appendix entry', () => {
		const appendix = makeEntry({
			id: 'airboss-ref:aim/appendix-1' as SourceId,
			canonical_short: 'AIM Appendix 1',
			canonical_formal: 'Aeronautical Information Manual, Appendix 1',
			canonical_title: 'Bird/Other Wildlife Strike Reporting',
		});
		expect(formatAimCitation(appendix, 'short')).toBe('AIM Appendix 1');
	});
});
