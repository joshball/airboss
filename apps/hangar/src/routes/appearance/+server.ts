/**
 * Persist the user's appearance preference for hangar.
 *
 * Delegates to `createAppearanceEndpoint` with `requireAuth: true` so the
 * shared safety contract (cookie name, validation, max-age) stays in sync
 * with sister apps. Hangar surfaces are admin-only, so an anonymous POST
 * is always either a probe or noise.
 */

import { createAppearanceEndpoint } from '@ab/themes';
import { dev } from '$app/environment';

export const POST = createAppearanceEndpoint({ dev, requireAuth: true });
