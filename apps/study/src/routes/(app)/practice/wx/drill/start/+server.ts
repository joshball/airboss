/**
 * POST `/practice/wx/drill/start`
 *
 * Creates a new `wx_practice_session` row, builds a drill pack via
 * `@ab/wx-drill`, samples the per-token items biased by the user's prior
 * mastery via `@ab/bc-wx-practice`, and returns the session id + the
 * sampled item list. The browser then walks through items, POSTing each
 * answer to `/submit`.
 *
 * Body shape:
 *
 *   { products: WxProduct[], tier: number, focusFamilies: string[] | null,
 *     itemCount: number, seed?: number }
 *
 * Returns:
 *
 *   { sessionId, items: SerialisedItem[] }
 */

import { requireAuth } from '@ab/auth';
import {
	buildMasteryMap,
	defaultQuestionForm,
	masteryKey,
	sampleSession,
	startSession,
} from '@ab/bc-wx-practice/server';
import {
	WX_PRACTICE_ITEM_COUNTS,
	WX_PRACTICE_TIER_MAX,
	WX_PRACTICE_TIER_MIN,
	WX_PRODUCT_VALUES,
	type WxPracticeItemCount,
	type WxProduct,
} from '@ab/constants';
import { buildPack } from '@ab/wx-drill';
import { buildAllScenarioSnapshots } from '@ab/wx-drill/server';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const PRODUCT_SET = new Set<string>(WX_PRODUCT_VALUES);
const ITEM_COUNT_SET = new Set<number>(WX_PRACTICE_ITEM_COUNTS);

interface StartBody {
	products?: unknown;
	tier?: unknown;
	focusFamilies?: unknown;
	itemCount?: unknown;
	seed?: unknown;
}

function validateProducts(value: unknown): WxProduct[] {
	if (!Array.isArray(value) || value.length === 0) {
		throw error(400, 'products must be a non-empty array.');
	}
	const out: WxProduct[] = [];
	for (const v of value) {
		if (typeof v !== 'string' || !PRODUCT_SET.has(v)) {
			throw error(400, `Unknown product: ${String(v)}.`);
		}
		out.push(v as WxProduct);
	}
	return out;
}

function validateTier(value: unknown): number {
	if (
		typeof value !== 'number' ||
		!Number.isInteger(value) ||
		value < WX_PRACTICE_TIER_MIN ||
		value > WX_PRACTICE_TIER_MAX
	) {
		throw error(400, `tier must be an integer between ${WX_PRACTICE_TIER_MIN} and ${WX_PRACTICE_TIER_MAX}.`);
	}
	return value;
}

function validateItemCount(value: unknown): WxPracticeItemCount {
	if (typeof value !== 'number' || !ITEM_COUNT_SET.has(value)) {
		throw error(400, `itemCount must be one of: ${[...WX_PRACTICE_ITEM_COUNTS].join(', ')}.`);
	}
	return value as WxPracticeItemCount;
}

function validateFocusFamilies(value: unknown): string[] | null {
	if (value === null || value === undefined) return null;
	if (!Array.isArray(value)) {
		throw error(400, 'focusFamilies must be an array of strings or null.');
	}
	for (const v of value) {
		if (typeof v !== 'string') {
			throw error(400, 'focusFamilies must contain strings only.');
		}
	}
	return value as string[];
}

export const POST: RequestHandler = async (event) => {
	const user = requireAuth(event);
	let body: StartBody;
	try {
		body = (await event.request.json()) as StartBody;
	} catch {
		throw error(400, 'Body must be JSON.');
	}

	const products = validateProducts(body.products);
	const tier = validateTier(body.tier);
	const focusFamilies = validateFocusFamilies(body.focusFamilies);
	const itemCount = validateItemCount(body.itemCount);
	const seed = typeof body.seed === 'number' && Number.isInteger(body.seed) ? body.seed : Date.now() & 0xffffffff;

	const session = await startSession({
		userId: user.id,
		products,
		tier,
		focusFamilies,
		itemCount,
	});

	// Build a drill pack restricted to the requested products; the sampler
	// below scopes per-token attempts onto it.
	const snapshots = buildAllScenarioSnapshots();
	const { loadCatalogFamilies } = await import('@ab/wx-drill/server');
	const catalog = loadCatalogFamilies();
	const pack = buildPack({
		args: {
			count: Math.max(2, Math.ceil(itemCount / 2)),
			products,
			layout: 'interleaved',
			seed,
			fromScenarios: 'all',
			coverage: 'balanced',
		},
		snapshots,
		catalog,
	});

	// Flatten the pack into a token stream the sampler can sample over.
	const tokenStream = pack.items.flatMap((item) =>
		item.annotations.map((a) => ({
			rawExample: item.raw,
			product: item.product,
			annotation: a,
		})),
	);

	// Load the user's mastery ledger to bias sampling.
	const masteryMap = await buildMasteryMap(user.id, undefined);

	// Filter mastery map to keys touched by tokenStream (we only need entries
	// the sampler will look up).
	const scopedMastery = new Map<string, ReturnType<typeof masteryMap.get>>();
	for (const t of tokenStream) {
		const key = masteryKey(t.product, t.annotation.family, null);
		const m = masteryMap.get(key);
		if (m) scopedMastery.set(key, m);
	}
	const cleanMastery = new Map<string, NonNullable<ReturnType<typeof masteryMap.get>>>();
	for (const [k, v] of scopedMastery) {
		if (v) cleanMastery.set(k, v);
	}

	const sampled = sampleSession({
		tokens: tokenStream,
		mastery: cleanMastery,
		itemCount,
		focusFamilies,
		seed,
	});

	// Serialise the sampled items for the client.
	const serialisedItems = sampled.map((s, idx) => ({
		index: idx,
		mode: s.mode,
		masteryState: s.masteryStateAtSample,
		product: s.token.product,
		rawExample: s.token.rawExample,
		token: s.token.annotation.token,
		family: s.token.annotation.family,
		subFamily: s.token.subFamily ?? null,
		decode: s.token.annotation.decode,
		why: s.token.annotation.why ?? null,
		questionForm: defaultQuestionForm(s.token.annotation.family),
	}));

	return json({
		sessionId: session.id,
		items: serialisedItems,
	});
};
