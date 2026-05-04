/**
 * Persist the user's appearance preference for avionics.
 *
 * Delegates to `createAppearanceEndpoint` so the cookie name, validation,
 * and attribute set stay in sync with sister apps. Not auth-gated:
 * avionics is visitor-friendly (the trainer runs without an account) and
 * the setting is cosmetic.
 */

import { createAppearanceEndpoint } from '@ab/themes';
import { dev } from '$app/environment';

export const POST = createAppearanceEndpoint({ dev });
