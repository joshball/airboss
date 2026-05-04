/**
 * Persist the user's appearance preference for sim.
 *
 * Delegates to `createAppearanceEndpoint` so the cookie name, validation,
 * and attribute set stay in sync with sister apps. Not auth-gated: sim is
 * visitor-friendly (the AppHeader exposes the appearance toggle whether or
 * not the user is signed in) and the setting is cosmetic.
 */

import { createAppearanceEndpoint } from '@ab/themes';
import { dev } from '$app/environment';

export const POST = createAppearanceEndpoint({ dev });
