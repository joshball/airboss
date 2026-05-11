---
title: Command palette -- test plan
parent: spec.md
---

# Test plan

Phase exits only when **every box in the relevant section is checked**, both automated and manual.

## Phase 2 -- automated

| File                                                         | Asserts                                                                    |
| ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `libs/aviation/src/__tests__/global-search-coverage.test.ts` | Every "Build it for these queries" row returns expected type + column      |
| `libs/help/src/search.test.ts`                               | `GroupedResults` shape -- banner / clusters / synonymsApplied / filters    |
| `libs/help/src/loaders/aviation-refs.test.ts`                | Splits handbook root vs chapter; maps to correct `SearchResultType`        |
| `libs/help/src/loaders/handbook-sections.test.ts`            | DB-backed loader matches title / code / body; respects user-scoped filters |
| `libs/help/src/loaders/cfr-sections.test.ts`                 | `91.103` -> single `faa.cfr.sect` result; `Part 91` -> `faa.cfr.part`      |
| `libs/help/src/loaders/aim-sections.test.ts`                 | `AIM 7-1` -> AIM chapter 7 section 1 result                                |
| `libs/help/src/loaders/knowledge-nodes.test.ts`              | Matches `name` + `aliases`; respects lifecycle filter                      |
| `libs/help/src/loaders/cards.test.ts`                        | Empty when unauthenticated; matches owner-scoped cards otherwise           |
| `libs/help/src/loaders/external-tools.test.ts`               | Validated + community tier; `kind:web.validated` filter narrows correctly  |
| `libs/help/src/query-parser.test.ts`                         | `doc:`, `mine` token, alias resolution                                     |

## Phase 2 -- manual walk

Walk each surface in a real browser, devtools open. Screenshot per query.

| Surface   | Query                    | Expected                                                           |
| --------- | ------------------------ | ------------------------------------------------------------------ |
| study     | `FAA-H-8083-28`          | Banner hoist to AvWX handbook; Enter opens                         |
| study     | `8083-28`                | Same                                                               |
| study     | `H-8083-28`              | Same                                                               |
| study     | `AvWX`                   | Same                                                               |
| study     | `Aviation Weather`       | AvWX + AC 00-6 + PHAK Ch.12 + weather course + wx KB nodes         |
| study     | `wx`                     | Same set + chip "wx == weather"                                    |
| study     | `weather`                | Same set                                                           |
| study     | `91.103`                 | 14 CFR 91.103 section in FAA Resources                             |
| study     | `Part 91`                | 14 CFR Part 91 banner                                              |
| study     | `Va`                     | Va glossary entry in Airboss Content                               |
| study     | `density altitude`       | Glossary + handbook sections + KB nodes citing it                  |
| study     | `METAR`                  | Glossary + AvWX chapters + cards that ask about it                 |
| study     | `doc:FAA-H-8083-28 turb` | Only turbulence sections inside AvWX                               |
| study     | `kind:cfr 91.103`        | Only the CFR section, no handbook discussion                       |
| sim       | (same battery)           | Equivalent results; sim help / scenarios appear in App Help column |
| hangar    | (same battery)           | Equivalent; hangar help in App Help column                         |
| flightbag | (same battery)           | Equivalent; flightbag-rendered links resolve                       |

Also:

- Hoist banner appears only for true tier-1 single match.
- Cluster expansion under FAA Resources shows "+N more" when >3 children.
- Filter chips appear and are removable.
- Empty palette + closed via Escape preserves prior page focus.
- 5-line viewport: columns stack vertically.

## Phase 3 -- automated

| File                                           | Asserts                                                        |
| ---------------------------------------------- | -------------------------------------------------------------- |
| `tests/e2e/command-palette.spec.ts`            | Four-query suite: `weather`, `FAA-H-8083-28`, `91.103`, `wx`   |
| `libs/help/src/ui/DocCodeAutocomplete.test.ts` | Trigger detection, key handling, Esc, Cmd+Enter chip           |
| `libs/help/src/ui/CommandPalette.test.ts`      | Mode prop selects eligible types; detail pane toggles on Cmd+\ |

## Phase 3 -- manual walk

- Variant A/B/C all load at `/dev/palette/{wide,list,raycast}` in study.
- Production mount uses Variant C (or whatever Joshua picks); detail pane on right.
- `Cmd+\` toggles detail pane; below ~900px detail pane hides.
- Doc-code dropdown fires on `FAA-H-8`, `AC 00`, `Part 91`, `14 CFR`, `§91`, `AvWX`.
- Animations smooth at 120ms / 80ms / 160ms; `prefers-reduced-motion` honored.
- Theme switch (light / dark / high-contrast) -- all column accents legible.

## Phase 4 -- automated

| File                                          | Asserts                                                        |
| --------------------------------------------- | -------------------------------------------------------------- |
| `libs/help/src/commands/registry.test.ts`     | Register / unregister / search; host-surface boost ordering    |
| `apps/study/src/lib/palette/commands.test.ts` | Study commands present; handler invocations recorded           |
| (same for `sim`, `hangar`, `flightbag`)       | Each app's commands appear top when launched from that surface |

## Phase 4 -- manual walk

- Cmd+Shift+P in study lists "New plan" first.
- Cmd+Shift+P in sim lists "Start new sim" first; study commands still visible, lower.
- Cmd+Shift+P in hangar / flightbag similar.
- Mode hint in input placeholder reflects "Command palette".

## Phase 5 -- automated

| File                                       | Asserts                                                     |
| ------------------------------------------ | ----------------------------------------------------------- |
| `libs/help/src/recents.test.ts`            | Record / list / clear; cap at 50; LRU decay; date bucketing |
| `libs/help/src/search.test.ts` (quickopen) | Mode filters eligible types; empty input returns recents    |

## Phase 5 -- manual walk

- Cmd+P empty -> recents render with their type accents.
- Open a few results; reopen Cmd+P; same results at top.
- Cmd+P with typed text filters across recents + index.
- Clear recents via dev panel (or page reload + localStorage clear); empty state shows hint.

## Cross-phase regression checks

Every phase re-runs:

- `bun run check branch` clean.
- `bun test` green in `libs/aviation`, `libs/help`, `libs/bc-study`, every touched app.
- No new console errors on palette open across all surfaces.
- No new accessibility violations from axe-core on the open palette.

## Out-of-scope, defer triggers

| Item                                      | Trigger to revisit                     |
| ----------------------------------------- | -------------------------------------- |
| Server-side FTS                           | If any in-memory rank exceeds 50ms p95 |
| `mine.note` (reflection journal)          | When reflection surface ships          |
| Recents-weighted doc-picker order         | When telemetry exists                  |
| Voice / NL queries                        | Not soon                               |
| Search-inside-an-app-tour ("how do I X?") | After help corpus growth justifies     |
