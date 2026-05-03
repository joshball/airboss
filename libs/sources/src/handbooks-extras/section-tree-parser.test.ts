/**
 * Unit tests for `parseOverrideToSectionTree`.
 *
 * The parser is pure (no IO), so tests construct markdown strings inline
 * and assert on the structured return value. The fixtures below exercise:
 *
 *   - happy path with mixed chapter / section depths
 *   - boundary conditions (empty body, chapter without sections)
 *   - strict-mode rejections (H4+, missing H1, duplicate slugs)
 *   - the "flat" sentinel for overrides without `## ` headings
 */

import { describe, expect, it } from 'vitest';
import { OverrideParseError, parseOverrideToSectionTree, titleSlug } from './section-tree-parser.ts';

describe('titleSlug', () => {
	it('lowercases', () => {
		expect(titleSlug('Density Altitude')).toBe('density-altitude');
	});

	it('collapses runs of non-alphanumerics', () => {
		expect(titleSlug('Foo / Bar -- Baz!')).toBe('foo-bar-baz');
	});

	it('strips leading and trailing hyphens', () => {
		expect(titleSlug('-foo-bar-')).toBe('foo-bar');
	});

	it('falls back to "section" for empty input', () => {
		expect(titleSlug('')).toBe('section');
		expect(titleSlug('!!!')).toBe('section');
	});

	it('truncates to 48 chars', () => {
		const long = 'a'.repeat(100);
		expect(titleSlug(long).length).toBe(48);
	});

	it('preserves embedded numerals', () => {
		expect(titleSlug('14 CFR Part 91')).toBe('14-cfr-part-91');
	});
});

describe('parseOverrideToSectionTree', () => {
	it('parses a structured doc with chapters and sections', () => {
		const md = [
			'# Tips on Mountain Flying',
			'',
			'Subtitle prose dropped before first chapter.',
			'',
			'## Foreword',
			'',
			'Foreword prose.',
			'',
			'## Introduction',
			'',
			'Lead-in prose.',
			'',
			'### Safety Window',
			'',
			'Safety window body.',
			'',
			'### Pilot Requirements',
			'',
			'Pilot req body.',
			'',
			'## Weather Factors',
			'',
			'### Density Altitude',
			'',
			'DA body.',
			'',
		].join('\n');

		const result = parseOverrideToSectionTree(md);
		expect(result.kind).toBe('section-tree');
		if (result.kind !== 'section-tree') return;
		expect(result.title).toBe('Tips on Mountain Flying');
		expect(result.chapters).toHaveLength(3);

		const [foreword, intro, weather] = result.chapters;
		expect(foreword?.title).toBe('Foreword');
		expect(foreword?.slug).toBe('foreword');
		expect(foreword?.sections).toHaveLength(0);
		expect(foreword?.overview).toContain('Foreword prose.');

		expect(intro?.title).toBe('Introduction');
		expect(intro?.sections).toHaveLength(2);
		expect(intro?.overview).toContain('Lead-in prose.');
		expect(intro?.overview).not.toContain('Safety window body.');
		expect(intro?.sections[0]?.title).toBe('Safety Window');
		expect(intro?.sections[0]?.slug).toBe('safety-window');
		expect(intro?.sections[0]?.body).toContain('Safety window body.');
		expect(intro?.sections[1]?.title).toBe('Pilot Requirements');
		expect(intro?.sections[1]?.slug).toBe('pilot-requirements');

		expect(weather?.title).toBe('Weather Factors');
		expect(weather?.sections).toHaveLength(1);
		expect(weather?.sections[0]?.title).toBe('Density Altitude');
	});

	it('chapter with no sections puts all prose in overview', () => {
		const md = ['# Doc', '', '## Solo Chapter', '', 'Just prose.', 'Across two lines.', ''].join('\n');
		const result = parseOverrideToSectionTree(md);
		expect(result.kind).toBe('section-tree');
		if (result.kind !== 'section-tree') return;
		expect(result.chapters).toHaveLength(1);
		expect(result.chapters[0]?.sections).toHaveLength(0);
		expect(result.chapters[0]?.overview).toContain('Just prose.');
		expect(result.chapters[0]?.overview).toContain('Across two lines.');
	});

	it('chapter with empty body is allowed', () => {
		const md = ['# Doc', '', '## Empty', '## Next', '', 'next prose'].join('\n');
		const result = parseOverrideToSectionTree(md);
		expect(result.kind).toBe('section-tree');
		if (result.kind !== 'section-tree') return;
		expect(result.chapters).toHaveLength(2);
		expect(result.chapters[0]?.overview).toBe('');
		expect(result.chapters[1]?.overview).toContain('next prose');
	});

	it('returns flat sentinel when no chapters present', () => {
		const md = ['# Doc Title', '', 'Just prose.', 'No headings beyond H1.', ''].join('\n');
		const result = parseOverrideToSectionTree(md);
		expect(result.kind).toBe('flat');
	});

	it('throws when no H1 is present', () => {
		const md = ['## Chapter only', '', 'prose'].join('\n');
		expect(() => parseOverrideToSectionTree(md)).toThrow(OverrideParseError);
	});

	it('throws when more than one H1 is present', () => {
		const md = ['# Doc One', '', '# Doc Two', '', '## Ch'].join('\n');
		expect(() => parseOverrideToSectionTree(md)).toThrow(/2 .*headings.*expected exactly one/);
	});

	it('rejects H4+ heading', () => {
		const md = ['# Doc', '', '## Ch', '', '### Sec', '', '#### Too Deep', ''].join('\n');
		expect(() => parseOverrideToSectionTree(md)).toThrow(/H4\+ heading/);
	});

	it('rejects duplicate chapter slug', () => {
		const md = ['# Doc', '', '## Foo Bar', 'a', '## Foo  Bar', 'b'].join('\n');
		expect(() => parseOverrideToSectionTree(md)).toThrow(/duplicate chapter slug/);
	});

	it('rejects duplicate section slug within a chapter', () => {
		const md = ['# Doc', '', '## Ch', '', '### Sec One', 'a', '### Sec  One', 'b'].join('\n');
		expect(() => parseOverrideToSectionTree(md)).toThrow(/duplicate section slug/);
	});

	it('allows the same section slug across different chapters', () => {
		const md = [
			'# Doc',
			'',
			'## Chapter A',
			'',
			'### Introduction',
			'A intro',
			'',
			'## Chapter B',
			'',
			'### Introduction',
			'B intro',
			'',
		].join('\n');
		const result = parseOverrideToSectionTree(md);
		expect(result.kind).toBe('section-tree');
	});

	it('rejects section before any chapter', () => {
		const md = ['# Doc', '', '### Stray', '', '## Real Chapter'].join('\n');
		expect(() => parseOverrideToSectionTree(md)).toThrow(/before any chapter/);
	});

	it('ignores headings inside fenced code blocks', () => {
		const md = [
			'# Doc',
			'',
			'## Real Chapter',
			'',
			'```text',
			'## Not A Real Chapter',
			'#### Not A Real H4',
			'```',
			'',
			'Real prose.',
		].join('\n');
		const result = parseOverrideToSectionTree(md);
		expect(result.kind).toBe('section-tree');
		if (result.kind !== 'section-tree') return;
		expect(result.chapters).toHaveLength(1);
		expect(result.chapters[0]?.title).toBe('Real Chapter');
		expect(result.chapters[0]?.overview).toContain('## Not A Real Chapter');
	});

	it('preserves multi-line bodies and inline markdown', () => {
		const md = [
			'# Doc',
			'',
			'## Ch',
			'',
			'### Sec',
			'',
			'- bullet 1',
			'- bullet 2',
			'',
			'Trailing prose with **bold** and *italic*.',
			'',
		].join('\n');
		const result = parseOverrideToSectionTree(md);
		expect(result.kind).toBe('section-tree');
		if (result.kind !== 'section-tree') return;
		const sec = result.chapters[0]?.sections[0];
		expect(sec?.body).toContain('- bullet 1');
		expect(sec?.body).toContain('**bold**');
	});
});
