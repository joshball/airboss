/**
 * Bootstrap-time registry hydration.
 *
 * `initRegistry()` warms two pieces of in-memory state from Postgres so a
 * freshly-started process matches the persisted audit trail and edition
 * catalogue:
 *
 *   1. The `ENTRY_LIFECYCLES` overlay -- replayed from `promotion_batches`
 *      ordered by `promotion_date` so the last-write-wins state per id is
 *      reflected.
 *   2. The `_activeEditions` cache -- populated from `editions` so sync
 *      callers (the renderer + every per-corpus resolver) see persisted
 *      edition rows on the first read.
 *
 * Both warm operations are idempotent. The function is intended to be
 * called once per process at app bootstrap (e.g. from
 * `apps/{app}/src/hooks.server.ts`); top-level await is intentionally
 * avoided so module ordering stays predictable in Bun + Vitest. Callers
 * that need to drop and rebuild the caches at runtime can call this
 * function again -- it tolerates being invoked from multiple sites.
 */

import { warmEditionsCache } from './editions-db.ts';
import { rebuildLifecycleOverlay } from './lifecycle.ts';

export async function initRegistry(): Promise<void> {
	await Promise.all([rebuildLifecycleOverlay(), warmEditionsCache()]);
}
