// @browser-globals: server-only -- never imported by client .svelte
/**
 * Per-(user, reference) read-state loader for the flightbag reader pages.
 *
 * Returns a `Set<string>` of section ids the user has opened (status:
 * `reading` or `read`) -- the TOC drawer renders a checkmark for any
 * section in this set. Sections never visited produce no row; the BC
 * batches the lookup so one DB round-trip covers the whole reading order.
 *
 * Anonymous visitors get an empty set: the heartbeat / read-state UI
 * gracefully no-ops, and the drawer renders without checkmarks. Once
 * the entitlement primitive lands per ADR 024, the entitlement gate will
 * also run upstream of this helper -- but the helper itself stays
 * shape-stable because anonymous returns the same empty set.
 */

import { listReadStatesForReference } from '@ab/bc-study/server';
import { HANDBOOK_READ_STATUSES, type HandbookReadStatus } from '@ab/constants';

/**
 * Sections counted as "read" (and surfaced with a checkmark) when status is
 * either `read` (explicitly marked complete) or `reading` (heartbeat-credited
 * but not yet self-flagged complete). The drawer can't visually distinguish
 * the two without crowding; treating both as "read" matches the user's
 * intuition for "I've been here."
 */
const READ_STATUSES = new Set<HandbookReadStatus>([HANDBOOK_READ_STATUSES.READING, HANDBOOK_READ_STATUSES.READ]);

export async function loadReadSetForReference(userId: string | null, referenceId: string): Promise<Set<string>> {
	if (userId === null) return new Set<string>();
	const rows = await listReadStatesForReference(userId, referenceId);
	const out = new Set<string>();
	for (const row of rows) {
		if (READ_STATUSES.has(row.status as HandbookReadStatus)) {
			out.add(row.referenceSectionId);
		}
	}
	return out;
}
