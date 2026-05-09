/**
 * YAML sidecar byte-stability integration check.
 *
 * Two consecutive `serializeSidecar` calls with the same DB state must
 * produce byte-identical text. The `export-overrides.ts` script depends
 * on this to be idempotent (success criterion in the WP spec). The sort
 * is on `external_id` so insertion order in the DB never affects the
 * output bytes.
 */

import { bauthUser } from '@ab/auth/schema';
import { INGEST_REVIEW } from '@ab/constants';
import { db } from '@ab/db/connection';
import { generateAuthId } from '@ab/utils';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { serializeSidecar } from '../../../../../scripts/ingest-review/yaml-sidecar';
import { handbookCaptionOrphanPlugin } from '../plugins/handbook-caption-orphan';
import { applyOverride, listOverridesWithIssues, upsertIssue } from '../queries';
import { ingestIssue } from '../schema';
import type { HandbookCaptionOrphanPayload, IssueInput, IssueRecord, YamlSidecarEntry } from '../types';

const TEST_USER_ID = generateAuthId();
const TEST_TAG = TEST_USER_ID.slice(-12);
const seededExternalIds = new Set<string>();

beforeAll(async () => {
	const now = new Date();
	await db
		.insert(bauthUser)
		.values({
			id: TEST_USER_ID,
			email: `yaml-stability-${TEST_USER_ID}@airboss.test`,
			emailVerified: false,
			name: 'YAML stability',
			firstName: 'Yaml',
			lastName: 'Stable',
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoNothing();
});

afterEach(async () => {
	if (seededExternalIds.size > 0) {
		await db.delete(ingestIssue).where(inArray(ingestIssue.externalId, [...seededExternalIds]));
		seededExternalIds.clear();
	}
});

afterAll(async () => {
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
});

const SLUG = `ystab_${TEST_TAG}`;
const EDITION = 'FAA-H-8083-15B';

async function seedResolvedIssue(suffix: string, page: number): Promise<string> {
	const externalId = `ystab_${TEST_TAG}_${suffix}`;
	seededExternalIds.add(externalId);
	const input: IssueInput = {
		corpus: INGEST_REVIEW.CORPUSES.HANDBOOK,
		sourceId: SLUG,
		edition: EDITION,
		pageNum: page,
		kind: INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN,
		externalId,
		payload: { captionText: `caption ${suffix}`, mode: 'unknown', sectionCode: '4', candidateSnapshot: [] },
	};
	const issue = await upsertIssue(input);
	await applyOverride({
		issueId: issue.id,
		action: {
			action: INGEST_REVIEW.ACTIONS.PAIR,
			payload: { figureId: `fig-${suffix}`, imagePage: page + 1, imageXref: 0 },
		},
		actorUserId: TEST_USER_ID,
	});
	return externalId;
}

async function buildSidecarText(): Promise<string> {
	const pairs = await listOverridesWithIssues({
		corpus: INGEST_REVIEW.CORPUSES.HANDBOOK,
		sourceId: SLUG,
	});
	const entries: YamlSidecarEntry[] = pairs.map(({ issue, override }) => {
		// Narrow to the plugin's typed payload shape -- the rows were seeded
		// through `handbookCaptionOrphanPlugin` one step earlier.
		const typedIssue = issue as IssueRecord<HandbookCaptionOrphanPayload>;
		return handbookCaptionOrphanPlugin.serializeForYaml(typedIssue, override);
	});
	return serializeSidecar({ slug: SLUG, edition: EDITION, overrides: entries });
}

describe('yaml-sidecar stability', () => {
	it('two consecutive serialise calls on the same DB state produce byte-identical output', async () => {
		await seedResolvedIssue('alpha', 83);
		await seedResolvedIssue('beta', 90);
		await seedResolvedIssue('gamma', 100);

		const a = await buildSidecarText();
		const b = await buildSidecarText();
		expect(a).toBe(b);
		expect(a.endsWith('\n')).toBe(true);
		// Trailing newline is single (no trailing whitespace block).
		expect(a.endsWith('\n\n')).toBe(false);
	});

	it('insertion order does not affect byte output (sort on external_id wins)', async () => {
		// Seed in increasing external_id order, capture YAML A.
		await seedResolvedIssue('aaa', 10);
		await seedResolvedIssue('bbb', 11);
		await seedResolvedIssue('ccc', 12);
		const a = await buildSidecarText();

		// Wipe + reseed in reverse insertion order.
		await db.delete(ingestIssue).where(inArray(ingestIssue.externalId, [...seededExternalIds]));
		seededExternalIds.clear();
		await seedResolvedIssue('ccc', 12);
		await seedResolvedIssue('bbb', 11);
		await seedResolvedIssue('aaa', 10);
		const b = await buildSidecarText();
		expect(a).toBe(b);
	});
});
