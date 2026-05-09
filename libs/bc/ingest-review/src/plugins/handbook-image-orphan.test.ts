/**
 * Image-orphan plugin unit tests. Mirror of caption-orphan with the
 * inverse action set; the live count of `figure-without-caption`
 * warnings is zero today, so the test fixture seeds one synthetic.
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { INGEST_REVIEW } from '@ab/constants';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InvalidActionPayloadError } from '../queries';
import type { HandbookImageOrphanPayload, IssueRecord, OverrideRecord } from '../types';
import { handbookImageOrphanPlugin } from './handbook-image-orphan';

let workspace: string;

beforeEach(async () => {
	workspace = path.join(tmpdir(), `airboss-img-orphan-${Date.now()}-${Math.random().toString(16).slice(2)}`);
	await mkdir(workspace, { recursive: true });
});

afterEach(async () => {
	if (workspace) await rm(workspace, { recursive: true, force: true });
});

async function seed(opts: { warnings: unknown }) {
	const dir = path.join(workspace, 'handbooks', 'avwx', 'FAA-H-8083-28B');
	await mkdir(dir, { recursive: true });
	await writeFile(path.join(dir, 'warnings.json'), JSON.stringify(opts.warnings), 'utf8');
	await writeFile(
		path.join(dir, 'manifest.json'),
		JSON.stringify({ document_slug: 'avwx', edition: 'FAA-H-8083-28B', figures: [] }),
		'utf8',
	);
}

describe('handbookImageOrphanPlugin.produceIssues', () => {
	it('yields one issue per figure-without-caption entry', async () => {
		await seed({
			warnings: {
				document_slug: 'avwx',
				edition: 'FAA-H-8083-28B',
				warnings: [
					{
						id: 'img-001',
						code: 'figure-without-caption',
						section_code: '5.2',
						message: 'Image on page 7 (index 3, 480x320) had no paired caption.',
					},
				],
			},
		});
		const out: unknown[] = [];
		for await (const issue of handbookImageOrphanPlugin.produceIssues({
			corpus: INGEST_REVIEW.CORPUSES.HANDBOOK,
			repoRoot: workspace,
		})) {
			out.push(issue);
		}
		expect(out).toHaveLength(1);
		expect(out[0]).toMatchObject({
			kind: INGEST_REVIEW.KINDS.HANDBOOK_IMAGE_ORPHAN,
			externalId: 'img-001',
			pageNum: 7,
			payload: {
				imageIndex: 3,
				width: 480,
				height: 320,
				sectionCode: '5.2',
			},
		});
	});

	it('returns the empty stream when there are no image orphans', async () => {
		await seed({
			warnings: {
				document_slug: 'avwx',
				edition: 'FAA-H-8083-28B',
				warnings: [{ id: 'cap', code: 'caption-without-figure', section_code: '5', message: 'on page 1' }],
			},
		});
		const out: unknown[] = [];
		for await (const issue of handbookImageOrphanPlugin.produceIssues({
			corpus: INGEST_REVIEW.CORPUSES.HANDBOOK,
			repoRoot: workspace,
		})) {
			out.push(issue);
		}
		expect(out).toHaveLength(0);
	});
});

describe('handbookImageOrphanPlugin.validateAction', () => {
	const stubIssue: IssueRecord<HandbookImageOrphanPayload> = {
		id: 'isiss_x',
		corpus: INGEST_REVIEW.CORPUSES.HANDBOOK,
		sourceId: 'avwx',
		edition: 'FAA-H-8083-28B',
		pageNum: 7,
		kind: INGEST_REVIEW.KINDS.HANDBOOK_IMAGE_ORPHAN,
		externalId: 'img-001',
		payload: { imageIndex: 3, width: 480, height: 320, sectionCode: '5.2', candidateSnapshot: [] },
		status: 'unresolved',
		firstSeenAt: new Date(),
		lastSeenAt: new Date(),
	};

	it("accepts 'pair' with captionExternalId + captionPage", () => {
		expect(() =>
			handbookImageOrphanPlugin.validateAction(stubIssue, {
				action: INGEST_REVIEW.ACTIONS.PAIR,
				payload: { captionExternalId: 'cap-1', captionPage: 7 },
			}),
		).not.toThrow();
	});

	it("rejects 'pair' with missing captionExternalId", () => {
		expect(() =>
			handbookImageOrphanPlugin.validateAction(stubIssue, {
				action: INGEST_REVIEW.ACTIONS.PAIR,
				payload: { captionPage: 7 },
			}),
		).toThrow(InvalidActionPayloadError);
	});

	it("accepts 'mark-extraneous' / 'mark-decorative'", () => {
		expect(() =>
			handbookImageOrphanPlugin.validateAction(stubIssue, {
				action: INGEST_REVIEW.ACTIONS.MARK_EXTRANEOUS,
				payload: {},
			}),
		).not.toThrow();
		expect(() =>
			handbookImageOrphanPlugin.validateAction(stubIssue, {
				action: INGEST_REVIEW.ACTIONS.MARK_DECORATIVE,
				payload: {},
			}),
		).not.toThrow();
	});

	it("rejects 'mark-no-figure' (caption-orphan-only action)", () => {
		expect(() =>
			handbookImageOrphanPlugin.validateAction(stubIssue, {
				action: INGEST_REVIEW.ACTIONS.MARK_NO_FIGURE,
				payload: {},
			}),
		).toThrow(InvalidActionPayloadError);
	});
});

describe('handbookImageOrphanPlugin.serializeForYaml', () => {
	it('shapes an override into a YamlSidecarEntry', () => {
		const issue: IssueRecord<HandbookImageOrphanPayload> = {
			id: 'isiss_x',
			corpus: INGEST_REVIEW.CORPUSES.HANDBOOK,
			sourceId: 'avwx',
			edition: 'FAA-H-8083-28B',
			pageNum: 7,
			kind: INGEST_REVIEW.KINDS.HANDBOOK_IMAGE_ORPHAN,
			externalId: 'img-001',
			payload: { imageIndex: 3, width: 480, height: 320, sectionCode: '5.2', candidateSnapshot: [] },
			status: 'resolved',
			firstSeenAt: new Date(),
			lastSeenAt: new Date(),
		};
		const override: OverrideRecord = {
			id: 'iover_x',
			issueId: issue.id,
			action: INGEST_REVIEW.ACTIONS.PAIR,
			payload: { captionExternalId: 'cap-1', captionPage: 7 },
			createdByUserId: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		};
		expect(handbookImageOrphanPlugin.serializeForYaml(issue, override)).toEqual({
			external_id: 'img-001',
			kind: INGEST_REVIEW.KINDS.HANDBOOK_IMAGE_ORPHAN,
			action: INGEST_REVIEW.ACTIONS.PAIR,
			payload: { captionExternalId: 'cap-1', captionPage: 7 },
		});
	});
});
