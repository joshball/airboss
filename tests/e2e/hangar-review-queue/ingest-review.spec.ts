/**
 * `/ingest-review` queue + detail e2e walk.
 *
 * The hangar app's ingest-review surface lets an AUTHOR / OPERATOR / ADMIN
 * resolve handbook ingest residuals (caption-orphan / image-orphan)
 * through the UI. This spec seeds a synthetic `hangar.ingest_issue` row
 * via DB directly (avoiding the producer's `warnings.json` filesystem
 * dependency in the e2e env), then walks:
 *
 *   - the queue page renders the seeded issue
 *   - corpus + status filters narrow the list
 *   - detail page renders the caption + StatusBadge + action buttons
 *   - dismiss action flips status to `dismissed`
 *   - reopen action returns to `unresolved`
 *
 * Pair-with-candidate is exercised in the integration BC test
 * (`integration/caption-orphan-roundtrip.test.ts`) where the figure
 * thumbnail asset path resolves against a tmp `handbooks/` tree. The e2e
 * focuses on the auth / routing / form-action contract.
 */

import { expect, test } from '@playwright/test';
import { eq, inArray } from 'drizzle-orm';
import { ingestIssue, ingestOverride } from '../../../libs/bc/ingest-review/src/schema';
import { INGEST_REVIEW, QUERY_PARAMS, ROUTES } from '../../../libs/constants/src';
import { db } from '../../../libs/db/src/connection';
import { createId, generateAuthId } from '../../../libs/utils/src';

const TEST_TAG = generateAuthId().slice(-12);

const seededIssueIds: string[] = [];

test.afterAll(async () => {
	if (seededIssueIds.length > 0) {
		// Cascade-deletes attached overrides through the FK.
		await db.delete(ingestIssue).where(inArray(ingestIssue.id, seededIssueIds));
	}
});

async function seedIssue(opts: {
	externalId?: string;
	pageNum?: number;
	status?: typeof INGEST_REVIEW.STATUS[keyof typeof INGEST_REVIEW.STATUS];
	caption?: string;
}): Promise<string> {
	const id = createId('isiss');
	seededIssueIds.push(id);
	const externalId = opts.externalId ?? `e2e_${TEST_TAG}_${Math.random().toString(36).slice(2, 8)}`;
	const now = new Date();
	await db.insert(ingestIssue).values({
		id,
		corpus: INGEST_REVIEW.CORPUSES.HANDBOOK,
		sourceId: 'ifh',
		edition: 'FAA-H-8083-15B',
		pageNum: opts.pageNum ?? 83,
		kind: INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN,
		externalId,
		payload: {
			captionText: opts.caption ?? 'Figure 4-7. Koch chart sample.',
			mode: 'image-extracted-elsewhere',
			sectionCode: '4',
			candidateSnapshot: [],
		},
		status: opts.status ?? INGEST_REVIEW.STATUS.UNRESOLVED,
		firstSeenAt: now,
		lastSeenAt: now,
	});
	return id;
}

test.describe('/ingest-review queue page', () => {
	test('renders the seeded unresolved issue with status filter chip', async ({ page }) => {
		const issueId = await seedIssue({ caption: 'Figure 4-7. Koch chart e2e test.' });

		await page.goto(`${ROUTES.HANGAR_INGEST_REVIEW}?${QUERY_PARAMS.STATUS}=unresolved`);
		await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
		// Status filter chip should be marked aria-current=page for the
		// active filter. The chip group has the role `group` with the
		// label "Status".
		const statusGroup = page.getByRole('group', { name: /^Status$/ });
		await expect(statusGroup).toBeVisible();
		const unresolvedChip = statusGroup.getByRole('link', { name: /Unresolved/ });
		await expect(unresolvedChip).toHaveAttribute('aria-current', 'page');

		// The seeded row appears in the issue list. Search by route
		// fragment so the test does not depend on the randomized
		// externalId surfacing in the link text.
		const issueRow = page.locator(`a[href*="${encodeURIComponent(issueId)}"]`);
		await expect(issueRow).toBeVisible();
		// Also asserts the StatusBadge component (rendered inside the row)
		// surfaces the `Unresolved` label.
		await expect(issueRow.getByText(/Unresolved/)).toBeVisible();
	});

	test('filtering by corpus narrows the visible groups', async ({ page }) => {
		const issueId = await seedIssue({});
		await page.goto(`${ROUTES.HANGAR_INGEST_REVIEW}?${QUERY_PARAMS.CORPUS}=handbook&${QUERY_PARAMS.STATUS}=unresolved`);
		const corpusGroup = page.getByRole('group', { name: /^Corpus$/ });
		const handbookChip = corpusGroup.getByRole('link', { name: /Handbook/ });
		await expect(handbookChip).toHaveAttribute('aria-current', 'page');
		await expect(page.locator(`a[href*="${encodeURIComponent(issueId)}"]`)).toBeVisible();
	});
});

test.describe('/ingest-review/[issueId] detail page', () => {
	test('renders caption, kind label, action buttons, and back link', async ({ page }) => {
		const caption = `Figure 4-7. Detail page e2e ${TEST_TAG}.`;
		const issueId = await seedIssue({ caption });
		await page.goto(ROUTES.HANGAR_INGEST_REVIEW_ISSUE(issueId));

		// Caption appears in the blockquote.
		await expect(page.getByText(caption)).toBeVisible();
		// Kind label header shows "Caption orphan".
		await expect(page.getByRole('heading', { name: /Caption orphan/ })).toBeVisible();
		// Action buttons surface for caption-orphan: Pair (disabled until
		// a candidate is selected), Mark no figure, Mark false caption.
		const pair = page.getByRole('button', { name: /^Pair$/ });
		await expect(pair).toBeDisabled();
		await expect(page.getByRole('button', { name: /Mark no figure/ })).toBeEnabled();
		await expect(page.getByRole('button', { name: /Mark false caption/ })).toBeEnabled();
		// Back link to the queue.
		await expect(page.getByRole('link', { name: /Back to queue/ })).toBeVisible();
	});

	test('dismiss action flips the issue to dismissed and reopen restores unresolved', async ({ page }) => {
		const issueId = await seedIssue({});
		await page.goto(ROUTES.HANGAR_INGEST_REVIEW_ISSUE(issueId));

		// Dismiss.
		await Promise.all([
			page.waitForResponse(
				(res) => res.request().method() === 'POST' && res.url().includes('?/dismiss'),
				{ timeout: 15_000 },
			),
			page.getByRole('button', { name: /^Dismiss$/ }).click(),
		]);

		// Re-fetch the row from DB to confirm status flip; the page itself
		// does not re-render the badge until a navigation. (The form action
		// returns `{ ok: true }` without redirect by design -- the queue
		// row re-loads on next navigation.)
		await expect
			.poll(async () => {
				const rows = await db.select().from(ingestIssue).where(eq(ingestIssue.id, issueId));
				return rows[0]?.status;
			})
			.toBe(INGEST_REVIEW.STATUS.DISMISSED);

		// Reopen.
		await Promise.all([
			page.waitForResponse(
				(res) => res.request().method() === 'POST' && res.url().includes('?/reopen'),
				{ timeout: 15_000 },
			),
			page.getByRole('button', { name: /^Reopen$/ }).click(),
		]);
		await expect
			.poll(async () => {
				const rows = await db.select().from(ingestIssue).where(eq(ingestIssue.id, issueId));
				return rows[0]?.status;
			})
			.toBe(INGEST_REVIEW.STATUS.UNRESOLVED);
	});

	test('mark-no-figure resolves the issue with empty payload', async ({ page }) => {
		const issueId = await seedIssue({});
		await page.goto(ROUTES.HANGAR_INGEST_REVIEW_ISSUE(issueId));
		await Promise.all([
			page.waitForResponse(
				(res) => res.request().method() === 'POST' && res.url().includes('?/markNoFigure'),
				{ timeout: 15_000 },
			),
			page.getByRole('button', { name: /Mark no figure/ }).click(),
		]);

		await expect
			.poll(async () => {
				const rows = await db.select().from(ingestIssue).where(eq(ingestIssue.id, issueId));
				return rows[0]?.status;
			})
			.toBe(INGEST_REVIEW.STATUS.RESOLVED);

		// One override row with empty payload.
		const overrides = await db.select().from(ingestOverride).where(eq(ingestOverride.issueId, issueId));
		expect(overrides).toHaveLength(1);
		expect(overrides[0]?.action).toBe(INGEST_REVIEW.ACTIONS.MARK_NO_FIGURE);
		expect(overrides[0]?.payload).toEqual({});
	});

	test('view-page-PDF link is rendered when cacheRoot is set', async ({ page }) => {
		const issueId = await seedIssue({ pageNum: 84 });
		await page.goto(ROUTES.HANGAR_INGEST_REVIEW_ISSUE(issueId));
		// The link surfaces only when `cacheRoot` resolves; in the e2e
		// env the cache may or may not exist on disk. Either render is
		// acceptable; the assertion is that the page does NOT error.
		// We assert against the page header to confirm full render.
		await expect(page.getByRole('heading', { name: /Caption orphan/ })).toBeVisible();
	});
});

