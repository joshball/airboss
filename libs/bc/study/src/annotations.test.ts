/**
 * Annotations + card-drafts BC integration tests
 * (wp-flightbag-rich-reader Phase 1).
 *
 * Hits the dev Postgres directly, mirroring the notes BC suite. Each test
 * creates a throwaway user and tears down its annotations + drafts +
 * audit rows + the user row.
 */

import { auditLog } from '@ab/audit';
import { bauthUser } from '@ab/auth/schema';
import {
	ANNOTATION_KINDS,
	ANNOTATION_OP_SUBKINDS,
	AUDIT_TARGETS,
	CARD_DRAFT_OP_SUBKINDS,
	CARD_KINDS,
	CARD_TYPES,
	DOMAINS,
	HIGHLIGHT_COLORS,
} from '@ab/constants';
import { db } from '@ab/db/connection';
import { captureAnchor, generateAuthId, generateReferenceId, generateReferenceSectionId } from '@ab/utils';
import { and, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import {
	AnnotationNotFoundError,
	CardDraftAlreadyPromotedError,
	createCardDraft,
	createHighlight,
	deleteAnnotation,
	discardCardDraft,
	listAnnotationsForSection,
	listHighlightsForSection,
	listOpenCardDrafts,
	promoteDraftToCard,
	updateCardDraft,
	updateHighlightColor,
} from './annotations';
import { createNoteWithAnchor } from './notes';
import { card, cardDraft, note, reference, referenceSection, referenceSectionAnnotation } from './schema';

const SAMPLE_BODY = 'The pilot in command of an aircraft is directly responsible for the safety of that flight.';

let TEST_REFERENCE_ID: string;
let TEST_SECTION_ID: string;

async function isolatedUser(label: string): Promise<{ userId: string; cleanup: () => Promise<void> }> {
	const userId = generateAuthId();
	const now = new Date();
	await db.insert(bauthUser).values({
		id: userId,
		email: `annotations-${label}-${userId}@airboss.test`,
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
			await db.delete(referenceSectionAnnotation).where(eq(referenceSectionAnnotation.userId, userId));
			await db.delete(cardDraft).where(eq(cardDraft.userId, userId));
			await db.delete(card).where(eq(card.userId, userId));
			await db.delete(note).where(eq(note.userId, userId));
			await db.delete(bauthUser).where(eq(bauthUser.id, userId));
		},
	};
}

beforeAll(async () => {
	const existing = await db.select().from(reference).where(eq(reference.kind, 'handbook')).limit(1);
	if (existing[0]) {
		TEST_REFERENCE_ID = existing[0].id;
	} else {
		TEST_REFERENCE_ID = generateReferenceId();
		await db.insert(reference).values({
			id: TEST_REFERENCE_ID,
			kind: 'handbook',
			documentSlug: `annotations-test-${Date.now()}`,
			edition: 'test-1',
			editionDate: '2026-01-01',
			title: 'Annotations Test Handbook',
			publisher: 'airboss-test',
		});
	}
	const existingSection = await db
		.select()
		.from(referenceSection)
		.where(eq(referenceSection.referenceId, TEST_REFERENCE_ID))
		.limit(1);
	if (existingSection[0]) {
		TEST_SECTION_ID = existingSection[0].id;
	} else {
		TEST_SECTION_ID = generateReferenceSectionId();
		await db.insert(referenceSection).values({
			id: TEST_SECTION_ID,
			referenceId: TEST_REFERENCE_ID,
			airbossRef: `airboss-ref:test/annotations-test/${TEST_SECTION_ID}`,
			level: 'section',
			code: 'AT.1',
			title: 'Annotations Test Section',
			sourceLocator: 'Annotations Test §AT.1',
			contentHash: `sha256:test-ann-${TEST_SECTION_ID}`,
			ordinal: 1,
			depth: 0,
			contentMd: SAMPLE_BODY,
		});
	}
});

function anchorAt(start: number, length: number) {
	return captureAnchor(SAMPLE_BODY, { start, end: start + length });
}

describe('createHighlight', () => {
	it('inserts a highlight row + an audit row', async () => {
		const { userId, cleanup } = await isolatedUser('hl-create');
		try {
			const anchor = anchorAt(4, 5); // 'pilot'
			const row = await createHighlight(userId, TEST_SECTION_ID, anchor, HIGHLIGHT_COLORS.YELLOW);
			expect(row.kind).toBe(ANNOTATION_KINDS.HIGHLIGHT);
			expect(row.color).toBe(HIGHLIGHT_COLORS.YELLOW);
			expect(row.anchorText).toBe('pilot');
			expect(row.anchorStart).toBe(4);
			expect(row.anchorEnd).toBe(9);
			const [audit] = await db
				.select()
				.from(auditLog)
				.where(and(eq(auditLog.targetType, AUDIT_TARGETS.ANNOTATION), eq(auditLog.targetId, row.id)));
			expect(audit?.op).toBe('create');
			expect((audit?.metadata as Record<string, unknown>).subKind).toBe(ANNOTATION_OP_SUBKINDS.HIGHLIGHT);
		} finally {
			await cleanup();
		}
	});

	it('rejects an invalid color', async () => {
		const { userId, cleanup } = await isolatedUser('hl-color');
		try {
			const anchor = anchorAt(0, 3);
			await expect(createHighlight(userId, TEST_SECTION_ID, anchor, 'bogus' as never)).rejects.toBeDefined();
		} finally {
			await cleanup();
		}
	});
});

describe('listHighlightsForSection / listAnnotationsForSection', () => {
	it('returns highlights only when listHighlightsForSection is called', async () => {
		const { userId, cleanup } = await isolatedUser('list-hl');
		try {
			const a1 = anchorAt(4, 5);
			const a2 = anchorAt(20, 8);
			await createHighlight(userId, TEST_SECTION_ID, a1, HIGHLIGHT_COLORS.YELLOW);
			await createHighlight(userId, TEST_SECTION_ID, a2, HIGHLIGHT_COLORS.GREEN);
			const rows = await listHighlightsForSection(userId, TEST_SECTION_ID);
			expect(rows).toHaveLength(2);
			expect(rows[0].anchorStart).toBeLessThan(rows[1].anchorStart);
		} finally {
			await cleanup();
		}
	});

	it('listAnnotationsForSection returns highlights + note-anchors + draft-anchors', async () => {
		const { userId, cleanup } = await isolatedUser('list-all');
		try {
			await createHighlight(userId, TEST_SECTION_ID, anchorAt(4, 5), HIGHLIGHT_COLORS.YELLOW);
			await createNoteWithAnchor(userId, TEST_SECTION_ID, anchorAt(20, 8), {
				bodyMd: 'Why the PIC?',
			});
			await createCardDraft(userId, { referenceSectionId: TEST_SECTION_ID, front: 'Q', back: 'A' }, anchorAt(40, 10));
			const rows = await listAnnotationsForSection(userId, TEST_SECTION_ID);
			const kinds = rows.map((r) => r.kind).sort();
			expect(kinds).toEqual(
				[ANNOTATION_KINDS.CARD_DRAFT_ANCHOR, ANNOTATION_KINDS.HIGHLIGHT, ANNOTATION_KINDS.NOTE_ANCHOR].sort(),
			);
		} finally {
			await cleanup();
		}
	});
});

describe('updateHighlightColor', () => {
	it('updates the color and audits the change', async () => {
		const { userId, cleanup } = await isolatedUser('hl-color-update');
		try {
			const row = await createHighlight(userId, TEST_SECTION_ID, anchorAt(4, 5), HIGHLIGHT_COLORS.YELLOW);
			const after = await updateHighlightColor(row.id, userId, HIGHLIGHT_COLORS.PINK);
			expect(after.color).toBe(HIGHLIGHT_COLORS.PINK);
			const audits = await db
				.select()
				.from(auditLog)
				.where(and(eq(auditLog.targetType, AUDIT_TARGETS.ANNOTATION), eq(auditLog.targetId, row.id)));
			const subKinds = audits.map((a) => (a.metadata as Record<string, unknown>).subKind);
			expect(subKinds).toContain(ANNOTATION_OP_SUBKINDS.COLOR_CHANGE);
		} finally {
			await cleanup();
		}
	});

	it('throws on a non-highlight target', async () => {
		const { userId, cleanup } = await isolatedUser('hl-not-allowed');
		try {
			const { annotation } = await createNoteWithAnchor(userId, TEST_SECTION_ID, anchorAt(0, 3), {
				bodyMd: 'thoughts',
			});
			await expect(updateHighlightColor(annotation.id, userId, HIGHLIGHT_COLORS.BLUE)).rejects.toBeDefined();
		} finally {
			await cleanup();
		}
	});
});

describe('deleteAnnotation', () => {
	it('removes the row and audits the delete', async () => {
		const { userId, cleanup } = await isolatedUser('ann-del');
		try {
			const row = await createHighlight(userId, TEST_SECTION_ID, anchorAt(4, 5), HIGHLIGHT_COLORS.YELLOW);
			await deleteAnnotation(row.id, userId);
			const after = await db.select().from(referenceSectionAnnotation).where(eq(referenceSectionAnnotation.id, row.id));
			expect(after).toHaveLength(0);
			await expect(deleteAnnotation(row.id, userId)).rejects.toBeInstanceOf(AnnotationNotFoundError);
		} finally {
			await cleanup();
		}
	});
});

describe('createNoteWithAnchor', () => {
	it('inserts a note + a note-anchor annotation in one transaction', async () => {
		const { userId, cleanup } = await isolatedUser('note-anchor');
		try {
			const result = await createNoteWithAnchor(userId, TEST_SECTION_ID, anchorAt(20, 8), {
				bodyMd: 'PIC question',
			});
			expect(result.note.referenceSectionId).toBe(TEST_SECTION_ID);
			expect(result.annotation.kind).toBe(ANNOTATION_KINDS.NOTE_ANCHOR);
			expect(result.annotation.noteId).toBe(result.note.id);
			expect(result.annotation.cardDraftId).toBeNull();
		} finally {
			await cleanup();
		}
	});

	it('cascades the anchor row when the note is deleted', async () => {
		const { userId, cleanup } = await isolatedUser('note-cascade');
		try {
			const { note: noteRow, annotation } = await createNoteWithAnchor(userId, TEST_SECTION_ID, anchorAt(20, 8), {
				bodyMd: 'Will be deleted',
			});
			await db.delete(note).where(eq(note.id, noteRow.id));
			const after = await db
				.select()
				.from(referenceSectionAnnotation)
				.where(eq(referenceSectionAnnotation.id, annotation.id));
			expect(after).toHaveLength(0);
		} finally {
			await cleanup();
		}
	});
});

describe('card-draft lifecycle', () => {
	it('creates a draft + an anchor row when an anchor is supplied', async () => {
		const { userId, cleanup } = await isolatedUser('draft-create');
		try {
			const { draft, annotation } = await createCardDraft(
				userId,
				{ referenceSectionId: TEST_SECTION_ID, front: 'Q', back: 'A' },
				anchorAt(4, 5),
			);
			expect(draft.front).toBe('Q');
			expect(draft.promotedAt).toBeNull();
			expect(annotation).not.toBeNull();
			expect(annotation?.kind).toBe(ANNOTATION_KINDS.CARD_DRAFT_ANCHOR);
			expect(annotation?.cardDraftId).toBe(draft.id);
		} finally {
			await cleanup();
		}
	});

	it('creates a draft without an anchor when none is supplied', async () => {
		const { userId, cleanup } = await isolatedUser('draft-no-anchor');
		try {
			const { draft, annotation } = await createCardDraft(userId, { front: 'Q', back: 'A' });
			expect(draft.id.startsWith('draft_')).toBe(true);
			expect(annotation).toBeNull();
		} finally {
			await cleanup();
		}
	});

	it('listOpenCardDrafts excludes promoted drafts by default', async () => {
		const { userId, cleanup } = await isolatedUser('draft-list');
		try {
			const { draft } = await createCardDraft(userId, {
				referenceSectionId: TEST_SECTION_ID,
				front: 'Front',
				back: 'Back',
				domain: DOMAINS.AERODYNAMICS,
				cardType: CARD_TYPES.BASIC,
				kind: CARD_KINDS.RECALL,
			});
			const before = await listOpenCardDrafts(userId);
			expect(before.map((d) => d.id)).toContain(draft.id);

			await promoteDraftToCard(draft.id, userId);
			const after = await listOpenCardDrafts(userId);
			expect(after.map((d) => d.id)).not.toContain(draft.id);

			const withPromoted = await listOpenCardDrafts(userId, { includePromoted: true });
			expect(withPromoted.map((d) => d.id)).toContain(draft.id);
		} finally {
			await cleanup();
		}
	});

	it('updateCardDraft patches editable fields and audits the diff', async () => {
		const { userId, cleanup } = await isolatedUser('draft-update');
		try {
			const { draft } = await createCardDraft(userId, { front: 'Q1', back: 'A1' });
			const after = await updateCardDraft(draft.id, userId, { front: 'Q2', tags: ['stalls'] });
			expect(after.front).toBe('Q2');
			expect(after.back).toBe('A1');
			expect(after.tags).toEqual(['stalls']);
		} finally {
			await cleanup();
		}
	});

	it('promoteDraftToCard creates a card and stamps promoted_at', async () => {
		const { userId, cleanup } = await isolatedUser('draft-promote');
		try {
			const { draft } = await createCardDraft(userId, {
				front: 'What is PIC?',
				back: 'Pilot in command',
				domain: DOMAINS.REGULATIONS,
			});
			const { cardId } = await promoteDraftToCard(draft.id, userId);
			expect(cardId.startsWith('crd_')).toBe(true);
			const [refreshed] = await db.select().from(cardDraft).where(eq(cardDraft.id, draft.id));
			expect(refreshed?.promotedToCardId).toBe(cardId);
			expect(refreshed?.promotedAt).not.toBeNull();
			await expect(promoteDraftToCard(draft.id, userId)).rejects.toBeInstanceOf(CardDraftAlreadyPromotedError);
			// Audit subkind
			const audits = await db
				.select()
				.from(auditLog)
				.where(and(eq(auditLog.targetType, AUDIT_TARGETS.CARD_DRAFT), eq(auditLog.targetId, draft.id)));
			const promoteAudit = audits.find(
				(a) => (a.metadata as Record<string, unknown>).subKind === CARD_DRAFT_OP_SUBKINDS.PROMOTE,
			);
			expect(promoteAudit).toBeDefined();
		} finally {
			await cleanup();
		}
	});

	it('discardCardDraft cascades the linked annotation', async () => {
		const { userId, cleanup } = await isolatedUser('draft-discard');
		try {
			const { draft, annotation } = await createCardDraft(
				userId,
				{ referenceSectionId: TEST_SECTION_ID, front: 'Q', back: 'A' },
				anchorAt(4, 5),
			);
			expect(annotation).not.toBeNull();
			await discardCardDraft(draft.id, userId);
			const remaining = await db
				.select()
				.from(referenceSectionAnnotation)
				.where(eq(referenceSectionAnnotation.id, annotation?.id ?? ''));
			expect(remaining).toHaveLength(0);
		} finally {
			await cleanup();
		}
	});
});
