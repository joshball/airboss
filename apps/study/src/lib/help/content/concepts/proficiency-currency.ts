/**
 * Concept: Proficiency vs currency.
 *
 * The difference between legal-to-fly and actually-able-to-fly-safely.
 */

import { APP_SURFACES, AVIATION_TOPICS, CONCEPT_GROUPS, HELP_KINDS } from '@ab/constants';
import type { HelpPage } from '@ab/help';

export const conceptProficiencyCurrency: HelpPage = {
	id: 'concept-prof-currency',
	title: 'Proficiency vs currency',
	summary:
		'Currency is a legal box. Proficiency is whether you can actually fly the airplane safely today. They are not the same.',
	tags: {
		appSurface: [APP_SURFACES.KNOWLEDGE],
		helpKind: HELP_KINDS.CONCEPT,
		conceptGroup: CONCEPT_GROUPS.AVIATION_DOCTRINE,
		aviationTopic: [AVIATION_TOPICS.REGULATIONS],
		keywords: ['currency', 'proficiency', 'flight review', '90 day', '61.57', 'ipc', 'recency of experience'],
	},
	concept: true,
	related: ['concept-adm-srm', 'concept-calibration'],
	reviewedAt: '2026-04-23',
	sections: [
		{
			id: 'overview',
			title: 'Currency and proficiency are different words',
			body: `**Currency** is a legal status. Have you satisfied the regulatory boxes that let you act as pilot in command with passengers, under IFR, at night, in category and class X? The FAA defines these in 14 CFR 61.56 (flight review), 61.57 (recency of experience), and category/class-specific rules.

**Proficiency** is an operational status. Can you fly this airplane in these conditions today, safely, with margin? Proficiency is a judgment call, not a checklist item.

:::warn
You can be current and not proficient. It is legal. It is also how pilots get hurt.
:::

A pilot who did three takeoffs and landings to a full stop 89 days ago is currency-legal for passenger flight tomorrow under 61.57. Whether they are proficient for a short-field night landing to a 2400' grass strip with a crosswind is a different question. The FAR doesn't ask it. You do.`,
		},
		{
			id: 'the-90-day-myth',
			title: 'The 90-day myth',
			body: `The rule in question is 14 CFR 61.57(a): three takeoffs and three landings in the preceding 90 days, in the same category/class (and type if type-rated), to be passenger-current.

Read in isolation, it can produce the following thought: "I did three laps 89 days ago. I'm good for anything today."

That reading ignores everything else the FAA has said about risk. PAVE, the 5P check, ADM, SRM -- all of it is built on the assumption that currency is a floor, not a ceiling. See [[ADM and SRM::concept-adm-srm]].

:::example
Pilot A: did three stop-and-goes in calm VMC 85 days ago. Hasn't flown since. Currency-legal.

Pilot B: flies 4-6 hours per month in mixed conditions, including at least one flight that demands a go-around or a diversion. Also currency-legal.

Same legal status. Radically different proficiency. An examiner, an insurer, and a flight instructor would treat them differently. A passenger, not knowing the difference, might make a decision they wouldn't make if they understood.
:::`,
		},
		{
			id: 'building-proficiency',
			title: 'Building proficiency (the right way)',
			body: `Currency is maintained by logging dates. Proficiency is maintained by deliberate practice:

| Practice                                                          | What it builds                                           | Rule of thumb                              |
| ----------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------ |
| Regular flying in the actual conditions you plan to fly in.       | Motor skills + decision-making calibrated to reality.    | Twice a month minimum; more is better.     |
| Periodic work with an instructor beyond the minimum flight review. | Blind spots surfaced by a second set of eyes.            | At least twice a year.                     |
| Scenario-based simulator or ground practice (including airboss reps). | ADM/SRM decision muscles without fuel cost.            | Weekly in target season.                   |
| IPC for IFR even if currency is satisfied another way.            | Approach currency under real workload.                   | Every 6 months is the old CFII standard.   |
| Cross-country currency (XC > 50nm) to unfamiliar fields.           | Navigation, flight-planning, airspace judgment.          | At least monthly if you fly XC at all.     |

AC 120-71 codifies the framework for structured proficiency programs in commercial operations; the underlying idea applies at the GA level too. Regular, varied, deliberate practice against the conditions you fly in. Currency alone is the minimum; proficiency is the point.`,
		},
		{
			id: 'airbosss-stance',
			title: "airboss's stance",
			body: `airboss lives on the proficiency side, not the currency side.

:::tip
**Knowledge proficiency.** The scheduler keeps you sharp on regulations, procedures, and systems whether or not your next flight review is coming up. A current pilot with unused knowledge is a pilot who will fumble a question from ATC.
:::

:::tip
**Decision proficiency.** Reps are scenario-based; they exercise ADM/SRM without needing a logbook entry. A pilot who can't talk through a partial-panel diversion at the kitchen table won't do better with the real thing at 6,000 feet and the alternator light on.
:::

:::warn
**What airboss doesn't do.** Track your 90-day currency or the calendar for your flight review. Those are logbook responsibilities and software that specializes in them does them better. airboss is the study side of the house -- it assumes you're handling the currency side somewhere else.
:::`,
		},
	],
	externalRefs: [
		{
			title: '14 CFR 61.57 -- Recent flight experience: Pilot in command',
			url: 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-D/part-61/subpart-A/section-61.57',
			source: 'other',
			note: 'The text of the currency rule itself. Primary source for passenger + IFR currency requirements.',
		},
		{
			title:
				'Advisory Circular 61-98 -- Currency Requirements and Guidance for the Flight Review and Instrument Proficiency Check',
			url: 'https://www.faa.gov/regulations_policies/advisory_circulars',
			source: 'faa',
			note: 'FAA guidance material accompanying 61.56 and 61.57. Distinguishes currency from proficiency explicitly.',
		},
		{
			title: 'Advisory Circular 120-71 -- Standard Operating Procedures and Pilot Monitoring Duties',
			url: 'https://www.faa.gov/regulations_policies/advisory_circulars',
			source: 'faa',
			note: 'Proficiency-training frameworks from 121/135 operations; principles generalize to Part 91.',
		},
	],
};
