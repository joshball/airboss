/**
 * Constants for the platform-wide note primitive
 * (see `docs/work-packages/wp-notes-primitive/spec.md`).
 *
 * A note is a markdown thought attached to optional context (reference,
 * section, knowledge node, course, goal, syllabus node) plus free-form tags.
 * These caps are mirrored by the BC zod schemas in
 * `libs/bc/study/src/notes.ts` and (where applicable) the route layer.
 */

/**
 * Hard cap on a note's `body_md` length. 64KB is generous enough for a
 * long-form lesson plan without giving the textarea pretensions of being
 * a wiki. Enforced by both the zod schema and (planned) the column
 * constraint in `study.note`.
 */
export const NOTE_BODY_MAX_LENGTH = 64_000;

/**
 * Maximum number of free-form tags per note. 16 is more than the user
 * will use in practice; the cap exists to keep an array column from
 * growing unbounded if the user pastes a CSV by mistake.
 */
export const NOTE_TAGS_MAX = 16;

/**
 * Maximum length of a single tag string. Mirrors typical UI chip widths
 * and prevents pathological `text[]` element sizes.
 */
export const NOTE_TAG_MAX_LENGTH = 64;

/**
 * Hard cap on a note's `quoted_excerpt` length -- the snapshot of the
 * passage the note responds to. 4KB covers a long paragraph without
 * letting the excerpt become an alternate body.
 */
export const NOTE_EXCERPT_MAX_LENGTH = 4_000;

/**
 * Hard cap on a note's `title` length. Notes derive a title from the
 * first line when this is empty; the cap is a sanity bound.
 */
export const NOTE_TITLE_MAX_LENGTH = 200;

/**
 * Hard cap on a note's `follow_up_md` length. Follow-ups are intent
 * captures, not full notes; if the user wants a full note, they should
 * write one.
 */
export const NOTE_FOLLOW_UP_MAX_LENGTH = 4_000;

/**
 * Default page size for `listNotesForUser` and `searchNotes`.
 */
export const NOTES_LIST_DEFAULT_LIMIT = 25;

/**
 * Hard cap on the page size accepted by `listNotesForUser` /
 * `searchNotes`. Larger values are clamped silently by the BC.
 */
export const NOTES_LIST_HARD_CAP = 100;

/**
 * Length of the body preview rendered in `<NoteCard>` (characters,
 * not lines). The card truncates by character count and lets CSS
 * line-clamp handle the visual cutoff at three lines.
 */
export const NOTE_CARD_PREVIEW_LENGTH = 240;

/**
 * Tag used by the `notes_md` migrator to flag rows it created when
 * importing legacy `reference_section_read_state.notes_md` blobs.
 */
export const NOTE_MIGRATED_FROM_BLOB_TAG = 'migrated-from-blob';

/**
 * Index-prefix view names for the `/notes` index. The `view` query
 * param resolves to one of these. `all` is the default.
 */
export const NOTES_VIEWS = {
	ALL: 'all',
	FOLLOW_UPS: 'follow-ups',
	ARCHIVED: 'archived',
	BY_CONTEXT: 'by-context',
} as const;

export type NotesView = (typeof NOTES_VIEWS)[keyof typeof NOTES_VIEWS];

export const NOTES_VIEW_VALUES: readonly NotesView[] = Object.values(NOTES_VIEWS);

export const NOTES_VIEW_DEFAULT: NotesView = NOTES_VIEWS.ALL;

/**
 * Labels for the tab strip on the `/notes` index.
 */
export const NOTES_VIEW_LABELS: Record<NotesView, string> = {
	[NOTES_VIEWS.ALL]: 'All',
	[NOTES_VIEWS.FOLLOW_UPS]: 'Follow-ups',
	[NOTES_VIEWS.ARCHIVED]: 'Archived',
	[NOTES_VIEWS.BY_CONTEXT]: 'By context',
};

/**
 * Closed sort options for the notes list. Matches the spec's
 * `ListOpts.sort`.
 */
export const NOTES_SORT = {
	NEWEST: 'newest',
	OLDEST: 'oldest',
	UPDATED: 'updated',
} as const;

export type NotesSort = (typeof NOTES_SORT)[keyof typeof NOTES_SORT];

export const NOTES_SORT_VALUES: readonly NotesSort[] = Object.values(NOTES_SORT);

export const NOTES_SORT_DEFAULT: NotesSort = NOTES_SORT.NEWEST;

/**
 * Closed archived-filter options. `exclude` is the default for the
 * "All" view; `only` powers the "Archived" view; `include` is rarely
 * used directly but supported for tooling / audit reads.
 */
export const NOTES_ARCHIVED_FILTER = {
	EXCLUDE: 'exclude',
	INCLUDE: 'include',
	ONLY: 'only',
} as const;

export type NotesArchivedFilter = (typeof NOTES_ARCHIVED_FILTER)[keyof typeof NOTES_ARCHIVED_FILTER];

export const NOTES_ARCHIVED_FILTER_VALUES: readonly NotesArchivedFilter[] = Object.values(NOTES_ARCHIVED_FILTER);

/** Prefix for `study.note` ids -- `note_<ULID>`. */
export const NOTE_ID_PREFIX = 'note';
