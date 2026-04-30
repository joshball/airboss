# Tasks: Hangar Audit Explorer

Status: shipped 2026-04-30. Phased build executed via `/ball-wp-build`. Manual test plan + `/ball-review-full` are the remaining gates before `review_status: done`.

Status legend: `[x]` done, `[ ]` pending. Each unchecked box is small enough to ship as one commit.

## Phase 1 -- BC reads + constants

- [x] `libs/constants/src/routes.ts` -- add `ROUTES.HANGAR_ADMIN_AUDIT` and `ROUTES.HANGAR_ADMIN_AUDIT_DETAIL(id)`
- [x] `libs/constants/src/routes.ts` -- add `QUERY_PARAMS.AUDIT_ACTOR`, `AUDIT_TARGET_TYPE`, `AUDIT_TARGET_ID`, `AUDIT_OP`, `AUDIT_FROM`, `AUDIT_TO`, `AUDIT_WINDOW`, `AUDIT_CURSOR`
- [x] `libs/constants/src/audit.ts` -- add `AUDIT_WINDOW_PRESETS = { '1h', '24h', '7d', '30d', 'all', 'custom' }` + `AUDIT_WINDOW_DEFAULT = '24h'`
- [x] `libs/bc/hangar/src/audit-queries.ts` (new) -- `listAuditEntries(filters, db)` with cursor-based pagination on `(timestamp desc, id desc)`
- [x] `libs/bc/hangar/src/audit-queries.ts` -- `getAuditEntry(id, db)` joining the actor's `bauth_user.name` + `email`
- [x] `libs/bc/hangar/src/audit-queries.ts` -- `searchActorIds(searchTerm, limit, db)` for the actor filter typeahead (ilike on `name` or `email`, capped at 20 results)
- [x] `libs/bc/hangar/src/index.ts` -- export the three new functions + their types
- [x] `libs/bc/hangar/src/audit-queries.test.ts` (Vitest) -- shape tests for filter composition, cursor encoding, actor search

## Phase 2 -- List route (`/admin/audit`)

- [x] `apps/hangar/src/routes/(app)/admin/audit/+page.server.ts` -- `requireRole(ROLES.ADMIN)`, parse search params, call `listAuditEntries`, return `{ rows, nextCursor, filters, actorOptions }`
- [x] Default time window resolution: if no `window` param and no `from`/`to`, apply `AUDIT_WINDOW_DEFAULT` (24h)
- [x] `apps/hangar/src/routes/(app)/admin/audit/+page.svelte` -- table of rows (timestamp, actor, op, target, target id), "Show more" button, empty state via `<EmptyState>`
- [x] Row click navigates to `ROUTES.HANGAR_ADMIN_AUDIT_DETAIL(row.id)`
- [x] `<PageHeader>` with the active filter summary as subtitle ("17 events -- last 24h, actor Abby")
- [x] Loader unit test (Vitest): default window applied when query is empty; custom window honoured

## Phase 3 -- Filter UI

- [x] Filter bar component scoped to the route (`+page.svelte`): actor search (debounced 150ms, mirroring `/users`), target-type select bound to `AUDIT_TARGET_VALUES`, target-id text, op select bound to `AUDIT_OP_VALUES`, window preset chips + custom from/to date pickers
- [x] Filter changes update URL via `replaceState` (debounced for text inputs, immediate for selects/chips)
- [x] "Clear filters" button resets to default window only
- [x] Actor search hits a small JSON endpoint or reuses the `actorOptions` snapshot in load data; pick the JSON endpoint if the result list grows
- [ ] e2e (Playwright): set each filter, confirm round-trip; clear filters; back/forward restores

## Phase 4 -- Detail route (`/admin/audit/[id]`)

- [x] `apps/hangar/src/routes/(app)/admin/audit/[id]/+page.server.ts` -- `requireRole(ROLES.ADMIN)`, `getAuditEntry(id)`, 404 when missing
- [x] `apps/hangar/src/routes/(app)/admin/audit/[id]/+page.svelte` -- header (id, timestamp, op, target), actor card (id + name + email + link to `/users/[id]`), before / after / metadata jsonb panes (pretty-printed with copy buttons)
- [x] "View all from this actor" link -> `/admin/audit?actor=<id>&window=all`
- [x] "View all on this target" link -> `/admin/audit?targetType=<t>&targetId=<id>&window=all`
- [x] Empty before / empty after handled (creates have no before, deletes have no after, actions have neither)
- [x] Breadcrumbs: `Admin -> Audit -> <id>`

## Phase 5 -- Help, polish, e2e

- [x] `apps/hangar/src/lib/help/content/audit.ts` -- HelpPage covering: what audit-log is, how to filter, time-window semantics, op meanings, before/after semantics, the cross-link affordances
- [x] PageHelp drawer mounted on both routes
- [x] Theme tokens only -- no hex; pass `bun run lint:theme`
- [x] Banner / hint when result set hits the per-page cap, mirroring `/users`'s "showing first N" treatment
- [ ] ADMIN-only Playwright assertion: AUTHOR + OPERATOR + learner roles redirect / 403 on both routes
- [x] `bun run check` clean, 0 errors, 0 warnings

## Phase 6 -- Hand-off updates

- [x] `docs/products/hangar/PRD.md` -- move "Real audit explorer" from "In flight or imminent" to "Shipped"; reference this WP
- [x] `docs/work/NOW.md` -- mark in-flight; remove on ship
- [x] Open follow-up WP: "retire-audit-ping" -- routes the dashboard's System -> Audit tile to `/admin/audit`, deletes `/admin/audit-ping`, decides on `AUDIT_TARGETS.HANGAR_PING` retention vs removal

## Phase 7 -- Verification

- [ ] User walks the test plan; flips `status: done` in spec / tasks / test-plan / design
- [ ] Agent runs `/ball-review-full`; flips `review_status: done` after fixer closes findings
- [ ] Manual test plan signed off in test-plan.md
