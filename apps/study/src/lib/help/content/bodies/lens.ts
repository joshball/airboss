/**
 * Body markdown for help page `lens`.
 *
 * Hand-edit this file -- the body is the source of truth. Run
 * `bun scripts/help/split-content.ts` to re-sync the matching index
 * file (precomputed search haystack) after editing a body.
 */

import type { HelpPageBody } from '@ab/help';

export const lensBody: HelpPageBody = {
	id: 'lens',
	sections: [
		{
			id: 'overview',
			title: 'Overview',
			body: `A lens is a read-only projection of your data. The cert dashboard (\`/credentials\`) is the ACS lens for one credential. This surface ships two more:

- **Handbook lens** -- pick a handbook (PHAK, AFH, AvWX, ...), drill into a chapter, see which knowledge nodes cite each section.
- **Weakness lens** -- domains bucketed by severity (severe / moderate / mild) using the existing dashboard weakness signal (card accuracy + rep accuracy + overdue load).`,
		},
		{
			id: 'handbook-lens',
			title: 'Handbook lens',
			body: `Lands at \`/lens/handbook\`. The index lists every active handbook reference plus your read progress. Each card opens to the doc view, then chapter view.

The chapter view is the payoff: each section header has a "X citing nodes" count, with the actual graph nodes listed inline. Click a node to jump to its detail page; click the section title to read it in the handbook reader.`,
		},
		{
			id: 'weakness-lens',
			title: 'Weakness lens',
			body: `Lands at \`/lens/weakness\`. Three severity buckets (severe / moderate / mild) computed from the existing \`getWeakAreas\` BC, mapped to severity by score:

- **Severe** = score normalised >= 0.70.
- **Moderate** = >= 0.40.
- **Mild** = >= 0.15.

Below 0.15 is not surfaced. Click a domain's "Drill" link to land in the right browse view (cards or reps) filtered to that domain.

The v1 weakness lens ranks at the **domain** level, matching the dashboard's existing signal. Per-node ranking with reasons like miscalibration / overdue / low_accuracy / never_attempted is a follow-on (see lens-ui spec).`,
		},
		{
			id: 'severity-thresholds',
			title: 'Severity thresholds',
			body: `Thresholds live in \`WEAKNESS_SEVERITY_THRESHOLDS\` in \`libs/constants/src/credentials.ts\`:

- severe >= 0.70
- moderate >= 0.40
- mild >= 0.15

The score is normalised by dividing the raw \`WeakArea.score\` by 3 and clamping to [0, 1]. Adjust thresholds in the constants file if the buckets feel mis-tuned.`,
		},
	],
};
