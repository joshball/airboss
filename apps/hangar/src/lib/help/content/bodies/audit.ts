/**
 * Body markdown for help page `audit`.
 *
 * Hand-edit this file -- the body is the source of truth. Run
 * `bun scripts/help/split-content.ts` to re-sync the matching index
 * file (precomputed search haystack) after editing a body.
 */

import type { HelpPageBody } from '@ab/help';

export const auditBody: HelpPageBody = {
	id: 'audit',
	sections: [
		{
			id: 'what-it-shows',
			title: 'What this surface shows',
			body: `The audit log captures one row per mutation across every BC. Every \`auditWrite\` call lands here: card edits, source ingests, job lifecycle events, sync flips, role changes -- everything. The explorer is the read surface for that log: search by who, by what, by when, and drill into the full before / after / metadata payload of any single row.

ADMIN-only -- audit data carries enough context (request bodies, raw user input, system identifiers) that it sits above the AUTHOR / OPERATOR floor that the rest of hangar uses.`,
		},
		{
			id: 'filters',
			title: 'Filtering',
			body: `Every filter lives in the URL. Copy a URL with filters applied, paste it in another tab, and the same view loads -- no manual re-entry. Browser back / forward steps through filter changes the same way.

- **Actor** -- type a name or email; the typeahead resolves to a user id. The "system writes only" link narrows to rows authored by background processes (no logged-in user). Clear the actor pill to drop the filter.
- **Target type** -- exact match against the BC tag string (\`hangar.source\`, \`hangar.ping\`, \`study.card\`, ...). Pick from the select; the values come from the live \`AUDIT_TARGET_VALUES\` allow-list.
- **Target id** -- exact match on the row id. Use the cross-link from the detail page rather than typing this by hand.
- **Op** -- one of \`create\` / \`update\` / \`delete\` / \`action\`. See [op meanings](#op-meanings) below.
- **Window** -- preset chips (1h / 24h / 7d / 30d / all) or a custom \`from\` / \`to\` range. Default is the last 24 hours, which is the right starting point for "what happened recently?" Switching to \`custom\` reveals two datetime pickers; either bound is optional.
- **Clear filters** -- removes everything, returning to the default 24h window.

The filter summary in the page header always tells you the active set at a glance: "17 events -- last 24h, actor Abby, hangar.ping".`,
		},
		{
			id: 'op-meanings',
			title: 'What each op means',
			body: `- **create** -- a new row landed. The \`after\` pane has the inserted snapshot; \`before\` is empty.
- **update** -- a row changed. Both \`before\` and \`after\` are populated; compare the two side-by-side. (No diff renderer in v1 -- a real visual diff lands later if the side-by-side view is too noisy on real updates.)
- **delete** -- a row was removed. \`before\` shows the final state; \`after\` is empty.
- **action** -- a non-mutating event worth recording (login, export, ping, scheduled-job tick). \`before\` and \`after\` are both empty; the meaningful payload is in \`metadata\`.

The op set is intentionally tight. Finer buckets ("merge", "soft-delete", "rebuild") live in \`metadata.subKind\` so aggregate reads stay cheap.`,
		},
		{
			id: 'detail-page',
			title: 'Detail page',
			body: `Click any list row to open the detail surface. Three jsonb panes:

- **Before** + **After** render side-by-side, pretty-printed. The "Copy" button on each pane copies the canonical JSON so you can paste it into a diff tool when side-by-side reading isn't enough.
- **Metadata** is the out-of-band context: \`requestId\` (correlate with logs), \`reason\` (when the BC supplied one), \`userAgent\`, etc. Each BC chooses what to put here.

The actor card shows the authoring user's name, email, role, and id, with a "View user" link to \`/users/[id]\`. Two cross-link affordances at the bottom of the page:

- **View all from this actor** -- \`?actor=<id>&window=all\`.
- **View all on this target** -- \`?targetType=<t>&targetId=<id>&window=all\`.

Both round-trip through the URL filter set, so you can keep refining from the result list.`,
		},
		{
			id: 'pagination',
			title: 'Pagination',
			body: `Cursor-based, 50 rows per page (hard cap 200). The "Show more" button at the bottom of the table appends the next page; the cursor lives in the URL so refreshing keeps your position.

Numbered pages would need a \`count(*)\` query per page change, which gets expensive on a growing append-only table. The cursor approach keeps every page query at the same cost.

When the per-page limit is hit you see a "Showing first N events" banner -- refine the filters (especially the time window) to narrow the set rather than trying to scroll past the cap.`,
		},
		{
			id: 'append-only',
			title: 'Append-only by design',
			body: `Audit rows are never edited or deleted. The trail is the proof; mutating it would defeat the surface.

If a referenced user is deleted (rare; better-auth keeps soft-delete patterns), the actor id and email still appear on rows the user authored, but the joined name will be empty. The audit row itself remains. Same applies to deleted target rows -- the audit \`before\` snapshot survives even after the live row is gone.`,
		},
	],
};
