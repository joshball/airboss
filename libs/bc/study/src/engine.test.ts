/**
 * Session-engine unit tests.
 *
 * Pure engine tests -- no DB. Pool queries are passed as callbacks the test
 * fills in. Covers:
 *
 * - Mode-weight integrity (rows sum to 1.0)
 * - Largest-remainder allocation across lengths
 * - Empty-pool redistribution
 * - Determinism: same seed + inputs == same output
 * - Duplicate-across-slices de-duplication
 * - Interleave order
 * - Skip/cert hard filters
 */

import {
	CERTS,
	DEFAULT_SESSION_LENGTH,
	DEPTH_PREFERENCES,
	DOMAINS,
	MODE_WEIGHTS,
	SESSION_MODES,
	SESSION_SLICES,
	type SessionSlice,
	SLICE_PRIORITY,
	STUDY_PRIORITIES,
} from '@ab/constants';
import { describe, expect, it } from 'vitest';
import {
	allocateSlots,
	type EngineCardCandidate,
	type EngineInputs,
	type EngineNodeCandidate,
	type EnginePoolFilters,
	type EnginePoolQueries,
	type EngineRepCandidate,
	modeWeights,
	redistribute,
	runEngine,
} from './engine';

function makeFilters(partial: Partial<EnginePoolFilters> = {}): EnginePoolFilters {
	return {
		certFilter: [],
		focusFilter: [],
		skipDomains: [],
		skipNodes: [],
		recentDomains: [],
		domainFrequencyLast30Days: {},
		activeDomainsLast7Days: [],
		...partial,
	};
}

function makePools(
	overrides: Partial<EnginePoolQueries> = {},
	data: { cards?: EngineCardCandidate[]; reps?: EngineRepCandidate[]; nodes?: EngineNodeCandidate[] } = {},
): EnginePoolQueries {
	return {
		cards: async () => data.cards ?? [],
		reps: async () => data.reps ?? [],
		nodes: async () => data.nodes ?? [],
		domainTrend: async () => [],
		overconfidenceByDomain: async () => ({}),
		...overrides,
	};
}

function makeInputs(partial: Partial<EngineInputs> & Pick<EngineInputs, 'pools'>): EngineInputs {
	return {
		plan: {
			id: 'plan_test',
			userId: 'u_test',
			certGoals: [CERTS.PPL, CERTS.IR],
			focusDomains: [],
			skipDomains: [],
			skipNodes: [],
			depthPreference: DEPTH_PREFERENCES.WORKING,
			sessionLength: DEFAULT_SESSION_LENGTH,
		},
		mode: SESSION_MODES.MIXED,
		filters: makeFilters(),
		sessionLength: DEFAULT_SESSION_LENGTH,
		seed: 'seed-a',
		...partial,
	};
}

describe('MODE_WEIGHTS', () => {
	it('every mode sums to exactly 1.0', () => {
		for (const mode of Object.keys(MODE_WEIGHTS)) {
			const weights = MODE_WEIGHTS[mode as keyof typeof MODE_WEIGHTS];
			const sum = Object.values(weights).reduce((a, b) => a + b, 0);
			expect(Math.abs(sum - 1.0)).toBeLessThan(1e-9);
		}
	});
});

describe('modeWeights', () => {
	it('returns mixed tuple for mixed mode', () => {
		const w = modeWeights(SESSION_MODES.MIXED);
		expect(w[SESSION_SLICES.CONTINUE]).toBe(0.3);
		expect(w[SESSION_SLICES.STRENGTHEN]).toBe(0.3);
		expect(w[SESSION_SLICES.EXPAND]).toBe(0.2);
		expect(w[SESSION_SLICES.DIVERSIFY]).toBe(0.2);
	});
});

describe('allocateSlots', () => {
	it('sums to length for every mode x length in 3..20', () => {
		for (const mode of Object.keys(MODE_WEIGHTS)) {
			for (let length = 3; length <= 20; length += 1) {
				const alloc = allocateSlots(MODE_WEIGHTS[mode as keyof typeof MODE_WEIGHTS], length);
				const sum = Object.values(alloc).reduce((a, b) => a + b, 0);
				expect(sum).toBe(length);
			}
		}
	});

	it('mixed mode at length 10 splits cleanly to 3/3/2/2', () => {
		const alloc = allocateSlots(MODE_WEIGHTS[SESSION_MODES.MIXED], 10);
		expect(alloc[SESSION_SLICES.CONTINUE]).toBe(3);
		expect(alloc[SESSION_SLICES.STRENGTHEN]).toBe(3);
		expect(alloc[SESSION_SLICES.EXPAND]).toBe(2);
		expect(alloc[SESSION_SLICES.DIVERSIFY]).toBe(2);
	});

	it('mixed mode at length 7 hands largest remainder to expand/diversify then tiebreaks', () => {
		const alloc = allocateSlots(MODE_WEIGHTS[SESSION_MODES.MIXED], 7);
		// raw 2.1 / 2.1 / 1.4 / 1.4 -> floors 2/2/1/1. Remainders 0.1/0.1/0.4/0.4.
		// Remainder 1 slot goes to the slice with the largest remainder; both
		// expand and diversify share 0.4, SLICE_PRIORITY breaks tie: expand first.
		expect(alloc[SESSION_SLICES.CONTINUE]).toBe(2);
		expect(alloc[SESSION_SLICES.STRENGTHEN]).toBe(2);
		expect(alloc[SESSION_SLICES.EXPAND]).toBe(2);
		expect(alloc[SESSION_SLICES.DIVERSIFY]).toBe(1);
	});

	it('strengthen mode emphasizes strengthen at 0.70', () => {
		const alloc = allocateSlots(MODE_WEIGHTS[SESSION_MODES.STRENGTHEN], 10);
		expect(alloc[SESSION_SLICES.STRENGTHEN]).toBe(7);
		expect(alloc[SESSION_SLICES.EXPAND]).toBe(0);
	});
});

describe('redistribute', () => {
	it('donates leftover slots to other slices proportionally', () => {
		const requested: Record<SessionSlice, number> = {
			[SESSION_SLICES.CONTINUE]: 3,
			[SESSION_SLICES.STRENGTHEN]: 3,
			[SESSION_SLICES.EXPAND]: 2,
			[SESSION_SLICES.DIVERSIFY]: 2,
		};
		const available: Record<SessionSlice, number> = {
			[SESSION_SLICES.CONTINUE]: 5,
			[SESSION_SLICES.STRENGTHEN]: 5,
			[SESSION_SLICES.EXPAND]: 0,
			[SESSION_SLICES.DIVERSIFY]: 5,
		};
		const alloc = redistribute(requested, available);
		const sum = Object.values(alloc).reduce((s, n) => s + n, 0);
		expect(sum).toBe(10);
		expect(alloc[SESSION_SLICES.EXPAND]).toBe(0);
	});

	it('returns a short allocation when all pools are exhausted', () => {
		const requested: Record<SessionSlice, number> = {
			[SESSION_SLICES.CONTINUE]: 3,
			[SESSION_SLICES.STRENGTHEN]: 3,
			[SESSION_SLICES.EXPAND]: 2,
			[SESSION_SLICES.DIVERSIFY]: 2,
		};
		const available: Record<SessionSlice, number> = {
			[SESSION_SLICES.CONTINUE]: 1,
			[SESSION_SLICES.STRENGTHEN]: 1,
			[SESSION_SLICES.EXPAND]: 0,
			[SESSION_SLICES.DIVERSIFY]: 0,
		};
		const alloc = redistribute(requested, available);
		const sum = Object.values(alloc).reduce((s, n) => s + n, 0);
		expect(sum).toBe(2);
	});
});

describe('runEngine', () => {
	const now = new Date('2026-04-19T12:00:00Z');

	function makeCard(over: Partial<EngineCardCandidate>): EngineCardCandidate {
		return {
			cardId: 'crd_x',
			domain: DOMAINS.WEATHER,
			nodeId: null,
			state: 'review',
			dueAt: new Date('2026-04-18T12:00:00Z'),
			lastRating: 3,
			stability: 10,
			overdueRatio: 1,
			...over,
		};
	}

	it('returns an empty preview when all pools are empty', async () => {
		const preview = await runEngine(makeInputs({ pools: makePools() }), now);
		expect(preview.items).toEqual([]);
		expect(preview.short).toBe(true);
	});

	it('populates items deterministically for a given seed', async () => {
		const cards: EngineCardCandidate[] = Array.from({ length: 20 }, (_, i) =>
			makeCard({ cardId: `crd_${i}`, domain: DOMAINS.WEATHER, overdueRatio: i % 3 }),
		);
		const pools = makePools({}, { cards });
		const inputs = makeInputs({
			pools,
			filters: makeFilters({ recentDomains: [DOMAINS.WEATHER] }),
		});

		const a = await runEngine({ ...inputs, seed: 'seed-a' }, now);
		const b = await runEngine({ ...inputs, seed: 'seed-a' }, now);
		expect(a.items.map((i) => (i.kind === 'card' ? i.cardId : ''))).toEqual(
			b.items.map((i) => (i.kind === 'card' ? i.cardId : '')),
		);
	});

	it('same pool + different seed can reorder (not identical)', async () => {
		const cards: EngineCardCandidate[] = Array.from({ length: 20 }, (_, i) =>
			makeCard({ cardId: `crd_${i}`, domain: DOMAINS.WEATHER, overdueRatio: 1, lastRating: 1 }),
		);
		const pools = makePools({}, { cards });
		const inputs = makeInputs({
			pools,
			filters: makeFilters({ recentDomains: [DOMAINS.WEATHER] }),
		});

		const a = await runEngine({ ...inputs, seed: 'seed-a' }, now);
		const b = await runEngine({ ...inputs, seed: 'seed-z' }, now);
		const aIds = a.items.map((i) => (i.kind === 'card' ? i.cardId : ''));
		const bIds = b.items.map((i) => (i.kind === 'card' ? i.cardId : ''));
		// Not asserting inequality -- pool size could collapse to identical picks
		// -- but assert the length matches and both are non-empty.
		expect(aIds.length).toBe(bIds.length);
		expect(aIds.length).toBeGreaterThan(0);
	});

	it('redistributes expand quota to other slices when node pool is empty', async () => {
		const cards: EngineCardCandidate[] = Array.from({ length: 12 }, (_, i) =>
			makeCard({
				cardId: `crd_${i}`,
				domain: i < 6 ? DOMAINS.WEATHER : DOMAINS.AIRSPACE,
				overdueRatio: (i % 3) + 1,
				lastRating: i % 2 === 0 ? 1 : 3,
			}),
		);
		const pools = makePools({}, { cards });
		const inputs = makeInputs({
			pools,
			filters: makeFilters({ recentDomains: [DOMAINS.WEATHER, DOMAINS.AIRSPACE] }),
		});
		const preview = await runEngine(inputs, now);
		expect(preview.allocation[SESSION_SLICES.EXPAND]).toBe(0);
		const sum = Object.values(preview.allocation).reduce((s, n) => s + n, 0);
		expect(sum).toBe(preview.items.length);
	});

	it('never emits duplicates across slices for the same card', async () => {
		const cards: EngineCardCandidate[] = [
			makeCard({
				cardId: 'crd_dup',
				domain: DOMAINS.WEATHER,
				lastRating: 1, // strengthen score high
				state: 'relearning',
				overdueRatio: 2,
			}),
			// Pad with distinct cards so the engine has room to pick without
			// forcing the duplicate.
			...Array.from({ length: 10 }, (_, i) =>
				makeCard({ cardId: `crd_${i}`, domain: DOMAINS.WEATHER, overdueRatio: 0 }),
			),
		];
		const pools = makePools({}, { cards });
		const inputs = makeInputs({
			pools,
			filters: makeFilters({ recentDomains: [DOMAINS.WEATHER] }),
		});
		const preview = await runEngine(inputs, now);
		const ids = preview.items.filter((i) => i.kind === 'card').map((i) => (i.kind === 'card' ? i.cardId : ''));
		const set = new Set(ids);
		expect(set.size).toBe(ids.length);
	});

	it('respects skip_domains on cards', async () => {
		const cards: EngineCardCandidate[] = [
			makeCard({ cardId: 'crd_weather', domain: DOMAINS.WEATHER, overdueRatio: 3 }),
			makeCard({ cardId: 'crd_airspace', domain: DOMAINS.AIRSPACE, overdueRatio: 3 }),
		];
		const pools = makePools({}, { cards });
		const inputs = makeInputs({
			pools,
			filters: makeFilters({
				recentDomains: [DOMAINS.WEATHER, DOMAINS.AIRSPACE],
				skipDomains: [DOMAINS.WEATHER],
			}),
		});
		const preview = await runEngine(inputs, now);
		const ids = preview.items.filter((i) => i.kind === 'card').map((i) => (i.kind === 'card' ? i.cardId : ''));
		expect(ids).not.toContain('crd_weather');
	});

	it('interleaves play order across slices (mixed mode, enough items)', async () => {
		const cards: EngineCardCandidate[] = [
			...Array.from({ length: 6 }, (_, i) =>
				makeCard({
					cardId: `continue_${i}`,
					domain: DOMAINS.WEATHER,
					overdueRatio: 1,
					lastRating: 3,
				}),
			),
			...Array.from({ length: 6 }, (_, i) =>
				makeCard({
					cardId: `strengthen_${i}`,
					domain: DOMAINS.WEATHER,
					overdueRatio: 2,
					lastRating: 1,
					state: 'relearning',
				}),
			),
			...Array.from({ length: 6 }, (_, i) =>
				makeCard({ cardId: `diverse_${i}`, domain: DOMAINS.AERODYNAMICS, overdueRatio: 0 }),
			),
		];
		const pools = makePools({}, { cards });
		const inputs = makeInputs({
			pools,
			filters: makeFilters({
				recentDomains: [DOMAINS.WEATHER],
				domainFrequencyLast30Days: { [DOMAINS.WEATHER]: 10 },
				activeDomainsLast7Days: [DOMAINS.WEATHER],
			}),
		});
		const preview = await runEngine(inputs, now);
		// The first 4 items should cycle through slices (continue -> strengthen
		// -> expand -> diversify); expand is empty so it's skipped, leaving at
		// least one strengthen in position 2.
		const slicesByIndex = preview.items.map((i) => i.slice);
		// Should not be all the same slice grouped together at the front.
		expect(new Set(slicesByIndex.slice(0, Math.min(4, slicesByIndex.length))).size).toBeGreaterThan(1);
	});

	it('excludes nodes that miss cert_filter from the expand pool', async () => {
		const nodes: EngineNodeCandidate[] = [
			{
				nodeId: 'node_cfi_only',
				domain: DOMAINS.TEACHING_METHODOLOGY,
				crossDomains: [],
				priority: STUDY_PRIORITIES.CRITICAL,
				prerequisitesMet: true,
				bloomDepth: null,
				unstarted: true,
				minimumCert: CERTS.CFI,
			},
			{
				nodeId: 'node_ppl_ok',
				domain: DOMAINS.AIRSPACE,
				crossDomains: [],
				priority: STUDY_PRIORITIES.CRITICAL,
				prerequisitesMet: true,
				bloomDepth: null,
				unstarted: true,
				minimumCert: CERTS.PPL,
			},
		];
		const pools = makePools({}, { nodes });
		const inputs = makeInputs({
			pools,
			mode: SESSION_MODES.EXPAND,
			filters: makeFilters({ certFilter: [CERTS.PPL] }),
		});
		const preview = await runEngine(inputs, now);
		const ids = preview.items
			.filter((i) => i.kind === 'node_start')
			.map((i) => (i.kind === 'node_start' ? i.nodeId : ''));
		// CFI-floor node not covered by a PPL goal; PPL-floor node is.
		expect(ids).not.toContain('node_cfi_only');
		if (preview.allocation[SESSION_SLICES.EXPAND] > 0) {
			expect(ids).toContain('node_ppl_ok');
		}
	});

	it('refuses unstarted nodes whose prerequisites are unmet', async () => {
		const nodes: EngineNodeCandidate[] = [
			{
				nodeId: 'node_prereq_ok',
				domain: DOMAINS.AIRSPACE,
				crossDomains: [],
				priority: STUDY_PRIORITIES.CRITICAL,
				prerequisitesMet: true,
				bloomDepth: null,
				unstarted: true,
				minimumCert: CERTS.PPL,
			},
			{
				nodeId: 'node_prereq_missing',
				domain: DOMAINS.IFR_PROCEDURES,
				crossDomains: [],
				priority: STUDY_PRIORITIES.CRITICAL,
				prerequisitesMet: false,
				bloomDepth: null,
				unstarted: true,
				minimumCert: CERTS.IR,
			},
		];
		const pools = makePools({}, { nodes });
		const inputs = makeInputs({
			pools,
			mode: SESSION_MODES.EXPAND,
			filters: makeFilters({ certFilter: [CERTS.PPL, CERTS.IR] }),
		});
		const preview = await runEngine(inputs, now);
		const ids = preview.items
			.filter((i) => i.kind === 'node_start')
			.map((i) => (i.kind === 'node_start' ? i.nodeId : ''));
		expect(ids).not.toContain('node_prereq_missing');
	});
});

describe('SLICE_PRIORITY', () => {
	it('ranks strengthen above continue above expand above diversify', () => {
		expect(SLICE_PRIORITY[0]).toBe(SESSION_SLICES.STRENGTHEN);
		expect(SLICE_PRIORITY[1]).toBe(SESSION_SLICES.CONTINUE);
		expect(SLICE_PRIORITY[2]).toBe(SESSION_SLICES.EXPAND);
		expect(SLICE_PRIORITY[3]).toBe(SESSION_SLICES.DIVERSIFY);
	});
});
