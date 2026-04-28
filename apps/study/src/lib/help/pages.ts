/**
 * Study-app help pages.
 *
 * Per-page help (`gettingStarted` ... `keyboardShortcuts`) addresses the
 * UX gaps flagged in docs/work/reviews/2026-04-22-app-wide-ux.md.
 *
 * Concept pages (`conceptFsrs` ... `conceptProficiencyCurrency`) ship as
 * Phase 2 of the session-legibility-and-help-expansion work package:
 * ten foundational concept pages spanning learning science, airboss
 * architecture, and aviation doctrine. They power the `/help/concepts`
 * index and are the cross-link target for every per-page help body.
 *
 * Each page's content file carries a header comment mapping it to the
 * finding or concept it covers. Page content lives in `./content/*.ts`
 * (and `./content/concepts/*.ts`); this module is the registration
 * manifest.
 *
 * This module imports only the `HelpPage` type -- no aliases -- so it is
 * safe to import from both Vite-based runtime code and Bun-based build
 * scripts (which don't read Vite aliases). The registration call sits in
 * `register.ts`, which is the module apps actually import for the
 * side-effect.
 */

import type { HelpPage } from '@ab/help';
import { calibration } from './content/calibration';
import { conceptActiveRecall } from './content/concepts/active-recall';
import { conceptAdmSrm } from './content/concepts/adm-srm';
import { conceptCalibration } from './content/concepts/calibration';
import { conceptDesirableDifficulty } from './content/concepts/desirable-difficulty';
import { conceptFsrs } from './content/concepts/fsrs';
import { conceptInterleaving } from './content/concepts/interleaving';
import { conceptKnowledgeGraph } from './content/concepts/knowledge-graph';
import { conceptProficiencyCurrency } from './content/concepts/proficiency-currency';
import { conceptSessionSlices } from './content/concepts/session-slices';
import { conceptSpacedRep } from './content/concepts/spaced-rep';
import { credentials } from './content/credentials';
import { dashboard } from './content/dashboard';
import { focusDomains } from './content/focus-domains';
import { gettingStarted } from './content/getting-started';
import { goals } from './content/goals';
import { keyboardShortcuts } from './content/keyboard-shortcuts';
import { knowledgeGraph } from './content/knowledge-graph';
import { lens } from './content/lens';
import { memoryBrowse } from './content/memory-browse';
import { memoryCard } from './content/memory-card';
import { memoryDashboard } from './content/memory-dashboard';
import { memoryNew } from './content/memory-new';
import { memoryReview } from './content/memory-review';
import { reps } from './content/reps';
import { repsBrowse } from './content/reps-browse';
import { repsNew } from './content/reps-new';
import { repsSession } from './content/reps-session';
import { sessionStart } from './content/session-start';

export const studyHelpPages: readonly HelpPage[] = [
	gettingStarted,
	dashboard,
	memoryDashboard,
	memoryNew,
	memoryBrowse,
	memoryCard,
	memoryReview,
	reps,
	repsBrowse,
	repsNew,
	repsSession,
	sessionStart,
	focusDomains,
	goals,
	calibration,
	credentials,
	knowledgeGraph,
	lens,
	keyboardShortcuts,
	conceptFsrs,
	conceptSpacedRep,
	conceptActiveRecall,
	conceptCalibration,
	conceptInterleaving,
	conceptDesirableDifficulty,
	conceptKnowledgeGraph,
	conceptSessionSlices,
	conceptAdmSrm,
	conceptProficiencyCurrency,
];
