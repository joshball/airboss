/**
 * Phase 5 -- alias resolver.
 *
 * Source of truth: ADR 019 §6.1 (alias kinds).
 *
 * Wraps the production registry's `walkAliases` and turns the first matching
 * alias into a typed outcome. The alias kind dominates the body-hash compare
 * downstream: when the registry author has classified a transition explicitly,
 * we trust the classification.
 */

import { productionRegistry } from '../registry/index.ts';
import type { AliasKind, SourceId } from '../types.ts';
import type { EditionPair } from './pair-walker.ts';

export interface AliasOutcome {
	readonly kind: AliasKind;
	readonly to: SourceId | readonly SourceId[];
}

/**
 * Resolve the alias outcome for `pair`, walking aliases in the new edition's
 * record. Returns `null` when no alias entry whose `from === pair.id` exists
 * in the range.
 */
export function resolveAliasOutcome(pair: EditionPair): AliasOutcome | null {
	const aliases = productionRegistry.walkAliases(pair.id, pair.oldEdition, pair.newEdition);
	for (const alias of aliases) {
		if (alias.from === pair.id) {
			return { kind: alias.kind, to: alias.to };
		}
	}
	return null;
}
