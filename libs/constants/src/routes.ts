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

	// Study -- Reps
	REPS: '/reps',
	REPS_SESSION: '/reps/session',
	REPS_BROWSE: '/reps/browse',
	REPS_NEW: '/reps/new',

	// Study -- Calibration
	CALIBRATION: '/calibration',

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
	/**
	 * Node-filtered review: appends `?node=...` to the existing review flow
	 * so the server load can narrow the due-cards query without introducing
	 * a parallel route.
	 */
	MEMORY_REVIEW_FOR_NODE: (nodeId: string) => `/memory/review?node=${encodeURIComponent(nodeId)}` as const,

	// Study -- Plans + Sessions
	PLANS: '/plans',
	PLANS_NEW: '/plans/new',
	PLAN: (id: string) => `/plans/${id}` as const,
	SESSION_START: '/session/start',
	SESSIONS: '/sessions',
	SESSION: (id: string) => `/sessions/${id}` as const,
	SESSION_SUMMARY: (id: string) => `/sessions/${id}/summary` as const,
} as const;

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
} as const;
