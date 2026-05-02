/**
 * Concept: Calibration.
 *
 * The match between stated confidence and actual correctness. One of
 * the two direct airboss<->aviation-safety links (the other being ADM).
 */

import { APP_SURFACES, CONCEPT_GROUPS, HELP_KINDS } from '@ab/constants';
import type { HelpPageIndex } from '@ab/help';

export const conceptCalibrationIndex: HelpPageIndex = {
	id: 'concept-calibration',
	title: 'Calibration',
	summary:
		'How well your stated confidence matches how often you are actually right. Overconfidence kills; underconfidence is noise.',
	tags: {
		appSurface: [APP_SURFACES.CALIBRATION],
		helpKind: HELP_KINDS.CONCEPT,
		conceptGroup: CONCEPT_GROUPS.LEARNING_SCIENCE,
		aviationTopic: ['human-factors'],
		keywords: ['calibration', 'brier score', 'overconfidence', 'underconfidence', 'metacognition', 'confidence'],
	},
	sections: [
		{ id: 'confidence-vs-competence', title: 'Confidence vs competence' },
		{ id: 'over-and-under', title: 'Overconfident and underconfident' },
		{ id: 'brier-score', title: 'Brier score -- the measurement' },
		{ id: 'impact', title: 'Impact -- why airboss bothers' },
	],
	searchHaystack:
		"how well your stated confidence matches how often you are actually right. overconfidence kills; underconfidence is noise. competence is whether you _can_ do the task. calibration is whether you _know_ whether you can. they are not the same skill, and the gap between them is where accidents happen.\n\n:::example\na student pilot with 10 hours is not competent at single-pilot ifr. they know it. low competence, good calibration. safe outcome: they don't attempt it.\n\na 1,500-hour commercial pilot who has flown 50 lpv approaches in vmc thinks they're ready for a circle-to-land at minimums in actual imc. moderate competence, poor calibration. unsafe outcome: they attempt it.\n:::\n\ncalibration is the piece that lets you make _go/no-go_ decisions honestly. it is a metacognitive skill -- a skill about your own skills -- and like any skill it improves with deliberate practice and feedback. miscalibration has two failure modes:\n\n| direction      | pattern                                              | aviation risk                                                                                          |\n| -------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |\n| overconfident  | you say \"i'm sure\" and you're wrong more than you say. | continued vfr into imc. get-home-itis. \"i've done this approach a hundred times.\" fuel-exhaustion accidents. |\n| underconfident | you say \"i'm not sure\" and you're right more than you say. | spinning on a clearance you understood. declining an approach you could fly. missed opportunities, added workload. |\n| well-calibrated | your stated probability matches the observed rate.     | cleaner decisions. accurate internal weather picture. fewer surprises.                                 |\n\n> overconfidence kills. underconfidence noise-floors your decision-making. neither is virtue.\n\nthe faa's adm framework builds calibration training into pave, the 5p check, and the decide model. pilots who check \"what do i actually know here?\" before committing are doing calibration under another name. calibration is measurable. the standard metric is the _brier score_: the mean squared error between your stated probability and the actual outcome.\n\n```text\nfor each rating:\n  prob = confidence_to_probability(rating)     // e.g., 1..5 -> 0.2, 0.4, 0.6, 0.8, 0.95\n  correct = 1 if right else 0\n  error[i] = (prob - correct) ** 2\n\nbrier = mean(error)\n```\n\n| score        | interpretation                                                     |\n| ------------ | ------------------------------------------------------------------ |\n| 0.00         | perfect. you stated 0% for every wrong answer and 100% for every right one. |\n| ~0.10        | excellent. close to the ceiling for self-rated confidence.          |\n| ~0.20        | average for unpracticed raters. usable.                            |\n| ~0.25        | the score a coin flip would get. your confidence contains no information. |\n| > 0.25       | anti-calibrated. rare; usually a sign of reversed rating buttons.  |\n\nairboss computes your score over all confidence-rated reviews and reps and shows it on the [calibration page](/help/calibration). trend over time matters more than the absolute number. pure spaced-repetition tools don't measure calibration. airboss does because aviation is the domain where calibration translates most directly to outcomes.\n\n:::tip\n**flying.** every risk-management framework the faa teaches (pave, 5p, 3p, decide) relies on the pilot's ability to assess their own limits. a pilot who trains calibration at the desk gets a more accurate internal barometer at the hold-short line.\n:::\n\n:::tip\n**checkride orals.** examiners watch how you handle questions at the edge of your knowledge. a candidate who says \"i don't know, i'd look that up in [x]\" is calibrated and passes. one who confabulates fails.\n:::\n\n:::warn\n**the trap is skipping the confidence prompt.** skipping preserves speed; it also burns the signal that trains you. the prompt appears on a deterministic ~50% of reviews (see memory review). rate honestly, including 1s when you genuinely don't know.\n::: calibration brier score overconfidence underconfidence metacognition confidence",
	related: ['concept-adm-srm', 'concept-active-recall', 'concept-fsrs', 'calibration'],
	reviewedAt: '2026-04-23',
	concept: true,
};
