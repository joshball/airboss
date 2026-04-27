/**
 * `batchResolve` -- the second function on the `@ab/sources/render` API.
 *
 * Source of truth: ADR 019 §2.5. For each identifier in `ids`:
 *
 *   1. Parse the URL.
 *   2. Resolve the SourceEntry (pin-stripped).
 *   3. Walk the supersession chain.
 *   4. Get the per-corpus live URL for the pin.
 *   5. (Lazy) read indexed-tier content when the body has a `@text`/`@quote`
 *      token bound to this id.
 *   6. Compute the annotation per the §3.4 + §6.3 cascade.
 *
 * Returns a `ResolvedIdentifierMap` keyed on the **raw identifier with pin**
 * so two refs to the same entry under different pins each get a row.
 */

import { parseIdentifier } from '../parser.ts';
import { getCorpusResolver } from '../registry/corpus-resolver.ts';
import { resolveIdentifier, walkSupersessionChain } from '../registry/query.ts';
import type {
	BatchResolveContext,
	IndexedContent,
	ParsedIdentifier,
	ResolvedAnnotation,
	ResolvedIdentifier,
	ResolvedIdentifierMap,
	SourceId,
} from '../types.ts';
import { computeAnnotation, findMatchingAcks } from './annotations.ts';

/**
 * Resolve every identifier in `ids` against the production registry, with the
 * lesson's acknowledgments and historical-lens flag in `ctx` driving the
 * per-id annotation.
 */
export async function batchResolve(
	ids: readonly string[],
	ctx: BatchResolveContext,
): Promise<ResolvedIdentifierMap> {
	const map = new Map<string, ResolvedIdentifier>();
	if (ids.length === 0) return map;

	const indexedNeed = identifyIndexedReads(ctx.body);

	await Promise.all(
		ids.map(async (raw) => {
			const parsed = parseIdentifier(raw);
			if (!('corpus' in parsed)) {
				// Unparseable input. Defensive entry; the validator should already
				// have rejected this. Leave entry null + chain empty so render
				// substitutes nothing.
				const annotation: ResolvedAnnotation = { kind: 'none', text: '' };
				map.set(raw, {
					raw,
					parsed: makeFakeParsed(raw),
					entry: null,
					chain: [],
					liveUrl: null,
					indexed: null,
					annotation,
				});
				return;
			}

			const stripped = stripPin(raw) as SourceId;
			const entry = resolveIdentifier(stripped) ?? null;
			const chain = entry === null ? [] : walkSupersessionChain(stripped);

			const corpusResolver = getCorpusResolver(parsed.corpus);
			const pin = parsed.pin;
			let liveUrl: string | null = null;
			if (corpusResolver !== null && pin !== null && entry !== null) {
				liveUrl = corpusResolver.getLiveUrl(stripped, pin);
			}

			let indexed: IndexedContent | null = null;
			if (indexedNeed.has(raw) && corpusResolver !== null && pin !== null && entry !== null) {
				indexed = await corpusResolver.getIndexedContent(stripped, pin);
			}

			const matchingAcks = findMatchingAcks(ctx.acknowledgments, raw, null);
			const annotation = computeAnnotation({
				entry,
				chain,
				matchingAcks,
				historicalLens: ctx.historicalLens,
				walkChain: (id) => walkSupersessionChain(id as SourceId),
			});

			map.set(raw, {
				raw,
				parsed,
				entry,
				chain,
				liveUrl,
				indexed,
				annotation,
			});
		}),
	);

	return map;
}

// ---------------------------------------------------------------------------
// Indexed-tier read detection
// ---------------------------------------------------------------------------

/**
 * Walk the body's link-text matches; identify identifiers whose link text
 * contains `@text` or `@quote` tokens. Those identifiers need indexed-tier
 * content; everyone else does not.
 *
 * Returns the set of raw identifier strings with pin.
 */
function identifyIndexedReads(body: string): ReadonlySet<string> {
	const out = new Set<string>();
	const linkRegex = /\[([^\]\n]*)\]\((airboss-ref:[^)\s]+)\)/g;
	for (const m of body.matchAll(linkRegex)) {
		const linkText = m[1];
		const url = m[2];
		if (linkText === undefined || url === undefined) continue;
		if (/(@text|@quote)\b/.test(linkText)) {
			out.add(url);
		}
	}
	return out;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripPin(raw: string): string {
	const q = raw.indexOf('?');
	return q === -1 ? raw : raw.slice(0, q);
}

/**
 * Build a placeholder ParsedIdentifier for an input that failed to parse. Used
 * defensively so the resolved map always has an entry per id; render mode
 * dispatchers can detect "no parse" via `entry === null`.
 */
function makeFakeParsed(raw: string): ParsedIdentifier {
	return { raw, corpus: '', locator: '', pin: null };
}

/**
 * Test-only: re-export for fixtures that want to verify lazy-indexed-read
 * behavior. Production code MUST NOT depend on this.
 */
export const __batch_internal__ = {
	identifyIndexedReads,
};
