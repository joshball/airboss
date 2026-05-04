/**
 * Saved-deck overlay BC. The dashboard's "Saved Decks" list is otherwise
 * implicit -- every distinct `deck_hash` on a `memory_review_session` row
 * shows up automatically. This module owns the per-(user, deckHash) overlay
 * that lets a learner rename or dismiss an entry without touching the
 * underlying review-session history.
 *
 * Lives in its own file (not `review-sessions.ts`) so the deck-overlay shape
 * stays separate from the per-run lifecycle: future work that grows the
 * overlay -- pinning, ordering, color tags -- has somewhere obvious to land.
 *
 * See `docs/work-packages/review-sessions-url/spec.md` Layer (b) Redo.
 */

import { SAVED_DECK_LABEL_MAX_LENGTH } from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { generateSavedDeckId } from '@ab/utils';
import { eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { type SavedDeckRow, savedDeck } from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

// ---------- Errors ----------

/**
 * Raised when a label fails the length / shape contract before it touches
 * the DB. Route handlers translate this to a 400 with the message.
 */
export class SavedDeckLabelTooLongError extends Error {
	constructor(
		public readonly length: number,
		public readonly max: number = SAVED_DECK_LABEL_MAX_LENGTH,
	) {
		super(`Saved-deck label is ${length} characters; maximum is ${max}`);
		this.name = 'SavedDeckLabelTooLongError';
	}
}

// ---------- Public API ----------

/**
 * Normalize a raw label string into the value that should land on the row.
 * Trims whitespace, treats the empty result as NULL (the "clear the label"
 * path), and enforces {@link SAVED_DECK_LABEL_MAX_LENGTH}. Exported so the
 * route action can validate the same way the BC does without rebuilding
 * the rules.
 */
export function normalizeSavedDeckLabel(raw: string | null | undefined): string | null {
	if (raw === null || raw === undefined) return null;
	const trimmed = raw.trim();
	if (trimmed.length === 0) return null;
	if (trimmed.length > SAVED_DECK_LABEL_MAX_LENGTH) {
		throw new SavedDeckLabelTooLongError(trimmed.length);
	}
	return trimmed;
}

/**
 * Set / clear the user-supplied label for a saved deck. Pass `null` (or an
 * empty string, which normalizes to `null`) to clear the label and fall back
 * to the auto-derived summary. Pass a non-empty string to set the label.
 *
 * Idempotent against the (user, deckHash) unique index: the first call
 * inserts a new overlay row; subsequent calls update the existing row.
 * Renaming a previously-dismissed deck also clears `dismissed_at` so the
 * entry comes back into view -- the learner explicitly named it, so they
 * clearly want to see it again.
 *
 * Raises {@link SavedDeckLabelTooLongError} when the label exceeds the
 * configured maximum length.
 */
export async function renameSavedDeck(
	userId: string,
	deckHash: string,
	rawLabel: string | null,
	db: Db = defaultDb,
): Promise<SavedDeckRow> {
	const label = normalizeSavedDeckLabel(rawLabel);

	// Single-statement upsert against the (user_id, deck_hash) UNIQUE.
	// The previous read-then-write path raced concurrent double-clicks
	// (two tabs, an enhance retry, ...) into two simultaneous INSERTs;
	// one would surface a raw 23505 instead of the typed BC outcome.
	// `onConflictDoUpdate` lets the DB pick the winner in one round-trip
	// and re-applies the rename semantics: clear `dismissed_at` (so a
	// previously-dismissed deck comes back into view) and install the
	// new label.
	const [row] = await db
		.insert(savedDeck)
		.values({
			id: generateSavedDeckId(),
			userId,
			deckHash,
			label,
			dismissedAt: null,
		})
		.onConflictDoUpdate({
			target: [savedDeck.userId, savedDeck.deckHash],
			set: { label, dismissedAt: null },
		})
		.returning();
	return row;
}

/**
 * Soft-delete a saved deck. Stamps `dismissed_at` so the dashboard list
 * stops surfacing the entry. The matching `memory_review_session` rows
 * (history + any in-progress run) are untouched -- "delete" here is a
 * dashboard operation, not a history wipe. Re-running the same filter via
 * `?deck=<hash>` reanimates the implicit entry; calling
 * {@link renameSavedDeck} also clears the timestamp.
 *
 * Idempotent: dismissing a row that doesn't yet exist creates a new
 * overlay row with `dismissed_at` set, so a second dismiss is a cheap
 * UPDATE rather than a 404. This matches the way the underlying Saved
 * Decks list is implicit -- the user shouldn't have to touch a deck to
 * "create" it before they can dismiss it.
 */
export async function deleteSavedDeck(
	userId: string,
	deckHash: string,
	db: Db = defaultDb,
	now: Date = new Date(),
): Promise<SavedDeckRow> {
	// Single-statement upsert -- same race fix as `renameSavedDeck`.
	// Two concurrent dismisses (e.g. an enhance retry firing twice) used
	// to read "no row" twice and INSERT twice; the DB-level UNIQUE
	// rejected the second with a 23505. Now both paths land as one
	// upsert that stamps `dismissed_at` whether the row existed or not.
	const [row] = await db
		.insert(savedDeck)
		.values({
			id: generateSavedDeckId(),
			userId,
			deckHash,
			label: null,
			dismissedAt: now,
		})
		.onConflictDoUpdate({
			target: [savedDeck.userId, savedDeck.deckHash],
			set: { dismissedAt: now },
		})
		.returning();
	return row;
}

/**
 * Map of `deckHash -> overlay row` for the active (non-dismissed) saved
 * decks of a user. Used by `listSavedDecks` to apply the label override
 * and by future read-side surfaces that want the per-deck overlay.
 */
export async function getSavedDeckOverlays(userId: string, db: Db = defaultDb): Promise<Map<string, SavedDeckRow>> {
	const rows = await db.select().from(savedDeck).where(eq(savedDeck.userId, userId));
	const map = new Map<string, SavedDeckRow>();
	for (const row of rows) {
		map.set(row.deckHash, row);
	}
	return map;
}
