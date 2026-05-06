/**
 * Pure helpers for `reference_section.metadata` jsonb shape.
 *
 * Per the 2026-05-06 review §K, handbook-specific extras (FAA-printed page
 * references) live under `metadata.faaPages` rather than dedicated columns
 * on the corpus-agnostic `reference_section` table. This module is browser-
 * safe -- no DB imports, no `node:*` -- so the runtime barrel can re-export
 * it for use in `.svelte` files that need to render page references.
 *
 * Validation moves to ingest-time Zod (`manifest-validation.ts`); these
 * runtime helpers narrow opportunistically and return null when the shape
 * doesn't match.
 */

/**
 * FAA-printed page references for a handbook section. `start` is required
 * when present (an empty string means "no page reference for this row");
 * `end` is null when the section ends on its start page (single-page
 * sections). NULL elsewhere (CFR / ACS / AC / AIM rows).
 */
export interface ReferenceSectionFaaPages {
	start: string;
	end: string | null;
}

/**
 * Read `metadata.faaPages` off a row's metadata blob, or NULL if absent.
 * Tolerant of malformed shapes -- returns null rather than throwing so
 * legacy rows that predate the field still render.
 */
export function faaPagesFromMetadata(metadata: unknown): ReferenceSectionFaaPages | null {
	if (!metadata || typeof metadata !== 'object') return null;
	const pages = (metadata as { faaPages?: unknown }).faaPages;
	if (!pages || typeof pages !== 'object') return null;
	const start = (pages as { start?: unknown }).start;
	const end = (pages as { end?: unknown }).end;
	if (typeof start !== 'string' || start.length === 0) return null;
	return {
		start,
		end: typeof end === 'string' && end.length > 0 ? end : null,
	};
}
