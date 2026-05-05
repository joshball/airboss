/**
 * `withFreshUser` Playwright fixture.
 *
 * Creates a unique learner-role bauth_user + bauth_account row per test,
 * authenticates the page via the login UI, and tears the user down (with
 * cascade) at the end of the test. Eliminates the cross-test coupling that
 * forced 5 different specs to call `test.skip(...)` whenever the shared
 * dev-seed didn't happen to expose the row shape they expected.
 *
 * Design notes:
 *
 *   - Each fresh user gets a unique email of the form
 *     `e2e-fresh+<ulid>@airboss.test` so concurrent Playwright workers don't
 *     collide on the unique-email constraint.
 *
 *   - The user is marked with `address->>'seed_origin' = 'e2e-fresh-user'`
 *     so leftover rows from a crashed run can be reaped by a maintenance
 *     query (the `DEV_SEED_ORIGIN_TAG` namespace is reserved for the dev
 *     pipeline; we use a separate origin so `db seed:remove` doesn't sweep
 *     them by accident).
 *
 *   - `cleanupFreshUser` deletes user-scoped rows in FK order before
 *     dropping the auth rows. The study schema uses ON DELETE CASCADE for
 *     most user-scoped tables but we delete explicitly to keep the contract
 *     visible (and to fail loudly if a future migration drops the cascade).
 *
 *   - The fixture also exposes seed-and-cleanup helpers for global rows
 *     individual tests need (knowledge_node citations, syllabus links).
 *     Each helper returns a teardown closure the fixture invokes on test
 *     end, so a spec only registers what it seeded.
 */

import { test as base, type Page, expect } from '@playwright/test';
import { eq, inArray, like } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import {
	BETTER_AUTH_PROVIDERS,
	DEV_DB_URL_E2E,
	DEV_PASSWORD,
	ROUTES,
} from '../../../libs/constants/src';
import { bauthAccount, bauthSession, bauthUser } from '../../../libs/auth/src/schema';
import {
	card,
	cardState,
	goal,
	goalSyllabus,
	knowledgeNode,
	reference,
	review,
	scenario,
	session,
	sessionItemResult,
	studyPlan,
} from '../../../libs/bc/study/src/schema';
import { generateAuthId } from '../../../libs/utils/src';

/** Origin tag for rows owned by the fixture. Distinct from DEV_SEED_ORIGIN_TAG. */
export const E2E_FRESH_USER_ORIGIN = 'e2e-fresh-user';

/** Origin tag for ad-hoc fixture data (knowledge nodes etc.) seeded per-test. */
export const E2E_FIXTURE_DATA_ORIGIN = 'e2e-fixture-data';

/** Email prefix used to recognize fixture-owned auth rows. */
const FRESH_USER_EMAIL_PREFIX = 'e2e-fresh+';

/** Domain used by every fixture user. Matches `airboss.test` like the seed accounts. */
const FRESH_USER_EMAIL_DOMAIN = '@airboss.test';

interface InternalConnection {
	client: Sql;
	db: ReturnType<typeof drizzle>;
}

function openConnection(): InternalConnection {
	// Hard-pin to the e2e database (`airboss_e2e`). The playwright webServer
	// entries pin every spawned vite/sveltekit process at this DB, so a
	// fresh user inserted anywhere else would never authenticate against
	// the webserver. We deliberately do NOT honour a `DATABASE_URL` env
	// override here -- bun auto-loads `.env` based on cwd, which would
	// quietly route fixture inserts to the developer's dev DB.
	const client = postgres(DEV_DB_URL_E2E, { max: 1 });
	const db = drizzle(client);
	return { client, db };
}

export interface FreshUser {
	id: string;
	email: string;
	password: string;
}

/**
 * Create a unique bauth_user + bauth_account row directly via Drizzle (same
 * code path as `scripts/db/seed-dev-users.ts`). Marked with
 * `address.seed_origin = E2E_FRESH_USER_ORIGIN` so reaper queries can find
 * leftovers without touching dev-seed users.
 */
export async function createFreshUser(): Promise<FreshUser> {
	const { client, db } = openConnection();
	try {
		const { hashPassword } = await import('better-auth/crypto');
		const userId = generateAuthId();
		const email = `${FRESH_USER_EMAIL_PREFIX}${userId}${FRESH_USER_EMAIL_DOMAIN}`;
		const now = new Date();
		const hashedPassword = await hashPassword(DEV_PASSWORD);

		await db.insert(bauthUser).values({
			id: userId,
			email,
			name: `Fresh ${userId}`,
			firstName: 'Fresh',
			lastName: userId,
			emailVerified: true,
			role: 'learner',
			address: { seed_origin: E2E_FRESH_USER_ORIGIN },
			createdAt: now,
			updatedAt: now,
		});

		await db.insert(bauthAccount).values({
			id: generateAuthId(),
			userId,
			accountId: userId,
			providerId: BETTER_AUTH_PROVIDERS.CREDENTIAL,
			password: hashedPassword,
			createdAt: now,
			updatedAt: now,
		});

		return { id: userId, email, password: DEV_PASSWORD };
	} finally {
		await client.end();
	}
}

/**
 * Drive the login UI to capture the fresh user's session cookie. Returns once
 * the dashboard heading is visible so subsequent navigations are authed.
 */
export async function loginAsFreshUser(page: Page, user: FreshUser): Promise<void> {
	await page.goto(ROUTES.LOGIN);
	await page.getByLabel('Email').fill(user.email);
	await page.getByLabel('Password').fill(user.password);
	await Promise.all([
		// Post-login the (app) root redirects to the Study home (`/study`)
		// since the study-home WP cutover; the legacy `/dashboard` route is
		// kept as the "Stats" power-user view. Match either pathname so this
		// fixture survives a future redirect change.
		page.waitForURL(
			(url) => url.pathname === ROUTES.STUDY || url.pathname === ROUTES.DASHBOARD,
			{ timeout: 10_000 },
		),
		page.getByRole('button', { name: /sign in/i }).click(),
	]);
	await expect(
		page.getByRole('heading', { name: /^(study|learning dashboard|dashboard)$/i, level: 1 }),
	).toBeVisible();
}

/**
 * Delete every user-scoped row, then the auth rows. Order matters: SIRs and
 * reviews reference cards/scenarios/sessions; goal_syllabus references goal.
 */
export async function cleanupFreshUser(userId: string): Promise<void> {
	const { client, db } = openConnection();
	try {
		await db.transaction(async (tx) => {
			await tx.delete(sessionItemResult).where(eq(sessionItemResult.userId, userId));
			await tx.delete(review).where(eq(review.userId, userId));
			await tx.delete(session).where(eq(session.userId, userId));
			await tx.delete(studyPlan).where(eq(studyPlan.userId, userId));
			await tx.delete(scenario).where(eq(scenario.userId, userId));
			await tx.delete(cardState).where(eq(cardState.userId, userId));
			await tx.delete(card).where(eq(card.userId, userId));
			// goal_syllabus has FK to goal; delete the children first, then goals.
			const userGoals = await tx.select({ id: goal.id }).from(goal).where(eq(goal.userId, userId));
			if (userGoals.length > 0) {
				await tx.delete(goalSyllabus).where(inArray(goalSyllabus.goalId, userGoals.map((g) => g.id)));
			}
			await tx.delete(goal).where(eq(goal.userId, userId));
			await tx.delete(bauthSession).where(eq(bauthSession.userId, userId));
			await tx.delete(bauthAccount).where(eq(bauthAccount.userId, userId));
			await tx.delete(bauthUser).where(eq(bauthUser.id, userId));
		});
	} finally {
		await client.end();
	}
}

/** Age threshold (ms) before a fixture user is considered abandoned. */
const FRESH_USER_REAP_AGE_MS = 5 * 60 * 1000;

/**
 * Reap fixture-owned auth rows older than {@link FRESH_USER_REAP_AGE_MS}
 * that survived an earlier crash. Called once per worker before the first
 * fixture activation. Skips young rows so concurrent Playwright workers
 * (own fixture users always exist for less than a single test run) never
 * reap each other's rows.
 */
async function reapStaleFreshUsers(): Promise<void> {
	const { client, db } = openConnection();
	try {
		const cutoff = new Date(Date.now() - FRESH_USER_REAP_AGE_MS);
		const stale = await db
			.select({ id: bauthUser.id, createdAt: bauthUser.createdAt })
			.from(bauthUser)
			.where(like(bauthUser.email, `${FRESH_USER_EMAIL_PREFIX}%${FRESH_USER_EMAIL_DOMAIN}`));
		for (const row of stale) {
			if (row.createdAt > cutoff) continue;
			await cleanupFreshUser(row.id).catch(() => {
				// Best-effort -- another worker may already have reaped this row.
			});
		}
	} finally {
		await client.end();
	}
}

let reapPromise: Promise<void> | null = null;
async function reapOnce(): Promise<void> {
	if (reapPromise === null) reapPromise = reapStaleFreshUsers();
	return reapPromise;
}

// ---------------------------------------------------------------------------
// Per-test data seeders
// ---------------------------------------------------------------------------

export interface KnowledgeNodeCitationFixture {
	nodeId: string;
	nodeTitle: string;
}

export interface SeedKnowledgeNodeCitationOptions {
	referenceId: string;
	chapter: number;
	section?: number;
	title?: string;
	domain?: string;
}

/**
 * Insert a minimal `study.knowledge_node` row that carries a structured
 * handbook citation pointing at the given (referenceId, chapter[, section]).
 * Used by the handbook-reader citing-node round-trip test. Returns the row
 * id + a teardown closure that removes the row.
 */
export async function seedKnowledgeNodeCitation(
	options: SeedKnowledgeNodeCitationOptions,
): Promise<{ fixture: KnowledgeNodeCitationFixture; teardown: () => Promise<void> }> {
	const { client, db } = openConnection();
	try {
		const id = `e2e-fixture-${generateAuthId()}`;
		const title = options.title ?? `Fixture node citing chapter ${options.chapter}`;
		const domain = options.domain ?? 'weather';
		const locator: { chapter: number; section?: number } = { chapter: options.chapter };
		if (options.section !== undefined) locator.section = options.section;
		const citation = {
			kind: 'handbook',
			reference_id: options.referenceId,
			locator,
		};

		const now = new Date();
		await db.insert(knowledgeNode).values({
			id,
			title,
			domain,
			references: [citation],
			referencesV2Migrated: true,
			contentMd: '# Fixture node\n\nE2e fixture content.\n',
			seedOrigin: E2E_FIXTURE_DATA_ORIGIN,
			createdAt: now,
			updatedAt: now,
		});

		const teardown = async (): Promise<void> => {
			const cleanup = openConnection();
			try {
				await cleanup.db.delete(knowledgeNode).where(eq(knowledgeNode.id, id));
			} finally {
				await cleanup.client.end();
			}
		};

		return { fixture: { nodeId: id, nodeTitle: title }, teardown };
	} finally {
		await client.end();
	}
}

export interface PohReferenceFixture {
	referenceId: string;
	documentSlug: string;
	title: string;
}

export interface SeedPohReferenceOptions {
	documentSlug?: string;
	edition?: string;
	title?: string;
}

/**
 * Insert a `study.reference` row with `kind=poh` so the library landing
 * page surfaces the aircraft-spine card. Returns the row id and a teardown
 * closure. Used by the library-by-cert aircraft spine test, which needs at
 * least one `a.aircraft-card` link to follow but only cares that the row
 * resolves -- not which manufacturer it belongs to.
 *
 * Each call generates a unique `documentSlug` (unless the caller pins one)
 * so concurrent Playwright workers do not collide on the
 * `(document_slug, edition)` unique constraint. Teardown deletes the row
 * the seeder inserted.
 */
export async function seedPohReference(
	options: SeedPohReferenceOptions = {},
): Promise<{ fixture: PohReferenceFixture; teardown: () => Promise<void> }> {
	const { client, db } = openConnection();
	try {
		// Default to a per-call unique slug so concurrent workers don't race
		// on the (document_slug, edition) unique index. Slug must be 3..32
		// chars, kebab-case, lowercase alphanumeric (the seed validator's
		// regex). `e2e-poh-` (8 chars) + 26-char ULID = 34 -> truncate ULID
		// to 24 chars to stay under the cap.
		const documentSlug = options.documentSlug ?? `e2e-poh-${generateAuthId().slice(0, 24)}`;
		const edition = options.edition ?? 'aircraft-specific';
		const title = options.title ?? 'E2E fixture POH/AFM';
		const id = `ref_${generateAuthId()}`;
		const now = new Date();

		await db.insert(reference).values({
			id,
			kind: 'poh',
			documentSlug,
			edition,
			title,
			publisher: 'E2E fixture',
			subjects: ['aircraft-systems'],
			seedOrigin: E2E_FIXTURE_DATA_ORIGIN,
			createdAt: now,
			updatedAt: now,
		});

		const teardown = async (): Promise<void> => {
			const cleanup = openConnection();
			try {
				await cleanup.db.delete(reference).where(eq(reference.id, id));
			} finally {
				await cleanup.client.end();
			}
		};

		return { fixture: { referenceId: id, documentSlug, title }, teardown };
	} finally {
		await client.end();
	}
}

// ---------------------------------------------------------------------------
// Playwright fixture
// ---------------------------------------------------------------------------

export interface FreshUserFixtures {
	freshUser: FreshUser;
}

/**
 * `test` extended with a `freshUser` fixture. The fixture creates a unique
 * user before each test, authenticates the page (so subsequent navigations
 * inherit the cookie), and tears the user (and all user-scoped rows) down
 * after the test completes.
 *
 * The Playwright project loads a shared storage state from
 * `tests/e2e/.auth/learner.json`; we override `storageState` to an empty
 * object so the page starts unauthed and our fixture's login is the one
 * that captures the session.
 */
export const test = base.extend<FreshUserFixtures>({
	storageState: async ({}, use) => {
		// Empty storage state -- the freshUser fixture does its own login.
		// Without this override the chromium project's
		// `tests/e2e/.auth/learner.json` (Abby) would seed Abby's session
		// cookie into the context and the fresh user's later sign-in would
		// race against Abby's still-valid token.
		await use({ cookies: [], origins: [] });
	},

	freshUser: async ({ page, context }, use) => {
		await reapOnce();
		// Drop the better-auth per-IP rate-limit row so a long auth.spec
		// session doesn't lock out fresh-user logins. All e2e clients hit
		// the dev server from `127.0.0.1`, so the 5/min sign-in cap fills
		// quickly across specs; fresh-user logins were silently failing
		// with the form stuck on /login until this reset landed.
		const { clearAuthRateLimit } = await import('./auth-rate-limit');
		await clearAuthRateLimit();
		// Defensive: clear any cookies the project-level storageState may
		// have leaked into this context before our login attempt. The
		// `storageState` fixture override above should already do this, but
		// `clearCookies` is the belt-and-suspenders guarantee.
		await context.clearCookies();
		const user = await createFreshUser();
		try {
			await loginAsFreshUser(page, user);
			await use(user);
		} finally {
			await cleanupFreshUser(user.id);
		}
	},
});

export { expect };
