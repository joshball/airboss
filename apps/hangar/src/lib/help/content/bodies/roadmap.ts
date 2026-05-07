/**
 * Body markdown for help page `roadmap`.
 *
 * Hand-edit this file -- the body is the source of truth. Run
 * `bun scripts/help/split-content.ts` to re-sync the matching index
 * file (precomputed search haystack) after editing a body.
 */

import type { HelpPageBody } from '@ab/help';

export const roadmapBody: HelpPageBody = {
	id: 'roadmap',
	sections: [
		{
			id: 'what-it-shows',
			title: 'What this surface shows',
			body: `\`/roadmap\` is a read-only browser of every \`docs/work-packages/<slug>/spec.md\` frontmatter. Each row is one work package; click a row to land on \`/roadmap/[wp_id]\` for the full spec / tasks / test-plan / design / user-stories tabs plus the dependency graph and shipped-PR links.

Frontmatter is the source of truth (per [ADR 025](/docs/docs/decisions/025-wp-frontmatter-contract/decision.md)). The \`bun run wp\` CLI and this surface read the same loader; what you see here is exactly what the lint validates.`,
		},
		{
			id: 'filters',
			title: 'Filters live in the URL',
			body: `Every chip click updates the URL search params. Copy a URL with filters applied, paste it in another tab, and the same view loads. The filterable facets are:

- **Product** -- \`study\` / \`hangar\` / \`sim\` / \`flightbag\` / \`avionics\` / \`platform\` / \`course\` / \`none\`.
- **Category** -- the closed five-value vocab (\`product\` / \`feature\` / \`content\` / \`docs\` / \`platform\`).
- **Status** -- lifecycle (\`draft\` / \`signed-off\` / \`in-flight\` / \`shipped\` / \`abandoned\` / \`superseded\`).
- **Human review** -- \`pending\` / \`walked\` / \`signed-off\`.
- **Tag** -- free-form authored tags (cross-cutting slices like \`references\` or \`audit\`).

The search box narrows the visible rows by id + title substring. Search is client-side; the loader returns the full filtered set on each navigation.`,
		},
		{
			id: 'why-read-only',
			title: 'Read-only by design',
			body: `Phase 8 of the [tracking-system-overhaul WP](/docs/docs/work-packages/tracking-system-overhaul/spec.md) ships the read view only. UI writebacks (status flips, review-status flips) are explicitly out of scope.

To mutate frontmatter, run \`bun run wp set\` from a terminal:

\`\`\`bash
bun run wp set <wp-id> status in-flight
bun run wp set <wp-id> agent_review_status done
bun run wp set <wp-id> shipped_prs '[617, 622]'
\`\`\`

The CLI lints every write against the schema, so a broken frontmatter never lands. \`human_review_status\` is user-only -- the lint rejects any agent commit that changes that field. See [ADR 025](/docs/docs/decisions/025-wp-frontmatter-contract/decision.md) for the contract.`,
		},
		{
			id: 'unparseable',
			title: 'Unparseable WPs',
			body: `A WP whose \`spec.md\` is missing a frontmatter fence, has an unparseable YAML block, or fails schema validation surfaces in a synthetic **Unparseable** group at the top of the list. The detail page renders any sub-doc bodies that exist plus a per-field validation-error list so the breakage is fixable in one pass.

The \`bun run check\` lint catches the same class of breakage at commit time; this view is the click-through path when you need to investigate one in detail.`,
		},
	],
};
