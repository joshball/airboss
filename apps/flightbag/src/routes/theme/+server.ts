/**
 * Persist the user's theme preference for flightbag.
 *
 * Delegates to `createThemeEndpoint`. Not auth-gated: flightbag is a
 * public reference reader and theme is cosmetic.
 */

import { createThemeEndpoint } from '@ab/themes';
import { dev } from '$app/environment';

export const POST = createThemeEndpoint({ dev });
