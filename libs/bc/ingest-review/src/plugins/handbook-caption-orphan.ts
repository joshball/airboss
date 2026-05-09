/**
 * `handbook.caption-orphan` plugin.
 *
 * Producer: read each handbook edition's `warnings.json`, yield one
 * issue per `caption-without-figure` row. Candidate finder: scan
 * `manifest.json` for figures whose `caption_page_num` falls in the
 * page-window radius around the caption's page. Action handler: validate
 * the action shape; the BC's `applyOverride` writes the row.
 *
 * @browser-globals: server-only -- never imported by client .svelte
 */

import { INGEST_CANDIDATE_PAGE_WINDOW, INGEST_REVIEW, type IngestIssueKind } from '@ab/constants';
import { InvalidActionPayloadError } from '../queries';
import type {
	ActionInput,
	Candidate,
	CandidateContext,
	CaptionOrphanPairPayload,
	HandbookCaptionOrphanPayload,
	HandbookFigureCandidate,
	IngestIssuePlugin,
	IssueInput,
	IssueRecord,
	OverrideRecord,
	ProducerContext,
	YamlSidecarEntry,
} from '../types';
import {
	extractCaption,
	extractMode,
	extractPageNumber,
	type FigureManifestEntry,
	listHandbookEditions,
	readManifest,
	readWarnings,
	type WarningEntry,
} from './handbook-shared';

const KIND: IngestIssueKind = INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN;
const CORPUS = INGEST_REVIEW.CORPUSES.HANDBOOK;
const CAPTION_WITHOUT_FIGURE_CODE = 'caption-without-figure';

async function* produceIssues(ctx: ProducerContext): AsyncIterable<IssueInput<HandbookCaptionOrphanPayload>> {
	if (ctx.corpus !== CORPUS) return;
	const editions = await listHandbookEditions(ctx.repoRoot, ctx.sourceId);
	for (const edition of editions) {
		const warnings = await readWarnings(edition.warningsPath);
		const captionWarnings = warnings.warnings.filter((w) => w.code === CAPTION_WITHOUT_FIGURE_CODE);
		if (captionWarnings.length === 0) continue;
		const manifest = await readManifest(edition.manifestPath);
		const pairedXrefs = new Set<string>();
		for (const fig of manifest.figures) pairedXrefs.add(fig.id);
		for (const warning of captionWarnings) {
			const pageNum = extractPageNumber(warning.message);
			const caption = extractCaption(warning.message) ?? warning.message;
			const mode = extractMode(warning.message);
			const candidateSnapshot = pageNum === null ? [] : findFigureCandidates(manifest.figures, pageNum);
			const payload: HandbookCaptionOrphanPayload = {
				captionText: caption,
				mode,
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

function findFigureCandidates(
	figures: readonly FigureManifestEntry[],
	pageNum: number,
): readonly HandbookFigureCandidate[] {
	const min = pageNum - INGEST_CANDIDATE_PAGE_WINDOW;
	const max = pageNum + INGEST_CANDIDATE_PAGE_WINDOW;
	const out: HandbookFigureCandidate[] = [];
	for (const fig of figures) {
		const page = fig.caption_page_num ?? null;
		if (page === null) continue;
		if (page < min || page > max) continue;
		out.push({
			figureId: fig.id,
			pageNum: page,
			caption: fig.caption,
			assetPath: fig.asset_path,
			width: fig.width,
			height: fig.height,
		});
	}
	out.sort((a, b) => (a.pageNum !== b.pageNum ? a.pageNum - b.pageNum : a.figureId.localeCompare(b.figureId)));
	return out;
}

async function findCandidates(
	issue: IssueRecord<HandbookCaptionOrphanPayload>,
	ctx: CandidateContext,
): Promise<readonly Candidate[]> {
	if (issue.pageNum === null) return [];
	const editions = await listHandbookEditions(ctx.repoRoot, ctx.sourceId);
	const edition = editions.find((e) => e.slug === issue.sourceId && e.edition === issue.edition);
	if (!edition) return [];
	const manifest = await readManifest(edition.manifestPath);
	const figureCandidates = findFigureCandidates(manifest.figures, issue.pageNum);
	return figureCandidates.map((fig) => ({
		id: fig.figureId,
		pageNum: fig.pageNum,
		thumbnailUrl: `/${fig.assetPath}`,
		width: fig.width,
		height: fig.height,
		label: fig.caption,
		payload: {
			figureId: fig.figureId,
			imagePage: fig.pageNum,
			imageXref: 0,
			imageAssetPath: fig.assetPath,
			imageCaption: fig.caption,
		},
	}));
}

function validateAction(_issue: IssueRecord<HandbookCaptionOrphanPayload>, action: ActionInput): void {
	switch (action.action) {
		case INGEST_REVIEW.ACTIONS.PAIR: {
			const payload = action.payload as Partial<CaptionOrphanPairPayload>;
			if (typeof payload.imagePage !== 'number' || !Number.isFinite(payload.imagePage)) {
				throw new InvalidActionPayloadError("caption-orphan 'pair' requires imagePage:number");
			}
			if (typeof payload.imageXref !== 'number' || !Number.isFinite(payload.imageXref)) {
				throw new InvalidActionPayloadError("caption-orphan 'pair' requires imageXref:number");
			}
			if (typeof payload.figureId !== 'string' || payload.figureId.length === 0) {
				throw new InvalidActionPayloadError("caption-orphan 'pair' requires figureId:string");
			}
			return;
		}
		case INGEST_REVIEW.ACTIONS.MARK_NO_FIGURE:
		case INGEST_REVIEW.ACTIONS.MARK_FALSE_CAPTION:
			// Empty payload is fine; reject anything else so callers don't
			// silently lose data.
			return;
		default:
			throw new InvalidActionPayloadError(`caption-orphan does not accept action '${action.action}'`);
	}
}

function serializeForYaml(
	issue: IssueRecord<HandbookCaptionOrphanPayload>,
	override: OverrideRecord,
): YamlSidecarEntry {
	return {
		external_id: issue.externalId,
		kind: KIND,
		action: override.action,
		payload: override.payload as Record<string, unknown>,
	};
}

export const handbookCaptionOrphanPlugin: IngestIssuePlugin<HandbookCaptionOrphanPayload> = {
	kind: KIND,
	produceIssues,
	findCandidates,
	validateAction,
	serializeForYaml,
};

// Helper exposed for tests in the same BC.
export const __testHelpers = {
	findFigureCandidates,
	parseWarning(warning: WarningEntry) {
		return {
			pageNum: extractPageNumber(warning.message),
			caption: extractCaption(warning.message),
			mode: extractMode(warning.message),
		};
	},
};
