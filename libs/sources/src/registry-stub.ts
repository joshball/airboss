/**
 * Default `RegistryReader` that knows nothing. Used by the validator when no
 * registry is supplied (today's state, until Phase 2 lands the constants table).
 *
 * Behavior: `hasEntry` returns false, `getEntry` returns null, etc. Every
 * registry-dependent rule (rows 2, 3, 4, 6, 11, 12, 13) treats this as
 * "registry has no information," which is the correct Phase 1 behavior --
 * lessons that cite real `airboss-ref:` URLs today get a row-2 ERROR (entry
 * not found), prompting them to wait for Phase 2 corpus ingestion.
 */

import type { RegistryReader, SourceId } from './types.ts';

export const NULL_REGISTRY: RegistryReader = {
	hasEntry(_id: SourceId): boolean {
		return false;
	},
	getEntry(_id: SourceId) {
		return null;
	},
	hasEdition(_id: SourceId, _edition: string): boolean {
		return false;
	},
	getEditionLifecycle(_id: SourceId, _edition: string) {
		return null;
	},
	getCurrentAcceptedEdition(_corpus: string): string | null {
		return null;
	},
	getEditionDistance(_id: SourceId, _pin: string): number | null {
		return null;
	},
	walkAliases(_id: SourceId, _fromEdition: string, _toEdition: string) {
		return [];
	},
	walkSupersessionChain(_id: SourceId) {
		return [];
	},
	isCorpusKnown(_corpus: string): boolean {
		return false;
	},
};
