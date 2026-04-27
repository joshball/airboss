import { describe, expect, it } from 'vitest';
import type { SourceEntry, SourceId } from '../types.ts';
import { formatRegsCitation } from './citation.ts';

function makeEntry(overrides: Partial<SourceEntry> = {}): SourceEntry {
	return {
		id: 'airboss-ref:regs/cfr-14/91/103' as SourceId,
		corpus: 'regs',
		canonical_short: '§91.103',
		canonical_formal: '14 CFR § 91.103',
		canonical_title: 'Preflight action',
		last_amended_date: new Date('2009-08-21'),
		lifecycle: 'accepted',
		...overrides,
	};
}

describe('formatRegsCitation', () => {
	it('returns canonical_short for "short"', () => {
		expect(formatRegsCitation(makeEntry(), 'short')).toBe('§91.103');
	});

	it('returns canonical_formal for "formal"', () => {
		expect(formatRegsCitation(makeEntry(), 'formal')).toBe('14 CFR § 91.103');
	});

	it('returns canonical_title for "title"', () => {
		expect(formatRegsCitation(makeEntry(), 'title')).toBe('Preflight action');
	});

	it('formats a subpart entry', () => {
		const entry = makeEntry({
			id: 'airboss-ref:regs/cfr-14/91/subpart-b' as SourceId,
			canonical_short: 'Subpart B',
			canonical_formal: '14 CFR Part 91, Subpart B',
			canonical_title: 'Flight Rules',
		});
		expect(formatRegsCitation(entry, 'short')).toBe('Subpart B');
		expect(formatRegsCitation(entry, 'formal')).toBe('14 CFR Part 91, Subpart B');
		expect(formatRegsCitation(entry, 'title')).toBe('Flight Rules');
	});

	it('formats a Part-level entry', () => {
		const entry = makeEntry({
			id: 'airboss-ref:regs/cfr-14/91' as SourceId,
			canonical_short: '14 CFR Part 91',
			canonical_formal: '14 CFR Part 91',
			canonical_title: 'General Operating and Flight Rules',
		});
		expect(formatRegsCitation(entry, 'short')).toBe('14 CFR Part 91');
		expect(formatRegsCitation(entry, 'formal')).toBe('14 CFR Part 91');
		expect(formatRegsCitation(entry, 'title')).toBe('General Operating and Flight Rules');
	});

	it('throws on unknown style', () => {
		expect(() => formatRegsCitation(makeEntry(), 'bogus' as 'short')).toThrow(/unknown citation style/);
	});
});
