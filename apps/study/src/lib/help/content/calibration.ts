/**
 * Calibration help page.
 *
 * UX gaps addressed (docs/work/reviews/2026-04-22-app-wide-ux.md):
 *   - MAJOR "Calibration page doesn't explain what calibration is once you
 *     have data" -- this page is the explainer the filled-state page links
 *     to. New user with data lands here and learns what the score means.
 *   - MAJOR "Calibration filled-state is a dashboard with no 'what do I do
 *     next'" -- the "what to do about a gap" section names the actions.
 *   - "Empty state has no 'come back after X reviews'" -- documented here.
 */

import { APP_SURFACES, HELP_KINDS } from '@ab/constants';
import type { HelpPageIndex } from '@ab/help';

export const calibrationIndex: HelpPageIndex = {
	id: 'calibration',
	title: 'Calibration',
	summary: 'What the calibration score means, why gaps matter in piloting, and what to do about them.',
	tags: {
		appSurface: [APP_SURFACES.CALIBRATION],
		helpKind: HELP_KINDS.CONCEPT,
		aviationTopic: ['human-factors'],
		keywords: ['calibration', 'brier', 'overconfident', 'underconfident', 'confidence', 'metacognition'],
	},
	sections: [
		{ id: 'what-calibration-is', title: 'What calibration means' },
		{ id: 'the-score', title: 'The score (lower is better)' },
		{ id: 'biggest-gap', title: 'Reading the biggest-gap line' },
		{ id: 'what-to-do', title: 'What to do about a gap' },
		{ id: 'how-calibration-connects-to-aeronautical-decision-making', title: 'How calibration connects to ADM' },
	],
	searchHaystack:
		'what the calibration score means, why gaps matter in piloting, and what to do about them. calibration is the match between how confident you feel and how often you are actually right. a well-calibrated pilot who says "i\'m 90% sure" is right about 90% of the time. an overconfident pilot is right less often than their stated confidence. an underconfident pilot is right more often than their stated confidence.\n\nboth directions matter in piloting. overconfidence kills - it is the precondition for scud-running, continued-vfr-into-imc, and "i\'ve done this approach a hundred times" get-home-itis. the accident record is full of pilots who were very sure about a decision that was wrong. see aeronautical decision-making and single-pilot resource management.\n\nunderconfidence is slower but also costly. an ifr pilot who second-guesses every clearance loses situational awareness on the rest of the workload. a student who knows the answer but rates confidence at 2 every time is burning calibration signal and slowing learning.\n\nthe goal is not maximum confidence. the goal is accurate confidence. airboss scores calibration using a brier-like metric. every confidence-rated review and rep produces a `(confidence, correct)` pair where confidence is mapped to a probability and correct is 0 or 1. the squared difference, averaged across all pairs, is your calibration score. lower is better. a perfect score is 0; the worst possible score is 1.\n\nthe empty-state page shows "need n more rated reviews" because calibration needs a minimum sample before the score stabilizes. come back after you have accumulated roughly 30+ confidence-rated reviews and the filled state will display a useful score plus the biggest gap.\n\nthe filled page shows:\n\n- **overall calibration score.** a single number. trend over time matters more than the absolute value.\n- **per-domain breakdown.** weather, regs, procedures, etc. tells you where your confidence and accuracy diverge.\n- **per-confidence-level breakdown.** buckets 1-5. shows "when you say 5, how often are you right?" for each bucket. the dashboard\'s calibration panel and the calibration page both surface a "biggest gap" line like:\n\n> overconfident at level 4 in weather by 18%.\n\nread this as: "when you answer a weather question and rate your confidence at level 4, you are right 18 percentage points less often than a confidence of 4 would predict." a level-4 confidence rating implies roughly 80% correct; an 18% gap means you are actually at 62% correct. that is the calibration problem in one line.\n\nthe same line can read "underconfident at level 2 in regs by 14%." you rate confidence at 2 on regs questions (about 40% implied), but you are actually right 54% of the time. you know the regs better than you think. **overconfident in a domain.** two things, in order:\n\n1. slow down on that domain\'s reps. before you pick an option, pause. check the chart supplement, the regulation, or the weather briefing - whatever source confirms the answer. overconfidence without verification is the accident-chain precondition.\n2. start a domain-filtered review and rep session. the calibration page links directly to a pre-filtered queue for each gap row. drill the domain until the gap narrows.\n\n**underconfident in a domain.** also two things:\n\n1. trust your instinct more on that domain. when you feel you know the answer, rate confidence higher - you are calibrating the *signal*, so inflating confidence to match actual accuracy is correct.\n2. review the cards you have been rating low-confidence despite getting right. the page surfaces these as a filtered view. often the underlying fact is solid and the hesitation is social ("i don\'t want to be wrong") rather than epistemic ("i don\'t actually know").\n\nthe ux review flagged that the calibration page\'s filled state was diagnostic-only. that is being fixed - each gap row will become a cta. this help page explains the *why* behind the ctas so the action feels informed, not arbitrary. aeronautical decision-making () is the cognitive discipline of making good go / no-go and in-flight decisions. single-pilot resource management () extends adm to resource-and-workload management when nobody is in the right seat to back you up.\n\nboth frameworks include self-assessment as a core skill. the pave checklist (pilot / aircraft / environment / external pressures) asks you to rate your own readiness. the 5p framework (plan / plane / pilot / passengers / programming) asks the same at each cockpit decision point. rating your own readiness accurately is calibration.\n\nairboss\'s calibration surface is a training ground for the self-assessment skill adm and srm both depend on. a pilot who is well calibrated on ground can self-assess more accurately in the aircraft. a pilot who is systematically overconfident on ground will be overconfident in the aircraft, where the cost is much higher. calibration brier overconfident underconfident confidence metacognition',
	documents: '/insights/calibration',
	related: ['memory-review', 'reps-session', 'getting-started', 'adm-safety', 'srm-safety'],
	reviewedAt: '2026-04-22',
	concept: true,
};
