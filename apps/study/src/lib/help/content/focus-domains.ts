/**
 * Help: Focus domains.
 *
 * Anchored from the FOCUS DOMAINS row of the preset detail panel on
 * `/session/start`. Explains what focus domains do, the cap, and the
 * breadth-vs-focus tradeoff so the user picks an intentional count
 * rather than accepting whatever a preset bundles.
 */

import { APP_SURFACES, HELP_KINDS } from '@ab/constants';
import type { HelpPageIndex } from '@ab/help';

export const focusDomainsIndex: HelpPageIndex = {
	id: 'focus-domains',
	title: 'Focus domains',
	summary:
		'Domains the engine biases toward when assembling sessions. More domains = broader refresher; fewer = deeper focus.',
	tags: {
		appSurface: [APP_SURFACES.PLANS, APP_SURFACES.SESSION],
		helpKind: HELP_KINDS.REFERENCE,
		keywords: ['focus domains', 'plan', 'preset', 'domain', 'breadth', 'focus', 'session'],
	},
	sections: [
		{ id: 'what-they-do', title: 'What they do' },
		{ id: 'breadth-vs-focus', title: 'Breadth vs focus' },
		{ id: 'rule-of-thumb', title: 'Rule of thumb' },
		{ id: 'interaction-with-skip', title: 'Interaction with skip domains' },
	],
	searchHaystack:
		'domains the engine biases toward when assembling sessions. more domains = broader refresher; fewer = deeper focus. a plan\'s **focus domains** tell the session engine which knowledge areas to bias toward when it assembles your next session. the engine still pulls due reviews from any domain (strengthen never abandons a slipping card just because its domain is off-list), but the expand and diversify slices stay weighted toward what you marked as focus.\n\nleaving the list empty is a valid plan state. an empty focus list means "no preference" and the engine balances across every domain you\'ve touched. focus domains are a dial, not a switch. use them to express intent.\n\n| count | posture            | when to pick this                                                 |\n| ----- | ------------------ | ----------------------------------------------------------------- |\n| 0     | balanced default   | first plan; no specific goal yet; you trust the engine to mix.    |\n| 1-2   | single-area drill  | "i\'m bad at weather" -- two-week sprint to push it into the green. |\n| 3-5   | focused study      | checkride prep on a few related areas; cert-track refresher.      |\n| 6-9   | broad refresher    | bfr / ipc / firc -- you want most of the cert touched in one plan. |\n| 10+   | comprehensive      | returning after a layoff; rebuilding everything; cfi re-prep.     |\n\nthe cap is the canonical domain count -- you can mark every domain as a focus if "study everything" is the actual goal. the private pilot overview preset uses 8 because ppl knowledge is broad by design. when in doubt, pick **3 to 5**. this is enough to give the expand slice direction without starving the rest of your knowledge map. smaller plans dilute slowly because strengthen still surfaces due cards from off-list domains; larger plans dilute fast because expand has too many options to converge on any single weakness.\n\nif you find yourself wanting to add a tenth focus, that\'s a signal to pick a different posture (comprehensive) or split the plan in two (one focused study plan plus one broad refresher plan, alternated week to week). focus and skip lists are disjoint -- a domain can\'t be both at once. the engine validates this on save and rejects plans that try.\n\nif you mark a domain as focus and later skip it, the focus entry is removed automatically. the reverse is also true: marking a skipped domain as focus drops it from the skip list. this keeps the dial single-valued per domain (focus, skip, or neither). focus domains plan preset domain breadth focus session',
	related: ['session-start', 'concept-session-slices'],
	reviewedAt: '2026-04-25',
};
