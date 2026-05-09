/**
 * `/review/[kind]/[itemId]/walker` -- the test-plan walker.
 *
 * The killer feature of the hangar review queue. For a `wp_spec` item, the
 * walker reads the WP's sibling `test-plan.md`, parses it via
 * `parseTestPlan`, gets-or-creates an open `review_session` for the
 * `(itemId, userId)` pair, hydrates any prior step outcomes, and renders
 * each step as a row with three outcome buttons + a note field. Each
 * outcome click hits `?/recordStep` which idempotently upserts the step
 * row keyed on `(sessionId, stepRef)`.
 *
 * Resume: re-entering the walker for the same `(itemId, userId)` returns
 * the same open session row -- `startSession()` is idempotent for an open
 * session. Hard refresh, second tab, day-later return all land on the same
 * row with prior outcomes hydrated.
 *
 * Finish: `?/finishSession` closes the open session with an outcome (auto-
 * pass when 100% pass + 0 blocked; otherwise the caller's `outcome`).
 * When finishing as `pass` AND every step recorded `pass`, the action also
 * writes `review_status: done` to the wp_spec's frontmatter so the next
 * loader pass moves the item to the `Done` column on the board.
 */

import { readFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { requireRole } from '@ab/auth';
import {
	everyStepPassed,
	finishSession,
	getItem,
	getOpenSession,
	listSteps,
	parseTestPlan,
	REPO_ROOT,
	recordStep,
	startSession,
	type TestPlanStep,
	writeFrontmatterField,
} from '@ab/bc-hangar/server';
import { REVIEW_KINDS, REVIEW_OUTCOME_VALUES, type ReviewOutcome, ROLES, type SessionOutcome } from '@ab/constants';
import { createLogger } from '@ab/utils';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('hangar:review:walker');

interface RecordedStep {
	readonly stepRef: string;
	readonly outcome: ReviewOutcome;
	readonly note: string;
}

export const load: PageServerLoad = async (event) => {
	const user = requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const { kind, itemId } = event.params;
	const item = await getItem(itemId);
	if (!item || item.deletedAt !== null) throw error(404, 'Item not found');
	if (item.kindId !== kind) throw error(404, 'Item is not of this kind');
	if (item.kindId !== REVIEW_KINDS.WP_SPEC) {
		// Phase 5 ships the walker for `wp_spec` only. `wp_test_plan` (and
		// other kinds that grow walker support later) layer on the same
		// route shape; today we 404 cleanly rather than render an empty
		// walker.
		throw error(404, 'Walker is only available for wp_spec items in Phase 5');
	}

	const wpDir = dirname(item.ref);
	const testPlanRel = `${wpDir}/test-plan.md`;
	const testPlanAbs = resolve(REPO_ROOT, testPlanRel);
	const md = await safeReadFile(testPlanAbs);
	const steps: ReadonlyArray<TestPlanStep> = md === null ? [] : parseTestPlan(testPlanRel, md);

	// Lazy session creation: only start a session when there's a plan to walk.
	// Visiting the walker for an empty plan must not pollute the session
	// history. A no-plan visit shows the missing/empty state without a row in
	// the spec view's right rail.
	let session: { id: string; startedAt: string } | null = null;
	let stepRows: readonly { stepRef: string; outcome: string | null; note: string | null }[] = [];
	if (steps.length > 0) {
		const open = await startSession(item.id, user.id);
		stepRows = await listSteps(open.id);
		session = {
			id: open.id,
			startedAt: open.startedAt instanceof Date ? open.startedAt.toISOString() : String(open.startedAt),
		};
	}

	const recordedByRef = new Map<string, RecordedStep>();
	for (const r of stepRows) {
		if (!isReviewOutcome(r.outcome)) continue;
		recordedByRef.set(r.stepRef, { stepRef: r.stepRef, outcome: r.outcome, note: r.note ?? '' });
	}

	const passCount = countByOutcome(stepRows, 'pass');
	const failCount = countByOutcome(stepRows, 'fail');
	const blockedCount = countByOutcome(stepRows, 'blocked');
	const remaining = Math.max(0, steps.length - stepRows.length);

	return {
		item,
		wpDir,
		testPlanRel,
		testPlanPresent: md !== null,
		session,
		steps,
		recordedByRef: [...recordedByRef.values()],
		summary: {
			total: steps.length,
			recorded: stepRows.length,
			pass: passCount,
			fail: failCount,
			blocked: blockedCount,
			remaining,
		},
	};
};

async function safeReadFile(absPath: string): Promise<string | null> {
	try {
		return await readFile(absPath, 'utf8');
	} catch {
		return null;
	}
}

function countByOutcome(rows: ReadonlyArray<{ outcome: string | null }>, target: ReviewOutcome): number {
	let n = 0;
	for (const r of rows) if (r.outcome === target) n += 1;
	return n;
}

function isReviewOutcome(value: unknown): value is ReviewOutcome {
	return typeof value === 'string' && (REVIEW_OUTCOME_VALUES as readonly string[]).includes(value);
}

/**
 * User-finishable session outcomes. `abandoned` IS surfaced as a button
 * (an explicit "Abandon" affordance the walker UI exposes alongside Pass /
 * Fail), so it's whitelisted here. The constants file documents `abandoned`
 * as ALSO a loader-bookkeeping marker; the walker action accepts the user-
 * driven path because the alternative (fake `fail` plus a "really abandoned"
 * sentinel note) muddies session history more than it gains in tamper
 * resistance.
 *
 * The whitelist exists primarily to defend against future enum growth: if a
 * fourth `SessionOutcome` ever lands (e.g. `superseded`), the action stays
 * a known-good set rather than silently accepting the new value.
 */
const USER_FINISHABLE_OUTCOMES: readonly SessionOutcome[] = ['pass', 'fail', 'abandoned'];

function isUserFinishableOutcome(value: unknown): value is SessionOutcome {
	return typeof value === 'string' && (USER_FINISHABLE_OUTCOMES as readonly string[]).includes(value);
}

function assertWithinRepoRoot(absPath: string): void {
	const root = REPO_ROOT.endsWith(sep) ? REPO_ROOT : `${REPO_ROOT}${sep}`;
	if (!absPath.startsWith(root) && absPath !== REPO_ROOT) {
		throw new Error(`Path resolves outside REPO_ROOT: ${absPath}`);
	}
}

export const actions: Actions = {
	/**
	 * `?/recordStep` -- idempotent step write keyed on `(sessionId, stepRef)`.
	 * Saving the same step twice flips the outcome / note. The walker page
	 * fires this on every outcome click and on note blur.
	 *
	 * Re-checks the open session immediately before writing so a concurrent
	 * `?/finishSession` from another tab can't trick this action into landing
	 * a step row in a closed session. Returns 409 if the session has been
	 * finished since the form was rendered so the UI can re-load.
	 */
	recordStep: async (event) => {
		const user = requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const { itemId } = event.params;
		const fd = await event.request.formData();
		const sessionId = String(fd.get('sessionId') ?? '');
		const stepRef = String(fd.get('stepRef') ?? '');
		const stepIndexRaw = String(fd.get('stepIndex') ?? '0');
		const outcomeRaw = String(fd.get('outcome') ?? '');
		const note = String(fd.get('note') ?? '');
		if (sessionId === '' || stepRef === '') {
			return fail(400, { recordStep: 'Missing sessionId or stepRef.' as const });
		}
		const stepIndex = Number.parseInt(stepIndexRaw, 10);
		if (!Number.isFinite(stepIndex) || stepIndex < 0) {
			return fail(400, { recordStep: 'stepIndex must be a non-negative integer.' as const });
		}
		if (!isReviewOutcome(outcomeRaw)) {
			return fail(400, { recordStep: 'Invalid outcome.' as const });
		}
		// Tamper guard: the session must belong to this item AND the calling
		// user AND must still be open. Without this, a malicious form post
		// could write into another user's open session by guessing the
		// session id, OR a concurrent finishSession from another tab could
		// race the write into a closed session.
		const open = await getOpenSession(itemId, user.id);
		if (!open || open.id !== sessionId) {
			return fail(409, {
				recordStep: 'Session no longer open. Reload to start a new session.' as const,
			});
		}
		await recordStep({ sessionId, stepIndex, stepRef, outcome: outcomeRaw, note });
		return { recordStep: 'ok' as const };
	},

	/**
	 * `?/finishSession` -- close the open session with an outcome.
	 *
	 * When the caller passes `outcome=pass` AND every step in the test plan
	 * is recorded as `pass`, the action also writes `review_status: done`
	 * to the wp_spec's frontmatter so the next loader pass moves the item
	 * to the `Done` column on the board. The frontmatter flip is the
	 * agent-owned write the spec calls out (status flip stays user-owned).
	 *
	 * Soft-deleted items are rejected the same way they are in `?/markSpecRead`
	 * / `?/flipReviewStatus`: a session against a deleted item must not flip
	 * frontmatter on a stale path. The `isUserFinishableOutcome` helper
	 * whitelists user-driven outcomes so future enum growth can't reach the
	 * action via an untouched validator.
	 */
	finishSession: async (event) => {
		const user = requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const { itemId } = event.params;
		const fd = await event.request.formData();
		const sessionId = String(fd.get('sessionId') ?? '');
		const outcomeRaw = String(fd.get('outcome') ?? '');
		const note = String(fd.get('note') ?? '');
		if (sessionId === '') {
			return fail(400, { finishSession: 'Missing sessionId.' as const });
		}
		if (!isUserFinishableOutcome(outcomeRaw)) {
			return fail(400, { finishSession: 'Invalid outcome.' as const });
		}
		const open = await getOpenSession(itemId, user.id);
		if (!open || open.id !== sessionId) {
			return fail(403, { finishSession: 'Session does not belong to the current user / item.' as const });
		}

		// Determine whether the walker walked the plan to completion with a
		// clean pass before we close the session -- if so, flip the spec's
		// review_status. Read the live test plan + recorded steps now (not
		// the load-time snapshot) so a concurrent edit can't trick us into a
		// premature flip.
		const item = await getItem(itemId);
		// Match the soft-delete gate used by sibling load + actions; a stale
		// `item.ref` after a soft-delete must not be the target of a
		// frontmatter write.
		if (!item || item.deletedAt !== null) return fail(404, { finishSession: 'Item not found.' as const });
		const wpDir = dirname(item.ref);
		const testPlanRel = `${wpDir}/test-plan.md`;
		const md = await safeReadFile(resolve(REPO_ROOT, testPlanRel));
		const steps = md === null ? [] : parseTestPlan(testPlanRel, md);
		const stepRows = await listSteps(sessionId);
		const cleanPass = everyStepPassed(steps, stepRows);

		// Close the session first; even if the frontmatter write fails the
		// session is already finished (the user explicitly hit Finish).
		await finishSession(sessionId, outcomeRaw, note);

		let frontmatterFlipped = false;
		if (outcomeRaw === 'pass' && cleanPass && item.kindId === REVIEW_KINDS.WP_SPEC) {
			const absPath = resolve(REPO_ROOT, item.ref);
			try {
				assertWithinRepoRoot(absPath);
				await writeFrontmatterField(absPath, 'review_status', 'done');
				frontmatterFlipped = true;
			} catch (err) {
				// Surface the failure but keep the session finished. Reviewer
				// can re-flip via the spec view's "Flip review_status" action.
				const message = err instanceof Error ? err.message : 'Frontmatter write failed.';
				log.error('finishSession: frontmatter flip failed', undefined, err instanceof Error ? err : new Error(message));
				return {
					finishSession: 'ok' as const,
					closedAs: outcomeRaw,
					frontmatterFlipped: false,
					frontmatterError: message,
				};
			}
		}

		return {
			finishSession: 'ok' as const,
			closedAs: outcomeRaw,
			frontmatterFlipped,
			frontmatterError: null,
		};
	},
};
