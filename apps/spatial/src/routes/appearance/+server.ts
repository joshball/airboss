/**
 * Persist the user's appearance preference for spatial.
 *
 * Delegates to `createAppearanceEndpoint` so the cookie name, validation,
 * and attribute set stay in sync with sister apps. Not auth-gated:
 * spatial is visitor-friendly and the setting is cosmetic.
 */

import { createAppearanceEndpoint } from '@ab/themes';
import { dev } from '$app/environment';

export const POST = createAppearanceEndpoint({ dev });
