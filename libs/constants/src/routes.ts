export const ROUTES = {
	// Common
	HOME: '/',
	LOGIN: '/login',
	LOGOUT: '/logout',
	API_AUTH: '/api/auth',

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
	 * Node-filtered review: appends `?node=...` to the existing review flow
	 * so the server load can narrow the due-cards query without introducing
	 * a parallel route.
	 */
	MEMORY_REVIEW_FOR_NODE: (nodeId: string) => `/memory/review?node=${encodeURIComponent(nodeId)}` as const,
} as const;

/** Query-string parameter names used across study routes. */
export const QUERY_PARAMS = {
	/** Filters the due-cards queue to a single knowledge node. */
	NODE_ID: 'node',
} as const;
