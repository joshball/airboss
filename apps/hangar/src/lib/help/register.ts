/**
 * Hangar-app help registration.
 *
 * Mirrors `apps/study/src/lib/help/register.ts` -- module-eval side
 * effect, idempotent per appId. The registration hands over indices +
 * a body loader so section markdown does not ride along in the
 * always-loaded layout bundle.
 */

import { helpRegistry } from '@ab/help';
import { setInfoTipHelpResolver } from '@ab/ui/lib/info-tip-resolver';
import { hangarHelpIndex, loadHangarHelpBody } from './pages-index';

const HANGAR_APP_ID = 'hangar';

export { hangarHelpIndex };

export function registerHangarHelp(): void {
	helpRegistry.registerIndex(HANGAR_APP_ID, hangarHelpIndex, loadHangarHelpBody);
	// Hand `@ab/ui` a registry-existence callback so InfoTip can dev-warn
	// on broken `helpId` props without importing from `@ab/help`. Inverting
	// this edge keeps the ui <-> help dependency acyclic.
	setInfoTipHelpResolver((id) => helpRegistry.getById(id) !== undefined);
}

// Module-eval side-effect: register on first import. Idempotent on
// re-import (supports HMR + per-request isolation).
registerHangarHelp();
