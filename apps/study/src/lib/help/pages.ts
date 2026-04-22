/**
 * Study-app help pages.
 *
 * Phase 2 of wp-help-library (this file): the seven authored pages that
 * cover the UX gaps flagged in docs/work/reviews/2026-04-22-app-wide-ux.md.
 *
 * Each page's content file carries a header comment mapping the page to
 * the specific UX-review findings it addresses. Page content lives in
 * `./content/*.ts`; this module is the registration manifest.
 *
 * This module imports only the `HelpPage` type -- no aliases -- so it is
 * safe to import from both Vite-based runtime code and Bun-based build
 * scripts (which don't read Vite aliases). The registration call sits in
 * `register.ts`, which is the module apps actually import for the
 * side-effect.
 */

import type { HelpPage } from '@ab/help';
import { calibration } from './content/calibration';
import { dashboard } from './content/dashboard';
import { gettingStarted } from './content/getting-started';
import { keyboardShortcuts } from './content/keyboard-shortcuts';
import { knowledgeGraph } from './content/knowledge-graph';
import { memoryReview } from './content/memory-review';
import { repsSession } from './content/reps-session';

export const studyHelpPages: readonly HelpPage[] = [
	gettingStarted,
	dashboard,
	memoryReview,
	repsSession,
	calibration,
	knowledgeGraph,
	keyboardShortcuts,
];
