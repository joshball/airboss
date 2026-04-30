/**
 * Hangar-app help registration.
 *
 * Mirrors `apps/study/src/lib/help/register.ts` -- module-eval side
 * effect, idempotent per appId. The registration is necessary so the
 * client + server search registries see the same set of authored pages.
 */

import { helpRegistry } from '@ab/help';
import { hangarHelpPages } from './pages';

const HANGAR_APP_ID = 'hangar';

export { hangarHelpPages };

export function registerHangarHelp(): void {
	helpRegistry.registerPages(HANGAR_APP_ID, hangarHelpPages);
}

// Module-eval side-effect: register on first import. Idempotent on
// re-import (supports HMR + per-request isolation).
registerHangarHelp();
