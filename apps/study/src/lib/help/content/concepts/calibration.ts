/**
 * Concept: Calibration.
 *
 * The match between stated confidence and actual correctness. One of
 * the two direct airboss<->aviation-safety links (the other being ADM).
 */

import { APP_SURFACES, AVIATION_TOPICS, CONCEPT_GROUPS, HELP_KINDS } from '@ab/constants';
import type { HelpPage } from '@ab/help';

export const conceptCalibration: HelpPage = {
	id: 'concept-calibration',
	title: 'Calibration',
	summary:
		'How well your stated confidence matches how often you are actually right. Overconfidence kills; underconfidence is noise.',
	tags: {
		appSurface: [APP_SURFACES.CALIBRATION],
		helpKind: HELP_KINDS.CONCEPT,
		conceptGroup: CONCEPT_GROUPS.LEARNING_SCIENCE,
		aviationTopic: [AVIATION_TOPICS.HUMAN_FACTORS],
		keywords: ['calibration', 'brier score', 'overconfidence', 'underconfidence', 'metacognition', 'confidence'],
	},
	concept: true,
	related: ['concept-adm-srm', 'concept-active-recall', 'concept-fsrs', 'calibration'],
	reviewedAt: '2026-04-23',
	sections: [
		{
			id: 'confidence-vs-competence',
			title: 'Confidence vs competence',
			body: `Competence is whether you _can_ do the task. Calibration is whether you _know_ whether you can. They are not the same skill, and the gap between them is where accidents happen.

:::example
A student pilot with 10 hours is not competent at single-pilot IFR. They know it. Low competence, good calibration. Safe outcome: they don't attempt it.

A 1,500-hour commercial pilot who has flown 50 LPV approaches in VMC thinks they're ready for a circle-to-land at minimums in actual IMC. Moderate competence, poor calibration. Unsafe outcome: they attempt it.
:::

Calibration is the piece that lets you make _go/no-go_ decisions honestly. It is a metacognitive skill -- a skill about your own skills -- and like any skill it improves with deliberate practice and feedback.`,
		},
		{
			id: 'over-and-under',
			title: 'Overconfident and underconfident',
			body: `Miscalibration has two failure modes:

| Direction      | Pattern                                              | Aviation risk                                                                                          |
| -------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Overconfident  | You say "I'm sure" and you're wrong more than you say. | Continued VFR into IMC. Get-home-itis. "I've done this approach a hundred times." Fuel-exhaustion accidents. |
| Underconfident | You say "I'm not sure" and you're right more than you say. | Spinning on a clearance you understood. Declining an approach you could fly. Missed opportunities, added workload. |
| Well-calibrated | Your stated probability matches the observed rate.     | Cleaner decisions. Accurate internal weather picture. Fewer surprises.                                 |

> Overconfidence kills. Underconfidence noise-floors your decision-making. Neither is virtue.

The FAA's [[ADM::concept-adm-srm]] framework builds calibration training into PAVE, the 5P check, and the DECIDE model. Pilots who check "what do I actually know here?" before committing are doing calibration under another name.`,
		},
		{
			id: 'brier-score',
			title: 'Brier score -- the measurement',
			body: `Calibration is measurable. The standard metric is the _Brier score_: the mean squared error between your stated probability and the actual outcome.

\`\`\`text
for each rating:
  prob = confidence_to_probability(rating)     // e.g., 1..5 -> 0.2, 0.4, 0.6, 0.8, 0.95
  correct = 1 if right else 0
  error[i] = (prob - correct) ** 2

brier = mean(error)
\`\`\`

| Score        | Interpretation                                                     |
| ------------ | ------------------------------------------------------------------ |
| 0.00         | Perfect. You stated 0% for every wrong answer and 100% for every right one. |
| ~0.10        | Excellent. Close to the ceiling for self-rated confidence.          |
| ~0.20        | Average for unpracticed raters. Usable.                            |
| ~0.25        | The score a coin flip would get. Your confidence contains no information. |
| > 0.25       | Anti-calibrated. Rare; usually a sign of reversed rating buttons.  |

airboss computes your score over all confidence-rated reviews and reps and shows it on the [calibration page](/help/calibration). Trend over time matters more than the absolute number.`,
		},
		{
			id: 'impact',
			title: 'Impact -- why airboss bothers',
			body: `Pure spaced-repetition tools don't measure calibration. airboss does because aviation is the domain where calibration translates most directly to outcomes.

:::tip
**Flying.** Every risk-management framework the FAA teaches (PAVE, 5P, 3P, DECIDE) relies on the pilot's ability to assess their own limits. A pilot who trains calibration at the desk gets a more accurate internal barometer at the hold-short line.
:::

:::tip
**Checkride orals.** Examiners watch how you handle questions at the edge of your knowledge. A candidate who says "I don't know, I'd look that up in [X]" is calibrated and passes. One who confabulates fails.
:::

:::warn
**The trap is skipping the confidence prompt.** Skipping preserves speed; it also burns the signal that trains you. The prompt appears on a deterministic ~50% of reviews (see [[memory review::memory-review]]). Rate honestly, including 1s when you genuinely don't know.
:::`,
		},
	],
	externalRefs: [
		{
			title: 'Brier score (Wikipedia)',
			url: 'https://en.wikipedia.org/wiki/Brier_score',
			source: 'wikipedia',
			note: 'The measurement underneath airboss calibration scoring.',
		},
		{
			title:
				"FAA Pilot's Handbook of Aeronautical Knowledge (FAA-H-8083-25C), Chapter 2 -- Aeronautical Decision-Making",
			url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak',
			source: 'faa',
			note: "PAVE, DECIDE, and the FAA's framework for self-assessed risk.",
		},
		{
			title: 'Calibration (statistics) -- Wikipedia',
			url: 'https://en.wikipedia.org/wiki/Calibration_(statistics)',
			source: 'wikipedia',
			note: 'Formal definition of a calibrated forecaster.',
		},
	],
};
