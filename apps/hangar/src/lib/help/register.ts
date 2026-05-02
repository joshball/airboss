/**
 * Hangar-app help registration.
 *
 * Mirrors `apps/study/src/lib/help/register.ts` -- module-eval side
 * effect, idempotent per appId. The registration is necessary so the
 * client + server search registries see the same set of authored pages.
 */

import { helpRegistry } from '@ab/help';
import { setInfoTipHelpResolver } from '@ab/ui/lib/info-tip-resolver';
import { hangarHelpPages } from './pages';

const HANGAR_APP_ID = 'hangar';

export { hangarHelpPages };

export function registerHangarHelp(): void {
	helpRegistry.registerPages(HANGAR_APP_ID, hangarHelpPages);
	// Hand `@ab/ui` a registry-existence callback so InfoTip can dev-warn
	// on broken `helpId` props without importing from `@ab/help`. Inverting
	// this edge keeps the ui <-> help dependency acyclic.
	setInfoTipHelpResolver((id) => helpRegistry.getById(id) !== undefined);
}

// Module-eval side-effect: register on first import. Idempotent on
// re-import (supports HMR + per-request isolation).
registerHangarHelp();
