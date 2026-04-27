/**
 * Production registry assembly.
 *
 * Source of truth: ADR 019 §2 (registry), §2.4 (lifecycle), §6 (aliases /
 * supersession). This module wires the constants table (`SOURCES`), the
 * edition map (`EDITIONS`), the corpus resolvers (`corpus-resolver.ts`),
 * and the query API (`query.ts`) into a single `RegistryReader`-shaped
 * object that the validator (Phase 1) can consume directly.
 *
 * The wider query API is exported as a namespace for the renderer, the
 * annual diff job, and any other consumer that needs richer surface.
 */

import type { AliasEntry, RegistryReader, SourceEntry, SourceId, SourceLifecycle } from '../types.ts';
import { isEnumeratedCorpus } from './corpus-resolver.ts';
import { getEditionsMap } from './editions.ts';
import { getEntryLifecycle } from './lifecycle.ts';
import { getCurrentEdition, hasEntry, resolveIdentifier, stripPin, walkSupersessionChain } from './query.ts';

/**
 * The production `RegistryReader` consumed by the validator and any other
 * module that depends on the 9-method `RegistryReader` interface defined in
 * Phase 1.
 *
 * Phase 2 ships the full implementation against an empty `SOURCES` table;
 * Phase 3+ populate the table without touching this file.
 */
export const productionRegistry: RegistryReader = {
	hasEntry(id: SourceId): boolean {
		return hasEntry(id);
	},
	getEntry(id: SourceId): SourceEntry | null {
		const entry = resolveIdentifier(id);
		if (entry === null) return null;
		// Apply lifecycle overlay: `lifecycle.ts` may have walked the entry
		// through `pending -> accepted` etc. since the static table was loaded.
		const overlay = getEntryLifecycle(stripPin(id) as SourceId);
		if (overlay !== null && overlay !== entry.lifecycle) {
			return { ...entry, lifecycle: overlay };
		}
		return entry;
	},
	hasEdition(id: SourceId, edition: string): boolean {
		const stripped = stripPin(id) as SourceId;
		const editions = getEditionsMap().get(stripped) ?? [];
		return editions.some((e) => e.id === edition);
	},
	getEditionLifecycle(id: SourceId, _edition: string): SourceLifecycle | null {
		// Phase 2 surfaces the entry's lifecycle when the edition exists; the
		// per-edition lifecycle (each edition having its own `accepted`/`pending`
		// state) is a Phase 5+ enhancement when the diff job lands.
		if (!this.hasEdition(id, _edition)) return null;
		const stripped = stripPin(id) as SourceId;
		return getEntryLifecycle(stripped);
	},
	getCurrentAcceptedEdition(corpus: string): string | null {
		return getCurrentEdition(corpus);
	},
	getEditionDistance(id: SourceId, pin: string): number | null {
		const stripped = stripPin(id) as SourceId;
		const editions = getEditionsMap().get(stripped) ?? [];
		if (editions.length === 0) return null;
		const entry = resolveIdentifier(id);
		if (entry === null) return null;
		const current = getCurrentEdition(entry.corpus);
		if (current === null) return null;
		const pinIdx = editions.findIndex((e) => e.id === pin);
		const curIdx = editions.findIndex((e) => e.id === current);
		if (pinIdx === -1 || curIdx === -1) return null;
		return curIdx - pinIdx;
	},
	walkAliases(id: SourceId, fromEdition: string, toEdition: string): readonly AliasEntry[] {
		const stripped = stripPin(id) as SourceId;
		const editions = getEditionsMap().get(stripped) ?? [];
		const fromIdx = editions.findIndex((e) => e.id === fromEdition);
		const toIdx = editions.findIndex((e) => e.id === toEdition);
		if (fromIdx === -1 || toIdx === -1) return [];
		const lo = Math.min(fromIdx, toIdx);
		const hi = Math.max(fromIdx, toIdx);
		const out: AliasEntry[] = [];
		for (let i = lo; i <= hi; i += 1) {
			const edition = editions[i];
			if (edition === undefined) continue;
			if (edition.aliases !== undefined) {
				out.push(...edition.aliases);
			}
		}
		return out;
	},
	walkSupersessionChain(id: SourceId): readonly SourceEntry[] {
		return walkSupersessionChain(id);
	},
	isCorpusKnown(corpus: string): boolean {
		return isEnumeratedCorpus(corpus);
	},
};

// ---------------------------------------------------------------------------
// Re-exports for namespace consumers
// ---------------------------------------------------------------------------

export {
	type CitationStyle,
	type CorpusResolver,
	ENUMERATED_CORPORA,
	getCorpusResolver,
	isEnumeratedCorpus,
	makeDefaultResolver,
	registerCorpusResolver,
} from './corpus-resolver.ts';
export { EDITIONS } from './editions.ts';
export {
	type DePromotionInput,
	getBatch,
	getEntryLifecycle,
	getValidTransitions,
	isValidTransition,
	listBatches,
	type PromotionBatch,
	type PromotionInput,
	type PromotionResult,
	type PromotionState,
	recordDePromotion,
	recordPromotion,
} from './lifecycle.ts';
export {
	clearReverseIndex,
	findEntriesByCanonicalShort,
	findLessonsCitingEntry,
	findLessonsCitingMultiple,
	findLessonsTransitivelyCitingEntry,
	getChildren,
	getCurrentEdition,
	getEditions,
	hasEntry,
	isPinStale,
	isSupersessionChainBroken,
	lessonId,
	resolveIdentifier,
	stripPin,
	walkSupersessionChain,
} from './query.ts';
export { __sources_internal__, getSources, SOURCES } from './sources.ts';
