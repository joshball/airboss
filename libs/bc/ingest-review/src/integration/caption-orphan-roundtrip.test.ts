/**
 * Caption-orphan end-to-end round-trip.
 *
 * Walks the full path against a tmp `handbooks/<slug>/<edition>/` tree:
 *
 *   1. `runProducers` reads `warnings.json` + `manifest.json` -> issue row
 *   2. `applyOverride('pair', ...)` writes the override + flips status
 *   3. `serializeSidecar` (via the YAML helper) emits the per-source YAML
 *   4. `parseSidecar` re-parses the YAML and `applyOverride` re-creates
 *      the override against a synthetic issue (the import-overrides flow)
 *   5. Re-running the producer with the same fixture is a no-op
 *
 * The figures.py overrides_loader Python piece is exercised in
 * `tools/handbook-ingest/tests/test_overrides_loader.py`; this TS suite
 * covers the BC <-> YAML symmetry the figures.py loader assumes.
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
import { handbookCaptionOrphanPlugin } from '../plugins/handbook-caption-orphan';
import { runProducers } from '../producer';
import { applyOverride, getCurrentOverride, getIssue, listOverridesWithIssues, upsertIssue } from '../queries';
import { ingestIssue } from '../schema';
import type {
	CaptionOrphanPairPayload,
	HandbookCaptionOrphanPayload,
	IssueInput,
	IssueRecord,
	YamlSidecarEntry,
} from '../types';

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
			email: `caption-roundtrip-${TEST_USER_ID}@airboss.test`,
			emailVerified: false,
			name: 'Caption roundtrip',
			firstName: 'Caption',
			lastName: 'Roundtrip',
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoNothing();
});

beforeEach(async () => {
	workspace = path.join(tmpdir(), `airboss-cap-rt-${Date.now()}-${Math.random().toString(16).slice(2)}`);
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

// Per-test source slug so parallel test files (caption + image roundtrip,
// staleness) never collide on `(corpus, sourceId)` listings against the
// shared dev DB.
const SLUG = `ifh_${TEST_TAG}`;
const EDITION = 'FAA-H-8083-15B';

interface FixtureWarning {
	id: string;
	code: string;
	section_code: string | null;
	message: string;
}

interface FixtureFigure {
	id: string;
	section_code: string;
	ordinal: number;
	caption: string;
	asset_path: string;
	width: number;
	height: number;
	caption_page_num: number;
}

async function seedFixture(opts: { warnings: FixtureWarning[]; figures: FixtureFigure[] }): Promise<void> {
	const dir = path.join(workspace, 'handbooks', SLUG, EDITION);
	await mkdir(dir, { recursive: true });
	await writeFile(
		path.join(dir, 'warnings.json'),
		JSON.stringify(
			{
				schema_version: 1,
				document_slug: SLUG,
				edition: EDITION,
				manifest_sha256: 'deadbeef',
				generated_at: new Date().toISOString(),
				warnings: opts.warnings,
			},
			null,
			2,
		),
		'utf8',
	);
	await writeFile(
		path.join(dir, 'manifest.json'),
		JSON.stringify(
			{
				document_slug: SLUG,
				edition: EDITION,
				figures: opts.figures,
			},
			null,
			2,
		),
		'utf8',
	);
}

function trackExternalId(id: string): string {
	seededExternalIds.add(id);
	return id;
}

describe('caption-orphan integration round-trip', () => {
	it('producer -> applyOverride -> YAML serialize -> parseSidecar -> re-apply preserves the action', async () => {
		const warningId = trackExternalId(`warn_${TEST_TAG}_a`);
		await seedFixture({
			warnings: [
				{
					id: warningId,
					code: 'caption-without-figure',
					section_code: '4',
					message:
						'Caption `Figure 4-7. Koch chart sample.` on page 83 had no paired image. -> mode: image-extracted-elsewhere',
				},
			],
			figures: [
				{
					id: 'fig-4-7-00',
					section_code: '4',
					ordinal: 7,
					caption: 'Koch chart',
					asset_path: 'handbooks/ifh/FAA-H-8083-15B/figures/04-07-00.png',
					width: 1024,
					height: 768,
					caption_page_num: 84,
				},
			],
		});

		// 1. Run the producer. Issue row appears.
		const result = await runProducers({
			corpus: INGEST_REVIEW.CORPUSES.HANDBOOK,
			repoRoot: workspace,
			sourceId: SLUG,
		});
		expect(result.totalUpserted).toBe(1);

		const beforeIssue = await db.select().from(ingestIssue).where(eq(ingestIssue.externalId, warningId));
		expect(beforeIssue).toHaveLength(1);
		const issueId = beforeIssue[0]?.id ?? '';
		expect(issueId).toMatch(/^isiss_/);

		// 2. Apply override with the matching figure.
		const pairPayload: CaptionOrphanPairPayload = {
			imagePage: 84,
			imageXref: 0,
			figureId: 'fig-4-7-00',
		};
		await applyOverride({
			issueId,
			action: { action: INGEST_REVIEW.ACTIONS.PAIR, payload: pairPayload },
			actorUserId: TEST_USER_ID,
		});
		const afterIssue = await getIssue(issueId);
		expect(afterIssue.status).toBe(INGEST_REVIEW.STATUS.RESOLVED);

		// 3. Serialise the YAML sidecar from the override + plugin.
		const pairs = await listOverridesWithIssues({
			corpus: INGEST_REVIEW.CORPUSES.HANDBOOK,
			sourceId: SLUG,
		});
		const yamlEntries: YamlSidecarEntry[] = pairs.map(({ issue, override }) => {
			// Narrow the BC's unknown-payload row to the plugin's typed payload
			// shape. Safe within this test scope because we just emitted the
			// row from the caption-orphan plugin one step earlier.
			const typedIssue = issue as IssueRecord<HandbookCaptionOrphanPayload>;
			return handbookCaptionOrphanPlugin.serializeForYaml(typedIssue, override);
		});
		const yamlText = serializeSidecar({ slug: SLUG, edition: EDITION, overrides: yamlEntries });
		expect(yamlText).toContain(warningId);
		expect(yamlText).toContain('fig-4-7-00');

		// 4. Re-parse + re-apply against a fresh synthetic issue (the
		//    `import-overrides` flow against a wiped DB).
		const parsed = parseSidecar(yamlText);
		expect(parsed.overrides).toHaveLength(1);

		// Wipe the issue + its override (FK cascade) and re-import.
		await db.delete(ingestIssue).where(eq(ingestIssue.id, issueId));

		for (const entry of parsed.overrides) {
			const synthetic: IssueInput = {
				corpus: INGEST_REVIEW.CORPUSES.HANDBOOK,
				sourceId: SLUG,
				edition: EDITION,
				pageNum: null,
				kind: entry.kind,
				externalId: entry.external_id,
				payload: { source: 'sidecar-import' },
			};
			const issue = await upsertIssue(synthetic);
			await applyOverride({
				issueId: issue.id,
				action: { action: entry.action, payload: entry.payload },
				actorUserId: null,
			});
			const overrideAfter = await getCurrentOverride(issue.id);
			expect(overrideAfter?.action).toBe(INGEST_REVIEW.ACTIONS.PAIR);
		}

		// 5. Re-running the producer with the same fixture is a no-op
		//    (status stays RESOLVED because the override row survives the upsert).
		const second = await runProducers({
			corpus: INGEST_REVIEW.CORPUSES.HANDBOOK,
			repoRoot: workspace,
			sourceId: SLUG,
		});
		expect(second.totalUpserted).toBe(1);
		const finalIssueRow = await db.select().from(ingestIssue).where(eq(ingestIssue.externalId, warningId));
		expect(finalIssueRow[0]?.status).toBe(INGEST_REVIEW.STATUS.RESOLVED);
	});

	it('post-fix re-extract that removes the warning flips the issue to stale, override survives', async () => {
		const warningId = trackExternalId(`warn_${TEST_TAG}_stale`);
		await seedFixture({
			warnings: [
				{
					id: warningId,
					code: 'caption-without-figure',
					section_code: '4',
					message: 'Caption `Figure 4-9. Spin entry.` on page 90 had no paired image.',
				},
			],
			figures: [],
		});
		await runProducers({
			corpus: INGEST_REVIEW.CORPUSES.HANDBOOK,
			repoRoot: workspace,
			sourceId: SLUG,
		});
		const issueRows = await db.select().from(ingestIssue).where(eq(ingestIssue.externalId, warningId));
		const issueId = issueRows[0]?.id ?? '';
		await applyOverride({
			issueId,
			action: {
				action: INGEST_REVIEW.ACTIONS.PAIR,
				payload: { imagePage: 90, imageXref: 0, figureId: 'fig-4-9-00' },
			},
			actorUserId: TEST_USER_ID,
		});

		// Re-extract emits an empty warnings file (the orphan is gone).
		await seedFixture({ warnings: [], figures: [] });
		await runProducers({
			corpus: INGEST_REVIEW.CORPUSES.HANDBOOK,
			repoRoot: workspace,
			sourceId: SLUG,
		});
		const afterIssue = await getIssue(issueId);
		expect(afterIssue.status).toBe(INGEST_REVIEW.STATUS.STALE);
		const overrideAfter = await getCurrentOverride(issueId);
		expect(overrideAfter).not.toBeNull();
	});
});
