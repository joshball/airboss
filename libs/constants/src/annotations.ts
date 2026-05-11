/**
 * Annotation + card-draft constants (wp-flightbag-rich-reader).
 *
 * `study.reference_section_annotation` is one row per highlight, note-anchor,
 * or card-draft-anchor. The kind enum + color enum live here so the schema
 * CHECK constraints, the BC validators, and the toolbar UI all read from one
 * source of truth.
 *
 * Color semantics are author-facing: yellow = memorize, blue = context,
 * green = cross-link, pink = question. The renderer only needs the primitive
 * color string; the meanings drive the picker tooltips.
 */

export const ANNOTATION_KINDS = {
	/** Coloured highlight overlay on a passage. */
	HIGHLIGHT: 'highlight',
	/** Anchor row that ties a `study.note` to a passage. */
	NOTE_ANCHOR: 'note_anchor',
	/** Anchor row that ties a `study.card_draft` to a passage. */
	CARD_DRAFT_ANCHOR: 'card_draft_anchor',
} as const;

export type AnnotationKind = (typeof ANNOTATION_KINDS)[keyof typeof ANNOTATION_KINDS];
export const ANNOTATION_KIND_VALUES: readonly AnnotationKind[] = Object.values(ANNOTATION_KINDS);

export const HIGHLIGHT_COLORS = {
	YELLOW: 'yellow',
	BLUE: 'blue',
	GREEN: 'green',
	PINK: 'pink',
} as const;

export type HighlightColor = (typeof HIGHLIGHT_COLORS)[keyof typeof HIGHLIGHT_COLORS];
export const HIGHLIGHT_COLOR_VALUES: readonly HighlightColor[] = Object.values(HIGHLIGHT_COLORS);

/**
 * Optional semantic mapping. Surface in the highlight-color picker tooltips.
 * The user's color choice is stored as the primitive color; semantics are
 * UI-side only.
 */
export const HIGHLIGHT_COLOR_MEANINGS: Record<HighlightColor, string> = {
	[HIGHLIGHT_COLORS.YELLOW]: 'memorize',
	[HIGHLIGHT_COLORS.BLUE]: 'context',
	[HIGHLIGHT_COLORS.GREEN]: 'reference / cross-link',
	[HIGHLIGHT_COLORS.PINK]: 'question / disagree',
};

/**
 * Default highlight color when the user hits the keyboard shortcut without
 * explicitly picking one (Phase 6 keyboard shortcuts).
 */
export const HIGHLIGHT_COLOR_DEFAULT: HighlightColor = HIGHLIGHT_COLORS.YELLOW;

/**
 * Cap on the captured `anchor_text` size at the schema layer. Rationale:
 * a single highlight that's longer than this is suspicious (the user's
 * probably highlighted a whole page) and the longer the anchor, the
 * more brittle re-anchoring becomes. The text-anchors helper enforces
 * the same cap at capture time.
 */
export const ANNOTATION_ANCHOR_TEXT_MAX_LENGTH = 1000;

/** Cap on prefix / suffix context size (each). 32 chars is the spec default. */
export const ANNOTATION_CONTEXT_DEFAULT_LENGTH = 32;
export const ANNOTATION_CONTEXT_MAX_LENGTH = 256;

/** ULID prefixes for annotation + card-draft rows. */
export const ANNOTATION_ID_PREFIX = 'ann';
export const CARD_DRAFT_ID_PREFIX = 'draft';

/**
 * Annotation visibility filter (Phase 6). Persisted as the
 * `study.reading.annotation_filter` user pref.
 */
export const ANNOTATION_FILTERS = {
	ALL: 'all',
	HIGHLIGHTS_ONLY: 'highlights-only',
	NOTES_ONLY: 'notes-only',
	HIDDEN: 'hidden',
} as const;

export type AnnotationFilter = (typeof ANNOTATION_FILTERS)[keyof typeof ANNOTATION_FILTERS];
export const ANNOTATION_FILTER_VALUES: readonly AnnotationFilter[] = Object.values(ANNOTATION_FILTERS);
export const ANNOTATION_FILTER_DEFAULT: AnnotationFilter = ANNOTATION_FILTERS.ALL;

export const ANNOTATION_FILTER_LABELS: Record<AnnotationFilter, string> = {
	[ANNOTATION_FILTERS.ALL]: 'All',
	[ANNOTATION_FILTERS.HIGHLIGHTS_ONLY]: 'Highlights only',
	[ANNOTATION_FILTERS.NOTES_ONLY]: 'Notes only',
	[ANNOTATION_FILTERS.HIDDEN]: 'Hidden',
};

/**
 * Hard cap on the number of card-draft rows an inbox query returns in one
 * page. The drafts inbox is intended as a small workspace, not a long-tail
 * archive; once a user has hundreds of unpromoted drafts something else
 * needs attention.
 */
export const CARD_DRAFTS_LIST_HARD_CAP = 200;
