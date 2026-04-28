/**
 * Persist the user's theme preference for sim.
 *
 * `/sim/*` routes themselves are theme-locked to `sim/glass` for crash
 * safety (see `resolveThemeSelection` in `@ab/themes/resolve.ts`), but
 * the user may still pick a theme from sim's home screen for use on
 * routes that aren't locked. The endpoint and the lock are independent
 * concerns: the cookie always records the pref; the resolver decides
 * whether to honor it on a given path.
 */

import { createThemeEndpoint } from '@ab/themes';
import { dev } from '$app/environment';

export const POST = createThemeEndpoint({ dev });
