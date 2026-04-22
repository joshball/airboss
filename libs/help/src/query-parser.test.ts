import { describe, expect, it } from 'vitest';
import { parseQuery } from './query-parser';
import type { FilterKey } from './schema/help-registry';

function filter(parsed: ReturnType<typeof parseQuery>, key: FilterKey): readonly string[] {
	return parsed.filters.find((f) => f.key === key)?.values ?? [];
}

describe('parseQuery - basics', () => {
	it('empty string returns empty freeText + no filters', () => {
		const result = parseQuery('');
		expect(result.freeText).toBe('');
		expect(result.filters).toEqual([]);
	});

	it('whitespace-only returns empty', () => {
		const result = parseQuery('   \t\n  ');
		expect(result.freeText).toBe('');
		expect(result.filters).toEqual([]);
	});

	it('single free-text word', () => {
		const result = parseQuery('metar');
		expect(result.freeText).toBe('metar');
		expect(result.filters).toEqual([]);
	});

	it('multiple free-text words', () => {
		const result = parseQuery('ifr fuel reserves');
		expect(result.freeText).toBe('ifr fuel reserves');
		expect(result.filters).toEqual([]);
	});
});

describe('parseQuery - single filter', () => {
	it('parses tag:weather', () => {
		const result = parseQuery('tag:weather');
		expect(result.freeText).toBe('');
		expect(filter(result, 'tag')).toEqual(['weather']);
	});

	it('parses source:cfr', () => {
		expect(filter(parseQuery('source:cfr'), 'source')).toEqual(['cfr']);
	});

	it('parses rules:ifr', () => {
		expect(filter(parseQuery('rules:ifr'), 'rules')).toEqual(['ifr']);
	});

	it('parses kind:concept', () => {
		expect(filter(parseQuery('kind:concept'), 'kind')).toEqual(['concept']);
	});

	it('parses surface:dashboard', () => {
		expect(filter(parseQuery('surface:dashboard'), 'surface')).toEqual(['dashboard']);
	});

	it('parses lib:help', () => {
		expect(filter(parseQuery('lib:help'), 'lib')).toEqual(['help']);
	});

	it('facet key is case-insensitive', () => {
		expect(filter(parseQuery('TAG:weather'), 'tag')).toEqual(['weather']);
		expect(filter(parseQuery('Tag:Weather'), 'tag')).toEqual(['weather']);
	});

	it('facet value is lowercased', () => {
		expect(filter(parseQuery('tag:WEATHER'), 'tag')).toEqual(['weather']);
	});
});

describe('parseQuery - multi filter', () => {
	it('combines tag + rules', () => {
		const result = parseQuery('tag:weather rules:ifr');
		expect(filter(result, 'tag')).toEqual(['weather']);
		expect(filter(result, 'rules')).toEqual(['ifr']);
	});

	it('parses comma-separated values as OR within a facet', () => {
		const result = parseQuery('tag:weather,navigation');
		expect(filter(result, 'tag')).toEqual(['weather', 'navigation']);
	});

	it('merges duplicate keys into one filter with de-duped values', () => {
		const result = parseQuery('tag:weather tag:ifr tag:weather');
		expect(filter(result, 'tag')).toEqual(['weather', 'ifr']);
	});
});

describe('parseQuery - mixed', () => {
	it('mixes free-text with filters', () => {
		const result = parseQuery('metar source:cfr');
		expect(result.freeText).toBe('metar');
		expect(filter(result, 'source')).toEqual(['cfr']);
	});

	it('preserves free-text order when mixed with filters', () => {
		const result = parseQuery('reading source:aim metars');
		expect(result.freeText).toBe('reading metars');
	});
});

describe('parseQuery - quoted phrases', () => {
	it('treats quoted text as a single freeText token', () => {
		const result = parseQuery('"fuel reserves"');
		expect(result.freeText).toBe('fuel reserves');
		expect(result.filters).toEqual([]);
	});

	it('combines quoted phrase with filters', () => {
		const result = parseQuery('source:cfr "fuel reserves"');
		expect(result.freeText).toBe('fuel reserves');
		expect(filter(result, 'source')).toEqual(['cfr']);
	});

	it('handles unclosed quotes as consuming the rest of the input', () => {
		const result = parseQuery('"foo bar');
		expect(result.freeText).toBe('foo bar');
	});

	it('preserves colons inside a quoted phrase (not parsed as a facet)', () => {
		const result = parseQuery('"aim 7-1-1:cruise"');
		expect(result.freeText).toBe('aim 7-1-1:cruise');
		expect(result.filters).toEqual([]);
	});
});

describe('parseQuery - unknown keys degrade to free-text', () => {
	it('unknown facet key falls through as freeText', () => {
		const result = parseQuery('foo:bar');
		expect(result.freeText).toBe('foo:bar');
		expect(result.filters).toEqual([]);
	});

	it('mixes unknown-facet token with valid facet', () => {
		const result = parseQuery('foo:bar tag:weather');
		expect(result.freeText).toBe('foo:bar');
		expect(filter(result, 'tag')).toEqual(['weather']);
	});
});

describe('parseQuery - escape rules', () => {
	it('backslash colon is a literal colon in bare tokens', () => {
		const result = parseQuery('foo\\:bar');
		expect(result.freeText).toBe('foo:bar');
		expect(result.filters).toEqual([]);
	});

	it('backslash comma inside a facet value is literal', () => {
		const result = parseQuery('tag:weather\\,ifr');
		expect(filter(result, 'tag')).toEqual(['weather,ifr']);
	});

	it('double backslash renders as a single backslash', () => {
		const result = parseQuery('foo\\\\bar');
		expect(result.freeText).toBe('foo\\bar');
	});
});

describe('parseQuery - edge whitespace + empty values', () => {
	it('trims leading and trailing whitespace', () => {
		const result = parseQuery('  tag:weather  ');
		expect(filter(result, 'tag')).toEqual(['weather']);
		expect(result.freeText).toBe('');
	});

	it('ignores empty facet values', () => {
		const result = parseQuery('tag:');
		expect(result.filters).toEqual([]);
		// The original bare token degrades to free-text `tag:` after tokenize,
		// but since empty-values are dropped, the facet is not registered; the
		// token still contributes freeText.
		expect(result.freeText).toBe('tag:');
	});

	it('drops empty entries in comma list', () => {
		const result = parseQuery('tag:weather,,ifr');
		expect(filter(result, 'tag')).toEqual(['weather', 'ifr']);
	});
});
