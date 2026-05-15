/**
 * Sampling logic for `@ab/wx-drill`. Pure: consumes scenario snapshots +
 * the catalog families table + drill args, produces a `DrillPack`. No DB,
 * no fs, no scenario evaluation (caller passes pre-built snapshots).
 *
 * The pack is reproducible by `args.seed` -- same inputs + same seed yields
 * the same items in the same order.
 */

import type { WxProduct, WxScenario } from '@ab/constants';
import { WX_PRODUCTS } from '@ab/constants';
import type { TokenAnnotation } from '@ab/wx-explain';
import { mulberry32, pick } from './prng';
import type { ScenarioSnapshot } from './snapshot';
import type { DrillCoverage, DrillItem, DrillPack, DrillPackArgs } from './types';

/**
 * Per-product `family.slug` arrays drawn from the catalog. Powers the
 * coverage scoring loop. Keys are `WxProduct` so the sampler can look up by
 * the active product. Note: the catalog file uses `airmetSigmet` for the
 * AIRMET family; the loader normalises to `airmet`.
 */
export interface CatalogFamiliesByProduct {
	metar: string[];
	taf: string[];
	pirep: string[];
	fb: string[];
	airmet: string[];
}

interface CandidatePool {
	metar: { snapshot: ScenarioSnapshot; idx: number }[];
	taf: { snapshot: ScenarioSnapshot; idx: number }[];
	pirep: { snapshot: ScenarioSnapshot; idx: number }[];
	fb: { snapshot: ScenarioSnapshot }[];
	airmet: { snapshot: ScenarioSnapshot; idx: number }[];
}

function buildCandidatePool(snapshots: readonly ScenarioSnapshot[], products: readonly WxProduct[]): CandidatePool {
	const pool: CandidatePool = { metar: [], taf: [], pirep: [], fb: [], airmet: [] };
	for (const snap of snapshots) {
		if (products.includes(WX_PRODUCTS.METAR)) {
			for (let i = 0; i < snap.metars.length; i += 1) pool.metar.push({ snapshot: snap, idx: i });
		}
		if (products.includes(WX_PRODUCTS.TAF)) {
			for (let i = 0; i < snap.tafs.length; i += 1) pool.taf.push({ snapshot: snap, idx: i });
		}
		if (products.includes(WX_PRODUCTS.PIREP)) {
			for (let i = 0; i < snap.pireps.length; i += 1) pool.pirep.push({ snapshot: snap, idx: i });
		}
		if (products.includes(WX_PRODUCTS.FB) && snap.fbItems !== null) {
			pool.fb.push({ snapshot: snap });
		}
		if (products.includes(WX_PRODUCTS.AIRMET)) {
			for (let i = 0; i < snap.airmets.length; i += 1) pool.airmet.push({ snapshot: snap, idx: i });
		}
	}
	return pool;
}

function collectFamilies(annotations: readonly TokenAnnotation[]): string[] {
	const set = new Set<string>();
	for (const a of annotations) set.add(a.family);
	return [...set];
}

function sampleDrillItem(
	rand: () => number,
	pool: CandidatePool,
	products: readonly WxProduct[],
	index: number,
): DrillItem | null {
	const eligible = products.filter((p) => pool[p].length > 0);
	if (eligible.length === 0) return null;
	const product = pick(rand, eligible);
	switch (product) {
		case 'metar': {
			const candidate = pick(rand, pool.metar);
			const data = candidate.snapshot.metars[candidate.idx];
			if (!data) return null;
			return {
				index,
				product,
				scenarioSlug: candidate.snapshot.slug,
				stationIcao: data.icao,
				raw: data.raw,
				annotations: data.annotations,
				exercisedFamilies: collectFamilies(data.annotations),
			};
		}
		case 'taf': {
			const candidate = pick(rand, pool.taf);
			const data = candidate.snapshot.tafs[candidate.idx];
			if (!data) return null;
			return {
				index,
				product,
				scenarioSlug: candidate.snapshot.slug,
				stationIcao: data.icao,
				raw: data.raw,
				annotations: data.annotations,
				exercisedFamilies: collectFamilies(data.annotations),
			};
		}
		case 'pirep': {
			const candidate = pick(rand, pool.pirep);
			const data = candidate.snapshot.pireps[candidate.idx];
			if (!data) return null;
			return {
				index,
				product,
				scenarioSlug: candidate.snapshot.slug,
				stationIcao: null,
				raw: data.raw,
				annotations: data.annotations,
				exercisedFamilies: collectFamilies(data.annotations),
			};
		}
		case 'fb': {
			const candidate = pick(rand, pool.fb);
			const data = candidate.snapshot.fbItems;
			if (!data) return null;
			return {
				index,
				product,
				scenarioSlug: candidate.snapshot.slug,
				stationIcao: null,
				raw: data.raw,
				annotations: data.annotations,
				exercisedFamilies: collectFamilies(data.annotations),
			};
		}
		case 'airmet': {
			const candidate = pick(rand, pool.airmet);
			const data = candidate.snapshot.airmets[candidate.idx];
			if (!data) return null;
			return {
				index,
				product,
				scenarioSlug: candidate.snapshot.slug,
				stationIcao: null,
				raw: data.id,
				annotations: data.annotations,
				exercisedFamilies: collectFamilies(data.annotations),
			};
		}
	}
}

export interface BuildPackInput {
	args: DrillPackArgs;
	snapshots: readonly ScenarioSnapshot[];
	catalog: CatalogFamiliesByProduct;
}

export function buildPack(input: BuildPackInput): DrillPack {
	const { args, snapshots, catalog } = input;
	const rand = mulberry32(args.seed);
	const pool = buildCandidatePool(snapshots, args.products);

	const items: DrillItem[] = [];
	const covered = new Set<string>();

	const allFamilies = new Set<string>();
	for (const p of args.products) {
		for (const f of catalog[p]) allFamilies.add(`${p}::${f}`);
	}

	for (let i = 0; i < args.count; i += 1) {
		let best: DrillItem | null = null;
		let bestScore = -1;
		const sampleCount = coverageSampleCount(args.coverage);
		for (let attempt = 0; attempt < sampleCount; attempt += 1) {
			const candidate = sampleDrillItem(rand, pool, args.products, i);
			if (candidate === null) continue;
			const newFamilies = candidate.exercisedFamilies.filter((f) => !covered.has(`${candidate.product}::${f}`));
			const score = args.coverage === 'random' ? 0 : newFamilies.length;
			if (score > bestScore) {
				bestScore = score;
				best = candidate;
			}
		}
		if (best === null) break;
		for (const f of best.exercisedFamilies) covered.add(`${best.product}::${f}`);
		items.push(best);
	}

	const uncovered = [...allFamilies].filter((k) => !covered.has(k));

	return {
		generatedAt: new Date().toISOString(),
		args,
		items,
		coverageReport: {
			totalFamilies: allFamilies.size,
			coveredFamilies: covered.size,
			uncoveredFamilies: uncovered,
		},
	};
}

function coverageSampleCount(coverage: DrillCoverage): number {
	return coverage === 'random' ? 1 : 6;
}

export type { ScenarioSnapshot };
/**
 * Re-export so tests can drive the sampler with synthetic snapshots without
 * importing the server snapshot module.
 */
export { mulberry32, pick };

export type DrillPackInputScenarios = 'all' | WxScenario[];
