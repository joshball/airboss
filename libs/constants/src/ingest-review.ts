/**
 * Constants for the hangar ingest-review queue.
 *
 * One queue surfaces residual issues left behind by ingest pipelines (today:
 * the figure-pairing residuals from `tools/handbook-ingest/`). Plugins
 * register against a `kind` discriminator; each plugin owns a closed action
 * set and a payload shape. The strings live here so the BC's CHECK
 * constraints, the route handlers, and the YAML sidecar serializer all
 * agree on the literal sets.
 *
 * See docs/work-packages/hangar-ingest-review-queue/spec.md.
 */

/**
 * Corpus discriminator. v1 ships with `handbook` populated; `regs` and
 * `knowledge` are reserved for the next-up corpora named in the WP risk
 * section so the CHECK constraint doesn't need a migration when those
 * land. Plugins scope their producers by corpus; the queue's filter UI
 * groups by corpus.
 */
export const CORPUS_VALUES = ['handbook', 'regs', 'knowledge'] as const;
export type Corpus = (typeof CORPUS_VALUES)[number];

/**
 * Issue-kind discriminator. Per-plugin string; plugins look themselves up
 * in the registry by this value. New kinds land by adding a literal here
 * and registering a plugin.
 *
 * Naming convention: `<corpus>.<symptom>`. The corpus prefix keeps the
 * grammar uniform even when a future corpus reuses an analogous symptom.
 */
export const INGEST_ISSUE_KIND_VALUES = ['handbook.caption-orphan', 'handbook.image-orphan'] as const;
export type IngestIssueKind = (typeof INGEST_ISSUE_KIND_VALUES)[number];

/**
 * Action discriminator. `pair` appears in both caption-orphan and
 * image-orphan action sets but means the inverse direction; the
 * plugin's `applyAction` validates the payload shape against its kind.
 */
export const INGEST_OVERRIDE_ACTION_VALUES = [
	// caption-orphan actions
	'pair',
	'mark-no-figure',
	'mark-false-caption',
	// image-orphan actions
	'mark-extraneous',
	'mark-decorative',
] as const;
export type IngestOverrideAction = (typeof INGEST_OVERRIDE_ACTION_VALUES)[number];

/**
 * Lifecycle status of a single issue row.
 *
 *   - `unresolved`: producer emitted, no override yet.
 *   - `resolved`: an `ingest_override` row exists for this issue.
 *   - `stale`: producer's last run did not re-emit this issue's
 *     `external_id`; override (if any) survives but the issue is hidden
 *     from the default queue view.
 *   - `dismissed`: human flipped the row off the queue without writing
 *     an override (e.g. "this is noise; don't show it again").
 */
export const INGEST_STATUS_VALUES = ['unresolved', 'resolved', 'stale', 'dismissed'] as const;
export type IngestStatus = (typeof INGEST_STATUS_VALUES)[number];

/**
 * Display labels for the status filter chips and the queue card pill.
 */
export const INGEST_STATUS_LABELS: Record<IngestStatus, string> = {
	unresolved: 'Unresolved',
	resolved: 'Resolved',
	stale: 'Stale',
	dismissed: 'Dismissed',
};

/**
 * Display labels for the corpus filter chips.
 */
export const CORPUS_LABELS: Record<Corpus, string> = {
	handbook: 'Handbook',
	regs: 'Regulations',
	knowledge: 'Knowledge',
};

/**
 * Display labels for issue kinds. Authors see these on the queue card
 * and the action bar header.
 */
export const INGEST_ISSUE_KIND_LABELS: Record<IngestIssueKind, string> = {
	'handbook.caption-orphan': 'Caption orphan',
	'handbook.image-orphan': 'Image orphan',
};

/**
 * Display labels for action buttons.
 */
export const INGEST_OVERRIDE_ACTION_LABELS: Record<IngestOverrideAction, string> = {
	pair: 'Pair',
	'mark-no-figure': 'Mark no figure',
	'mark-false-caption': 'Mark false caption',
	'mark-extraneous': 'Mark extraneous',
	'mark-decorative': 'Mark decorative',
};

/**
 * Map of action -> kinds that may apply that action. The plugin's
 * `applyAction` enforces this at the BC level; the route handler reads
 * this map to render only the right buttons per kind.
 */
export const INGEST_ACTIONS_BY_KIND: Readonly<Record<IngestIssueKind, readonly IngestOverrideAction[]>> = {
	'handbook.caption-orphan': ['pair', 'mark-no-figure', 'mark-false-caption'],
	'handbook.image-orphan': ['pair', 'mark-extraneous', 'mark-decorative'],
};

/**
 * Convenience namespaced bag; the route handler / UI / plugin code can
 * grab `INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN` rather than the bare
 * literal so a future rename is a single-file change.
 */
export const INGEST_REVIEW = {
	KINDS: {
		HANDBOOK_CAPTION_ORPHAN: 'handbook.caption-orphan',
		HANDBOOK_IMAGE_ORPHAN: 'handbook.image-orphan',
	},
	ACTIONS: {
		PAIR: 'pair',
		MARK_NO_FIGURE: 'mark-no-figure',
		MARK_FALSE_CAPTION: 'mark-false-caption',
		MARK_EXTRANEOUS: 'mark-extraneous',
		MARK_DECORATIVE: 'mark-decorative',
	},
	STATUS: {
		UNRESOLVED: 'unresolved',
		RESOLVED: 'resolved',
		STALE: 'stale',
		DISMISSED: 'dismissed',
	},
	CORPUSES: {
		HANDBOOK: 'handbook',
		REGS: 'regs',
		KNOWLEDGE: 'knowledge',
	},
} as const;

/**
 * Audit-target tag for ingest-override mutations. Mirrors the
 * `hangar.review_bucket` precedent: per-row mutations write through
 * `auditWrite({ targetType: AUDIT_INGEST_OVERRIDE, ... })` so the
 * existing audit explorer already filters them.
 */
export const AUDIT_INGEST_OVERRIDE = 'hangar.ingest_override';

/**
 * ID prefixes minted via `@ab/utils` `createId(prefix)`.
 */
export const INGEST_ISSUE_ID_PREFIX = 'isiss';
export const INGEST_OVERRIDE_ID_PREFIX = 'iover';

/**
 * Page-window radius for the candidate finder. A caption orphan on page
 * N matches every unpaired image on pages [N - WINDOW, N + WINDOW]
 * (inclusive). Mirrors the `figures.py` Tier 2 / 3 prior-page / next-page
 * geometry. Lifted to a constant so a future plugin-config knob can
 * widen the window without a code edit deep in the plugin.
 */
export const INGEST_CANDIDATE_PAGE_WINDOW = 2;

/**
 * Hard cap on how many issues the queue page renders without paging.
 * v1 has 21 live caption-orphans; the cap is generous enough that
 * the next plugin's debut won't surprise the page, and small enough
 * that the queue doesn't accidentally render thousands of rows when
 * the knowledge-graph drift detector lands.
 */
export const INGEST_QUEUE_DEFAULT_LIMIT = 200;
