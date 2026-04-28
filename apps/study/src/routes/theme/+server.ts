/**
 * Persist the user's theme preference.
 *
 * Delegates to the shared factory in `@ab/themes` so all four apps
 * (study, sim, hangar, avionics) share one validated cookie/parse/persist path
 * -- the registry is the only allow-list for theme ids and the cookie
 * attributes (Path=/, Max-Age=1y, SameSite=Lax) can't drift between apps.
 */

import { createThemeEndpoint } from '@ab/themes';
import { dev } from '$app/environment';

export const POST = createThemeEndpoint({ dev });
