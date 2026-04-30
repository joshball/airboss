/**
 * Hangar-app help pages.
 *
 * Mirrors the study-app pattern in `apps/study/src/lib/help/pages.ts`.
 * Imports only the `HelpPage` type so this module is safe to evaluate
 * from both Vite-based runtime code and Bun-based build scripts.
 *
 * The registration call sits in `register.ts`, which is the module
 * apps actually import for the side-effect.
 */

import type { HelpPage } from '@ab/help';
import { audit } from './content/audit';
import { users } from './content/users';

export const hangarHelpPages: readonly HelpPage[] = [audit, users];
