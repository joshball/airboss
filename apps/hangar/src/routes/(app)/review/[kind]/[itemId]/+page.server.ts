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
import { dirname, resolve } from 'node:path';
import { requireRole } from '@ab/auth';
import {
	getItem,
	getOpenSession,
	listSessions,
	listSteps,
	parseTestPlan,
	REPO_ROOT,
	writeFrontmatterField,
} from '@ab/bc-hangar';
import {
	REVIEW_KIND_LABELS,
	REVIEW_KIND_VALUES,
	REVIEW_KINDS,
	type ReviewKind,
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

	// Non-`wp_spec` kinds keep the Phase 4 placeholder shape.
	return {
		kind: kind as ReviewKind,
		kindLabel: REVIEW_KIND_LABELS[kind as ReviewKind],
		item,
		view: 'placeholder' as const,
	};
};

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
}> {
	// Derive the work-package directory from the spec's `ref`. The ref is the
	// repo-relative path to `spec.md`; the directory is the parent.
	const wpDir = dirname(item.ref);
	const tabs = await Promise.all(WP_SPEC_TABS.map(async (tab) => buildTabPayload(tab.id, tab.label, tab.file, wpDir)));
	// Walker summary -- only meaningful when test-plan.md exists.
	const testPlanTab = tabs.find((t) => t.id === 'test-plan');
	let walker: WalkerSummary = {
		stepCount: 0,
		hasPlan: false,
		openSessionId: null,
		recordedSteps: 0,
		passCount: 0,
		failCount: 0,
		blockedCount: 0,
	};
	if (testPlanTab && testPlanTab.present) {
		const testPlanPath = `${wpDir}/test-plan.md`;
		const absPath = resolve(REPO_ROOT, testPlanPath);
		const md = await safeReadFile(absPath);
		const steps = md === null ? [] : parseTestPlan(testPlanPath, md);
		const open = await getOpenSession(item.id, userId);
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
	}

	const sessionRows = await listSessions(item.id);
	const sessions: SessionSummary[] = sessionRows.map((s) => ({
		id: s.id,
		startedAt: s.startedAt instanceof Date ? s.startedAt.toISOString() : String(s.startedAt),
		finishedAt:
			s.finishedAt === null ? null : s.finishedAt instanceof Date ? s.finishedAt.toISOString() : String(s.finishedAt),
		outcome: s.outcome,
		note: s.note ?? '',
	}));

	return {
		kind: REVIEW_KINDS.WP_SPEC,
		kindLabel: REVIEW_KIND_LABELS[REVIEW_KINDS.WP_SPEC],
		item,
		view: 'wp_spec',
		wpDir,
		tabs,
		walker,
		sessions,
	};
}

async function buildTabPayload(id: WpSpecTabId, label: string, file: string, wpDir: string): Promise<WpTabPayload> {
	const repoRelPath = `${wpDir}/${file}`;
	const absPath = resolve(REPO_ROOT, repoRelPath);
	const raw = await safeReadFile(absPath);
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
		const absPath = resolve(REPO_ROOT, item.ref);
		try {
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
			await writeFrontmatterField(absPath, 'review_status', 'done');
			return { flipReviewStatus: 'ok' as const };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Frontmatter write failed.';
			log.error('flipReviewStatus failed', undefined, err instanceof Error ? err : new Error(message));
			return fail(409, { flipReviewStatus: `Frontmatter write failed: ${message}` as const });
		}
	},
};
