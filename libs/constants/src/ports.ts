export const PORTS = {
	AVIONICS: 9630,
	STUDY: 9600,
	SIM: 9610,
	HANGAR: 9620,
	FLIGHTBAG: 9640,
	DB: 5435,
	// E2E ports = dev port + 3, so Playwright never reuses a running dev
	// server. Tests get their own vite processes pointing at their own DB
	// (see DEV_DB_URL_E2E). Keep the +3 offset stable -- the gap leaves
	// room for future per-app aux ports without colliding.
	STUDY_E2E: 9603,
	SIM_E2E: 9613,
	HANGAR_E2E: 9623,
	AVIONICS_E2E: 9633,
	FLIGHTBAG_E2E: 9643,
} as const;
