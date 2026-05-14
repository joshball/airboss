---
title: Command palette -- manual walkthrough (Cmd+K / Cmd+P / Cmd+Shift+P)
date: 2026-05-13
wp: command-palette
status: ready-for-walk
---

# Command palette -- manual walkthrough

Walk this end-to-end before flipping `human_review_status: signed-off` on the [command-palette WP](../../work-packages/command-palette/spec.md). Budget ~45-60 minutes if everything works.

After each section, decide one of:

- **PASS** -- works as described, move on
- **ISSUE** -- file via `bun run bug new <slug>`; tell me; I'll fix in a follow-up
- **REJECT** -- the design itself feels wrong; we re-discuss before sign-off

## What you're testing

Five years' worth of "search across the platform" decisions, shipped across 13 PRs. The locked decisions are in [spec.md](../../work-packages/command-palette/spec.md) (R1-R16). The five things that matter most for your walk:

1. **"Library" group label** (was "FAA Resources" pre-3.5). Type ID `faa.*` stayed; only the user-facing string changed.
2. **Top-hits strip** -- 3 best-overall rows, mixed types, ranker-decided, at the top of the modal.
3. **Vertical type-nav with counts** on the left -- click to filter; `App Help` hidden by default.
4. **Book-level collapse** -- typing `FAA-H-8083-28` returns ONE row in Library; chapters live in the detail pane as clickable sub-results.
5. **Three intents, three result shapes:**
   - **I-1 scoped** -- Tab-commit autocomplete entry -> `doc:<code>` chip + "References to this doc" panel
   - **I-2 broad** -- default ranker, mixed types, top-hits + columns
   - **I-3 phrase-FTS** -- long or quoted query -> passage cards with `<mark>` highlights
6. **Generic autocomplete** (`@ab/autocomplete`) orthogonal to the modal -- dropdown under any input; Tab commits canonical form; modal opens only on Enter when dropdown closed.
7. **Cmd+P quickopen** -- recents-first; localStorage-backed; cap-50 with recency-weighted ranking.
8. **Cmd+Shift+P command palette** -- per-app command registries with host-surface boost.

## Setup

Run the dev server from the **parent repo** (the worktree this walkthrough lives in doesn't have `.env`).

```bash
cd /Users/joshua/src/_me/aviation/airboss
git pull --ff-only
bun install
bun scripts/dev.ts study
```

Wait for `Local: http://127.0.0.1:9600/`. Open https://study.airboss.test (or http://127.0.0.1:9600) in a real browser. Devtools open. Sign in as Abby (`abby@airboss.test` per [project_abby_dev_seed_user](../../../../.claude/projects/-Users-joshua-src--me-aviation-airboss/memory/project_abby_dev_seed_user.md)).

For the multi-app walks (Phase 4), also start sim / hangar / flightbag:

```bash
bun scripts/dev.ts sim hangar flightbag
```

## Phase 1 walk (PR #817, shipped pre-session)

Sanity check that the FAA registry exists. Hit `Cmd+K`:

| Type            | Expect                                                 |
| --------------- | ------------------------------------------------------ |
| `FAA-H-8083-28` | Aviation Weather Handbook (AvWX) in top hits.          |
| `AvWX`          | Same.                                                  |
| `wx`            | Chip `wx -> weather` visible; weather results visible. |

If any of these return nothing, the registry didn't seed -- stop and report. The original bug.

## Phase 2 walk (PR #831 -- multi-column UI + 11 loaders)

Pull the full table from [test-plan.md -- Phase 2 manual walk](../../work-packages/command-palette/test-plan.md). Each row:

| Surface | Query                    | Expected                                                   |
| ------- | ------------------------ | ---------------------------------------------------------- |
| study   | `FAA-H-8083-28`          | Banner hoist to AvWX handbook; Enter opens                 |
| study   | `8083-28`                | Same                                                       |
| study   | `H-8083-28`              | Same                                                       |
| study   | `AvWX`                   | Same                                                       |
| study   | `Aviation Weather`       | AvWX + AC 00-6 + PHAK Ch.12 + weather course + wx KB nodes |
| study   | `wx`                     | Same set + chip "wx == weather"                            |
| study   | `weather`                | Same set                                                   |
| study   | `91.103`                 | 14 CFR 91.103 section in Library                           |
| study   | `Part 91`                | 14 CFR Part 91 banner                                      |
| study   | `Va`                     | Va glossary entry in Airboss Content                       |
| study   | `density altitude`       | Glossary + handbook sections + KB nodes citing it          |
| study   | `METAR`                  | Glossary + AvWX chapters + cards that ask about it         |
| study   | `doc:FAA-H-8083-28 turb` | Only turbulence sections inside AvWX                       |
| study   | `kind:cfr 91.103`        | Only the CFR section, no handbook discussion               |

Also:

- Filter chips appear and are removable
- Empty palette + closed via Escape preserves prior page focus
- Narrow viewport: columns stack vertically

## Phase 3 walk (PRs #857, #921, #925 -- visual + hotfix)

### Dev variants

Three prototype palettes that share the same data:

- http://localhost:9600/dev/palette -- index page linking the three
- http://localhost:9600/dev/palette/wide -- Variant C (4-col grid + detail pane; production)
- http://localhost:9600/dev/palette/list -- Variant A (Linear-style sectioned list, no detail)
- http://localhost:9600/dev/palette/raycast -- Variant B (narrow column + always-on detail)

Type `weather` in each. Confirm visual presentation matches the names.

### Production palette

Hit `Cmd+K` from any study page. Production component is `CommandPalette.svelte` (post-3.5 layout, not the original Variant C). Confirm:

- `Cmd+\` toggles detail pane on/off
- Below ~900px viewport, detail pane hides entirely
- Type `FAA-H-8` -- vscode-style autocomplete dropdown opens under the input
- Each dropdown row shows `code` + `title` (both directions)
- `Esc` dismisses dropdown but keeps palette open

### Hotfix verification

Devtools console MUST be clean. The `Module "node:fs" has been externalized` error that bit us in Phase 3 was fixed by PRs #921 + #925 (the `@ab/sources` runtime-barrel split). If you see any `node:fs externalized` or `Buffer is not defined` errors on any authenticated page, stop and report -- that's a regression.

## Phase 3.5 walk (PRs #929, #930, #933, #936 -- the redesign)

This was the major rework after you walked Phase 3 and called out ranking, section pollution, autocomplete entanglement, "FAA Resources" misnomer. Verify each fix.

### Layout

Open `Cmd+K`. Confirm:

- **"Library"** label on the left type-nav (NOT "FAA Resources")
- Three columns visible: type-nav (left) | result list (middle) | detail pane (right)
- Top of modal has a **3-row top-hits strip** above the columns
- Type-nav buckets show **counts** next to each label
- `App Help` bucket HIDDEN until you have a query that produces help results AND no other type has results

### I-2 broad search (default)

For each row, type the query, hit Enter (no Tab), verify the top-hit:

| Query              | Expected top hit                                                           |
| ------------------ | -------------------------------------------------------------------------- |
| `weather`          | AvWX handbook (NOT a chapter, NOT a CFR body match)                        |
| `Aviation Weather` | AvWX top-of-top-hits                                                       |
| `wx`               | Same set, with synonym chip                                                |
| `FAA-H-8083-28`    | AvWX handbook; ONE row in Library; chapters in the detail pane (collapsed) |
| `8083-28`          | Same                                                                       |
| `91.103`           | 14 CFR §91.103 top hit (the section, not Part 91)                          |
| `Part 91`          | 14 CFR Part 91 row, inline-prefixed as `14 CFR Part 91`                    |
| `Va`               | Va glossary in Airboss Content                                             |

If `weather` puts a CFR section above the AvWX handbook, the ranker regressed -- file an issue.

### I-1 scoped search (autocomplete commit)

| Action                                                                              | Expect                                                                                                 |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Type `FAA-H-808`, then Tab on highlighted `FAA-H-8083-28 Aviation Weather Handbook` | Input becomes `FAA-H-8083-28`; modal stays in current state; **no search runs yet**                    |
| Hit Enter                                                                           | I-1 search runs -- doc-headline card + "References to this doc" panel (lessons / KB nodes / citations) |
| Type `Aviation Weath`, Tab on dropdown row                                          | Input becomes `Aviation Weather Handbook`                                                              |
| Cmd+Enter on dropdown                                                               | Sets `doc:FAA-H-8083-28` chip; clears input; runs scoped search immediately                            |

The "no search until second Enter" behavior is the orthogonal-autocomplete contract (R13). Tab MUST NOT trigger a search.

### I-3 phrase-FTS

| Query                                            | Expected                                                                    |
| ------------------------------------------------ | --------------------------------------------------------------------------- |
| `"dusk vs sunset"` (quoted)                      | Passage cards with `<mark>` highlights; sections like 14 CFR §1.1, AIM 4-3. |
| `something about pilot rest before night flying` | Same shape (4+ words forces I-3).                                           |
| `regs say something about cruise altitudes`      | I-3; passage cards from CFR sections.                                       |
| `VFR minimums in class B`                        | I-3; passages from 14 CFR §91.155, AIM 3-2 etc.                             |

In I-3 mode:

- NO top-hits strip
- NO type-nav
- Whole pane is passage cards
- Each card has a highlighted snippet (the `<mark>` markup from Postgres `ts_headline`)

## Phase 4 walk (PR #940 -- Cmd+Shift+P + per-app commands)

For each of the 4 apps, navigate to the app's URL and hit `Cmd+Shift+P`. Confirm:

- Command-mode palette opens (no search results, only commands)
- Active app's commands appear FIRST
- Cross-app commands appear below
- Each command's `surface` chip visible

### Shipped commands per app

Read the canonical lists from these files:

- study: [apps/study/src/lib/palette/commands.ts](../../../apps/study/src/lib/palette/commands.ts)
- sim: [apps/sim/src/lib/palette/commands.ts](../../../apps/sim/src/lib/palette/commands.ts)
- hangar: [apps/hangar/src/lib/palette/commands.ts](../../../apps/hangar/src/lib/palette/commands.ts)
- flightbag: [apps/flightbag/src/lib/palette/commands.ts](../../../apps/flightbag/src/lib/palette/commands.ts)

Pick one command from each app's list, activate it (click or Enter), confirm it routes correctly.

## Phase 5 walk (PR #942 -- Cmd+P quickopen + recents)

Clear localStorage first (Devtools -> Application -> Local Storage -> `airboss.palette.recents.v1` -> delete).

| Step | Action                                     | Expect                                                                                     |
| ---- | ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| 1    | Hit `Cmd+P`                                | Empty list (no recents yet)                                                                |
| 2    | Hit `Cmd+K`, type `weather`, Enter on AvWX | Navigates to handbook                                                                      |
| 3    | Back, hit `Cmd+P`                          | AvWX appears in recents                                                                    |
| 4    | Hit `Cmd+K`, open 5 more different results | --                                                                                         |
| 5    | Hit `Cmd+P`                                | All 6 recents listed; recency-weighted ranking (recent + frequent floats top)              |
| 6    | Type a partial query while in `Cmd+P` mode | Filters across recents + index (eligible types only per `PALETTE_MODE_ELIGIBLE.quickopen`) |
| 7    | Open one of the recent results             | Its `hits` count bumps; next `Cmd+P` shows it ranked higher                                |

Eligibility check: `Cmd+P` should ONLY return result types in the quickopen eligible set: `faa.handbook`, `faa.cfr.part`, `airboss.course`, `airboss.knode`, `mine.plan`, `cmd.goto`. Cards, reps, KB sections, etc. should NOT appear.

## What's deliberately disabled / future-tracked

Four bug entries track punted items. Spot-check each:

| Bug                                                                                                | What's disabled                                                                                     |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [bug-palette-pin-to-today](../../bugs/bug-palette-pin-to-today.md)                                 | Detail-pane "Pin to today" button is greyed; tooltip explains why                                   |
| [bug-palette-phase4-dropped-commands](../../bugs/bug-palette-phase4-dropped-commands.md)           | sim missing "Start new sim" / "Resume last sim"; hangar missing "New doc"                           |
| [bug-palette-fts-third-source](../../bugs/bug-palette-fts-third-source.md)                         | I-3 phrase-FTS queries DON'T return passages from authored lesson/course-step bodies                |
| [bug-flightbag-library-smoke-pre-existing](../../bugs/bug-flightbag-library-smoke-pre-existing.md) | Pre-existing `ERR_INVALID_REDIRECT` in the `/library` Playwright smoke -- not introduced by this WP |

These are tracked, not bugs in the work you walked. If you encounter any OTHER unexpected behavior, file via `bun run bug new <slug>`.

## Sign-off

Only flip when every section above passed:

```bash
bun run wp set command-palette human-review signed-off
bun run wp set command-palette status shipped
bun run track generate
git add docs/work-packages/command-palette/spec.md docs/work/BOARD.md docs/products/*/ROADMAP.md
git commit -m "ship command-palette WP"
```

(Per the ADR-025 lint, only your email can flip `human_review_status`. The `status: shipped` move is gated on `human_review_status: signed-off` being set first.)

## Related

- [spec.md](../../work-packages/command-palette/spec.md) -- 16 locked decisions (R1-R16)
- [design.md](../../work-packages/command-palette/design.md) -- file layout, contracts, keybindings
- [test-plan.md](../../work-packages/command-palette/test-plan.md) -- full automated + manual test matrices
- [design/mockups/search/](../../../design/mockups/search/) -- Phase 3.5 redesign mockups (current-state, new-layout, autocomplete, ranking)
