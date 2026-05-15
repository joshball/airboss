// @browser-globals: server-only -- never imported by client .svelte
/**
 * Server-side query for per-user wx-practice mastery rows.
 *
 * In the steady state this delegates to `@ab/bc-wx-practice/server`
 * (`getMasteryFor(userId, product)`), which Drill Phase 3 owns. While that
 * BC is in flight, the loader returns an empty array -- the dashboard
 * gracefully renders the "never seen" view across every catalog family.
 * Switching to the live BC is a 5-line edit inside `fetchMasteryRows`.
 *
 * The shape we return is the FROZEN contract from Drill Phase 3, mirrored
 * locally at `$lib/types/wx-practice-mastery-contract.ts`. When
 * `@ab/bc-wx-practice` lands, swap the import to the canonical type.
 */
import type { WxPracticeMasteryRow, WxPracticeProduct } from '$lib/types/wx-practice-mastery-contract';

/**
 * Fetch every mastery row for one user / product.
 *
 * TODO(drill-phase-3): replace the empty-array fallback with
 * `getMasteryFor(userId, product)` from `@ab/bc-wx-practice/server` once the
 * BC is published. The fallback is a graceful empty-state, not a stub: the
 * dashboard is fully usable with zero rows (it shows every catalog family as
 * "never seen") so we can ship this surface without waiting on the BC.
 */
export async function fetchMasteryRows(
	_userId: string,
	_product: WxPracticeProduct,
): Promise<ReadonlyArray<WxPracticeMasteryRow>> {
	// Awaiting a resolved value keeps the function shape async-compatible
	// with the eventual `@ab/bc-wx-practice/server` call, which will be a
	// Drizzle query returning `Promise<WxPracticeMasteryRow[]>`.
	return Promise.resolve([]);
}
