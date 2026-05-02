/**
 * Drizzle client for the `sources_registry` namespace.
 *
 * Re-exports the shared Drizzle handle from `@ab/db/connection` so the read
 * and write paths in `libs/sources/src/registry/` can call
 * `db.select().from(promotionBatches)` and `db.transaction(...)` without
 * each call site importing the connection module directly. Mirrors the
 * pattern used by `@ab/audit` (which imports `db` from `@ab/db/connection`)
 * and `@ab/bc-study`'s schema tests.
 *
 * The deep import path (`@ab/db/connection`) is intentional: the bare
 * `@ab/db` index is a client-safe surface that intentionally omits the
 * live pool. The registry's writers run server-side only; the deep import
 * keeps the Node-only `postgres` driver out of any consumer that just
 * needs the column helpers from `@ab/db`.
 *
 * Phase 1 only authors this re-export. Phase 2's `getEditionsMap` and
 * Phase 3's `recordPromotion` consume `db` directly from this module.
 */

export { db } from '@ab/db/connection';
