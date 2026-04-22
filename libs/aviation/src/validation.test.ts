import {
	AVIATION_TOPICS,
	CERT_APPLICABILITIES,
	FLIGHT_RULES,
	KNOWLEDGE_KINDS,
	REFERENCE_PHASES_OF_FLIGHT,
	REFERENCE_SOURCE_TYPES,
} from '@ab/constants';
import { describe, expect, it } from 'vitest';
import type { Reference } from './schema/reference';
import { validateContentWikilinks, validateReferences } from './validation';

function makeRef(overrides: Partial<Reference> = {}): Reference {
	return {
		id: 'cfr-14-91-155',
		displayName: '14 CFR 91.155',
		aliases: ['VFR minimums'],
		tags: {
			sourceType: REFERENCE_SOURCE_TYPES.CFR,
			aviationTopic: [AVIATION_TOPICS.REGULATIONS, AVIATION_TOPICS.WEATHER],
			flightRules: FLIGHT_RULES.VFR,
			knowledgeKind: KNOWLEDGE_KINDS.REGULATION,
		},
		paraphrase: 'VFR weather minimums by airspace class.',
		sources: [{ sourceId: 'cfr-14', locator: { title: 14, part: 91, section: '155' } }],
		related: [],
		...overrides,
	};
}

describe('validateReferences - clean input', () => {
	it('returns no errors or warnings on a valid reference', () => {
		const result = validateReferences([makeRef()]);
		expect(result.errors).toEqual([]);
		expect(result.warnings).toEqual([]);
	});
});

describe('validateReferences - required-axis gates', () => {
	it('errors when aviationTopic is missing', () => {
		// biome-ignore lint/suspicious/noExplicitAny: test fixture uses intentional bad shape
		const bad = makeRef({ tags: { ...makeRef().tags, aviationTopic: [] as any } });
		const { errors } = validateReferences([bad]);
		expect(errors.some((e) => /aviationTopic/i.test(e.message))).toBe(true);
	});

	it('errors when aviationTopic exceeds 4', () => {
		const bad = makeRef({
			tags: {
				...makeRef().tags,
				aviationTopic: [
					AVIATION_TOPICS.REGULATIONS,
					AVIATION_TOPICS.WEATHER,
					AVIATION_TOPICS.NAVIGATION,
					AVIATION_TOPICS.PROCEDURES,
					AVIATION_TOPICS.AIRSPACE,
				],
			},
		});
		const { errors } = validateReferences([bad]);
		expect(errors.some((e) => /aviationTopic/i.test(e.message))).toBe(true);
	});

	it('errors on duplicate aviationTopic entries', () => {
		const bad = makeRef({
			tags: { ...makeRef().tags, aviationTopic: [AVIATION_TOPICS.WEATHER, AVIATION_TOPICS.WEATHER] },
		});
		const { errors } = validateReferences([bad]);
		expect(errors.some((e) => /duplicate aviationTopic/i.test(e.message))).toBe(true);
	});

	it('errors on invalid flightRules value', () => {
		// biome-ignore lint/suspicious/noExplicitAny: deliberate bad value
		const bad = makeRef({ tags: { ...makeRef().tags, flightRules: 'made-up' as any } });
		const { errors } = validateReferences([bad]);
		expect(errors.some((e) => /flightRules/i.test(e.message))).toBe(true);
	});
});

describe('validateReferences - conditional phase-of-flight', () => {
	it('errors when knowledgeKind=procedure without phaseOfFlight', () => {
		const bad = makeRef({
			tags: { ...makeRef().tags, knowledgeKind: KNOWLEDGE_KINDS.PROCEDURE },
		});
		const { errors } = validateReferences([bad]);
		expect(errors.some((e) => /phaseOfFlight/i.test(e.message))).toBe(true);
	});

	it('errors when sourceType=aim without phaseOfFlight', () => {
		const bad = makeRef({
			tags: { ...makeRef().tags, sourceType: REFERENCE_SOURCE_TYPES.AIM },
		});
		const { errors } = validateReferences([bad]);
		expect(errors.some((e) => /phaseOfFlight/i.test(e.message))).toBe(true);
	});

	it('passes when phaseOfFlight is provided for a procedure', () => {
		const good = makeRef({
			tags: {
				...makeRef().tags,
				knowledgeKind: KNOWLEDGE_KINDS.PROCEDURE,
				phaseOfFlight: [REFERENCE_PHASES_OF_FLIGHT.APPROACH],
			},
		});
		expect(validateReferences([good]).errors).toEqual([]);
	});

	it('errors when phaseOfFlight exceeds 3 entries', () => {
		const bad = makeRef({
			tags: {
				...makeRef().tags,
				phaseOfFlight: [
					REFERENCE_PHASES_OF_FLIGHT.APPROACH,
					REFERENCE_PHASES_OF_FLIGHT.LANDING,
					REFERENCE_PHASES_OF_FLIGHT.CLIMB,
					REFERENCE_PHASES_OF_FLIGHT.CRUISE,
				],
			},
		});
		const { errors } = validateReferences([bad]);
		expect(errors.some((e) => /phaseOfFlight/i.test(e.message))).toBe(true);
	});
});

describe('validateReferences - keywords + zombies', () => {
	it('errors on banned zombie keyword', () => {
		const bad = makeRef({ tags: { ...makeRef().tags, keywords: ['cfi-knowledge'] } });
		const { errors } = validateReferences([bad]);
		expect(errors.some((e) => /zombie/i.test(e.message))).toBe(true);
	});

	it('errors on empty keyword', () => {
		const bad = makeRef({ tags: { ...makeRef().tags, keywords: [''] } });
		const { errors } = validateReferences([bad]);
		expect(errors.some((e) => /empty keyword/i.test(e.message))).toBe(true);
	});

	it('errors when keyword exceeds max length', () => {
		const bad = makeRef({ tags: { ...makeRef().tags, keywords: ['a'.repeat(41)] } });
		const { errors } = validateReferences([bad]);
		expect(errors.some((e) => /exceeds/i.test(e.message))).toBe(true);
	});

	it('accepts valid certApplicability + keyword combo', () => {
		const good = makeRef({
			tags: {
				...makeRef().tags,
				certApplicability: [CERT_APPLICABILITIES.INSTRUMENT],
				keywords: ['svfr', 'vmc'],
			},
		});
		expect(validateReferences([good]).errors).toEqual([]);
	});
});

describe('validateReferences - verbatim / sources / ids', () => {
	it('errors when verbatim is present without sources[]', () => {
		const bad = makeRef({
			verbatim: { text: 'x', sourceVersion: 'v1', extractedAt: '2026-01-01' },
			sources: [],
		});
		const { errors } = validateReferences([bad]);
		expect(errors.some((e) => /verbatim.*sources/i.test(e.message))).toBe(true);
	});

	it('errors on duplicate ids', () => {
		const { errors } = validateReferences([makeRef(), makeRef({ related: [] })]);
		expect(errors.some((e) => /Duplicate/i.test(e.message))).toBe(true);
	});

	it('errors on sources[] with empty sourceId', () => {
		const bad = makeRef({ sources: [{ sourceId: '', locator: {} }] });
		const { errors } = validateReferences([bad]);
		expect(errors.some((e) => /sourceId/i.test(e.message))).toBe(true);
	});

	it('errors when sources[].sourceId is not registered in SOURCES', () => {
		const bad = makeRef({
			sources: [{ sourceId: 'not-a-real-source-id', locator: { title: 14, part: 91, section: '155' } }],
		});
		const { errors } = validateReferences([bad]);
		expect(errors.some((e) => /unregistered sourceId/i.test(e.message))).toBe(true);
	});

	it('passes when sources[].sourceId resolves against SOURCES', () => {
		const good = makeRef({
			sources: [{ sourceId: 'cfr-14', locator: { title: 14, part: 91, section: '155' } }],
		});
		const result = validateReferences([good]);
		expect(result.errors).toEqual([]);
	});
});

describe('validateReferences - related[] symmetry', () => {
	it('errors when related pointer is not reciprocated', () => {
		const a = makeRef({ id: 'a', displayName: 'A', related: ['b'], aliases: [] });
		const b = makeRef({ id: 'b', displayName: 'B', related: [], aliases: [] });
		const { errors } = validateReferences([a, b]);
		expect(errors.some((e) => /asymmetric/i.test(e.message))).toBe(true);
	});

	it('errors when related id is unknown', () => {
		const a = makeRef({ id: 'a', related: ['missing'], aliases: [] });
		const { errors } = validateReferences([a]);
		expect(errors.some((e) => /not in the registry/i.test(e.message))).toBe(true);
	});

	it('errors when a reference lists itself', () => {
		const a = makeRef({ id: 'a', related: ['a'], aliases: [] });
		const { errors } = validateReferences([a]);
		expect(errors.some((e) => /itself/i.test(e.message))).toBe(true);
	});

	it('passes on symmetric related[]', () => {
		const a = makeRef({ id: 'a', displayName: 'A', related: ['b'], aliases: [] });
		const b = makeRef({ id: 'b', displayName: 'B', related: ['a'], aliases: [] });
		expect(validateReferences([a, b]).errors).toEqual([]);
	});
});

describe('validateReferences - reviewedAt staleness warning', () => {
	it('warns when reviewedAt is > 12 months old', () => {
		const old = makeRef({ reviewedAt: '2022-01-01' });
		const result = validateReferences([old]);
		expect(result.warnings.some((w) => /12 months/i.test(w.message))).toBe(true);
	});

	it('does not warn on a recent reviewedAt', () => {
		const recent = makeRef({ reviewedAt: new Date().toISOString() });
		const result = validateReferences([recent]);
		expect(result.warnings).toEqual([]);
	});
});

describe('validateContentWikilinks', () => {
	it('errors on broken `[[::id]]` links', () => {
		const result = validateContentWikilinks([{ path: 'course/x.md', source: 'body: [[::unknown-id]] here' }], {
			hasReference: () => false,
			knownIds: [],
		});
		expect(result.errors.some((e) => /unknown reference id/i.test(e.message))).toBe(true);
	});

	it('warns but does not error on `[[text::]]` TBD links', () => {
		const result = validateContentWikilinks([{ path: 'course/y.md', source: 'body: [[future term::]] here' }], {
			hasReference: () => true,
			knownIds: [],
		});
		expect(result.errors).toEqual([]);
		expect(result.warnings.some((w) => /TBD-id/i.test(w.message))).toBe(true);
	});

	it('errors on malformed `[[::]]`', () => {
		const result = validateContentWikilinks([{ path: 'course/z.md', source: 'body: [[::]] bad' }], {
			hasReference: () => true,
			knownIds: [],
		});
		expect(result.errors.some((e) => /Empty wiki-link/i.test(e.message))).toBe(true);
	});

	it('passes cleanly when every id resolves', () => {
		const result = validateContentWikilinks([{ path: 'course/q.md', source: 'body: [[Link::known-id]] here' }], {
			hasReference: (id) => id === 'known-id',
			knownIds: ['known-id'],
		});
		expect(result.errors).toEqual([]);
		expect(result.warnings).toEqual([]);
		expect(result.summary.linkCount).toBe(1);
		expect(result.summary.citedIds.has('known-id')).toBe(true);
	});

	it('warns on orphan references (registered, uncited)', () => {
		const result = validateContentWikilinks([{ path: 'c.md', source: 'no links here' }], {
			hasReference: () => true,
			knownIds: ['orphan-id'],
		});
		expect(result.warnings.some((w) => /orphan/i.test(w.message))).toBe(true);
	});
});
