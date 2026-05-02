/**
 * Audit explorer help page.
 *
 * Lands as part of `docs/work-packages/hangar-audit-explorer/spec.md`
 * Phase 5 -- the page covers the filter bar, the time-window semantics,
 * what each op means, the before/after/metadata jsonb panes, and the
 * cross-link affordances on the detail page.
 */

import { APP_SURFACES, HELP_KINDS } from '@ab/constants';
import type { HelpPageIndex } from '@ab/help';

export const auditIndex: HelpPageIndex = {
	id: 'audit',
	title: 'Audit explorer',
	summary: 'Filter, paginate, and inspect every row in the cross-cutting audit log.',
	tags: {
		appSurface: [APP_SURFACES.HANGAR],
		helpKind: HELP_KINDS.REFERENCE,
		keywords: ['audit', 'log', 'admin', 'investigation', 'before', 'after', 'metadata', 'actor'],
	},
	sections: [
		{ id: 'what-it-shows', title: 'What this surface shows' },
		{ id: 'filters', title: 'Filtering' },
		{ id: 'op-meanings', title: 'What each op means' },
		{ id: 'detail-page', title: 'Detail page' },
		{ id: 'pagination', title: 'Pagination' },
		{ id: 'append-only', title: 'Append-only by design' },
	],
	searchHaystack:
		'filter, paginate, and inspect every row in the cross-cutting audit log. the audit log captures one row per mutation across every bc. every `auditwrite` call lands here: card edits, source ingests, job lifecycle events, sync flips, role changes -- everything. the explorer is the read surface for that log: search by who, by what, by when, and drill into the full before / after / metadata payload of any single row.\n\nadmin-only -- audit data carries enough context (request bodies, raw user input, system identifiers) that it sits above the author / operator floor that the rest of hangar uses. every filter lives in the url. copy a url with filters applied, paste it in another tab, and the same view loads -- no manual re-entry. browser back / forward steps through filter changes the same way.\n\n- **actor** -- type a name or email; the typeahead resolves to a user id. the "system writes only" link narrows to rows authored by background processes (no logged-in user). clear the actor pill to drop the filter.\n- **target type** -- exact match against the bc tag string (`hangar.source`, `hangar.ping`, `study.card`, ...). pick from the select; the values come from the live `audit_target_values` allow-list.\n- **target id** -- exact match on the row id. use the cross-link from the detail page rather than typing this by hand.\n- **op** -- one of `create` / `update` / `delete` / `action`. see [op meanings](#op-meanings) below.\n- **window** -- preset chips (1h / 24h / 7d / 30d / all) or a custom `from` / `to` range. default is the last 24 hours, which is the right starting point for "what happened recently?" switching to `custom` reveals two datetime pickers; either bound is optional.\n- **clear filters** -- removes everything, returning to the default 24h window.\n\nthe filter summary in the page header always tells you the active set at a glance: "17 events -- last 24h, actor abby, hangar.ping". - **create** -- a new row landed. the `after` pane has the inserted snapshot; `before` is empty.\n- **update** -- a row changed. both `before` and `after` are populated; compare the two side-by-side. (no diff renderer in v1 -- a real visual diff lands later if the side-by-side view is too noisy on real updates.)\n- **delete** -- a row was removed. `before` shows the final state; `after` is empty.\n- **action** -- a non-mutating event worth recording (login, export, ping, scheduled-job tick). `before` and `after` are both empty; the meaningful payload is in `metadata`.\n\nthe op set is intentionally tight. finer buckets ("merge", "soft-delete", "rebuild") live in `metadata.subkind` so aggregate reads stay cheap. click any list row to open the detail surface. three jsonb panes:\n\n- **before** + **after** render side-by-side, pretty-printed. the "copy" button on each pane copies the canonical json so you can paste it into a diff tool when side-by-side reading isn\'t enough.\n- **metadata** is the out-of-band context: `requestid` (correlate with logs), `reason` (when the bc supplied one), `useragent`, etc. each bc chooses what to put here.\n\nthe actor card shows the authoring user\'s name, email, role, and id, with a "view user" link to `/users/[id]`. two cross-link affordances at the bottom of the page:\n\n- **view all from this actor** -- `?actor=<id>&window=all`.\n- **view all on this target** -- `?targettype=<t>&targetid=<id>&window=all`.\n\nboth round-trip through the url filter set, so you can keep refining from the result list. cursor-based, 50 rows per page (hard cap 200). the "show more" button at the bottom of the table appends the next page; the cursor lives in the url so refreshing keeps your position.\n\nnumbered pages would need a `count(*)` query per page change, which gets expensive on a growing append-only table. the cursor approach keeps every page query at the same cost.\n\nwhen the per-page limit is hit you see a "showing first n events" banner -- refine the filters (especially the time window) to narrow the set rather than trying to scroll past the cap. audit rows are never edited or deleted. the trail is the proof; mutating it would defeat the surface.\n\nif a referenced user is deleted (rare; better-auth keeps soft-delete patterns), the actor id and email still appear on rows the user authored, but the joined name will be empty. the audit row itself remains. same applies to deleted target rows -- the audit `before` snapshot survives even after the live row is gone. audit log admin investigation before after metadata actor',
	documents: '/admin/audit',
	reviewedAt: '2026-04-30',
};
