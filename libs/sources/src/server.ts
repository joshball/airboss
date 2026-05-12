// @browser-globals: server-only -- never imported by client .svelte
//
// Server-only barrel for `@ab/sources`. Every value re-exported here touches
// `@ab/db/connection` (the postgres driver) and cannot be evaluated in a
// browser bundle. Client surfaces import from `@ab/sources` (the root barrel)
// for browser-safe helpers; server surfaces -- `+page.server.ts`,
// `+server.ts`, `apps/*/src/lib/server/**`, scripts -- import from here.
//
// Pattern mirrors `@ab/bc-study/server`. Adding a value re-export here ALSO
// requires `scripts/check-browser-globals.ts` to list `@ab/sources/server` in
// `SERVER_ONLY_PACKAGE_PATTERNS` so a `.svelte` file that tries to import
// from it fails the check.

// CorpusResolver registration is a server-only side effect. Each corpus
// `index.ts` imports `node:fs` transitively (via its `resolver.ts`), which
// crashes hydration in the browser through Vite's externalized-node-builtin
// stub. Importing this server barrel from `hooks.server.ts` (or any other
// server-only entry point) is what makes the production registry usable.
import './regs/index.ts';
import './handbooks/index.ts';
import './acs/index.ts';
import './pts/index.ts';
import './aim/index.ts';
import './ac/index.ts';
import './orders/index.ts';
import './ntsb/index.ts';
import './interp/index.ts';
import './pohs/index.ts';
import './sectionals/index.ts';
import './plates/index.ts';
import './statutes/index.ts';
import './forms/index.ts';
import './info/index.ts';
import './safo/index.ts';
import './tcds/index.ts';
import './asrs/index.ts';
import './ntsb-alj/index.ts';

// Side-effect wiring: the runtime barrel defaults the parent-walk resolver
// in `render/tokens.ts` to a no-op so it can load in the browser without
// dragging `registry/query.ts` (which static-imports `node:fs`) into the
// client bundle. Server entry points import this barrel for `initRegistry`;
// the side effect below makes `@chapter`, `@subpart`, and `@part` token
// substitution functional server-side via the production registry.
import { resolveIdentifier as _resolveIdentifier } from './registry/query.ts';
import { __setResolveStub as _setResolveStub } from './render/tokens.ts';

_setResolveStub(_resolveIdentifier);

// Re-export server-only registry entry points so callers can hit one barrel.
export { initRegistry } from './registry/init.ts';
export { getCorpusResolver } from './registry/corpus-resolver.ts';
export { productionRegistry } from './registry/index.ts';
export { writeCfrNavTree } from './regs/nav-tree.ts';

// `batchResolve` walks the production registry via `registry/query.ts`, which
// static-imports `node:fs`. Server-side render-loader entry point lives here
// so the runtime barrel (`@ab/sources`) stays browser-safe. The other render
// helpers (`extractIdentifiers`, `substituteTokens`, `toSerializable`,
// `fromSerializable`, token registry) stay on the runtime barrel -- they're
// pure and used by `.svelte` components directly.
export { __batch_internal__, batchResolve } from './render/batch-resolve.ts';

// Phase 9 runtime registry hydration. `bootstrap.ts` statically imports
// `node:fs` and synthesizes `SourceEntry` + `Edition` rows from on-disk
// derivative manifests, so it cannot evaluate in a browser bundle. Callers
// (`bun run airboss-ref`, `+page.server.ts`, ingest scripts) import these
// from the server barrel; the runtime barrel re-exports only the types.
export { hydrateRegsFromDerivatives, PHASE_9_BOOTSTRAP_REVIEWER_ID } from './bootstrap.ts';
// Drizzle table handles for callers that need to author their own subqueries
// (e.g. ADR 026 BC-consumers building a `notSupersededInRegistry` predicate
// against `study.reference`). Surfaced from the server barrel because their
// only legitimate consumers are query authors -- not types.
export { type EditionRow, editions, type NewEditionRow } from './db/schema.ts';
// ADR 026 §6 resolver API.
export {
	getCurrentEdition,
	getEditionByLabel,
	isEditionSuperseded,
	listEditionsForSource,
} from './registry/edition-resolver.ts';
// ADR 026 §3 seed-time writer (the seed is the only caller; the
// `edition-cache-write-guard` lint blocks non-seed call sites).
export { markPriorEditionsRetired, type UpsertEditionInput, upsertEdition } from './registry/edition-writer.ts';
// Existing server-only helpers callers reach via deep file import today.
// Surface them here so future callers don't reach into `registry/editions.ts`
// directly. `getEditionsMap` (the sync, in-memory variant called from
// per-corpus resolvers that ship in the browser barrel) is intentionally
// omitted -- it's pure-read and stays callable from the runtime barrel.
export {
	getCurrentEditionForSource,
	getEditionsMapAsync,
	loadEditionsFromDb,
	warmEditionsCache,
} from './registry/editions.ts';
