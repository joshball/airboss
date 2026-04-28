/**
 * Persist the user's theme preference for hangar.
 *
 * Delegates to the shared factory in `@ab/themes` so the cookie / parser /
 * registry-validation contract stays in lockstep with study and sim --
 * exactly the duplication the picker extraction was meant to prevent.
 */

import { createThemeEndpoint } from '@ab/themes';
import { dev } from '$app/environment';

export const POST = createThemeEndpoint({ dev });
