import type { AviationTopic, CertApplicability } from './reference-tags';
import type { SimScenarioId } from './sim';
import type { KnowledgePhase, LibraryRegulationsKind } from './study';

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
	/** Hangar /jobs filter: job kind. */
	KIND: 'kind',
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
	 * Citation picker search endpoint. GET `?target=<CitationTargetType>&q=<term>`
	 * returns `{ results: { id, label, detail }[] }`. Auth-gated.
	 */
	API_CITATIONS_SEARCH: '/api/citations/search',

	/**
	 * Post-login default landing surface for the study app (study-home WP).
	 * Replaces `/dashboard` as the primary destination; `/dashboard` survives
	 * at its existing URL as the "Stats" power-user view.
	 */
	STUDY: '/study',

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

	// Study -- Dashboard (kept as the "Stats" view; was the launchpad pre-WP)
	DASHBOARD: '/dashboard',

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

	// Study -- Calibration
	CALIBRATION: '/calibration',

	// Study -- Glossary (aviation reference library; shared via @ab/aviation)
	GLOSSARY: '/glossary',
	GLOSSARY_ID: (id: string) => `/glossary/${encodeURIComponent(id)}` as const,

	// Study -- Library (the user-facing reference browse + reader surface).
	// Hosts the in-app handbook reader (per-edition markdown + figures committed
	// to `handbooks/<doc>/<edition>/`) plus the subject-grouped index over every
	// `study.reference` row, regardless of kind. Sibling surface to
	// `/glossary` and `/references`: a reference-shaped read view that other
	// surfaces (knowledge nodes, citations) link into. See
	// `docs/work-packages/handbook-ingestion-and-reader/spec.md` and
	// `docs/decisions/016-cert-syllabus-goal-model/decision.md`.
	LIBRARY: '/library',
	/**
	 * Cert spine -- references whose `primary_cert` matches plus carryover
	 * groups inherited via the prereq DAG. See `library-by-cert` BC.
	 */
	LIBRARY_CERT: (cert: CertApplicability) => `/library/cert/${encodeURIComponent(cert)}` as const,
	/** Topic cross-cut -- references tagged with the given aviation topic. */
	LIBRARY_TOPIC: (topic: AviationTopic) => `/library/topic/${encodeURIComponent(topic)}` as const,
	/** Top-level regulations & policy index. */
	LIBRARY_REGULATIONS: '/library/regulations',
	/** One bucket inside the regulations index (`14-cfr`, `aim`, ...). */
	LIBRARY_REGULATIONS_KIND: (kind: LibraryRegulationsKind) =>
		`/library/regulations/${encodeURIComponent(kind)}` as const,
	/**
	 * One group inside a regulations bucket -- a CFR Part, an AIM Chapter,
	 * an AC series, etc. Forward-compatible with future per-section reader
	 * URLs; today renders the umbrella card when no inline sections exist.
	 */
	LIBRARY_REGULATIONS_GROUP: (kind: LibraryRegulationsKind, group: string) =>
		`/library/regulations/${encodeURIComponent(kind)}/${encodeURIComponent(group)}` as const,
	/** Per-section leaf reader inside a regulations group. */
	LIBRARY_REGULATIONS_SECTION: (kind: LibraryRegulationsKind, group: string, section: string) =>
		`/library/regulations/${encodeURIComponent(kind)}/${encodeURIComponent(group)}/${encodeURIComponent(section)}` as const,
	/** Handbook TOC by document slug (PHAK, AFH, IFH, ...). */
	LIBRARY_HANDBOOK: (slug: string) => `/library/handbook/${encodeURIComponent(slug)}` as const,
	/** Single chapter inside a handbook. */
	LIBRARY_HANDBOOK_CHAPTER: (slug: string, chapter: number | string) =>
		`/library/handbook/${encodeURIComponent(slug)}/${encodeURIComponent(String(chapter))}` as const,
	/** Single section inside a handbook chapter (leaf reader). */
	LIBRARY_HANDBOOK_SECTION: (slug: string, chapter: number | string, section: number | string) =>
		`/library/handbook/${encodeURIComponent(slug)}/${encodeURIComponent(String(chapter))}/${encodeURIComponent(String(section))}` as const,
	/** POST endpoint for client heartbeat ticks while reading a handbook section. */
	LIBRARY_HANDBOOK_SECTION_HEARTBEAT: (slug: string, chapter: number | string, section: number | string) =>
		`/library/handbook/${encodeURIComponent(slug)}/${encodeURIComponent(String(chapter))}/${encodeURIComponent(String(section))}/heartbeat` as const,
	/** Aircraft-specific (POH/AFM) umbrella surface. */
	LIBRARY_AIRCRAFT: (slug: string) => `/library/aircraft/${encodeURIComponent(slug)}` as const,

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
	 * Knowledge-graph browse / detail / guided-learn surface. Separate from
	 * the legacy `NODES` prefix -- `/knowledge` is the spec-named path in the
	 * knowledge-graph work package and maps to slug-keyed URLs.
	 */
	KNOWLEDGE: '/knowledge',
	KNOWLEDGE_SLUG: (slug: string) => `/knowledge/${slug}` as const,
	KNOWLEDGE_LEARN: (slug: string) => `/knowledge/${slug}/learn` as const,
	/** Guided-learn page pinned to a specific phase (named slug). */
	KNOWLEDGE_LEARN_AT: (slug: string, phase: KnowledgePhase) =>
		`/knowledge/${slug}/learn?${QUERY_PARAMS.STEP}=${encodeURIComponent(phase)}` as const,
	/**
	 * Node-filtered review: appends `?node=...` to the existing review flow
	 * so the server load can narrow the due-cards query without introducing
	 * a parallel route.
	 */
	MEMORY_REVIEW_FOR_NODE: (nodeId: string) =>
		`/memory/review?${QUERY_PARAMS.NODE_ID}=${encodeURIComponent(nodeId)}` as const,

	// Study -- Credentials (cert-syllabus WP, ADR 016 phases 1-6).
	// Pages land in a follow-on WP; the route constants ship here so links
	// from existing surfaces (cert dashboard breadcrumbs, plan wizard) can
	// reference the eventual destination without inlining strings.
	CREDENTIALS: '/credentials',
	CREDENTIAL: (slug: string) => `/credentials/${encodeURIComponent(slug)}` as const,
	CREDENTIAL_AREA: (slug: string, areaCode: string) =>
		`/credentials/${encodeURIComponent(slug)}/areas/${encodeURIComponent(areaCode)}` as const,
	CREDENTIAL_TASK: (slug: string, areaCode: string, taskCode: string) =>
		`/credentials/${encodeURIComponent(slug)}/areas/${encodeURIComponent(areaCode)}/tasks/${encodeURIComponent(taskCode)}` as const,
	/**
	 * Edition-pinned credential URL. Default loader resolves the
	 * credential's primary syllabus's latest active edition; this variant
	 * keeps a learner mid-prep on the older edition they started on.
	 */
	CREDENTIAL_AT_EDITION: (slug: string, edition: string) =>
		`/credentials/${encodeURIComponent(slug)}?${QUERY_PARAMS.EDITION}=${encodeURIComponent(edition)}` as const,

	// Study -- Goals (cert-syllabus WP).
	GOALS: '/goals',
	GOALS_NEW: '/goals/new',
	GOAL: (id: string) => `/goals/${encodeURIComponent(id)}` as const,
	GOAL_EDIT: (id: string) => `/goals/${encodeURIComponent(id)}?${QUERY_PARAMS.EDIT}=1` as const,

	// Study -- Lens UI (lens-ui WP, ADR 016 phase 8).
	/** Umbrella prefix for the Lens area; used by nav-active prefix checks. */
	LENS: '/lens',
	/**
	 * Handbook / regulation figure asset stream. The `[...path]` server route
	 * resolves `path` against the handbook cache root and pipes the file body.
	 * Callers strip any leading slash before passing in.
	 */
	HANDBOOK_ASSET: (path: string) => `/handbook-asset/${path}` as const,
	LENS_HANDBOOK: '/lens/handbook',
	LENS_HANDBOOK_DOC: (doc: string) => `/lens/handbook/${encodeURIComponent(doc)}` as const,
	LENS_HANDBOOK_CHAPTER: (doc: string, chapter: string | number) =>
		`/lens/handbook/${encodeURIComponent(doc)}/${encodeURIComponent(String(chapter))}` as const,
	LENS_WEAKNESS: '/lens/weakness',
	LENS_WEAKNESS_BUCKET: (severity: string) => `/lens/weakness/${encodeURIComponent(severity)}` as const,

	// Study -- Plans + Sessions
	PLANS: '/plans',
	PLANS_NEW: '/plans/new',
	PLAN: (id: string) => `/plans/${id}` as const,
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
 * Labels for primary navigation links. Kept out of markup so every surface
 * renders the same text and a rename only touches one file.
 */
export const NAV_LABELS = {
	/** Post-login home (study-home WP). First nav item. */
	STUDY: 'Study',
	/** The legacy `/dashboard` page; renamed to "Stats" once `/study` became the home (study-home WP). */
	DASHBOARD: 'Stats',
	/** Placeholder for the flight-logging surface (WP 2). */
	FLIGHT: 'Flight',
	PLANS: 'Plans',
	CREDENTIALS: 'Quals',
	GOALS: 'Goals',
	LENS: 'Study by',
	LENS_HANDBOOK: 'Study by handbook',
	LENS_WEAKNESS: 'What to study next',
	MEMORY: 'Memory',
	MEMORY_HOME: 'Overview',
	MEMORY_BROWSE: 'Browse',
	MEMORY_REVIEW: 'Review',
	MEMORY_NEW: 'New card',
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
	HANGAR_REVIEW: 'Review',
	HANGAR_REVIEW_BOARD: 'Board',
	HANGAR_REVIEW_BUCKETS: 'Buckets',
	HANGAR_REVIEW_TASKS: 'Tasks',
	HANGAR_REVIEW_LOADER: 'Loader',
} as const;
