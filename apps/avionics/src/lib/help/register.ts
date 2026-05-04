/**
 * Avionics-app help registration.
 *
 * Avionics has no authored help pages yet, so this file is an empty
 * registration -- importing it ensures the help registry is initialised
 * before the global search palette opens. When the first avionics help
 * page is authored, swap the empty array for an indices import (mirror
 * of `apps/study/src/lib/help/register.ts`) and add a body loader.
 *
 * The global search palette in the AppHeader's right cluster searches
 * the union of every app's registered indices, so an avionics user can
 * still find study or hangar help; they just won't see avionics-specific
 * results until pages exist.
 */

import { helpRegistry } from '@ab/help';

const AVIONICS_APP_ID = 'avionics';

export function registerAvionicsHelp(): void {
	helpRegistry.registerPages(AVIONICS_APP_ID, []);
}

// Module-eval side-effect: register on first import. Idempotent on
// re-import (supports HMR + per-request isolation).
registerAvionicsHelp();
