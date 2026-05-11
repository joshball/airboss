/**
 * Pure display helpers for `study.note` rows. Browser-safe -- no DB
 * imports. Lives separately from `./notes` so the runtime barrel can
 * value-re-export these without dragging the postgres driver into the
 * client bundle (the canonical PR #664 pattern).
 *
 * Server callers can import the same helpers from `@ab/bc-study` or
 * `@ab/bc-study/server`; both reach this module without going through
 * the DB-touching `./notes`.
 */

import { NOTE_TITLE_MAX_LENGTH, NOTES_SORT, type NotesSort } from '@ab/constants';
import type { NoteRow } from './schema';

/**
 * Compute the display title for a note. When the row carries an
 * explicit title, return it. Otherwise derive from the first non-empty
 * line of the body, capped at NOTE_TITLE_MAX_LENGTH characters and
 * with markdown stripping kept minimal (just leading `#` markers and
 * surrounding whitespace).
 */
export function deriveNoteTitle(row: Pick<NoteRow, 'title' | 'bodyMd'>): string {
	if (row.title.length > 0) return row.title;
	const firstLine = row.bodyMd
		.split('\n')
		.map((l) => l.trim())
		.find((l) => l.length > 0);
	if (firstLine === undefined) return 'Untitled note';
	const stripped = firstLine.replace(/^#+\s*/, '').trim();
	const truncated =
		stripped.length > NOTE_TITLE_MAX_LENGTH ? `${stripped.slice(0, NOTE_TITLE_MAX_LENGTH - 1)}…` : stripped;
	return truncated.length > 0 ? truncated : 'Untitled note';
}

/**
 * Encode the next-page cursor for `listNotesForUser` / `searchNotes`.
 * Format: `<ISOTimestamp>::<noteId>` -- the timestamp matches the
 * sort column (createdAt for `newest` / `oldest`, updatedAt for
 * `updated`); the id breaks ties so the cursor is monotone.
 */
export function encodeNotesCursor(row: Pick<NoteRow, 'createdAt' | 'updatedAt' | 'id'>, sort: NotesSort): string {
	const ts = sort === NOTES_SORT.UPDATED ? row.updatedAt : row.createdAt;
	return `${ts.toISOString()}::${row.id}`;
}
