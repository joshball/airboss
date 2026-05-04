/**
 * Hangar review queue constants.
 *
 * Owned by the `hangar-review-queue` work package -- a review-centric backlog
 * + kanban + per-kind review surfaces over the repo's reviewable artifacts
 * (work-package specs, test-plans, references, knowledge nodes, ad-hoc tasks).
 *
 * All literal values used by the review BC, the routes, the loader, and the
 * board UI live here. Magic strings inside the BC or the pages are a bug
 * (project rule: all literals in `libs/constants/`).
 */

/**
 * Review kinds. A review item's kind discriminates which per-kind page renders
 * (`/review/[kind]/[itemId]`) and which discovery rule the loader uses to
 * keep the item set fresh.
 *
 * - `wp_spec` -- work-package spec.md (one row per `docs/work-packages/<name>/spec.md`)
 * - `wp_test_plan` -- work-package test-plan.md (one row per sibling test-plan.md)
 * - `reference_toc` -- TOC spot-check on a `hangar.reference` row's verbatim block
 * - `knowledge_node` -- discovery-pedagogy review for a `course/knowledge/<...>/node.md`
 * - `ad_hoc` -- hand-authored task; no underlying file to read
 */
export const REVIEW_KIND_VALUES = ['wp_spec', 'wp_test_plan', 'reference_toc', 'knowledge_node', 'ad_hoc'] as const;
export type ReviewKind = (typeof REVIEW_KIND_VALUES)[number];
/** Pretty labels for badges + dropdowns. Sorted by `REVIEW_KIND_VALUES`. */
export const REVIEW_KIND_LABELS: Record<ReviewKind, string> = {
	wp_spec: 'Work-package spec',
	wp_test_plan: 'Test plan',
	reference_toc: 'Reference TOC',
	knowledge_node: 'Knowledge node',
	ad_hoc: 'Ad-hoc task',
};
/** Object literal form for DX: `REVIEW_KINDS.WP_SPEC` is callable as a string. */
export const REVIEW_KINDS = {
	WP_SPEC: 'wp_spec',
	WP_TEST_PLAN: 'wp_test_plan',
	REFERENCE_TOC: 'reference_toc',
	KNOWLEDGE_NODE: 'knowledge_node',
	AD_HOC: 'ad_hoc',
} as const satisfies Record<string, ReviewKind>;

/**
 * Per-step review outcome (test-plan walker, TOC spot-check). One per
 * `review_step` row.
 */
export const REVIEW_OUTCOME_VALUES = ['pass', 'fail', 'blocked'] as const;
export type ReviewOutcome = (typeof REVIEW_OUTCOME_VALUES)[number];
export const REVIEW_OUTCOME_LABELS: Record<ReviewOutcome, string> = {
	pass: 'Pass',
	fail: 'Fail',
	blocked: 'Blocked',
};

/**
 * Whole-session outcome stored on `review_session.outcome` after the reviewer
 * presses Finish. `abandoned` is reserved for sessions left open longer than
 * the resume window (loader bookkeeping; not surfaced as a button).
 */
export const SESSION_OUTCOME_VALUES = ['pass', 'fail', 'abandoned'] as const;
export type SessionOutcome = (typeof SESSION_OUTCOME_VALUES)[number];
export const SESSION_OUTCOME_LABELS: Record<SessionOutcome, string> = {
	pass: 'Pass',
	fail: 'Fail',
	abandoned: 'Abandoned',
};

/**
 * Frontmatter `status:` values authored on docs (`docs/work-packages/<name>/spec.md`,
 * knowledge nodes, ADRs). User-controlled. The board's drag-drop writer flips
 * these per the spec rules (Backlog -> reading; In Progress -> done; etc.).
 */
export const FRONTMATTER_STATUS_VALUES = ['unread', 'reading', 'done'] as const;
export type FrontmatterStatus = (typeof FRONTMATTER_STATUS_VALUES)[number];

/**
 * Frontmatter `review_status:` values. Agent-controlled, written only by an
 * explicit user trigger (e.g. "Flip review_status" button after a 100% pass
 * test-plan walk).
 */
export const FRONTMATTER_REVIEW_STATUS_VALUES = ['pending', 'done'] as const;
export type FrontmatterReviewStatus = (typeof FRONTMATTER_REVIEW_STATUS_VALUES)[number];

/**
 * Default board column names seeded on first board creation. The order is
 * the column order on screen left-to-right.
 */
export const REVIEW_BOARD_DEFAULT_COLUMNS = ['Backlog', 'In Progress', 'Review', 'Done'] as const;
export type ReviewBoardDefaultColumn = (typeof REVIEW_BOARD_DEFAULT_COLUMNS)[number];

/**
 * Default board name used by `getOrCreateBoard()` when no board exists for
 * the hangar. Single-board until multi-user lands.
 */
export const REVIEW_BOARD_DEFAULT_NAME = 'Hangar Review' as const;

/**
 * Filesystem roots the loader walks for the docs FTS index AND the
 * frontmatter-driven `wp_spec` / `wp_test_plan` / `knowledge_node` discovery
 * rules. Paths are repo-relative; the loader resolves them against the
 * repo root via `process.cwd()` (the hangar dev server runs from the repo
 * root).
 */
export const DOCS_SEARCH_ROOTS = ['docs', 'course', 'handbooks', 'regulations'] as const;
export type DocsSearchRoot = (typeof DOCS_SEARCH_ROOTS)[number];

/**
 * Ad-hoc task `type` values. Kept small + opinionated; the dropdown stays
 * usable without resorting to a free-text field. Matches the project's
 * memory entry ("product taxonomy: product/feature/surface").
 */
export const TASK_TYPE_VALUES = ['bug', 'feature', 'chore', 'investigation', 'follow-up'] as const;
export type TaskType = (typeof TASK_TYPE_VALUES)[number];
export const TASK_TYPE_LABELS: Record<TaskType, string> = {
	bug: 'Bug',
	feature: 'Feature',
	chore: 'Chore',
	investigation: 'Investigation',
	'follow-up': 'Follow-up',
};

/**
 * Product area an ad-hoc task is filed against. Matches the surface-typed
 * monorepo (`apps/study`, `apps/sim`, ...) plus generic platform / docs
 * buckets.
 */
export const PRODUCT_AREA_VALUES = ['hangar', 'study', 'sim', 'flightbag', 'avionics', 'platform', 'docs'] as const;
export type ProductArea = (typeof PRODUCT_AREA_VALUES)[number];
export const PRODUCT_AREA_LABELS: Record<ProductArea, string> = {
	hangar: 'Hangar',
	study: 'Study',
	sim: 'Sim',
	flightbag: 'Flightbag',
	avionics: 'Avionics',
	platform: 'Platform',
	docs: 'Docs',
};

/**
 * Filter chip values shown above the board for the high-level "what kind of
 * card am I looking at" toggle. The chip is a single-select; all/reviews/tasks.
 */
export const REVIEW_BOARD_FILTER_VALUES = ['all', 'reviews', 'tasks'] as const;
export type ReviewBoardFilter = (typeof REVIEW_BOARD_FILTER_VALUES)[number];
export const REVIEW_BOARD_FILTER_LABELS: Record<ReviewBoardFilter, string> = {
	all: 'All',
	reviews: 'Reviews',
	tasks: 'Tasks',
};

/**
 * Form-action ids used by the review surfaces. Centralised so action urls
 * never inline a string literal.
 */
export const REVIEW_ACTIONS = {
	/** Drag-drop a card across columns (board). */
	MOVE: '?/move',
	/** Save a single step outcome inside the test-plan walker. */
	RECORD_STEP: '?/recordStep',
	/** Pause the open session and return to board. */
	PAUSE_SESSION: '?/pauseSession',
	/** Finish the open session (with optional review_status flip). */
	FINISH_SESSION: '?/finishSession',
	/** Manual loader refresh. */
	RUN_LOADER: '?/runLoader',
	/** Mark a spec as read (writes `status: done` to its frontmatter). */
	MARK_SPEC_READ: '?/markSpecRead',
	/** Flip `review_status: done` on a WP spec (confirm-gated). */
	FLIP_REVIEW_STATUS: '?/flipReviewStatus',
	/** Create / update / delete an ad-hoc task. */
	CREATE_TASK: '?/createTask',
	UPDATE_TASK: '?/updateTask',
	DELETE_TASK: '?/deleteTask',
	/** Bucket admin CRUD. */
	CREATE_BUCKET: '?/createBucket',
	UPDATE_BUCKET: '?/updateBucket',
	DELETE_BUCKET: '?/deleteBucket',
} as const;

/**
 * Limit the number of items returned per bucket in the inline drawer. The
 * full-list link routes the reviewer to the bucket detail page when more
 * exist.
 */
export const REVIEW_BUCKET_DRAWER_LIMIT = 10 as const;

/**
 * Hard cap on items returned by `listItems()` to keep the board page render
 * predictable. The board uses `$derived` filtering, so all items are sent
 * client-side; this cap is the safety net.
 */
export const REVIEW_LIST_HARD_CAP = 1000 as const;

/**
 * Hard cap on rows returned by `searchDocs()`. Search returns the top-N
 * ranked rows; the UI scrolls inside the dropdown rather than paginating.
 */
export const DOCS_SEARCH_LIMIT = 50 as const;

/**
 * Debounce window for the docs-search input. Keypresses inside the window
 * cancel the prior request.
 */
export const DOCS_SEARCH_DEBOUNCE_MS = 200 as const;

/**
 * Soft-delete / resurrection window for review items. The loader prunes items
 * whose source artifact disappears by setting `deletedAt` instead of hard
 * deleting, so a temporarily-renamed file doesn't lose its session history
 * when re-discovered.
 */
export const REVIEW_ITEM_RESURRECTION_DAYS = 30 as const;

/**
 * Hard cap on rows returned by `listSessions()` -- the WP-spec view's
 * right-rail session history pulls the most recent N. A heavy reviewer
 * could accumulate hundreds per item over a year; capping the read keeps
 * the page render predictable.
 */
export const REVIEW_SESSION_HISTORY_LIMIT = 20 as const;
