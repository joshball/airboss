/**
 * Persist the user's theme preference for spatial.
 *
 * Spatial participates in the full light/dark theme system. The endpoint
 * records the picker choice; the resolver in `@ab/themes` decides the
 * effective theme per route. Same shape as study/sim/hangar/avionics.
 */

import { createThemeEndpoint } from '@ab/themes';
import { dev } from '$app/environment';

export const POST = createThemeEndpoint({ dev });
