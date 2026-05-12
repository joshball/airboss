import { APP_SURFACES } from '@ab/constants';
import { handlePaletteSearch } from '@ab/help/server';
import type { RequestHandler } from './$types';

/**
 * Sim app palette search endpoint. Same shape as the study endpoint;
 * delegates to the shared handler with `global` as the surface tag.
 */
export const POST: RequestHandler = (event) => handlePaletteSearch(event, APP_SURFACES.GLOBAL);
