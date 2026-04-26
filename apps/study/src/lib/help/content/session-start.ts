/**
 * Session-start help page.
 *
 * Authoritative explanation of what `/session/start` shows: slices, kinds,
 * reason codes, priorities, domains, and mode weights. The reason-codes
 * table is built programmatically from `SESSION_REASON_CODE_DEFINITIONS`
 * + `SESSION_REASON_CODE_SLICE` + `SESSION_REASON_CODE_LABELS` so chip text
 * on `/session/start` and the explanation on this page can never drift.
 *
 * Cross-links to `concept-session-slices` for the deep dive into each
 * slice's philosophy and triggers. Entry point for every InfoTip on the
 * session-start route.
 */

import {
	APP_SURFACES,
	DOMAIN_LABELS,
	DOMAIN_VALUES,
	HELP_KINDS,
	MODE_WEIGHTS,
	ROUTES,
	SESSION_MODE_LABELS,
	SESSION_MODE_VALUES,
	SESSION_REASON_CODE_DEFINITIONS,
	SESSION_REASON_CODE_LABELS,
	SESSION_REASON_CODE_SLICE,
	SESSION_REASON_CODE_VALUES,
	SESSION_SLICE_LABELS,
	SESSION_SLICE_VALUES,
	type SessionMode,
	STUDY_PRIORITY_LABELS,
} from '@ab/constants';
import type { HelpPage } from '@ab/help';

/**
 * Build the reason-codes markdown table programmatically so adding a new
 * code in `@ab/constants` automatically extends the docs table without a
 * second author step. Sort by slice order then alphabetical label within
 * the slice so related codes cluster together.
 */
function buildReasonCodesTable(): string {
	const sliceOrder = SESSION_SLICE_VALUES;
	const rows = [...SESSION_REASON_CODE_VALUES].sort((a, b) => {
		const aSlice = sliceOrder.indexOf(SESSION_REASON_CODE_SLICE[a]);
		const bSlice = sliceOrder.indexOf(SESSION_REASON_CODE_SLICE[b]);
		if (aSlice !== bSlice) return aSlice - bSlice;
		return SESSION_REASON_CODE_LABELS[a].localeCompare(SESSION_REASON_CODE_LABELS[b]);
	});

	const header = '| Label | Slice | Why it fires |';
	const separator = '| ----- | ----- | ------------ |';
	const body = rows
		.map((code) => {
			const label = SESSION_REASON_CODE_LABELS[code];
			const slice = SESSION_SLICE_LABELS[SESSION_REASON_CODE_SLICE[code]];
			const definition = SESSION_REASON_CODE_DEFINITIONS[code];
			return `| ${label} | ${slice} | ${definition} |`;
		})
		.join('\n');
	return `${header}\n${separator}\n${body}`;
}

/**
 * Build the mode-weights table from `MODE_WEIGHTS`. Each row sums to 1.0
 * exactly; the engine applies largest-remainder rounding when multiplying
 * by session length.
 */
function buildModeWeightsTable(): string {
	const header = `| Mode | ${SESSION_SLICE_VALUES.map((s) => SESSION_SLICE_LABELS[s]).join(' | ')} |`;
	const separator = `| ---- | ${SESSION_SLICE_VALUES.map(() => '---').join(' | ')} |`;
	const rows = SESSION_MODE_VALUES.map((mode) => {
		const weights = MODE_WEIGHTS[mode as SessionMode];
		const cells = SESSION_SLICE_VALUES.map((slice) => weights[slice].toFixed(2));
		return `| ${SESSION_MODE_LABELS[mode as SessionMode]} | ${cells.join(' | ')} |`;
	});
	return [header, separator, ...rows].join('\n');
}

/**
 * Build the domains table. 14 domains currently shipped; always keep in
 * sync with `DOMAIN_LABELS`.
 */
function buildDomainsList(): string {
	return DOMAIN_VALUES.map((d) => `- **${DOMAIN_LABELS[d]}** (\`${d}\`)`).join('\n');
}

const reasonCodesTable = buildReasonCodesTable();
const modeWeightsTable = buildModeWeightsTable();
const domainsList = buildDomainsList();

export const sessionStart: HelpPage = {
	id: 'session-start',
	title: 'Your session preview',
	summary:
		'Decoder ring for /session/start: slices, kinds, reason codes, priorities, domains, and how mode weights shape the queue.',
	documents: ROUTES.SESSION_START,
	tags: {
		appSurface: [APP_SURFACES.SESSION],
		helpKind: HELP_KINDS.HOW_TO,
		keywords: [
			'session',
			'preview',
			'slice',
			'continue',
			'strengthen',
			'expand',
			'diversify',
			'reason-code',
			'priority',
			'domain',
			'mode',
			'weights',
		],
	},
	related: [
		'concept-session-slices',
		'concept-knowledge-graph',
		'concept-fsrs',
		'focus-domains',
		'memory-review',
		'reps-session',
		'getting-started',
	],
	reviewedAt: '2026-04-23',
	sections: [
		{
			id: 'what-you-see',
			title: 'What you see',
			body: `The session preview is a transparent window into what the engine thinks you should do next. Every item in the queue is tagged with a **slice**, a **kind**, and a **reason code** so you can tell at a glance *why* each item is there and decide whether to run the session as-is or shuffle.

:::tip
Hover any \`?\` icon on \`/session/start\` for a short definition. Click it to pin the popover, or press Enter while focused to open it from the keyboard. "Learn more" jumps you back to the relevant section of this page or the matching concept page.
:::

Nothing ends up in the queue by accident. If a row looks wrong, its reason code is the starting place for debugging. Every reason code is defined below along with the slice it belongs to and the condition that triggers it.`,
		},
		{
			id: 'slices',
			title: 'Slices',
			body: `Each session is built from four **slices**: Continue, Strengthen, Expand, and Diversify. Your current mode (Mixed, Continue, Strengthen, Expand, Diversify) assigns a weight to each slice and the engine fills slots in that ratio.

| Slice       | In one sentence                                                                                                     | When it fires                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Continue    | Pick up where you left off: cards due in a domain you just touched, or nodes you started but didn't finish.         | You studied recently and there's more to do in that same domain.                               |
| Strengthen  | Fix things the engine thinks are slipping: relearning cards, overdue cards, recently-missed reps, mastery dropouts. | FSRS flags a card, your rep accuracy in a domain drops, or a previously-mastered node regresses. |
| Expand      | Move the frontier forward: unstarted core nodes whose prerequisites are met, focus-domain matches.                  | You're ready for new material and have set cert goals or a focus domain.                       |
| Diversify   | Rotate into domains you've been ignoring so the queue doesn't collapse into a single topic.                         | You haven't touched a domain in several sessions, or a node applies knowledge cross-domain.    |

For the full rationale behind each slice and a deeper walkthrough of the triggers, read [[Session slices::concept-session-slices]].`,
		},
		{
			id: 'kinds',
			title: 'Kinds',
			body: `Every preview row is one of three **kinds**: Card, Rep, or Node. The kind determines both the experience and the ID link.

| Kind     | What it is                                                                                                             | Click the ID to...                                                             |
| -------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Card     | A flashcard scheduled by FSRS. You reveal the answer and rate Again/Hard/Good/Easy.                                    | Open the card detail page: front, back, state, recent reviews.                 |
| Rep      | A decision-rep scenario. You read the situation, pick an option, see the outcome and teaching point.                   | Open the scenario detail page: prompt, last-5 accuracy, start-attempt button.  |
| Node     | A [[knowledge-graph::concept-knowledge-graph]] node you haven't started yet. Launches the 7-phase guided learn flow.   | Open the knowledge-node detail page, with every phase readable.                |

Cards run through [[Memory review::memory-review]]; reps run through [[the rep session::reps-session]]; nodes run through guided learn.`,
		},
		{
			id: 'reason-codes',
			title: 'Reason codes',
			body: `Every queue row carries a **reason code** that names the specific signal the engine used to include it. 13 codes, split across the four slices:

${reasonCodesTable}

Reason codes are stable API: the set above is the full authoritative list. If you see one of these chips on a row, you can predict why the row is there without opening anything.`,
		},
		{
			id: 'priorities',
			title: 'Study priority',
			body: `Knowledge nodes are tagged with a **study priority** that says where to spend study time. Every node a learner sees is already on the ACS/PTS for their cert -- "must-know" is the regulatory default. Priority answers a different question: *if you only have 30 minutes today, what's the highest-leverage thing to drill?* Priorities flow through reason-code selection (e.g., \`expand_unstarted_priority\` surfaces \`critical\` first) and through tiebreakers when multiple slices compete for the same slot.

| Priority   | Meaning                                                                                                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| ${STUDY_PRIORITY_LABELS.critical} | Safety-of-flight or examiner-favorite. Surfaces in Expand even when you haven't set a focus.                                            |
| ${STUDY_PRIORITY_LABELS.standard} | Everything else on the ACS/PTS for the cert. Queued as capacity allows once critical topics are in flight.                              |
| ${STUDY_PRIORITY_LABELS.stretch}  | Useful adjacent knowledge below the floor or beyond strict ACS scope. Won't surface unless you explicitly focus on the domain.          |

A preview row labelled "Critical topic, unstarted" is a Priority: Critical node the engine wants you to begin on; the Expand slice is how it gets there.`,
		},
		{
			id: 'domains',
			title: 'Domains',
			body: `Every card, scenario, and knowledge node is tagged with exactly one **domain**. Domains are the unit of rotation for Diversify and the unit of focus for plan configuration.

${domainsList}

The "Unused domain" reason chip means you haven't touched the named domain in enough recent sessions that the Diversify slice wants to rotate it back in. The "Recent domain" reason means the opposite: you *did* touch it, and Continue is picking up where you left off.`,
		},
		{
			id: 'modes-and-weights',
			title: 'Modes and weights',
			body: `**Mode** is the top-level dial that shapes a session. Pick one from the dropdown above the preview. Each mode assigns a weight to every slice; the engine multiplies those weights by the session length and uses largest-remainder rounding to allocate slots.

${modeWeightsTable}

All rows sum to 1.00 exactly. "Mixed" is the default balanced mode; "Continue" is the best pick when you're returning mid-topic and want to build momentum; "Strengthen" is the pick after a rough stretch where accuracy is low. If a slice pool is under-supplied (e.g., no Expand candidates because every core node is already started), the engine redistributes those slots to adjacent slices rather than shipping short. The "Short: N items" banner tells you when redistribution couldn't make up the difference.`,
		},
	],
};
