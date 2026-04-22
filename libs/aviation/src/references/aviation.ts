/**
 * Hand-authored aviation reference entries.
 *
 * Phase 1 ships this file empty. Phase 2 ports the 175 airboss-firc glossary
 * entries, retags them under the 5-axis taxonomy, drops the legacy `domain`
 * field, and maps `source: string` into structured `SourceCitation[]`.
 *
 * When populated, the module bootstrap below registers the entries with the
 * in-memory registry so downstream consumers (the /glossary route, the
 * ReferenceText renderer, the content validator) see them immediately.
 */

import { registerReferences } from '../registry';
import type { Reference } from '../schema/reference';

export const AVIATION_REFERENCES: readonly Reference[] = [];

// Register at module load so the registry is populated before any consumer
// imports it. No-op while the list is empty.
registerReferences(AVIATION_REFERENCES);
