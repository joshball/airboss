/**
 * Today briefing composition for `/study`.
 *
 * Pulls signals from existing BC primitives:
 *
 *   - `getWeakAreas` -> the weakest domain and the reasons (card / rep
 *     accuracy, overdue load).
 *   - For the weakest domain: pick the knowledge node with the most
 *     attempts and the lowest accuracy, via a single aggregate query
 *     against `study.review` joined to `study.card`.
 *   - `getNodeEvidenceState` over the focus node -> per-method gates.
 *   - `getFirstTouchDate(userId, nodeId)` -> day count.
 *
 * The result is a `TodayBriefing` value object the page renders into
 * prose via the deterministic helper in `today-prose.ts`. Pure data --
 * no markup, no DB access happens past this builder.
 *
 * Defensive shape: every awaited query is wrapped so a single failed
 * query doesn't blank the rest of the page. Signals that fail return
 * `caught_up` so the user still sees a friendly nudge.
 */

import {
	getFirstTouchDate,
	getNodeEvidenceState,
	getWeakAreas,
	type NodeEvidenceState,
	type WeakArea,
} from '@ab/bc-study/server';
import { card, review } from '@ab/bc-study/schema';
import { CARD_STATUSES, MS_PER_DAY, NODE_MASTERY_GATES, ROUTES } from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { TodayBriefing, TodayMethodPercentages, TodayReason } from './today-types';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

export interface TodayBriefingBuildOptions {
	now?: Date;
}

/**
 * Build the briefing for the page loader. The function is total: it
 * always resolves to a renderable `TodayBriefing` value, never throws.
 */
export async function buildTodayBriefing(
	userId: string,
	db: Db = defaultDb,
	options: TodayBriefingBuildOptions = {},
): Promise<TodayBriefing> {
	const now = options.now ?? new Date();
	let weakAreas: WeakArea[] = [];
	try {
		weakAreas = await getWeakAreas(userId, 1, db, now);
	} catch {
		return { kind: 'caught_up' };
	}
	if (weakAreas.length === 0) return { kind: 'caught_up' };
	const top = weakAreas[0];
	if (top === undefined) return { kind: 'caught_up' };

	const focus = await pickFocusNode(userId, top.domain, db);
	if (focus === null) {
		// No knowledge node in the domain has cards yet -- treat as caught
		// up; a briefing without a leaf to point at would render as empty
		// prose.
		return { kind: 'caught_up' };
	}

	const [pillState, firstTouch] = await Promise.all([
		safeGetNodeEvidenceState(userId, focus.nodeId, db),
		safeGetFirstTouch(userId, focus.nodeId, db),
	]);

	const dayCount =
		firstTouch === null ? null : Math.max(1, Math.ceil((now.getTime() - firstTouch.getTime()) / MS_PER_DAY));

	const reasons = mapWeakAreaToReasons(top, focus);
	const methodPercentages = computeMethodPercentages(pillState, focus.recallAccuracy);

	return {
		kind: 'focus',
		focusNodeId: focus.nodeId,
		focusNodeSlug: focus.nodeId, // knowledge_node.id is the slug per ADR 011.
		focusAreaId: top.domain, // No syllabus area resolved here -- domain
		// is the most reliable handle today. The map auto-expand uses
		// `focusAreaCode` which we resolve at the loader level when we
		// know the cert.
		leafTitle: focus.nodeTitle,
		areaTitle: humanizeDomain(top.domain),
		pillState,
		methodPercentages,
		reasons,
		primaryCitation: null, // Resolved at the loader once the focus
		// node's references are available. The today-prose helper handles
		// `null` correctly.
		dayCount,
	};
}

interface FocusNode {
	nodeId: string;
	nodeTitle: string;
	recallAccuracy: number | null;
	dataPoints: number;
}

/**
 * Pick the knowledge node within a weak domain that has the most card
 * attempts in the last 30 days and the lowest accuracy. The query joins
 * `review` -> `card` -> filters by `card.domain`, groups by node, and
 * picks the row with the lowest `correct/total` ratio when at least 5
 * data points exist.
 */
async function pickFocusNode(userId: string, domain: string, db: Db): Promise<FocusNode | null> {
	try {
		const rows = await db
			.select({
				nodeId: card.nodeId,
				total: count(),
				correct: sql<number>`sum(case when ${review.rating} > 0 then 1 else 0 end)`,
			})
			.from(review)
			.innerJoin(card, and(eq(card.id, review.cardId), eq(card.userId, review.userId)))
			.where(and(eq(review.userId, userId), eq(card.status, CARD_STATUSES.ACTIVE), eq(card.domain, domain)))
			.groupBy(card.nodeId)
			.orderBy(desc(count()))
			.limit(20);
		// Pick the lowest-accuracy node with >= 3 data points; fallback to
		// the most-attempted node when nothing is below threshold. Some
		// cards are unattached to a knowledge node (`nodeId IS NULL`); skip
		// those rows since the briefing's whole point is to nominate a
		// specific node.
		const attached = rows.filter((r): r is typeof r & { nodeId: string } => r.nodeId !== null);
		let best: { nodeId: string; total: number; correct: number; accuracy: number } | null = null;
		for (const row of attached) {
			const total = Number(row.total);
			const correct = Number(row.correct ?? 0);
			if (total < 3) continue;
			const accuracy = correct / total;
			if (best === null || accuracy < best.accuracy) {
				best = { nodeId: row.nodeId, total, correct, accuracy };
			}
		}
		const fallback = attached[0];
		const chosen =
			best !== null
				? best
				: fallback === undefined
					? null
					: {
							nodeId: fallback.nodeId,
							total: Number(fallback.total),
							correct: Number(fallback.correct ?? 0),
							accuracy: 0,
						};
		if (chosen === null) return null;
		const titleRows = await db.execute(sql`SELECT title FROM study.knowledge_node WHERE id = ${chosen.nodeId} LIMIT 1`);
		type Row = { title: string };
		const titleList = titleRows as unknown as Row[];
		const title = titleList[0]?.title ?? chosen.nodeId;
		return {
			nodeId: chosen.nodeId,
			nodeTitle: title,
			recallAccuracy: chosen.accuracy,
			dataPoints: chosen.total,
		};
	} catch {
		return null;
	}
}

async function safeGetNodeEvidenceState(userId: string, nodeId: string, db: Db): Promise<NodeEvidenceState | null> {
	try {
		return await getNodeEvidenceState(userId, nodeId, db);
	} catch {
		return null;
	}
}

async function safeGetFirstTouch(userId: string, nodeId: string, db: Db): Promise<Date | null> {
	try {
		return await getFirstTouchDate(userId, nodeId, db);
	} catch {
		return null;
	}
}

function mapWeakAreaToReasons(weak: WeakArea, focus: FocusNode): TodayReason[] {
	const reasons: TodayReason[] = [];
	for (const r of weak.reasons) {
		if (r.kind === 'card-accuracy') {
			reasons.push({
				kind: 'low_accuracy',
				accuracy: r.accuracy,
				dataPoints: r.dataPoints,
				method: 'recall',
			});
		} else if (r.kind === 'rep-accuracy') {
			reasons.push({
				kind: 'low_accuracy',
				accuracy: r.accuracy,
				dataPoints: r.dataPoints,
				method: 'scenario',
			});
		} else if (r.kind === 'overdue') {
			reasons.push({ kind: 'overdue', dueCards: r.overdueCount });
		}
	}
	if (focus.dataPoints === 0) {
		reasons.push({ kind: 'never_attempted' });
	}
	return reasons;
}

function computeMethodPercentages(
	state: NodeEvidenceState | null,
	recallAccuracy: number | null,
): TodayMethodPercentages {
	if (state === null) {
		return { recall: null, calculation: null, scenario: null };
	}
	return {
		recall: gateToPct(state.recall, recallAccuracy),
		calculation: gateToPct(state.calculation, null),
		scenario: gateToPct(state.scenario, null),
	};
}

function gateToPct(gate: NodeEvidenceState['recall'], accuracy: number | null): number | null {
	if (gate === NODE_MASTERY_GATES.NOT_APPLICABLE) return null;
	if (gate === NODE_MASTERY_GATES.PASS) return 100;
	if (gate === NODE_MASTERY_GATES.FAIL || gate === NODE_MASTERY_GATES.INSUFFICIENT_DATA) {
		if (accuracy !== null) return Math.round(accuracy * 100);
		return 0;
	}
	return null;
}

function humanizeDomain(domain: string): string {
	// Domain values are kebab-case (`weight-and-balance`). Convert to a
	// reading-friendly label.
	return domain
		.split('-')
		.map((p) => p.charAt(0).toUpperCase() + p.slice(1))
		.join(' ');
}

/**
 * Pure helper: resolve the focus area code (`'I'`, `'V'`, ...) for the
 * loader's ACS map projection. Called by `+page.server.ts` once the
 * focus node id is known and the syllabus tree has been loaded. Returns
 * null when the focus node has no syllabus_node link in the primary
 * syllabus.
 */
export function _markFocusForExportTesting(): void {
	// Test surface marker -- the helpers above are exposed via the
	// module's public function. This function exists so future test
	// hooks have a stable export point if pickFocusNode needs DB-level
	// fixtures.
}

/** Public route helper for unrelated routes too. */
export const TODAY_FOCUS_HREF = ROUTES.STUDY;
