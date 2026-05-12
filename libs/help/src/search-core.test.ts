import {
	BODY_MATCH_TIER,
	DEPTH_PENALTY_PER_LEVEL,
	TITLE_MATCH_TIER,
	TYPE_TIER,
} from '@ab/constants';
import { describe, expect, it } from 'vitest';
import {
	bodyMatchTier,
	bucketFromScore,
	rankBucket,
	rankBucketIndexed,
	scoreResult,
	type SearchResultInput,
	titleMatchTier,
} from './search-core';

describe('rankBucket (legacy 3-bucket shim, retained for back-compat)', () => {
	it('returns 1 on exact title match', () => {
		expect(
			rankBucket({ needle: 'metar', displayName: 'METAR', aliases: [], keywords: [], bodies: [] }),
		).toBe(1);
	});

	it('returns 2 on substring title match', () => {
		expect(
			rankBucket({
				needle: 'metar',
				displayName: 'METAR extended',
				aliases: [],
				keywords: [],
				bodies: [],
			}),
		).toBe(2);
	});

	it('returns 3 on keyword/body match', () => {
		expect(
			rankBucket({
				needle: 'turbulence',
				displayName: 'Air Masses',
				aliases: [],
				keywords: ['turbulence'],
				bodies: [],
			}),
		).toBe(3);
	});

	it('returns null on no match', () => {
		expect(
			rankBucket({ needle: 'xyz', displayName: 'METAR', aliases: [], keywords: [], bodies: [] }),
		).toBeNull();
	});
});

describe('rankBucketIndexed (legacy fast-path)', () => {
	it('returns 1 on exact lowercased title', () => {
		expect(
			rankBucketIndexed({
				needle: 'metar',
				lowerTitle: 'metar',
				lowerAliases: [],
				lowerKeywords: [],
				lowerHaystack: '',
			}),
		).toBe(1);
	});
});

describe('titleMatchTier', () => {
	it('returns EXACT_TITLE on case-insensitive title equality', () => {
		expect(titleMatchTier('weather', 'WEATHER')).toBe(TITLE_MATCH_TIER.EXACT_TITLE);
	});

	it('returns EXACT_ALIAS when an alias matches exactly', () => {
		expect(titleMatchTier('phak', 'Pilot Handbook', ['PHAK'])).toBe(TITLE_MATCH_TIER.EXACT_ALIAS);
	});

	it('returns EXACT_DOC_CODE when needle equals docCode', () => {
		expect(titleMatchTier('FAA-H-8083-28', 'Aviation Weather Handbook', [], 'FAA-H-8083-28')).toBe(
			TITLE_MATCH_TIER.EXACT_DOC_CODE,
		);
	});

	it('returns DOC_CODE_PREFIX when needle is a prefix of docCode', () => {
		expect(titleMatchTier('faa-h-8083', 'Aviation Weather Handbook', [], 'FAA-H-8083-28')).toBe(
			TITLE_MATCH_TIER.DOC_CODE_PREFIX,
		);
	});

	it('returns WHOLE_WORD on word-boundary title match', () => {
		expect(titleMatchTier('weather', 'Aviation Weather Handbook')).toBe(TITLE_MATCH_TIER.WHOLE_WORD);
	});

	it('returns SUBSTRING on infix title match', () => {
		expect(titleMatchTier('weath', 'Aviation Weather Handbook')).toBe(TITLE_MATCH_TIER.SUBSTRING);
	});

	it('returns NONE when no evidence found', () => {
		expect(titleMatchTier('xyz', 'Aviation Weather Handbook')).toBe(TITLE_MATCH_TIER.NONE);
	});

	it('exact-title outranks every other tier when both could apply', () => {
		// Title = needle AND alias = needle: pick EXACT_TITLE not EXACT_ALIAS.
		expect(titleMatchTier('weather', 'Weather', ['Weather'])).toBe(TITLE_MATCH_TIER.EXACT_TITLE);
	});

	it('whole-word check rejects mid-word matches', () => {
		// "rain" is inside "draining" but not as a whole word.
		expect(titleMatchTier('rain', 'Self-draining sumps')).toBe(TITLE_MATCH_TIER.SUBSTRING);
	});
});

describe('bodyMatchTier', () => {
	it('returns KEYWORD_EXACT when keyword equals needle', () => {
		expect(bodyMatchTier('fsrs', 'something', ['fsrs'])).toBe(BODY_MATCH_TIER.KEYWORD_EXACT);
	});

	it('returns BODY_WHOLE_WORD when body has whole-word match', () => {
		expect(bodyMatchTier('weather', 'Discusses weather and turbulence', [])).toBe(
			BODY_MATCH_TIER.BODY_WHOLE_WORD,
		);
	});

	it('returns BODY_SUBSTRING on infix-only body match', () => {
		expect(bodyMatchTier('weath', 'Discusses the weather and turbulence', [])).toBe(
			BODY_MATCH_TIER.BODY_SUBSTRING,
		);
	});

	it('returns NONE on no match', () => {
		expect(bodyMatchTier('xyz', 'About wind and clouds')).toBe(BODY_MATCH_TIER.NONE);
	});

	it('returns NONE on empty body and no keyword match', () => {
		expect(bodyMatchTier('weather', '')).toBe(BODY_MATCH_TIER.NONE);
	});
});

describe('scoreResult - I-2 (broad) composite', () => {
	it('handbook root with whole-word title match outranks chapter with prefix code match', () => {
		const book: SearchResultInput = {
			type: 'faa.handbook',
			title: 'Aviation Weather Handbook',
			docCode: 'FAA-H-8083-28',
		};
		const chapter: SearchResultInput = {
			type: 'faa.handbook.chapter',
			title: 'Chapter 1 of FAA-H-8083-28',
			docCode: 'FAA-H-8083-28-1',
			depth: 1,
		};
		expect(scoreResult('weather', book, 'broad')).toBeGreaterThan(scoreResult('weather', chapter, 'broad'));
	});

	it('exact doc-code match earns EXACT_DOC_CODE + type tier', () => {
		const book: SearchResultInput = {
			type: 'faa.handbook',
			title: 'Aviation Weather Handbook',
			docCode: 'FAA-H-8083-28',
		};
		const score = scoreResult('FAA-H-8083-28', book, 'broad');
		expect(score).toBe(TYPE_TIER['faa.handbook'] + TITLE_MATCH_TIER.EXACT_DOC_CODE);
	});

	it('depth penalty subtracts DEPTH_PENALTY_PER_LEVEL per depth in I-2', () => {
		const shallow: SearchResultInput = { type: 'faa.handbook.chapter', title: 'Ch 1', depth: 1 };
		const deep: SearchResultInput = { type: 'faa.handbook.chapter', title: 'Ch 1', depth: 3 };
		const shallowScore = scoreResult('xxxno-match', shallow, 'broad');
		const deepScore = scoreResult('xxxno-match', deep, 'broad');
		expect(shallowScore - deepScore).toBe(2 * DEPTH_PENALTY_PER_LEVEL);
	});

	it('body match contributes BODY_WHOLE_WORD when title misses', () => {
		const row: SearchResultInput = {
			type: 'airboss.knode',
			title: 'Air Masses',
			body: 'covers turbulence sources',
		};
		const score = scoreResult('turbulence', row, 'broad');
		expect(score).toBe(TYPE_TIER['airboss.knode'] + BODY_MATCH_TIER.BODY_WHOLE_WORD);
	});

	it('unknown type tiers gracefully (score = 0 type contribution)', () => {
		const row = { type: 'something.unknown', title: 'Foo' } as unknown as SearchResultInput;
		expect(scoreResult('foo', row, 'broad')).toBe(TITLE_MATCH_TIER.EXACT_TITLE);
	});
});

describe('scoreResult - I-3 (phrase-FTS) inversion', () => {
	it('inverts the type tier so a section outranks a book', () => {
		const book: SearchResultInput = { type: 'faa.handbook', title: 'AFH' };
		const section: SearchResultInput = { type: 'faa.cfr.sect', title: '14 CFR 1.1', depth: 2 };
		expect(scoreResult('xxxno-match', section, 'phrase-fts')).toBeGreaterThan(
			scoreResult('xxxno-match', book, 'phrase-fts'),
		);
	});

	it('rewards depth in I-3 (deeper = more specific)', () => {
		const shallow: SearchResultInput = { type: 'faa.cfr.sect', title: 'Ch 1', depth: 1 };
		const deep: SearchResultInput = { type: 'faa.cfr.sect', title: 'Ch 1', depth: 3 };
		const shallowScore = scoreResult('xxx', shallow, 'phrase-fts');
		const deepScore = scoreResult('xxx', deep, 'phrase-fts');
		expect(deepScore).toBeGreaterThan(shallowScore);
		expect(deepScore - shallowScore).toBe(2 * DEPTH_PENALTY_PER_LEVEL);
	});

	it('boosts body match (1.5x) in I-3', () => {
		const row: SearchResultInput = {
			type: 'faa.cfr.sect',
			title: 'Ch',
			body: 'discusses dusk and sunset boundaries',
		};
		const bodyOnlyI2 = scoreResult('dusk', row, 'broad');
		const bodyOnlyI3 = scoreResult('dusk', row, 'phrase-fts');
		// I-3 body multiplier is 1.5x, so the body contribution is larger
		// than in I-2 for the same row, even though the type tier inverts.
		const i2Body = bodyOnlyI2 - TYPE_TIER['faa.cfr.sect'] - 0; // title miss
		const i3Body = bodyOnlyI3 - (120 - TYPE_TIER['faa.cfr.sect']) - 0;
		expect(i3Body).toBeGreaterThan(i2Body);
	});
});

describe('scoreResult - I-1 (scoped) composite parity with I-2', () => {
	it('scopes produce the same composite as broad for the same row', () => {
		// The facade filters the candidate set by `doc:` chip; once
		// filtered, scoring proceeds identically to I-2.
		const row: SearchResultInput = {
			type: 'faa.handbook.chapter',
			title: 'Ch 12 -- Weather Theory',
			depth: 1,
		};
		expect(scoreResult('weather', row, 'scoped')).toBe(scoreResult('weather', row, 'broad'));
	});
});

describe('bucketFromScore (back-compat shim)', () => {
	it('returns 1 for scores at or above EXACT_ALIAS', () => {
		expect(bucketFromScore(TITLE_MATCH_TIER.EXACT_ALIAS)).toBe(1);
		expect(bucketFromScore(TITLE_MATCH_TIER.EXACT_TITLE)).toBe(1);
		expect(bucketFromScore(500)).toBe(1);
	});

	it('returns 2 for scores at or above SUBSTRING but below EXACT_ALIAS', () => {
		expect(bucketFromScore(TITLE_MATCH_TIER.SUBSTRING)).toBe(2);
		expect(bucketFromScore(50)).toBe(2);
	});

	it('returns 3 for low positive scores', () => {
		expect(bucketFromScore(5)).toBe(3);
	});

	it('returns null for zero/negative scores', () => {
		expect(bucketFromScore(0)).toBeNull();
		expect(bucketFromScore(-10)).toBeNull();
	});
});
