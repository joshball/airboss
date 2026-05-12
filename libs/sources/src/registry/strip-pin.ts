/**
 * Pure helper: strip the `?at=...` pin from a `SourceId`-shaped string,
 * leaving the canonical pin-agnostic key.
 *
 * Carved out from `registry/query.ts` so browser-eligible modules
 * (`render/tokens.ts`, `render/batch-resolve.ts`, etc.) can reach the
 * pin-strip helper without dragging `query.ts`'s `node:fs` imports into
 * the client bundle. `query.ts` re-exports this function so its existing
 * server-side callers don't change.
 */
export function stripPin(raw: string): string {
	const queryStart = raw.indexOf('?');
	return queryStart === -1 ? raw : raw.slice(0, queryStart);
}
