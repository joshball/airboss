import { APP_SURFACES } from '@ab/constants';
import { handlePaletteSearch } from '@ab/help/server';
import type { RequestHandler } from './$types';

/**
 * Study app palette search endpoint. Delegates to the shared
 * `handlePaletteSearch` so every surface mounts the same request shape
 * (`POST { q }` -> `{ results }`). Surface tag is `global` -- the per-app
 * boost story sits on top of this; loaders today don't read it.
 */
export const POST: RequestHandler = (event) => handlePaletteSearch(event, APP_SURFACES.GLOBAL);
