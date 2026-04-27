/**
 * Per-corpus resolver registration.
 *
 * Source of truth: ADR 019 §2.2 (`CorpusResolver` interface) + §1.2
 * (enumerated corpora list). Each corpus registers a resolver that knows
 * its locator shape, citation formatting, current edition, etc. Phase 2
 * ships default no-op resolvers for every enumerated corpus; Phase 3+
 * each replace their corpus's default with a real resolver.
 *
 * The default no-op resolver lets the validator's row-1 corpus-enumeration
 * check pass for known corpora (`isEnumeratedCorpus(corpus) === true`)
 * even before a real resolver is registered. An unknown corpus prefix
 * returns null from `getCorpusResolver`, which the validator surfaces as
 * a row-1 ERROR.
 */

import type {
	Edition,
	EditionId,
	IndexedContent,
	LocatorError,
	ParsedLocator,
	SourceEntry,
	SourceId,
} from '../types.ts';
import { getEditionsMap } from './editions.ts';

export type CitationStyle = 'short' | 'formal' | 'title';

/**
 * Per-corpus resolver. ADR 019 §2.2.
 *
 * Phase 2's default no-op implementation returns null/empty for every
 * runtime method; the corpus enumeration check (`isEnumeratedCorpus`) is the
 * only signal the validator reads from this layer in Phase 2. Phase 3+
 * resolvers fill in the methods that matter for their corpus.
 */
export interface CorpusResolver {
	readonly corpus: string;
	parseLocator(locator: string): ParsedLocator | LocatorError;
	formatCitation(entry: SourceEntry, style: CitationStyle): string;
	getCurrentEdition(): EditionId | null;
	getEditions(id: SourceId): Promise<readonly Edition[]>;
	getLiveUrl(id: SourceId, edition: EditionId): string | null;
	getDerivativeContent(id: SourceId, edition: EditionId): string | null;
	getIndexedContent(id: SourceId, edition: EditionId): Promise<IndexedContent | null>;
}

/**
 * Enumerated corpora per ADR 019 §1.2. The validator's row-1 check uses
 * this list to distinguish "unknown corpus prefix" (row 1 ERROR) from
 * "known corpus, registry has no entry yet" (row 2 ERROR).
 *
 * Adding a new corpus to ADR 019 §1.2 means adding it here AND registering
 * a default resolver eagerly at module init.
 */
export const ENUMERATED_CORPORA: readonly string[] = [
	'regs',
	'aim',
	'ac',
	'interp',
	'orders',
	'handbooks',
	'pohs',
	'statutes',
	'sectionals',
	'plates',
	'ntsb',
	'acs',
	'forms',
	'tcds',
	'asrs',
];

/**
 * Build a default no-op resolver for a corpus. Returns null/empty for every
 * runtime method; the only signal it provides is "this corpus exists" via
 * its registration in `RESOLVERS`.
 */
export function makeDefaultResolver(corpus: string): CorpusResolver {
	return {
		corpus,
		parseLocator(locator: string): ParsedLocator | LocatorError {
			if (locator.length === 0) {
				return { kind: 'error', message: 'locator is empty' };
			}
			return { kind: 'ok', segments: locator.split('/') };
		},
		formatCitation(entry: SourceEntry, style: CitationStyle): string {
			switch (style) {
				case 'short':
					return entry.canonical_short;
				case 'formal':
					return entry.canonical_formal;
				case 'title':
					return entry.canonical_title;
				default: {
					const exhaustive: never = style;
					throw new Error(`unknown citation style: ${exhaustive as string}`);
				}
			}
		},
		getCurrentEdition(): EditionId | null {
			return null;
		},
		getEditions(id: SourceId): Promise<readonly Edition[]> {
			return Promise.resolve(getEditionsMap().get(id) ?? []);
		},
		getLiveUrl(_id: SourceId, _edition: EditionId): string | null {
			return null;
		},
		getDerivativeContent(_id: SourceId, _edition: EditionId): string | null {
			return null;
		},
		getIndexedContent(_id: SourceId, _edition: EditionId): Promise<IndexedContent | null> {
			return Promise.resolve(null);
		},
	};
}

// ---------------------------------------------------------------------------
// Registration map
// ---------------------------------------------------------------------------

const RESOLVERS: Map<string, CorpusResolver> = new Map();

// Eagerly register a default no-op resolver for every enumerated corpus.
// Phase 3+ replace their corpus's default by calling `registerCorpusResolver`.
for (const corpus of ENUMERATED_CORPORA) {
	RESOLVERS.set(corpus, makeDefaultResolver(corpus));
}

/**
 * Register (or replace) a corpus resolver. Idempotent if `resolver` is the
 * exact same reference as the currently-registered one.
 */
export function registerCorpusResolver(resolver: CorpusResolver): void {
	RESOLVERS.set(resolver.corpus, resolver);
}

/**
 * Look up a corpus resolver. Returns null when the corpus is not enumerated
 * in ADR 019 §1.2.
 */
export function getCorpusResolver(corpus: string): CorpusResolver | null {
	return RESOLVERS.get(corpus) ?? null;
}

/**
 * Returns true when `corpus` is one of ADR 019 §1.2's enumerated corpora.
 * The validator's row-1 check uses this; the `unknown` magic prefix is
 * deliberately NOT enumerated and returns false here (row 0 carve-out
 * handles `unknown`).
 */
export function isEnumeratedCorpus(corpus: string): boolean {
	return RESOLVERS.has(corpus);
}

/**
 * Test-only: reset every corpus to its default resolver. Production code
 * MUST NOT call this.
 */
export const __corpus_resolver_internal__ = {
	resetToDefaults(): void {
		RESOLVERS.clear();
		for (const corpus of ENUMERATED_CORPORA) {
			RESOLVERS.set(corpus, makeDefaultResolver(corpus));
		}
	},
	listRegistered(): readonly string[] {
		return Array.from(RESOLVERS.keys());
	},
};
