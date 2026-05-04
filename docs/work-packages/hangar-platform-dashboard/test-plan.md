---
title: Hangar Platform Dashboard -- Test Plan
product: hangar
feature: hangar-platform-dashboard
type: test-plan
status: ready-for-review
review_status: pending
---

# Hangar Platform Dashboard -- Test Plan

Manual test plan. Run with hangar dev server (`bun run dev` in `apps/hangar`) after `hangar-review-queue` Phases 1-3 have shipped (substrate + loader + docs browser).

## Prerequisites

- PostgreSQL running (OrbStack, port 5435)
- Hangar app running locally
- Auth: signed in as a user with author/admin role
- `hangar-review-queue` substrate in place (review_item rows populated by loader)
- Phase 1 + 2 of this WP applied (structured frontmatter blocks + CLAUDE.md updates)

## 1. Structured frontmatter -- baseline

| Step | Action                                                                            | Expected                                                          |
| ---- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1.1  | `head -50 docs/work/NOW.md`                                                       | Frontmatter has `in_flight`, `just_shipped`, `follow_ons` arrays  |
| 1.2  | `head -30 docs/products/hangar/ROADMAP.md`                                        | Frontmatter has `items:` array with status / wp / shipped_at      |
| 1.3  | Spot-check 3 ADRs                                                                 | Each has `adr`, `title`, `status`, `date`                         |
| 1.4  | `head -10 docs/platform/IDEAS.md`                                                 | Has `last_reviewed` and per-section `last_reviewed`               |
| 1.5  | Run `bun run check`                                                               | Clean -- no parse errors                                          |

## 2. /wp-drift -- cold run

| Step | Action                                                                            | Expected                                                                                       |
| ---- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 2.1  | Delete `.claude/skills-state/wp-drift/last-run.json` if present                   | File gone                                                                                      |
| 2.2  | Run `/wp-drift`                                                                   | Scans every source; reports drift items + size violations; runtime <2 min                       |
| 2.3  | Re-run `/wp-drift`                                                                | Reports "Skipped N (fingerprint unchanged)"; runtime <30s                                       |
| 2.4  | Touch a WP `spec.md` (no content change), run `/wp-drift`                         | Same skip behavior (fingerprint = content, not mtime)                                          |
| 2.5  | Edit a WP `spec.md` `status:` field (mark a `read` as `done`), run `/wp-drift`    | That WP re-validates; new state reflected                                                       |
| 2.6  | Inspect the checkpoint JSON                                                       | Contains `validated`, `drift_remaining`, `size_violations` fields per spec                      |

## 3. /wp-drift -- auto-fix

| Step | Action                                                                                                    | Expected                                                              |
| ---- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 3.1  | Manually edit a WP `spec.md` to `status: shipped` without updating NOW.md `just_shipped:`                  | File saved                                                            |
| 3.2  | Run `/wp-drift`                                                                                            | Reports drift: "wp/X status=shipped but missing from NOW.md"           |
| 3.3  | Run `/wp-drift --fix`                                                                                      | NOW.md `just_shipped:` gains an entry for X with PR (if findable)      |
| 3.4  | `git diff docs/work/NOW.md`                                                                                | Shows the new `just_shipped:` entry; nothing else                      |
| 3.5  | Run `/wp-drift` again                                                                                      | No drift on that WP                                                    |

## 4. /wp-drift -- triage

| Step | Action                                                                                                | Expected                                                                                     |
| ---- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 4.1  | Add a roadmap item to a ROADMAP.md without a `wp:` link, status `planned`                              | File saved                                                                                   |
| 4.2  | Run `/wp-drift --triage`                                                                               | Reports it under triage with reason "roadmap item without wp link -- needs human judgement"   |
| 4.3  | Run `/wp-drift --fix`                                                                                  | This item NOT auto-fixed (correctly classified as triage-only)                                |

## 5. Doc size check

| Step | Action                                                                                       | Expected                                                              |
| ---- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 5.1  | Run `bun run docs:size-check`                                                                 | Lists files over 500 lines + files in 400-499 warning band            |
| 5.2  | Verify NOW.md flagged if it's over the threshold today                                       | Shown with suggested split: "archive entries older than 60 days"      |
| 5.3  | Run `/wp-drift`                                                                              | `size_violations` in checkpoint includes the same files               |

## 6. /platform -- baseline render

| Step | Action                                  | Expected                                                                                  |
| ---- | --------------------------------------- | ----------------------------------------------------------------------------------------- |
| 6.1  | Navigate to `/platform`                 | Top-level dashboard renders all panes: NowBar, Drift, DocHealth, WP board, Roadmap, ADR, Ideas, Coverage, Recent |
| 6.2  | Verify NowBar                           | Shows the `in_flight` and `just_shipped` lists from NOW.md frontmatter                    |
| 6.3  | Click an in-flight WP card              | Navigates to `/review/wp_spec/<id>`                                                       |
| 6.4  | Verify Drift pane                       | Shows count + listed drift items from checkpoint                                          |
| 6.5  | Verify DocHealth pane                   | Shows files over 500 lines from checkpoint                                                |

## 7. /platform -- WP status board

| Step | Action                                            | Expected                                                                       |
| ---- | ------------------------------------------------- | ------------------------------------------------------------------------------ |
| 7.1  | Verify table renders                              | All ~89 WPs in the table; columns: name, product, status, review_status, last-touched, link |
| 7.2  | Sort by last-touched desc                         | Most recently edited WPs at top                                                |
| 7.3  | Filter to "active" WPs                            | Excludes shipped/done                                                          |
| 7.4  | Filter to "In NOW.md in_flight"                   | Shows only WPs listed in NOW.md `in_flight` array                              |
| 7.5  | Click a row                                       | Navigates to `/review/wp_spec/<id>`                                            |

## 8. /platform -- Roadmap

| Step | Action                                          | Expected                                                                            |
| ---- | ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| 8.1  | Verify per-app columns                          | One column per app (study/sim/hangar/runway); cards represent items                 |
| 8.2  | Verify status colors                            | Shipped / in_flight / planned / blocked all visually distinct                       |
| 8.3  | Click a card with `wp:` link                    | Navigates to `/review/wp_spec/<wp>`                                                 |
| 8.4  | Click a card without a wp link                  | Navigates to the matching `docs/products/{app}/ROADMAP.md` section in `/docs`       |
| 8.5  | Click "Timeline" toggle                         | Disabled or "Coming soon" placeholder; tooltip explains                             |
| 8.6  | Apply App filter -> Hangar                      | Only Hangar column visible                                                          |

## 9. /platform -- ADR + Ideas + Recent

| Step | Action                                            | Expected                                                                          |
| ---- | ------------------------------------------------- | --------------------------------------------------------------------------------- |
| 9.1  | Verify ADR index                                  | Sortable table; status pills; link to `/docs/decisions/...`                       |
| 9.2  | Click an ADR row                                  | Opens the decision.md in `/docs`                                                  |
| 9.3  | Verify Ideas funnel                               | Section names + counts + freshness ("3 days ago" / "stale -- 30+ days")           |
| 9.4  | Click a section                                   | Deep-links to `/docs/platform/IDEAS.md#<section>`                                  |
| 9.5  | Verify Recent activity                            | Last 50 commits; WP-touched commits show a WP-link chip                           |
| 9.6  | Click a commit                                    | Opens the GitHub commit URL in a new tab                                          |

## 10. /platform -- Coverage gaps

| Step | Action                          | Expected                                                                                     |
| ---- | ------------------------------- | -------------------------------------------------------------------------------------------- |
| 10.1 | Verify pane initial state       | "Last run: never" with a "Run scan" button                                                   |
| 10.2 | Click "Run scan"                | Button disabled with spinner; shells out to `bun run wp:coverage`                            |
| 10.3 | After scan completes            | Result table renders with uncovered features; "Last run: just now" timestamp                 |
| 10.4 | Click an uncovered row          | Suggested action visible (author WP / archive / link existing)                                |
| 10.5 | Reload page                     | Result persists (read from DB)                                                                |

## 11. /platform -- Drift fix actions

| Step | Action                                                                | Expected                                                            |
| ---- | --------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 11.1 | Manually create drift (per Step 3.1)                                   | Drift visible in /wp-drift on next run                              |
| 11.2 | Refresh /platform                                                     | Drift pane shows the new item with [Auto-fix] button                |
| 11.3 | Click "Auto-fix"                                                       | Spinner; on success the item disappears from the pane               |
| 11.4 | `git diff` the affected file                                           | Shows the auto-fix change                                           |
| 11.5 | Click "Snooze 7 days" on a triage item                                 | Item disappears from pane; reappears after 7 days OR fingerprint changes |

## 12. CLAUDE.md verification

| Step | Action                                                                          | Expected                                                                |
| ---- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 12.1 | Open project CLAUDE.md                                                          | Has "Platform tracking" + "Doc size limits" sections                    |
| 12.2 | Verify CLAUDE.md size                                                           | <500 lines OR split per the index pattern                                |
| 12.3 | Reset agent context, ask agent "how should I update NOW.md when shipping a WP?" | Agent cites the structured-block rule, mentions both prose + structure   |

## 13. Edge cases

| Step | Action                                                                                                | Expected                                                                                 |
| ---- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 13.1 | NOW.md `in_flight` references a WP that doesn't exist                                                 | /wp-drift triages it; dashboard shows it but with a warning chip                          |
| 13.2 | ROADMAP item with `wps: [a, b, c]` (array variant)                                                    | Validators handle both `wp:` and `wps:`; dashboard renders all linked WPs                 |
| 13.3 | Run /wp-drift with checkpoint from older schema_version                                               | Migration path triggered or clear error: "checkpoint schema mismatch -- delete and re-run" |
| 13.4 | Coverage scan crashes mid-run                                                                         | Dashboard shows error toast; previous result preserved; button re-enabled                 |
| 13.5 | Parse failure in a frontmatter block                                                                  | /wp-drift reports the file + parse error; dashboard pane skips that source with a warning |
