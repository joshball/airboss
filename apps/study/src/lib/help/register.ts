/**
 * Study-app help registration.
 *
 * Hands the study app's authored help pages over to `@ab/help` at
 * module-load time. The module-eval side-effect means:
 *
 *   - Server: the pages are registered the first time any server module
 *     imports `$lib/help/register`. SvelteKit load functions that hit the
 *     registry on the server get populated results because the shared
 *     module graph already evaluated this file.
 *   - Client: the same import registers the pages on the browser side
 *     after hydration, so the search palette opened from the nav has the
 *     same index the server used.
 *
 * Re-evaluation is safe: `helpRegistry.registerPages` is idempotent per
 * appId (it replaces the app's prior pages, no accumulation). HMR rounds
 * therefore can't duplicate.
 *
 * The actual `HelpPage[]` content lives in `./pages.ts` so validation
 * scripts (run under Bun, which doesn't read Vite aliases) can import
 * the list directly and register it against the same registry singleton.
 */

import { helpRegistry } from '@ab/help';
import { setInfoTipHelpResolver } from '@ab/ui/lib/info-tip-resolver';
import { studyHelpPages } from './pages';

const STUDY_APP_ID = 'study';

export { studyHelpPages };

export function registerStudyHelp(): void {
	helpRegistry.registerPages(STUDY_APP_ID, studyHelpPages);
	// Hand `@ab/ui` a registry-existence callback so InfoTip can dev-warn
	// on broken `helpId` props without importing from `@ab/help`. Inverting
	// this edge keeps the ui <-> help dependency acyclic.
	setInfoTipHelpResolver((id) => helpRegistry.getById(id) !== undefined);
}

// Module-eval side-effect: register on first import. Idempotent on
// re-import (supports HMR + per-request isolation).
registerStudyHelp();
