---
title: Hangar Review Queue -- Test Plan
product: hangar
feature: hangar-review-queue
type: test-plan
status: draft
review_status: pending
---

# Hangar Review Queue -- Test Plan

Manual test plan. Run with hangar dev server (`bun run dev` in `apps/hangar`). Database can have existing data; the loader is idempotent.

## Prerequisites

- PostgreSQL running (OrbStack, port 5435)
- Hangar app running locally
- Auth: signed in as a user with author/admin role
- At least 5 existing work packages in `docs/work-packages/` (the repo already has 89)

## 1. Docs browser -- baseline rendering

| Step | Action                                                              | Expected                                                                          |
| ---- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1.1  | Navigate to `/docs`                                                 | Two-pane layout: tree on left, content on right; default doc renders (e.g. NOW.md) |
| 1.2  | Click `docs/decisions/011-knowledge-graph-learning-system/decision.md` | File renders with tables aligned, code blocks highlighted                         |
| 1.3  | Verify breadcrumb                                                   | Shows `Docs / decisions / 011-... / decision.md` and links resolve                 |
| 1.4  | Verify frontmatter rail                                             | Status, type, etc. surfaced on right                                               |
| 1.5  | Click an internal link (e.g., `[ADR 014](../014-...)`)              | Navigates within the docs browser, not to a 404                                    |
| 1.6  | Collapse a tree directory and reload the page                       | Open/closed state persists (localStorage)                                          |

## 2. Docs browser -- full-text search

| Step | Action                                                                  | Expected                                                                                  |
| ---- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 2.1  | Type "discovery-first pedagogy" in search                               | Results include ADR 011 and CLAUDE.md, ranked by relevance, with highlighted snippets     |
| 2.2  | Click a result                                                          | Navigates to the matching doc, search box clears                                          |
| 2.3  | Type a string with no matches ("fjxqz")                                 | Empty state: "No matches"                                                                 |
| 2.4  | Type a partial word ("disco")                                           | Postgres FTS stems and matches "discovery"; results return                                |
| 2.5  | Verify title weight: search for a phrase that's both a title and body   | Title-match doc ranks above body-only matches                                              |
| 2.6  | Empty `docs_search_index`, navigate to `/docs`, type a query            | Empty state: "Index not built -- run loader" with a button                                |
| 2.7  | Click the "Run loader" button                                           | Loader runs; index populates; subsequent searches return results                          |

## 3. Loader -- discovery and cache

| Step | Action                                                         | Expected                                                            |
| ---- | -------------------------------------------------------------- | ------------------------------------------------------------------- |
| 3.1  | Run `bun run hangar:reload-reviews` from CLI                   | Summary printed: ~89 WP items added/updated, no errors              |
| 3.2  | In Postgres, `SELECT count(*) FROM hangar.review_item;`        | Returns ~90+ (89 WPs + reference_toc + knowledge_node items)        |
| 3.3  | Edit a WP `spec.md` frontmatter `status: unread` -> `reading`  | After reload, that item's `cachedStatus` reflects `reading`         |
| 3.4  | Move a WP folder to `docs/work-packages/.archive/`             | After reload, item is soft-pruned; session history retained         |

## 4. Review board -- first visit

| Step | Action                                | Expected                                                                                  |
| ---- | ------------------------------------- | ----------------------------------------------------------------------------------------- |
| 4.1  | Navigate to `/review`                 | Board auto-creates with name "Hangar Review", 4 columns, seed buckets visible             |
| 4.2  | Verify bucket counts                  | "WP Specs -- unread" shows count matching DB query `WHERE cachedStatus->>'frontmatterStatus' = 'unread'` |
| 4.3  | Click expand chevron on a bucket card | Drawer opens inline; shows item rows for that bucket                                      |
| 4.4  | Click "Show in full list"             | Navigates to `/review/buckets/[id]` with full sortable list                               |

## 5. Review board -- filters

| Step | Action                                                | Expected                                                  |
| ---- | ----------------------------------------------------- | --------------------------------------------------------- |
| 5.1  | Click "Reviews" filter chip                           | Ad-hoc task cards hide; only review-kind items remain     |
| 5.2  | Click "Tasks" filter chip                             | Inverse: only ad-hoc cards remain                         |
| 5.3  | Click "All"                                           | All items visible again                                   |
| 5.4  | Type a kind name in search                            | Filters to matching items, count badges update            |

## 6. Review board -- drag-and-drop + frontmatter

| Step | Action                                                                   | Expected                                                                                                    |
| ---- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| 6.1  | Drag a `wp_spec` item from Backlog -> In Progress                        | Card moves; `git diff` on the WP's `spec.md` shows `status: unread` -> `status: reading`                    |
| 6.2  | Drag the same item to Review                                             | `status: reading` -> `status: done` written                                                                 |
| 6.3  | Drag the same item to Done                                               | Confirm modal: "Flip review_status: done?". On confirm, frontmatter updated                                  |
| 6.4  | Cancel the modal                                                         | Card snaps back to Review column                                                                            |
| 6.5  | Drag an item to Backlog (revert)                                         | Confirm modal: "This may discard review progress. Continue?"                                                |
| 6.6  | Drop a card on its current column                                        | No-op (no FS write, no flicker)                                                                             |

## 7. WP spec view -- tabs

| Step | Action                                                          | Expected                                                            |
| ---- | --------------------------------------------------------------- | ------------------------------------------------------------------- |
| 7.1  | Click a `wp_spec` item card                                     | Opens `/review/wp_spec/[itemId]` with the spec tab active           |
| 7.2  | Click the "Tasks" tab                                           | tasks.md renders                                                    |
| 7.3  | Click "Test Plan" tab                                           | test-plan.md renders                                                |
| 7.4  | Click "Design" / "User Stories" / "Notes"                       | Each tab renders or shows "Not present" if the file doesn't exist   |
| 7.5  | Click "Mark spec read"                                          | Frontmatter `status: done` written; toast "Marked read"             |
| 7.6  | Click "Open test-plan walker"                                   | Navigates to `/review/wp_test_plan/[itemId]`                        |

## 8. Test-plan walker -- end-to-end

Use `flightbag-scaffold` (existing WP with a multi-step test plan).

| Step | Action                                                                    | Expected                                                                              |
| ---- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 8.1  | Open `/review/wp_test_plan/flightbag-scaffold` (or whatever the item ID)  | Walker renders all sections + steps                                                   |
| 8.2  | Verify section grouping                                                   | Each H2 in test-plan.md becomes a section header; each table row a step               |
| 8.3  | Click "Pass" on step 1.1                                                  | Outcome badge turns green; step row marked complete; progress counter ticks           |
| 8.4  | Click "Fail" on step 1.2; type a note                                     | Outcome badge red; note saves on blur; visible after reload                           |
| 8.5  | Click "Blocked" on step 1.3                                               | Outcome badge yellow                                                                  |
| 8.6  | Reload the page                                                           | All recorded outcomes still present (session resumed)                                 |
| 8.7  | Click "Pause"                                                             | Returns to board; the item is in "In Progress" column                                 |
| 8.8  | Reopen the walker                                                         | Same session resumes; outcomes intact                                                 |
| 8.9  | Mark all remaining steps Pass; click "Finish"                             | Confirm "Mark this test plan complete?" -> on yes, prompts to flip `review_status`    |
| 8.10 | Click "Yes, flip"                                                         | `review_status: done` written to spec.md frontmatter                                  |
| 8.11 | Return to board                                                           | Item now in Done column                                                               |

## 9. Test-plan walker -- partial fail

| Step | Action                                                  | Expected                                                                |
| ---- | ------------------------------------------------------- | ----------------------------------------------------------------------- |
| 9.1  | Walk a test plan; mark one step Fail; click "Finish"    | Confirm prompt warns: "Some steps failed. Close session anyway?"        |
| 9.2  | On confirm, do NOT prompt to flip `review_status`       | Item moves to Review column but `review_status` stays `pending`         |

## 10. Reference TOC review

| Step | Action                                                   | Expected                                                          |
| ---- | -------------------------------------------------------- | ----------------------------------------------------------------- |
| 10.1 | Open a `reference_toc` item                              | TOC pane left, content pane right                                 |
| 10.2 | Click a TOC entry                                        | Content for that entry loads on right                             |
| 10.3 | Press `j` (pass)                                         | Entry marked pass; cursor advances to next entry                  |
| 10.4 | Press `k` (fail)                                         | Entry marked fail; cursor advances                                |
| 10.5 | Press `b` (block)                                        | Entry marked blocked                                              |
| 10.6 | Reload                                                   | Outcomes persisted                                                |

## 11. Knowledge node review

| Step | Action                                            | Expected                                       |
| ---- | ------------------------------------------------- | ---------------------------------------------- |
| 11.1 | Open a `knowledge_node` item                      | Single-decision view with the node markdown    |
| 11.2 | Click Pass + add a note                           | Outcome saved, returns to board                |

## 12. Ad-hoc tasks

| Step | Action                                                          | Expected                                                         |
| ---- | --------------------------------------------------------------- | ---------------------------------------------------------------- |
| 12.1 | Click "+ Ad-hoc" on board                                       | Navigates to `/review/tasks/new` form                            |
| 12.2 | Submit empty title                                              | Validation error                                                 |
| 12.3 | Submit valid task: title + type "bug" + area "hangar"           | Returns to board; new card visible in Backlog                    |
| 12.4 | Drag the task across columns                                    | Moves freely (no frontmatter side-effect)                        |
| 12.5 | Click Edit                                                      | Form pre-filled; change title, save                              |
| 12.6 | Click Delete                                                    | `confirm()` dialog, then removed                                 |

## 13. Loader admin

| Step | Action                                | Expected                                                    |
| ---- | ------------------------------------- | ----------------------------------------------------------- |
| 13.1 | Navigate to `/review/admin/loader`    | Last scan summary visible: counts, errors, last run time    |
| 13.2 | Click "Refresh"                       | Loader runs; summary updates                                |

## 14. Bucket admin

| Step | Action                                                                          | Expected                                                                                                  |
| ---- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 14.1 | Navigate to `/review/admin/buckets`                                             | List of buckets: name, kind, filter summary, item count, sort order; per-row Edit / Delete                |
| 14.2 | Click "+ New bucket"                                                            | Form: name, kind dropdown, structured filter editor, Advanced jsonb textarea, sort order, target column   |
| 14.3 | Submit empty name                                                               | Validation error: "Name is required"                                                                      |
| 14.4 | Submit a duplicate name (same as existing bucket)                               | Validation error: "Name must be unique on this board"                                                     |
| 14.5 | Submit valid: name "WP -- testing", kind `wp_spec`, filter `frontmatterStatus = "testing"`, column Backlog | Returns to list; new bucket appears with correct count                              |
| 14.6 | Visit `/review`                                                                 | New bucket card visible on the board with live count                                                      |
| 14.7 | Click Edit on a bucket; change filter; save                                     | Filter updates; bucket count reflects new criteria immediately                                            |
| 14.8 | Type a malformed jsonb predicate in Advanced textarea; submit                   | Server-side validation error inline; form not saved                                                       |
| 14.9 | Click Delete on a bucket; confirm                                               | Bucket removed from list and from board; the items it contained are not deleted (visible in other buckets or hidden) |

## 15. Edge cases

| Step | Action                                                         | Expected                                                       |
| ---- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| 15.1 | Open WP spec view for an item whose source folder was deleted  | Shows "Source not found" with a "Re-scan" suggestion           |
| 15.2 | Walk a test plan whose markdown changed mid-walk (rows renumbered) | Existing step outcomes orphan-keyed; warning banner shown   |
| 15.3 | Drag a card while loader is running                            | Move action queues or shows "Refreshing, retry in a moment"    |
| 15.4 | Concurrent users (if multi-user comes later)                   | Out of scope for v1                                            |
| 15.5 | Frontmatter write fails (file readonly)                        | Toast surfaces error; column move reverts                      |
