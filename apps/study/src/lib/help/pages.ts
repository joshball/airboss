/**
 * Study-app help pages -- FULL list (index + body merged).
 *
 * This module materialises every page with its body markdown attached.
 * It is reserved for build-time consumers (the references validator under
 * Bun) that need the complete `HelpPage[]` shape. Browser layouts and the
 * search palette must NOT import this module; they go through the lazy
 * pair `pages-index.ts` (always-loaded metadata + precomputed haystacks)
 * and dynamic `loadStudyHelpBody(id)` so the body markdown does not ride
 * along in every signed-in route bundle.
 *
 * Adding a new page: edit `content/<id>.ts` (index) and
 * `content/bodies/<id>.ts` (body), then update both this module's static
 * imports and `pages-index.ts`. The splitter in
 * `scripts/help/split-content.ts` keeps the pair in sync.
 */

import type { HelpPage, HelpPageBody, HelpPageIndex } from '@ab/help';
import { calibrationBody } from './content/bodies/calibration';
import { conceptActiveRecallBody } from './content/bodies/concepts/active-recall';
import { conceptAdmSrmBody } from './content/bodies/concepts/adm-srm';
import { conceptCalibrationBody } from './content/bodies/concepts/calibration';
import { conceptDesirableDifficultyBody } from './content/bodies/concepts/desirable-difficulty';
import { conceptFsrsBody } from './content/bodies/concepts/fsrs';
import { conceptInterleavingBody } from './content/bodies/concepts/interleaving';
import { conceptKnowledgeGraphBody } from './content/bodies/concepts/knowledge-graph';
import { conceptProficiencyCurrencyBody } from './content/bodies/concepts/proficiency-currency';
import { conceptSessionSlicesBody } from './content/bodies/concepts/session-slices';
import { conceptSpacedRepBody } from './content/bodies/concepts/spaced-rep';
import { credentialsBody } from './content/bodies/credentials';
import { dashboardBody } from './content/bodies/dashboard';
import { focusDomainsBody } from './content/bodies/focus-domains';
import { gettingStartedBody } from './content/bodies/getting-started';
import { goalsBody } from './content/bodies/goals';
import { inviteAcceptBody } from './content/bodies/invite-accept';
import { keyboardShortcutsBody } from './content/bodies/keyboard-shortcuts';
import { knowledgeGraphBody } from './content/bodies/knowledge-graph';
import { lensBody } from './content/bodies/lens';
import { libraryBody } from './content/bodies/library';
import { memoryBrowseBody } from './content/bodies/memory-browse';
import { memoryCardBody } from './content/bodies/memory-card';
import { memoryDashboardBody } from './content/bodies/memory-dashboard';
import { memoryNewBody } from './content/bodies/memory-new';
import { memoryReviewBody } from './content/bodies/memory-review';
import { repsBody } from './content/bodies/reps';
import { repsBrowseBody } from './content/bodies/reps-browse';
import { repsNewBody } from './content/bodies/reps-new';
import { repsSessionBody } from './content/bodies/reps-session';
import { sessionStartBody } from './content/bodies/session-start';
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

function merge(index: HelpPageIndex, body: HelpPageBody): HelpPage {
	return {
		id: index.id,
		title: index.title,
		summary: index.summary,
		tags: index.tags,
		sections: body.sections,
		documents: index.documents,
		related: index.related,
		author: index.author,
		reviewedAt: index.reviewedAt,
		concept: index.concept,
		externalRefs: body.externalRefs ?? index.externalRefs,
	};
}

export const studyHelpPages: readonly HelpPage[] = [
	merge(gettingStartedIndex, gettingStartedBody),
	merge(dashboardIndex, dashboardBody),
	merge(memoryDashboardIndex, memoryDashboardBody),
	merge(memoryNewIndex, memoryNewBody),
	merge(memoryBrowseIndex, memoryBrowseBody),
	merge(memoryCardIndex, memoryCardBody),
	merge(memoryReviewIndex, memoryReviewBody),
	merge(repsIndex, repsBody),
	merge(repsBrowseIndex, repsBrowseBody),
	merge(repsNewIndex, repsNewBody),
	merge(repsSessionIndex, repsSessionBody),
	merge(sessionStartIndex, sessionStartBody),
	merge(focusDomainsIndex, focusDomainsBody),
	merge(goalsIndex, goalsBody),
	merge(calibrationIndex, calibrationBody),
	merge(credentialsIndex, credentialsBody),
	merge(knowledgeGraphIndex, knowledgeGraphBody),
	merge(lensIndex, lensBody),
	merge(libraryIndex, libraryBody),
	merge(inviteAcceptIndex, inviteAcceptBody),
	merge(keyboardShortcutsIndex, keyboardShortcutsBody),
	merge(conceptFsrsIndex, conceptFsrsBody),
	merge(conceptSpacedRepIndex, conceptSpacedRepBody),
	merge(conceptActiveRecallIndex, conceptActiveRecallBody),
	merge(conceptCalibrationIndex, conceptCalibrationBody),
	merge(conceptInterleavingIndex, conceptInterleavingBody),
	merge(conceptDesirableDifficultyIndex, conceptDesirableDifficultyBody),
	merge(conceptKnowledgeGraphIndex, conceptKnowledgeGraphBody),
	merge(conceptSessionSlicesIndex, conceptSessionSlicesBody),
	merge(conceptAdmSrmIndex, conceptAdmSrmBody),
	merge(conceptProficiencyCurrencyIndex, conceptProficiencyCurrencyBody),
];
