/**
 * `@ab/sources/render` -- Phase 4 of ADR 019.
 *
 * Public API:
 *
 *   extractIdentifiers(body)               -- list raw identifiers in source order, deduped
 *   batchResolve(ids, ctx)                 -- resolve to SourceEntry + chain + liveUrl + indexed + annotation
 *                                              (server-only: exported from `@ab/sources/server`)
 *   substituteTokens(body, resolved, mode) -- emit the rendered surface for the given mode
 *
 *   registerToken(token)                   -- extend the token set
 *   getToken(name)                         -- look up a token
 *   listTokens()                           -- snapshot of registered tokens
 *
 *   toSerializable(map)                    -- SvelteKit transport: Map -> JSON-safe Record
 *   fromSerializable(record)               -- SvelteKit transport: Record -> Map
 *
 * Source of truth: ADR 019 §1.4 (multi-reference adjacency), §2.5 (render API),
 * §3.1 (substitution tokens + render modes), §3.4 (acknowledgments), §6.2 +
 * §6.3 (cross-corpus + cascade annotations).
 */

export { computeAdjacencyGroups, indexGroupsByMember, memberIndex } from './adjacency.ts';
export {
	type AnnotationInput,
	computeAnnotation,
	findMatchingAcks,
} from './annotations.ts';
// `batchResolve` + `__batch_internal__` moved to `@ab/sources/server` -- they
// reach `registry/query.ts` which static-imports `node:fs`. Re-exporting them
// here pulls the whole server-only resolution chain into the runtime barrel
// and crashes browser hydration with the `Module "node:fs" has been
// externalized` stub. Server callers (`+page.server.ts` load helpers, the
// study lesson-references loader) import them from `@ab/sources/server`.
export { extractIdentifiers } from './extract.ts';
export { renderDefaultModeLink } from './modes/default.ts';
export { renderPlainTextLink } from './modes/plain-text.ts';
export { type PrintFootnoteSink, renderPrintLink } from './modes/print.ts';
export { renderTtsLink } from './modes/tts.ts';
export { renderWebLink } from './modes/web.ts';
export { fromSerializable, toSerializable } from './serialize.ts';
export { substituteTokens } from './substitute.ts';
export {
	__resetResolveStub,
	__setResolveStub,
	__token_internal__,
	formatListText,
	getToken,
	listTokens,
	registerToken,
} from './tokens.ts';
