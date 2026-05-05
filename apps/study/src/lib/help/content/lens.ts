/**
 * Lens UI help page.
 *
 * Covers `/lens/...` (ADR 016 phase 8): the handbook lens (per-handbook
 * view of citing knowledge nodes) and the weakness lens (severity-bucketed
 * domain ranking).
 */

import { APP_SURFACES, HELP_KINDS } from '@ab/constants';
import type { HelpPageIndex } from '@ab/help';

export const lensIndex: HelpPageIndex = {
	id: 'lens',
	title: 'Study by',
	summary:
		'Two read-only views designed to answer specific study questions: "what to study from each handbook" (graph nodes that cite each FAA section) and "what to study next" (severity-bucketed domain ranking).',
	tags: {
		appSurface: [APP_SURFACES.LENS],
		helpKind: HELP_KINDS.REFERENCE,
		keywords: [
			'study by',
			'study by handbook',
			'what to study next',
			'lens',
			'handbook',
			'weakness',
			'severity',
			'phak',
			'afh',
			'avwx',
			'citing',
			'nodes',
		],
	},
	sections: [
		{ id: 'overview', title: 'Overview' },
		{ id: 'handbook-lens', title: 'Study by handbook' },
		{ id: 'weakness-lens', title: 'What to study next' },
		{ id: 'severity-thresholds', title: 'Severity thresholds' },
	],
	searchHaystack:
		'two read-only views designed to answer specific study questions: "what to study from each handbook" (graph nodes that cite each faa section) and "what to study next" (severity-bucketed domain ranking). a "study by" surface is a read-only projection of your data, designed to answer a specific question. the quals dashboard (`/credentials`) answers "where do i stand on this cert?". this menu ships two more:\n\n- **study by handbook** -- pick a handbook (phak, afh, avwx, ...), drill into a chapter, see which knowledge nodes cite each section. to just *read* a handbook end-to-end, use flightbag instead.\n- **what to study next** -- domains bucketed by severity (severe / moderate / mild) using the existing dashboard weakness signal (card accuracy + rep accuracy + overdue load). lands at `/lens/handbook`. the index lists every active handbook reference plus your read progress. each card opens to the doc view, then chapter view.\n\nthe chapter view is the payoff: each section header has a "x citing nodes" count, with the actual graph nodes listed inline. click a node to jump to its detail page; click the section title to read it in the handbook reader.\n\nthis surface is for *learning through* a handbook (filtered by your goals + mastery). for straight reading or citation-anchored deep links, use flightbag. lands at `/lens/weakness`. three severity buckets (severe / moderate / mild) computed from the existing `getweakareas` bc, mapped to severity by score:\n\n- **severe** = score normalised >= 0.70.\n- **moderate** = >= 0.40.\n- **mild** = >= 0.15.\n\nbelow 0.15 is not surfaced. click a domain\'s "drill" link to land in the right browse view (cards or reps) filtered to that domain.\n\nthe v1 weakness lens ranks at the **domain** level, matching the dashboard\'s existing signal. per-node ranking with reasons like miscalibration / overdue / low_accuracy / never_attempted is a follow-on (see lens-ui spec). thresholds live in `weakness_severity_thresholds` in `libs/constants/src/credentials.ts`:\n\n- severe >= 0.70\n- moderate >= 0.40\n- mild >= 0.15\n\nthe score is normalised by dividing the raw `weakarea.score` by 3 and clamping to [0, 1]. adjust thresholds in the constants file if the buckets feel mis-tuned. study by study by handbook what to study next lens handbook weakness severity phak afh avwx citing nodes',
	documents: '/insights/lens/handbook',
	related: ['knowledge-graph', 'calibration', 'getting-started'],
	reviewedAt: '2026-04-28',
};
