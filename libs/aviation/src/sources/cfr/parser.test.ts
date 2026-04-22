/**
 * CFR XML parser tests.
 *
 * Fixtures under `./fixtures/` are hand-authored synthetic XML mirroring
 * the eCFR bulk-download schema. No real eCFR file is required for these
 * tests to run.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CfrParseError, parseCfrXml } from './parser';

function loadFixture(name: string): string {
	return readFileSync(resolve(import.meta.dirname, 'fixtures', name), 'utf8');
}

const fixture = loadFixture('91.155.xml');
const fixture103 = loadFixture('91.103.xml');
const malformed = loadFixture('malformed.xml');

describe('parseCfrXml -- structural', () => {
	it('parses a fixture into a document without throwing', () => {
		const doc = parseCfrXml(fixture, 'fixture:91.155.xml');
		expect(doc).toBeTruthy();
		expect(doc.root.tag).toBe('CFRDOC');
	});

	it('surfaces a CfrParseError on malformed XML', () => {
		expect(() => parseCfrXml(malformed)).toThrow(CfrParseError);
	});

	it('throws a CfrParseError on empty input', () => {
		expect(() => parseCfrXml('   ')).toThrow(CfrParseError);
	});
});

describe('parseCfrXml -- section lookup', () => {
	const doc = parseCfrXml(fixture);

	it('locates a known section by {title, part, section}', () => {
		const section = doc.getSection({ title: 14, part: 91, section: '155' });
		expect(section.sectionNumber).toBe('Sec. 91.155');
		expect(section.subject).toBe('Basic VFR weather minimums.');
	});

	it('throws a clear error when the title is wrong', () => {
		expect(() => doc.getSection({ title: 99, part: 91, section: '155' })).toThrow(/Title 99 not found/);
	});

	it('throws a clear error when the part is wrong', () => {
		expect(() => doc.getSection({ title: 14, part: 999, section: '155' })).toThrow(/Part .*999 not found/);
	});

	it('throws a clear error when the section is wrong', () => {
		expect(() => doc.getSection({ title: 14, part: 91, section: '404' })).toThrow(/Section .*91\.404 not found/);
	});
});

describe('parseCfrXml -- paragraph rendering', () => {
	const doc = parseCfrXml(fixture);

	it('extracts 91.155 paragraphs verbatim', () => {
		const section = doc.getSection({ title: 14, part: 91, section: '155' });
		expect(section.bodyMarkdown).toContain('Except as provided in paragraph (b)');
		expect(section.bodyMarkdown).toContain('Sec. 91.157');
	});

	it('collapses whitespace to single spaces inside paragraphs', () => {
		const section = doc.getSection({ title: 14, part: 91, section: '155' });
		// No runs of multiple spaces anywhere in a paragraph-only run.
		// (Tables get newlines; those are separators and OK.)
		for (const line of section.bodyMarkdown.split('\n')) {
			if (line.startsWith('|')) continue;
			if (line.startsWith('```')) continue;
			expect(line).not.toMatch(/ {2,}/);
		}
	});

	it('separates blocks with blank lines', () => {
		const section = doc.getSection({ title: 14, part: 91, section: '155' });
		expect(section.bodyMarkdown).toMatch(/\n\n/);
	});

	it('does not leak content from the next section', () => {
		const section = doc.getSection({ title: 14, part: 91, section: '155' });
		// 91.3's content mentions "pilot in command" and "directly responsible";
		// 91.155 does not. Guard against greedy matching bleeding DIV8 siblings.
		expect(section.bodyMarkdown).not.toContain('directly responsible');
	});
});

describe('parseCfrXml -- GFM tables', () => {
	const doc = parseCfrXml(fixture);

	it('renders <GPOTABLE> as a GFM table', () => {
		const section = doc.getSection({ title: 14, part: 91, section: '155' });
		expect(section.bodyMarkdown).toContain('| Airspace | Flight visibility | Distance from clouds |');
		expect(section.bodyMarkdown).toContain('| --- | --- | --- |');
		expect(section.bodyMarkdown).toContain('| Class B | 3 statute miles | Clear of clouds. |');
	});

	it('places the table header row between its header and body rows', () => {
		const section = doc.getSection({ title: 14, part: 91, section: '155' });
		const lines = section.bodyMarkdown.split('\n');
		const headerIdx = lines.findIndex((l) => l.startsWith('| Airspace |'));
		expect(headerIdx).toBeGreaterThanOrEqual(0);
		expect(lines[headerIdx + 1]).toMatch(/^\| --- \|/);
	});
});

describe('parseCfrXml -- nested/letter paragraphs (91.103)', () => {
	const doc = parseCfrXml(fixture103);
	const section = doc.getSection({ title: 14, part: 91, section: '103' });

	it('preserves the letter-labeled paragraph structure', () => {
		expect(section.bodyMarkdown).toContain('(a) For a flight under IFR');
		expect(section.bodyMarkdown).toContain('(b) For any flight');
		expect(section.bodyMarkdown).toContain('(1) For civil aircraft for which an approved Airplane');
		expect(section.bodyMarkdown).toContain('(2) For civil aircraft other than those specified');
	});

	it('renders each paragraph as its own block separated by blank line', () => {
		const blocks = section.bodyMarkdown.split('\n\n');
		expect(blocks.length).toBeGreaterThanOrEqual(5);
	});
});

describe('parseCfrXml -- multiple sections in one document', () => {
	const doc = parseCfrXml(fixture);

	it('extracts 91.3 independently of 91.155', () => {
		const section = doc.getSection({ title: 14, part: 91, section: '3' });
		expect(section.subject).toBe('Responsibility and authority of the pilot in command.');
		expect(section.bodyMarkdown).toContain('directly responsible');
	});

	it('extracts 91.107 independently', () => {
		const section = doc.getSection({ title: 14, part: 91, section: '107' });
		expect(section.subject).toMatch(/safety belts/);
		expect(section.bodyMarkdown).toContain('safety belt');
	});

	it('extracts 91.151 without pulling in 91.155', () => {
		const section = doc.getSection({ title: 14, part: 91, section: '151' });
		expect(section.subject).toBe('Fuel requirements for flight in VFR conditions.');
		expect(section.bodyMarkdown).toContain('30 minutes');
		expect(section.bodyMarkdown).not.toContain('Class B');
	});
});
