import { __resetRegistryForTests, type Reference, registerReferences } from '@ab/aviation';
import { AVIATION_TOPICS, FLIGHT_RULES, KNOWLEDGE_KINDS, REFERENCE_SOURCE_TYPES } from '@ab/constants';
import { beforeEach, describe, expect, it } from 'vitest';
import { classifyIntent, hasAnyTitlePrefixMatch, isQuotedPhrase, wordCount } from './intent-classifier';
import { parseQuery } from './query-parser';
import type { ParsedQuery } from './schema/help-registry';

function makeRef(overrides: Partial<Reference>): Reference {
	return {
		id: 'ref-1',
		displayName: 'Sample',
		aliases: [],
		tags: {
			sourceType: REFERENCE_SOURCE_TYPES.AUTHORED,
			aviationTopic: [AVIATION_TOPICS.REGULATIONS],
			flightRules: FLIGHT_RULES.BOTH,
			knowledgeKind: KNOWLEDGE_KINDS.DEFINITION,
		},
		paraphrase: '',
		sources: [],
		related: [],
		...overrides,
	};
}

function emptyParsed(): ParsedQuery {
	return { freeText: '', filters: [], warnings: [] };
}

beforeEach(() => {
	__resetRegistryForTests();
});

describe('wordCount', () => {
	it('returns 0 for empty / whitespace-only text', () => {
		expect(wordCount('')).toBe(0);
		expect(wordCount('   ')).toBe(0);
	});

	it('counts single words', () => {
		expect(wordCount('weather')).toBe(1);
	});

	it('counts space-separated words', () => {
		expect(wordCount('aviation weather')).toBe(2);
		expect(wordCount('aviation weather handbook')).toBe(3);
		expect(wordCount('aviation weather currency rules')).toBe(4);
	});

	it('collapses runs of whitespace', () => {
		expect(wordCount('aviation   weather')).toBe(2);
		expect(wordCount('\taviation\nweather')).toBe(2);
	});
});

describe('isQuotedPhrase', () => {
	it('returns false for unquoted text', () => {
		expect(isQuotedPhrase('weather')).toBe(false);
		expect(isQuotedPhrase('aviation weather handbook')).toBe(false);
	});

	it('returns true when free-text contains a double quote', () => {
		expect(isQuotedPhrase('"VFR minimums"')).toBe(true);
	});
});

describe('hasAnyTitlePrefixMatch', () => {
	it('returns true on empty needle (broad fallback)', () => {
		expect(hasAnyTitlePrefixMatch('')).toBe(true);
	});

	it('returns true on short needles below min length (broad fallback)', () => {
		expect(hasAnyTitlePrefixMatch('avi')).toBe(true);
		expect(hasAnyTitlePrefixMatch('a')).toBe(true);
	});

	it('returns true when a registered displayName prefix-matches', () => {
		registerReferences([makeRef({ id: 'r1', displayName: 'Aviation Weather Handbook' })]);
		expect(hasAnyTitlePrefixMatch('aviation')).toBe(true);
		expect(hasAnyTitlePrefixMatch('AVIATION')).toBe(true);
	});

	it('returns true when an alias prefix-matches', () => {
		registerReferences([makeRef({ id: 'r1', displayName: 'Foo', aliases: ['Aviation Weather Handbook'] })]);
		expect(hasAnyTitlePrefixMatch('aviation')).toBe(true);
	});

	it('returns false when no displayName or alias prefix-matches', () => {
		registerReferences([makeRef({ id: 'r1', displayName: 'Pilot Handbook' })]);
		expect(hasAnyTitlePrefixMatch('dusk vs sunset')).toBe(false);
	});

	it('is case-insensitive', () => {
		registerReferences([makeRef({ id: 'r1', displayName: 'METAR Decoded' })]);
		expect(hasAnyTitlePrefixMatch('metar')).toBe(true);
		expect(hasAnyTitlePrefixMatch('METAR')).toBe(true);
	});
});

describe('classifyIntent - I-1 scoped', () => {
	it('returns scoped when doc: filter is present', () => {
		const parsed = parseQuery('doc:FAA-H-8083-28 weather');
		expect(classifyIntent(parsed, false)).toBe('scoped');
	});

	it('returns scoped even with no free text when doc filter set', () => {
		const parsed = parseQuery('doc:phak');
		expect(classifyIntent(parsed, false)).toBe('scoped');
	});

	it('returns scoped when autocompleteCommitted is true (chip pending)', () => {
		const parsed = parseQuery('weather');
		expect(classifyIntent(parsed, true)).toBe('scoped');
	});

	it('doc: chip wins over a long query that would otherwise be phrase-fts', () => {
		const parsed = parseQuery('doc:avwx aviation weather currency rules');
		expect(classifyIntent(parsed, false)).toBe('scoped');
	});
});

describe('classifyIntent - I-3 phrase-fts', () => {
	beforeEach(() => {
		registerReferences([
			makeRef({ id: 'r-weather', displayName: 'Aviation Weather Handbook' }),
			makeRef({ id: 'r-pilot', displayName: 'Pilot Handbook' }),
		]);
	});

	it('returns phrase-fts when free-text contains a quoted phrase marker', () => {
		const parsed: ParsedQuery = { freeText: '"VFR minimums"', filters: [], warnings: [] };
		expect(classifyIntent(parsed, false)).toBe('phrase-fts');
	});

	it('returns phrase-fts at the 4-word threshold', () => {
		const parsed: ParsedQuery = {
			freeText: 'aviation weather currency rules',
			filters: [],
			warnings: [],
		};
		expect(wordCount(parsed.freeText)).toBe(4);
		expect(classifyIntent(parsed, false)).toBe('phrase-fts');
	});

	it('returns phrase-fts above the 4-word threshold', () => {
		const parsed: ParsedQuery = {
			freeText: 'when does dusk become night per CFR',
			filters: [],
			warnings: [],
		};
		expect(classifyIntent(parsed, false)).toBe('phrase-fts');
	});

	it('returns phrase-fts when no title prefix-matches a long-enough needle', () => {
		const parsed: ParsedQuery = { freeText: 'turbulence', filters: [], warnings: [] };
		expect(classifyIntent(parsed, false)).toBe('phrase-fts');
	});

	it('returns phrase-fts for "dusk vs sunset" (3 words, no title match)', () => {
		const parsed: ParsedQuery = { freeText: 'dusk vs sunset', filters: [], warnings: [] };
		expect(classifyIntent(parsed, false)).toBe('phrase-fts');
	});
});

describe('classifyIntent - I-2 broad', () => {
	beforeEach(() => {
		registerReferences([
			makeRef({ id: 'r-weather', displayName: 'Aviation Weather Handbook' }),
			makeRef({ id: 'r-pilot', displayName: 'Pilot Handbook' }),
		]);
	});

	it('returns broad for a short single-word title-prefix match', () => {
		const parsed: ParsedQuery = { freeText: 'aviation', filters: [], warnings: [] };
		expect(classifyIntent(parsed, false)).toBe('broad');
	});

	it('returns broad for a 2-word title-prefix match', () => {
		const parsed: ParsedQuery = { freeText: 'aviation weather', filters: [], warnings: [] };
		expect(classifyIntent(parsed, false)).toBe('broad');
	});

	it('returns broad just below the phrase-fts word-count threshold', () => {
		const parsed: ParsedQuery = { freeText: 'aviation weather handbook', filters: [], warnings: [] };
		expect(wordCount(parsed.freeText)).toBe(3);
		expect(classifyIntent(parsed, false)).toBe('broad');
	});

	it('returns broad on empty free-text (no doc chip, no quotes)', () => {
		expect(classifyIntent(emptyParsed(), false)).toBe('broad');
	});

	it('returns broad on short keystrokes below title-prefix min length', () => {
		// "avi" is below TITLE_PREFIX_MIN_NEEDLE_LENGTH (4), so the prefix
		// scan returns true by fallback and the intent is broad.
		const parsed: ParsedQuery = { freeText: 'avi', filters: [], warnings: [] };
		expect(classifyIntent(parsed, false)).toBe('broad');
	});
});

describe('classifyIntent - edge cases', () => {
	it('doc: with quoted phrase still routes to scoped', () => {
		registerReferences([makeRef({ id: 'r', displayName: 'Sample' })]);
		const parsed: ParsedQuery = {
			freeText: '"airspace"',
			filters: [{ key: 'doc', values: ['phak'] }],
			warnings: [],
		};
		expect(classifyIntent(parsed, false)).toBe('scoped');
	});

	it('whitespace-only free text behaves as empty (broad)', () => {
		const parsed: ParsedQuery = { freeText: '    ', filters: [], warnings: [] };
		expect(classifyIntent(parsed, false)).toBe('broad');
	});

	it('5-word query routes to phrase-fts regardless of title prefix', () => {
		registerReferences([makeRef({ id: 'r', displayName: 'Aviation Weather Handbook' })]);
		const parsed: ParsedQuery = {
			freeText: 'aviation weather handbook chapter twelve',
			filters: [],
			warnings: [],
		};
		expect(classifyIntent(parsed, false)).toBe('phrase-fts');
	});
});
