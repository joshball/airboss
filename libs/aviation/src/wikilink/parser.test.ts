import { describe, expect, it } from 'vitest';
import { extractWikilinks, parseWikilinks } from './parser';

describe('parseWikilinks - three valid modes', () => {
	it('parses the canonical display::id form', () => {
		const { nodes, errors } = parseWikilinks('See [[VFR minimums::cfr-14-91-155]] for details.');
		expect(errors).toEqual([]);
		expect(nodes).toHaveLength(3);
		expect(nodes[0]).toMatchObject({ kind: 'text', text: 'See ' });
		expect(nodes[1]).toMatchObject({
			kind: 'wikilink',
			display: 'VFR minimums',
			id: 'cfr-14-91-155',
		});
		expect(nodes[2]).toMatchObject({ kind: 'text', text: ' for details.' });
	});

	it('parses the display-only [[text::]] form with null id', () => {
		const { nodes, errors } = parseWikilinks('Write about [[some future term::]].');
		expect(errors).toEqual([]);
		const link = nodes.find((n) => n.kind === 'wikilink');
		expect(link).toMatchObject({ display: 'some future term', id: null });
	});

	it('parses the id-only [[::id]] form with null display', () => {
		const { nodes, errors } = parseWikilinks('Cites [[::cfr-14-91-155]] directly.');
		expect(errors).toEqual([]);
		const link = nodes.find((n) => n.kind === 'wikilink');
		expect(link).toMatchObject({ display: null, id: 'cfr-14-91-155' });
	});
});

describe('parseWikilinks - whitespace tolerance', () => {
	it('trims whitespace around :: separators', () => {
		const { nodes, errors } = parseWikilinks('[[  VFR minimums  ::  cfr-14-91-155  ]]');
		expect(errors).toEqual([]);
		const link = nodes.find((n) => n.kind === 'wikilink');
		expect(link).toMatchObject({ display: 'VFR minimums', id: 'cfr-14-91-155' });
	});
});

describe('parseWikilinks - invalid forms surface errors', () => {
	it('errors on empty [[::]]', () => {
		const { errors } = parseWikilinks('bad: [[::]] oops');
		expect(errors).toHaveLength(1);
		expect(errors[0]?.message).toMatch(/Empty wiki-link/i);
	});

	it('errors on whitespace-only [[ :: ]]', () => {
		const { errors } = parseWikilinks('[[   ::   ]]');
		expect(errors).toHaveLength(1);
		expect(errors[0]?.message).toMatch(/Empty wiki-link/i);
	});

	it('errors on nested wiki-links', () => {
		const { errors } = parseWikilinks('pre [[outer [[inner::id1]] rest::id2]] post');
		expect(errors.length).toBeGreaterThanOrEqual(1);
		expect(errors.some((e) => /Nested/i.test(e.message))).toBe(true);
	});

	it('errors on an unterminated wiki-link that saw ::', () => {
		const { errors } = parseWikilinks('oops [[display::id and no close');
		expect(errors).toHaveLength(1);
		expect(errors[0]?.message).toMatch(/Unterminated/i);
	});

	it('leaves plain bracketed text ([[foo]]) alone -- not a wiki-link, no error', () => {
		const { nodes, errors } = parseWikilinks('look: [[not a wiki link]] and more');
		expect(errors).toEqual([]);
		expect(nodes.every((n) => n.kind === 'text')).toBe(true);
	});
});

describe('parseWikilinks - code-block / code-span tolerance', () => {
	it('skips fenced code blocks (triple backtick)', () => {
		const src = [
			'before',
			'```typescript',
			'const x = "[[fake::id]]";',
			'```',
			'after [[real::cfr-14-91-155]] here',
		].join('\n');
		const { nodes, errors } = parseWikilinks(src);
		expect(errors).toEqual([]);
		const links = nodes.filter((n) => n.kind === 'wikilink');
		expect(links).toHaveLength(1);
		expect(links[0]).toMatchObject({ display: 'real', id: 'cfr-14-91-155' });
	});

	it('skips fenced code blocks (triple tilde)', () => {
		const src = ['~~~', '[[fake::id]]', '~~~', '[[real::id2]]'].join('\n');
		const { nodes } = parseWikilinks(src);
		const links = nodes.filter((n) => n.kind === 'wikilink');
		expect(links).toHaveLength(1);
		expect(links[0]).toMatchObject({ display: 'real', id: 'id2' });
	});

	it('skips single-backtick inline code', () => {
		const { nodes } = parseWikilinks('use `[[fake::id]]` syntax then [[real::id2]]');
		const links = nodes.filter((n) => n.kind === 'wikilink');
		expect(links).toHaveLength(1);
		expect(links[0]).toMatchObject({ display: 'real', id: 'id2' });
	});

	it('skips multi-backtick inline code spans', () => {
		const { nodes } = parseWikilinks('`` [[fake::id]] `` then [[real::id2]]');
		const links = nodes.filter((n) => n.kind === 'wikilink');
		expect(links).toHaveLength(1);
		expect(links[0]).toMatchObject({ id: 'id2' });
	});
});

describe('parseWikilinks - sourceSpan', () => {
	it('emits half-open [start, end) spans covering the raw input', () => {
		const input = 'hello [[a::b]] world';
		const { nodes } = parseWikilinks(input);
		const link = nodes.find((n) => n.kind === 'wikilink');
		if (!link || link.kind !== 'wikilink') throw new Error('expected wikilink node');
		const [start, end] = link.sourceSpan;
		expect(input.slice(start, end)).toBe('[[a::b]]');
		expect(link.raw).toBe('[[a::b]]');
	});
});

describe('extractWikilinks', () => {
	it('returns just the wikilink nodes', () => {
		const { wikilinks, errors } = extractWikilinks('a [[x::y]] b [[::z]] c');
		expect(errors).toEqual([]);
		expect(wikilinks).toHaveLength(2);
		expect(wikilinks[0]).toMatchObject({ display: 'x', id: 'y' });
		expect(wikilinks[1]).toMatchObject({ display: null, id: 'z' });
	});
});
