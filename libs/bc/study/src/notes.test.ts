/**
 * Notes BC integration tests (wp-notes-primitive).
 *
 * Hits the dev Postgres directly (same convention as user-prefs / cards
 * / goals tests) so the Zod-validated insert + audit + cascade are
 * exercised end-to-end against real schema constraints.
 *
 * Each test creates a throwaway user (`generateAuthId`) and tears down
 * that user's notes + audit rows + the user row in `cleanup()`.
 */

import { auditLog } from '@ab/audit';
import { bauthUser } from '@ab/auth/schema';
import {
	AUDIT_TARGETS,
	NOTE_BODY_MAX_LENGTH,
	NOTE_OP_SUBKINDS,
	NOTE_TAGS_MAX,
	NOTES_ARCHIVED_FILTER,
	NOTES_SORT,
} from '@ab/constants';
import { db } from '@ab/db/connection';
import { generateAuthId, generateReferenceId, generateReferenceSectionId } from '@ab/utils';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
	archiveNote,
	clearFollowUp,
	createNote,
	deleteNote,
	getNote,
	listDistinctTags,
	listNotesForReference,
	listNotesForSection,
	listNotesForUser,
	listOpenFollowUps,
	listTagCloud,
	markFollowUpDone,
	NoFollowUpError,
	NoteNotFoundError,
	restoreNote,
	searchNotes,
	updateNote,
} from './notes';
import { deriveNoteTitle } from './notes-display';
import { note, reference, referenceSection } from './schema';

// --- Test fixture: a single reference + section that survives all tests.
// Created once in `beforeAll`, never torn down -- the rows are inert
// outside the notes BC and we share them across every test for FK
// targets without per-test setup overhead.
let TEST_REFERENCE_ID: string;
let TEST_SECTION_ID: string;
let SECOND_SECTION_ID: string;

async function isolatedUser(label: string): Promise<{ userId: string; cleanup: () => Promise<void> }> {
	const userId = generateAuthId();
	const now = new Date();
	await db.insert(bauthUser).values({
		id: userId,
		email: `notes-${label}-${userId}@airboss.test`,
		name: `${label} Test`,
		firstName: label,
		lastName: 'Test',
		emailVerified: true,
		role: 'learner',
		createdAt: now,
		updatedAt: now,
	});
	return {
		userId,
		cleanup: async () => {
			await db.delete(auditLog).where(eq(auditLog.actorId, userId));
			await db.delete(note).where(eq(note.userId, userId));
			await db.delete(bauthUser).where(eq(bauthUser.id, userId));
		},
	};
}

beforeAll(async () => {
	// One shared reference + 2 sections, used as FK targets across the
	// suite. Reuse if a previous run left them around (test data is
	// idempotent on insert + we do not depend on a specific id).
	const existing = await db.select().from(reference).where(eq(reference.kind, 'handbook')).limit(1);
	if (existing[0]) {
		TEST_REFERENCE_ID = existing[0].id;
	} else {
		TEST_REFERENCE_ID = generateReferenceId();
		await db.insert(reference).values({
			id: TEST_REFERENCE_ID,
			kind: 'handbook',
			documentSlug: `notes-test-${Date.now()}`,
			edition: 'test-1',
			editionDate: '2026-01-01',
			title: 'Notes Test Handbook',
			publisher: 'airboss-test',
		});
	}

	const existingSections = await db
		.select()
		.from(referenceSection)
		.where(eq(referenceSection.referenceId, TEST_REFERENCE_ID))
		.limit(2);
	if (existingSections.length >= 2 && existingSections[0] && existingSections[1]) {
		TEST_SECTION_ID = existingSections[0].id;
		SECOND_SECTION_ID = existingSections[1].id;
	} else {
		TEST_SECTION_ID = existingSections[0]?.id ?? generateReferenceSectionId();
		if (!existingSections[0]) {
			await db.insert(referenceSection).values({
				id: TEST_SECTION_ID,
				referenceId: TEST_REFERENCE_ID,
				airbossRef: `airboss-ref:test/notes-test/${TEST_SECTION_ID}`,
				level: 'section',
				code: 'NT.1',
				title: 'Notes Test Section 1',
				sourceLocator: 'Notes Test §NT.1',
				contentHash: `sha256:test-${TEST_SECTION_ID}`,
				ordinal: 1,
				depth: 0,
				contentMd: '',
			});
		}
		SECOND_SECTION_ID = existingSections[1]?.id ?? generateReferenceSectionId();
		if (!existingSections[1]) {
			await db.insert(referenceSection).values({
				id: SECOND_SECTION_ID,
				referenceId: TEST_REFERENCE_ID,
				airbossRef: `airboss-ref:test/notes-test/${SECOND_SECTION_ID}`,
				level: 'section',
				code: 'NT.2',
				title: 'Notes Test Section 2',
				sourceLocator: 'Notes Test §NT.2',
				contentHash: `sha256:test-${SECOND_SECTION_ID}`,
				ordinal: 2,
				depth: 0,
				contentMd: '',
			});
		}
	}
});

describe('createNote', () => {
	it('creates a freestanding note with no context FKs', async () => {
		const { userId, cleanup } = await isolatedUser('create-free');
		try {
			const row = await createNote(userId, { bodyMd: 'A free thought' });
			expect(row.userId).toBe(userId);
			expect(row.bodyMd).toBe('A free thought');
			expect(row.title).toBe('');
			expect(row.referenceId).toBeNull();
			expect(row.referenceSectionId).toBeNull();
			expect(row.tags).toEqual([]);
			expect(row.followUpMd).toBe('');
			expect(row.archivedAt).toBeNull();
		} finally {
			await cleanup();
		}
	});

	it('writes one audit row tagged study.note with op=create', async () => {
		const { userId, cleanup } = await isolatedUser('create-audit');
		try {
			const created = await createNote(userId, { bodyMd: 'Audited' });
			const audits = await db
				.select()
				.from(auditLog)
				.where(and(eq(auditLog.actorId, userId), eq(auditLog.targetId, created.id)));
			expect(audits.length).toBe(1);
			expect(audits[0]?.op).toBe('create');
			expect(audits[0]?.targetType).toBe(AUDIT_TARGETS.NOTE);
		} finally {
			await cleanup();
		}
	});

	it('persists context FKs and tags', async () => {
		const { userId, cleanup } = await isolatedUser('create-ctx');
		try {
			const row = await createNote(userId, {
				bodyMd: 'Stall recovery',
				title: 'Stalls',
				referenceId: TEST_REFERENCE_ID,
				referenceSectionId: TEST_SECTION_ID,
				tags: ['stalls', 'PHAK'],
			});
			expect(row.referenceId).toBe(TEST_REFERENCE_ID);
			expect(row.referenceSectionId).toBe(TEST_SECTION_ID);
			expect(row.tags).toEqual(['stalls', 'PHAK']);
		} finally {
			await cleanup();
		}
	});

	it('rejects an empty body', async () => {
		const { userId, cleanup } = await isolatedUser('create-empty');
		try {
			await expect(createNote(userId, { bodyMd: '   ' })).rejects.toThrow(z.ZodError);
		} finally {
			await cleanup();
		}
	});

	it('rejects a body over NOTE_BODY_MAX_LENGTH', async () => {
		const { userId, cleanup } = await isolatedUser('create-toobig');
		try {
			const tooBig = 'a'.repeat(NOTE_BODY_MAX_LENGTH + 1);
			await expect(createNote(userId, { bodyMd: tooBig })).rejects.toThrow(z.ZodError);
		} finally {
			await cleanup();
		}
	});

	it('rejects more than NOTE_TAGS_MAX tags', async () => {
		const { userId, cleanup } = await isolatedUser('create-tags-max');
		try {
			const tags = Array.from({ length: NOTE_TAGS_MAX + 1 }, (_, i) => `tag-${i}`);
			await expect(createNote(userId, { bodyMd: 'Body', tags })).rejects.toThrow(z.ZodError);
		} finally {
			await cleanup();
		}
	});

	it('deduplicates tags case-insensitively keeping the first cased value', async () => {
		const { userId, cleanup } = await isolatedUser('create-tags-dedupe');
		try {
			const row = await createNote(userId, { bodyMd: 'Body', tags: ['Stalls', 'stalls', 'STALLS'] });
			expect(row.tags).toEqual(['Stalls']);
		} finally {
			await cleanup();
		}
	});
});

describe('updateNote', () => {
	it('patches set fields and leaves the rest alone', async () => {
		const { userId, cleanup } = await isolatedUser('update-patch');
		try {
			const initial = await createNote(userId, { bodyMd: 'before', title: 'before-title', tags: ['a'] });
			const updated = await updateNote(initial.id, userId, { title: 'after-title' });
			expect(updated.title).toBe('after-title');
			expect(updated.bodyMd).toBe('before');
			expect(updated.tags).toEqual(['a']);
		} finally {
			await cleanup();
		}
	});

	it('clears followUpDoneAt when followUpMd is emptied', async () => {
		const { userId, cleanup } = await isolatedUser('update-clear-followup');
		try {
			const initial = await createNote(userId, { bodyMd: 'b', followUpMd: 'check vno' });
			const marked = await markFollowUpDone(initial.id, userId);
			expect(marked.followUpDoneAt).not.toBeNull();
			const updated = await updateNote(initial.id, userId, { followUpMd: '' });
			expect(updated.followUpMd).toBe('');
			expect(updated.followUpDoneAt).toBeNull();
		} finally {
			await cleanup();
		}
	});

	it("throws NoteNotFoundError for someone else's note", async () => {
		const owner = await isolatedUser('update-owner');
		const intruder = await isolatedUser('update-intruder');
		try {
			const row = await createNote(owner.userId, { bodyMd: 'mine' });
			await expect(updateNote(row.id, intruder.userId, { title: 'hacked' })).rejects.toBeInstanceOf(NoteNotFoundError);
		} finally {
			await owner.cleanup();
			await intruder.cleanup();
		}
	});

	it('no-op patch returns the row without writing or auditing', async () => {
		const { userId, cleanup } = await isolatedUser('update-noop');
		try {
			const row = await createNote(userId, { bodyMd: 'b' });
			const updated = await updateNote(row.id, userId, {});
			expect(updated.id).toBe(row.id);
			// The BC short-circuits empty patches before issuing an UPDATE, so
			// `updatedAt` reflects the original create's timestamp.
			expect(updated.updatedAt.getTime()).toBe(row.updatedAt.getTime());
			const audits = await db
				.select()
				.from(auditLog)
				.where(and(eq(auditLog.actorId, userId), eq(auditLog.targetId, row.id)));
			// Only the create audit row exists.
			expect(audits.length).toBe(1);
		} finally {
			await cleanup();
		}
	});
});

describe('archive / restore / delete', () => {
	it('archive sets archivedAt; restore clears it', async () => {
		const { userId, cleanup } = await isolatedUser('archive-restore');
		try {
			const row = await createNote(userId, { bodyMd: 'b' });
			const archived = await archiveNote(row.id, userId);
			expect(archived.archivedAt).not.toBeNull();
			const restored = await restoreNote(row.id, userId);
			expect(restored.archivedAt).toBeNull();
		} finally {
			await cleanup();
		}
	});

	it('archive writes audit row with subKind=archive; restore with subKind=restore', async () => {
		const { userId, cleanup } = await isolatedUser('archive-audit');
		try {
			const row = await createNote(userId, { bodyMd: 'b' });
			await archiveNote(row.id, userId);
			await restoreNote(row.id, userId);
			const audits = await db
				.select()
				.from(auditLog)
				.where(and(eq(auditLog.actorId, userId), eq(auditLog.targetId, row.id)));
			const subKinds = audits
				.map((a) => (a.metadata as { subKind?: string } | null)?.subKind)
				.filter((s) => s !== undefined);
			expect(subKinds).toContain(NOTE_OP_SUBKINDS.ARCHIVE);
			expect(subKinds).toContain(NOTE_OP_SUBKINDS.RESTORE);
		} finally {
			await cleanup();
		}
	});

	it('delete hard-removes the row and writes an op=delete audit row', async () => {
		const { userId, cleanup } = await isolatedUser('delete');
		try {
			const row = await createNote(userId, { bodyMd: 'b' });
			await deleteNote(row.id, userId);
			expect(await getNote(row.id, userId)).toBeNull();
			const audits = await db
				.select()
				.from(auditLog)
				.where(and(eq(auditLog.actorId, userId), eq(auditLog.targetId, row.id)));
			const ops = audits.map((a) => a.op);
			expect(ops).toContain('delete');
		} finally {
			await cleanup();
		}
	});

	it("delete throws NoteNotFoundError for someone else's note", async () => {
		const owner = await isolatedUser('del-owner');
		const intruder = await isolatedUser('del-intruder');
		try {
			const row = await createNote(owner.userId, { bodyMd: 'mine' });
			await expect(deleteNote(row.id, intruder.userId)).rejects.toBeInstanceOf(NoteNotFoundError);
		} finally {
			await owner.cleanup();
			await intruder.cleanup();
		}
	});
});

describe('follow-ups', () => {
	it('markFollowUpDone sets the timestamp on a note with a follow-up', async () => {
		const { userId, cleanup } = await isolatedUser('followup-done');
		try {
			const row = await createNote(userId, { bodyMd: 'b', followUpMd: 'look up Vno' });
			const marked = await markFollowUpDone(row.id, userId);
			expect(marked.followUpDoneAt).not.toBeNull();
		} finally {
			await cleanup();
		}
	});

	it('markFollowUpDone throws NoFollowUpError when there is no follow-up', async () => {
		const { userId, cleanup } = await isolatedUser('followup-empty');
		try {
			const row = await createNote(userId, { bodyMd: 'b' });
			await expect(markFollowUpDone(row.id, userId)).rejects.toBeInstanceOf(NoFollowUpError);
		} finally {
			await cleanup();
		}
	});

	it('clearFollowUp wipes the follow-up body and clears done timestamp', async () => {
		const { userId, cleanup } = await isolatedUser('followup-clear');
		try {
			const row = await createNote(userId, { bodyMd: 'b', followUpMd: 'check this' });
			await markFollowUpDone(row.id, userId);
			const cleared = await clearFollowUp(row.id, userId);
			expect(cleared.followUpMd).toBe('');
			expect(cleared.followUpDoneAt).toBeNull();
		} finally {
			await cleanup();
		}
	});

	it('listOpenFollowUps returns notes with non-empty followUpMd, no done timestamp, not archived', async () => {
		const { userId, cleanup } = await isolatedUser('followup-list');
		try {
			const open = await createNote(userId, { bodyMd: 'open', followUpMd: 'do something' });
			await createNote(userId, { bodyMd: 'no follow-up' });
			const done = await createNote(userId, { bodyMd: 'done', followUpMd: 'done item' });
			await markFollowUpDone(done.id, userId);
			const archived = await createNote(userId, { bodyMd: 'archived', followUpMd: 'should not show' });
			await archiveNote(archived.id, userId);
			const list = await listOpenFollowUps(userId);
			const ids = list.map((n) => n.id);
			expect(ids).toContain(open.id);
			expect(ids).not.toContain(done.id);
			expect(ids).not.toContain(archived.id);
		} finally {
			await cleanup();
		}
	});
});

describe('listNotesForUser', () => {
	it('excludes archived rows by default', async () => {
		const { userId, cleanup } = await isolatedUser('list-archive');
		try {
			const a = await createNote(userId, { bodyMd: 'active' });
			const b = await createNote(userId, { bodyMd: 'to-archive' });
			await archiveNote(b.id, userId);
			const result = await listNotesForUser(userId);
			const ids = result.notes.map((n) => n.id);
			expect(ids).toContain(a.id);
			expect(ids).not.toContain(b.id);
		} finally {
			await cleanup();
		}
	});

	it('only=archived returns archived rows only', async () => {
		const { userId, cleanup } = await isolatedUser('list-only-archived');
		try {
			const a = await createNote(userId, { bodyMd: 'active' });
			const b = await createNote(userId, { bodyMd: 'to-archive' });
			await archiveNote(b.id, userId);
			const result = await listNotesForUser(userId, { archived: NOTES_ARCHIVED_FILTER.ONLY });
			const ids = result.notes.map((n) => n.id);
			expect(ids).toEqual([b.id]);
			expect(ids).not.toContain(a.id);
		} finally {
			await cleanup();
		}
	});

	it('paginates by cursor (newest first)', async () => {
		const { userId, cleanup } = await isolatedUser('list-cursor');
		try {
			const created = [];
			for (let i = 0; i < 5; i += 1) {
				// eslint-disable-next-line no-await-in-loop -- ordering depends on serial inserts
				created.push(await createNote(userId, { bodyMd: `note ${i}` }));
				// Pause briefly so the createdAt timestamps separate cleanly
				// at the cursor boundary on fast machines.
				await new Promise((r) => setTimeout(r, 5));
			}
			const page1 = await listNotesForUser(userId, { limit: 3 });
			expect(page1.notes.length).toBe(3);
			expect(page1.nextCursor).not.toBeNull();
			expect(page1.notes[0]?.bodyMd).toBe('note 4');
			const page2 = await listNotesForUser(userId, { limit: 3, cursor: page1.nextCursor });
			expect(page2.notes.length).toBe(2);
			expect(page2.notes[0]?.bodyMd).toBe('note 1');
		} finally {
			await cleanup();
		}
	});

	it('sort=oldest reverses order', async () => {
		const { userId, cleanup } = await isolatedUser('list-sort-oldest');
		try {
			const a = await createNote(userId, { bodyMd: 'first' });
			await new Promise((r) => setTimeout(r, 5));
			const b = await createNote(userId, { bodyMd: 'second' });
			const result = await listNotesForUser(userId, { sort: NOTES_SORT.OLDEST });
			expect(result.notes[0]?.id).toBe(a.id);
			expect(result.notes[1]?.id).toBe(b.id);
		} finally {
			await cleanup();
		}
	});
});

describe('per-context lookups', () => {
	it('listNotesForSection scopes to the given section id', async () => {
		const { userId, cleanup } = await isolatedUser('list-section');
		try {
			const a = await createNote(userId, { bodyMd: 'on s1', referenceSectionId: TEST_SECTION_ID });
			const b = await createNote(userId, { bodyMd: 'on s2', referenceSectionId: SECOND_SECTION_ID });
			const list = await listNotesForSection(userId, TEST_SECTION_ID);
			const ids = list.map((n) => n.id);
			expect(ids).toContain(a.id);
			expect(ids).not.toContain(b.id);
		} finally {
			await cleanup();
		}
	});

	it('listNotesForReference includes section-scoped notes via the IN subquery', async () => {
		const { userId, cleanup } = await isolatedUser('list-ref');
		try {
			const refOnly = await createNote(userId, { bodyMd: 'on ref', referenceId: TEST_REFERENCE_ID });
			const sectionScoped = await createNote(userId, { bodyMd: 'on s', referenceSectionId: TEST_SECTION_ID });
			const elsewhere = await createNote(userId, { bodyMd: 'free' });
			const list = await listNotesForReference(userId, TEST_REFERENCE_ID);
			const ids = list.map((n) => n.id);
			expect(ids).toContain(refOnly.id);
			expect(ids).toContain(sectionScoped.id);
			expect(ids).not.toContain(elsewhere.id);
		} finally {
			await cleanup();
		}
	});
});

describe('searchNotes', () => {
	it('matches body, title, quoted excerpt, and tags via ILIKE', async () => {
		const { userId, cleanup } = await isolatedUser('search');
		try {
			const inBody = await createNote(userId, { bodyMd: 'PHAK chapter 4 stalls' });
			const inTitle = await createNote(userId, { bodyMd: 'b', title: 'PHAK quick reference' });
			const inExcerpt = await createNote(userId, { bodyMd: 'b', quotedExcerpt: 'from PHAK §4.2' });
			const inTags = await createNote(userId, { bodyMd: 'b', tags: ['PHAK'] });
			const noMatch = await createNote(userId, { bodyMd: 'irrelevant' });

			const result = await searchNotes(userId, 'phak');
			const ids = result.notes.map((n) => n.id);
			expect(ids).toContain(inBody.id);
			expect(ids).toContain(inTitle.id);
			expect(ids).toContain(inExcerpt.id);
			expect(ids).toContain(inTags.id);
			expect(ids).not.toContain(noMatch.id);
		} finally {
			await cleanup();
		}
	});

	it('empty query falls back to listNotesForUser', async () => {
		const { userId, cleanup } = await isolatedUser('search-empty');
		try {
			await createNote(userId, { bodyMd: 'a' });
			await createNote(userId, { bodyMd: 'b' });
			const result = await searchNotes(userId, '   ');
			expect(result.notes.length).toBe(2);
		} finally {
			await cleanup();
		}
	});

	it('escapes ILIKE pattern characters in the query', async () => {
		const { userId, cleanup } = await isolatedUser('search-escape');
		try {
			const literal = await createNote(userId, { bodyMd: '50% throttle' });
			const noise = await createNote(userId, { bodyMd: 'just text' });
			const result = await searchNotes(userId, '50%');
			const ids = result.notes.map((n) => n.id);
			expect(ids).toContain(literal.id);
			expect(ids).not.toContain(noise.id);
		} finally {
			await cleanup();
		}
	});
});

describe('deriveNoteTitle', () => {
	it('returns the explicit title when set', () => {
		expect(deriveNoteTitle({ title: 'Explicit', bodyMd: 'Body' })).toBe('Explicit');
	});

	it('derives from the first non-empty line stripping leading hashes', () => {
		expect(deriveNoteTitle({ title: '', bodyMd: '\n\n## A heading\nBody' })).toBe('A heading');
	});

	it('falls back to "Untitled note" for an empty body', () => {
		expect(deriveNoteTitle({ title: '', bodyMd: '   \n  ' })).toBe('Untitled note');
	});
});

describe('listTagCloud', () => {
	it('returns distinct tags with counts, ordered by count desc then name asc', async () => {
		const { userId, cleanup } = await isolatedUser('tagcloud');
		try {
			await createNote(userId, { bodyMd: 'one', tags: ['stalls', 'recovery'] });
			await createNote(userId, { bodyMd: 'two', tags: ['stalls', 'pitch'] });
			await createNote(userId, { bodyMd: 'three', tags: ['stalls'] });
			const cloud = await listTagCloud(userId);
			expect(cloud.length).toBe(3);
			// Highest count first.
			expect(cloud[0]).toEqual({ tag: 'stalls', count: 3 });
			// Tie at count 1: alphabetical fallback (pitch < recovery).
			expect(cloud[1]?.tag).toBe('pitch');
			expect(cloud[2]?.tag).toBe('recovery');
		} finally {
			await cleanup();
		}
	});

	it('excludes archived notes', async () => {
		const { userId, cleanup } = await isolatedUser('tagcloud-archived');
		try {
			const live = await createNote(userId, { bodyMd: 'live', tags: ['live-tag'] });
			const archived = await createNote(userId, { bodyMd: 'archived', tags: ['archived-tag'] });
			await archiveNote(archived.id, userId);
			const cloud = await listTagCloud(userId);
			const tags = cloud.map((c) => c.tag);
			expect(tags).toContain('live-tag');
			expect(tags).not.toContain('archived-tag');
			void live;
		} finally {
			await cleanup();
		}
	});

	it('returns an empty array when the user has no notes', async () => {
		const { userId, cleanup } = await isolatedUser('tagcloud-empty');
		try {
			const cloud = await listTagCloud(userId);
			expect(cloud).toEqual([]);
		} finally {
			await cleanup();
		}
	});
});

describe('listDistinctTags', () => {
	it('returns distinct tags sorted alphabetically by lowercased value', async () => {
		const { userId, cleanup } = await isolatedUser('distinct-tags');
		try {
			await createNote(userId, { bodyMd: 'one', tags: ['Zulu', 'alpha'] });
			await createNote(userId, { bodyMd: 'two', tags: ['Bravo', 'alpha'] });
			const tags = await listDistinctTags(userId);
			// `alpha` first, then `Bravo`, then `Zulu` -- case-insensitive sort
			// preserves original casing.
			expect(tags).toEqual(['alpha', 'Bravo', 'Zulu']);
		} finally {
			await cleanup();
		}
	});

	it('excludes archived notes', async () => {
		const { userId, cleanup } = await isolatedUser('distinct-tags-archived');
		try {
			await createNote(userId, { bodyMd: 'live', tags: ['live-tag'] });
			const archived = await createNote(userId, { bodyMd: 'arch', tags: ['hidden'] });
			await archiveNote(archived.id, userId);
			const tags = await listDistinctTags(userId);
			expect(tags).toContain('live-tag');
			expect(tags).not.toContain('hidden');
		} finally {
			await cleanup();
		}
	});
});
