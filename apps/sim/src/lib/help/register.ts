/**
 * Sim-app help registration.
 *
 * Sim has no authored help pages yet, so this file is an empty
 * registration -- importing it ensures the help registry is initialised
 * before the global search palette opens. When the first sim help page
 * is authored, swap the empty array for an indices import (mirror of
 * `apps/study/src/lib/help/register.ts`) and add a body loader.
 *
 * The global search palette in the AppHeader's right cluster searches
 * the union of every app's registered indices, so a sim user can still
 * find study or hangar help; they just won't see sim-specific results
 * until pages exist.
 */

import { helpRegistry } from '@ab/help';

const SIM_APP_ID = 'sim';

export function registerSimHelp(): void {
	helpRegistry.registerPages(SIM_APP_ID, []);
}

// Module-eval side-effect: register on first import. Idempotent on
// re-import (supports HMR + per-request isolation).
registerSimHelp();
