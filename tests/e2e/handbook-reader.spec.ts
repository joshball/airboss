/**
 * Phase 16 e2e for the handbook reader.
 *
 * Drives the user-zero flow end-to-end against the seeded PHAK / AFH / AvWX
 * data: navigate from `/handbooks` -> handbook -> chapter -> section, verify
 * the section body renders with figures + sticky TOC, exercise the
 * read-state controls (segmented control, "didn't get it" toggle, notes,
 * re-read), drive the heartbeat with `page.clock` so the suggestion banner
 * surfaces deterministically, and smoke the AFH + AvWX cross-handbook flow.
 *
 * Heartbeat timing is mocked with Playwright's `page.clock` install + run-for
 * helpers so we never wait the real 60+ seconds for the suggestion threshold.
 *
 * Auth: relies on the existing `tests/e2e/global.setup.ts` storage state
 * (`abby@airboss.test` -- the canonical dev-seed learner per project memory).
 */

import { expect, test } from '@playwright/test';
import {
	HANDBOOK_HEARTBEAT_INTERVAL_SEC,
	HANDBOOK_SUGGEST_OPEN_SECONDS,
	HANDBOOK_SUGGEST_TOTAL_SECONDS,
	ROUTES,
} from '../../libs/constants/src';

// PHAK is the v1 ship handbook. Chapter 12 (Weather Theory) §9 (Atmospheric
// Stability) is the canonical readable section: ~2.5KB body, no figures, no
// stutter. Used as the workhorse target across the suite.
const PHAK_DOC = 'phak';
const PHAK_EDITION = 'FAA-H-8083-25C';
const PHAK_CHAPTER_12 = '12';
const PHAK_CHAPTER_12_TITLE = 'Weather Theory';
const PHAK_SECTION_9 = '9';
const PHAK_SECTION_9_TITLE = 'Atmospheric Stability';

const AFH_DOC = 'afh';
const AFH_CHAPTER_3 = '3';
const AFH_SECTION_2 = '2';
const AFH_SECTION_2_TITLE = 'The Four Fundamentals';

const AVWX_DOC = 'avwx';
const AVWX_CHAPTER_5 = '5';
const AVWX_SECTION_1 = '1';
const AVWX_SECTION_1_TITLE = 'Introduction';

// Mock-clock window: drive the in-page setInterval long enough to clear both
// HANDBOOK_SUGGEST_OPEN_SECONDS (in-session) and HANDBOOK_SUGGEST_TOTAL_SECONDS
// (cumulative), with a tail of extra heartbeat frames so the banner has a
// frame to render after the threshold flips.
const HEARTBEAT_RUN_SECONDS =
	Math.max(HANDBOOK_SUGGEST_OPEN_SECONDS, HANDBOOK_SUGGEST_TOTAL_SECONDS) +
	HANDBOOK_HEARTBEAT_INTERVAL_SEC * 4;

/**
 * Advance the virtual clock in HEARTBEAT_INTERVAL chunks so each tick can fire,
 * the page's `$effect` reactivity can settle, and any in-flight heartbeat POSTs
 * can resolve before the next chunk advances. A single big `runFor` can race
 * against the async fetches inside the tick handler; iterating keeps the page
 * responsive between increments.
 */
async function tickHeartbeatClock(
	page: import('@playwright/test').Page,
	totalSeconds: number,
): Promise<void> {
	const chunkSeconds = HANDBOOK_HEARTBEAT_INTERVAL_SEC;
	let elapsed = 0;
	while (elapsed < totalSeconds) {
		const advance = Math.min(chunkSeconds, totalSeconds - elapsed);
		await page.clock.runFor(advance * 1000);
		elapsed += advance;
	}
}

// Tests in this file share the same dev-seed user and the same PHAK §12.9
// read-state row. They mutate that row (status, notes, comprehended,
// total_seconds_visible). Running them serially across the whole file removes
// the cross-describe race where one describe's setStatusViaSegment(read)
// collides with another's resetReadState. Single-worker for this file.
test.describe.configure({ mode: 'serial' });

// Helpers --------------------------------------------------------------------

/**
 * Reset the learner's read-state for the section to a known baseline
 * (status=unread, comprehended=false). The "Re-read this section" button
 * performs exactly this transition; notes are preserved per spec but they
 * don't affect the tests below.
 */
async function resetReadState(page: import('@playwright/test').Page): Promise<void> {
	// The reread form is non-enhanced -- submitting triggers a POST + 303
	// redirect + GET cycle. Wait for the follow-up nav to settle so the
	// next assertion sees the reloaded read-state.
	await Promise.all([
		page.waitForLoadState('networkidle'),
		page.locator('form.reread-form button[type="submit"]').click(),
	]);
	await expect(page.locator('input[type=radio][name=status][value=unread]')).toBeChecked();
}

/**
 * Click a status segment and wait for the form POST to complete. The
 * segmented control auto-submits on `onchange`, but a race between the
 * client invalidation and a follow-up assertion causes flakes; explicit
 * response wait pins the order.
 */
async function setStatusViaSegment(
	page: import('@playwright/test').Page,
	value: 'unread' | 'reading' | 'read',
): Promise<void> {
	// The segmented control's <input type=radio> is visually hidden
	// (opacity:0; pointer-events:none); checking via Playwright requires
	// `force: true`. The radio's onchange fires `form.requestSubmit()`, and
	// because the form is non-enhanced this triggers a full POST + 303 +
	// GET cycle. Wait for the network to settle before the next assertion.
	const radio = page.locator(`input[type=radio][name=status][value=${value}]`);
	await Promise.all([
		page.waitForLoadState('networkidle'),
		radio.check({ force: true }),
	]);
	await expect(radio).toBeChecked();
}

// Test cases -----------------------------------------------------------------

test.describe('handbook reader: navigation + section rendering', () => {
	test('PHAK card -> chapter list -> chapter -> section', async ({ page }) => {
		await page.goto(ROUTES.HANDBOOKS);
		await expect(page.getByRole('heading', { name: 'Handbooks' })).toBeVisible();

		// Click the PHAK card -- the card is a link wrapping the title.
		const phakCard = page.locator(`a[href="${ROUTES.HANDBOOK(PHAK_DOC)}"]`).first();
		await phakCard.click();
		await expect(page).toHaveURL(ROUTES.HANDBOOK(PHAK_DOC));

		// Chapter 12 link surfaces in the chapter list.
		const chapter12Link = page
			.locator(`a[href$="${ROUTES.HANDBOOK_CHAPTER(PHAK_DOC, PHAK_CHAPTER_12)}"]`)
			.first();
		await expect(chapter12Link).toBeVisible();
		await chapter12Link.click();
		await expect(page).toHaveURL(ROUTES.HANDBOOK_CHAPTER(PHAK_DOC, PHAK_CHAPTER_12));
		await expect(page.getByRole('heading', { level: 1 })).toContainText(
			new RegExp(PHAK_CHAPTER_12_TITLE, 'i'),
		);

		// Click §9 (Atmospheric Stability).
		const section9Link = page
			.locator(`a[href$="${ROUTES.HANDBOOK_SECTION(PHAK_DOC, PHAK_CHAPTER_12, PHAK_SECTION_9)}"]`)
			.first();
		await expect(section9Link).toBeVisible();
		await section9Link.click();
		await expect(page).toHaveURL(
			ROUTES.HANDBOOK_SECTION(PHAK_DOC, PHAK_CHAPTER_12, PHAK_SECTION_9),
		);

		// Section page renders with the right title.
		await expect(page.getByRole('heading', { level: 1 })).toContainText(
			new RegExp(PHAK_SECTION_9_TITLE, 'i'),
		);

		// Body content renders -- assert > 500 chars to confirm we got the
		// real section markdown, not a stub or empty state.
		const bodyText = (await page.locator('article.section-body').innerText()).trim();
		expect(bodyText.length, 'section body text should be substantial').toBeGreaterThan(500);

		// Sticky TOC sidebar lists sibling sections; the active one is marked
		// with `class="active"` (see HandbookSectionToc rendering rules).
		const toc = page.locator('aside.toc');
		await expect(toc).toBeVisible();
		await expect(toc.locator('li.active')).toContainText(new RegExp(PHAK_SECTION_9_TITLE, 'i'));

		// Edition badge shows FAA-H-8083-25C verbatim somewhere in the header.
		await expect(page.getByText(PHAK_EDITION).first()).toBeVisible();

		// Inline figures render as <figure> nodes inside the section body when
		// the section's manifest lists them. Empty figure list is acceptable
		// (12.9 ships zero figures); when present, no asset URL is rendered
		// twice (post-dedup invariant).
		const figureSrcs = await page
			.locator('figure.inline-figure img')
			.evaluateAll((nodes) => nodes.map((n) => (n as HTMLImageElement).getAttribute('src') ?? ''));
		expect(new Set(figureSrcs).size, 'figure URLs should be unique on a single page').toBe(
			figureSrcs.length,
		);
	});

	test('chapter cover-page residue stripped at /handbooks/phak/1', async ({ page }) => {
		// Chapter 1 has subsections so the chapter page renders the section
		// list (no chapter-body block). The H1 may say "Chapter 1: ..." but
		// no duplicate "Chapter 1\n\nIntroduction To Flying\n\nIntroduction"
		// stutter should appear inside any rendered chapter body.
		await page.goto(ROUTES.HANDBOOK_CHAPTER(PHAK_DOC, '1'));
		const chapterBody = page.locator('article.chapter-body');
		const bodyCount = await chapterBody.count();
		if (bodyCount > 0) {
			const text = (await chapterBody.innerText()).trim();
			const firstLine = text.split(/\r?\n/, 1)[0]?.trim() ?? '';
			// First body line must not be the literal chapter sentinel or the
			// repeated chapter title -- those are exactly what the cover-strip
			// pass drops, and they would surface here on regression.
			expect(firstLine).not.toMatch(/^Chapter 1$/);
			expect(firstLine).not.toBe('Introduction To Flying');
			expect(firstLine).not.toBe('Introduction');
		}
	});
});

test.describe('handbook reader: read-state controls', () => {

	test('mark as read persists across reload; re-read resets', async ({ page }) => {
		const url = ROUTES.HANDBOOK_SECTION(PHAK_DOC, PHAK_CHAPTER_12, PHAK_SECTION_9);
		await page.goto(url);
		await resetReadState(page);

		// Flip status -> read via the segmented control.
		await setStatusViaSegment(page, 'read');

		// Re-navigate (fresh server-load) and confirm the status persisted to DB.
		await page.goto(url);
		await expect(page.locator('input[type=radio][name=status][value=read]')).toBeChecked();

		// Toggle "Read but didn't get it" -- enabled now that status >= reading.
		const checkbox = page.locator('input[type=checkbox][name=comprehended]');
		await expect(checkbox).toBeEnabled();
		// SvelteKit form-action POST followed by SvelteKit's own redirect/load.
		// Wait until the URL settles back on the section path (not `?/...`)
		// before doing our own navigation, otherwise `page.goto` races with
		// the in-flight action redirect.
		await checkbox.check();
		await page.waitForURL((u) => u.pathname === url && !u.search.includes('/set-comprehended'));
		await page.goto(url);
		await expect(page.locator('input[type=checkbox][name=comprehended]')).toBeChecked();

		// Re-read clears status + comprehended. Same wait pattern.
		await page.locator('form.reread-form button[type="submit"]').click();
		await page.waitForURL((u) => u.pathname === url && !u.search.includes('/reread'));
		await expect(page.locator('input[type=radio][name=status][value=unread]')).toBeChecked();
		await expect(page.locator('input[type=checkbox][name=comprehended]')).not.toBeChecked();
	});

	test('comprehension checkbox is disabled when status is unread', async ({ page }) => {
		const url = ROUTES.HANDBOOK_SECTION(PHAK_DOC, PHAK_CHAPTER_12, PHAK_SECTION_9);
		await page.goto(url);
		await resetReadState(page);
		await expect(page.locator('input[type=checkbox][name=comprehended]')).toBeDisabled();
	});

	test('notes save and persist across reload', async ({ page }) => {
		const url = ROUTES.HANDBOOK_SECTION(PHAK_DOC, PHAK_CHAPTER_12, PHAK_SECTION_9);
		await page.goto(url);

		const stamp = `e2e-note-${Date.now()}`;
		const textarea = page.locator('textarea#handbook-notes-md');
		// Svelte 5's `bind:value` does not pick up Playwright's fast-fill on
		// a textarea reliably. Issuing real keyboard input dispatches the
		// `input` events Svelte's reactive binding listens for, so the form
		// submit serializes the right `notesMd` payload. Click first to
		// guarantee focus before the keystrokes flow.
		await textarea.click();
		// Wait for the textarea to be the focused element before clearing/typing.
		// Svelte 5 may re-bind on initial paint; a stray re-render can swallow
		// leading keystrokes. Locking on focus before typing avoids that race.
		await expect(textarea).toBeFocused();
		await textarea.press('ControlOrMeta+A');
		await page.keyboard.press('Delete');
		await expect(textarea).toHaveValue('');
		await page.keyboard.type(stamp, { delay: 25 });
		await expect(textarea).toHaveValue(stamp);

		// Form is non-enhanced (no `use:enhance`), so submit POSTs to
		// `?/set-notes` and the action's `{ ok: true }` return body lands as
		// the page response. The DB write completes synchronously inside the
		// action; we just need to wait for the POST to come back before
		// re-navigating to verify persistence.
		const postResponse = page.waitForResponse(
			(res) => res.request().method() === 'POST' && res.url().includes('set-notes'),
		);
		await page.getByRole('button', { name: /save notes/i }).click();
		await postResponse;

		// Re-navigate (fresh load) to confirm the notes persisted to DB.
		await page.goto(url);
		await expect(page.locator('textarea#handbook-notes-md')).toHaveValue(stamp);

		// Cleanup: empty the notes so subsequent runs start clean. Click +
		// keyboard select-all + delete drives the same keyboard-input path
		// that Svelte's bind:value listens on.
		const ta = page.locator('textarea#handbook-notes-md');
		await ta.click();
		await ta.press('ControlOrMeta+A');
		await page.keyboard.press('Delete');
		await expect(ta).toHaveValue('');
		const cleanupResponse = page.waitForResponse(
			(res) => res.request().method() === 'POST' && res.url().includes('set-notes'),
		);
		await page.getByRole('button', { name: /save notes/i }).click();
		await cleanupResponse;
	});
});

test.describe('handbook reader: heartbeat + suggestion banner', () => {

	test('suggestion banner appears once thresholds met; "Mark as read" flips status', async ({
		page,
	}) => {
		const url = ROUTES.HANDBOOK_SECTION(PHAK_DOC, PHAK_CHAPTER_12, PHAK_SECTION_9);

		// Reset baseline first (no virtual clock yet -- this is a real flow).
		await page.goto(url);
		await resetReadState(page);

		// Install a virtual clock pinned to a fixed origin and reload so the
		// in-page setInterval picks up the mocked timer. `runFor` then lets
		// the heartbeat tick fire deterministically without real waits.
		await page.clock.install({ time: new Date('2026-04-26T12:00:00Z') });
		await page.goto(url);

		// Scroll-to-bottom is required by the heuristic
		// (HANDBOOK_SUGGEST_REQUIRES_SCROLL_END = true). Trigger it before the
		// timer so the gate is open by the time the thresholds clear.
		await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

		await tickHeartbeatClock(page, HEARTBEAT_RUN_SECONDS);

		const banner = page.locator('aside.read-suggestion');
		await expect(banner).toBeVisible({ timeout: 5_000 });

		// Click "Mark as read" -- form posts to ?/set-status (non-enhanced).
		await Promise.all([
			page.waitForLoadState('networkidle'),
			banner.getByRole('button', { name: /mark as read/i }).click(),
		]);
		await expect(page.locator('input[type=radio][name=status][value=read]')).toBeChecked();
		// Banner dismisses (status === 'read' -> shouldShowReadSuggestion returns
		// false even before the next reload).
		await expect(banner).toHaveCount(0);
	});

	test('"Not yet" dismissal hides the banner for the rest of the session', async ({ page }) => {
		const url = ROUTES.HANDBOOK_SECTION(PHAK_DOC, PHAK_CHAPTER_12, PHAK_SECTION_9);

		await page.goto(url);
		await resetReadState(page);

		await page.clock.install({ time: new Date('2026-04-26T13:00:00Z') });
		await page.goto(url);
		await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
		await tickHeartbeatClock(page, HEARTBEAT_RUN_SECONDS);

		const banner = page.locator('aside.read-suggestion');
		await expect(banner).toBeVisible();
		await banner.getByRole('button', { name: /not yet/i }).click();
		await expect(banner).toHaveCount(0);

		// Tick further; banner stays dismissed for the rest of the session.
		await tickHeartbeatClock(page, HEARTBEAT_RUN_SECONDS);
		await expect(banner).toHaveCount(0);
	});
});

test.describe('handbook reader: cross-handbook smoke', () => {
	test('AFH index + section render with body content', async ({ page }) => {
		await page.goto(ROUTES.HANDBOOK(AFH_DOC));
		await expect(page.locator('h1')).toContainText(/Airplane Flying Handbook/i);

		await page.goto(ROUTES.HANDBOOK_SECTION(AFH_DOC, AFH_CHAPTER_3, AFH_SECTION_2));
		await expect(page.locator('h1')).toContainText(new RegExp(AFH_SECTION_2_TITLE, 'i'));
		const bodyText = (await page.locator('article.section-body').innerText()).trim();
		expect(bodyText.length).toBeGreaterThan(200);
	});

	test('AvWX index + section render with body content', async ({ page }) => {
		await page.goto(ROUTES.HANDBOOK(AVWX_DOC));
		await expect(page.locator('h1')).toContainText(/Aviation Weather Handbook/i);

		await page.goto(ROUTES.HANDBOOK_SECTION(AVWX_DOC, AVWX_CHAPTER_5, AVWX_SECTION_1));
		await expect(page.locator('h1')).toContainText(new RegExp(AVWX_SECTION_1_TITLE, 'i'));
		const bodyText = (await page.locator('article.section-body').innerText()).trim();
		expect(bodyText.length).toBeGreaterThan(100);
	});
});

test.describe('handbook reader: citing-nodes panel', () => {
	test('citing-nodes panel renders without breaking the page', async ({ page }) => {
		await page.goto(ROUTES.HANDBOOK_SECTION(PHAK_DOC, PHAK_CHAPTER_12, PHAK_SECTION_9));
		// The panel always renders; it shows an empty-state message when no
		// nodes carry a structured handbook citation pointing at this
		// section. The Vitest fixture covers the populated case
		// (handbooks.test.ts -> getNodesCitingSection); the e2e check is
		// the rendering doesn't blow up the page.
		await expect(page.locator('article.section-body')).toBeVisible();
	});

	// Phase 14 wired the resolver, but no knowledge node carries a structured
	// handbook citation in the seeded dataset today. Once a fixture node
	// adds `{ kind: 'handbook', reference_id, locator: { chapter: 12,
	// section: 9 } }`, drop the skip and assert the round-trip click. The
	// deferred work is tracked on
	// docs/work-packages/handbook-ingestion-and-reader/tasks.md Phase 16.
	test.skip('citing-node link round-trip (deferred -- no fixture node yet)', () => {});
});
