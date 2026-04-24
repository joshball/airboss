---
title: 'Handoff: Help-System Fix Pass'
date: 2026-04-24
from_session: manual-test walkthrough of spaced-memory-items
next_session: fresh agent, fresh context
status: ready-to-execute
---

# Handoff: Help-System Fix Pass

Fresh session picks this up cold. Everything you need is here: context, prior-session review findings, product decisions, exact scope, and a launch prompt at the bottom.

## Context

During a manual walkthrough of the spaced-memory-items feature, the user flagged that tooltip/help coverage was largely absent across memory surfaces. Before planning a fix pass, a review agent audited the existing help system (InfoTip, PageHelp, libs/help, the static validator, authored content). The review found:

- **One critical bug**: PageHelp ships unstyled. Its CSS references `--ab-color-*`, `--ab-font-*`, `--ab-focus-*`, `--ab-transition-*` tokens that do not exist. The rest of the codebase uses semantic names (`--edge-default`, `--surface-*`, `--ink-*`, `--action-*`, `--focus-ring`, `--font-size-*`, `--motion-*`). PageHelp escaped the token-migration sweep. Every `?` rendered today is a bare unstyled glyph — which also explains the user-reported "mystery `?`" complaint.
- **Coverage collapse on the memory surface**: only 6 static help references in the whole study app. `/session/start` is the lone well-covered surface.
- **Primitives are solid**: InfoTip has strong a11y, focus trap, hover+click+focus parity, viewport-edge flip, mobile tap support, clean tokens. PageHelp's markup is fine — only its stylesheet is broken.
- **18 authored help pages**: 9 page-level, 9 concept pages. Memory surface needs 4 new page-level pages and 2 new `concept-fsrs` sections.

Full review report lives at `/private/tmp/claude-501/-Users-joshua-src--me-aviation-airboss/c1bd72a0-eef9-49c6-abf5-b4ac8a3fb857/tasks/a03a5831d75e65c32.output` but the essentials are replicated below.

## Delivery plan

Two waves, two PRs, sequential.

### Wave 1 — Critical fixes + primitive polish (ship first)

Standalone PR. Fixes the visible presentation bug so Wave 2 lands on a working foundation.

**Scope:**

1. **Fix PageHelp token references** (`libs/help/src/ui/PageHelp.svelte:42-71`). Replace every `--ab-*` custom property with the semantic equivalent that InfoTip already uses. Exact mapping:

   | Old (non-existent)           | New (semantic)           |
   | ---------------------------- | ------------------------ |
   | `--ab-color-border`          | `--edge-default`         |
   | `--ab-color-surface`         | `--surface-sunken`       |
   | `--ab-color-fg-subtle`       | `--ink-subtle`           |
   | `--ab-color-primary`         | `--action-default-fg`    |
   | `--ab-color-primary-subtle`  | `--action-default-bg`    |
   | `--ab-font-size-sm`          | `--font-size-sm`         |
   | `--ab-font-weight-semibold`  | `--font-weight-semibold` |
   | `--ab-transition-fast`       | `--motion-fast`          |
   | `--ab-focus-ring`            | `--focus-ring`           |
   | `--ab-focus-ring-width`      | `--focus-ring-width`     |
   | `--ab-focus-ring-offset`     | `--focus-ring-offset`    |

   Verify each target exists in `libs/themes/generated/tokens.css` before using it. Mirror InfoTip's style block organization for consistency.

2. **Visible label on PageHelp trigger.** Today it's a bare `?` glyph with a `title` + `aria-label` only. Render an optional visible label. Introduce a `variant` prop:

   ```typescript
   variant?: 'icon' | 'icon+text' = 'icon+text';
   ```

   The `icon+text` variant shows `[? Help]` inside a chicklet-style affordance (small pill with border + background, same hover/focus states as InfoTip trigger). The `icon` variant preserves the bare-glyph form for tight contexts (future-proofing — do not use anywhere in this PR).

   **IMPORTANT per user direction:** a floating `?` with no container is forbidden. The `?` must always live inside a chicklet/pill/button-shaped affordance. Bare glyphs read as punctuation.

3. **Constants module for help copy.** Create or extend `libs/constants/src/help.ts` with:

   ```typescript
   export const HELP_TRIGGER_LABELS = {
     PAGE: 'Help',
     ITEM: '',
   } as const;
   ```

   Wire `PageHelp` to default its `label` prop to `HELP_TRIGGER_LABELS.PAGE`. Rationale: the user wants these labels swappable later without code changes; page-level help gets a `[Help]` button, inline item help may stay icon-only inside a chicklet.

   Re-export from `libs/constants/src/index.ts`.

4. **InfoTip dev-warn parity with PageHelp.** InfoTip accepts an optional `helpId` that drives its "Learn more" link. Today a bad id silently ships a 404-bound link. Add the same DEV-mode `console.warn` that PageHelp uses, so dynamic-helpId bindings are surfaced in development even though the static validator can't reach them.

5. **InfoTip content-length guardrail.** Add `max-height: 20rem; overflow-y: auto` to the popover body. Document the intended length budget ("one to two short sentences; anything longer belongs in a full help page") in the component's JSDoc.

6. **Z-index sanity check.** InfoTip popover is `z-index: 50`. Grep every `z-index` in `libs/ui/src/**` and `libs/help/src/**`. If any modal / dialog / banner / toast uses `>= 50`, either raise InfoTip to sit above them all or document the intentional layering. Report findings in the PR body.

**Out of scope for Wave 1:**
- No new authored help pages
- No new InfoTip / PageHelp applications on memory surfaces
- No HelpTrigger unification (the idea of a single primitive both InfoTip and PageHelp wrap — it's a follow-up)

**Verification:**
- `bun run check` passes clean
- `bun scripts/validate-help-ids.ts` still passes
- Load `/memory/review` in the dev server and confirm the `?` chicklet next to "Card N of M" now presents as a visible `[? Help]` affordance, not a bare floating glyph
- Hover the chicklet: InfoTip-style visual treatment; click navigates to `/help/memory-review`

**Finish criteria:**
- One squash-merged PR titled something like `fix(help): PageHelp token migration + visible label + InfoTip parity polish`
- Branch and worktree cleaned up after merge

---

### Wave 2 — Memory-surface coverage pass

Ships after Wave 1 merges. Single medium PR, no work package (spec is the punch list below; work-package process adds no value).

**Scope summary:**
- 4 new authored help pages: `memory-dashboard`, `memory-new`, `memory-browse`, `memory-card`
- 2 new sections in the existing `concept-fsrs` page: `#states` and `#stability-and-mastery`
- 21 InfoTip / PageHelp placements across 5 memory routes

**New authored help pages.** Put each in `apps/study/src/lib/help/content/`:

#### `memory-dashboard.ts`

Covers `/memory`. Sections:
- What this page shows (top-level orientation)
- Stat tiles (Due now, Reviewed today, Streak, Active cards) — one sentence each, link to `concept-fsrs` for the scheduling definitions
- State groupings (New / Learning / Review / Relearning) — link to `concept-fsrs#states`
- Domain breakdown (total / due / % mastered) — link to `concept-fsrs#stability-and-mastery`

#### `memory-new.ts`

Covers `/memory/new`. Sections:
- Minimum-information principle (one fact per card)
- Front / Back authoring guidance
- Domain classification (why it matters for filtering and session mix)
- Type selector (what `Basic` means; future types noted)
- Tags (what they are used for)
- "Save and add another" (domain + tags carry forward)

#### `memory-browse.ts`

Covers `/memory/browse`. Sections:
- What browse shows vs review
- Filter semantics (Domain / Type / Source / Status)
- Status lifecycle (Active / Suspended / Archived — what each does to scheduling)
- Per-card badges (same as card-detail)

#### `memory-card.ts`

Covers `/memory/[id]`. Sections:
- `#domain` — what the domain badge means
- `#type` — what the type badge means (link to memory-new)
- `#lifecycle` — Active / Suspended / Archived and how Suspend / Archive / Reactivate buttons move between states
- `#source` — Personal (authored by you) vs Course (ported; read-only)
- Schedule stats (State / Due / Stability / Difficulty / Reviews / Lapses) — link to concept-fsrs sections

**New sections in existing `concept-fsrs.ts`:**
- `#states` — definitions of New / Learning / Review / Relearning and how cards transition
- `#stability-and-mastery` — stability in days; the `MASTERY_STABILITY_DAYS` threshold; what "mastered" means operationally

**Placement punch list (apply these exactly):**

All recommendations use `InfoTip` unless noted. Where a helpId like `memory-card#source` is given, the InfoTip's "Learn more" link targets that anchor.

| # | Route               | Element                                          | File:line                              | Primitive   | helpId                                         |
| - | ------------------- | ------------------------------------------------ | -------------------------------------- | ----------- | ---------------------------------------------- |
| 1 | `/memory`           | Page header                                      | `memory/+page.svelte:27-37`            | `PageHelp`  | `memory-dashboard`                             |
| 2 | `/memory`           | "Due now" stat tile                              | `memory/+page.svelte:40-47`            | `InfoTip`   | `memory-review#how-scheduling-works`           |
| 3 | `/memory`           | "Reviewed today" stat tile                       | `memory/+page.svelte:48-54`            | `InfoTip`   | `memory-dashboard`                             |
| 4 | `/memory`           | "Streak" stat tile                               | `memory/+page.svelte:55-61`            | `InfoTip`   | `memory-dashboard`                             |
| 5 | `/memory`           | "Active cards" stat tile                         | `memory/+page.svelte:62-67`            | `InfoTip`   | `memory-dashboard`                             |
| 6 | `/memory`           | State pills (4x: New / Learning / Review / Relearning) | `memory/+page.svelte:73-88`      | `InfoTip` per pill | `concept-fsrs#states`                   |
| 7 | `/memory`           | Domain row (total / due / % mastered)            | `memory/+page.svelte:97-114`           | `InfoTip` on header | `concept-fsrs#stability-and-mastery`  |
| 8 | `/memory/new`       | Page header                                      | `memory/new/+page.svelte:74-81`        | `PageHelp`  | `memory-new`                                   |
| 9 | `/memory/new`       | Domain / Type / Tags fields (3x)                 | `memory/new/+page.svelte:141-174`      | `InfoTip` per field | section anchors in `memory-new`        |
| 10 | `/memory/browse`   | Page header                                      | `memory/browse/+page.svelte:131-138`   | `PageHelp`  | `memory-browse`                                |
| 11 | `/memory/browse`   | Filter labels + Status lifecycle                 | `memory/browse/+page.svelte:159-192`   | `InfoTip` per filter | section anchors in `memory-browse`    |
| 12 | `/memory/review`   | Domain badge on question                         | `memory/review/+page.svelte:296`       | `InfoTip`   | `memory-card#domain`                           |
| 13 | `/memory/review`   | Rating buttons (4x)                              | `memory/review/+page.svelte:351-365`   | `InfoTip` per button | `memory-review#the-four-ratings`      |
| 14 | `/memory/review`   | "Show answer" button                             | `memory/review/+page.svelte:317-320`   | `InfoTip`   | `concept-active-recall`                        |
| 15 | `/memory/[id]`     | Page header                                      | `memory/[id]/+page.svelte:141-156`     | `PageHelp`  | `memory-card`                                  |
| 16 | `/memory/[id]`     | Domain badge                                     | `memory/[id]/+page.svelte:147`         | `InfoTip`   | `memory-card#domain`                           |
| 17 | `/memory/[id]`     | Type badge                                       | `memory/[id]/+page.svelte:148`         | `InfoTip`   | `memory-card#type`                             |
| 18 | `/memory/[id]`     | Status badge                                     | `memory/[id]/+page.svelte:149-151`     | `InfoTip`   | `memory-card#lifecycle`                        |
| 19 | `/memory/[id]`     | Source badge                                     | `memory/[id]/+page.svelte:152-154`     | `InfoTip`   | `memory-card#source`                           |
| 20 | `/memory/[id]`     | Suspend / Archive / Reactivate buttons           | `memory/[id]/+page.svelte:265-316`     | `InfoTip` adjacent to each | `memory-card#lifecycle`         |
| 21 | `/memory/[id]`     | Schedule stats dl (State/Due/Stability/Difficulty/Reviews/Lapses) | `memory/[id]/+page.svelte:326-333` | `InfoTip` per `<dt>` | `concept-fsrs` appropriate sections |

**Verification:**
- `bun run check` passes (validator picks up new ids as registered)
- Walk each of the 5 memory routes in the dev server and confirm every flagged element has a working help affordance
- No layout regressions — InfoTip triggers should sit inline without jitter

**Finish criteria:**
- One squash-merged PR titled `feat(help): memory-surface coverage pass`
- 4 new help pages + 2 new concept-fsrs sections registered and linked
- All 21 placements applied
- Branch and worktree cleaned up after merge

---

## Rules the agent must follow

Non-negotiable:
- Read `CLAUDE.md` at repo root first. Bun only. Svelte 5 runes only. `@ab/*` imports across libs. Biome tabs / single quotes / 120 / trailing commas / semicolons.
- **NO AI attribution** in commits or PR bodies. No "Generated by Claude". No Co-Authored-By.
- **Never use the word "honest"** as an agent qualifier.
- **Never use em-dash or `--`** as a sentence separator in doc prose.
- No magic strings, put the help-copy defaults in `libs/constants/src/help.ts`.
- **Always use `/ball-worktree`** to launch work in an isolated git worktree via a sub-agent. Never edit files directly from the main repo root.
- **Parallelize within each Wave where files do not overlap.** Wave 2 especially: the 4 new authored help pages and the 21 placements touch disjoint files and can run as multiple parallel `/ball-worktree` agents. Keep one agent per file cluster (routes vs content) to avoid the "parallel agents scope by file" collision pattern.
- Wave 1 merges before Wave 2 starts, Wave 2 placements depend on Wave 2 content pages, so the content-page agents finish and land before placement agents run (or content pages ship in the same PR first, then placement agents rebase).
- `bun run check` must pass clean before opening each PR.
- After each PR merges, clean up the worktree and delete the remote branch.

---

## Launch prompt for the next session

Paste this into a fresh session:

```
You are picking up a help-system fix pass in airboss. Everything you need is in docs/work/handoffs/20260424-help-system-fix-pass.md. Read it in full before doing anything else.

Execute Wave 1 and Wave 2 sequentially. Use `/ball-worktree` for every change, never edit from the main repo root. Merge Wave 1 before starting Wave 2.

Parallelize within each Wave where files do not overlap. Wave 2 especially: the 4 new authored help pages live in disjoint files from the 21 placement sites. Consider one of these parallel structures:
  (a) one `/ball-worktree` agent authors the 4 help pages + 2 concept-fsrs sections in a single PR, lands it, then 5 parallel `/ball-worktree` agents each take one memory route (`/memory`, `/memory/new`, `/memory/browse`, `/memory/review`, `/memory/[id]`) for placements.
  (b) one `/ball-worktree` agent for content pages, one for all 21 placements. Less parallelism, fewer merge passes.
Pick whichever keeps file ownership clean and avoids cross-agent churn.

For each PR: create a branch, do the work, run `bun run check`, push, open a PR with `gh pr create`, squash-merge with `--delete-branch`, then clean up the worktree and local branch. No AI attribution anywhere.

When you hit something the handoff doc does not cover (a token name missing from the semantic set, an exact line number drifted, a route structure differs), investigate and decide; do not stop to ask. The handoff is precise enough to execute; small drift is expected.

Report back after each Wave: PR URL, merge SHA, one-paragraph summary of what changed, and any findings (broken token references beyond PageHelp, z-index conflicts, layout issues surfaced).
```
