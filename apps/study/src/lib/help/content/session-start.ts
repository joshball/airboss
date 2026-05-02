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

import { APP_SURFACES, HELP_KINDS } from '@ab/constants';
import type { HelpPageIndex } from '@ab/help';

export const sessionStartIndex: HelpPageIndex = {
	id: 'session-start',
	title: 'Your session preview',
	summary:
		'Decoder ring for /session/start: slices, kinds, reason codes, priorities, domains, and how mode weights shape the queue.',
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
	sections: [
		{ id: 'what-you-see', title: 'What you see' },
		{ id: 'slices', title: 'Slices' },
		{ id: 'kinds', title: 'Kinds' },
		{ id: 'reason-codes', title: 'Reason codes' },
		{ id: 'priorities', title: 'Study priority' },
		{ id: 'domains', title: 'Domains' },
		{ id: 'modes-and-weights', title: 'Modes and weights' },
	],
	searchHaystack:
		'decoder ring for /session/start: slices, kinds, reason codes, priorities, domains, and how mode weights shape the queue. the session preview is a transparent window into what the engine thinks you should do next. every item in the queue is tagged with a **slice**, a **kind**, and a **reason code** so you can tell at a glance *why* each item is there and decide whether to run the session as-is or shuffle.\n\n:::tip\nhover any `?` icon on `/session/start` for a short definition. click it to pin the popover, or press enter while focused to open it from the keyboard. "learn more" jumps you back to the relevant section of this page or the matching concept page.\n:::\n\nnothing ends up in the queue by accident. if a row looks wrong, its reason code is the starting place for debugging. every reason code is defined below along with the slice it belongs to and the condition that triggers it. each session is built from four **slices**: continue, strengthen, expand, and diversify. your current mode (mixed, continue, strengthen, expand, diversify) assigns a weight to each slice and the engine fills slots in that ratio.\n\n| slice       | in one sentence                                                                                                     | when it fires                                                                                  |\n| ----------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |\n| continue    | pick up where you left off: cards due in a domain you just touched, or nodes you started but didn\'t finish.         | you studied recently and there\'s more to do in that same domain.                               |\n| strengthen  | fix things the engine thinks are slipping: relearning cards, overdue cards, recently-missed reps, mastery dropouts. | fsrs flags a card, your rep accuracy in a domain drops, or a previously-mastered node regresses. |\n| expand      | move the frontier forward: unstarted core nodes whose prerequisites are met, focus-domain matches.                  | you\'re ready for new material and have set cert goals or a focus domain.                       |\n| diversify   | rotate into domains you\'ve been ignoring so the queue doesn\'t collapse into a single topic.                         | you haven\'t touched a domain in several sessions, or a node applies knowledge cross-domain.    |\n\nfor the full rationale behind each slice and a deeper walkthrough of the triggers, read session slices. every preview row is one of three **kinds**: card, rep, or node. the kind determines both the experience and the id link.\n\n| kind     | what it is                                                                                                             | click the id to...                                                             |\n| -------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |\n| card     | a flashcard scheduled by fsrs. you reveal the answer and rate again/hard/good/easy.                                    | open the card detail page: front, back, state, recent reviews.                 |\n| rep      | a decision-rep scenario. you read the situation, pick an option, see the outcome and teaching point.                   | open the scenario detail page: prompt, last-5 accuracy, start-attempt button.  |\n| node     | a knowledge-graph node you haven\'t started yet. launches the 7-phase guided learn flow.   | open the knowledge-node detail page, with every phase readable.                |\n\ncards run through memory review; reps run through the rep session; nodes run through guided learn. every queue row carries a **reason code** that names the specific signal the engine used to include it. 13 codes, split across the four slices:\n\n| label | slice | why it fires |\n| ----- | ----- | ------------ |\n| due in recent domain | continue where you left off | this card is coming due and happens to be in a domain you just touched. good overlap between the scheduler and your current focus. |\n| recent domain | continue where you left off | this item lives in a domain you studied in your last session or two. continuing there builds momentum in that topic. |\n| unfinished node | continue where you left off | you started learning this knowledge node recently but did not finish all seven phases. continuing closes the loop. |\n| low rep accuracy | strengthen | your accuracy on reps in this domain has dropped below the threshold. targeted practice here restores judgment before deeper work. |\n| mastery dropping | strengthen | this node crossed back from mastered to not-mastered because the dual-gate (card stability and rep accuracy) slipped. it needs reinforcement. |\n| overdue | strengthen | this card passed its fsrs due date more than the grace period ago. each day overdue erodes the stability estimate, so the sooner the better. |\n| rated again recently | strengthen | you rated this again within the last few sessions. surfacing it now catches the memory before it collapses further. |\n| recent sim weakness | strengthen | you have been grading low on a sim scenario that exercises this knowledge. surfacing the card now ties the study queue back to your recent flight evidence. |\n| recent sim weakness | strengthen | a sim scenario tied to this rep has been grading low recently. the rep is here so the judgment behind the maneuver gets practised before the next flight. |\n| relearning | strengthen | fsrs marked this card as relearning after a recent again rating. it needs a few short-interval reviews before it stabilises again. |\n| core topic, unstarted | expand | this is a core topic for your cert goals and you have not started it yet. core knowledge is non-negotiable; this makes the queue. |\n| matches focus | expand | this node matches the focus domain you set for this session. you asked for more of this; you are getting more of this. |\n| prerequisites met | expand | all the prerequisite knowledge nodes for this one are mastered. you are ready to learn it. |\n| cross-domain application | diversify | this node applies knowledge you already have from another domain. cross-domain connections are how real pilot judgment forms. |\n| unused domain | diversify | you have not touched this domain in several sessions. rotating through it prevents the schedule from collapsing into a single topic. |\n\nreason codes are stable api: the set above is the full authoritative list. if you see one of these chips on a row, you can predict why the row is there without opening anything. knowledge nodes are tagged with a **study priority** that says where to spend study time. every node a learner sees is already on the acs/pts for their cert -- "must-know" is the regulatory default. priority answers a different question: *if you only have 30 minutes today, what\'s the highest-leverage thing to drill?* priorities flow through reason-code selection (e.g., `expand_unstarted_priority` surfaces `critical` first) and through tiebreakers when multiple slices compete for the same slot.\n\n| priority   | meaning                                                                                                                                 |\n| ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |\n| critical | safety-of-flight or examiner-favorite. surfaces in expand even when you haven\'t set a focus.                                            |\n| standard | everything else on the acs/pts for the cert. queued as capacity allows once critical topics are in flight.                              |\n| stretch  | useful adjacent knowledge below the floor or beyond strict acs scope. won\'t surface unless you explicitly focus on the domain.          |\n\na preview row labelled "critical topic, unstarted" is a priority: critical node the engine wants you to begin on; the expand slice is how it gets there. every card, scenario, and knowledge node is tagged with exactly one **domain**. domains are the unit of rotation for diversify and the unit of focus for plan configuration.\n\n- **regulations** (`regulations`)\n- **weather** (`weather`)\n- **airspace** (`airspace`)\n- **glass cockpits** (`glass-cockpits`)\n- **ifr procedures** (`ifr-procedures`)\n- **vfr operations** (`vfr-operations`)\n- **aerodynamics** (`aerodynamics`)\n- **teaching methodology** (`teaching-methodology`)\n- **adm / human factors** (`adm-human-factors`)\n- **safety / accident analysis** (`safety-accident-analysis`)\n- **aircraft systems** (`aircraft-systems`)\n- **flight planning** (`flight-planning`)\n- **emergency procedures** (`emergency-procedures`)\n- **faa practical standards** (`faa-practical-standards`)\n\nthe "unused domain" reason chip means you haven\'t touched the named domain in enough recent sessions that the diversify slice wants to rotate it back in. the "recent domain" reason means the opposite: you *did* touch it, and continue is picking up where you left off. **mode** is the top-level dial that shapes a session. pick one from the dropdown above the preview. each mode assigns a weight to every slice; the engine multiplies those weights by the session length and uses largest-remainder rounding to allocate slots.\n\n| mode | continue where you left off | strengthen | expand | diversify |\n| ---- | --- | --- | --- | --- |\n| continue where i left off | 0.70 | 0.20 | 0.00 | 0.10 |\n| hit my weak spots | 0.10 | 0.70 | 0.00 | 0.20 |\n| mixed (default) | 0.30 | 0.30 | 0.20 | 0.20 |\n| try something new | 0.10 | 0.10 | 0.70 | 0.10 |\n\nall rows sum to 1.00 exactly. "mixed" is the default balanced mode; "continue" is the best pick when you\'re returning mid-topic and want to build momentum; "strengthen" is the pick after a rough stretch where accuracy is low. if a slice pool is under-supplied (e.g., no expand candidates because every core node is already started), the engine redistributes those slots to adjacent slices rather than shipping short. the "short: n items" banner tells you when redistribution couldn\'t make up the difference. session preview slice continue strengthen expand diversify reason-code priority domain mode weights',
	documents: '/session/start',
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
};
