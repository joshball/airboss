/**
 * Flightbag help landing.
 *
 * Flightbag has no authored help pages yet; this placeholder explains
 * that and routes the user across to the study help index. The
 * cross-origin URL is composed server-side via `siblingOrigin` so dev
 * (`*.airboss.test`) and prod (`*.air-boss.org`) both work without
 * per-env config.
 *
 * Replace with the standard help index loader (mirroring
 * `apps/study/src/routes/(app)/help/+page.ts`) when flightbag gets its
 * first authored help page.
 */

import { HOST_PREFIXES, ROUTES, siblingOrigin } from '@ab/constants';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => ({
	studyHelpUrl: `${siblingOrigin(event.url, HOST_PREFIXES.STUDY)}${ROUTES.HELP}`,
});
