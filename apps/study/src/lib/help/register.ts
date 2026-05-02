/**
 * Study-app help registration.
 *
 * Hands the study app's authored help-page indices over to `@ab/help` at
 * module-load time. Section bodies stay outside the always-loaded layout
 * bundle: the registry's body loader uses dynamic `import()` keyed by id
 * (see `./pages-index.ts`).
 *
 * The module-eval side-effect means:
 *
 *   - Server: indices are registered the first time any server module
 *     imports `$lib/help/register`. SvelteKit load functions hit the
 *     registry server-side and get populated results because the shared
 *     module graph already evaluated this file.
 *   - Client: the same import registers indices on the browser side after
 *     hydration; the search palette + InfoTip resolver use them. Bodies
 *     load lazily on `/help/[id]` and PageHelp drawer open.
 *
 * Re-evaluation is safe: `helpRegistry.registerIndex` is idempotent per
 * appId (it replaces the app's prior pages, no accumulation). HMR rounds
 * therefore can't duplicate.
 */

import { helpRegistry } from '@ab/help';
import { setInfoTipHelpResolver } from '@ab/ui/lib/info-tip-resolver';
import { loadStudyHelpBody, studyHelpIndex } from './pages-index';

const STUDY_APP_ID = 'study';

export { studyHelpIndex };

export function registerStudyHelp(): void {
	helpRegistry.registerIndex(STUDY_APP_ID, studyHelpIndex, loadStudyHelpBody);
	// Hand `@ab/ui` a registry-existence callback so InfoTip can dev-warn
	// on broken `helpId` props without importing from `@ab/help`. Inverting
	// this edge keeps the ui <-> help dependency acyclic.
	setInfoTipHelpResolver((id) => helpRegistry.getById(id) !== undefined);
}

// Module-eval side-effect: register on first import. Idempotent on
// re-import (supports HMR + per-request isolation).
registerStudyHelp();
