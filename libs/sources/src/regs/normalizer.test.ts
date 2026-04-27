import { describe, expect, it } from 'vitest';
import { __normalizer_internal__, normalizeRawPart, normalizeRawSection, normalizeRawSubpart } from './normalizer.ts';
import type { RawPart, RawSection, RawSubpart } from './xml-walker.ts';

const PUBLISHED = new Date('2026-01-01');

function rawSection(overrides: Partial<RawSection> = {}): RawSection {
	return {
		kind: 'section',
		title: '14',
		part: '91',
		subpart: 'b',
		section: '103',
		headTitle: 'Preflight action',
		bodyText: 'Each pilot in command shall...',
		amendedDate: '2008-09-05',
		reserved: false,
		...overrides,
	};
}

describe('normalizeRawSection', () => {
	it('builds canonical fields', () => {
		const result = normalizeRawSection(rawSection(), { publishedDate: PUBLISHED });
		expect(result.entry.id).toBe('airboss-ref:regs/cfr-14/91/103');
		expect(result.entry.canonical_short).toBe('§91.103');
		expect(result.entry.canonical_formal).toBe('14 CFR § 91.103');
		expect(result.entry.canonical_title).toBe('Preflight action');
		expect(result.entry.lifecycle).toBe('pending');
	});

	it('parses amended date', () => {
		const result = normalizeRawSection(rawSection({ amendedDate: '2008-09-05' }), { publishedDate: PUBLISHED });
		expect(result.entry.last_amended_date.toISOString().slice(0, 10)).toBe('2008-09-05');
	});

	it('falls back to published date when amended date is null', () => {
		const result = normalizeRawSection(rawSection({ amendedDate: null }), { publishedDate: PUBLISHED });
		expect(result.entry.last_amended_date.getTime()).toBe(PUBLISHED.getTime());
	});

	it('flags reserved sections', () => {
		const result = normalizeRawSection(
			rawSection({ section: '149', headTitle: '[Reserved]', bodyText: '', amendedDate: null, reserved: true }),
			{ publishedDate: PUBLISHED },
		);
		expect(result.entry.canonical_title).toBe('[Reserved]');
		expect(result.bodyMarkdown).toMatch(/\[Reserved\]/);
	});

	it('builds 49 CFR section ids', () => {
		const result = normalizeRawSection(rawSection({ title: '49', part: '830', section: '5', subpart: null }), {
			publishedDate: PUBLISHED,
		});
		expect(result.entry.id).toBe('airboss-ref:regs/cfr-49/830/5');
		expect(result.entry.canonical_formal).toBe('49 CFR § 830.5');
	});

	it('produces markdown body with heading', () => {
		const result = normalizeRawSection(rawSection(), { publishedDate: PUBLISHED });
		expect(result.bodyMarkdown.startsWith('# §91.103 Preflight action')).toBe(true);
		expect(result.bodyMarkdown).toMatch(/Each pilot in command shall/);
	});
});

describe('normalizeRawSubpart', () => {
	it('builds canonical fields', () => {
		const raw: RawSubpart = {
			kind: 'subpart',
			title: '14',
			part: '91',
			subpart: 'b',
			headTitle: 'Flight Rules',
		};
		const result = normalizeRawSubpart(raw, { publishedDate: PUBLISHED });
		expect(result.entry.id).toBe('airboss-ref:regs/cfr-14/91/subpart-b');
		expect(result.entry.canonical_short).toBe('Subpart B');
		expect(result.entry.canonical_formal).toBe('14 CFR Part 91, Subpart B');
		expect(result.entry.canonical_title).toBe('Flight Rules');
	});

	it('falls back to placeholder title when head is empty', () => {
		const raw: RawSubpart = { kind: 'subpart', title: '14', part: '91', subpart: 'a', headTitle: '' };
		const result = normalizeRawSubpart(raw, { publishedDate: PUBLISHED });
		expect(result.entry.canonical_title).toBe('Subpart A');
	});
});

describe('normalizeRawPart', () => {
	it('builds canonical fields', () => {
		const raw: RawPart = {
			kind: 'part',
			title: '14',
			part: '91',
			headTitle: 'General Operating and Flight Rules',
		};
		const result = normalizeRawPart(raw, { publishedDate: PUBLISHED });
		expect(result.entry.id).toBe('airboss-ref:regs/cfr-14/91');
		expect(result.entry.canonical_short).toBe('14 CFR Part 91');
		expect(result.entry.canonical_formal).toBe('14 CFR Part 91');
		expect(result.entry.canonical_title).toBe('General Operating and Flight Rules');
	});
});

describe('normalizeText', () => {
	it('NFC-normalizes input', () => {
		// 'é' as NFD vs NFC
		const nfd = 'café';
		const out = __normalizer_internal__.normalizeText(nfd);
		expect(out).toBe('café');
		expect(out.normalize('NFC')).toBe(out);
	});

	it('converts CRLF to LF', () => {
		expect(__normalizer_internal__.normalizeText('a\r\nb\r\nc')).toBe('a\nb\nc');
	});

	it('collapses 3+ newlines to 2', () => {
		expect(__normalizer_internal__.normalizeText('a\n\n\n\nb')).toBe('a\n\nb');
	});

	it('trims leading + trailing whitespace', () => {
		expect(__normalizer_internal__.normalizeText('   hello\n\n   ')).toBe('hello');
	});
});
