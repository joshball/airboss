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
} as const;
