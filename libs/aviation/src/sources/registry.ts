/**
 * Source registry.
 *
 * Phase 1 (wp-reference-system-core) ships this array empty. The extraction
 * pipeline package (wp-reference-extraction-pipeline) populates it with the
 * known corpus files (CFR XML, AIM PDF, POH, ...). The type + stub array
 * live here so every consumer (validator, references, future extractors)
 * shares one import path.
 */

import type { Source } from '../schema/source';

export const SOURCES: readonly Source[] = [];
