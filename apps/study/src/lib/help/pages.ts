/**
 * Study-app help pages.
 *
 * Phase 1 of wp-help-library ships NO authored content. Phase 2
 * (wp-help-library-content) populates this array with the seven pages
 * listed in the work package spec. Keeping this export live today means
 * the registration plumbing is wired end-to-end from day one.
 *
 * This module imports only the `HelpPage` type -- no aliases -- so it is
 * safe to import from both Vite-based runtime code and Bun-based build
 * scripts (which don't read Vite aliases). The registration call sits in
 * `register.ts`, which is the module apps actually import for the
 * side-effect.
 */

import type { HelpPage } from '@ab/help';

export const studyHelpPages: readonly HelpPage[] = [];
