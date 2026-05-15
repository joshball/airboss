/**
 * Per-session sampler: consumes the mastery ledger + a candidate pool of
 * (token, family, sub-family) tuples from a drill pack, produces an ordered
 * list of attempts to ask the student. Pure -- no DB.
 *
 * Sampling rules (per the drill plan):
 *
 * - `passive` families are NOT quizzed; the route renders the token with
 *   decode visible inline instead. The sampler skips them entirely.
 * - `demoted` families are oversampled.
 * - `active` families are weighted toward those with the lower
 *   `correct/attempts` ratio.
 * - Brand-new families (no row in the ledger) get a baseline weight so
 *   the student steadily encounters everything in the catalog.
 *
 * The function is deterministic given the same seed and the same inputs;
 * the route layer uses session.id as the seed so a session resumed across
 * pages produces the same item order.
 */

import { WX_PRACTICE_MASTERY_STATES, type WxPracticeMasteryState, type WxProduct } from '@ab/constants';
import type { TokenAnnotation } from '@ab/wx-explain';
import type { MasterySnapshot } from './state-machine';

export interface DrillToken {
	/** The product item this token belongs to (METAR text, TAF text, etc.). */
	rawExample: string;
	/** The product kind (drives which renderer the UI uses). */
	product: WxProduct;
	/** The token annotation produced by `@ab/wx-explain`. */
	annotation: TokenAnnotation;
	/** Optional sub-family for grouped tokens (wind group has direction / speed / gust). */
	subFamily?: string;
}

export interface SamplerInput {
	tokens: readonly DrillToken[];
	/** Per-family mastery rows from the ledger. Keyed by `${product}::${family}::${subFamily}`. */
	mastery: ReadonlyMap<string, MasterySnapshot>;
	/** Cap on number of quizzable items in the session output. */
	itemCount: number;
	/** Optional product/family slugs the session sampler should focus on. */
	focusFamilies?: readonly string[] | null;
	/** Deterministic seed -- typically session.id hashed. */
	seed: number;
}

export interface SampledItem {
	token: DrillToken;
	/** `passive` = render-only, no question; else quiz the student. */
	mode: 'quiz' | 'visible';
	masteryStateAtSample: WxPracticeMasteryState;
}

const PASSIVE = WX_PRACTICE_MASTERY_STATES.PASSIVE;
const DEMOTED = WX_PRACTICE_MASTERY_STATES.DEMOTED;

const BASELINE_NEW_WEIGHT = 1.0;
const DEMOTED_WEIGHT_BONUS = 2.0;
const ACTIVE_HIGH_MISS_BONUS = 1.5;

function ringKey(product: WxProduct, family: string, subFamily: string): string {
	return `${product}::${family}::${subFamily}`;
}

function weightFor(mastery: MasterySnapshot | undefined): number {
	if (!mastery) return BASELINE_NEW_WEIGHT;
	if (mastery.state === DEMOTED) return BASELINE_NEW_WEIGHT + DEMOTED_WEIGHT_BONUS;
	if (mastery.attempts === 0) return BASELINE_NEW_WEIGHT;
	const correctRatio = mastery.correct / mastery.attempts;
	// Lower correct ratio -> higher weight.
	return BASELINE_NEW_WEIGHT + (1 - correctRatio) * ACTIVE_HIGH_MISS_BONUS;
}

function mulberry32(seed: number): () => number {
	let t = seed | 0;
	return () => {
		t = (t + 0x6d2b79f5) | 0;
		let x = t;
		x = Math.imul(x ^ (x >>> 15), x | 1);
		x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
		return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
	};
}

function pickWeightedIndex(rand: () => number, weights: readonly number[]): number {
	const total = weights.reduce((a, b) => a + b, 0);
	if (total <= 0) {
		return Math.floor(rand() * weights.length);
	}
	const target = rand() * total;
	let cursor = 0;
	for (let i = 0; i < weights.length; i += 1) {
		cursor += weights[i] ?? 0;
		if (target <= cursor) return i;
	}
	return weights.length - 1;
}

export function sampleSession(input: SamplerInput): SampledItem[] {
	const { tokens, mastery, itemCount, focusFamilies, seed } = input;
	if (tokens.length === 0) return [];
	const rand = mulberry32(seed);

	// Split tokens into passive (visible) vs quizzable.
	const visible: SampledItem[] = [];
	const quizzableTokens: DrillToken[] = [];
	const quizzableWeights: number[] = [];

	for (const tok of tokens) {
		const family = tok.annotation.family;
		const subFamily = tok.subFamily ?? '';

		if (focusFamilies && focusFamilies.length > 0 && !focusFamilies.includes(family)) {
			continue;
		}

		const key = ringKey(tok.product, family, subFamily);
		const m = mastery.get(key);
		if (m && m.state === PASSIVE) {
			visible.push({ token: tok, mode: 'visible', masteryStateAtSample: PASSIVE });
			continue;
		}
		quizzableTokens.push(tok);
		quizzableWeights.push(weightFor(m));
	}

	// Draw `itemCount` quizzable items with weighted sampling without replacement.
	const quiz: SampledItem[] = [];
	const remainingTokens = [...quizzableTokens];
	const remainingWeights = [...quizzableWeights];
	const cap = Math.min(itemCount, remainingTokens.length);
	for (let n = 0; n < cap; n += 1) {
		const idx = pickWeightedIndex(rand, remainingWeights);
		const tok = remainingTokens[idx];
		if (!tok) break;
		const key = ringKey(tok.product, tok.annotation.family, tok.subFamily ?? '');
		const m = mastery.get(key);
		quiz.push({
			token: tok,
			mode: 'quiz',
			masteryStateAtSample: m?.state ?? 'active',
		});
		remainingTokens.splice(idx, 1);
		remainingWeights.splice(idx, 1);
	}

	// Visible items are interleaved alongside the quiz items in the order the
	// tokens appear in the source product. The route is responsible for
	// merging them; we return them separately so the UI can decide ordering.
	return [...quiz, ...visible];
}

export function masteryKey(product: WxProduct, family: string, subFamily: string | null): string {
	return ringKey(product, family, subFamily ?? '');
}
