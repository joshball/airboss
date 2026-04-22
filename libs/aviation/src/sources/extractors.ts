/**
 * Central registry of `SourceExtractor` implementations.
 *
 * `scripts/references/extract.ts` imports `allExtractors` and dispatches
 * every manifest id to the first extractor whose `canHandle(sourceId)`
 * returns true. Adding a new source type (AIM, POH, ...) is a matter of
 * implementing a `SourceExtractor`, exporting the singleton, and appending
 * it here.
 */

import type { SourceExtractor } from '../schema/source';
import { cfrExtractor } from './cfr/extract';

export const allExtractors: readonly SourceExtractor[] = [cfrExtractor];

/** Return the extractors that claim `canHandle(sourceId)`. */
export function resolveExtractors(sourceId: string): readonly SourceExtractor[] {
	return allExtractors.filter((e) => e.canHandle(sourceId));
}
