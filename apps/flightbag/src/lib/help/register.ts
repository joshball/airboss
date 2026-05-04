/**
 * Flightbag-app help registration.
 *
 * Flightbag has no authored help pages yet, so this file is an empty
 * registration -- importing it ensures the help registry is initialised
 * before the global search palette opens. When the first flightbag help
 * page is authored, swap the empty array for an indices import (mirror
 * of `apps/study/src/lib/help/register.ts`) and add a body loader.
 *
 * The global search palette in the AppHeader's right cluster searches
 * the union of every app's registered indices, so a flightbag user can
 * still find study or hangar help; they just won't see flightbag-specific
 * results until pages exist.
 */

import { helpRegistry } from '@ab/help';

const FLIGHTBAG_APP_ID = 'flightbag';

export function registerFlightbagHelp(): void {
	helpRegistry.registerPages(FLIGHTBAG_APP_ID, []);
}

// Module-eval side-effect: register on first import. Idempotent on
// re-import (supports HMR + per-request isolation).
registerFlightbagHelp();
