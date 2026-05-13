import type { ProgramTab } from './program';
import type { AviationTopic, CertApplicability } from './reference-tags';
import type { SimScenarioId } from './sim';
import type { KnowledgePhase, LibraryRegulationsKind, LibraryTestingKind } from './study';

/** Query-string parameter names used across study routes. */
export const QUERY_PARAMS = {
	/** Filters the due-cards queue to a single knowledge node. */
	NODE_ID: 'node',
	/** Session mode override for /session/start. */
	SESSION_MODE: 'mode',
	/** Focus domain override for /session/start. */
	SESSION_FOCUS: 'focus',
	/** Cert override for /session/start. */
	SESSION_CERT: 'cert',
	/** Deterministic seed for engine shuffles. */
	SESSION_SEED: 'seed',

	// Sub-state (view-within-page) keys
	/** Named slug identifying the active stepper stage (e.g. `discover`). */
	STEP: 'step',
	/** 0-based index of the active item within a frozen queue. */
	ITEM: 'item',
	/** Named slug identifying the active tab within a page. */
	TAB: 'tab',
	/**
	 * Active Program sub-tab. Closed value set lives in
	 * `PROGRAM_TAB_VALUES`; the `/program` loader rejects out-of-set values
	 * by falling back to the default tab. Distinct from `TAB` so the
	 * `/program` shape is grep-able when a future surface grows its own
	 * `?tab=` semantics. study-app-ia-cleanup Phase 2.
	 */
	PROGRAM_TAB: 'tab',
	/** Boolean-ish mode flag; `1` means edit mode is active. */
	EDIT: 'edit',
	/** One-shot banner carrying the id of a just-created entity. */
	CREATED: 'created',
	/** Page-help drawer target id; when set, `<PageHelp>` opens its drawer on mount. */
	HELP: 'help',

	// Filter / browse keys
	/**
	 * Base64url'd canonical-JSON deck spec for `/memory/review?deck=<...>` (Layer (b)
	 * Redo). Decoded server-side; no DB lookup needed. See
	 * `docs/work-packages/review-sessions-url/spec.md` decision (2).
	 */
	DECK: 'deck',
	/** Phase-of-flight filter on browse pages (renamed from legacy `phase`). */
	FLIGHT_PHASE: 'flight-phase',
	/** Domain filter. */
	DOMAIN: 'domain',
	/** Cert filter. */
	CERT: 'cert',
	/** Relevance-priority filter. */
	PRIORITY: 'priority',
	/** Node-lifecycle filter. */
	LIFECYCLE: 'lifecycle',
	/** Difficulty filter. */
	DIFFICULTY: 'difficulty',
	/** Content-source filter. */
	SOURCE: 'source',
	/** Status filter. */
	STATUS: 'status',
	/** Memory-card type filter. */
	CARD_TYPE: 'type',
	/** Memory-card knowledge-kind filter (recall vs calculation). evidence-kind-data-layer WP. */
	CARD_KIND: 'kind',
	/** Comma-separated tag carry-over ("save and add another" flow). */
	TAGS: 'tags',
	/** Free-text search query. */
	SEARCH: 'q',
	/** 1-based page number for paginated browse. */
	PAGE: 'page',
	/** Items-per-page for paginated browse (one of `BROWSE_PAGE_SIZE_VALUES`). */
	PAGE_SIZE: 'size',
	/** Group-by bucket for the Browse list (one of `BROWSE_GROUP_BY_VALUES`). */
	GROUP_BY: 'group',
	/**
	 * Edition pin. When present on `/library/[doc]/...` routes the loader
	 * resolves the named edition instead of the latest non-superseded one.
	 * Used by the "newer edition available" banner so a learner can keep
	 * reading the older edition without losing their citation context.
	 */
	EDITION: 'edition',
	/** Library index state filter (`all` | `in-app` | `external`). */
	LIBRARY_STATE: 'state',

	// Targeted, per-route keys (added 2026-04-27 to satisfy the no-magic-string rule).
	/** Post-login redirect target. */
	REDIRECT_TO: 'redirectTo',
	/** Polling cursor for /jobs/[id]/log. */
	SINCE_SEQ: 'sinceSeq',
	/** Citation picker `target` param (regulation / ac / handbook). */
	TARGET: 'target',
	/** Hangar /jobs filter: job kind. Also reused by hangar `/ingest-review` for issue kind. */
	KIND: 'kind',
	/** Hangar /ingest-review filter: corpus (`handbook` | `regs` | `knowledge`). */
	CORPUS: 'corpus',
	/** Hangar /glossary filter: rule set. */
	RULES: 'rules',
	/** Hangar /glossary filter: format. */
	FORMAT: 'format',
	/** Hangar /glossary filter: dirty rows only. */
	DIRTY: 'dirty',
	/** Filename param on /sources/[id]/files/raw. */
	NAME: 'name',
	/** Render-mode override on /references dev page. */
	MODE: 'mode',
	/**
	 * Active view selector on the `/notes` index. Closed value set lives in
	 * `NOTES_VIEW_VALUES`; the loader rejects out-of-set values by falling
	 * back to `NOTES_VIEW_DEFAULT`.
	 */
	VIEW: 'view',
	/**
	 * Optional context-FK pre-fill on `/notes/new`. Each is a column on
	 * `study.note`; the creator form picks the value up so a "+ Note from
	 * here" affordance from any surface can hand off context without form
	 * state.
	 */
	NOTE_REFERENCE_ID: 'referenceId',
	NOTE_REFERENCE_SECTION_ID: 'referenceSectionId',
	NOTE_KNOWLEDGE_NODE_ID: 'knowledgeNodeId',
	NOTE_COURSE_ID: 'courseId',
	NOTE_GOAL_ID: 'goalId',
	NOTE_SYLLABUS_NODE_ID: 'syllabusNodeId',

	/**
	 * Card-draft prefill on `/memory/new` (wp-flightbag-rich-reader Phase 3).
	 * When set, the form pre-fills from the matching `study.card_draft` row
	 * and the submit handler stamps the draft as promoted.
	 */
	DRAFT: 'draft',

	// Hangar /admin/audit filters (audit-explorer WP).
	/** Resolved actor user id (hangar audit explorer). */
	AUDIT_ACTOR: 'actor',
	/** `audit_log.target_type` exact match. */
	AUDIT_TARGET_TYPE: 'targetType',
	/** `audit_log.target_id` exact match. */
	AUDIT_TARGET_ID: 'targetId',
	/** `audit_log.op` exact match. */
	AUDIT_OP: 'op',
	/** Inclusive lower bound on `audit_log.timestamp` (ISO datetime). */
	AUDIT_FROM: 'from',
	/** Inclusive upper bound on `audit_log.timestamp` (ISO datetime). */
	AUDIT_TO: 'to',
	/** Time-window preset: one of AUDIT_WINDOW_VALUES. */
	AUDIT_WINDOW: 'window',
	/** Cursor pagination token: `${timestampISO}::${id}`. */
	AUDIT_CURSOR: 'cursor',
} as const;

export const ROUTES = {
	// Common
	HOME: '/',
	LOGIN: '/login',
	LOGOUT: '/logout',
	API_AUTH: '/api/auth',
	/** Appearance-preference endpoint. POST `{ value: 'light'|'dark'|'system' }`. */
	APPEARANCE: '/appearance',
	/** Theme-preference endpoint. POST `{ value: '<registered theme id>' }`. */
	THEME: '/theme',
	/**
	 * Reading-prefs endpoint (WP-FLIGHTBAG-READER-UX Phase 3). POST
	 * `{ key: <USER_PREF_KEYS.READING_*>, value: <validated-per-key> }`.
	 * Mirrored on flightbag and study so each app can persist prefs from
	 * its own origin without a cross-origin POST. Auth-gated.
	 */
	READING_PREFS: '/reading-prefs',
	/**
	 * Citation picker search endpoint. GET `?target=<CitationTargetType>&q=<term>`
	 * returns `{ results: { id, label, detail }[] }`. Auth-gated.
	 */
	API_CITATIONS_SEARCH: '/api/citations/search',
	/**
	 * Page explainer dismissal endpoint. POST `{ pageKey: string, dismissed: boolean }`
	 * persists the per-user, per-page-key dismissal flag for `<PageExplainer>`.
	 * Returns `{ ok: true }` on success. Auth-gated.
	 */
	API_PAGE_EXPLAINER: '/api/page-explainer',

	/**
	 * `POST` endpoint where the root layout's `window.onerror` /
	 * `window.onunhandledrejection` handlers ship browser-only errors so
	 * they land in the same server log stream as HTTP failures. Anonymous
	 * callers permitted (errors on `/login` matter); per-request size
	 * capped, per-IP rate limited.
	 */
	API_CLIENT_ERROR: '/api/client-error',

	/**
	 * Post-login default landing surface for the study app (study-home WP).
	 * Replaces `/dashboard` as the primary destination; `/dashboard` survives
	 * at its existing URL as the "Stats" power-user view.
	 */
	STUDY: '/study',

	/**
	 * `/study/learn` -- the consolidated Learn section index (study-app-ia-
	 * cleanup Phase 4). Tab-strip surface that aggregates Cards (`/memory`),
	 * Reps (`/reps`), and Read (`/library`) into one section without
	 * relocating their underlying URLs. The Memory and Reps URLs stay where
	 * they are; their nav surface is unified here. Replaces the dropdown
	 * pattern that used to expose Memory child routes from the top nav.
	 */
	LEARN: '/study/learn',

	/**
	 * Flight-logging surface root. WP 1 ships this as a placeholder; WP 2
	 * (`flight-evidence-and-cfi-feedback`) lands the real list / new / detail
	 * pages and the debrief invite flow.
	 */
	FLIGHT: '/flight',
	FLIGHT_NEW: '/flight/new',
	FLIGHT_DETAIL: (id: string) => `/flight/${encodeURIComponent(id)}` as const,
	/** Student-side modal route to open the InviteTeacherDialog from a flight detail page. WP 2. */
	FLIGHT_INVITE: (id: string) => `/flight/${encodeURIComponent(id)}/invite` as const,

	// Study -- Teacher surfaces (WP 2: flight-evidence-and-cfi-feedback)
	/** Entry / fallback for users without the `teacher` role. */
	TEACH: '/teach',
	/** A teacher's list of active student links. */
	TEACH_STUDENTS: '/teach/students',
	TEACH_STUDENT_DETAIL: (studentId: string) => `/teach/students/${encodeURIComponent(studentId)}` as const,
	TEACH_ATTEMPT_REVIEW: (studentId: string, attemptId: string) =>
		`/teach/students/${encodeURIComponent(studentId)}/attempts/${encodeURIComponent(attemptId)}` as const,
	/** Teacher's own teaching syllabus authoring surface. */
	TEACH_SYLLABUS: '/teach/syllabus',
	/**
	 * Public route gated only by the magic-link token. The only non-auth-gated
	 * mutation surface in study; the route layer explicitly allows it past
	 * the layout-level auth gate. Per Decisions 8/9/10 in the WP 2 spec.
	 */
	TEACH_DEBRIEF: (token: string) => `/teach/debrief/${encodeURIComponent(token)}` as const,

	/**
	 * @deprecated Phase 3 of `study-app-ia-cleanup` renamed `/dashboard` to
	 * `/insights`. Prefer `INSIGHTS`. Hooks-level 301 redirect keeps
	 * external bookmarks working until 6 months post-Phase 3.
	 */
	DASHBOARD: '/insights',

	// Study -- Memory
	MEMORY: '/memory',
	MEMORY_REVIEW: '/memory/review',
	/**
	 * Session-scoped review URL (review-sessions-url layer a "Resume"). The
	 * `/memory/review` entry point creates a session row and redirects here so
	 * the learner's position is durable across tabs and reloads. See
	 * `docs/work-packages/review-sessions-url/spec.md`.
	 */
	MEMORY_REVIEW_SESSION: (sessionId: string) => `/memory/review/${encodeURIComponent(sessionId)}` as const,
	MEMORY_NEW: '/memory/new',
	MEMORY_BROWSE: '/memory/browse',
	/**
	 * Card-draft inbox (wp-flightbag-rich-reader Phase 3). Lists open drafts
	 * (`promoted_at IS NULL`) queued from the flightbag selection toolbar's
	 * "Card later" action. Each row offers Edit + promote / Promote as-is /
	 * Discard.
	 */
	MEMORY_DRAFTS: '/memory/drafts',
	MEMORY_DRAFT_DETAIL: (id: string) => `/memory/drafts/${encodeURIComponent(id)}` as const,
	MEMORY_CARD: (id: string) => `/memory/${id}` as const,
	/**
	 * Path pattern for the memory-card detail surface, used by help-page
	 * `documents:` metadata where the route is referenced as a shape rather
	 * than navigated to. Runtime navigation still uses `MEMORY_CARD(id)`.
	 */
	MEMORY_CARD_PATTERN: '/memory/[id]',
	/** Detail page with the inline edit-mode flag set. */
	MEMORY_CARD_EDIT: (id: string) => `/memory/${encodeURIComponent(id)}?${QUERY_PARAMS.EDIT}=1` as const,
	/**
	 * Public shareable card view (`card-page-and-cross-references`). No
	 * scheduling internals, no edit controls, no auth requirement. Suspended
	 * and archived cards 404 on this route; the owner-only `/memory/<id>`
	 * surface still shows them.
	 */
	CARD_PUBLIC: (id: string) => `/cards/${encodeURIComponent(id)}` as const,

	// Study -- Notes (wp-notes-primitive). Standalone primitive: a markdown
	// thought attached to optional context (reference / section / knowledge
	// node / course / goal / syllabus node) plus free-form tags. Reachable
	// from the global "+ Note" affordance and from per-context surfaces in
	// later phases.
	NOTES: '/notes',
	NOTES_NEW: '/notes/new',
	NOTE_DETAIL: (id: string) => `/notes/${encodeURIComponent(id)}` as const,
	/**
	 * Path pattern for the note detail surface, used by help-page metadata
	 * + e2e selectors where the route is referenced as a shape rather than
	 * navigated to. Runtime navigation still uses `NOTE_DETAIL(id)`.
	 */
	NOTE_DETAIL_PATTERN: '/notes/[id]',
	/** Detail page with the inline edit-mode flag set. */
	NOTE_EDIT: (id: string) => `/notes/${encodeURIComponent(id)}?${QUERY_PARAMS.EDIT}=1` as const,
	/**
	 * Filtered index. `view` is one of `NOTES_VIEW_VALUES`; the loader
	 * rejects out-of-set values by falling back to `NOTES_VIEW_DEFAULT`.
	 */
	NOTES_FILTER: (view: 'all' | 'follow-ups' | 'archived' | 'by-context' | 'highlights') =>
		`/notes?${QUERY_PARAMS.VIEW}=${view}` as const,

	// Study -- Reps
	// `REPS_SESSION` retired by ADR 012 phase 3; the `/reps/session` route
	// was deleted in phase 6. The remaining `/reps` surfaces survive ADR
	// 012 because they are substrate-independent: `REPS` is the scheduled-
	// queue dashboard, `REPS_BROWSE` is the rep library, and `REPS_NEW` is
	// the authoring flow. All rep *runtime* entry points (solving a rep in
	// a session) now go through `SESSION_START` -> `SESSION_ID`.
	REPS: '/reps',
	REPS_BROWSE: '/reps/browse',
	REPS_NEW: '/reps/new',
	/**
	 * Detail page for a single scenario. Peer affordance with
	 * `MEMORY_CARD` and `KNOWLEDGE_SLUG` so the session-start preview can
	 * expose the rep ID as a real link (not just a mono-label).
	 */
	REP_DETAIL: (id: string) => `/reps/${encodeURIComponent(id)}` as const,

	// Study -- Insights surface (study-app-ia-cleanup Phase 3). Renames the
	// legacy `/dashboard` to `/insights` and folds calibration + lens
	// detail surfaces underneath. The legacy `DASHBOARD`, `CALIBRATION`,
	// and `LENS_*` constants below are kept as deprecated aliases that
	// point to the new canonical paths so any caller that still grabs the
	// old constant lands on the new URL (`hooks.server.ts` 301-redirects
	// the legacy paths so external bookmarks keep working).
	INSIGHTS: '/insights',
	INSIGHTS_CALIBRATION: '/insights/calibration',
	INSIGHTS_LENS: '/insights/lens',
	INSIGHTS_LENS_HANDBOOK: '/insights/lens/handbook',
	INSIGHTS_LENS_HANDBOOK_DOC: (doc: string) => `/insights/lens/handbook/${encodeURIComponent(doc)}` as const,
	INSIGHTS_LENS_HANDBOOK_CHAPTER: (doc: string, chapter: string | number) =>
		`/insights/lens/handbook/${encodeURIComponent(doc)}/${encodeURIComponent(String(chapter))}` as const,
	INSIGHTS_LENS_WEAKNESS: '/insights/lens/weakness',
	INSIGHTS_LENS_WEAKNESS_BUCKET: (severity: string) =>
		`/insights/lens/weakness/${encodeURIComponent(severity)}` as const,

	// Study -- Reference surface (study-app-ia-cleanup Phase 3). Folds the
	// knowledge graph + glossary under one section index so the user has
	// one mental destination for "look things up". The legacy `KNOWLEDGE*`
	// and `GLOSSARY*` constants below are kept as deprecated aliases.
	REFERENCE: '/reference',
	REFERENCE_KNOWLEDGE: '/reference/knowledge',
	REFERENCE_KNOWLEDGE_SLUG: (slug: string) => `/reference/knowledge/${slug}` as const,
	REFERENCE_KNOWLEDGE_LEARN: (slug: string) => `/reference/knowledge/${slug}/learn` as const,
	REFERENCE_KNOWLEDGE_LEARN_AT: (slug: string, phase: KnowledgePhase) =>
		`/reference/knowledge/${slug}/learn?${QUERY_PARAMS.STEP}=${encodeURIComponent(phase)}` as const,
	REFERENCE_GLOSSARY: '/reference/glossary',
	REFERENCE_GLOSSARY_ID: (id: string) => `/reference/glossary/${encodeURIComponent(id)}` as const,

	/**
	 * @deprecated Phase 3 of `study-app-ia-cleanup` renamed `/calibration` to
	 * `/insights/calibration`. Prefer `INSIGHTS_CALIBRATION`. Hooks-level
	 * 301 redirect keeps external links working until 6 months post-Phase 3.
	 */
	CALIBRATION: '/insights/calibration',

	/**
	 * @deprecated Phase 3 of `study-app-ia-cleanup` renamed `/glossary` to
	 * `/reference/glossary`. Prefer `REFERENCE_GLOSSARY`.
	 */
	GLOSSARY: '/reference/glossary',
	/**
	 * @deprecated Prefer `REFERENCE_GLOSSARY_ID`. Same shape, new path.
	 */
	GLOSSARY_ID: (id: string) => `/reference/glossary/${encodeURIComponent(id)}` as const,

	// Study -- Library (LEGACY -- redirects to the flightbag).
	//
	// Per ADR 023 + WP-FLIGHTBAG-READER-UX Phase 2, the canonical reference
	// browse + reader surface lives in the flightbag app. Every `LIBRARY_*`
	// constant below now resolves to a study URL that 301s to its flightbag
	// equivalent. The constants stay exported (for stable in-flight callers)
	// but every new caller MUST use the corresponding `FLIGHTBAG_*` constant
	// + the cross-app origin (`siblingOrigin(url, HOST_PREFIXES.FLIGHTBAG)`)
	// so links don't take an extra HTTP roundtrip.
	/**
	 * @deprecated Use `FLIGHTBAG_HOME` on the flightbag origin. The legacy
	 * `/library` URL 301s to the flightbag landing.
	 */
	LIBRARY: '/library',
	/**
	 * @deprecated Use the flightbag catalog with a future `?cert=` filter
	 * once that surface ships. The legacy URL 301s to the flightbag landing.
	 *
	 * Cert spine -- references whose `primary_cert` matches plus carryover
	 * groups inherited via the prereq DAG. See `library-by-cert` BC.
	 */
	LIBRARY_CERT: (cert: CertApplicability) => `/library/cert/${encodeURIComponent(cert)}` as const,
	/**
	 * @deprecated Use the flightbag catalog with a future `?topic=` filter.
	 * The legacy URL 301s to the flightbag landing.
	 */
	LIBRARY_TOPIC: (topic: AviationTopic) => `/library/topic/${encodeURIComponent(topic)}` as const,
	/**
	 * @deprecated Use `FLIGHTBAG_HOME` on the flightbag origin.
	 */
	LIBRARY_REGULATIONS: '/library/regulations',
	/**
	 * @deprecated Use `FLIGHTBAG_HOME` on the flightbag origin.
	 */
	LIBRARY_REGULATIONS_KIND: (kind: LibraryRegulationsKind) =>
		`/library/regulations/${encodeURIComponent(kind)}` as const,
	/**
	 * @deprecated Use `FLIGHTBAG_CFR_PART` (CFR), `FLIGHTBAG_AIM_CHAPTER`
	 * (AIM), or `FLIGHTBAG_AC` (AC) on the flightbag origin.
	 */
	LIBRARY_REGULATIONS_GROUP: (kind: LibraryRegulationsKind, group: string) =>
		`/library/regulations/${encodeURIComponent(kind)}/${encodeURIComponent(group)}` as const,
	/**
	 * @deprecated Use `FLIGHTBAG_CFR_SECTION` / `FLIGHTBAG_AIM_SECTION` on
	 * the flightbag origin.
	 */
	LIBRARY_REGULATIONS_SECTION: (kind: LibraryRegulationsKind, group: string, section: string) =>
		`/library/regulations/${encodeURIComponent(kind)}/${encodeURIComponent(group)}/${encodeURIComponent(section)}` as const,
	/**
	 * @deprecated Use `FLIGHTBAG_HOME` on the flightbag origin.
	 */
	LIBRARY_TESTING: '/library/testing',
	/**
	 * @deprecated Use `FLIGHTBAG_ACS` on the flightbag origin.
	 */
	LIBRARY_TESTING_DETAIL: (slug: string) => `/library/testing/${encodeURIComponent(slug)}` as const,
	/**
	 * @deprecated Use `FLIGHTBAG_HOME` on the flightbag origin.
	 */
	LIBRARY_TESTING_KIND: (kind: LibraryTestingKind) => `/library/testing?kind=${encodeURIComponent(kind)}` as const,
	/**
	 * @deprecated Use `FLIGHTBAG_HANDBOOK` on the flightbag origin (note:
	 * the flightbag URL takes an explicit `edition` argument; resolve the
	 * latest non-superseded edition via `getReferenceByDocument`).
	 */
	LIBRARY_HANDBOOK: (slug: string) => `/library/handbook/${encodeURIComponent(slug)}` as const,
	/**
	 * @deprecated Use `FLIGHTBAG_HANDBOOK_CHAPTER` on the flightbag origin.
	 */
	LIBRARY_HANDBOOK_CHAPTER: (slug: string, chapter: number | string) =>
		`/library/handbook/${encodeURIComponent(slug)}/${encodeURIComponent(String(chapter))}` as const,
	/**
	 * @deprecated Use `FLIGHTBAG_HANDBOOK_SECTION` on the flightbag origin.
	 */
	LIBRARY_HANDBOOK_SECTION: (slug: string, chapter: number | string, section: number | string) =>
		`/library/handbook/${encodeURIComponent(slug)}/${encodeURIComponent(String(chapter))}/${encodeURIComponent(String(section))}` as const,
	/**
	 * @deprecated Use `FLIGHTBAG_SECTION_HEARTBEAT(sectionId)` on the
	 * flightbag origin. Path-keyed on section id, not on doc-locator tuple.
	 */
	LIBRARY_HANDBOOK_SECTION_HEARTBEAT: (slug: string, chapter: number | string, section: number | string) =>
		`/library/handbook/${encodeURIComponent(slug)}/${encodeURIComponent(String(chapter))}/${encodeURIComponent(String(section))}/heartbeat` as const,
	/**
	 * @deprecated Use `FLIGHTBAG_HOME` on the flightbag origin. The flightbag
	 * has no per-aircraft (POH/AFM) reader surface yet; the legacy URL returns
	 * 410 Gone with a pointer to the flightbag catalog.
	 */
	LIBRARY_AIRCRAFT_LANDING: '/library/aircraft',
	/**
	 * @deprecated Use `FLIGHTBAG_HOME` on the flightbag origin. The legacy
	 * URL returns 410 Gone (no per-aircraft reader exists yet).
	 */
	LIBRARY_AIRCRAFT: (slug: string) => `/library/aircraft/${encodeURIComponent(slug)}` as const,
	/**
	 * @deprecated Use `FLIGHTBAG_HOME` on the flightbag origin.
	 */
	LIBRARY_ADVISORIES: '/library/advisories',
	/**
	 * @deprecated Use `FLIGHTBAG_SAFO(id)` / `FLIGHTBAG_INFO(id)` on the
	 * flightbag origin (slug shape `safo-23001` -> `<id> = 23001`).
	 */
	LIBRARY_ADVISORIES_DETAIL: (slug: string) => `/library/advisories/${encodeURIComponent(slug)}` as const,

	// Study -- Invite acceptance (hangar-invite-flow WP).
	// Public route -- the token IS the credential. Lives outside the
	// `(app)` group so the layout-level auth gate doesn't apply, mirroring
	// `/login`'s placement. The accept page is the only non-auth-gated
	// mutation surface in study; see decision (i) in
	// `docs/work-packages/hangar-invite-flow/spec.md`.
	STUDY_INVITE_ACCEPT: (token: string) => `/invite/${encodeURIComponent(token)}` as const,
	/** Form-action id used by the accept page's redemption form. */
	STUDY_INVITE_ACCEPT_ACTION: '?/accept',

	// Study -- Help (per-app help content; primitives shared via @ab/help)
	HELP: '/help',
	HELP_CONCEPTS: '/help/concepts',
	HELP_ID: (id: string) => `/help/${encodeURIComponent(id)}` as const,

	// Study -- Knowledge nodes
	NODES: '/nodes',
	NODE: (id: string) => `/nodes/${id}` as const,

	/**
	 * @deprecated Phase 3 of `study-app-ia-cleanup` moved `/knowledge` under
	 * `/reference/knowledge`. Prefer `REFERENCE_KNOWLEDGE`.
	 */
	KNOWLEDGE: '/reference/knowledge',
	/** @deprecated Prefer `REFERENCE_KNOWLEDGE_SLUG`. */
	KNOWLEDGE_SLUG: (slug: string) => `/reference/knowledge/${slug}` as const,
	/** @deprecated Prefer `REFERENCE_KNOWLEDGE_LEARN`. */
	KNOWLEDGE_LEARN: (slug: string) => `/reference/knowledge/${slug}/learn` as const,
	/** @deprecated Prefer `REFERENCE_KNOWLEDGE_LEARN_AT`. */
	KNOWLEDGE_LEARN_AT: (slug: string, phase: KnowledgePhase) =>
		`/reference/knowledge/${slug}/learn?${QUERY_PARAMS.STEP}=${encodeURIComponent(phase)}` as const,
	/**
	 * Node-filtered review: appends `?node=...` to the existing review flow
	 * so the server load can narrow the due-cards query without introducing
	 * a parallel route.
	 */
	MEMORY_REVIEW_FOR_NODE: (nodeId: string) =>
		`/memory/review?${QUERY_PARAMS.NODE_ID}=${encodeURIComponent(nodeId)}` as const,

	// Study -- Program surface (study-app-ia-cleanup Phase 2). Quals + Goal
	// + Plan + Coverage roll onto one `/program` page with sub-tabs. The
	// constants below are the canonical paths; the legacy `/credentials`,
	// `/goals`, `/plans` paths are deferred to Phase 3 redirects (and will
	// keep working until 6 months after Phase 3 ships per design.md).
	PROGRAM: '/program',
	/** `/program?tab=<tab>` -- direct deep link to a sub-tab. */
	PROGRAM_TAB: (tab: ProgramTab) => `/program?${QUERY_PARAMS.PROGRAM_TAB}=${encodeURIComponent(tab)}` as const,
	/** Quals tab index (list of credentials). */
	PROGRAM_QUALS: '/program/quals',
	/** Single qualification (credential) detail page. */
	PROGRAM_QUAL: (slug: string) => `/program/quals/${encodeURIComponent(slug)}` as const,
	PROGRAM_QUAL_AREA: (slug: string, areaCode: string) =>
		`/program/quals/${encodeURIComponent(slug)}/areas/${encodeURIComponent(areaCode)}` as const,
	PROGRAM_QUAL_TASK: (slug: string, areaCode: string, taskCode: string) =>
		`/program/quals/${encodeURIComponent(slug)}/areas/${encodeURIComponent(areaCode)}/tasks/${encodeURIComponent(taskCode)}` as const,
	/**
	 * Edition-pinned qualification URL. Default loader resolves the
	 * qualification's primary syllabus's latest active edition; this
	 * variant keeps a learner mid-prep on the older edition they started on.
	 */
	PROGRAM_QUAL_AT_EDITION: (slug: string, edition: string) =>
		`/program/quals/${encodeURIComponent(slug)}?${QUERY_PARAMS.EDITION}=${encodeURIComponent(edition)}` as const,
	/** Goals tab index (list of goals). */
	PROGRAM_GOALS: '/program/goals',
	PROGRAM_GOALS_NEW: '/program/goals/new',
	PROGRAM_GOAL: (id: string) => `/program/goals/${encodeURIComponent(id)}` as const,
	PROGRAM_GOAL_EDIT: (id: string) => `/program/goals/${encodeURIComponent(id)}?${QUERY_PARAMS.EDIT}=1` as const,
	/** Form-action id on /program/goals/[id]: add a course to the goal (course-reader-and-editor WP). */
	STUDY_GOAL_ADD_COURSE_ACTION: '?/addCourse',
	/** Form-action id on /program/goals/[id]: remove a course from the goal. */
	STUDY_GOAL_REMOVE_COURSE_ACTION: '?/removeCourse',
	/** Form-action id on /program/goals/[id]: change a goal_course row's weight. */
	STUDY_GOAL_SET_COURSE_WEIGHT_ACTION: '?/setCourseWeight',
	/** Plans tab index. */
	PROGRAM_PLANS: '/program/plans',
	PROGRAM_PLANS_NEW: '/program/plans/new',
	PROGRAM_PLAN: (id: string) => `/program/plans/${encodeURIComponent(id)}` as const,
	/** Coverage tab -- read-only summary of qual / goal / plan coverage. */
	PROGRAM_COVERAGE: '/program/coverage',

	// Study -- Lens UI (lens-ui WP, ADR 016 phase 8). Phase 3 of
	// `study-app-ia-cleanup` moved `/lens/*` under `/insights/lens/*`; the
	// constants below are deprecated aliases that point at the new
	// canonical paths. The hooks redirect map handles external bookmarks.
	/**
	 * @deprecated Prefer `INSIGHTS_LENS`. Used by nav-active prefix checks
	 * before Phase 3; new prefix checks should compare against `INSIGHTS_LENS`.
	 */
	LENS: '/insights/lens',
	/**
	 * Handbook / regulation figure asset stream. The `[...path]` server route
	 * resolves `path` against the handbook cache root and pipes the file body.
	 * Callers strip any leading slash before passing in.
	 */
	HANDBOOK_ASSET: (path: string) => `/handbook-asset/${path}` as const,
	/** @deprecated Prefer `INSIGHTS_LENS_HANDBOOK`. */
	LENS_HANDBOOK: '/insights/lens/handbook',
	/** @deprecated Prefer `INSIGHTS_LENS_HANDBOOK_DOC`. */
	LENS_HANDBOOK_DOC: (doc: string) => `/insights/lens/handbook/${encodeURIComponent(doc)}` as const,
	/** @deprecated Prefer `INSIGHTS_LENS_HANDBOOK_CHAPTER`. */
	LENS_HANDBOOK_CHAPTER: (doc: string, chapter: string | number) =>
		`/insights/lens/handbook/${encodeURIComponent(doc)}/${encodeURIComponent(String(chapter))}` as const,
	/** @deprecated Prefer `INSIGHTS_LENS_WEAKNESS`. */
	LENS_WEAKNESS: '/insights/lens/weakness',
	/** @deprecated Prefer `INSIGHTS_LENS_WEAKNESS_BUCKET`. */
	LENS_WEAKNESS_BUCKET: (severity: string) => `/insights/lens/weakness/${encodeURIComponent(severity)}` as const,

	// Study -- Sessions (Plans moved under `/program/plans` in Phase 2 of
	// study-app-ia-cleanup; see PROGRAM_PLAN* above).
	SESSION_START: '/session/start',
	SESSIONS: '/sessions',
	SESSION: (id: string) => `/sessions/${id}` as const,
	/** Session pinned to a 0-based item index. */
	SESSION_AT: (id: string, itemIndex: number) =>
		`/sessions/${encodeURIComponent(id)}?${QUERY_PARAMS.ITEM}=${itemIndex}` as const,
	SESSION_SUMMARY: (id: string) => `/sessions/${id}/summary` as const,

	// Avionics (apps/avionics) -- glass-cockpit PFD trainer. Served from its
	// own host (avionics.airboss.test), so these paths are relative to that
	// origin. Surface-typed sibling to sim/study/hangar; renders tape-style
	// glass instruments rather than sim's round-dial set.
	AVIONICS_HOME: '/',
	AVIONICS_PFD: '/pfd',
	AVIONICS_MFD: '/mfd',
	AVIONICS_SCAN: '/scan',
	AVIONICS_AIRCRAFT: '/aircraft',

	// Sim (apps/sim) -- flight dynamics prototype. Sim is served from its own
	// host (sim.airboss.test), so these paths are relative to that origin.
	SIM_HOME: '/',
	SIM_SCENARIO: (id: SimScenarioId) => `/${id}` as const,
	SIM_SCENARIO_DEBRIEF: (id: SimScenarioId) => `/${id}/debrief` as const,
	/** Outside-the-cockpit 3D horizon view (Phase 7); sibling page to the cockpit. */
	SIM_SCENARIO_HORIZON: (id: SimScenarioId) => `/${id}/horizon` as const,
	/** Combined surface: 3D horizon + primary instruments composed side-by-side. */
	SIM_SCENARIO_DUAL: (id: SimScenarioId) => `/${id}/dual` as const,
	/** Windowed surface: 3D horizon full-bleed with the instrument panel overlaid. */
	SIM_SCENARIO_WINDOW: (id: SimScenarioId) => `/${id}/window` as const,
	/**
	 * Glass PFD demo -- mounts the shared `@ab/activities/pfd/Pfd.svelte`
	 * primary flight display inside sim's chrome. Sim is the second
	 * consumer of the PFD set after avionics; the components live in
	 * `libs/activities/src/pfd/` per the extract-sim-instruments work
	 * package.
	 */
	SIM_GLASS_PFD: '/glass-pfd',
	/** Sim history dashboard -- recent attempts for the authenticated learner. */
	SIM_HISTORY: '/history',
	/** Per-attempt detail view; includes the full per-component grade breakdown. */
	SIM_HISTORY_DETAIL: (attemptId: string) => `/history/${encodeURIComponent(attemptId)}` as const,

	// Hangar (apps/hangar) -- admin surface for data-management. Served from
	// its own host (hangar.airboss.test), so these paths are relative to that
	// origin. Role-gated to AUTHOR | OPERATOR | ADMIN.
	HANGAR_HOME: '/',
	HANGAR_GLOSSARY: '/glossary',
	HANGAR_GLOSSARY_NEW: '/glossary/new',
	HANGAR_GLOSSARY_DETAIL: (id: string) => `/glossary/${encodeURIComponent(id)}` as const,
	HANGAR_GLOSSARY_SOURCES: '/glossary/sources',
	HANGAR_GLOSSARY_SOURCES_NEW: '/glossary/sources/new',
	HANGAR_GLOSSARY_SOURCES_DETAIL: (id: string) => `/glossary/sources/${encodeURIComponent(id)}` as const,
	/** Form-action id: save edits on a glossary reference detail page (`?/save`). */
	HANGAR_GLOSSARY_SAVE_ACTION: '?/save',
	/** Form-action id: soft-delete a glossary reference / source (`?/delete`). */
	HANGAR_GLOSSARY_DELETE_ACTION: '?/delete',
	// Hangar -- /sources operational surface (wp-hangar-sources-v1).
	HANGAR_SOURCES: '/sources',
	HANGAR_SOURCE_DETAIL: (id: string) => `/sources/${encodeURIComponent(id)}` as const,
	HANGAR_SOURCE_FILES: (id: string) => `/sources/${encodeURIComponent(id)}/files` as const,
	/** Stream a single file inside a source's data directory (text-source preview embeds). */
	HANGAR_SOURCE_FILE_RAW: (id: string, name: string) =>
		`/sources/${encodeURIComponent(id)}/files/raw?name=${encodeURIComponent(name)}` as const,
	HANGAR_SOURCE_DIFF: (id: string) => `/sources/${encodeURIComponent(id)}/diff` as const,
	HANGAR_SOURCE_UPLOAD: (id: string) => `/sources/${encodeURIComponent(id)}/upload` as const,
	/** Binary-visual: stream the full archive from disk with content-disposition: attachment. */
	HANGAR_SOURCE_DOWNLOAD: (id: string) => `/sources/${encodeURIComponent(id)}/download` as const,
	/** Binary-visual: static thumbnail image served from the hangar blob root (`<cache>/hangar-blobs/<type>/<id>/<edition>/`). */
	HANGAR_SOURCE_THUMBNAIL: (id: string) => `/sources/${encodeURIComponent(id)}/thumbnail` as const,
	/** Operational form actions on a source. */
	HANGAR_SOURCE_FETCH_ACTION: '?/fetch',
	HANGAR_SOURCE_EXTRACT_ACTION: '?/extract',
	HANGAR_SOURCE_DIFF_ACTION: '?/diff',
	HANGAR_SOURCE_VALIDATE_ACTION: '?/validate',
	/** Form-action id: delete an archived file under a source's data dir (`?/delete`). */
	HANGAR_SOURCE_FILE_DELETE_ACTION: '?/delete',
	/** Form-action id on /sources/[id]/diff: enqueue a fresh diff job. */
	HANGAR_SOURCE_DIFF_ENQUEUE_ACTION: '?/enqueue',
	/** Form-action id on /sources/[id]/diff: promote staged diff to canonical. */
	HANGAR_SOURCE_DIFF_COMMIT_ACTION: '?/commit',
	/** Global flow-level actions on /sources. */
	HANGAR_SOURCES_RESCAN_ACTION: '?/rescan',
	HANGAR_SOURCES_REVALIDATE_ACTION: '?/revalidate',
	HANGAR_SOURCES_BUILD_ACTION: '?/build',
	HANGAR_JOBS: '/jobs',
	HANGAR_JOB_DETAIL: (id: string) => `/jobs/${encodeURIComponent(id)}` as const,
	/** Form-action id on /jobs/[id]: cancel a queued/running job. */
	HANGAR_JOB_CANCEL_ACTION: '?/cancel',
	/** JSON endpoint for the /jobs/[id] streaming log (cursor-based polling). */
	HANGAR_JOB_LOG: (id: string) => `/jobs/${encodeURIComponent(id)}/log` as const,
	// Hangar -- /users directory of bauth_user rows. Lists the authoring
	// team + learners; detail shows recent sessions and audit activity.
	// Editing affordances on the detail page (role assign, ban / unban,
	// session revoke single + all) shipped in `wp-hangar-users-editing`.
	// Out-of-scope: invite flow, account removal, impersonation -- each
	// is a separate work package.
	HANGAR_USERS: '/users',
	HANGAR_USER_DETAIL: (id: string) => `/users/${encodeURIComponent(id)}` as const,
	/** Form-action id: set the target user's role (`?/setRole`). */
	HANGAR_USER_SET_ROLE_ACTION: '?/setRole',
	/** Form-action id: ban the target user (`?/ban`). */
	HANGAR_USER_BAN_ACTION: '?/ban',
	/** Form-action id: unban the target user (`?/unban`). */
	HANGAR_USER_UNBAN_ACTION: '?/unban',
	/** Form-action id: revoke a single session for the target user (`?/revokeSession`). */
	HANGAR_USER_REVOKE_SESSION_ACTION: '?/revokeSession',
	/** Form-action id: revoke every session for the target user (`?/revokeAllSessions`). */
	HANGAR_USER_REVOKE_ALL_SESSIONS_ACTION: '?/revokeAllSessions',
	// Hangar -- invitation flow (hangar-invite-flow WP).
	// `/users/invitations` is the admin-facing list; `[id]` is the per-row
	// detail with revoke + resend affordances. Distinct from `/users`
	// because invites are their own row family until accepted (at which
	// point the bauth_user row exists and `/users/[id]` takes over).
	/** Pending / accepted / revoked / expired invitations list. ADMIN-only. */
	HANGAR_USERS_INVITATIONS: '/users/invitations',
	/** Per-invitation detail page; carries revoke + resend admin actions. ADMIN-only. */
	HANGAR_USERS_INVITATION_DETAIL: (id: string) => `/users/invitations/${encodeURIComponent(id)}` as const,
	/** Form-action id: create a new invitation. */
	HANGAR_INVITATION_CREATE_ACTION: '?/createInvitation',
	/** Form-action id: revoke a pending invitation. */
	HANGAR_INVITATION_REVOKE_ACTION: '?/revokeInvitation',
	/** Form-action id: regenerate the token + re-email an invitation. */
	HANGAR_INVITATION_RESEND_ACTION: '?/resendInvitation',
	/** Cross-cutting audit explorer (audit-explorer WP). ADMIN-only. */
	HANGAR_ADMIN_AUDIT: '/admin/audit',
	/** Detail view for one `audit_log` row. ADMIN-only. */
	HANGAR_ADMIN_AUDIT_DETAIL: (id: string) => `/admin/audit/${encodeURIComponent(id)}` as const,
	/**
	 * JSON typeahead endpoint for the actor filter on `/admin/audit`. ADMIN-only.
	 * Lives under `/api/` (not `/admin/audit/`) to avoid shadowing the
	 * `/admin/audit/[id]` detail route with a static segment.
	 */
	HANGAR_API_AUDIT_ACTORS: '/api/audit-actors',
	/** Form-action id for the sync-all-pending button. */
	HANGAR_SYNC_ACTION: '?/syncAll',
	// Hangar -- /docs read-only markdown viewer over `docs/**`,
	// `course/**`, `handbooks/**`, `regulations/**`. The `[...path]` route
	// resolves any markdown file under those roots; the renderer reuses the
	// existing markdown primitives. Backed by Postgres FTS via the same loader
	// that populates `review_item`. See
	// `docs/work-packages/hangar-review-queue/spec.md` Surface 1.
	HANGAR_DOCS: '/docs',
	HANGAR_DOCS_PATH: (path: string) => `/docs/${path}` as const,
	// Hangar -- /review board, buckets, per-kind review surfaces, and
	// admin (loader + bucket CRUD). See
	// `docs/work-packages/hangar-review-queue/spec.md` Surface 2 + 3.
	HANGAR_REVIEW: '/review',
	HANGAR_REVIEW_BUCKET: (id: string) => `/review/buckets/${encodeURIComponent(id)}` as const,
	/** Generic item-detail dispatcher; redirects to the per-kind route. */
	HANGAR_REVIEW_ITEM: (id: string) => `/review/items/${encodeURIComponent(id)}` as const,
	/** Per-kind review view (`/review/wp_spec/...`, `/review/reference_toc/...`, ...). */
	HANGAR_REVIEW_KIND: (kind: string, id: string) =>
		`/review/${encodeURIComponent(kind)}/${encodeURIComponent(id)}` as const,
	/** Walker page for kinds that support multi-step reviews (`wp_test_plan` today). */
	HANGAR_REVIEW_WALKER: (kind: string, id: string) =>
		`/review/${encodeURIComponent(kind)}/${encodeURIComponent(id)}/walker` as const,
	HANGAR_REVIEW_TASK_NEW: '/review/tasks/new',
	HANGAR_REVIEW_TASK_EDIT: (id: string) => `/review/tasks/${encodeURIComponent(id)}/edit` as const,
	HANGAR_REVIEW_ADMIN_LOADER: '/review/admin/loader',
	HANGAR_REVIEW_ADMIN_BUCKETS: '/review/admin/buckets',
	HANGAR_REVIEW_ADMIN_BUCKET_NEW: '/review/admin/buckets/new',
	HANGAR_REVIEW_ADMIN_BUCKET_EDIT: (id: string) => `/review/admin/buckets/${encodeURIComponent(id)}/edit` as const,

	// Hangar -- /ingest-review queue surface for triaging residual issues
	// emitted by the ingest pipelines (figure-pairing today; regs /
	// knowledge tomorrow). See
	// `docs/work-packages/hangar-ingest-review-queue/spec.md`.
	HANGAR_INGEST_REVIEW: '/ingest-review',
	HANGAR_INGEST_REVIEW_ISSUE: (issueId: string) => `/ingest-review/${encodeURIComponent(issueId)}` as const,
	HANGAR_INGEST_REVIEW_PAIR_ACTION: '?/pair',
	HANGAR_INGEST_REVIEW_MARK_NO_FIGURE_ACTION: '?/markNoFigure',
	HANGAR_INGEST_REVIEW_MARK_FALSE_CAPTION_ACTION: '?/markFalseCaption',
	HANGAR_INGEST_REVIEW_MARK_EXTRANEOUS_ACTION: '?/markExtraneous',
	HANGAR_INGEST_REVIEW_MARK_DECORATIVE_ACTION: '?/markDecorative',
	HANGAR_INGEST_REVIEW_DISMISS_ACTION: '?/dismiss',
	HANGAR_INGEST_REVIEW_REOPEN_ACTION: '?/reopen',
	HANGAR_INGEST_REVIEW_RUN_PRODUCERS_ACTION: '?/runProducers',

	// Hangar -- /roadmap read-only WP browser (Phase 8 of the
	// tracking-system-overhaul WP). Backed by `scripts/lib/wp-loader.ts`
	// (server-only); writebacks go through `bun run wp set`. See
	// `docs/decisions/025-wp-frontmatter-contract/decision.md`.
	HANGAR_ROADMAP: '/roadmap',
	HANGAR_ROADMAP_DETAIL: (wpId: string) => `/roadmap/${encodeURIComponent(wpId)}` as const,
	/** JSON dump of one WP -- raw frontmatter + validation errors, for debugging. */
	HANGAR_ROADMAP_RAW: (wpId: string) => `/roadmap/${encodeURIComponent(wpId)}/raw` as const,

	// Hangar -- /courses authoring surface (course-reader-and-editor WP).
	// Reads + writes YAML files under `course/courses/<slug>/` and re-runs
	// the seed pipeline on every save. Role-gated to AUTHOR | OPERATOR |
	// ADMIN. The DB is downstream of YAML (per ADR 018 + the WP design
	// doc); the editor never writes to `study.course` / `study.course_step`
	// directly. See `docs/work-packages/course-reader-and-editor/`.
	HANGAR_COURSES: '/courses',
	HANGAR_COURSE: (slug: string) => `/courses/${encodeURIComponent(slug)}` as const,
	HANGAR_COURSE_SECTION: (slug: string, code: string) =>
		`/courses/${encodeURIComponent(slug)}/sections/${encodeURIComponent(code)}` as const,
	/** Form-action id: write the manifest YAML + re-run seed for one course. */
	HANGAR_COURSE_UPDATE_MANIFEST_ACTION: '?/updateManifest',
	/** Form-action id: delete the entire `course/courses/<slug>/` directory + re-run seed. */
	HANGAR_COURSE_DELETE_ACTION: '?/deleteCourse',
	/** Form-action id: create a new section YAML file under one course + re-run seed. */
	HANGAR_COURSE_ADD_SECTION_ACTION: '?/addSection',
	/** Form-action id: re-emit a section YAML file with new metadata + re-run seed. */
	HANGAR_COURSE_UPDATE_SECTION_ACTION: '?/updateSection',
	/** Form-action id: delete one section YAML file + re-run seed. */
	HANGAR_COURSE_DELETE_SECTION_ACTION: '?/deleteSection',
	/** Form-action id: re-emit every section YAML with new ordinals + re-run seed. */
	HANGAR_COURSE_REORDER_SECTIONS_ACTION: '?/reorderSections',
	/** Form-action id: append a step inside a section file + re-run seed. */
	HANGAR_COURSE_ADD_STEP_ACTION: '?/addStep',
	/** Form-action id: re-emit a section YAML with one step's fields changed + re-run seed. */
	HANGAR_COURSE_UPDATE_STEP_ACTION: '?/updateStep',
	/** Form-action id: re-emit a section YAML with one step removed + re-run seed. */
	HANGAR_COURSE_DELETE_STEP_ACTION: '?/deleteStep',
	/** Form-action id: re-emit a section YAML with steps in new order + re-run seed. */
	HANGAR_COURSE_REORDER_STEPS_ACTION: '?/reorderSteps',
	/** Form-action id: delete the orphan course/course_step rows the seed reported. */
	HANGAR_COURSE_CLEANUP_ORPHANS_ACTION: '?/cleanupOrphans',
	/** Form-action id: create a fresh course directory (manifest.yaml only) + re-run seed. */
	HANGAR_COURSE_CREATE_ACTION: '?/createCourse',

	// Flightbag (apps/flightbag) -- public reference reader. Served from its
	// own host (flightbag.airboss.test), so these paths are relative to that
	// origin. Public (no auth gate). Owns the canonical URL space for FAA
	// reference content; other apps (study/sim/hangar/avionics) link into
	// flightbag via `urlForReference()` from `@ab/sources`. See
	// `docs/platform/REFERENCES.md` ("Current architecture") for the
	// scope split between flightbag (reader), libs/library/ (rendering
	// primitives), libs/constants/ (URL templates), and libs/sources/
	// (URI <-> URL bridge).
	FLIGHTBAG_HOME: '/',
	/** Handbook landing -- whole-doc index. */
	FLIGHTBAG_HANDBOOK: (slug: string, edition: string) =>
		`/handbook/${encodeURIComponent(slug)}/${encodeURIComponent(edition)}` as const,
	/** Handbook chapter index. */
	FLIGHTBAG_HANDBOOK_CHAPTER: (slug: string, edition: string, chapter: string) =>
		`/handbook/${encodeURIComponent(slug)}/${encodeURIComponent(edition)}/${encodeURIComponent(chapter)}` as const,
	/** Handbook section reader (leaf). */
	FLIGHTBAG_HANDBOOK_SECTION: (slug: string, edition: string, chapter: string, section: string) =>
		`/handbook/${encodeURIComponent(slug)}/${encodeURIComponent(edition)}/${encodeURIComponent(chapter)}/${encodeURIComponent(section)}` as const,
	/** Handbook asset stream (figures, tables). Mirror of `HANDBOOK_ASSET` for flightbag. */
	FLIGHTBAG_HANDBOOK_ASSET: (path: string) => `/handbook-asset/${path}` as const,
	/**
	 * Streams the canonical source PDF for a reference from the developer-local
	 * cache (per ADR 018). The `path` segment is rooted at the cache root and
	 * includes the per-corpus subdirectory (`handbooks/...`, `ac/...`, etc.).
	 * Returns 404 when the cache doesn't have the file -- a fresh dev box has
	 * to download the PDF first.
	 */
	FLIGHTBAG_SOURCE_PDF: (path: string) => `/source-pdf/${path}` as const,
	/** AIM publication landing. */
	FLIGHTBAG_AIM: '/aim',
	/** AIM chapter index. */
	FLIGHTBAG_AIM_CHAPTER: (chapter: string) => `/aim/${encodeURIComponent(chapter)}` as const,
	/** AIM section index (paragraphs under one section). */
	FLIGHTBAG_AIM_SECTION: (chapter: string, section: string) =>
		`/aim/${encodeURIComponent(chapter)}/${encodeURIComponent(section)}` as const,
	/** AIM paragraph reader (leaf). */
	FLIGHTBAG_AIM_PARAGRAPH: (chapter: string, section: string, paragraph: string) =>
		`/aim/${encodeURIComponent(chapter)}/${encodeURIComponent(section)}/${encodeURIComponent(paragraph)}` as const,
	/** CFR Part landing -- TOC for one Part (or umbrella card when sections aren't ingested). */
	FLIGHTBAG_CFR_PART: (title: string, part: string) =>
		`/cfr/${encodeURIComponent(title)}/${encodeURIComponent(part)}` as const,
	/** CFR section reader (leaf). */
	FLIGHTBAG_CFR_SECTION: (title: string, part: string, section: string) =>
		`/cfr/${encodeURIComponent(title)}/${encodeURIComponent(part)}/${encodeURIComponent(section)}` as const,
	/** Advisory Circular landing -- TOC for the AC. */
	FLIGHTBAG_AC: (doc: string, rev: string) => `/ac/${encodeURIComponent(doc)}/${encodeURIComponent(rev)}` as const,
	/** Advisory Circular chapter index. */
	FLIGHTBAG_AC_CHAPTER: (doc: string, rev: string, chapter: string) =>
		`/ac/${encodeURIComponent(doc)}/${encodeURIComponent(rev)}/${encodeURIComponent(chapter)}` as const,
	/** Advisory Circular section reader (leaf). */
	FLIGHTBAG_AC_SECTION: (doc: string, rev: string, chapter: string, section: string) =>
		`/ac/${encodeURIComponent(doc)}/${encodeURIComponent(rev)}/${encodeURIComponent(chapter)}/${encodeURIComponent(section)}` as const,
	/** ACS publication landing. */
	FLIGHTBAG_ACS: (doc: string) => `/acs/${encodeURIComponent(doc)}` as const,
	/** ACS task reader. */
	FLIGHTBAG_ACS_TASK: (doc: string, area: string, task: string) =>
		`/acs/${encodeURIComponent(doc)}/area/${encodeURIComponent(area)}/task/${encodeURIComponent(task)}` as const,
	/**
	 * NTSB administrative law judge ruling reader (WP-NTSB-ALJ). Whole-ruling
	 * landing for a single case number; deep links into named opinion sections
	 * are added when the per-ruling extractor lands. Until the flightbag has a
	 * dedicated ALJ ruling page, the URI bridge falls back to `FLIGHTBAG_HOME`
	 * via `urlForReference()`; this constant is reserved so callers can switch
	 * to the canonical path in one place when the page exists.
	 */
	FLIGHTBAG_NTSB_ALJ: (caseNumber: string) => `/ntsb-alj/${encodeURIComponent(caseNumber)}` as const,
	/** Named opinion section reader inside an ALJ ruling. */
	FLIGHTBAG_NTSB_ALJ_SECTION: (caseNumber: string, section: string) =>
		`/ntsb-alj/${encodeURIComponent(caseNumber)}/${encodeURIComponent(section)}` as const,
	/**
	 * Safety Alert for Operators (SAFO) reader (WP-SAFO-INFO). Whole-bulletin
	 * landing for a single SAFO id; deep links into named bulletin sections
	 * are added when the flightbag SAFO page lands. Until the flightbag has a
	 * dedicated SAFO reader, the URI bridge falls back to `FLIGHTBAG_HOME`
	 * via `urlForReference()`; this constant is reserved so callers can switch
	 * to the canonical path in one place when the page exists.
	 */
	FLIGHTBAG_SAFO: (id: string) => `/safo/${encodeURIComponent(id)}` as const,
	/** Named section reader inside a SAFO bulletin. */
	FLIGHTBAG_SAFO_SECTION: (id: string, section: string) =>
		`/safo/${encodeURIComponent(id)}/${encodeURIComponent(section)}` as const,
	/**
	 * Information for Operators (InFO) reader (WP-SAFO-INFO). Sibling to
	 * `FLIGHTBAG_SAFO`; same shape, different FAA program.
	 */
	FLIGHTBAG_INFO: (id: string) => `/info/${encodeURIComponent(id)}` as const,
	/** Named section reader inside an InFO bulletin. */
	FLIGHTBAG_INFO_SECTION: (id: string, section: string) =>
		`/info/${encodeURIComponent(id)}/${encodeURIComponent(section)}` as const,
	/**
	 * POST endpoint for the flightbag reader heartbeat. The client posts
	 * `{ delta: <seconds-since-last-tick> }`; the server credits the per-
	 * `(user, reference_section)` row in `study.reference_section_read_state`
	 * and refreshes `last_read_at`. Path-keyed on the section id (not the
	 * doc-locator) so the same endpoint serves every corpus.
	 */
	FLIGHTBAG_SECTION_HEARTBEAT: (sectionId: string) =>
		`/api/section/${encodeURIComponent(sectionId)}/heartbeat` as const,

	// Study -- Courses (course-primitive WP, ADR 016 refinement). Course is a
	// peer primitive to syllabus per principle 11 of LEARNING_PHILOSOPHY.md.
	// Definitions only in this WP; the consumer pages land in a follow-on UI WP.
	/** Courses index (list of instructor-authored courses). */
	COURSES: '/courses',
	/** Single course detail page, keyed by course slug. */
	COURSE: (slug: string) => `/courses/${encodeURIComponent(slug)}` as const,
	/** One step inside a course, keyed by course slug + step code (e.g. `s1.3`). */
	COURSE_STEP: (slug: string, stepCode: string) =>
		`/courses/${encodeURIComponent(slug)}/${encodeURIComponent(stepCode)}` as const,
} as const;

/**
 * Display names for each surface app. Used by the shared `AppHeader`
 * brand link ("airboss / {name}") and any other surface that needs a
 * canonical app label. Kept here so a rename only touches one file.
 *
 * The brand renders the lowercase form ("airboss / sim"); these are
 * the title-cased canonical names.
 */
export const APP_NAMES = {
	study: 'Study',
	sim: 'Sim',
	hangar: 'Hangar',
	flightbag: 'Flightbag',
	avionics: 'Avionics',
} as const;

/** Surface app id -- the keys of `APP_NAMES`. Drives the `AppHeader` `app` prop. */
export type AppId = keyof typeof APP_NAMES;

/**
 * Named app-id constants. Use these instead of bare `'study'` / `'sim'` /
 * etc. literals at call sites (`PaletteCommand.surface`, `PaletteHost.app`,
 * the `AppHeader` `app` prop) so a rename touches one file. Mirror the keys
 * of `APP_NAMES` for back-compat with grep + lint.
 */
export const APP_IDS = {
	STUDY: 'study',
	SIM: 'sim',
	HANGAR: 'hangar',
	FLIGHTBAG: 'flightbag',
	AVIONICS: 'avionics',
} as const satisfies Record<string, AppId>;

/**
 * Labels for primary navigation links. Kept out of markup so every surface
 * renders the same text and a rename only touches one file.
 */
export const NAV_LABELS = {
	/** Post-login home (study-home WP). First nav item. */
	STUDY: 'Study',
	/**
	 * `/study/learn` -- consolidated Cards / Reps / Read section
	 * (study-app-ia-cleanup Phase 4). Single nav entry that replaces the
	 * Memory dropdown + standalone Reps + Library nav links. Underlying URLs
	 * (`/memory`, `/reps`, `/library`) are unchanged.
	 */
	LEARN: 'Learn',
	/** Sub-tab labels for the `/study/learn` section index + per-route tab strips. */
	LEARN_CARDS: 'Cards',
	LEARN_REPS: 'Reps',
	LEARN_READ: 'Read',
	/**
	 * `/courses` -- instructor-authored courses index (course-primitive WP).
	 * Pedagogical content the learner consumes; sits in the top nav alongside
	 * Learn so courses are discoverable without knowing the URL.
	 */
	COURSES: 'Courses',
	/**
	 * @deprecated The legacy `/dashboard` page; renamed to "Stats" pre-IA-
	 * cleanup. Phase 3 renames the surface to `/insights` and prefers
	 * `INSIGHTS` below. Kept so existing call sites still type-check.
	 */
	DASHBOARD: 'Stats',
	/**
	 * `/insights` -- consolidated stats + calibration + lens (study-app-
	 * ia-cleanup Phase 3). Spec Q7 considered "Progress" as an alternative
	 * label; "Insights" was retained because the URL family is `INSIGHTS`
	 * and the section index page surfaces calibration + weak areas which
	 * "Insights" describes more accurately than "Progress" alone.
	 */
	INSIGHTS: 'Insights',
	/** Sub-link inside Insights -- calibration detail surface. */
	INSIGHTS_CALIBRATION: 'Calibration',
	/** Sub-link inside Insights -- lens (handbook + weakness) detail surface. */
	INSIGHTS_LENS: 'Lens',
	/**
	 * `/reference` -- consolidated knowledge graph + glossary
	 * (study-app-ia-cleanup Phase 3). Always-on section; reachable
	 * pre-goal so first-run users can browse.
	 */
	REFERENCE: 'Reference',
	REFERENCE_KNOWLEDGE: 'Knowledge',
	REFERENCE_GLOSSARY: 'Glossary',
	/** Placeholder for the flight-logging surface (WP 2). */
	FLIGHT: 'Flight',
	/**
	 * Single nav entry for the consolidated Quals + Goal + Plan + Coverage
	 * surface (study-app-ia-cleanup Phase 2). Replaces the prior PLANS /
	 * CREDENTIALS / GOALS labels.
	 */
	PROGRAM: 'Program',
	PROGRAM_QUALS: 'Quals',
	PROGRAM_GOAL: 'Goal',
	PROGRAM_PLAN: 'Plan',
	PROGRAM_COVERAGE: 'Coverage',
	LENS: 'Study by',
	LENS_HANDBOOK: 'Study by handbook',
	LENS_WEAKNESS: 'What to study next',
	MEMORY: 'Memory',
	MEMORY_HOME: 'Overview',
	MEMORY_BROWSE: 'Browse',
	MEMORY_REVIEW: 'Review',
	MEMORY_NEW: 'New card',
	/** wp-notes-primitive top-nav entry. */
	NOTES: 'Notes',
	NOTES_NEW: 'New note',
	REPS: 'Reps',
	KNOWLEDGE: 'Knowledge',
	GLOSSARY: 'Glossary',
	LIBRARY: 'Library',
	FLIGHTBAG: 'Flightbag',
	CALIBRATION: 'Calibration',
	HELP: 'Help',
	HELP_INDEX: 'Help index',
	HELP_CONCEPTS: 'Concepts',
	HANGAR_DOCS: 'Docs',
	HANGAR_INGEST_REVIEW: 'Ingest review',
	HANGAR_REVIEW: 'Review',
	HANGAR_REVIEW_BOARD: 'Board',
	HANGAR_REVIEW_BUCKETS: 'Buckets',
	HANGAR_REVIEW_TASKS: 'Tasks',
	HANGAR_REVIEW_LOADER: 'Loader',
	HANGAR_ROADMAP: 'Roadmap',
} as const;

/**
 * Query-string parameter names used by the hangar `/roadmap` view to expose
 * filter state in the URL so views are bookmarkable + shareable. Mirrors the
 * `bun run wp list` filter flags. Phase 8 of tracking-system-overhaul.
 */
export const ROADMAP_QUERY_PARAMS = {
	/** `WPProduct` filter (`study`, `hangar`, ...). */
	PRODUCT: 'product',
	/** `WPCategory` filter (`product`, `feature`, `content`, `docs`, `platform`). */
	CATEGORY: 'category',
	/** `WPStatus` filter (`draft`, `signed-off`, `in-flight`, `shipped`, `abandoned`, `superseded`). */
	STATUS: 'status',
	/** `WPHumanReviewStatus` filter (`pending`, `walked`, `signed-off`). */
	HUMAN_REVIEW: 'human_review',
	/** Single-tag filter (matches if `tags` array contains it). */
	TAG: 'tag',
	/** Free-text search across id + title. Client-side filter. */
	SEARCH: 'q',
	/** Active sub-doc tab on the detail page (`spec` | `tasks` | `test-plan` | `design` | `user-stories`). */
	TAB: 'tab',
} as const;
export type RoadmapQueryParam = (typeof ROADMAP_QUERY_PARAMS)[keyof typeof ROADMAP_QUERY_PARAMS];

/** Sub-doc filenames that the `/roadmap/[wp_id]` detail view will surface
 * as tabs. Order is intentional: spec is required, the rest render only when
 * the file exists. */
export const WP_SUB_DOCS = [
	{ key: 'spec', filename: 'spec.md', label: 'Spec' },
	{ key: 'tasks', filename: 'tasks.md', label: 'Tasks' },
	{ key: 'test-plan', filename: 'test-plan.md', label: 'Test plan' },
	{ key: 'design', filename: 'design.md', label: 'Design' },
	{ key: 'user-stories', filename: 'user-stories.md', label: 'User stories' },
] as const;
export type WpSubDocKey = (typeof WP_SUB_DOCS)[number]['key'];

/** GitHub repo owner+name pair for resolving `shipped_prs` numbers to URLs.
 * One source of truth so a future repo move touches one constant. */
export const AIRBOSS_REPO_SLUG = 'joshball/airboss';
