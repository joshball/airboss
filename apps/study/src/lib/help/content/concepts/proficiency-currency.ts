/**
 * Concept: Proficiency vs currency.
 *
 * The difference between legal-to-fly and actually-able-to-fly-safely.
 */

import { APP_SURFACES, CONCEPT_GROUPS, HELP_KINDS } from '@ab/constants';
import type { HelpPageIndex } from '@ab/help';

export const conceptProficiencyCurrencyIndex: HelpPageIndex = {
	id: 'concept-prof-currency',
	title: 'Proficiency vs currency',
	summary:
		'Currency is a legal box. Proficiency is whether you can actually fly the airplane safely today. They are not the same.',
	tags: {
		appSurface: [APP_SURFACES.KNOWLEDGE],
		helpKind: HELP_KINDS.CONCEPT,
		conceptGroup: CONCEPT_GROUPS.AVIATION_DOCTRINE,
		aviationTopic: ['regulations'],
		keywords: ['currency', 'proficiency', 'flight review', '90 day', '61.57', 'ipc', 'recency of experience'],
	},
	sections: [
		{ id: 'overview', title: 'Currency and proficiency are different words' },
		{ id: 'the-90-day-myth', title: 'The 90-day myth' },
		{ id: 'building-proficiency', title: 'Building proficiency (the right way)' },
		{ id: 'airbosss-stance', title: "airboss's stance" },
	],
	searchHaystack:
		"currency is a legal box. proficiency is whether you can actually fly the airplane safely today. they are not the same. **currency** is a legal status. have you satisfied the regulatory boxes that let you act as pilot in command with passengers, under ifr, at night, in category and class x? the faa defines these in 14 cfr 61.56 (flight review), 61.57 (recency of experience), and category/class-specific rules.\n\n**proficiency** is an operational status. can you fly this airplane in these conditions today, safely, with margin? proficiency is a judgment call, not a checklist item.\n\n:::warn\nyou can be current and not proficient. it is legal. it is also how pilots get hurt.\n:::\n\na pilot who did three takeoffs and landings to a full stop 89 days ago is currency-legal for passenger flight tomorrow under 61.57. whether they are proficient for a short-field night landing to a 2400' grass strip with a crosswind is a different question. the far doesn't ask it. you do. the rule in question is 14 cfr 61.57(a): three takeoffs and three landings in the preceding 90 days, in the same category/class (and type if type-rated), to be passenger-current.\n\nread in isolation, it can produce the following thought: \"i did three laps 89 days ago. i'm good for anything today.\"\n\nthat reading ignores everything else the faa has said about risk. pave, the 5p check, adm, srm -- all of it is built on the assumption that currency is a floor, not a ceiling. see adm and srm.\n\n:::example\npilot a: did three stop-and-goes in calm vmc 85 days ago. hasn't flown since. currency-legal.\n\npilot b: flies 4-6 hours per month in mixed conditions, including at least one flight that demands a go-around or a diversion. also currency-legal.\n\nsame legal status. radically different proficiency. an examiner, an insurer, and a flight instructor would treat them differently. a passenger, not knowing the difference, might make a decision they wouldn't make if they understood.\n::: currency is maintained by logging dates. proficiency is maintained by deliberate practice:\n\n| practice                                                          | what it builds                                           | rule of thumb                              |\n| ----------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------ |\n| regular flying in the actual conditions you plan to fly in.       | motor skills + decision-making calibrated to reality.    | twice a month minimum; more is better.     |\n| periodic work with an instructor beyond the minimum flight review. | blind spots surfaced by a second set of eyes.            | at least twice a year.                     |\n| scenario-based simulator or ground practice (including airboss reps). | adm/srm decision muscles without fuel cost.            | weekly in target season.                   |\n| ipc for ifr even if currency is satisfied another way.            | approach currency under real workload.                   | every 6 months is the old cfii standard.   |\n| cross-country currency (xc > 50nm) to unfamiliar fields.           | navigation, flight-planning, airspace judgment.          | at least monthly if you fly xc at all.     |\n\nac 120-71 codifies the framework for structured proficiency programs in commercial operations; the underlying idea applies at the ga level too. regular, varied, deliberate practice against the conditions you fly in. currency alone is the minimum; proficiency is the point. airboss lives on the proficiency side, not the currency side.\n\n:::tip\n**knowledge proficiency.** the scheduler keeps you sharp on regulations, procedures, and systems whether or not your next flight review is coming up. a current pilot with unused knowledge is a pilot who will fumble a question from atc.\n:::\n\n:::tip\n**decision proficiency.** reps are scenario-based; they exercise adm/srm without needing a logbook entry. a pilot who can't talk through a partial-panel diversion at the kitchen table won't do better with the real thing at 6,000 feet and the alternator light on.\n:::\n\n:::warn\n**what airboss doesn't do.** track your 90-day currency or the calendar for your flight review. those are logbook responsibilities and software that specializes in them does them better. airboss is the study side of the house -- it assumes you're handling the currency side somewhere else.\n::: currency proficiency flight review 90 day 61.57 ipc recency of experience",
	related: ['concept-adm-srm', 'concept-calibration'],
	reviewedAt: '2026-04-23',
	concept: true,
};
