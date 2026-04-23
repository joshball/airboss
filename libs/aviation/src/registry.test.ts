import { AVIATION_TOPICS, FLIGHT_RULES, KNOWLEDGE_KINDS, REFERENCE_SOURCE_TYPES } from '@ab/constants';
import { beforeEach, describe, expect, it } from 'vitest';
import {
	__resetRegistryForTests,
	axisCounts,
	countReferences,
	findByTags,
	getReferenceById,
	getReferenceByTerm,
	hasReference,
	listReferences,
	registerReferences,
	search,
} from './registry';
import type { Reference } from './schema/reference';

function makeRef(overrides: Partial<Reference>): Reference {
	return {
		id: 'ref-1',
		displayName: 'Sample',
		aliases: [],
		tags: {
			sourceType: REFERENCE_SOURCE_TYPES.CFR,
			aviationTopic: [AVIATION_TOPICS.REGULATIONS],
			flightRules: FLIGHT_RULES.BOTH,
			knowledgeKind: KNOWLEDGE_KINDS.DEFINITION,
		},
		paraphrase: 'Paraphrase.',
		sources: [],
		related: [],
		...overrides,
	};
}

beforeEach(() => {
	__resetRegistryForTests();
});

describe('registry - register + lookup', () => {
	it('registers and looks up by id', () => {
		registerReferences([makeRef({ id: 'a' })]);
		expect(hasReference('a')).toBe(true);
		expect(getReferenceById('a')?.id).toBe('a');
		expect(getReferenceById('missing')).toBeUndefined();
		expect(countReferences()).toBe(1);
	});

	it('registers and looks up by displayName and alias (case-insensitive)', () => {
		registerReferences([makeRef({ id: 'a', displayName: 'VFR Minimums', aliases: ['svfr'] })]);
		expect(getReferenceByTerm('vfr minimums')?.id).toBe('a');
		expect(getReferenceByTerm('SVFR')?.id).toBe('a');
	});

	it('throws on duplicate id', () => {
		const refs = [makeRef({ id: 'dup' }), makeRef({ id: 'dup', displayName: 'other' })];
		expect(() => registerReferences(refs)).toThrow(/duplicate id/);
	});

	it('listReferences returns in registration order', () => {
		registerReferences([makeRef({ id: 'a' }), makeRef({ id: 'b' })]);
		expect(listReferences().map((r) => r.id)).toEqual(['a', 'b']);
	});
});

describe('registry - findByTags', () => {
	beforeEach(() => {
		registerReferences([
			makeRef({
				id: 'cfr-weather',
				tags: {
					sourceType: REFERENCE_SOURCE_TYPES.CFR,
					aviationTopic: [AVIATION_TOPICS.WEATHER, AVIATION_TOPICS.REGULATIONS],
					flightRules: FLIGHT_RULES.VFR,
					knowledgeKind: KNOWLEDGE_KINDS.REGULATION,
				},
			}),
			makeRef({
				id: 'aim-ifr',
				tags: {
					sourceType: REFERENCE_SOURCE_TYPES.AIM,
					aviationTopic: [AVIATION_TOPICS.PROCEDURES],
					flightRules: FLIGHT_RULES.IFR,
					knowledgeKind: KNOWLEDGE_KINDS.PROCEDURE,
				},
			}),
		]);
	});

	it('filters by single axis', () => {
		const ids = findByTags({ flightRules: FLIGHT_RULES.VFR }).map((r) => r.id);
		expect(ids).toEqual(['cfr-weather']);
	});

	it('intersects multi-axis filters', () => {
		const ids = findByTags({
			sourceType: REFERENCE_SOURCE_TYPES.CFR,
			aviationTopic: [AVIATION_TOPICS.REGULATIONS, AVIATION_TOPICS.WEATHER],
		}).map((r) => r.id);
		expect(ids).toEqual(['cfr-weather']);
	});

	it('returns empty when a filter value is not represented', () => {
		expect(findByTags({ flightRules: FLIGHT_RULES.NA })).toEqual([]);
	});

	it('returns all when no filters', () => {
		expect(findByTags({}).length).toBe(2);
	});
});

describe('registry - search + axisCounts', () => {
	beforeEach(() => {
		registerReferences([
			makeRef({
				id: 'metar',
				displayName: 'METAR',
				aliases: ['wx report'],
				tags: {
					sourceType: REFERENCE_SOURCE_TYPES.AIM,
					aviationTopic: [AVIATION_TOPICS.WEATHER],
					flightRules: FLIGHT_RULES.BOTH,
					knowledgeKind: KNOWLEDGE_KINDS.DEFINITION,
				},
			}),
		]);
	});

	it('text search matches displayName, alias, keywords', () => {
		expect(search({ text: 'metar' }).map((h) => h.reference.id)).toEqual(['metar']);
		expect(search({ text: 'wx report' }).map((h) => h.reference.id)).toEqual(['metar']);
		expect(search({ text: 'unknown' })).toEqual([]);
	});

	it('ranks displayName/alias/keyword matches by tier and tiebreaks by length then order', () => {
		__resetRegistryForTests();
		registerReferences([
			makeRef({
				id: 'faa',
				displayName: 'FAA',
				aliases: ['Federal Aviation Administration'],
				tags: {
					sourceType: REFERENCE_SOURCE_TYPES.AIM,
					aviationTopic: [AVIATION_TOPICS.REGULATIONS],
					flightRules: FLIGHT_RULES.BOTH,
					knowledgeKind: KNOWLEDGE_KINDS.DEFINITION,
				},
			}),
			makeRef({
				id: 'tsa',
				displayName: 'TSA',
				aliases: ['Transportation Security Administration'],
				tags: {
					sourceType: REFERENCE_SOURCE_TYPES.AIM,
					aviationTopic: [AVIATION_TOPICS.REGULATIONS],
					flightRules: FLIGHT_RULES.BOTH,
					knowledgeKind: KNOWLEDGE_KINDS.DEFINITION,
				},
			}),
			makeRef({
				id: 'administrator',
				displayName: 'Administrator',
				aliases: [],
				tags: {
					sourceType: REFERENCE_SOURCE_TYPES.AIM,
					aviationTopic: [AVIATION_TOPICS.REGULATIONS],
					flightRules: FLIGHT_RULES.BOTH,
					knowledgeKind: KNOWLEDGE_KINDS.DEFINITION,
				},
			}),
			makeRef({
				id: 'adm',
				displayName: 'ADM',
				aliases: [],
				tags: {
					sourceType: REFERENCE_SOURCE_TYPES.AIM,
					aviationTopic: [AVIATION_TOPICS.REGULATIONS],
					flightRules: FLIGHT_RULES.BOTH,
					knowledgeKind: KNOWLEDGE_KINDS.DEFINITION,
				},
			}),
		]);

		const hits = search({ text: 'adm' });
		expect(hits.map((h) => h.reference.id)).toEqual(['adm', 'administrator', 'faa', 'tsa']);

		const [admHit, adminHit, faaHit, tsaHit] = hits;
		expect(admHit.matchedField).toBe('displayName');
		expect(admHit.matchedText).toBe('ADM');
		expect(admHit.matchRange).toEqual([0, 3]);
		expect(admHit.score).toBe(100);

		expect(adminHit.matchedField).toBe('displayName');
		expect(adminHit.matchedText).toBe('Administrator');
		expect(adminHit.matchRange).toEqual([0, 3]);
		expect(adminHit.score).toBe(80);

		expect(faaHit.matchedField).toBe('alias');
		expect(faaHit.matchedText).toBe('Federal Aviation Administration');
		expect(faaHit.matchRange).toEqual(['Federal Aviation '.length, 'Federal Aviation '.length + 3]);
		expect(faaHit.score).toBe(40);

		expect(tsaHit.matchedField).toBe('alias');
		expect(tsaHit.matchedText).toBe('Transportation Security Administration');
		expect(tsaHit.score).toBe(40);
	});

	it('counts axis values', () => {
		const counts = axisCounts();
		expect(counts.sourceType.aim).toBe(1);
		expect(counts.aviationTopic.weather).toBe(1);
		expect(counts.flightRules.both).toBe(1);
	});
});
