/**
 * Image-orphan end-to-end round-trip.
 *
 * Mirror of `caption-orphan-roundtrip.test.ts` for the inverse direction:
 * an image with no caption gets paired against an unpaired caption from
 * the same handbook. Live count is zero today; the test seeds one
 * synthetic warning per the WP design.
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
import { parseSidecar, serializeSidecar } from '../../../../../scripts/ingest-review/yaml-sidecar';
import { registerPlugin, resetPluginRegistry } from '../plugin';
import { handbookImageOrphanPlugin } from '../plugins/handbook-image-orphan';
import { runProducers } from '../producer';
import { applyOverride, getCurrentOverride, getIssue, listOverridesWithIssues } from '../queries';
import { ingestIssue } from '../schema';
import type { HandbookImageOrphanPayload, ImageOrphanPairPayload, IssueRecord, YamlSidecarEntry } from '../types';

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
			email: `image-roundtrip-${TEST_USER_ID}@airboss.test`,
			emailVerified: false,
			name: 'Image roundtrip',
			firstName: 'Image',
			lastName: 'Roundtrip',
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoNothing();
});

beforeEach(async () => {
	workspace = path.join(tmpdir(), `airboss-img-rt-${Date.now()}-${Math.random().toString(16).slice(2)}`);
	await mkdir(workspace, { recursive: true });
	resetPluginRegistry();
	registerPlugin(handbookImageOrphanPlugin);
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
const SLUG = `phak_${TEST_TAG}`;
const EDITION = 'FAA-H-8083-25C';

interface FixtureWarning {
	id: string;
	code: string;
	section_code: string | null;
	message: string;
}

async function seedFixture(warnings: FixtureWarning[]): Promise<void> {
	const dir = path.join(workspace, 'handbooks', SLUG, EDITION);
	await mkdir(dir, { recursive: true });
	await writeFile(
		path.join(dir, 'warnings.json'),
		JSON.stringify(
			{
				schema_version: 1,
				document_slug: SLUG,
				edition: EDITION,
				manifest_sha256: 'feedface',
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

function trackExternalId(id: string): string {
	seededExternalIds.add(id);
	return id;
}

describe('image-orphan integration round-trip', () => {
	it('produces synthetic image-orphan, pairs to nearby caption, exports + reimports stable YAML', async () => {
		const imageId = trackExternalId(`img_${TEST_TAG}_a`);
		const captionId = trackExternalId(`cap_${TEST_TAG}_a`);
		await seedFixture([
			{
				id: imageId,
				code: 'figure-without-caption',
				section_code: '6',
				message: 'Image on page 7 (index 3, 480x320) had no paired caption.',
			},
			{
				id: captionId,
				code: 'caption-without-figure',
				section_code: '6',
				message: 'Caption `Figure 6-2. Static port detail.` on page 7 had no paired image.',
			},
		]);

		await runProducers({
			corpus: INGEST_REVIEW.CORPUSES.HANDBOOK,
			repoRoot: workspace,
			sourceId: SLUG,
			kind: INGEST_REVIEW.KINDS.HANDBOOK_IMAGE_ORPHAN,
		});
		const rows = await db.select().from(ingestIssue).where(eq(ingestIssue.externalId, imageId));
		expect(rows).toHaveLength(1);
		const issueId = rows[0]?.id ?? '';
		expect(rows[0]?.kind).toBe(INGEST_REVIEW.KINDS.HANDBOOK_IMAGE_ORPHAN);

		const pairPayload: ImageOrphanPairPayload = { captionExternalId: captionId, captionPage: 7 };
		await applyOverride({
			issueId,
			action: { action: INGEST_REVIEW.ACTIONS.PAIR, payload: pairPayload },
			actorUserId: TEST_USER_ID,
		});
		const after = await getIssue(issueId);
		expect(after.status).toBe(INGEST_REVIEW.STATUS.RESOLVED);

		// Round-trip the YAML sidecar.
		const pairs = await listOverridesWithIssues({
			corpus: INGEST_REVIEW.CORPUSES.HANDBOOK,
			sourceId: SLUG,
		});
		const yamlEntries: YamlSidecarEntry[] = pairs.map(({ issue, override }) => {
			// Narrow the BC's unknown-payload row to the plugin's typed shape;
			// safe in test scope because we seeded the row through the
			// image-orphan plugin one step earlier.
			const typedIssue = issue as IssueRecord<HandbookImageOrphanPayload>;
			return handbookImageOrphanPlugin.serializeForYaml(typedIssue, override);
		});
		const yamlText = serializeSidecar({ slug: SLUG, edition: EDITION, overrides: yamlEntries });
		expect(yamlText).toContain(captionId);

		const parsed = parseSidecar(yamlText);
		expect(parsed.overrides[0]?.action).toBe(INGEST_REVIEW.ACTIONS.PAIR);
		expect(parsed.overrides[0]?.payload).toMatchObject({ captionExternalId: captionId, captionPage: 7 });
	});

	it('mark-extraneous resolves with empty payload and round-trips', async () => {
		const imageId = trackExternalId(`img_${TEST_TAG}_b`);
		await seedFixture([
			{
				id: imageId,
				code: 'figure-without-caption',
				section_code: '6',
				message: 'Image on page 7 (index 99, 80x80) had no paired caption.',
			},
		]);

		await runProducers({
			corpus: INGEST_REVIEW.CORPUSES.HANDBOOK,
			repoRoot: workspace,
			sourceId: SLUG,
			kind: INGEST_REVIEW.KINDS.HANDBOOK_IMAGE_ORPHAN,
		});
		const rows = await db.select().from(ingestIssue).where(eq(ingestIssue.externalId, imageId));
		const issueId = rows[0]?.id ?? '';
		await applyOverride({
			issueId,
			action: { action: INGEST_REVIEW.ACTIONS.MARK_EXTRANEOUS, payload: {} },
			actorUserId: TEST_USER_ID,
		});
		const override = await getCurrentOverride(issueId);
		expect(override?.action).toBe(INGEST_REVIEW.ACTIONS.MARK_EXTRANEOUS);
		expect(override?.payload).toEqual({});
	});
});
