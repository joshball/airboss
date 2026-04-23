---
title: 'Airboss: finish-the-whole-thing plan (hangar + open follow-ons)'
date: 2026-04-23
status: active
---

# Airboss finish plan

Single orchestrating plan for every open work item: the hangar initiative (the primary remaining build) plus every loose end from prior work packages and session notes. Read this first. Every subordinate doc is linked.

## Scope map

| Section                                   | What it covers                                                                                     |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [Hangar initiative](#hangar-initiative)   | Four WPs (scaffold shipped, three to go): registry, sources-v1, non-textual                        |
| [Follow-ons](#follow-ons)                 | Per-page help, drawer overlay, dark Shiki, InfoTip validator (from session-legibility-and-help-expansion) |
| [Content + manual gates](#content-and-manual-gates) | 6 features pending user-zero walkthroughs, seed cards, CFI review, graph scaling            |
| [Open debts](#open-debts)                 | Scanner parser bug, TBD wiki-links, retag ambiguities, CFR XML download blocker                    |
| [Cleanup](#cleanup)                       | 6 agent worktrees, stale branches                                                                  |

## Hangar initiative

Companion plan (decisions already locked): [20260422-hangar-data-management-plan.md](./20260422-hangar-data-management-plan.md)

## TL;DR

`apps/hangar/` is the airboss admin app. It manages source documents (fetch, upload, version, verify), it triggers the reference pipeline (scan, validate, extract, build, diff), and it edits the glossary + source registry through a DB-mirrored, TOML-backed store that commits back to git. It is multi-user day one, real job rows day one, theme-compliant day one. Four work packages, serial dependency. Scaffold shipped. Three packages to go.

## Status (2026-04-23)

| #   | Work package                                                 | State   | PR        | Unblocks                   |
| --- | ------------------------------------------------------------ | ------- | --------- | -------------------------- |
| 1   | [wp-hangar-scaffold](../../work-packages/hangar-scaffold/spec.md)         | shipped | [#72](https://github.com/joshball/airboss/pull/72) | the skeleton               |
| 2   | [wp-hangar-registry](../../work-packages/hangar-registry/spec.md)         | ready   | —         | glossary + sources editing |
| 3   | [wp-hangar-sources-v1](../../work-packages/hangar-sources-v1/spec.md)     | drafted | —         | source ops (fetch/extract) |
| 4   | [wp-hangar-non-textual](../../work-packages/hangar-non-textual/spec.md)   | drafted | —         | charts / plates / diagrams |

Serial dependency: 1 -> 2 -> 3 -> 4. Each WP has its own branch, PR, review, merge, manual walkthrough.

## Shape of hangar when it's done

One app, five route families, five DB tables, one job worker, two TOML files, three sync modes, theme-compliant throughout.

```text
apps/hangar/
  routes/
    /                  Redirect to /glossary (primary admin surface)
    /glossary          Edit glossary: list + detail + form + markdown preview
    /glossary/new      Create a new reference
    /glossary/[id]     One reference: edit + audit + sync state
    /sources           Interactive flow diagram + source table + status panel
    /sources/[id]      One source: state + actions + audit + history
    /sources/[id]/files      Filesystem browser + preview tiles
    /sources/[id]/diff       Verbatim diff view
    /sources/[id]/upload     Multipart upload form action
    /jobs              Full job history + live progress for running jobs
    /jobs/[id]         One job detail
    /login, /logout    Shipped in wp-hangar-scaffold

libs/db/seed/
  glossary.toml        175 references, hand-authored, checked in
  sources.toml         15+ sources, hand-authored, checked in

libs/aviation/
  toml-codec.ts        Round-trip Reference[] <-> TOML, Source[] <-> TOML
  registry.ts          Parses TOML on boot (replaces aviation.ts + sources/registry.ts)

libs/audit/            Shipped in wp-hangar-scaffold

Schemas (Drizzle, namespace `hangar`):
  hangar.reference     Runtime mirror of glossary.toml
  hangar.source        Runtime mirror of sources.toml
  hangar.sync_log      Every sync-to-disk: actor, files, SHA, PR URL, outcome
  hangar.job           Every action: fetch / upload / extract / build / diff /
                       validate / size-report / sync-to-disk
  hangar.job_log       Per-job streamed output (for the /jobs live view)
```

## Core architecture decisions (locked)

Every one of these comes from the companion plan; repeated here for the record.

| Axis                   | Decision                                                                                                                        | Source           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Content registry       | TOML-hybrid. `libs/db/seed/glossary.toml` + `sources.toml` authoritative. DB mirrors at runtime. Sync writes TOML + commits.    | Q1 companion     |
| Job model              | Real `hangar.job` rows day one. In-process Bun worker thread, polled by UI. No sync-with-spinner shortcut.                      | Q2 companion     |
| Registry editing       | Writeable via UI. Edits flow DB -> TOML -> commit. No TS editing required for glossary or source adds.                         | Q3 companion     |
| Multi-user             | Day one. Actor-logged audits, concurrent-safe job queue, optimistic lock on reference rev. Manual DB user seeding for MVP.      | Q8 companion     |
| Sync targets           | Local-commit in dev, `gh pr create` in prod. Env-configurable. Sync-to-disk is itself a job kind.                               | Companion §Sync  |
| Tokens + themes        | Hangar uses role tokens from `libs/themes/`. No hardcoded hex, rgb, or named colors. Lint + contrast + appearance toggle hold. | Theme invariants |
| Routes                 | Static routes are constants in `libs/constants/src/routes.ts`. Parameterised routes are typed functions. No inline path strings. | CLAUDE.md        |
| Cross-lib imports      | `@ab/*` aliases only. Intra-lib relative imports allowed.                                                                       | CLAUDE.md        |

## Required reading (in order, before touching any of the remaining WPs)

Every finishing agent MUST read these. They're the contracts the code has to satisfy.

### Plans + architecture

1. [20260422-hangar-data-management-plan.md](./20260422-hangar-data-management-plan.md) — the locked plan with all 8 decisions
2. [REFERENCE_SYSTEM_FLOW.md](../../platform/REFERENCE_SYSTEM_FLOW.md) — end-to-end flow from wiki-link to rendered glossary page
3. [20260422-reference-system-architecture.md](./20260422-reference-system-architecture.md) — schema + extraction pipeline + gates
4. [MULTI_PRODUCT_ARCHITECTURE.md](../../platform/MULTI_PRODUCT_ARCHITECTURE.md) — where hangar sits in the surface taxonomy
5. [20260422-firc-hangar-ops-survey.md](./20260422-firc-hangar-ops-survey.md) — what to port from FIRC vs leave behind

### Shipped foundation

6. [wp-hangar-scaffold spec](../../work-packages/hangar-scaffold/spec.md) + [tasks](../../work-packages/hangar-scaffold/tasks.md) — what already exists
7. `apps/hangar/` on `main` — live code. Mirror its hooks, layout guard, login flow, audit demo when building new routes.
8. `apps/study/` on `main` — the established SvelteKit pattern to match

### Theme system (load-bearing)

9. [theme-system/00-INDEX.md](../../platform/theme-system/00-INDEX.md) — five invariants + TL;DR
10. [theme-system/01-LESSONS.md](../../platform/theme-system/01-LESSONS.md) — what seven iterations taught us
11. [theme-system/02-ARCHITECTURE.md](../../platform/theme-system/02-ARCHITECTURE.md) — three-axis composition, layered tokens, registry + derivation
12. [theme-system/03-ENFORCEMENT.md](../../platform/theme-system/03-ENFORCEMENT.md) — **lint rules, contrast tests, CI gates. Hangar code has to pass all of this.**
13. [theme-system/04-VOCABULARY.md](../../platform/theme-system/04-VOCABULARY.md) — **copy role-token names from this catalog, do not re-derive.**

### Reference-system operational docs

14. `scripts/references.ts` + `scripts/references/*.ts` — the dispatcher hangar triggers from the UI. WP3 wraps these in form actions.
15. `libs/aviation/src/sources/registry.ts` — current `SOURCES[]` shape + types. WP2 migrates this to TOML.
16. `libs/aviation/src/references/aviation.ts` — current `AVIATION_REFERENCES[]` shape. WP2 migrates this to TOML.
17. `libs/aviation/src/schema/reference.ts` + `source.ts` + `tags.ts` — the Zod schemas. WP2's `toml-codec.ts` round-trips through these exactly.

### Sibling references in airboss-firc (read-only)

18. `/Users/joshua/src/_me/aviation/airboss-firc/apps/hangar/src/routes/(app)/references/` — port the CRUD pattern (not the UI tone)
19. `/Users/joshua/src/_me/aviation/airboss-firc/apps/hangar/src/routes/(app)/tasks/board/` — port the task-board pattern for `/jobs`
20. `/Users/joshua/src/_me/aviation/airboss-firc/scripts/faa-ingest/lib/download.ts` — port `downloadFile` into `libs/aviation/src/sources/download.ts`
21. `/Users/joshua/src/_me/aviation/airboss-firc/apps/hangar/src/lib/components/{DataTable,FormStack,ConfirmDialog,ValidationReport}.svelte` — port into `libs/ui/` (WP3)

## Enforcement baseline (every WP passes all of this)

Non-negotiable gates. Every WP's test plan explicitly verifies each item.

### Code gates

- `bun run check` clean (0 errors, 0 warnings)
- Biome format clean
- Every server action uses `ROUTES` from `libs/constants/`
- No `any`, no non-null assertions (`!`), no magic numbers, no magic strings
- No inline paths: `/sources/[id]` in code is `ROUTES.HANGAR.SOURCE(id)`
- Drizzle only. No raw SQL. IDs via `@ab/utils` `createId()`.
- Svelte 5 runes only. No `$:`, `export let`, `<slot>`, `$app/stores`.

### Theme gates (from [theme-system/03-ENFORCEMENT.md](../../platform/theme-system/03-ENFORCEMENT.md))

- No hardcoded hex, rgb, rgba, hsl, or CSS color names in Svelte `<style>` blocks
- All color/padding/margin/gap/font/border-radius/transition values come from tokens
- Tokens referenced by name match [04-VOCABULARY.md](../../platform/theme-system/04-VOCABULARY.md)
- Appearance toggle (light/dark) persists via cookie, no FOUC on first paint
- WCAG AA contrast holds for every (theme × appearance × role-pair) combination hangar renders

### Security gates

- Every mutating action audits via `auditWrite(...)` with actor + target + metadata
- Every route file sits behind the layout role gate (`AUTHOR | OPERATOR | ADMIN`)
- Form actions validate input with Zod before DB write
- No secrets in logs or audit payloads
- Filesystem writes happen only under `data/sources/<type>/` (plus the two TOML seeds)

### Multi-user gates

- Optimistic lock: `hangar.reference.rev` and `hangar.source.rev` incremented per write
- Job queue serialises per-target work: two fetches on the same source queue behind each other; fetches on different sources run in parallel
- `hangar.job_log` streams append-only; concurrent viewers see consistent output
- Stale-write detection: if a user edits a reference whose rev has advanced, the form shows the conflict and asks them to reload

## Work package index

Each WP is its own directory under `docs/work-packages/`.

- **[wp-hangar-registry](../../work-packages/hangar-registry/spec.md)** — the TOML-hybrid foundation: codec, migration, DB tables, edit UI, sync service, job worker. Biggest WP. Everything else depends on it.
- **[wp-hangar-sources-v1](../../work-packages/hangar-sources-v1/spec.md)** — the interactive flow diagram at `/sources` plus fetch/upload/extract/build/diff. Wraps the reference-system scripts as form actions.
- **[wp-hangar-non-textual](../../work-packages/hangar-non-textual/spec.md)** — chart, plate, diagram, NTSB, AOPA source types. Adds preview generation and binary-visual rendering.

## Build order + agent launch rules

1. Finish reading this plan + the four companion docs in one sitting. No shortcuts.
2. **wp-hangar-registry**: spawn an isolated-worktree agent with the WP's spec as the brief. Agent reads every required-reading item before writing code. Ships a PR. Review, fix, merge, manual walkthrough.
3. **wp-hangar-sources-v1**: same cycle, after #2 is green on `main`. Depends on `hangar.job` from #2.
4. **wp-hangar-non-textual**: same cycle, after #3 is green on `main` and at least one real chart or plate is on disk.

Between WPs: re-read this plan's **Enforcement baseline** to catch drift before it compounds.

## Decisions deferred (explicit)

Things the plan doesn't decide now because they're cheaper to decide after the foundation ships.

- SSE vs polling for `/jobs` live progress — default polling at 1 Hz in WP2; revisit in WP3 if the experience feels sluggish
- Presence indicator ("someone else is editing this reference") — post-MVP
- Bulk operations on the registry ("approve all pending edits") — post-MVP; the job queue supports them trivially when needed
- Public read view of the job log — not until we know who reads it
- Cron-based sync (periodic auto-sync-to-disk) — post-MVP; the job kind exists so a cron runner is a small addition

## Success criteria (whole initiative)

Checked off in this plan as the corresponding WPs ship.

- [ ] A human can visit `hangar.airboss.test`, see the interactive flow, know what the system is in 15 seconds
- [ ] They can click "Fetch" on any registered source, watch the job tick through progress, land a downloaded binary with a verified checksum
- [ ] They can drop a PDF on an upload box, see it versioned, see old versions archived
- [ ] They can edit a glossary paraphrase in the UI, click "Sync", and land a commit (or PR) with the TOML change
- [ ] They can review a verbatim diff after a yearly refresh and decide what to commit
- [ ] Two users can work simultaneously without stepping on each other's writes
- [ ] Zero hardcoded colors, zero theme invariant violations, `bun run check` clean across everything
- [ ] `bun run dev hangar` boots to a working app in under 10 seconds from cold

## Follow-ons

Open items from `session-legibility-and-help-expansion` (shipped PR #77). Each is small enough to land in its own mini-WP or as part of another stream.

| Item                                                     | Scope                                                                                    | Notes                                                      |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Per-page help for `/dashboard`, `/reps/*`, `/knowledge/*` | Adopt `<PageHelp>` pattern route-by-route                                                | Copy the wiring from `/session/start`                      |
| Drawer overlay for `<PageHelp>`                          | Today `<PageHelp>` navigates to `/help/<id>`; follow-up is a slide-over drawer           | Parked in WP spec "Drawer overlay" section                 |
| Dark-theme Shiki code-block tokens                       | Shiki currently ships one theme; swap palettes based on appearance                       | Fits into the theme-system enforcement contract            |
| `InfoTip helpId` static validator                        | Grep `.svelte` files, assert every `helpId` is registered in `helpRegistry`              | Parked at Phase 5.2 in the session-legibility tasks        |

Source: [session-legibility-and-help-expansion/spec.md](../../work-packages/session-legibility-and-help-expansion/spec.md).

## Content and manual gates

CLAUDE.md is explicit: "Nothing merges without a manual test plan." Six features merged to main without a user-zero walkthrough during the parallel-build velocity push. These run before any more feature work in the affected areas.

| Feature                          | Test plan                                                                         |
| -------------------------------- | --------------------------------------------------------------------------------- |
| Spaced Memory Items              | `docs/work-packages/spaced-memory-items/test-plan.md`                             |
| Decision Reps                    | `docs/work-packages/decision-reps/test-plan.md`                                   |
| Calibration Tracker              | `docs/work-packages/calibration-tracker/test-plan.md`                             |
| Knowledge Graph                  | `docs/work-packages/knowledge-graph/test-plan.md`                                 |
| Study Plan + Session Engine      | `docs/work-packages/study-plan-and-session-engine/test-plan.md`                   |
| Learning Dashboard               | `docs/work-packages/learning-dashboard/test-plan.md`                              |

Supporting actions:

- **Seed 12 vfr-weather-minimums cards** — run `bun run db seed cards` (or `bun run db seed` for the full pass). Cards authored in PR #15 do not flow through `/memory/review` until the seed runs once.
- **CFI-review the 27 skeleton nodes** — `references` and `mastery_criteria` defaults need accuracy before learners trust them. Skim-pass content.
- **Scale graph toward ~500 nodes (Step 7)** — author one node at a time while studying. Loop: `bun run db new <domain> <slug>` → fill phases → `bun run check` validates.

## Open debts

| Debt                                               | Impact                                                              | Resolution                                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Scanner miscounts inside TS template literals      | Wiki-link reports over-count when code blocks include backticks     | Extend `scripts/references/scan.ts` to skip fenced TS template literals, same way it skips code fences |
| 2 TBD wiki-links (`FSRS`, `discovery-first pedagogy`) | `/glossary` shows "needs link" underline on these terms          | Author reference entries in `libs/db/seed/glossary.toml` once wp-hangar-registry lands             |
| 24 entries flagged for CFI review                  | Tag accuracy uncertain on a subset of ported references             | Work through [retag-ambiguities](./20260422-retag-ambiguities.md) during a CFI review session      |
| 14 CFR XML not downloaded                          | Blocks Extract-2 (10 CFR extractions waiting on the binary)         | Unblocks the moment wp-hangar-sources-v1 ships: Fetch button downloads the XML end-to-end          |

## Cleanup

Three threads:

1. **Locked agent worktrees** — several `.claude/worktrees/agent-*` from prior parallel-build sessions are still on disk per NOW.md. Leaving them per prior direction; audit before any future cleanup pass via `/audit-worktrees`.
2. **Stale local branch `fix-dev-help`** — superseded by PR #75. Safe to delete once verified: `git log fix-dev-help ^origin/main` returns empty after #75 merged.
3. **This finish-plan worktree** — remove after the PR merges.

## Execution order (recommended)

1. Merge this finish-plan PR.
2. Ship `wp-hangar-registry` (isolated worktree agent, brief = registry spec).
3. While registry is in review: run one or two manual test passes from the Content and manual gates list. Low-risk, unblocks next content work.
4. Ship `wp-hangar-sources-v1` (serial after registry; brief = sources-v1 spec).
5. Download 14 CFR XML through the new hangar UI — unblocks extraction backlog.
6. Author `wp-hangar-non-textual` spec + tasks + test-plan when a real chart or plate is ready.
7. Slot the Follow-ons in between WPs as context allows (each is ~hours, not days).
8. Continue CFI content review + graph scaling as background work across sessions.

## Next action

Open [wp-hangar-registry spec](../../work-packages/hangar-registry/spec.md). Spawn the worktree agent with that spec as the brief.
