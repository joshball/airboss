/**
 * Annotations + card-drafts BC (wp-flightbag-rich-reader).
 *
 * Owns the lifecycle of `study.reference_section_annotation` (one row per
 * highlight, note-anchor, or card-draft-anchor) and `study.card_draft`
 * (queued card prefill awaiting promotion).
 *
 * Highlights are author-then-paint: the SelectionToolbar captures the
 * passage, calls `createHighlight`, and the AnnotationLayer paints the
 * stored row on next render. Note-anchors and card-draft-anchors travel
 * with the note / draft they belong to: `createNoteWithAnchor` (in
 * `./notes`) inserts both rows in one transaction; `createCardDraft` in
 * this module does the same for drafts.
 *
 * `promoteDraftToCard` reuses the existing `createCard` BC; the draft row
 * is preserved with `promoted_at` stamped (audit trail; UI hides promoted
 * drafts from the inbox).
 *
 * Every mutation writes one audit row tagged `study.annotation` or
 * `study.card_draft` so an admin can trace per-user history.
 */

import { AUDIT_OPS, auditWrite } from '@ab/audit';
import {
	ANNOTATION_ANCHOR_TEXT_MAX_LENGTH,
	ANNOTATION_CONTEXT_MAX_LENGTH,
	ANNOTATION_KIND_VALUES,
	ANNOTATION_KINDS,
	ANNOTATION_OP_SUBKINDS,
	type AnnotationKind,
	AUDIT_TARGETS,
	CARD_DRAFT_OP_SUBKINDS,
	CARD_DRAFTS_LIST_HARD_CAP,
	CARD_KIND_VALUES,
	CARD_KINDS,
	type CardKind,
	CARD_TYPE_VALUES,
	CARD_TYPES,
	type CardType,
	DOMAIN_VALUES,
	type Domain,
	HIGHLIGHT_COLOR_VALUES,
	type HighlightColor,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import type { TextAnchor } from '@ab/utils';
import { generateAnnotationId, generateCardDraftId } from '@ab/utils';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { createCard } from './cards';
import {
	type CardDraftRow,
	cardDraft,
	type ReferenceSectionAnnotationRow,
	referenceSectionAnnotation,
} from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class AnnotationNotFoundError extends Error {
	constructor(
		public readonly annotationId: string,
		public readonly userId: string,
	) {
		super(`Annotation ${annotationId} not found for user ${userId}`);
		this.name = 'AnnotationNotFoundError';
	}
}

export class CardDraftNotFoundError extends Error {
	constructor(
		public readonly draftId: string,
		public readonly userId: string,
	) {
		super(`Card draft ${draftId} not found for user ${userId}`);
		this.name = 'CardDraftNotFoundError';
	}
}

export class CardDraftAlreadyPromotedError extends Error {
	constructor(public readonly draftId: string) {
		super(`Card draft ${draftId} has already been promoted`);
		this.name = 'CardDraftAlreadyPromotedError';
	}
}

// ---------------------------------------------------------------------------
// Zod schemas (input validation, defense in depth)
// ---------------------------------------------------------------------------

const HIGHLIGHT_COLOR_SET = new Set<string>(HIGHLIGHT_COLOR_VALUES);
const ANNOTATION_KIND_SET = new Set<string>(ANNOTATION_KIND_VALUES);
const CARD_TYPE_SET = new Set<string>(CARD_TYPE_VALUES);
const CARD_KIND_SET = new Set<string>(CARD_KIND_VALUES);
const DOMAIN_SET = new Set<string>(DOMAIN_VALUES);

const textAnchorSchema = z.object({
	text: z
		.string()
		.min(1, { message: 'Anchor text must not be empty.' })
		.max(ANNOTATION_ANCHOR_TEXT_MAX_LENGTH, {
			message: `Anchor text must be at most ${ANNOTATION_ANCHOR_TEXT_MAX_LENGTH} characters.`,
		}),
	start: z.number().int().nonnegative(),
	end: z.number().int().nonnegative(),
	prefix: z.string().max(ANNOTATION_CONTEXT_MAX_LENGTH).default(''),
	suffix: z.string().max(ANNOTATION_CONTEXT_MAX_LENGTH).default(''),
});

const highlightColorSchema = z.string().refine((v): v is HighlightColor => HIGHLIGHT_COLOR_SET.has(v), {
	message: `Highlight color must be one of ${HIGHLIGHT_COLOR_VALUES.join(', ')}.`,
});

const optionalIdSchema = z
	.union([z.string().min(1), z.null()])
	.optional()
	.transform((v) => (v === undefined || v === '' ? null : v));

export const createCardDraftInputSchema = z
	.object({
		front: z.string().max(2000).optional().default(''),
		back: z.string().max(8000).optional().default(''),
		domain: z
			.string()
			.refine((v) => v.length === 0 || DOMAIN_SET.has(v), { message: 'Invalid domain.' })
			.optional()
			.default(''),
		cardType: z
			.string()
			.refine((v): v is CardType => CARD_TYPE_SET.has(v), { message: 'Invalid card type.' })
			.default(CARD_TYPES.BASIC),
		kind: z
			.string()
			.refine((v): v is CardKind => CARD_KIND_SET.has(v), { message: 'Invalid card kind.' })
			.default(CARD_KINDS.RECALL),
		tags: z.array(z.string().min(1).max(64)).max(32).optional().default([]),
		referenceSectionId: optionalIdSchema,
		knowledgeNodeId: optionalIdSchema,
		courseId: optionalIdSchema,
		goalId: optionalIdSchema,
	})
	.strict();

export type CreateCardDraftInput = z.input<typeof createCardDraftInputSchema>;
export type CreateCardDraftParsed = z.output<typeof createCardDraftInputSchema>;

export const updateCardDraftInputSchema = z
	.object({
		front: z.string().max(2000).optional(),
		back: z.string().max(8000).optional(),
		domain: z
			.string()
			.refine((v) => v.length === 0 || DOMAIN_SET.has(v), { message: 'Invalid domain.' })
			.optional(),
		cardType: z
			.string()
			.refine((v): v is CardType => CARD_TYPE_SET.has(v), { message: 'Invalid card type.' })
			.optional(),
		kind: z
			.string()
			.refine((v): v is CardKind => CARD_KIND_SET.has(v), { message: 'Invalid card kind.' })
			.optional(),
		tags: z.array(z.string().min(1).max(64)).max(32).optional(),
		referenceSectionId: optionalIdSchema,
		knowledgeNodeId: optionalIdSchema,
		courseId: optionalIdSchema,
		goalId: optionalIdSchema,
	})
	.strict();

export type UpdateCardDraftInput = z.input<typeof updateCardDraftInputSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadOwnedAnnotation(
	annotationId: string,
	userId: string,
	db: Db,
): Promise<ReferenceSectionAnnotationRow> {
	const [row] = await db
		.select()
		.from(referenceSectionAnnotation)
		.where(and(eq(referenceSectionAnnotation.id, annotationId), eq(referenceSectionAnnotation.userId, userId)))
		.limit(1);
	if (!row) throw new AnnotationNotFoundError(annotationId, userId);
	return row;
}

async function loadOwnedDraft(draftId: string, userId: string, db: Db): Promise<CardDraftRow> {
	const [row] = await db
		.select()
		.from(cardDraft)
		.where(and(eq(cardDraft.id, draftId), eq(cardDraft.userId, userId)))
		.limit(1);
	if (!row) throw new CardDraftNotFoundError(draftId, userId);
	return row;
}

function annotationSubkindFor(kind: AnnotationKind): string {
	if (kind === ANNOTATION_KINDS.HIGHLIGHT) return ANNOTATION_OP_SUBKINDS.HIGHLIGHT;
	if (kind === ANNOTATION_KINDS.NOTE_ANCHOR) return ANNOTATION_OP_SUBKINDS.NOTE_ANCHOR;
	return ANNOTATION_OP_SUBKINDS.CARD_DRAFT_ANCHOR;
}

// ---------------------------------------------------------------------------
// Highlights
// ---------------------------------------------------------------------------

export async function createHighlight(
	userId: string,
	sectionId: string,
	anchor: TextAnchor,
	color: HighlightColor,
	db: Db = defaultDb,
): Promise<ReferenceSectionAnnotationRow> {
	const parsedAnchor = textAnchorSchema.parse(anchor);
	const parsedColor = highlightColorSchema.parse(color);

	const id = generateAnnotationId();
	const [row] = await db
		.insert(referenceSectionAnnotation)
		.values({
			id,
			userId,
			referenceSectionId: sectionId,
			kind: ANNOTATION_KINDS.HIGHLIGHT,
			color: parsedColor,
			anchorText: parsedAnchor.text,
			anchorStart: parsedAnchor.start,
			anchorEnd: parsedAnchor.end,
			prefixContext: parsedAnchor.prefix,
			suffixContext: parsedAnchor.suffix,
			noteId: null,
			cardDraftId: null,
		})
		.returning();
	if (!row) throw new Error('createHighlight: insert returned no row');

	await auditWrite(
		{
			actorId: userId,
			op: AUDIT_OPS.CREATE,
			targetType: AUDIT_TARGETS.ANNOTATION,
			targetId: row.id,
			before: null,
			after: row,
			metadata: { subKind: ANNOTATION_OP_SUBKINDS.HIGHLIGHT },
		},
		db,
	);
	return row;
}

export async function listHighlightsForSection(
	userId: string,
	sectionId: string,
	db: Db = defaultDb,
): Promise<ReferenceSectionAnnotationRow[]> {
	return db
		.select()
		.from(referenceSectionAnnotation)
		.where(
			and(
				eq(referenceSectionAnnotation.userId, userId),
				eq(referenceSectionAnnotation.referenceSectionId, sectionId),
				eq(referenceSectionAnnotation.kind, ANNOTATION_KINDS.HIGHLIGHT),
			),
		)
		.orderBy(asc(referenceSectionAnnotation.anchorStart), asc(referenceSectionAnnotation.id));
}

export async function listAnnotationsForSection(
	userId: string,
	sectionId: string,
	db: Db = defaultDb,
): Promise<ReferenceSectionAnnotationRow[]> {
	return db
		.select()
		.from(referenceSectionAnnotation)
		.where(
			and(
				eq(referenceSectionAnnotation.userId, userId),
				eq(referenceSectionAnnotation.referenceSectionId, sectionId),
			),
		)
		.orderBy(asc(referenceSectionAnnotation.anchorStart), asc(referenceSectionAnnotation.id));
}

export interface ListAnnotationsOpts {
	limit?: number;
	kind?: AnnotationKind;
}

export async function listAnnotationsForUser(
	userId: string,
	opts: ListAnnotationsOpts = {},
	db: Db = defaultDb,
): Promise<ReferenceSectionAnnotationRow[]> {
	const limit = Math.min(Math.max(1, opts.limit ?? 200), 500);
	const conditions = [eq(referenceSectionAnnotation.userId, userId)];
	if (opts.kind !== undefined) {
		if (!ANNOTATION_KIND_SET.has(opts.kind)) {
			throw new Error(`Invalid annotation kind: ${opts.kind}`);
		}
		conditions.push(eq(referenceSectionAnnotation.kind, opts.kind));
	}
	return db
		.select()
		.from(referenceSectionAnnotation)
		.where(and(...conditions))
		.orderBy(desc(referenceSectionAnnotation.createdAt), desc(referenceSectionAnnotation.id))
		.limit(limit);
}

export async function updateHighlightColor(
	annotationId: string,
	userId: string,
	color: HighlightColor,
	db: Db = defaultDb,
): Promise<ReferenceSectionAnnotationRow> {
	const parsedColor = highlightColorSchema.parse(color);
	const before = await loadOwnedAnnotation(annotationId, userId, db);
	if (before.kind !== ANNOTATION_KINDS.HIGHLIGHT) {
		throw new Error(`Annotation ${annotationId} is not a highlight; cannot update color.`);
	}
	if (before.color === parsedColor) return before;

	const [after] = await db
		.update(referenceSectionAnnotation)
		.set({ color: parsedColor, updatedAt: sql`now()` })
		.where(
			and(eq(referenceSectionAnnotation.id, annotationId), eq(referenceSectionAnnotation.userId, userId)),
		)
		.returning();
	if (!after) throw new AnnotationNotFoundError(annotationId, userId);

	await auditWrite(
		{
			actorId: userId,
			op: AUDIT_OPS.UPDATE,
			targetType: AUDIT_TARGETS.ANNOTATION,
			targetId: after.id,
			before,
			after,
			metadata: { subKind: ANNOTATION_OP_SUBKINDS.COLOR_CHANGE },
		},
		db,
	);
	return after;
}

export async function deleteAnnotation(annotationId: string, userId: string, db: Db = defaultDb): Promise<void> {
	const before = await loadOwnedAnnotation(annotationId, userId, db);

	const result = await db
		.delete(referenceSectionAnnotation)
		.where(
			and(eq(referenceSectionAnnotation.id, annotationId), eq(referenceSectionAnnotation.userId, userId)),
		)
		.returning({ id: referenceSectionAnnotation.id });
	if (result.length === 0) throw new AnnotationNotFoundError(annotationId, userId);

	const kind: AnnotationKind = ANNOTATION_KIND_SET.has(before.kind)
		? (before.kind as AnnotationKind)
		: ANNOTATION_KINDS.HIGHLIGHT;
	await auditWrite(
		{
			actorId: userId,
			op: AUDIT_OPS.DELETE,
			targetType: AUDIT_TARGETS.ANNOTATION,
			targetId: annotationId,
			before,
			after: null,
			metadata: { subKind: annotationSubkindFor(kind) },
		},
		db,
	);
}

// ---------------------------------------------------------------------------
// Card drafts
// ---------------------------------------------------------------------------

export async function createCardDraft(
	userId: string,
	input: CreateCardDraftInput,
	anchor?: TextAnchor,
	db: Db = defaultDb,
): Promise<{ draft: CardDraftRow; annotation: ReferenceSectionAnnotationRow | null }> {
	const parsed = createCardDraftInputSchema.parse(input);
	const parsedAnchor = anchor === undefined ? null : textAnchorSchema.parse(anchor);
	if (parsedAnchor !== null && !parsed.referenceSectionId) {
		throw new Error('createCardDraft: anchor supplied without referenceSectionId; cannot create the annotation row.');
	}

	return await db.transaction(async (tx) => {
		const id = generateCardDraftId();
		const [draftRow] = await tx
			.insert(cardDraft)
			.values({
				id,
				userId,
				front: parsed.front,
				back: parsed.back,
				domain: parsed.domain.length === 0 ? null : (parsed.domain as Domain),
				cardType: parsed.cardType,
				kind: parsed.kind,
				tags: parsed.tags,
				referenceSectionId: parsed.referenceSectionId,
				knowledgeNodeId: parsed.knowledgeNodeId,
				courseId: parsed.courseId,
				goalId: parsed.goalId,
			})
			.returning();
		if (!draftRow) throw new Error('createCardDraft: insert returned no row');

		await auditWrite(
			{
				actorId: userId,
				op: AUDIT_OPS.CREATE,
				targetType: AUDIT_TARGETS.CARD_DRAFT,
				targetId: draftRow.id,
				before: null,
				after: draftRow,
			},
			tx,
		);

		let annotation: ReferenceSectionAnnotationRow | null = null;
		if (parsedAnchor !== null && parsed.referenceSectionId !== null) {
			const annId = generateAnnotationId();
			const [annRow] = await tx
				.insert(referenceSectionAnnotation)
				.values({
					id: annId,
					userId,
					referenceSectionId: parsed.referenceSectionId,
					kind: ANNOTATION_KINDS.CARD_DRAFT_ANCHOR,
					color: null,
					anchorText: parsedAnchor.text,
					anchorStart: parsedAnchor.start,
					anchorEnd: parsedAnchor.end,
					prefixContext: parsedAnchor.prefix,
					suffixContext: parsedAnchor.suffix,
					noteId: null,
					cardDraftId: draftRow.id,
				})
				.returning();
			if (!annRow) throw new Error('createCardDraft: annotation insert returned no row');

			await auditWrite(
				{
					actorId: userId,
					op: AUDIT_OPS.CREATE,
					targetType: AUDIT_TARGETS.ANNOTATION,
					targetId: annRow.id,
					before: null,
					after: annRow,
					metadata: { subKind: ANNOTATION_OP_SUBKINDS.CARD_DRAFT_ANCHOR },
				},
				tx,
			);
			annotation = annRow;
		}
		return { draft: draftRow, annotation };
	});
}

export interface ListDraftsOpts {
	limit?: number;
	includePromoted?: boolean;
}

export async function listOpenCardDrafts(
	userId: string,
	opts: ListDraftsOpts = {},
	db: Db = defaultDb,
): Promise<CardDraftRow[]> {
	const limit = Math.min(Math.max(1, opts.limit ?? CARD_DRAFTS_LIST_HARD_CAP), CARD_DRAFTS_LIST_HARD_CAP);
	const conditions = [eq(cardDraft.userId, userId)];
	if (!opts.includePromoted) conditions.push(isNull(cardDraft.promotedAt));
	return db
		.select()
		.from(cardDraft)
		.where(and(...conditions))
		.orderBy(desc(cardDraft.createdAt), desc(cardDraft.id))
		.limit(limit);
}

export async function getCardDraft(draftId: string, userId: string, db: Db = defaultDb): Promise<CardDraftRow | null> {
	const [row] = await db
		.select()
		.from(cardDraft)
		.where(and(eq(cardDraft.id, draftId), eq(cardDraft.userId, userId)))
		.limit(1);
	return row ?? null;
}

export async function updateCardDraft(
	draftId: string,
	userId: string,
	patch: UpdateCardDraftInput,
	db: Db = defaultDb,
): Promise<CardDraftRow> {
	const parsed = updateCardDraftInputSchema.parse(patch);
	const before = await loadOwnedDraft(draftId, userId, db);
	if (before.promotedAt !== null) throw new CardDraftAlreadyPromotedError(draftId);

	const has = (key: string) => Object.hasOwn(patch as Record<string, unknown>, key);
	const updates: Partial<CardDraftRow> = {};
	if (has('front') && parsed.front !== undefined) updates.front = parsed.front;
	if (has('back') && parsed.back !== undefined) updates.back = parsed.back;
	if (has('domain') && parsed.domain !== undefined) {
		updates.domain = parsed.domain.length === 0 ? null : parsed.domain;
	}
	if (has('cardType') && parsed.cardType !== undefined) updates.cardType = parsed.cardType;
	if (has('kind') && parsed.kind !== undefined) updates.kind = parsed.kind;
	if (has('tags') && parsed.tags !== undefined) updates.tags = parsed.tags;
	if (has('referenceSectionId')) updates.referenceSectionId = parsed.referenceSectionId;
	if (has('knowledgeNodeId')) updates.knowledgeNodeId = parsed.knowledgeNodeId;
	if (has('courseId')) updates.courseId = parsed.courseId;
	if (has('goalId')) updates.goalId = parsed.goalId;

	if (Object.keys(updates).length === 0) return before;

	const [after] = await db
		.update(cardDraft)
		.set({ ...updates, updatedAt: sql`now()` })
		.where(and(eq(cardDraft.id, draftId), eq(cardDraft.userId, userId)))
		.returning();
	if (!after) throw new CardDraftNotFoundError(draftId, userId);

	await auditWrite(
		{
			actorId: userId,
			op: AUDIT_OPS.UPDATE,
			targetType: AUDIT_TARGETS.CARD_DRAFT,
			targetId: after.id,
			before,
			after,
		},
		db,
	);
	return after;
}

export async function discardCardDraft(draftId: string, userId: string, db: Db = defaultDb): Promise<void> {
	const before = await loadOwnedDraft(draftId, userId, db);

	const result = await db
		.delete(cardDraft)
		.where(and(eq(cardDraft.id, draftId), eq(cardDraft.userId, userId)))
		.returning({ id: cardDraft.id });
	if (result.length === 0) throw new CardDraftNotFoundError(draftId, userId);

	await auditWrite(
		{
			actorId: userId,
			op: AUDIT_OPS.DELETE,
			targetType: AUDIT_TARGETS.CARD_DRAFT,
			targetId: draftId,
			before,
			after: null,
			metadata: { subKind: CARD_DRAFT_OP_SUBKINDS.DISCARD },
		},
		db,
	);
}

/**
 * Promote a draft into a real `study.card`. Reuses the existing
 * `createCard` BC: the draft row is preserved with `promoted_to_card_id`
 * and `promoted_at` stamped so the audit trail links the two; the
 * `/memory/drafts` inbox filters out promoted rows.
 *
 * The card and the stamp run in one transaction so a partial failure
 * doesn't leave a card with no draft pointer or a promoted draft with no
 * card.
 */
export async function promoteDraftToCard(
	draftId: string,
	userId: string,
	db: Db = defaultDb,
): Promise<{ cardId: string; draft: CardDraftRow }> {
	const before = await loadOwnedDraft(draftId, userId, db);
	if (before.promotedAt !== null) throw new CardDraftAlreadyPromotedError(draftId);
	if (!before.domain) {
		throw new Error(`Card draft ${draftId} cannot be promoted without a domain selection.`);
	}
	if (before.front.trim().length === 0 || before.back.trim().length === 0) {
		throw new Error(`Card draft ${draftId} cannot be promoted: front and back must be non-empty.`);
	}

	return await db.transaction(async (tx) => {
		const card = await createCard(
			{
				userId,
				front: before.front,
				back: before.back,
				domain: before.domain as Domain,
				cardType: before.cardType as CardType,
				kind: before.kind as CardKind,
				tags: before.tags,
			},
			tx,
		);

		const [after] = await tx
			.update(cardDraft)
			.set({
				promotedToCardId: card.id,
				promotedAt: sql`now()`,
				updatedAt: sql`now()`,
			})
			.where(and(eq(cardDraft.id, draftId), eq(cardDraft.userId, userId)))
			.returning();
		if (!after) throw new CardDraftNotFoundError(draftId, userId);

		await auditWrite(
			{
				actorId: userId,
				op: AUDIT_OPS.UPDATE,
				targetType: AUDIT_TARGETS.CARD_DRAFT,
				targetId: after.id,
				before,
				after,
				metadata: { subKind: CARD_DRAFT_OP_SUBKINDS.PROMOTE, cardId: card.id },
			},
			tx,
		);

		return { cardId: card.id, draft: after };
	});
}
