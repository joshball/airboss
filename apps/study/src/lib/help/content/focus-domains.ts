/**
 * Help: Focus domains.
 *
 * Anchored from the FOCUS DOMAINS row of the preset detail panel on
 * `/session/start`. Explains what focus domains do, the cap, and the
 * breadth-vs-focus tradeoff so the user picks an intentional count
 * rather than accepting whatever a preset bundles.
 */

import { APP_SURFACES, HELP_KINDS } from '@ab/constants';
import type { HelpPage } from '@ab/help';

export const focusDomains: HelpPage = {
	id: 'focus-domains',
	title: 'Focus domains',
	summary:
		'Domains the engine biases toward when assembling sessions. More domains = broader refresher; fewer = deeper focus.',
	tags: {
		appSurface: [APP_SURFACES.PLANS, APP_SURFACES.SESSION],
		helpKind: HELP_KINDS.REFERENCE,
		keywords: ['focus domains', 'plan', 'preset', 'domain', 'breadth', 'focus', 'session'],
	},
	related: ['session-start', 'concept-session-slices'],
	reviewedAt: '2026-04-25',
	sections: [
		{
			id: 'what-they-do',
			title: 'What they do',
			body: `A plan's **focus domains** tell the session engine which knowledge areas to bias toward when it assembles your next session. The engine still pulls due reviews from any domain (Strengthen never abandons a slipping card just because its domain is off-list), but the Expand and Diversify slices stay weighted toward what you marked as focus.

Leaving the list empty is a valid plan state. An empty focus list means "no preference" and the engine balances across every domain you've touched.`,
		},
		{
			id: 'breadth-vs-focus',
			title: 'Breadth vs focus',
			body: `Focus domains are a dial, not a switch. Use them to express intent.

| Count | Posture            | When to pick this                                                 |
| ----- | ------------------ | ----------------------------------------------------------------- |
| 0     | Balanced default   | First plan; no specific goal yet; you trust the engine to mix.    |
| 1-2   | Single-area drill  | "I'm bad at weather" -- two-week sprint to push it into the green. |
| 3-5   | Focused study      | Checkride prep on a few related areas; cert-track refresher.      |
| 6-9   | Broad refresher    | BFR / IPC / FIRC -- you want most of the cert touched in one plan. |
| 10+   | Comprehensive      | Returning after a layoff; rebuilding everything; CFI re-prep.     |

The cap is the canonical domain count -- you can mark every domain as a focus if "study everything" is the actual goal. The Private Pilot overview preset uses 8 because PPL knowledge is broad by design.`,
		},
		{
			id: 'rule-of-thumb',
			title: 'Rule of thumb',
			body: `When in doubt, pick **3 to 5**. This is enough to give the Expand slice direction without starving the rest of your knowledge map. Smaller plans dilute slowly because Strengthen still surfaces due cards from off-list domains; larger plans dilute fast because Expand has too many options to converge on any single weakness.

If you find yourself wanting to add a tenth focus, that's a signal to pick a different posture (Comprehensive) or split the plan in two (one Focused study plan plus one Broad refresher plan, alternated week to week).`,
		},
		{
			id: 'interaction-with-skip',
			title: 'Interaction with skip domains',
			body: `Focus and skip lists are disjoint -- a domain can't be both at once. The engine validates this on save and rejects plans that try.

If you mark a domain as focus and later skip it, the focus entry is removed automatically. The reverse is also true: marking a skipped domain as focus drops it from the skip list. This keeps the dial single-valued per domain (focus, skip, or neither).`,
		},
	],
};
