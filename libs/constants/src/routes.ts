import type { SimScenarioId } from './sim';
import type { KnowledgePhase } from './study';

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
	/** Comma-separated tag carry-over ("save and add another" flow). */
	TAGS: 'tags',
	/** Free-text search query. */
	SEARCH: 'q',
	/** 1-based page number for paginated browse. */
	PAGE: 'page',
} as const;

export const ROUTES = {
	// Common
	HOME: '/',
	LOGIN: '/login',
	LOGOUT: '/logout',
	API_AUTH: '/api/auth',
	/** Appearance-preference endpoint. POST `{ value: 'light'|'dark'|'system' }`. */
	APPEARANCE: '/appearance',
	/**
	 * Citation picker search endpoint. GET `?target=<CitationTargetType>&q=<term>`
	 * returns `{ results: { id, label, detail }[] }`. Auth-gated.
	 */
	API_CITATIONS_SEARCH: '/api/citations/search',

	// Study -- Dashboard (launchpad; `/` redirects here)
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

	// Sim (apps/sim) -- flight dynamics prototype. Sim is served from its own
	// host (sim.airboss.test), so these paths are relative to that origin.
	SIM_HOME: '/',
	SIM_SCENARIO: (id: SimScenarioId) => `/${id}` as const,

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
	// Hangar -- /sources operational surface (wp-hangar-sources-v1).
	HANGAR_SOURCES: '/sources',
	HANGAR_SOURCE_DETAIL: (id: string) => `/sources/${encodeURIComponent(id)}` as const,
	HANGAR_SOURCE_FILES: (id: string) => `/sources/${encodeURIComponent(id)}/files` as const,
	HANGAR_SOURCE_DIFF: (id: string) => `/sources/${encodeURIComponent(id)}/diff` as const,
	HANGAR_SOURCE_UPLOAD: (id: string) => `/sources/${encodeURIComponent(id)}/upload` as const,
	/** Binary-visual: stream the full archive from disk with content-disposition: attachment. */
	HANGAR_SOURCE_DOWNLOAD: (id: string) => `/sources/${encodeURIComponent(id)}/download` as const,
	/** Binary-visual: static thumbnail image served from `data/sources/<type>/<id>/<edition>/`. */
	HANGAR_SOURCE_THUMBNAIL: (id: string) => `/sources/${encodeURIComponent(id)}/thumbnail` as const,
	/** Operational form actions on a source. */
	HANGAR_SOURCE_FETCH_ACTION: '?/fetch',
	HANGAR_SOURCE_EXTRACT_ACTION: '?/extract',
	HANGAR_SOURCE_DIFF_ACTION: '?/diff',
	HANGAR_SOURCE_VALIDATE_ACTION: '?/validate',
	/** Global flow-level actions on /sources. */
	HANGAR_SOURCES_RESCAN_ACTION: '?/rescan',
	HANGAR_SOURCES_REVALIDATE_ACTION: '?/revalidate',
	HANGAR_SOURCES_BUILD_ACTION: '?/build',
	HANGAR_SOURCES_SIZE_REPORT_ACTION: '?/sizeReport',
	HANGAR_JOBS: '/jobs',
	HANGAR_JOB_DETAIL: (id: string) => `/jobs/${encodeURIComponent(id)}` as const,
	/** JSON endpoint for the /jobs/[id] streaming log (cursor-based polling). */
	HANGAR_JOB_LOG: (id: string) => `/jobs/${encodeURIComponent(id)}/log` as const,
	/** Scaffold-era audit heartbeat demo, kept as an admin diagnostic. */
	HANGAR_ADMIN_AUDIT_PING: '/admin/audit-ping',
	/** Form-action id for the sync-all-pending button. */
	HANGAR_SYNC_ACTION: '?/syncAll',
} as const;

/**
 * Labels for primary navigation links. Kept out of markup so every surface
 * renders the same text and a rename only touches one file.
 */
export const NAV_LABELS = {
	DASHBOARD: 'Dashboard',
	PLANS: 'Plans',
	MEMORY: 'Memory',
	MEMORY_HOME: 'Overview',
	MEMORY_BROWSE: 'Browse',
	MEMORY_REVIEW: 'Review',
	MEMORY_NEW: 'New card',
	REPS: 'Reps',
	KNOWLEDGE: 'Knowledge',
	GLOSSARY: 'Glossary',
	CALIBRATION: 'Calibration',
	HELP: 'Help',
	HELP_INDEX: 'Help index',
	HELP_CONCEPTS: 'Concepts',
} as const;
