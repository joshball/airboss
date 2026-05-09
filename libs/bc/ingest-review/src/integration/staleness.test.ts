/**
 * Staleness lifecycle integration check.
 *
 * Walks `unresolved -> resolved -> stale -> resolved` against a fresh
 * tmp `handbooks/<slug>/<edition>/` tree:
 *
 *   1. Fixture A (one warning)            -> producer emits issue (unresolved)
 *   2. applyOverride('pair', ...)         -> resolved; override row written
 *   3. Fixture B (no warnings)            -> producer flips issue to stale
 *      (override survives)
 *   4. Fixture A again (warning re-emerges) -> producer flips status back to
 *      `unresolved` (the override survives but the queue surfaces it again
 *      so the human can confirm it still applies). The override row remains.
 *
 * The contract this guards: the override row never disappears as a side
 * effect of producer churn. Authorial intent is durable; producer runs
 * are observations.
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { bauthUser } from '@ab/auth/schema';
import { INGEST_REVIEW } from '@ab/constants';
import { db } from '@ab/db/connection';
import { generateAuthId } from '@ab/utils';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { registerPlugin, resetPluginRegistry } from '../plugin';
import { handbookCaptionOrphanPlugin } from '../plugins/handbook-caption-orphan';
import { runProducers } from '../producer';
import { applyOverride, getCurrentOverride, getIssue } from '../queries';
import { ingestIssue } from '../schema';

const TEST_USER_ID = generateAuthId();
const TEST_TAG = TEST_USER_ID.slice(-12);
let workspace: string;
const seededExternalIds = new Set<string>();

beforeAll(async () => {
	const now = new Date();
	await db
		.insert(bauthUser)
		.values({
			id: TEST_USER_ID,
			email: `staleness-${TEST_USER_ID}@airboss.test`,
			emailVerified: false,
			name: 'Staleness test',
			firstName: 'Staleness',
			lastName: 'Test',
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoNothing();
});

beforeEach(async () => {
	workspace = path.join(tmpdir(), `airboss-stale-${Date.now()}-${Math.random().toString(16).slice(2)}`);
	await mkdir(workspace, { recursive: true });
	resetPluginRegistry();
	registerPlugin(handbookCaptionOrphanPlugin);
});

afterEach(async () => {
	if (workspace) await rm(workspace, { recursive: true, force: true });
	resetPluginRegistry();
	if (seededExternalIds.size > 0) {
		await db.delete(ingestIssue).where(inArray(ingestIssue.externalId, [...seededExternalIds]));
		seededExternalIds.clear();
	}
});

afterAll(async () => {
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
});

// Per-test source slug so parallel test files never collide on
// `(corpus, sourceId)` listings against the shared dev DB.
const SLUG = `ifh_${TEST_TAG}`;
const EDITION = 'FAA-H-8083-15B';

async function seedFixture(
	warnings: ReadonlyArray<{ id: string; code: string; section_code: string | null; message: string }>,
): Promise<void> {
	const dir = path.join(workspace, 'handbooks', SLUG, EDITION);
	await mkdir(dir, { recursive: true });
	await writeFile(
		path.join(dir, 'warnings.json'),
		JSON.stringify(
			{
				schema_version: 1,
				document_slug: SLUG,
				edition: EDITION,
				manifest_sha256: 'beadface',
				generated_at: new Date().toISOString(),
				warnings,
			},
			null,
			2,
		),
		'utf8',
	);
	await writeFile(
		path.join(dir, 'manifest.json'),
		JSON.stringify({ document_slug: SLUG, edition: EDITION, figures: [] }, null, 2),
		'utf8',
	);
}

describe('staleness lifecycle', () => {
	it('walks unresolved -> resolved -> stale -> unresolved without dropping the override', async () => {
		const externalId = `stale_${TEST_TAG}_full`;
		seededExternalIds.add(externalId);
		const fixtureA = [
			{
				id: externalId,
				code: 'caption-without-figure',
				section_code: '4',
				message: 'Caption `Figure 4-7. Test.` on page 80 had no paired image.',
			},
		];
		await seedFixture(fixtureA);
		await runProducers({
			corpus: INGEST_REVIEW.CORPUSES.HANDBOOK,
			repoRoot: workspace,
			sourceId: SLUG,
		});
		const rows = await db.select().from(ingestIssue).where(eq(ingestIssue.externalId, externalId));
		const issueId = rows[0]?.id ?? '';
		expect(rows[0]?.status).toBe(INGEST_REVIEW.STATUS.UNRESOLVED);

		await applyOverride({
			issueId,
			action: {
				action: INGEST_REVIEW.ACTIONS.PAIR,
				payload: { imagePage: 81, imageXref: 0, figureId: 'fig-4-7' },
			},
			actorUserId: TEST_USER_ID,
		});
		expect((await getIssue(issueId)).status).toBe(INGEST_REVIEW.STATUS.RESOLVED);

		// Disappear the warning. Producer flips status to stale; override survives.
		await seedFixture([]);
		await runProducers({
			corpus: INGEST_REVIEW.CORPUSES.HANDBOOK,
			repoRoot: workspace,
			sourceId: SLUG,
		});
		expect((await getIssue(issueId)).status).toBe(INGEST_REVIEW.STATUS.STALE);
		expect(await getCurrentOverride(issueId)).not.toBeNull();

		// Warning re-emerges. Producer flips status back to unresolved
		// (the human re-confirms whether the override still applies).
		// The override row stays attached.
		await seedFixture(fixtureA);
		await runProducers({
			corpus: INGEST_REVIEW.CORPUSES.HANDBOOK,
			repoRoot: workspace,
			sourceId: SLUG,
		});
		expect((await getIssue(issueId)).status).toBe(INGEST_REVIEW.STATUS.UNRESOLVED);
		expect(await getCurrentOverride(issueId)).not.toBeNull();
	});
});
