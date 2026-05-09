/**
 * `handbook.image-orphan` plugin.
 *
 * Symmetric counterpart to caption-orphan: an extracted image with no
 * paired caption. Producer reads `figure-without-caption` warnings;
 * candidate finder lists unpaired captions in the page-window; action
 * handler binds an image to a chosen caption (or marks the image as
 * extraneous / decorative).
 *
 * Today's live count is zero -- the figure-pairing fix landed before the
 * queue did. The plugin still ships in v1 so the abstraction is forced
 * to handle "needs a caption" alongside "needs an image"; the
 * integration test seeds one synthetic warning to prove the loop.
 *
 * @browser-globals: server-only -- never imported by client .svelte
 */

import { INGEST_CANDIDATE_PAGE_WINDOW, INGEST_REVIEW, type IngestIssueKind } from '@ab/constants';
import { InvalidActionPayloadError } from '../queries';
import type {
	ActionInput,
	Candidate,
	CandidateContext,
	HandbookCaptionCandidate,
	HandbookImageOrphanPayload,
	ImageOrphanPairPayload,
	IngestIssuePlugin,
	IssueInput,
	IssueRecord,
	OverrideRecord,
	ProducerContext,
	YamlSidecarEntry,
} from '../types';
import {
	extractImageStats,
	extractPageNumber,
	listHandbookEditions,
	readWarnings,
	type WarningEntry,
} from './handbook-shared';

const KIND: IngestIssueKind = INGEST_REVIEW.KINDS.HANDBOOK_IMAGE_ORPHAN;
const CORPUS = INGEST_REVIEW.CORPUSES.HANDBOOK;
const FIGURE_WITHOUT_CAPTION_CODE = 'figure-without-caption';

async function* produceIssues(ctx: ProducerContext): AsyncIterable<IssueInput<HandbookImageOrphanPayload>> {
	if (ctx.corpus !== CORPUS) return;
	const editions = await listHandbookEditions(ctx.repoRoot, ctx.sourceId);
	for (const edition of editions) {
		const warnings = await readWarnings(edition.warningsPath);
		const captionWarnings = warnings.warnings.filter((w) => w.code === 'caption-without-figure');
		const imageWarnings = warnings.warnings.filter((w) => w.code === FIGURE_WITHOUT_CAPTION_CODE);
		if (imageWarnings.length === 0) continue;
		// The unpaired captions in the same handbook are the candidate set
		// for any image-orphan on a nearby page.
		const captionSnapshot: HandbookCaptionCandidate[] = [];
		for (const w of captionWarnings) {
			const pageNum = extractPageNumber(w.message);
			if (pageNum === null) continue;
			captionSnapshot.push({
				externalId: w.id,
				pageNum,
				captionText: w.message,
				sectionCode: w.section_code ?? '',
			});
		}
		for (const warning of imageWarnings) {
			const pageNum = extractPageNumber(warning.message);
			const stats = extractImageStats(warning.message);
			const candidateSnapshot =
				pageNum === null
					? []
					: captionSnapshot.filter(
							(c) =>
								c.pageNum >= pageNum - INGEST_CANDIDATE_PAGE_WINDOW &&
								c.pageNum <= pageNum + INGEST_CANDIDATE_PAGE_WINDOW,
						);
			const payload: HandbookImageOrphanPayload = {
				imageIndex: stats?.index ?? -1,
				width: stats?.width ?? 0,
				height: stats?.height ?? 0,
				sectionCode: warning.section_code ?? '',
				candidateSnapshot,
			};
			yield {
				corpus: CORPUS,
				sourceId: edition.slug,
				edition: edition.edition,
				pageNum,
				kind: KIND,
				externalId: warning.id,
				payload,
			};
		}
	}
}

async function findCandidates(
	issue: IssueRecord<HandbookImageOrphanPayload>,
	ctx: CandidateContext,
): Promise<readonly Candidate[]> {
	if (issue.pageNum === null) return [];
	const editions = await listHandbookEditions(ctx.repoRoot, ctx.sourceId);
	const edition = editions.find((e) => e.slug === issue.sourceId && e.edition === issue.edition);
	if (!edition) return [];
	const warnings = await readWarnings(edition.warningsPath);
	const min = issue.pageNum - INGEST_CANDIDATE_PAGE_WINDOW;
	const max = issue.pageNum + INGEST_CANDIDATE_PAGE_WINDOW;
	const out: Candidate[] = [];
	for (const w of warnings.warnings) {
		if (w.code !== 'caption-without-figure') continue;
		const page = extractPageNumber(w.message);
		if (page === null) continue;
		if (page < min || page > max) continue;
		out.push({
			id: w.id,
			pageNum: page,
			thumbnailUrl: '',
			width: 0,
			height: 0,
			label: w.message,
			payload: {
				captionExternalId: w.id,
				captionPage: page,
			},
		});
	}
	out.sort((a, b) => (a.pageNum !== b.pageNum ? a.pageNum - b.pageNum : a.id.localeCompare(b.id)));
	return out;
}

function validateAction(_issue: IssueRecord<HandbookImageOrphanPayload>, action: ActionInput): void {
	switch (action.action) {
		case INGEST_REVIEW.ACTIONS.PAIR: {
			const payload = action.payload as Partial<ImageOrphanPairPayload>;
			if (typeof payload.captionExternalId !== 'string' || payload.captionExternalId.length === 0) {
				throw new InvalidActionPayloadError("image-orphan 'pair' requires captionExternalId:string");
			}
			if (typeof payload.captionPage !== 'number' || !Number.isFinite(payload.captionPage)) {
				throw new InvalidActionPayloadError("image-orphan 'pair' requires captionPage:number");
			}
			return;
		}
		case INGEST_REVIEW.ACTIONS.MARK_EXTRANEOUS:
		case INGEST_REVIEW.ACTIONS.MARK_DECORATIVE:
			return;
		default:
			throw new InvalidActionPayloadError(`image-orphan does not accept action '${action.action}'`);
	}
}

function serializeForYaml(issue: IssueRecord<HandbookImageOrphanPayload>, override: OverrideRecord): YamlSidecarEntry {
	return {
		external_id: issue.externalId,
		kind: KIND,
		action: override.action,
		payload: override.payload as Record<string, unknown>,
	};
}

export const handbookImageOrphanPlugin: IngestIssuePlugin<HandbookImageOrphanPayload> = {
	kind: KIND,
	produceIssues,
	findCandidates,
	validateAction,
	serializeForYaml,
};

export const __testHelpers = {
	parseWarning(warning: WarningEntry) {
		return {
			pageNum: extractPageNumber(warning.message),
			imageStats: extractImageStats(warning.message),
		};
	},
};
