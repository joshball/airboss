/**
 * Concept: ADM and SRM.
 *
 * Aeronautical Decision-Making and Single-Pilot Resource Management --
 * the FAA's risk-management doctrine. One of the two direct airboss
 * <-> aviation-safety links (the other is calibration).
 */

import { APP_SURFACES, AVIATION_TOPICS, CONCEPT_GROUPS, HELP_KINDS } from '@ab/constants';
import type { HelpPage } from '@ab/help';

export const conceptAdmSrm: HelpPage = {
	id: 'concept-adm-srm',
	title: 'ADM and SRM',
	summary: "Aeronautical Decision-Making and Single-Pilot Resource Management -- the FAA's risk-management framework.",
	tags: {
		appSurface: [APP_SURFACES.KNOWLEDGE],
		helpKind: HELP_KINDS.CONCEPT,
		conceptGroup: CONCEPT_GROUPS.AVIATION_DOCTRINE,
		aviationTopic: [AVIATION_TOPICS.HUMAN_FACTORS],
		keywords: ['adm', 'srm', 'risk management', 'pave', 'decide', 'im-safe', '5p', 'human factors', 'checklist'],
	},
	concept: true,
	related: ['concept-calibration', 'concept-prof-currency', 'calibration'],
	reviewedAt: '2026-04-23',
	sections: [
		{
			id: 'overview',
			title: 'Overview',
			body: `Aviation accidents cluster in a small number of repeating patterns: continued VFR into IMC, running out of fuel, unstabilized approaches, get-home-itis. The common factor is rarely a technical failure of the airplane or the pilot's motor skills -- it's a decision that went wrong.

Aeronautical Decision-Making (ADM) and Single-Pilot Resource Management (SRM) are the FAA's doctrinal response. Both are taught in the Pilot's Handbook of Aeronautical Knowledge (FAA-H-8083-25C) and the Risk Management Handbook (FAA-H-8083-2). ADM is the broader frame (how do pilots make decisions?); SRM is the single-pilot specialization (how do you fly solo and still get the benefit of crew resource management?).

:::tip
ADM and SRM are the reason [[calibration::concept-calibration]] exists in airboss. A well-calibrated pilot makes better PAVE and 5P checks. A poorly-calibrated pilot talks themselves into decisions the data wouldn't support.
:::`,
		},
		{
			id: 'the-adm-cycle',
			title: 'The ADM cycle',
			body: `ADM models pilot decision-making as a continuous loop, not a one-time checklist. The FAA's canonical DECIDE model names the six steps:

| Step         | Prompt                                                               |
| ------------ | -------------------------------------------------------------------- |
| **D**etect   | Something changed. Notice it.                                        |
| **E**stimate | How significant is the change? What might it lead to?                |
| **C**hoose   | What's the desired outcome? Safe flight; define what safe looks like. |
| **I**dentify | What actions could produce that outcome? Brainstorm.                  |
| **D**o       | Take the best action.                                                |
| **E**valuate | Did it work? If not, back to Detect.                                 |

PAVE (the pre-flight frame) wraps four risk axes around the cycle:

| Letter | Axis                 | Check                                                                |
| ------ | -------------------- | -------------------------------------------------------------------- |
| **P**  | Pilot                | IMSAFE: Illness, Medication, Stress, Alcohol, Fatigue, Emotion.       |
| **A**  | Aircraft             | Airworthiness, equipment, performance for the flight.                 |
| **V**  | enVironment          | Weather, terrain, airspace, lighting, time of day.                    |
| **E**  | External pressures   | Schedule, passengers' expectations, "have-to-be-there" urgency.       |

PAVE pre-flight + DECIDE in flight. That's the full ADM kit.`,
		},
		{
			id: 'srm-and-the-5ps',
			title: 'SRM and the 5P check',
			body: `SRM extends ADM for the single-pilot world: no co-pilot to cross-check, no crew resource management in the classic sense. The pilot _is_ the crew.

The 5P check is the SRM checklist. Run it at major decision points (pre-flight, top of climb, top of descent, pre-approach, any surprise):

| P          | Meaning                                                                       |
| ---------- | ----------------------------------------------------------------------------- |
| **P**lan   | Is the flight plan still valid? Routing, altitude, alternates.                 |
| **P**lane  | Airplane OK? Fuel, systems, performance.                                       |
| **P**ilot  | You OK? Rerun IMSAFE. Are you ahead of or behind the airplane?                 |
| **P**assengers | People OK? Comfort, pressure, medical.                                     |
| **P**rogramming | Avionics set correctly? FMS/GPS loaded? Approach briefed?                 |

:::example
You're 40 minutes into a cross-country and the ceilings are lowering faster than forecast. 5P:

- **Plan:** Original destination may not work. Alternates?
- **Plane:** Fuel for the alternate? Anti-ice if temps drop?
- **Pilot:** How many hours of sleep last night? Have you flown this alternate before?
- **Passengers:** Anyone pressuring you to push on?
- **Programming:** Is the GPS loaded to the alternate yet or still to the destination?

The check forces a reset before the decision, not after.
:::`,
		},
		{
			id: 'in-airboss',
			title: 'In airboss',
			body: `airboss builds ADM/SRM into two surfaces.

:::tip
**Reps.** Scenario-based decision-making items directly exercise DECIDE. The scenario poses a situation, you choose an action, then see the outcome. Getting outcomes wrong (and being honest about your confidence when you committed) is how you build the metacognitive loop the framework depends on.
:::

:::tip
**Calibration.** The confidence-rating system is ADM in miniature. Every review where you say "I'm sure" and you're wrong is a small data point about overconfidence. Over a few hundred reviews, the Brier score gives you an objective measure of something the FAA has asked pilots to measure subjectively for decades. See [[calibration::concept-calibration]].
:::

:::warn
What airboss _doesn't_ do: substitute for scenario-based training with an instructor. ADM at the desk builds the framework; ADM in the airplane -- diversions, holds, partial-panel approaches under the hood -- proves the framework. Both are needed.
:::`,
		},
	],
	externalRefs: [
		{
			title: "FAA Pilot's Handbook of Aeronautical Knowledge (FAA-H-8083-25C)",
			url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak',
			source: 'faa',
			note: 'Chapter 2 -- Aeronautical Decision-Making. The source document for PAVE, DECIDE, IMSAFE.',
		},
		{
			title: 'FAA Risk Management Handbook (FAA-H-8083-2)',
			url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/risk_management_handbook',
			source: 'faa',
			note: 'Full treatment of ADM, SRM, and the 5P check. Companion to PHAK chapter 2.',
		},
		{
			title: 'Advisory Circular 60-22 -- Aeronautical Decision Making',
			url: 'https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_60-22.pdf',
			source: 'faa',
			note: 'The original 1991 AC that introduced formal ADM training to FAA curricula.',
		},
		{
			title: 'Crew resource management (Wikipedia)',
			url: 'https://en.wikipedia.org/wiki/Crew_resource_management',
			source: 'wikipedia',
			note: 'Origin of the broader doctrine SRM adapts for single-pilot operations.',
		},
	],
};
