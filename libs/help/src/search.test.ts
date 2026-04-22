import { __resetRegistryForTests, type Reference, registerReferences } from '@ab/aviation';
import {
	APP_SURFACES,
	AVIATION_TOPICS,
	FLIGHT_RULES,
	HELP_KINDS,
	KNOWLEDGE_KINDS,
	REFERENCE_SOURCE_TYPES,
} from '@ab/constants';
import { beforeEach, describe, expect, it } from 'vitest';
import { helpRegistry } from './registry';
import type { HelpPage } from './schema/help-page';
import { search } from './search';

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
		paraphrase: 'Paraphrase text.',
		sources: [],
		related: [],
		...overrides,
	};
}

function makePage(overrides: Partial<HelpPage>): HelpPage {
	return {
		id: 'page-1',
		title: 'Sample page',
		summary: 'Summary text.',
		tags: { appSurface: [APP_SURFACES.GLOBAL], helpKind: HELP_KINDS.CONCEPT },
		sections: [{ id: 'lede', title: 'Lede', body: 'Body.' }],
		...overrides,
	};
}

beforeEach(() => {
	__resetRegistryForTests();
	helpRegistry.clear();
});

describe('search - bucket separation', () => {
	it('returns aviation + help buckets independently', () => {
		registerReferences([
			makeRef({ id: 'term-metar', displayName: 'METAR', aliases: ['aviation routine weather report'] }),
		]);
		helpRegistry.registerPages('study', [
			makePage({ id: 'metar-help', title: 'Reading METARs', summary: 'How to parse a METAR.' }),
		]);

		const result = search('metar');
		expect(result.aviation.map((r) => r.id)).toContain('term-metar');
		expect(result.help.map((r) => r.id)).toContain('metar-help');
		for (const r of result.aviation) expect(r.library).toBe('aviation');
		for (const r of result.help) expect(r.library).toBe('help');
	});
});

describe('search - within-bucket ranking', () => {
	it('aviation exact displayName hit beats substring hit', () => {
		registerReferences([
			makeRef({ id: 'term-metar', displayName: 'METAR' }),
			makeRef({ id: 'term-metar-long', displayName: 'METAR extended briefing' }),
		]);
		const result = search('metar');
		expect(result.aviation[0]?.id).toBe('term-metar');
		expect(result.aviation[0]?.rankBucket).toBe(1);
		expect(result.aviation[1]?.id).toBe('term-metar-long');
		expect(result.aviation[1]?.rankBucket).toBe(2);
	});

	it('alias exact hit ranks in bucket 1 too', () => {
		registerReferences([
			makeRef({ id: 'term-metar', displayName: 'Aviation Routine Weather Report', aliases: ['metar'] }),
		]);
		const result = search('metar');
		expect(result.aviation[0]?.rankBucket).toBe(1);
	});

	it('keyword hit ranks in bucket 3', () => {
		registerReferences([
			makeRef({
				id: 'term-fsrs',
				displayName: 'Spaced Repetition Scheduler',
				tags: {
					sourceType: REFERENCE_SOURCE_TYPES.AUTHORED,
					aviationTopic: [AVIATION_TOPICS.TRAINING_OPS],
					flightRules: FLIGHT_RULES.NA,
					knowledgeKind: KNOWLEDGE_KINDS.CONCEPT,
					keywords: ['fsrs'],
				},
			}),
		]);
		const result = search('fsrs');
		expect(result.aviation[0]?.rankBucket).toBe(3);
	});
});

describe('search - filter combinations', () => {
	beforeEach(() => {
		registerReferences([
			makeRef({
				id: 'cfr-91-155',
				displayName: '14 CFR 91.155',
				tags: {
					sourceType: REFERENCE_SOURCE_TYPES.CFR,
					aviationTopic: [AVIATION_TOPICS.WEATHER, AVIATION_TOPICS.REGULATIONS],
					flightRules: FLIGHT_RULES.VFR,
					knowledgeKind: KNOWLEDGE_KINDS.REGULATION,
				},
			}),
			makeRef({
				id: 'cfr-91-167',
				displayName: '14 CFR 91.167',
				tags: {
					sourceType: REFERENCE_SOURCE_TYPES.CFR,
					aviationTopic: [AVIATION_TOPICS.REGULATIONS],
					flightRules: FLIGHT_RULES.IFR,
					knowledgeKind: KNOWLEDGE_KINDS.REGULATION,
				},
			}),
		]);
		helpRegistry.registerPages('study', [
			makePage({
				id: 'calibration',
				title: 'Calibration',
				tags: { appSurface: [APP_SURFACES.CALIBRATION], helpKind: HELP_KINDS.CONCEPT },
			}),
		]);
	});

	it('tag + rules filters intersect on aviation', () => {
		const result = search('tag:weather rules:vfr');
		expect(result.aviation.map((r) => r.id)).toEqual(['cfr-91-155']);
	});

	it('lib:help narrows to help bucket only', () => {
		const result = search('calibration lib:help');
		expect(result.aviation).toHaveLength(0);
		expect(result.help.map((r) => r.id)).toEqual(['calibration']);
	});

	it('lib:aviation narrows to aviation bucket only', () => {
		const result = search('14 CFR lib:aviation');
		expect(result.help).toHaveLength(0);
		expect(result.aviation.map((r) => r.id).sort()).toEqual(['cfr-91-155', 'cfr-91-167']);
	});

	it('surface filter drops aviation bucket entirely', () => {
		const result = search('surface:calibration');
		expect(result.aviation).toHaveLength(0);
		expect(result.help.map((r) => r.id)).toEqual(['calibration']);
	});
});

describe('search - empty query', () => {
	it('empty query returns empty buckets', () => {
		registerReferences([makeRef({ id: 'a' })]);
		helpRegistry.registerPages('study', [makePage({ id: 'b' })]);
		const result = search('');
		expect(result.aviation).toHaveLength(0);
		expect(result.help).toHaveLength(0);
	});
});
