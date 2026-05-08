/**
 * Public types for the ingest-review BC. This file is browser-safe: every
 * value is a type alias / interface; no DB / `node:*` imports.
 *
 * The plugin contract is small on purpose. A producer yields issue inputs;
 * the BC writes them through `upsertIssues`. The candidate finder reshapes
 * the issue's `payload` into the structured set the orphan-card UI renders.
 * The action handler validates and writes the override row. The serializer
 * shapes the override into a YAML sidecar entry for the export script.
 *
 * Adding a third plugin should NOT require adding to this file -- the
 * generic `<P, A>` type parameters carry plugin-specific payload shapes
 * and the `IngestIssueKind` discriminator routes everything by kind.
 */

import type { Corpus, IngestIssueKind, IngestOverrideAction, IngestStatus } from '@ab/constants';

/**
 * Browser-safe row projection of `hangar.ingest_issue`. Differs from the
 * Drizzle-derived `IngestIssueRow` only in that `payload` is generic
 * over the plugin-specific shape, and the discriminated literal types
 * are the closed sets from `@ab/constants` rather than open `text`.
 */
export interface IssueRecord<P = unknown> {
	id: string;
	corpus: Corpus;
	sourceId: string;
	edition: string | null;
	pageNum: number | null;
	kind: IngestIssueKind;
	externalId: string;
	payload: P;
	status: IngestStatus;
	firstSeenAt: Date;
	lastSeenAt: Date;
}

/**
 * What a producer yields. The BC's `upsertIssues` mints the row id and
 * the `firstSeenAt` / `lastSeenAt` timestamps; the producer hands it
 * everything else.
 */
export interface IssueInput<P = Record<string, unknown>> {
	corpus: Corpus;
	sourceId: string;
	edition: string | null;
	pageNum: number | null;
	kind: IngestIssueKind;
	externalId: string;
	payload: P;
}

/** Browser-safe row projection of `hangar.ingest_override`. */
export interface OverrideRecord<A = unknown> {
	id: string;
	issueId: string;
	action: IngestOverrideAction;
	payload: A;
	createdByUserId: string | null;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Action input the route handler receives + the BC writer persists. The
 * plugin's `applyAction` validates the payload shape against its kind
 * before this lands in the override row.
 */
export interface ActionInput<A = Record<string, unknown>> {
	action: IngestOverrideAction;
	payload: A;
}

/**
 * One option rendered in the orphan card's candidate strip. The plugin's
 * `findCandidates` returns this shape; the UI never re-opens the PDF.
 */
export interface Candidate {
	/** Stable id from the plugin's view of the manifest (e.g. `fig-4-7-00`). */
	id: string;
	pageNum: number;
	/** Resolved against the in-tree `figures/` path or `/api/<...>`. */
	thumbnailUrl: string;
	width: number;
	height: number;
	/** Human-readable summary (e.g. caption text, chart label). */
	label: string;
	/** Plugin-defined; round-trips into `applyAction`. */
	payload: Record<string, unknown>;
}

/**
 * One row in a `<slug>-overrides.yaml` sidecar. The figure-pairing
 * pipeline reads this shape during re-extraction and applies the
 * override as a final tier after the existing geometric tiers.
 */
export interface YamlSidecarEntry {
	external_id: string;
	kind: IngestIssueKind;
	action: IngestOverrideAction;
	payload: Record<string, unknown>;
}

/**
 * The shape of a `<slug>-overrides.yaml` file. One file per source.
 */
export interface YamlSidecar {
	overrides: readonly YamlSidecarEntry[];
}

/**
 * Read-only context for `produceIssues`. The producer reads from `repoRoot`
 * (the airboss checkout) for in-tree manifests / warnings; the BC's
 * runner threads this through.
 */
export interface ProducerContext {
	corpus: Corpus;
	/** When set, restrict producers to a single source slug. */
	sourceId?: string;
	/**
	 * Absolute path to the airboss checkout root. The handbook plugins
	 * read `handbooks/<slug>/<edition>/warnings.json` relative to this.
	 */
	repoRoot: string;
}

/**
 * Read-only context for `findCandidates`. Same shape as the producer
 * context for now; kept distinct so a future plugin can grow per-call
 * options (selection cursor, range hint) without touching the producer.
 */
export interface CandidateContext {
	corpus: Corpus;
	sourceId: string;
	edition: string | null;
	repoRoot: string;
}

/**
 * Mutable context for `applyAction`. Carries the actor + the current
 * override (when one exists) so the plugin can treat re-application as
 * an idempotent overwrite.
 */
export interface ActionContext {
	/** User pressing the action. May be null in script-driven runs. */
	actorUserId: string | null;
	/** Existing override on this issue, if any. */
	currentOverride: OverrideRecord | null;
}

/**
 * The full plugin contract. A plugin is a registry-of-one: one record per
 * `kind`, registered as a side effect of importing
 * `libs/bc/ingest-review/src/plugins/index.ts`.
 *
 * Generic over `P` (payload shape on the issue row) and `A` (payload
 * shape on the override row). Both are plugin-specific; the BC sees them
 * as `unknown` and never inspects their fields.
 */
export interface IngestIssuePlugin<P = Record<string, unknown>, A = Record<string, unknown>> {
	/** The kind discriminator. Must match an entry in `INGEST_ISSUE_KIND_VALUES`. */
	readonly kind: IngestIssueKind;
	/** Stream issues from the producer's source of truth (warnings.json, ...). */
	produceIssues(ctx: ProducerContext): AsyncIterable<IssueInput<P>>;
	/** Build the candidate set for an issue's UI. */
	findCandidates(issue: IssueRecord<P>, ctx: CandidateContext): Promise<readonly Candidate[]>;
	/** Validate the action shape against the plugin's contract. Throws on invalid. */
	validateAction(issue: IssueRecord<P>, action: ActionInput<A>): void;
	/** Shape an override into the YAML sidecar entry. */
	serializeForYaml(issue: IssueRecord<P>, override: OverrideRecord<A>): YamlSidecarEntry;
}

/**
 * Producer-yielded handbook caption-orphan payload. Carries the caption
 * text + detected mode + the producer's snapshot of the candidate window
 * so the UI never re-opens the PDF for the initial render.
 */
export interface HandbookCaptionOrphanPayload {
	captionText: string;
	mode: string;
	/** Section code the producer associated the caption with. */
	sectionCode: string;
	/**
	 * Snapshot of unpaired figure candidates inside the page-window radius
	 * at producer time. The candidate finder rebuilds this from the live
	 * manifest; the snapshot is here for reference + auditability.
	 */
	candidateSnapshot: readonly HandbookFigureCandidate[];
}

/**
 * One unpaired figure inside the candidate window of a caption-orphan.
 */
export interface HandbookFigureCandidate {
	figureId: string;
	pageNum: number;
	caption: string;
	assetPath: string;
	width: number;
	height: number;
}

/**
 * Producer-yielded handbook image-orphan payload. The mirror of the
 * caption-orphan shape: page + image dimensions + the candidate captions
 * within the page-window radius.
 */
export interface HandbookImageOrphanPayload {
	imageIndex: number;
	width: number;
	height: number;
	sectionCode: string;
	candidateSnapshot: readonly HandbookCaptionCandidate[];
}

/**
 * One unpaired caption inside the candidate window of an image-orphan.
 */
export interface HandbookCaptionCandidate {
	externalId: string;
	pageNum: number;
	captionText: string;
	sectionCode: string;
}

/**
 * Override-payload shape for a `pair` action on a caption-orphan.
 */
export interface CaptionOrphanPairPayload {
	imagePage: number;
	imageXref: number;
	figureId: string;
}

/**
 * Override-payload shape for a `pair` action on an image-orphan.
 */
export interface ImageOrphanPairPayload {
	captionExternalId: string;
	captionPage: number;
}
