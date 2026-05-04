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
 * Object-literal alias for `REVIEW_BOARD_DEFAULT_COLUMNS` -- DX shortcut so the
 * server-side frontmatter mapper, the page-level "home column" fallback, and
 * the BC's `getDerivedColumnName` all reference the same names through one
 * canonical source. A future rename ("In Progress" -> "Doing") then touches
 * exactly one constant.
 */
export const REVIEW_BOARD_COLUMN_NAMES = {
	BACKLOG: 'Backlog',
	IN_PROGRESS: 'In Progress',
	REVIEW: 'Review',
	DONE: 'Done',
} as const satisfies Record<string, ReviewBoardDefaultColumn>;

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
 * Status-selector values shown on the board's filter bar, narrowing items by
 * frontmatter `status:` (or 'no-status' for kinds without frontmatter, e.g.
 * `ad_hoc`). Single-select.
 */
export const REVIEW_BOARD_STATUS_FILTER_VALUES = ['all', 'unread', 'reading', 'done', 'no-status'] as const;
export type ReviewBoardStatusFilter = (typeof REVIEW_BOARD_STATUS_FILTER_VALUES)[number];
export const REVIEW_BOARD_STATUS_FILTER_LABELS: Record<ReviewBoardStatusFilter, string> = {
	all: 'Any status',
	unread: 'Unread',
	reading: 'Reading',
	done: 'Done',
	'no-status': 'No status',
};

/**
 * Search-param keys the `/review` board reads from / writes to its URL so
 * filter state survives reload, deep-link, and back-button. Kept out of the
 * shared `QUERY_PARAMS` table because the board owns the only callers.
 */
export const REVIEW_BOARD_QUERY_PARAMS = {
	/** Top-of-board chip filter (`all` | `reviews` | `tasks`). */
	TOP: 'top',
	/** Kind filter -- one of `REVIEW_KIND_VALUES` or `'all'`. */
	KIND: 'kind',
	/** Status filter -- one of `REVIEW_BOARD_STATUS_FILTER_VALUES`. */
	STATUS: 'status',
	/** Free-text title/ref substring filter. */
	TEXT: 'q',
	/** `1` when the Done column is hidden; absent / `0` otherwise. */
	HIDE_DONE: 'hideDone',
} as const;

/**
 * Auto-dismiss delays for transient announcements on the `/review` board.
 * The success toast (move complete, loader complete) clears itself after the
 * window so the live region doesn't shout indefinitely.
 */
export const REVIEW_BOARD_TOAST_DISMISS_MS = 6000 as const;
/**
 * Debounce window for the result-count live-region announcement. Without it,
 * each keystroke into the text-search retriggers AT, which is unusable.
 */
export const REVIEW_BOARD_FILTER_ANNOUNCE_DEBOUNCE_MS = 400 as const;

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
 * Hard cap on characters accepted in a single `searchDocs` query. Defends
 * against accidental paste of an entire document; clamped server-side before
 * the query reaches Postgres.
 */
export const DOCS_SEARCH_MAX_QUERY_LEN = 200 as const;

/**
 * Minimum query length before the docs-search popover triggers a backend hit.
 * Below the floor, the popover stays closed (no flicker, no "no matches" on a
 * single character). Two is the conventional command-palette floor.
 */
export const DOCS_SEARCH_MIN_QUERY_LEN = 2 as const;

/**
 * Body slice (in characters) that `ts_headline` runs against. Snippet quality
 * does not meaningfully degrade past the first 16 KB of any doc, but
 * `ts_headline` cost grows with body size; the cap keeps typeahead under the
 * debounce budget on a 658 KB regulation file.
 */
export const DOCS_SEARCH_HEADLINE_BYTES = 16384 as const;

/**
 * In-process TTL (ms) for the docs file-tree cache. Clicking around in the
 * `/docs/**` layout triggers a re-walk of every directory; the cache prevents
 * each click from issuing thousands of `stat` calls. Manually busted on
 * `runLoader` so a fresh sync is reflected immediately.
 */
export const DOCS_TREE_CACHE_TTL_MS = 60_000 as const;

/**
 * Browser cache window for the docs-search JSON endpoint. Repeat searches
 * within the typeahead burst window reuse the prior response instead of
 * re-hitting the DB.
 */
export const DOCS_SEARCH_CACHE_MAX_AGE_S = 10 as const;

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

/**
 * Tabs surfaced on the WP-spec review page. Each tab maps 1:1 to a sibling
 * markdown file in the work-package directory; tabs whose underlying file is
 * missing render a "not present" placeholder rather than a 404 -- a WP that
 * hasn't authored a `user-stories.md` yet is a normal state, not an error.
 *
 * Order is the on-screen tab order (left -> right).
 */
export const WP_SPEC_TABS = [
	{ id: 'spec', label: 'Spec', file: 'spec.md' },
	{ id: 'tasks', label: 'Tasks', file: 'tasks.md' },
	{ id: 'test-plan', label: 'Test Plan', file: 'test-plan.md' },
	{ id: 'design', label: 'Design', file: 'design.md' },
	{ id: 'user-stories', label: 'User Stories', file: 'user-stories.md' },
	{ id: 'review', label: 'Review Notes', file: 'review.md' },
] as const;
export type WpSpecTabId = (typeof WP_SPEC_TABS)[number]['id'];

/**
 * Query-string parameter the WP-spec view reads to decide which tab to
 * highlight on first paint. Centralised so the walker's "back to spec"
 * link can deep-link a specific tab.
 */
export const REVIEW_WP_SPEC_TAB_PARAM = 'tab' as const;

/**
 * Query-string parameters the WP-spec view reads on mount after the walker's
 * Finish redirect, so the spec view can re-display the walker's success
 * toast (the walker page unmounts before its inline toast can be read). The
 * walker writes `?finishedAs=<outcome>&flipped=<0|1>[&fmError=<msg>]`; the
 * spec view reads them once on mount, surfaces the toast, then strips them
 * via `goto({ replaceState: true })`.
 */
export const REVIEW_WP_SPEC_FINISH_PARAMS = {
	FINISHED_AS: 'finishedAs',
	FLIPPED: 'flipped',
	FM_ERROR: 'fmError',
} as const;

/**
 * Query-string parameters the `/review` board reads on mount after a task
 * create / delete redirect lands the user back on the board. The action
 * server appends them; the board surfaces a one-shot toast then strips the
 * params via `goto({ replaceState: true })` so a refresh / share-link
 * doesn't re-show the toast. Mirrors `REVIEW_WP_SPEC_FINISH_PARAMS` -- the
 * closing handshake is essential for destructive / create actions where
 * the only visible feedback is a re-rendered list.
 */
export const REVIEW_TASK_FLOW_PARAMS = {
	/** Set to the new task id after a successful create. */
	CREATED: 'created',
	/** Title of the just-created task (for the toast copy). */
	CREATED_TITLE: 'createdTitle',
	/** Title of the just-deleted task (for the toast copy). */
	DELETED_TITLE: 'deletedTitle',
} as const;

/**
 * Bucket name used by the loader / TOC view's "left bucket" toast copy. The
 * loader seeds this bucket; the TOC finish action reports the bucket name
 * back so the success toast can acknowledge the side-effect ("item left
 * bucket on passing close"). Centralised so a future bucket rename touches
 * one constant rather than hand-edited copy in two places.
 */
export const REVIEW_REFERENCE_TOC_BUCKET_NAME = 'References -- TOC review';

/**
 * Auto-dismiss delay for transient success toasts on the WP-spec / walker
 * surfaces. Errors stay sticky -- the user has to read them and decide on
 * next action. Reuses the board's dismiss window for consistency.
 */
export const REVIEW_WP_SPEC_TOAST_DISMISS_MS = 5000 as const;

/**
 * Walker keyboard shortcut keys. The walker is the highest-volume click
 * surface in the WP and a 50-step plan needs ~100 mouse clicks without a
 * keyboard path. `j` / `k` move between rows; `p` / `f` / `b` pick the
 * outcome on the focused row; `n` jumps focus to the focused row's note
 * textarea so the reviewer can type without taking a hand off the home row.
 *
 * Single source of truth so the in-page cheat sheet, the keydown handler,
 * and any future docs share one set of bindings.
 */
export const WALKER_KEYBOARD_SHORTCUTS = {
	NEXT_STEP: 'j',
	PREV_STEP: 'k',
	OUTCOME_PASS: 'p',
	OUTCOME_FAIL: 'f',
	OUTCOME_BLOCKED: 'b',
	FOCUS_NOTE: 'n',
} as const;
