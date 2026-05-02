/**
 * Zod runtime schemas for hangar jsonb columns.
 *
 * Drizzle's `$type<...>` is a compile-time hint -- it does not validate the
 * shape of jsonb on read or write. For columns that drive correctness (e.g.
 * `hangar.sync_log.rev_snapshot`, the load-bearing input to the sync's
 * conflict detector) we want a runtime guard at every BC edge so a stray
 * manual SQL fix-up or a future migration that changes the shape can't
 * silently corrupt downstream logic.
 *
 * Use `parseRevSnapshot` (safe parse, returns `null` on shape mismatch) at
 * read time so consumers degrade to "no last successful sync" instead of
 * crashing the worker. Use `assertRevSnapshot` at write time so a malformed
 * snapshot fails fast with a helpful error.
 */

import { z } from 'zod';

/**
 * Per-id `rev` snapshot persisted in `hangar.sync_log.rev_snapshot`.
 *
 * Shape: `{ references: { [id]: rev }, sources: { [id]: rev } }`. Every
 * value is a non-negative integer (revs are monotonically increasing
 * counters; never fractional, never negative).
 */
export const RevSnapshotSchema = z
	.object({
		references: z.record(z.string(), z.number().int().nonnegative()),
		sources: z.record(z.string(), z.number().int().nonnegative()),
	})
	.strict();

export type RevSnapshot = z.infer<typeof RevSnapshotSchema>;

/**
 * Read-time guard: parse an unknown jsonb payload into a `RevSnapshot`,
 * returning `null` when the shape is wrong. The sync conflict detector
 * treats `null` the same as "no last successful sync" -- safe degradation
 * over a hard crash.
 *
 * Returns `null` for `null` / `undefined` input as well so callers can
 * pipe `row.revSnapshot` straight in.
 */
export function parseRevSnapshot(value: unknown): RevSnapshot | null {
	if (value === null || value === undefined) return null;
	const parsed = RevSnapshotSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

/**
 * Write-time guard: assert a snapshot is well-shaped before persisting it.
 * Throws a `ZodError` with a clear path on the first malformed entry.
 * Accepts `null` (which short-circuits to `null` -- a conflict / failure
 * row may legitimately have no snapshot to persist).
 */
export function assertRevSnapshot(value: unknown): RevSnapshot | null {
	if (value === null || value === undefined) return null;
	return RevSnapshotSchema.parse(value);
}
