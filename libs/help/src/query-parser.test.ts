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

	it('handles unclosed quotes as consuming the rest of the input AND emits a clear warning', () => {
		const result = parseQuery('"foo bar');
		expect(result.freeText).toBe('foo bar');
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]?.code).toBe('unterminated_quote');
		expect(result.warnings[0]?.offset).toBe(0);
		expect(result.warnings[0]?.message).toMatch(/unterminated/i);
	});

	it('emits no warning when quotes are properly closed', () => {
		const result = parseQuery('"foo bar"');
		expect(result.warnings).toEqual([]);
	});

	it('records the offset of the opening quote when unterminated mid-input', () => {
		const result = parseQuery('metar "foo bar');
		expect(result.freeText).toBe('metar foo bar');
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]?.code).toBe('unterminated_quote');
		expect(result.warnings[0]?.offset).toBe(6);
	});

	it('preserves colons inside a quoted phrase (not parsed as a facet)', () => {
		const result = parseQuery('"aim 7-1-1:cruise"');
		expect(result.freeText).toBe('aim 7-1-1:cruise');
		expect(result.filters).toEqual([]);
	});

	it('breaks a bare token on an opening quote (no silent fragmentation across tokens)', () => {
		// Previously: tokenizer kept the `"` inside the bare token, producing
		// `tag:foo"bar` (unknown bare token, fell through to free-text), then a
		// second quoted token `baz`. Now: bare token closes at the `"`, the
		// quote starts a phrase `bar baz`.
		const result = parseQuery('tag:foo"bar baz"');
		expect(filter(result, 'tag')).toEqual(['foo']);
		expect(result.freeText).toBe('bar baz');
		expect(result.warnings).toEqual([]);
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

describe('parseQuery -- doc and mine facets (Phase 2g)', () => {
	it('doc:FAA-H-8083-28 registers as doc filter', () => {
		const result = parseQuery('doc:FAA-H-8083-28 turb');
		expect(filter(result, 'doc')).toEqual(['faa-h-8083-28']);
		expect(result.freeText).toBe('turb');
	});

	it('doc:phak (lower-case alias) registers as doc filter', () => {
		const result = parseQuery('doc:phak weather');
		expect(filter(result, 'doc')).toEqual(['phak']);
		expect(result.freeText).toBe('weather');
	});

	it('bare mine token becomes library:mine', () => {
		const result = parseQuery('mine');
		expect(filter(result, 'library')).toEqual(['mine']);
		expect(result.freeText).toBe('');
	});

	it('Mine (case-insensitive) becomes library:mine', () => {
		const result = parseQuery('Mine');
		expect(filter(result, 'library')).toEqual(['mine']);
	});

	it('library:mine explicit form works too', () => {
		const result = parseQuery('library:mine');
		expect(filter(result, 'library')).toEqual(['mine']);
	});

	it('mine combined with free text', () => {
		const result = parseQuery('mine 91.103');
		expect(filter(result, 'library')).toEqual(['mine']);
		expect(result.freeText).toBe('91.103');
	});
});
