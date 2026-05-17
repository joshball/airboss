# Test Plan: Hangar Audit Explorer

Manual walkthrough -- the user runs every step before flipping `status: done`. Per CLAUDE.md "nothing merges without a manual test plan."

## Setup

| Step | Action                                                                                                                                         | Pass criteria                              |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| 0.1  | Sign in as Abby (`abby@airboss.test`); confirm Abby has the ADMIN role.                                                                        | Hangar app loads; `/users` is reachable    |
| 0.2  | Confirm `bun run db:seed` has run; the dev DB has `audit.audit_log` rows (at minimum the seeded ping rows + any rows authored during seeding). | `select count(*) from audit.audit_log` > 0 |
| 0.3  | Generate a fresh ping at `/admin/audit-ping` once before testing to ensure at least one recent `hangar.ping` row exists in the last 24h.       | Banner: "Ping recorded"                    |

## List page (`/admin/audit`)

| Step | Action                                                                                              | Pass criteria                                                               |
| ---- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1.1  | Navigate to `/admin/audit`.                                                                         | Page loads; default window = last 24h; rows render newest-first             |
| 1.2  | Filter summary in the header reads "N events -- last 24h" with the count matching the table length. | Subtitle accurate                                                           |
| 1.3  | Each row shows timestamp, actor name + email (or "system" when null), op, target type, target id.   | All five columns populated; system rows show "system" not the empty string  |
| 1.4  | Click a row.                                                                                        | Lands on `/admin/audit/[id]`; back button returns to the same filtered list |
| 1.5  | Empty state: set `?window=1h` and confirm zero ping rows in the last hour.                          | `<EmptyState>` renders explicit "no events" copy; filter bar still visible  |
| 1.6  | Pagination: with `?window=all` and >50 rows in the DB, click "Show more".                           | More rows append; URL gains a `cursor=` param; second click appends again   |
| 1.7  | Reload after "Show more" was clicked.                                                               | Restored cursor pagination renders the same rows                            |
| 1.8  | "Showing first N" hint appears once the per-page hard cap is hit.                                   | Hint text matches `/users`-style cap-banner                                 |

## Filters

| Step | Action                                                                                  | Pass criteria                                                    |
| ---- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 2.1  | Type "abby" in the actor search.                                                        | Debounced; URL gains `?actor=...`; rows narrow to Abby's actions |
| 2.2  | Pick `hangar.ping` from the target-type select.                                         | URL gains `?targetType=hangar.ping`; only ping rows visible      |
| 2.3  | Enter a known target id from a non-ping row.                                            | URL gains `?targetId=...`; only that row's history visible       |
| 2.4  | Pick `update` from the op select.                                                       | URL gains `?op=update`; rows narrow                              |
| 2.5  | Cycle window presets: 1h, 24h, 7d, 30d, all. Confirm each updates URL and result count. | Each preset is the active chip; URL reflects `window=<preset>`   |
| 2.6  | Switch to "custom" and pick a from/to range.                                            | URL gains `from=...&to=...`; window chip cleared                 |
| 2.7  | Click "Clear filters".                                                                  | All filter params removed; window resets to default 24h          |
| 2.8  | Copy the URL with several filters set; paste in a new tab.                              | Same view renders without manual re-entry                        |
| 2.9  | Use browser back / forward across filter changes.                                       | Filter state restores correctly                                  |

## Detail page (`/admin/audit/[id]`)

| Step | Action                                                                              | Pass criteria                                                        |
| ---- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 3.1  | From the list, click an `update` row (any BC that emits update audits).             | Detail page loads; before, after, metadata panes render side-by-side |
| 3.2  | Each jsonb pane is pretty-printed; copy-to-clipboard button works.                  | Clipboard contains the canonical jsonb                               |
| 3.3  | Actor card shows id, name, email, role, link to `/users/[id]`.                      | Link routes to user detail                                           |
| 3.4  | "View all from this actor" link.                                                    | Routes to `/admin/audit?actor=<id>&window=all`                       |
| 3.5  | "View all on this target" link.                                                     | Routes to `/admin/audit?targetType=<t>&targetId=<id>&window=all`     |
| 3.6  | Open a `create` row.                                                                | Before pane shows empty state; after + metadata populated            |
| 3.7  | Open a `delete` row.                                                                | After pane shows empty state; before + metadata populated            |
| 3.8  | Open an `action` row (e.g. `hangar.ping`).                                          | Before + after both empty; metadata populated                        |
| 3.9  | Visit `/admin/audit/no-such-id`.                                                    | 404 page                                                             |
| 3.10 | Breadcrumbs render: `Admin -> Audit -> <id>`; each crumb except the last is a link. | Crumbs work                                                          |

## Auth gate

| Step | Action                                                                           | Pass criteria                       |
| ---- | -------------------------------------------------------------------------------- | ----------------------------------- |
| 4.1  | Sign out; sign in as a learner-role test user; navigate to `/admin/audit`.       | Redirect to login or `/`; not a 200 |
| 4.2  | Sign in as an AUTHOR-role test user; navigate to `/admin/audit`.                 | Redirect / 403; surface not visible |
| 4.3  | Sign in as an OPERATOR-role test user; navigate to `/admin/audit/[id]` directly. | Redirect / 403                      |
| 4.4  | Sign back in as Abby (ADMIN); confirm both routes load.                          | Both 200                            |

## Help page

| Step | Action                                       | Pass criteria                         |
| ---- | -------------------------------------------- | ------------------------------------- |
| 5.1  | Open the help drawer on `/admin/audit`.      | "Audit" help page loads with sections |
| 5.2  | Same on the detail page.                     | Same help page; section links resolve |
| 5.3  | `bun run check` -- help-id validator passes. | "help-id validator: OK"               |

## Regressions

| Step | Action                                                                        | Pass criteria                        |
| ---- | ----------------------------------------------------------------------------- | ------------------------------------ |
| 6.1  | Walk hangar `/`, `/sources`, `/users`, `/jobs`, `/admin/audit-ping`.          | No regressions; styles intact        |
| 6.2  | `/admin/audit-ping` still records and displays a ping (unchanged in this WP). | Banner: "Ping recorded"; row appears |
| 6.3  | Run `bun run check`.                                                          | 0 errors, 0 warnings                 |
| 6.4  | Run Playwright e2e: `bunx playwright test hangar-audit`.                      | All audit-explorer tests pass        |
| 6.5  | Run Vitest: `bunx vitest run libs/bc/hangar/src/audit-queries.test.ts`.       | All BC unit tests pass               |

## Automated coverage

| Layer       | Tool       | What it asserts                                                                                                                                                                                                                     |
| ----------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BC unit     | Vitest     | `listAuditEntries`: filter composition (each filter produces the right WHERE fragment), cursor encode / decode, default limit, hard cap. `getAuditEntry`: 404 path, actor join shape. `searchActorIds`: ilike pattern, cap, escape. |
| Page server | Vitest     | Loader applies default 24h window when query is empty; honours custom from/to; ADMIN-only smoke.                                                                                                                                    |
| Route e2e   | Playwright | List smoke + filter round-trip + detail render + back/forward restore + ADMIN-only redirect for non-admin roles.                                                                                                                    |

## Sign-off

User sign-off date: ____________
