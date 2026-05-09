/**
 * Caption-orphan plugin unit tests. Pure-function coverage of the
 * producer + candidate finder + action validator + YAML serializer.
 *
 * The producer reads from a tmp filesystem so the test never touches
 * the live `handbooks/` tree.
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { INGEST_REVIEW } from '@ab/constants';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InvalidActionPayloadError } from '../queries';
import type { HandbookCaptionOrphanPayload, IssueRecord, OverrideRecord } from '../types';
import { handbookCaptionOrphanPlugin } from './handbook-caption-orphan';

let workspace: string;

beforeEach(async () => {
	workspace = path.join(tmpdir(), `airboss-cap-orphan-${Date.now()}-${Math.random().toString(16).slice(2)}`);
	await mkdir(workspace, { recursive: true });
});

afterEach(async () => {
	if (workspace) await rm(workspace, { recursive: true, force: true });
});

async function seedFixture(opts: {
	slug: string;
	edition: string;
	warnings: unknown;
	manifest: unknown;
}): Promise<void> {
	const dir = path.join(workspace, 'handbooks', opts.slug, opts.edition);
	await mkdir(dir, { recursive: true });
	await writeFile(path.join(dir, 'warnings.json'), JSON.stringify(opts.warnings), 'utf8');
	await writeFile(path.join(dir, 'manifest.json'), JSON.stringify(opts.manifest), 'utf8');
}

async function collectIssues(corpus = INGEST_REVIEW.CORPUSES.HANDBOOK): Promise<unknown[]> {
	const out: unknown[] = [];
	for await (const issue of handbookCaptionOrphanPlugin.produceIssues({ corpus, repoRoot: workspace })) {
		out.push(issue);
	}
	return out;
}

describe('handbookCaptionOrphanPlugin.produceIssues', () => {
	it('yields one issue per caption-without-figure entry', async () => {
		await seedFixture({
			slug: 'ifh',
			edition: 'FAA-H-8083-15B',
			warnings: {
				document_slug: 'ifh',
				edition: 'FAA-H-8083-15B',
				warnings: [
					{
						id: 'aaa111',
						code: 'caption-without-figure',
						section_code: '4',
						message:
							'Caption `Figure 4-7. Koch chart.` on page 83 had no paired image. -> mode: image-extracted-elsewhere',
					},
					{
						id: 'bbb222',
						code: 'caption-without-figure',
						section_code: '4',
						message:
							'Caption `Figure 4-9. Spin entry.` on page 90 had no paired image. -> mode: image-extracted-elsewhere',
					},
				],
			},
			manifest: { document_slug: 'ifh', edition: 'FAA-H-8083-15B', figures: [] },
		});
		const issues = await collectIssues();
		expect(issues).toHaveLength(2);
		expect(issues[0]).toMatchObject({
			corpus: INGEST_REVIEW.CORPUSES.HANDBOOK,
			sourceId: 'ifh',
			edition: 'FAA-H-8083-15B',
			pageNum: 83,
			kind: INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN,
			externalId: 'aaa111',
		});
	});

	it('yields nothing when there are no caption-without-figure rows', async () => {
		await seedFixture({
			slug: 'phak',
			edition: 'FAA-H-8083-25C',
			warnings: {
				document_slug: 'phak',
				edition: 'FAA-H-8083-25C',
				warnings: [{ id: 'x', code: 'empty-section-kept', section_code: null, message: 'kept empty' }],
			},
			manifest: { document_slug: 'phak', edition: 'FAA-H-8083-25C', figures: [] },
		});
		const issues = await collectIssues();
		expect(issues).toHaveLength(0);
	});

	it('does not run when corpus !== handbook', async () => {
		await seedFixture({
			slug: 'ifh',
			edition: 'FAA-H-8083-15B',
			warnings: {
				document_slug: 'ifh',
				edition: 'FAA-H-8083-15B',
				warnings: [{ id: 'aaa', code: 'caption-without-figure', section_code: '4', message: 'on page 1' }],
			},
			manifest: { document_slug: 'ifh', edition: 'FAA-H-8083-15B', figures: [] },
		});
		const issues = await collectIssues(INGEST_REVIEW.CORPUSES.REGS);
		expect(issues).toHaveLength(0);
	});

	it('embeds the candidate snapshot from manifest figures within page +- 2', async () => {
		await seedFixture({
			slug: 'ifh',
			edition: 'FAA-H-8083-15B',
			warnings: {
				document_slug: 'ifh',
				edition: 'FAA-H-8083-15B',
				warnings: [
					{
						id: 'aaa',
						code: 'caption-without-figure',
						section_code: '4',
						message: 'Caption `Figure 4-7.` on page 83 had no paired image. -> mode: image-extracted-elsewhere',
					},
				],
			},
			manifest: {
				document_slug: 'ifh',
				edition: 'FAA-H-8083-15B',
				figures: [
					{
						id: 'fig-on-82',
						section_code: '4',
						ordinal: 0,
						caption: 'on 82',
						asset_path: 'a/b.png',
						width: 100,
						height: 100,
						caption_page_num: 82,
					},
					{
						id: 'fig-on-100',
						section_code: '4',
						ordinal: 0,
						caption: 'on 100',
						asset_path: 'c/d.png',
						width: 100,
						height: 100,
						caption_page_num: 100,
					},
				],
			},
		});
		const issues = (await collectIssues()) as Array<{ payload: HandbookCaptionOrphanPayload }>;
		expect(issues).toHaveLength(1);
		const first = issues[0];
		expect(first).toBeDefined();
		const snapshot = first?.payload.candidateSnapshot ?? [];
		expect(snapshot.map((c) => c.figureId)).toEqual(['fig-on-82']);
	});
});

describe('handbookCaptionOrphanPlugin.validateAction', () => {
	const stubIssue: IssueRecord<HandbookCaptionOrphanPayload> = {
		id: 'isiss_test',
		corpus: INGEST_REVIEW.CORPUSES.HANDBOOK,
		sourceId: 'ifh',
		edition: 'FAA-H-8083-15B',
		pageNum: 83,
		kind: INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN,
		externalId: 'aaa',
		payload: { captionText: 'x', mode: 'x', sectionCode: 'x', candidateSnapshot: [] },
		status: 'unresolved',
		firstSeenAt: new Date(),
		lastSeenAt: new Date(),
	};

	it("accepts 'pair' with imagePage / imageXref / figureId", () => {
		expect(() =>
			handbookCaptionOrphanPlugin.validateAction(stubIssue, {
				action: INGEST_REVIEW.ACTIONS.PAIR,
				payload: { imagePage: 82, imageXref: 1234, figureId: 'fig-1' },
			}),
		).not.toThrow();
	});

	it("rejects 'pair' missing imageXref", () => {
		expect(() =>
			handbookCaptionOrphanPlugin.validateAction(stubIssue, {
				action: INGEST_REVIEW.ACTIONS.PAIR,
				payload: { imagePage: 82, figureId: 'fig-1' },
			}),
		).toThrow(InvalidActionPayloadError);
	});

	it("accepts 'mark-no-figure' with empty payload", () => {
		expect(() =>
			handbookCaptionOrphanPlugin.validateAction(stubIssue, {
				action: INGEST_REVIEW.ACTIONS.MARK_NO_FIGURE,
				payload: {},
			}),
		).not.toThrow();
	});

	it('rejects an action that belongs to a different kind', () => {
		expect(() =>
			handbookCaptionOrphanPlugin.validateAction(stubIssue, {
				action: INGEST_REVIEW.ACTIONS.MARK_DECORATIVE,
				payload: {},
			}),
		).toThrow(InvalidActionPayloadError);
	});
});

describe('handbookCaptionOrphanPlugin.serializeForYaml', () => {
	it('shapes an override into the documented YAML entry', () => {
		const issue: IssueRecord<HandbookCaptionOrphanPayload> = {
			id: 'isiss_x',
			corpus: INGEST_REVIEW.CORPUSES.HANDBOOK,
			sourceId: 'ifh',
			edition: 'FAA-H-8083-15B',
			pageNum: 83,
			kind: INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN,
			externalId: 'aaa',
			payload: { captionText: 'x', mode: 'x', sectionCode: 'x', candidateSnapshot: [] },
			status: 'resolved',
			firstSeenAt: new Date(),
			lastSeenAt: new Date(),
		};
		const override: OverrideRecord = {
			id: 'iover_x',
			issueId: issue.id,
			action: INGEST_REVIEW.ACTIONS.PAIR,
			payload: { imagePage: 82, imageXref: 1234, figureId: 'fig-1' },
			createdByUserId: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		};
		const entry = handbookCaptionOrphanPlugin.serializeForYaml(issue, override);
		expect(entry).toMatchObject({
			external_id: 'aaa',
			kind: INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN,
			action: INGEST_REVIEW.ACTIONS.PAIR,
			payload: { imagePage: 82, imageXref: 1234, figureId: 'fig-1' },
		});
	});
});
