/**
 * `/review/[kind]/[itemId]` -- per-kind item review surface.
 *
 * Phase 5 lights up the `wp_spec` kind: a tabbed view of the work-package's
 * sibling markdown files (spec, tasks, test-plan, design, user-stories,
 * review-notes) plus footer actions (Mark spec read, Open test-plan walker,
 * Flip review_status). Other kinds keep the Phase 4 placeholder until their
 * per-kind UI ships in Phase 6.
 *
 * The work-package directory is derived from the item's `ref` (e.g.
 * `docs/work-packages/foo/spec.md` -> directory `docs/work-packages/foo/`).
 * Files that don't exist on disk surface as a "not present" placeholder in
 * the tab body rather than 404-ing the whole page -- a WP that hasn't
 * authored a `user-stories.md` yet is a normal state, not an error.
 */

import { readFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { requireRole } from '@ab/auth';
import {
	finishSession,
	getItem,
	getOpenSession,
	getReference,
	listSessions,
	listSteps,
	parseTestPlan,
	parseToc,
	REPO_ROOT,
	recordStep,
	startSession,
	type TocEntry,
	writeFrontmatterField,
} from '@ab/bc-hangar';
import {
	REVIEW_KIND_LABELS,
	REVIEW_KIND_VALUES,
	REVIEW_KINDS,
	REVIEW_OUTCOME_VALUES,
	type ReviewKind,
	type ReviewOutcome,
	ROLES,
	WP_SPEC_TABS,
	type WpSpecTabId,
} from '@ab/constants';
import { createLogger, parseFrontmatter, renderMarkdown } from '@ab/utils';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('hangar:review:wp-spec');

interface WpTabPayload {
	readonly id: WpSpecTabId;
	readonly label: string;
	readonly file: string;
	readonly present: boolean;
	readonly bodyHtml: string | null;
	readonly frontmatter: ReadonlyArray<{ readonly key: string; readonly value: string }>;
}

interface WalkerSummary {
	readonly stepCount: number;
	readonly hasPlan: boolean;
	readonly openSessionId: string | null;
	readonly recordedSteps: number;
	readonly passCount: number;
	readonly failCount: number;
	readonly blockedCount: number;
}

interface SessionSummary {
	readonly id: string;
	readonly startedAt: string;
	readonly finishedAt: string | null;
	readonly outcome: string | null;
	readonly note: string;
}

export const load: PageServerLoad = async (event) => {
	const user = requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const { kind, itemId } = event.params;
	if (!(REVIEW_KIND_VALUES as readonly string[]).includes(kind)) {
		throw error(404, 'Unknown review kind');
	}
	const item = await getItem(itemId);
	if (!item || item.deletedAt !== null) throw error(404, 'Item not found');
	if (item.kindId !== kind) {
		// Kind segment in the URL doesn't match the item's kind -- stale link
		// or a bookmark from before a kind change. 404 rather than silently
		// rewriting the URL so the linker notices.
		throw error(404, 'Item is not of this kind');
	}

	if (kind === REVIEW_KINDS.WP_SPEC) {
		return loadWpSpec(item, user.id);
	}
	if (kind === REVIEW_KINDS.REFERENCE_TOC) {
		return loadReferenceToc(item, user.id);
	}
	if (kind === REVIEW_KINDS.KNOWLEDGE_NODE) {
		return loadKnowledgeNode(item);
	}
	if (kind === REVIEW_KINDS.AD_HOC) {
		return loadAdHoc(item);
	}
	// `wp_test_plan` items fall through to a placeholder; the walker on the
	// sibling spec is the primary surface for that kind today.
	return {
		kind: kind as ReviewKind,
		kindLabel: REVIEW_KIND_LABELS[kind as ReviewKind],
		item,
		view: 'placeholder' as const,
	};
};

async function loadReferenceToc(
	item: { id: string; kindId: string; ref: string; title: string; deletedAt: Date | null },
	userId: string,
): Promise<{
	kind: 'reference_toc';
	kindLabel: string;
	item: typeof item;
	view: 'reference_toc';
	reference: { id: string; displayName: string; paraphrase: string } | null;
	entries: ReadonlyArray<TocEntry>;
	tocErrors: ReadonlyArray<{ message: string; path: string }>;
	session: { id: string; startedAt: string } | null;
	recordedByRef: ReadonlyArray<{ entryRef: string; outcome: ReviewOutcome; note: string }>;
	sessions: ReadonlyArray<SessionSummary>;
	openSessionStartedAt: string | null;
}> {
	// `item.ref` for reference_toc IS the reference id (per discovery rule).
	const reference = await getReference(item.ref);
	const verbatim = reference?.verbatim ?? null;
	const parsed = parseToc(item.ref, verbatim);
	let session: { id: string; startedAt: string } | null = null;
	let stepRows: readonly { stepRef: string; outcome: string | null; note: string | null }[] = [];
	let openSessionStartedAt: string | null = null;
	if (parsed.entries.length > 0) {
		const open = await startSession(item.id, userId);
		stepRows = await listSteps(open.id);
		session = {
			id: open.id,
			startedAt: open.startedAt instanceof Date ? open.startedAt.toISOString() : String(open.startedAt),
		};
		openSessionStartedAt = session.startedAt;
	}
	const recordedByRef: { entryRef: string; outcome: ReviewOutcome; note: string }[] = [];
	for (const r of stepRows) {
		if (!isReviewOutcome(r.outcome)) continue;
		recordedByRef.push({ entryRef: r.stepRef, outcome: r.outcome, note: r.note ?? '' });
	}
	const sessionRows = await listSessions(item.id);
	const sessions = sessionRows.map(toSessionSummary);
	return {
		kind: REVIEW_KINDS.REFERENCE_TOC,
		kindLabel: REVIEW_KIND_LABELS[REVIEW_KINDS.REFERENCE_TOC],
		item,
		view: 'reference_toc' as const,
		reference: reference
			? {
					id: reference.id,
					displayName: reference.displayName,
					paraphrase: reference.paraphrase,
				}
			: null,
		entries: parsed.entries,
		tocErrors: parsed.errors,
		session,
		recordedByRef,
		sessions,
		openSessionStartedAt,
	};
}

async function loadKnowledgeNode(item: {
	id: string;
	kindId: string;
	ref: string;
	title: string;
	deletedAt: Date | null;
}): Promise<{
	kind: 'knowledge_node';
	kindLabel: string;
	item: typeof item;
	view: 'knowledge_node';
	bodyHtml: string | null;
	frontmatter: ReadonlyArray<{ key: string; value: string }>;
	missing: boolean;
	sessions: ReadonlyArray<SessionSummary>;
}> {
	const absPath = resolve(REPO_ROOT, item.ref);
	const raw = await safeReadFile(absPath);
	if (raw === null) {
		const sessionRows = await listSessions(item.id);
		return {
			kind: REVIEW_KINDS.KNOWLEDGE_NODE,
			kindLabel: REVIEW_KIND_LABELS[REVIEW_KINDS.KNOWLEDGE_NODE],
			item,
			view: 'knowledge_node' as const,
			bodyHtml: null,
			frontmatter: [],
			missing: true,
			sessions: sessionRows.map(toSessionSummary),
		};
	}
	const parsed = parseFrontmatter(raw);
	const bodyHtml = renderMarkdown(parsed.body, { minHeadingLevel: 2, headingIds: true });
	const sessionRows = await listSessions(item.id);
	return {
		kind: REVIEW_KINDS.KNOWLEDGE_NODE,
		kindLabel: REVIEW_KIND_LABELS[REVIEW_KINDS.KNOWLEDGE_NODE],
		item,
		view: 'knowledge_node' as const,
		bodyHtml,
		frontmatter: parsed.entries.map((e) => ({ key: e.key, value: e.value })),
		missing: false,
		sessions: sessionRows.map(toSessionSummary),
	};
}

async function loadAdHoc(item: {
	id: string;
	kindId: string;
	ref: string;
	title: string;
	deletedAt: Date | null;
}): Promise<{
	kind: 'ad_hoc';
	kindLabel: string;
	item: typeof item;
	view: 'ad_hoc';
}> {
	return {
		kind: REVIEW_KINDS.AD_HOC,
		kindLabel: REVIEW_KIND_LABELS[REVIEW_KINDS.AD_HOC],
		item,
		view: 'ad_hoc' as const,
	};
}

function toSessionSummary(s: {
	id: string;
	startedAt: Date | string;
	finishedAt: Date | string | null;
	outcome: string | null;
	note: string | null;
}): SessionSummary {
	return {
		id: s.id,
		startedAt: s.startedAt instanceof Date ? s.startedAt.toISOString() : String(s.startedAt),
		finishedAt:
			s.finishedAt === null ? null : s.finishedAt instanceof Date ? s.finishedAt.toISOString() : String(s.finishedAt),
		outcome: s.outcome,
		note: s.note ?? '',
	};
}

function isReviewOutcome(value: unknown): value is ReviewOutcome {
	return typeof value === 'string' && (REVIEW_OUTCOME_VALUES as readonly string[]).includes(value);
}

async function loadWpSpec(
	item: { id: string; kindId: string; ref: string; title: string },
	userId: string,
): Promise<{
	kind: 'wp_spec';
	kindLabel: string;
	item: typeof item;
	view: 'wp_spec';
	wpDir: string;
	tabs: ReadonlyArray<WpTabPayload>;
	walker: WalkerSummary;
	sessions: ReadonlyArray<SessionSummary>;
	openSessionStartedAt: string | null;
}> {
	// Derive the work-package directory from the spec's `ref`. The ref is the
	// repo-relative path to `spec.md`; the directory is the parent.
	const wpDir = dirname(item.ref);
	// Single test-plan read shared across the tab payload + the walker summary
	// so a concurrent edit between the two reads can't surface a tab body that
	// disagrees with the parsed step count.
	const testPlanRel = `${wpDir}/test-plan.md`;
	const testPlanAbs = resolve(REPO_ROOT, testPlanRel);
	const testPlanMd = await safeReadFile(testPlanAbs);
	const tabs = await Promise.all(
		WP_SPEC_TABS.map(async (tab) => {
			if (tab.file === 'test-plan.md') {
				return buildTabPayloadFromMd(tab.id, tab.label, tab.file, testPlanMd);
			}
			return buildTabPayload(tab.id, tab.label, tab.file, wpDir);
		}),
	);
	// Walker summary -- only meaningful when test-plan.md exists AND has at
	// least one parseable step.
	let walker: WalkerSummary = {
		stepCount: 0,
		hasPlan: false,
		openSessionId: null,
		recordedSteps: 0,
		passCount: 0,
		failCount: 0,
		blockedCount: 0,
	};
	let openSessionStartedAt: string | null = null;
	if (testPlanMd !== null) {
		const steps = parseTestPlan(testPlanRel, testPlanMd);
		// Only inspect open sessions when there's actually a plan to walk; an
		// empty plan should not surface a "session in progress" badge.
		const open = steps.length > 0 ? await getOpenSession(item.id, userId) : null;
		const recorded = open ? await listSteps(open.id) : [];
		let passCount = 0;
		let failCount = 0;
		let blockedCount = 0;
		for (const r of recorded) {
			if (r.outcome === 'pass') passCount += 1;
			else if (r.outcome === 'fail') failCount += 1;
			else if (r.outcome === 'blocked') blockedCount += 1;
		}
		walker = {
			stepCount: steps.length,
			hasPlan: steps.length > 0,
			openSessionId: open?.id ?? null,
			recordedSteps: recorded.length,
			passCount,
			failCount,
			blockedCount,
		};
		if (open) {
			openSessionStartedAt = open.startedAt instanceof Date ? open.startedAt.toISOString() : String(open.startedAt);
		}
	}

	const sessionRows = await listSessions(item.id);
	const sessions = sessionRows.map(toSessionSummary);

	return {
		kind: REVIEW_KINDS.WP_SPEC,
		kindLabel: REVIEW_KIND_LABELS[REVIEW_KINDS.WP_SPEC],
		item,
		view: 'wp_spec',
		wpDir,
		tabs,
		walker,
		sessions,
		openSessionStartedAt,
	};
}

async function buildTabPayload(id: WpSpecTabId, label: string, file: string, wpDir: string): Promise<WpTabPayload> {
	const repoRelPath = `${wpDir}/${file}`;
	const absPath = resolve(REPO_ROOT, repoRelPath);
	const raw = await safeReadFile(absPath);
	return buildTabPayloadFromMd(id, label, file, raw);
}

function buildTabPayloadFromMd(id: WpSpecTabId, label: string, file: string, raw: string | null): WpTabPayload {
	if (raw === null) {
		return { id, label, file, present: false, bodyHtml: null, frontmatter: [] };
	}
	const parsed = parseFrontmatter(raw);
	const bodyHtml = renderMarkdown(parsed.body, { minHeadingLevel: 2, headingIds: true });
	return {
		id,
		label,
		file,
		present: true,
		bodyHtml,
		frontmatter: parsed.entries.map((e) => ({ key: e.key, value: e.value })),
	};
}

async function safeReadFile(absPath: string): Promise<string | null> {
	try {
		return await readFile(absPath, 'utf8');
	} catch {
		return null;
	}
}

/**
 * Defense-in-depth path-traversal check. `item.ref` is loader-controlled (not
 * user-controlled), but a corrupted DB row could resolve outside REPO_ROOT
 * via `..` segments. Reject any absolute path that doesn't sit under the
 * repo root + a path separator (the trailing-separator check guards against
 * `${REPO_ROOT}-evil/` matches).
 */
function assertWithinRepoRoot(absPath: string): void {
	const root = REPO_ROOT.endsWith(sep) ? REPO_ROOT : `${REPO_ROOT}${sep}`;
	if (!absPath.startsWith(root) && absPath !== REPO_ROOT) {
		throw new Error(`Path resolves outside REPO_ROOT: ${absPath}`);
	}
}

export const actions: Actions = {
	/**
	 * `?/markSpecRead` -- writes `status: done` to the WP's spec.md
	 * frontmatter. The board's drag-drop is the more general affordance; this
	 * action is the one-click shortcut from the spec view's footer so the
	 * reviewer doesn't have to drag back to the board to flip status.
	 *
	 * Writes are atomic via `writeFrontmatterField` (sibling temp + rename).
	 * The next loader pass picks up the new status and the board reflects it.
	 */
	markSpecRead: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const { itemId } = event.params;
		const item = await getItem(itemId);
		if (!item || item.deletedAt !== null) return fail(404, { markSpecRead: 'Item not found.' as const });
		if (item.kindId !== REVIEW_KINDS.WP_SPEC) {
			return fail(400, { markSpecRead: 'Only wp_spec items support this action.' as const });
		}
		// Idempotent: skip the write when status is already `done` so the user
		// gets accurate "already done" wording rather than a misleading
		// "marked as read" toast on a re-click.
		if (item.frontmatterStatus === 'done') {
			return { markSpecRead: 'already-done' as const };
		}
		const absPath = resolve(REPO_ROOT, item.ref);
		try {
			assertWithinRepoRoot(absPath);
			await writeFrontmatterField(absPath, 'status', 'done');
			return { markSpecRead: 'ok' as const };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Frontmatter write failed.';
			log.error('markSpecRead failed', undefined, err instanceof Error ? err : new Error(message));
			return fail(409, { markSpecRead: `Frontmatter write failed: ${message}` as const });
		}
	},

	/**
	 * `?/flipReviewStatus` -- writes `review_status: done` to the WP's
	 * spec.md frontmatter. Confirm-gated client-side (the spec calls this
	 * out as agent-controlled with an explicit user trigger). The walker's
	 * `Finish` action also calls into the same path when 100% pass.
	 */
	flipReviewStatus: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const { itemId } = event.params;
		const item = await getItem(itemId);
		if (!item || item.deletedAt !== null) return fail(404, { flipReviewStatus: 'Item not found.' as const });
		if (item.kindId !== REVIEW_KINDS.WP_SPEC) {
			return fail(400, { flipReviewStatus: 'Only wp_spec items support this action.' as const });
		}
		const absPath = resolve(REPO_ROOT, item.ref);
		try {
			assertWithinRepoRoot(absPath);
			await writeFrontmatterField(absPath, 'review_status', 'done');
			return { flipReviewStatus: 'ok' as const };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Frontmatter write failed.';
			log.error('flipReviewStatus failed', undefined, err instanceof Error ? err : new Error(message));
			return fail(409, { flipReviewStatus: `Frontmatter write failed: ${message}` as const });
		}
	},

	/**
	 * `?/recordTocStep` -- record (or overwrite) a TOC entry's pass/fail/blocked
	 * outcome inside the open `reference_toc` session. Mirrors the walker's
	 * `?/recordStep` action shape (idempotent on `(sessionId, stepRef)`) so
	 * the existing review_step table works without extension. The route is
	 * shared between kinds for symmetry and to keep the dispatcher route
	 * simple; the BC primitive (`recordStep`) is kind-agnostic.
	 */
	recordTocStep: async (event) => {
		const user = requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const { itemId } = event.params;
		const fd = await event.request.formData();
		const sessionId = String(fd.get('sessionId') ?? '');
		const entryRef = String(fd.get('entryRef') ?? '');
		const entryIndexRaw = String(fd.get('entryIndex') ?? '0');
		const outcomeRaw = String(fd.get('outcome') ?? '');
		const note = String(fd.get('note') ?? '');
		if (sessionId === '' || entryRef === '') {
			return fail(400, { recordTocStep: 'Missing sessionId or entryRef.' as const });
		}
		const entryIndex = Number.parseInt(entryIndexRaw, 10);
		if (!Number.isFinite(entryIndex) || entryIndex < 0) {
			return fail(400, { recordTocStep: 'entryIndex must be a non-negative integer.' as const });
		}
		if (!isReviewOutcome(outcomeRaw)) {
			return fail(400, { recordTocStep: 'Invalid outcome.' as const });
		}
		const item = await getItem(itemId);
		if (!item || item.deletedAt !== null) {
			return fail(404, { recordTocStep: 'Item not found.' as const });
		}
		if (item.kindId !== REVIEW_KINDS.REFERENCE_TOC) {
			return fail(400, { recordTocStep: 'Only reference_toc items support this action.' as const });
		}
		const open = await getOpenSession(itemId, user.id);
		if (!open || open.id !== sessionId) {
			return fail(409, { recordTocStep: 'Session no longer open. Reload to start a new session.' as const });
		}
		await recordStep({ sessionId, stepIndex: entryIndex, stepRef: entryRef, outcome: outcomeRaw, note });
		return { recordTocStep: 'ok' as const };
	},

	/**
	 * `?/finishTocSession` -- close the open `reference_toc` session with
	 * an outcome. The TOC review does NOT flip frontmatter (`hangar.reference`
	 * rows live in the DB, not on disk); the bucket filter
	 * `noPassingSession: true` removes the item from the TOC bucket once
	 * it has at least one passing session.
	 */
	finishTocSession: async (event) => {
		const user = requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const { itemId } = event.params;
		const fd = await event.request.formData();
		const sessionId = String(fd.get('sessionId') ?? '');
		const outcomeRaw = String(fd.get('outcome') ?? '');
		const note = String(fd.get('note') ?? '');
		if (sessionId === '') {
			return fail(400, { finishTocSession: 'Missing sessionId.' as const });
		}
		if (outcomeRaw !== 'pass' && outcomeRaw !== 'fail' && outcomeRaw !== 'abandoned') {
			return fail(400, { finishTocSession: 'Invalid outcome.' as const });
		}
		const item = await getItem(itemId);
		if (!item || item.deletedAt !== null) return fail(404, { finishTocSession: 'Item not found.' as const });
		if (item.kindId !== REVIEW_KINDS.REFERENCE_TOC) {
			return fail(400, { finishTocSession: 'Only reference_toc items support this action.' as const });
		}
		const open = await getOpenSession(itemId, user.id);
		if (!open || open.id !== sessionId) {
			return fail(403, { finishTocSession: 'Session does not belong to the current user / item.' as const });
		}
		await finishSession(sessionId, outcomeRaw, note);
		return { finishTocSession: 'ok' as const, closedAs: outcomeRaw };
	},

	/**
	 * `?/markKnowledgeNodeReviewed` -- write `discovery_review: done` to a
	 * knowledge node's frontmatter. The node loader emits all 46 nodes with
	 * `reviewStatus = null` (spec gap #1) so this action moves the node
	 * from the "pending" bucket to the "reviewed" state.
	 *
	 * Confirm-gated client-side (a single user-driven write per node).
	 * Reviewer can also walk the node's pedagogy via free-form notes in a
	 * session if they want a record; the action stays a one-click shortcut.
	 */
	markKnowledgeNodeReviewed: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const { itemId } = event.params;
		const item = await getItem(itemId);
		if (!item || item.deletedAt !== null) {
			return fail(404, { markKnowledgeNodeReviewed: 'Item not found.' as const });
		}
		if (item.kindId !== REVIEW_KINDS.KNOWLEDGE_NODE) {
			return fail(400, { markKnowledgeNodeReviewed: 'Only knowledge_node items support this action.' as const });
		}
		const absPath = resolve(REPO_ROOT, item.ref);
		try {
			assertWithinRepoRoot(absPath);
			await writeFrontmatterField(absPath, 'discovery_review', 'done');
			return { markKnowledgeNodeReviewed: 'ok' as const };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Frontmatter write failed.';
			log.error('markKnowledgeNodeReviewed failed', undefined, err instanceof Error ? err : new Error(message));
			return fail(409, { markKnowledgeNodeReviewed: `Frontmatter write failed: ${message}` as const });
		}
	},
};
