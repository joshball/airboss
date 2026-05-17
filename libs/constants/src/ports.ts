export const PORTS = {
	AVIONICS: 9630,
	STUDY: 9600,
	SIM: 9610,
	HANGAR: 9620,
	FLIGHTBAG: 9640,
	SPATIAL: 9650,
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
	SPATIAL_E2E: 9653,
	// Integration ports = dev port + 7. The integration suite is a parallel,
	// HTTP-only coverage sweep across every flightbag reader URL pointed at a
	// dedicated database (`airboss_integration` / DEV_DB_URL_INTEGRATION).
	// Running on its own port lets the suite coexist with both a `bun run dev`
	// session (9640) and a `bun run test e2e` run (9643) on the same machine.
	// Only flightbag has an integration port today; other apps land here when
	// the suite expands.
	FLIGHTBAG_INTEGRATION: 9647,
} as const;
