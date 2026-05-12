/**
 * searchGrouped() top-hits + book-level collapse behaviours (Phase 3.5).
 *
 * Covers slices 3.5c (top-hits) + 3.5d (collapse). The aviation
 * registry is the source of every faa.* row consumed here; we register
 * a small handcrafted set so the test is independent of the production
 * seed file.
 */

import { __resetRegistryForTests, registerReferences } from '@ab/aviation';
import {
	APP_SURFACES,
	AVIATION_TOPICS,
	FLIGHT_RULES,
	KNOWLEDGE_KINDS,
	REFERENCE_SOURCE_TYPES,
	TOP_HITS_MAX,
} from '@ab/constants';
import { beforeEach, describe, expect, it } from 'vitest';
import { helpRegistry } from '../registry';
import type { PaletteHost, SearchResult } from '../schema/result-types';
import { searchGrouped } from '../search';

const HOST: PaletteHost = { surface: APP_SURFACES.STUDY };

function injectedRow(
	overrides: Partial<SearchResult> & Pick<SearchResult, 'id' | 'type' | 'title' | 'href'>,
): SearchResult {
	return {
		rankBucket: 2,
		...overrides,
	};
}

beforeEach(() => {
	__resetRegistryForTests();
	helpRegistry.clear();
});

describe('searchGrouped - top-hits strip (slice 3.5c)', () => {
	it('returns up to TOP_HITS_MAX rows across all columns', () => {
		// Register a reference whose displayName prefix-matches "weather"
		// so the intent classifier returns broad (not phrase-fts) for the
		// single-word needle.
		registerReferences([
			{
				id: 'avwx-root',
				displayName: 'Weather Handbook',
				aliases: ['AvWX', 'FAA-H-8083-28'],
				tags: {
					sourceType: REFERENCE_SOURCE_TYPES.AVWX,
					aviationTopic: [AVIATION_TOPICS.WEATHER],
					flightRules: FLIGHT_RULES.BOTH,
					knowledgeKind: KNOWLEDGE_KINDS.CONCEPT,
				},
				paraphrase: 'Weather theory and reading.',
				sources: [],
				related: [],
			},
		]);
		const r = searchGrouped('weather', HOST, [
			injectedRow({
				id: 'kn-air-masses',
				type: 'airboss.knode',
				title: 'Weather: Air Masses and Fronts',
				href: '/study/kn/air-masses',
			}),
			injectedRow({
				id: 'kn-clouds',
				type: 'airboss.knode',
				title: 'Cloud Formation',
				href: '/study/kn/clouds',
				body: 'discusses weather and altitudes',
			}),
		]);
		expect(r.intent).toBe('broad');
		expect(r.topHits.length).toBeLessThanOrEqual(TOP_HITS_MAX);
		expect(r.topHits.length).toBeGreaterThan(0);
	});

	it('mixes types -- the highest-scored rows lead regardless of column', () => {
		// Register a title-prefix match so intent stays broad.
		registerReferences([
			{
				id: 'wx-handbook',
				displayName: 'Weather Handbook',
				aliases: [],
				tags: {
					sourceType: REFERENCE_SOURCE_TYPES.AVWX,
					aviationTopic: [AVIATION_TOPICS.WEATHER],
					flightRules: FLIGHT_RULES.BOTH,
					knowledgeKind: KNOWLEDGE_KINDS.CONCEPT,
				},
				paraphrase: '',
				sources: [],
				related: [],
			},
		]);
		// A knowledge node with an exact-title match scores higher than a
		// glossary entry with only a substring title.
		const r = searchGrouped('weather', HOST, [
			injectedRow({
				id: 'kn-weather',
				type: 'airboss.knode',
				title: 'Weather',
				href: '/study/kn/weather',
			}),
			injectedRow({
				id: 'glos-wx',
				type: 'airboss.glossary',
				title: 'Atmospheric pressure',
				href: '/library/glossary/wx',
			}),
		]);
		expect(r.intent).toBe('broad');
		expect(r.topHits[0]?.id).toBe('kn-weather');
	});

	it('hides the top-hits strip in I-3 phrase-fts intent', () => {
		// 4-word query forces phrase-fts.
		const r = searchGrouped('aviation weather currency rules', HOST, [
			injectedRow({
				id: 'kn-currency',
				type: 'airboss.knode',
				title: 'Currency Rules',
				href: '/study/kn/currency',
			}),
		]);
		expect(r.intent).toBe('phrase-fts');
		expect(r.topHits).toEqual([]);
	});

	it('classifies a doc: chip as scoped intent', () => {
		const r = searchGrouped('doc:phak weather', HOST);
		expect(r.intent).toBe('scoped');
	});
});

describe('searchGrouped - book-level collapse (slice 3.5d)', () => {
	it('rolls handbook chapter children onto the handbook root in broad mode', () => {
		registerReferences([
			{
				id: 'phak-root',
				displayName: 'Pilot Handbook of Aeronautical Knowledge',
				aliases: ['PHAK'],
				tags: {
					sourceType: REFERENCE_SOURCE_TYPES.PHAK,
					aviationTopic: [AVIATION_TOPICS.WEATHER],
					flightRules: FLIGHT_RULES.BOTH,
					knowledgeKind: KNOWLEDGE_KINDS.CONCEPT,
				},
				paraphrase: 'Foundational pilot text.',
				sources: [],
				related: [],
			},
		]);
		const r = searchGrouped('phak', HOST, [
			injectedRow({
				id: 'phak-ch12',
				type: 'faa.handbook.chapter',
				title: 'PHAK Ch 12 -- Weather Theory',
				href: '/library/handbook/phak/12',
				clusterKey: 'phak',
				depth: 1,
			}),
			injectedRow({
				id: 'phak-ch14',
				type: 'faa.handbook.chapter',
				title: 'PHAK Ch 14 -- Aeromedical',
				href: '/library/handbook/phak/14',
				clusterKey: 'phak',
				depth: 1,
			}),
		]);
		// The top-level FAA Resources column carries the handbook root
		// (PHAK) but neither chapter ID -- both rolled onto children.
		const ids = r.columns['faa-resources'].map((row) => row.id);
		expect(ids).toContain('phak-root');
		expect(ids).not.toContain('phak-ch12');
		expect(ids).not.toContain('phak-ch14');
		const phak = r.columns['faa-resources'].find((row) => row.id === 'phak-root');
		expect(phak?.children?.map((c) => c.id).sort()).toEqual(['phak-ch12', 'phak-ch14']);
	});

	it('preserves orphan children when their parent is absent', () => {
		// No handbook root registered; the chapters become top-level rows
		// rather than disappearing.
		const r = searchGrouped('orphan', HOST, [
			injectedRow({
				id: 'orphan-ch',
				type: 'faa.handbook.chapter',
				title: 'Orphan Chapter',
				href: '/library/handbook/missing/1',
				clusterKey: 'missing',
			}),
		]);
		const ids = r.columns['faa-resources'].map((row) => row.id);
		expect(ids).toContain('orphan-ch');
	});

	it('skips collapse in I-3 phrase-fts mode -- chapters stay top-level', () => {
		registerReferences([
			{
				id: 'phak-root',
				displayName: 'Pilot Handbook of Aeronautical Knowledge',
				aliases: ['PHAK'],
				tags: {
					sourceType: REFERENCE_SOURCE_TYPES.PHAK,
					aviationTopic: [AVIATION_TOPICS.WEATHER],
					flightRules: FLIGHT_RULES.BOTH,
					knowledgeKind: KNOWLEDGE_KINDS.CONCEPT,
				},
				paraphrase: 'Foundational pilot text.',
				sources: [],
				related: [],
			},
		]);
		// 4+ word query forces I-3.
		const r = searchGrouped('weather and turbulence reporting passages', HOST, [
			injectedRow({
				id: 'phak-ch12',
				type: 'faa.handbook.chapter',
				title: 'PHAK Ch 12 -- Weather Theory',
				href: '/library/handbook/phak/12',
				clusterKey: 'phak',
				depth: 1,
			}),
		]);
		expect(r.intent).toBe('phrase-fts');
		const ids = r.columns['faa-resources'].map((row) => row.id);
		expect(ids).toContain('phak-ch12');
	});

	it('collapses CFR sections under their CFR Part', () => {
		registerReferences([
			{
				id: 'doc-cfr-14-91',
				displayName: '14 CFR Part 91 -- General Operating and Flight Rules',
				aliases: ['Part 91'],
				tags: {
					sourceType: REFERENCE_SOURCE_TYPES.CFR,
					aviationTopic: [AVIATION_TOPICS.REGULATIONS],
					flightRules: FLIGHT_RULES.BOTH,
					knowledgeKind: KNOWLEDGE_KINDS.REGULATION,
				},
				paraphrase: 'Part 91.',
				sources: [],
				related: [],
			},
		]);
		const r = searchGrouped('Part 91', HOST, [
			injectedRow({
				id: 'sec-91-103',
				type: 'faa.cfr.sect',
				title: '14 CFR §91.103 - Preflight Action',
				href: '/library/regulations/cfr14/14cfr91/91.103',
				clusterKey: '14cfr91',
				depth: 2,
			}),
		]);
		const ids = r.columns['faa-resources'].map((row) => row.id);
		expect(ids).toContain('doc-cfr-14-91');
		expect(ids).not.toContain('sec-91-103');
		const part = r.columns['faa-resources'].find((row) => row.id === 'doc-cfr-14-91');
		expect(part?.children?.[0]?.id).toBe('sec-91-103');
	});
});

describe('searchGrouped - label rename (slice 3.5j)', () => {
	it('exposes "Library" as the user-facing label for faa-resources', async () => {
		const { COLUMN_LABELS } = await import('../schema/result-types');
		expect(COLUMN_LABELS['faa-resources']).toBe('Library');
	});
});
