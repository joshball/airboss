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

import { APP_SURFACES, AVIATION_TOPICS, HELP_KINDS, ROUTES } from '@ab/constants';
import type { HelpPage } from '@ab/help';

export const calibration: HelpPage = {
	id: 'calibration',
	title: 'Calibration',
	summary: 'What the calibration score means, why gaps matter in piloting, and what to do about them.',
	documents: ROUTES.CALIBRATION,
	tags: {
		appSurface: [APP_SURFACES.CALIBRATION],
		helpKind: HELP_KINDS.CONCEPT,
		aviationTopic: [AVIATION_TOPICS.HUMAN_FACTORS],
		keywords: ['calibration', 'brier', 'overconfident', 'underconfident', 'confidence', 'metacognition'],
	},
	concept: true,
	related: ['memory-review', 'reps-session', 'getting-started', 'adm-safety', 'srm-safety'],
	reviewedAt: '2026-04-22',
	sections: [
		{
			id: 'what-calibration-is',
			title: 'What calibration means',
			body: `Calibration is the match between how confident you feel and how often you are actually right. A well-calibrated pilot who says "I'm 90% sure" is right about 90% of the time. An overconfident pilot is right less often than their stated confidence. An underconfident pilot is right more often than their stated confidence.

Both directions matter in piloting. Overconfidence kills - it is the precondition for scud-running, continued-VFR-into-IMC, and "I've done this approach a hundred times" get-home-itis. The accident record is full of pilots who were very sure about a decision that was wrong. See [[Aeronautical Decision-Making::adm-safety]] and [[Single-Pilot Resource Management::srm-safety]].

Underconfidence is slower but also costly. An IFR pilot who second-guesses every clearance loses situational awareness on the rest of the workload. A student who knows the answer but rates confidence at 2 every time is burning calibration signal and slowing learning.

The goal is not maximum confidence. The goal is accurate confidence.`,
		},
		{
			id: 'the-score',
			title: 'The score (lower is better)',
			body: `airboss scores calibration using a Brier-like metric. Every confidence-rated review and rep produces a \`(confidence, correct)\` pair where confidence is mapped to a probability and correct is 0 or 1. The squared difference, averaged across all pairs, is your calibration score. Lower is better. A perfect score is 0; the worst possible score is 1.

The empty-state page shows "Need N more rated reviews" because calibration needs a minimum sample before the score stabilizes. Come back after you have accumulated roughly 30+ confidence-rated reviews and the filled state will display a useful score plus the biggest gap.

The filled page shows:

- **Overall calibration score.** A single number. Trend over time matters more than the absolute value.
- **Per-domain breakdown.** Weather, Regs, Procedures, etc. Tells you where your confidence and accuracy diverge.
- **Per-confidence-level breakdown.** Buckets 1-5. Shows "when you say 5, how often are you right?" for each bucket.`,
		},
		{
			id: 'biggest-gap',
			title: 'Reading the biggest-gap line',
			body: `The dashboard's Calibration panel and the calibration page both surface a "biggest gap" line like:

> Overconfident at level 4 in Weather by 18%.

Read this as: "When you answer a Weather question and rate your confidence at level 4, you are right 18 percentage points less often than a confidence of 4 would predict." A level-4 confidence rating implies roughly 80% correct; an 18% gap means you are actually at 62% correct. That is the calibration problem in one line.

The same line can read "Underconfident at level 2 in Regs by 14%." You rate confidence at 2 on Regs questions (about 40% implied), but you are actually right 54% of the time. You know the regs better than you think.`,
		},
		{
			id: 'what-to-do',
			title: 'What to do about a gap',
			body: `**Overconfident in a domain.** Two things, in order:

1. Slow down on that domain's reps. Before you pick an option, pause. Check the chart supplement, the regulation, or the weather briefing - whatever source confirms the answer. Overconfidence without verification is the accident-chain precondition.
2. Start a domain-filtered review and rep session. The calibration page links directly to a pre-filtered queue for each gap row. Drill the domain until the gap narrows.

**Underconfident in a domain.** Also two things:

1. Trust your instinct more on that domain. When you feel you know the answer, rate confidence higher - you are calibrating the *signal*, so inflating confidence to match actual accuracy is correct.
2. Review the cards you have been rating low-confidence despite getting right. The page surfaces these as a filtered view. Often the underlying fact is solid and the hesitation is social ("I don't want to be wrong") rather than epistemic ("I don't actually know").

The UX review flagged that the calibration page's filled state was diagnostic-only. That is being fixed - each gap row will become a CTA. This help page explains the *why* behind the CTAs so the action feels informed, not arbitrary.`,
		},
		{
			id: 'how-calibration-connects-to-aeronautical-decision-making',
			title: 'How calibration connects to ADM',
			body: `Aeronautical Decision-Making ([[::adm-safety]]) is the cognitive discipline of making good go / no-go and in-flight decisions. Single-Pilot Resource Management ([[::srm-safety]]) extends ADM to resource-and-workload management when nobody is in the right seat to back you up.

Both frameworks include self-assessment as a core skill. The PAVE checklist (Pilot / Aircraft / enVironment / External pressures) asks you to rate your own readiness. The 5P framework (Plan / Plane / Pilot / Passengers / Programming) asks the same at each cockpit decision point. Rating your own readiness accurately is calibration.

airboss's calibration surface is a training ground for the self-assessment skill ADM and SRM both depend on. A pilot who is well calibrated on ground can self-assess more accurately in the aircraft. A pilot who is systematically overconfident on ground will be overconfident in the aircraft, where the cost is much higher.`,
		},
	],
	externalRefs: [
		{
			title: "FAA-H-8083-25C -- Pilot's Handbook of Aeronautical Knowledge, Chapter 2 (Aeronautical Decision-Making)",
			url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak',
			source: 'faa',
			note: 'PHAK Chapter 2 covers ADM, SRM, hazardous attitudes, and the self-assessment frameworks (PAVE, 5P) that calibration trains.',
		},
		{
			title: 'Verification of forecasts expressed in terms of probability (Brier, 1950)',
			url: 'https://doi.org/10.1175/1520-0493(1950)078%3C0001:VOFEIT%3E2.0.CO;2',
			source: 'paper',
			note: "The original Brier score paper. airboss's calibration metric is a Brier-style mean squared error between confidence and outcome.",
		},
		{
			title: 'Calibration of probabilities: The state of the art to 1980 (Lichtenstein, Fischhoff, Phillips)',
			url: 'https://doi.org/10.1017/CBO9780511809477.023',
			source: 'paper',
			note: 'Foundational survey of the metacognitive-calibration literature, including the systematic overconfidence finding that motivates the calibration surface.',
		},
	],
};
