---
id: command-palette
title: Global search + command palette (Cmd+K / Cmd+P / Cmd+Shift+P)
product: platform
category: platform
status: draft
agent_review_status: pending
human_review_status: pending
created: 2026-05-11
owner: agent
depends_on: []
unblocks: []
tags:
  - search
  - palette
  - navigation
  - cross-app
legacy_fields:
  trigger: docs/work/plans/2026-05-10-command-palette-design.md
  source: design note 2026-05-10 + Phase 1 PR #817 (commit 059d93e3)
  related:
    - docs/work/plans/2026-05-10-command-palette-design.md
    - docs/work/plans/2026-05-10-palette-mockup.html
---

# Global search + command palette

## Problem

Today's palette (opened by `/` or `Cmd+K`, in [HelpSearchPalette.svelte](../../../libs/help/src/ui/HelpSearchPalette.svelte)) indexes two registries: ~100 help pages and the aviation reference list. Phase 1 (PR #817) backfilled the aviation registry with 250 FAA doc rows, a 100-entry synonym map, and a doc-code detector. The mechanics now match the corpus -- but the UI is still a two-bucket list, has no result-type taxonomy, no detail pane, no command/quick-open modes, and no per-app boosting.

A pilot who types `weather` should get the AvWX handbook hoisted, with PHAK Ch. 12 / AFH Ch. 2 / AC 00-6 sections clustered below, our own weather course / KB nodes on the right, and tools like aviationweather.gov in a separate column -- and they should get this same shape from any app (`study`, `sim`, `hangar`, `flightbag`, `avionics`).

A pilot who types `FAA-H-8` should get a vscode-style dropdown of matching handbooks. Enter opens the doc; `Cmd+Enter` sets a `doc:` filter chip and returns the cursor.

A pilot who hits `Cmd+Shift+P` should get a command-only list scoped to actions ("New plan", "Start sim", "Open audit log"), with the current app's commands first.

A pilot who hits `Cmd+P` should get a quick-open list of recent + known things.

This WP delivers all four behaviours across four phases. Phase 1 already shipped on `main`; this WP scopes Phases 2-5.

## Goals

- One palette component, three modes (`search` / `quickopen` / `command`), bound to `Cmd+K` / `Cmd+P` / `Cmd+Shift+P`.
- One ranker, one query parser, one result type taxonomy, one synonym pass.
- 7+ typed result groups, presented as up to four columns + optional detail pane.
- Hoist banner when a query has a single tier-1 match.
- Doc-code autocomplete via the [doc-code-detector](../../../libs/aviation/src/doc-code-detector.ts) shipped in Phase 1.
- Per-app boost: launching from `study` puts study results / commands first; everything else still shows, lower.
- All five surfaces (`study`, `sim`, `hangar`, `flightbag`, `avionics` when it lands) open the same palette and pass their surface id for boosting.

## Phases

| Phase | Branch / PR | Scope                                                                  | Status             |
| ----- | ----------- | ---------------------------------------------------------------------- | ------------------ |
| 1     | PR #817     | FAA doc registry, synonyms, doc-code detector, regression test fixture | shipped 2026-05-10 |
| 2     | TBD         | Result taxonomy + multi-column palette + loaders + AIM scanner         | this WP, in flight |
| 3     | TBD         | Visual variants + detail pane + doc-code autocomplete dropdown         | this WP            |
| 4     | TBD         | Command surfaces -- Cmd+Shift+P + per-app command registries           | this WP            |
| 5     | TBD         | Cmd+P quick-open + recents tracker                                     | this WP            |

Phase exit checklist (per phase):

1. `bun run check branch` clean.
2. Relevant `bun test` packages green.
3. `/ball-review-full` run end-to-end; every finding fixed in the same PR; re-run to confirm.
4. Walk the feature in a real browser on every affected surface.
5. PR description: what / why / manual test plan as a checklist.
6. Squash-merge after Joshua walks and approves.

## Result type taxonomy (the Phase 2 contract)

Every search result carries a `type` field. The type drives column placement, detail-pane affordances, and cross-column priority. Taxonomy is locked here so adding a new content domain later is "define type, register loader, assign column" -- not "rewrite the ranker."

| Type                   | Source                                               | Column          |
| ---------------------- | ---------------------------------------------------- | --------------- |
| `faa.handbook`         | FAA-H-* root rows in aviation registry               | FAA Resources   |
| `faa.handbook.chapter` | `study.reference_section` where `kind=HANDBOOK`      | FAA Resources   |
| `faa.cfr.part`         | `regulations/cfr-14/`, `cfr-49/` registry entries    | FAA Resources   |
| `faa.cfr.sect`         | `study.reference_section` where `kind=CFR`           | FAA Resources   |
| `faa.aim`              | `aim/2026-04/*` index (added in Phase 2)             | FAA Resources   |
| `faa.ac`               | AC registry rows (Phase 1 seeds + future ingest)     | FAA Resources   |
| `faa.acs`              | ACS docs in aviation registry                        | FAA Resources   |
| `airboss.course`       | `course/courses/*/` + `course/weather/` etc.         | Airboss Content |
| `airboss.knode`        | `study.knowledge_node`                               | Airboss Content |
| `airboss.glossary`     | aviation registry entries that aren't FAA docs       | Airboss Content |
| `airboss.lesson`       | study lesson pages                                   | Airboss Content |
| `airboss.help`         | help registry (existing)                             | App Help        |
| `mine.card`            | `study.card` for current user                        | My Stuff        |
| `mine.rep`             | `study.review` (decision reps) for current user      | My Stuff        |
| `mine.plan`            | `study.study_plan` for current user                  | My Stuff        |
| `web.tool`             | `libs/aviation/src/external-tools.ts` (Phase 2 seed) | External Tools  |
| `cmd.action`           | declarative command registry (Phase 4)               | Commands        |
| `cmd.goto`             | route registry (Phase 4)                             | Commands        |

`mine.note` and `airboss.lesson` are scaffolded in the type union but their loaders are stubs in Phase 2; they land when the upstream surfaces do.

## Mode contract (the Phase 4/5 contract)

```ts
type PaletteMode = 'search' | 'quickopen' | 'command';

const ELIGIBLE: Record<PaletteMode, ReadonlySet<SearchResultType>> = {
  search:    ALL_TYPES,
  quickopen: new Set(['faa.handbook', 'faa.cfr.part', 'airboss.course', 'airboss.knode', 'mine.plan', 'cmd.goto']),
  command:   new Set(['cmd.action', 'cmd.goto']),
};
```

Same input box, ranker, and registry serve all three modes. Mode is selected by the keybinding that opened the palette.

## Decisions

| #   | Decision                                                                                                                                                                                            | Source                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 1   | Default surface boost: launching app's results / commands first; others still appear                                                                                                                | design note Decisions  |
| 2   | External Tools: split into Validated + Community tiers; both visible by default                                                                                                                     | design note Decisions  |
| 3   | Detail pane on right; collapses with `Cmd+\`; hidden below ~900px                                                                                                                                   | design note Decisions  |
| 4   | Synonyms seeded from Appendix A (~100 entries); shipped Phase 1                                                                                                                                     | PR #817                |
| 5   | Default visual: Variant C (wide 4-column + right detail pane). Variants A/B/D live under `apps/study/src/routes/(app)/dev/palette/` for A/B until Joshua picks production default at end of Phase 3 | mockup + Phase 3 scope |
| 6   | Empty doc-picker order: alphabetical for first session; recency-weighted is later                                                                                                                   | design note open Q #1  |
| 7   | `REFERENCE_SOURCE_TYPES` expansion: one slot per handbook (AVWX, IPH, RMH, AIH, HFH, GFH, BFH added as discrete values)                                                                             | 2026-05-11 chat        |

## Non-goals

- Server-side FTS. Phase 2 is in-memory only; if any query needs >50ms to rank we revisit, but the corpus is small enough that the in-memory ranker should hold.
- Cross-tenant or cross-org search. Single-user single-tenant.
- Personalisation beyond recents (Phase 5). No collaborative filtering, no learned weights.
- Localisation. English-only.
- Indexing user reflection journals (`mine.note`). Scaffolded but no loader.
- Voice / NL queries.
- "Built-in" workflows (Alfred-style multi-step). Each result has one primary action plus Cmd+Enter / Cmd+\ modifiers.
- Reskinning `apps/hangar`'s `/docs` admin search. That's its own search surface for authors; this palette is for end users + admins from any app.

## See also

- [tasks.md](tasks.md) -- per-phase task lists
- [test-plan.md](test-plan.md) -- manual + automated test plan
- [design.md](design.md) -- contracts, file layout, loader signatures
