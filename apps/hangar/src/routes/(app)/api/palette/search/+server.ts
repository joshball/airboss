import { APP_SURFACES } from '@ab/constants';
import { handlePaletteSearch } from '@ab/help/server';
import type { RequestHandler } from './$types';

/**
 * Hangar app palette search endpoint. Same shape as the study endpoint;
 * delegates to the shared handler. Surface tag = `hangar`.
 */
export const POST: RequestHandler = (event) => handlePaletteSearch(event, APP_SURFACES.HANGAR);
