/**
 * Study-app help pages -- INDEX SIDE.
 *
 * Browser layouts and the search palette static-import this module to
 * register page metadata + precomputed search haystacks. Section bodies
 * (`HelpPageBody`) load via dynamic `import()` keyed by id when a route
 * (`/help/[id]`) or component (`PageHelp` drawer) actually opens. The
 * split keeps ~2,300 lines of authored markdown out of the always-loaded
 * layout bundle (see docs/work/reviews/2026-05-02-ui-library-themes-perf.md).
 *
 * Author flow:
 *   - Edit a body file in `content/bodies/<id>.ts` -- bodies are the source
 *     of truth for the markdown.
 *   - Run `bun scripts/help/split-content.ts` to regenerate the matching
 *     index file (precomputed haystack + section titles). The full-pages
 *     module `./pages.ts` rebuilds from the same source pair.
 *
 * Adding a new help page: add the index file under `content/<id>.ts`,
 * add the body under `content/bodies/<id>.ts`, then add the new
 * `*Index` import + entry to `studyHelpIndex` and the `*Body` dynamic
 * import to `loadStudyHelpBody` below.
 */

import type { HelpBodyLoader, HelpPageBody, HelpPageIndex } from '@ab/help';
import { calibrationIndex } from './content/calibration';
import { conceptActiveRecallIndex } from './content/concepts/active-recall';
import { conceptAdmSrmIndex } from './content/concepts/adm-srm';
import { conceptCalibrationIndex } from './content/concepts/calibration';
import { conceptDesirableDifficultyIndex } from './content/concepts/desirable-difficulty';
import { conceptFsrsIndex } from './content/concepts/fsrs';
import { conceptInterleavingIndex } from './content/concepts/interleaving';
import { conceptKnowledgeGraphIndex } from './content/concepts/knowledge-graph';
import { conceptProficiencyCurrencyIndex } from './content/concepts/proficiency-currency';
import { conceptSessionSlicesIndex } from './content/concepts/session-slices';
import { conceptSpacedRepIndex } from './content/concepts/spaced-rep';
import { credentialsIndex } from './content/credentials';
import { dashboardIndex } from './content/dashboard';
import { focusDomainsIndex } from './content/focus-domains';
import { gettingStartedIndex } from './content/getting-started';
import { goalsIndex } from './content/goals';
import { inviteAcceptIndex } from './content/invite-accept';
import { keyboardShortcutsIndex } from './content/keyboard-shortcuts';
import { knowledgeGraphIndex } from './content/knowledge-graph';
import { lensIndex } from './content/lens';
import { libraryIndex } from './content/library';
import { memoryBrowseIndex } from './content/memory-browse';
import { memoryCardIndex } from './content/memory-card';
import { memoryDashboardIndex } from './content/memory-dashboard';
import { memoryNewIndex } from './content/memory-new';
import { memoryReviewIndex } from './content/memory-review';
import { repsIndex } from './content/reps';
import { repsBrowseIndex } from './content/reps-browse';
import { repsNewIndex } from './content/reps-new';
import { repsSessionIndex } from './content/reps-session';
import { sessionStartIndex } from './content/session-start';

export const studyHelpIndex: readonly HelpPageIndex[] = [
	gettingStartedIndex,
	dashboardIndex,
	memoryDashboardIndex,
	memoryNewIndex,
	memoryBrowseIndex,
	memoryCardIndex,
	memoryReviewIndex,
	repsIndex,
	repsBrowseIndex,
	repsNewIndex,
	repsSessionIndex,
	sessionStartIndex,
	focusDomainsIndex,
	goalsIndex,
	calibrationIndex,
	credentialsIndex,
	knowledgeGraphIndex,
	lensIndex,
	libraryIndex,
	inviteAcceptIndex,
	keyboardShortcutsIndex,
	conceptFsrsIndex,
	conceptSpacedRepIndex,
	conceptActiveRecallIndex,
	conceptCalibrationIndex,
	conceptInterleavingIndex,
	conceptDesirableDifficultyIndex,
	conceptKnowledgeGraphIndex,
	conceptSessionSlicesIndex,
	conceptAdmSrmIndex,
	conceptProficiencyCurrencyIndex,
];

/**
 * Body loader. One dynamic `import()` per page id maps to a separate
 * code-split chunk; the layout bundle never pulls in any body file.
 *
 * Returns `undefined` for ids this app doesn't own; the registry treats
 * the absence as a no-body-available signal (the page renders with empty
 * sections rather than crashing the route).
 */
export const loadStudyHelpBody: HelpBodyLoader = async (id: string): Promise<HelpPageBody | undefined> => {
	switch (id) {
		case 'getting-started':
			return (await import('./content/bodies/getting-started')).gettingStartedBody;
		case 'dashboard':
			return (await import('./content/bodies/dashboard')).dashboardBody;
		case 'memory-dashboard':
			return (await import('./content/bodies/memory-dashboard')).memoryDashboardBody;
		case 'memory-new':
			return (await import('./content/bodies/memory-new')).memoryNewBody;
		case 'memory-browse':
			return (await import('./content/bodies/memory-browse')).memoryBrowseBody;
		case 'memory-card':
			return (await import('./content/bodies/memory-card')).memoryCardBody;
		case 'memory-review':
			return (await import('./content/bodies/memory-review')).memoryReviewBody;
		case 'reps':
			return (await import('./content/bodies/reps')).repsBody;
		case 'reps-browse':
			return (await import('./content/bodies/reps-browse')).repsBrowseBody;
		case 'reps-new':
			return (await import('./content/bodies/reps-new')).repsNewBody;
		case 'reps-session':
			return (await import('./content/bodies/reps-session')).repsSessionBody;
		case 'session-start':
			return (await import('./content/bodies/session-start')).sessionStartBody;
		case 'focus-domains':
			return (await import('./content/bodies/focus-domains')).focusDomainsBody;
		case 'goals':
			return (await import('./content/bodies/goals')).goalsBody;
		case 'calibration':
			return (await import('./content/bodies/calibration')).calibrationBody;
		case 'credentials':
			return (await import('./content/bodies/credentials')).credentialsBody;
		case 'knowledge-graph':
			return (await import('./content/bodies/knowledge-graph')).knowledgeGraphBody;
		case 'lens':
			return (await import('./content/bodies/lens')).lensBody;
		case 'library':
			return (await import('./content/bodies/library')).libraryBody;
		case 'invite-accept':
			return (await import('./content/bodies/invite-accept')).inviteAcceptBody;
		case 'keyboard-shortcuts':
			return (await import('./content/bodies/keyboard-shortcuts')).keyboardShortcutsBody;
		case 'concept-fsrs':
			return (await import('./content/bodies/concepts/fsrs')).conceptFsrsBody;
		case 'concept-spaced-rep':
			return (await import('./content/bodies/concepts/spaced-rep')).conceptSpacedRepBody;
		case 'concept-active-recall':
			return (await import('./content/bodies/concepts/active-recall')).conceptActiveRecallBody;
		case 'concept-calibration':
			return (await import('./content/bodies/concepts/calibration')).conceptCalibrationBody;
		case 'concept-interleaving':
			return (await import('./content/bodies/concepts/interleaving')).conceptInterleavingBody;
		case 'concept-desirable-diff':
			return (await import('./content/bodies/concepts/desirable-difficulty')).conceptDesirableDifficultyBody;
		case 'concept-knowledge-graph':
			return (await import('./content/bodies/concepts/knowledge-graph')).conceptKnowledgeGraphBody;
		case 'concept-session-slices':
			return (await import('./content/bodies/concepts/session-slices')).conceptSessionSlicesBody;
		case 'concept-adm-srm':
			return (await import('./content/bodies/concepts/adm-srm')).conceptAdmSrmBody;
		case 'concept-prof-currency':
			return (await import('./content/bodies/concepts/proficiency-currency')).conceptProficiencyCurrencyBody;
		default:
			return undefined;
	}
};
