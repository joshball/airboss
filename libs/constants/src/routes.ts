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

	// Study -- Dashboard (launchpad; `/` redirects here)
	DASHBOARD: '/dashboard',

	// Study -- Memory
	MEMORY: '/memory',
	MEMORY_REVIEW: '/memory/review',
	MEMORY_NEW: '/memory/new',
	MEMORY_BROWSE: '/memory/browse',
	MEMORY_CARD: (id: string) => `/memory/${id}` as const,
	/** Detail page with the inline edit-mode flag set. */
	MEMORY_CARD_EDIT: (id: string) => `/memory/${encodeURIComponent(id)}?${QUERY_PARAMS.EDIT}=1` as const,

	// Study -- Reps
	// `REPS_SESSION` retired by ADR 012 phase 3; the `/reps/session` route
	// was deleted in phase 6. All rep entry points link `SESSION_START`.
	REPS: '/reps',
	REPS_BROWSE: '/reps/browse',
	REPS_NEW: '/reps/new',

	// Study -- Calibration
	CALIBRATION: '/calibration',

	// Study -- Glossary (aviation reference library; shared via @ab/aviation)
	GLOSSARY: '/glossary',
	GLOSSARY_ID: (id: string) => `/glossary/${encodeURIComponent(id)}` as const,

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
} as const;
