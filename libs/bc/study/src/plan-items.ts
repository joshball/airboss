/**
 * Plan-item BC -- "pin to today" learner queue.
 *
 * A plan-item is one learner pin: a knowledge node, reference section,
 * card, or glossary term placed on a date-scoped queue. The command
 * palette's detail-pane "Pin to today" button is the first writer here;
 * a /today consumer surface (read + complete) is a planned follow-up.
 *
 * Storage: `study.plan_item` with a `kind` discriminator + per-kind
 * optional FK columns. The pin date is a plain `date` (`YYYY-MM-DD`)
 * scoped to the learner's local calendar via `userStartOfDay`.
 *
 * Idempotency: re-pinning the same (kind, target, date) for a user is a
 * no-op that returns the existing row. The palette uses this so an
 * over-eager double-click never produces two queue entries.
 */

import { DEFAULT_USER_TIMEZONE, PLAN_ITEM_KINDS, type PlanItemKind } from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { generatePlanItemId, userStartOfDay } from '@ab/utils';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { pinPlanItemSchema } from './plan-items.validation';
import { type PlanItemRow, planItem } from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

/** Raised when a caller asks to mark / unpin a row that doesn't exist for them. */
export class PlanItemNotFoundError extends Error {
	constructor(
		public readonly planItemId: string,
		public readonly userId: string,
	) {
		super(`Plan item ${planItemId} not found for user ${userId}`);
		this.name = 'PlanItemNotFoundError';
	}
}

/**
 * Format a `Date` as a local-calendar `YYYY-MM-DD` string in the given
 * timezone. Mirrors the `userStartOfDay` approach (formatter with
 * `en-CA` produces ISO date) without losing the date component to UTC
 * coercion when the learner's local day differs from the UTC day.
 */
function formatLocalDate(d: Date, tz: string = DEFAULT_USER_TIMEZONE): string {
	return d.toLocaleDateString('en-CA', { timeZone: tz });
}

/**
 * Resolve the `(knowledge_node_id, reference_section_id, card_id,
 * glossary_term)` column tuple for a `(kind, targetId)` pair. Mirrors the
 * per-kind CHECK invariants on `study.plan_item` -- exactly one column
 * matches the kind; the rest are NULL.
 */
function resolveTargetColumns(
	kind: PlanItemKind,
	targetId: string,
): {
	knowledgeNodeId: string | null;
	referenceSectionId: string | null;
	cardId: string | null;
	glossaryTerm: string | null;
} {
	const base = {
		knowledgeNodeId: null as string | null,
		referenceSectionId: null as string | null,
		cardId: null as string | null,
		glossaryTerm: null as string | null,
	};
	switch (kind) {
		case PLAN_ITEM_KINDS.KNOWLEDGE_NODE:
			return { ...base, knowledgeNodeId: targetId };
		case PLAN_ITEM_KINDS.REFERENCE_SECTION:
			return { ...base, referenceSectionId: targetId };
		case PLAN_ITEM_KINDS.CARD:
			return { ...base, cardId: targetId };
		case PLAN_ITEM_KINDS.GLOSSARY:
			return { ...base, glossaryTerm: targetId };
	}
}

/**
 * Drizzle filter that matches a row whose `(kind, target column)` pair
 * equals the supplied `(kind, targetId)`. Used by the idempotency probe
 * inside `pinPlanItem` and by `unpinPlanItemForTarget`.
 */
function targetFilter(kind: PlanItemKind, targetId: string) {
	switch (kind) {
		case PLAN_ITEM_KINDS.KNOWLEDGE_NODE:
			return and(eq(planItem.kind, kind), eq(planItem.knowledgeNodeId, targetId));
		case PLAN_ITEM_KINDS.REFERENCE_SECTION:
			return and(eq(planItem.kind, kind), eq(planItem.referenceSectionId, targetId));
		case PLAN_ITEM_KINDS.CARD:
			return and(eq(planItem.kind, kind), eq(planItem.cardId, targetId));
		case PLAN_ITEM_KINDS.GLOSSARY:
			return and(eq(planItem.kind, kind), eq(planItem.glossaryTerm, targetId));
	}
}

export interface PinPlanItemInput {
	userId: string;
	kind: PlanItemKind;
	/** The id of the underlying entity (node id, section id, card id, slug). */
	targetId: string;
	title: string;
	href: string;
	notes?: string;
	/** Calendar-day string `YYYY-MM-DD`. Defaults to today in the user's tz. */
	pinnedForDate?: string;
	/** IANA tz used to derive the default date. */
	timezone?: string;
}

/**
 * Pin a target to a date-scoped queue. Idempotent: an existing
 * (user, kind, target, date) row is returned unchanged rather than
 * creating a duplicate. Validates the input shape via Zod.
 */
export async function pinPlanItem(input: PinPlanItemInput, db: Db = defaultDb): Promise<PlanItemRow> {
	const tz = input.timezone ?? DEFAULT_USER_TIMEZONE;
	const today = formatLocalDate(userStartOfDay(new Date(), tz), tz);
	const parsed = pinPlanItemSchema.parse({
		kind: input.kind,
		targetId: input.targetId,
		title: input.title,
		href: input.href,
		notes: input.notes,
		pinnedForDate: input.pinnedForDate ?? today,
	});
	const kind = parsed.kind as PlanItemKind;
	const pinnedForDate = parsed.pinnedForDate ?? today;

	// Idempotency: same (user, kind, target, date) returns the existing row.
	const [existing] = await db
		.select()
		.from(planItem)
		.where(
			and(
				eq(planItem.userId, input.userId),
				eq(planItem.pinnedForDate, pinnedForDate),
				targetFilter(kind, parsed.targetId),
			),
		)
		.limit(1);
	if (existing) return existing;

	const columns = resolveTargetColumns(kind, parsed.targetId);
	const [inserted] = await db
		.insert(planItem)
		.values({
			id: generatePlanItemId(),
			userId: input.userId,
			pinnedForDate,
			kind,
			...columns,
			title: parsed.title,
			href: parsed.href,
			notes: parsed.notes ?? '',
		})
		.returning();
	return inserted;
}

/**
 * Convenience wrapper around `pinPlanItem`: pin to "today" in the user's
 * timezone with no explicit date supplied. The palette's POST handler
 * uses this; tests use the lower-level `pinPlanItem` with an explicit
 * date for determinism.
 */
export async function pinToToday(
	input: Omit<PinPlanItemInput, 'pinnedForDate'>,
	db: Db = defaultDb,
): Promise<PlanItemRow> {
	return pinPlanItem(input, db);
}

/**
 * Today's open plan-items for a user, oldest pin first. "Today" is the
 * learner's local calendar day. Completed rows are excluded by default
 * because the consumer's primary view is "what's left to work on";
 * `getPlanItemsForDate` returns the full day's slice.
 */
export async function getTodayPlanItems(
	userId: string,
	db: Db = defaultDb,
	now: Date = new Date(),
	tz: string = DEFAULT_USER_TIMEZONE,
): Promise<PlanItemRow[]> {
	const today = formatLocalDate(userStartOfDay(now, tz), tz);
	return db
		.select()
		.from(planItem)
		.where(and(eq(planItem.userId, userId), eq(planItem.pinnedForDate, today), isNull(planItem.completedAt)))
		.orderBy(asc(planItem.pinnedAt));
}

/**
 * Full day slice -- both open and completed rows for a given calendar
 * date. Used by the eventual /today UI when the user expands "completed
 * today" history.
 */
export async function getPlanItemsForDate(userId: string, date: string, db: Db = defaultDb): Promise<PlanItemRow[]> {
	return db
		.select()
		.from(planItem)
		.where(and(eq(planItem.userId, userId), eq(planItem.pinnedForDate, date)))
		.orderBy(desc(planItem.completedAt), asc(planItem.pinnedAt));
}

/**
 * Mark a plan-item complete. Idempotent: a row that's already complete
 * is returned unchanged (the existing `completed_at` is preserved). Only
 * the owning user can complete their own row.
 */
export async function markPlanItemComplete(
	planItemId: string,
	userId: string,
	db: Db = defaultDb,
	now: Date = new Date(),
): Promise<PlanItemRow> {
	// Defensive ownership read so we surface a typed not-found rather than
	// a silent zero-row update.
	const [existing] = await db
		.select()
		.from(planItem)
		.where(and(eq(planItem.id, planItemId), eq(planItem.userId, userId)))
		.limit(1);
	if (!existing) throw new PlanItemNotFoundError(planItemId, userId);
	if (existing.completedAt !== null) return existing;

	const [updated] = await db
		.update(planItem)
		.set({ completedAt: now })
		.where(and(eq(planItem.id, planItemId), eq(planItem.userId, userId)))
		.returning();
	return updated;
}

/**
 * Reopen a completed plan-item (clears `completed_at`). Idempotent on
 * already-open rows.
 */
export async function reopenPlanItem(planItemId: string, userId: string, db: Db = defaultDb): Promise<PlanItemRow> {
	const [existing] = await db
		.select()
		.from(planItem)
		.where(and(eq(planItem.id, planItemId), eq(planItem.userId, userId)))
		.limit(1);
	if (!existing) throw new PlanItemNotFoundError(planItemId, userId);
	if (existing.completedAt === null) return existing;

	const [updated] = await db
		.update(planItem)
		.set({ completedAt: null })
		.where(and(eq(planItem.id, planItemId), eq(planItem.userId, userId)))
		.returning();
	return updated;
}

/** Hard-delete a plan-item. Only the owning user can unpin their row. */
export async function unpinPlanItem(planItemId: string, userId: string, db: Db = defaultDb): Promise<void> {
	const [deleted] = await db
		.delete(planItem)
		.where(and(eq(planItem.id, planItemId), eq(planItem.userId, userId)))
		.returning({ id: planItem.id });
	if (!deleted) throw new PlanItemNotFoundError(planItemId, userId);
}
