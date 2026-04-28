/**
 * Persist the user's theme preference for avionics.
 *
 * Avionics participates in the full light/dark theme system -- there
 * is no surface lock today. The endpoint just records the picker
 * choice; the resolver in `@ab/themes` decides the effective theme
 * per route at render time, same shape as study/sim/hangar.
 */

import { createThemeEndpoint } from '@ab/themes';
import { dev } from '$app/environment';

export const POST = createThemeEndpoint({ dev });
