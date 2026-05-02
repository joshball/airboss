/**
 * Concept: ADM and SRM.
 *
 * Aeronautical Decision-Making and Single-Pilot Resource Management --
 * the FAA's risk-management doctrine. One of the two direct airboss
 * <-> aviation-safety links (the other is calibration).
 */

import { APP_SURFACES, CONCEPT_GROUPS, HELP_KINDS } from '@ab/constants';
import type { HelpPageIndex } from '@ab/help';

export const conceptAdmSrmIndex: HelpPageIndex = {
	id: 'concept-adm-srm',
	title: 'ADM and SRM',
	summary: "Aeronautical Decision-Making and Single-Pilot Resource Management -- the FAA's risk-management framework.",
	tags: {
		appSurface: [APP_SURFACES.KNOWLEDGE],
		helpKind: HELP_KINDS.CONCEPT,
		conceptGroup: CONCEPT_GROUPS.AVIATION_DOCTRINE,
		aviationTopic: ['human-factors'],
		keywords: ['adm', 'srm', 'risk management', 'pave', 'decide', 'im-safe', '5p', 'human factors', 'checklist'],
	},
	sections: [
		{ id: 'overview', title: 'Overview' },
		{ id: 'the-adm-cycle', title: 'The ADM cycle' },
		{ id: 'srm-and-the-5ps', title: 'SRM and the 5P check' },
		{ id: 'in-airboss', title: 'In airboss' },
	],
	searchHaystack:
		"aeronautical decision-making and single-pilot resource management -- the faa's risk-management framework. aviation accidents cluster in a small number of repeating patterns: continued vfr into imc, running out of fuel, unstabilized approaches, get-home-itis. the common factor is rarely a technical failure of the airplane or the pilot's motor skills -- it's a decision that went wrong.\n\naeronautical decision-making (adm) and single-pilot resource management (srm) are the faa's doctrinal response. both are taught in the pilot's handbook of aeronautical knowledge (faa-h-8083-25c) and the risk management handbook (faa-h-8083-2). adm is the broader frame (how do pilots make decisions?); srm is the single-pilot specialization (how do you fly solo and still get the benefit of crew resource management?).\n\n:::tip\nadm and srm are the reason calibration exists in airboss. a well-calibrated pilot makes better pave and 5p checks. a poorly-calibrated pilot talks themselves into decisions the data wouldn't support.\n::: adm models pilot decision-making as a continuous loop, not a one-time checklist. the faa's canonical decide model names the six steps:\n\n| step         | prompt                                                               |\n| ------------ | -------------------------------------------------------------------- |\n| **d**etect   | something changed. notice it.                                        |\n| **e**stimate | how significant is the change? what might it lead to?                |\n| **c**hoose   | what's the desired outcome? safe flight; define what safe looks like. |\n| **i**dentify | what actions could produce that outcome? brainstorm.                  |\n| **d**o       | take the best action.                                                |\n| **e**valuate | did it work? if not, back to detect.                                 |\n\npave (the pre-flight frame) wraps four risk axes around the cycle:\n\n| letter | axis                 | check                                                                |\n| ------ | -------------------- | -------------------------------------------------------------------- |\n| **p**  | pilot                | imsafe: illness, medication, stress, alcohol, fatigue, emotion.       |\n| **a**  | aircraft             | airworthiness, equipment, performance for the flight.                 |\n| **v**  | environment          | weather, terrain, airspace, lighting, time of day.                    |\n| **e**  | external pressures   | schedule, passengers' expectations, \"have-to-be-there\" urgency.       |\n\npave pre-flight + decide in flight. that's the full adm kit. srm extends adm for the single-pilot world: no co-pilot to cross-check, no crew resource management in the classic sense. the pilot _is_ the crew.\n\nthe 5p check is the srm checklist. run it at major decision points (pre-flight, top of climb, top of descent, pre-approach, any surprise):\n\n| p          | meaning                                                                       |\n| ---------- | ----------------------------------------------------------------------------- |\n| **p**lan   | is the flight plan still valid? routing, altitude, alternates.                 |\n| **p**lane  | airplane ok? fuel, systems, performance.                                       |\n| **p**ilot  | you ok? rerun imsafe. are you ahead of or behind the airplane?                 |\n| **p**assengers | people ok? comfort, pressure, medical.                                     |\n| **p**rogramming | avionics set correctly? fms/gps loaded? approach briefed?                 |\n\n:::example\nyou're 40 minutes into a cross-country and the ceilings are lowering faster than forecast. 5p:\n\n- **plan:** original destination may not work. alternates?\n- **plane:** fuel for the alternate? anti-ice if temps drop?\n- **pilot:** how many hours of sleep last night? have you flown this alternate before?\n- **passengers:** anyone pressuring you to push on?\n- **programming:** is the gps loaded to the alternate yet or still to the destination?\n\nthe check forces a reset before the decision, not after.\n::: airboss builds adm/srm into two surfaces.\n\n:::tip\n**reps.** scenario-based decision-making items directly exercise decide. the scenario poses a situation, you choose an action, then see the outcome. getting outcomes wrong (and being honest about your confidence when you committed) is how you build the metacognitive loop the framework depends on.\n:::\n\n:::tip\n**calibration.** the confidence-rating system is adm in miniature. every review where you say \"i'm sure\" and you're wrong is a small data point about overconfidence. over a few hundred reviews, the brier score gives you an objective measure of something the faa has asked pilots to measure subjectively for decades. see calibration.\n:::\n\n:::warn\nwhat airboss _doesn't_ do: substitute for scenario-based training with an instructor. adm at the desk builds the framework; adm in the airplane -- diversions, holds, partial-panel approaches under the hood -- proves the framework. both are needed.\n::: adm srm risk management pave decide im-safe 5p human factors checklist",
	related: ['concept-calibration', 'concept-prof-currency', 'calibration'],
	reviewedAt: '2026-04-23',
	concept: true,
};
