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
 * Bootstrap list of known corpora, used to seed default no-op resolvers at
 * module load BEFORE the per-corpus side-effect imports run. After init,
 * each corpus's own `index.ts` replaces its bootstrap default with a real
 * resolver via `registerCorpusResolver`.
 *
 * Per ADR 019 §2.1: "`corpus` is a string, not a closed enum. New corpus =
 * new resolver registration; no constants change." The list below is a
 * pre-registration convenience so the validator's row-1 enumeration check
 * can recognise a corpus prefix even before its module is imported. Any
 * corpus that calls `registerCorpusResolver` (the single source of truth)
 * gets folded into the registry whether or not it appears here.
 *
 * `ENUMERATED_CORPORA` is computed live from the registry, so adding a
 * corpus to this list OR registering a real resolver both make the corpus
 * visible to iteration without further edits.
 */
const BOOTSTRAP_CORPORA: readonly string[] = [
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
	'pts',
	'forms',
	'tcds',
	'asrs',
	'info',
	'safo',
	'ntsb-alj',
];

/**
 * Live iterable view of every corpus currently registered with a resolver.
 * Reads off the resolver registry (the single source of truth) at the
 * moment of iteration, so consumers always see whatever is registered now
 * -- including corpora whose side-effect imports landed after module init,
 * and tests that registered a fake corpus mid-test.
 *
 * Per ADR 019 §2.1: "`corpus` is a string, not a closed enum. New corpus =
 * new resolver registration; no constants change."
 */
export const ENUMERATED_CORPORA: Iterable<string> & { readonly length: number } = {
	get length(): number {
		return RESOLVERS.size;
	},
	[Symbol.iterator](): IterableIterator<string> {
		return RESOLVERS.keys();
	},
};

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

// Eagerly register a default no-op resolver for every bootstrap corpus.
// Phase 3+ replace their corpus's default by calling `registerCorpusResolver`.
for (const corpus of BOOTSTRAP_CORPORA) {
	RESOLVERS.set(corpus, makeDefaultResolver(corpus));
}

/**
 * Tracks the most-recent "production" registration per corpus. Real
 * side-effect-imported resolvers (regs, handbooks, acs, pts, aim, ac) call
 * `registerCorpusResolver` at module-load time, which records them here.
 *
 * `__corpus_resolver_internal__.resetToDefaults` restores `RESOLVERS` from
 * this snapshot, undoing any test-only mock registrations without wiping
 * the real resolvers.
 *
 * Tests that need a clean slate use
 * `__corpus_resolver_internal__.wipeToNoOpDefaults` for the duration of
 * the test, paired with `resetToDefaults` in afterEach to restore.
 */
const PRODUCTION_SNAPSHOT: Map<string, CorpusResolver> = new Map();

// Eagerly seed the snapshot with the no-op defaults so corpora with no real
// resolver fall back to the no-op behavior on reset.
for (const corpus of BOOTSTRAP_CORPORA) {
	const resolver = RESOLVERS.get(corpus);
	if (resolver !== undefined) PRODUCTION_SNAPSHOT.set(corpus, resolver);
}

/**
 * Register (or replace) a corpus resolver. Idempotent if `resolver` is the
 * exact same reference as the currently-registered one.
 *
 * The registration is recorded in the production snapshot so subsequent
 * `__corpus_resolver_internal__.resetToDefaults` calls preserve it.
 * Test-only mock registrations should use
 * `__corpus_resolver_internal__.registerTestResolver` instead, which does
 * NOT update the snapshot.
 */
export function registerCorpusResolver(resolver: CorpusResolver): void {
	RESOLVERS.set(resolver.corpus, resolver);
	PRODUCTION_SNAPSHOT.set(resolver.corpus, resolver);
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
 * Test-only: restore the registry to the last-known "production" snapshot.
 *
 * The snapshot is updated by every `registerCorpusResolver` call, so
 * side-effect-imported real resolvers (regs, handbooks, acs, pts, aim, ac)
 * are folded in at module-load time. Test-only mock registrations should
 * use `registerTestResolver` (which does NOT update the snapshot) so this
 * reset rolls them back without wiping the real resolvers.
 *
 * Production code MUST NOT call this.
 */
export const __corpus_resolver_internal__ = {
	resetToDefaults(): void {
		RESOLVERS.clear();
		for (const [corpus, resolver] of PRODUCTION_SNAPSHOT) {
			RESOLVERS.set(corpus, resolver);
		}
	},
	/**
	 * Test-only: register a resolver WITHOUT updating the production
	 * snapshot. Tests that mock a corpus-resolver mid-test should use
	 * this so a subsequent `resetToDefaults` can roll them back to the
	 * real production resolver.
	 */
	registerTestResolver(resolver: CorpusResolver): void {
		RESOLVERS.set(resolver.corpus, resolver);
	},
	/**
	 * Test-only: wipe every corpus to its no-op default resolver, WITHOUT
	 * touching the production snapshot. Use this in tests that exercise
	 * the no-op default behavior; pair with `resetToDefaults` in afterEach
	 * to restore the production registry for the next file.
	 *
	 * Wipes back to the union of (current registrations + bootstrap list)
	 * so corpora whose side-effect resolver registered after init are
	 * preserved as no-op defaults rather than disappearing entirely.
	 */
	wipeToNoOpDefaults(): void {
		const knownCorpora = new Set<string>(BOOTSTRAP_CORPORA);
		for (const corpus of RESOLVERS.keys()) {
			knownCorpora.add(corpus);
		}
		RESOLVERS.clear();
		for (const corpus of knownCorpora) {
			RESOLVERS.set(corpus, makeDefaultResolver(corpus));
		}
	},
	/**
	 * Test-only: snapshot the current `PRODUCTION_SNAPSHOT` so a test that
	 * legitimately exercises `registerCorpusResolver` (which mutates the
	 * snapshot) can roll it back afterwards. Returns a function that
	 * restores the snapshot when called.
	 */
	saveProductionSnapshot(): () => void {
		const saved = new Map(PRODUCTION_SNAPSHOT);
		return () => {
			PRODUCTION_SNAPSHOT.clear();
			for (const [corpus, resolver] of saved) {
				PRODUCTION_SNAPSHOT.set(corpus, resolver);
			}
		};
	},
	listRegistered(): readonly string[] {
		return Array.from(RESOLVERS.keys());
	},
};
