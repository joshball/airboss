---
id: hangar-content-census
title: Hangar Content Census -- Tasks
product: hangar
category: feature
status: draft
created: 2026-05-17
owner: agent
legacy_fields:
  feature: hangar-content-census
  type: tasks
  review_status: pending
---

# Hangar Content Census -- Tasks

Read [spec.md](spec.md) + [design.md](design.md) first.

## Phase 1 -- Vision + reference drill-down (first PR)

### Lib

- [x] `libs/content-census/` scaffold -- `package.json`, runtime barrel + `/server` barrel
- [x] `src/types.ts` -- `CorpusCensus`, `CensusItem`, `CensusMetric`, `CensusGap`, `ContentIntent` (browser-safe)
- [x] `src/registry.ts` -- the adapter registry; lists all 14 corpus ids
- [x] `src/adapters/wx-catalog.server.ts` -- the FULL reference adapter (inventory + derived state + explained metrics + gap view + next)
- [x] `src/adapters/_stub.server.ts` -- the honest "drill-down pending" placeholder adapter for the other 13
- [x] Unit tests: wx-catalog adapter counts match `catalog.json` / `scenario-matches.json`; explanatory-rule guard (every metric/gap has non-empty what/why)

### Routes

- [x] `ROUTES.CONTENT_CENSUS` + `ROUTES.CONTENT_CENSUS_CORPUS(id)` in `libs/constants/src/routes.ts`
- [x] `apps/hangar/src/routes/(app)/content/+page.server.ts` + `+page.svelte` -- the overview census
- [x] `apps/hangar/src/routes/(app)/content/[corpus]/+page.server.ts` + `+page.svelte` -- the generic drill-down
- [x] Intro prose on `/content`; overview prose on the drill-down (what/why/links)
- [x] Cross-link to/from the platform dashboard -- linked to/from `/roadmap` (the shipped process-metadata dashboard; the `hangar-platform-dashboard` `/platform` route the spec names does not exist in the repo, so `/roadmap` is the correct sibling).

### ADR

- [x] Author the "Content-intent frontmatter" ADR -- `content_status` + `intent` block schema, per-corpus rollout order, lint-guard design. Status `proposed`, ready for human approval. Shipped as ADR 028.

### Verify

- [x] `bun run check` clean
- [x] e2e smoke: `/content` (14 rows), `/content/wx-catalog` (inventory + gap view + explanation text)
- [ ] Manual: reader-with-no-context can explain the wx-catalog numbers (dispatcher / user verifies in a real browser before merge)

## Phase 2 -- Breadth pass (real Layer-1 adapter for all 13 remaining corpora)

One sub-task per corpus -- each is a real derived-state adapter (inventory + states +
explained metrics); gap/intent/next may stay honest placeholders.

- [ ] Knowledge nodes adapter
- [ ] Cards adapter
- [ ] wx-engine scenarios adapter
- [ ] Regulations course adapter
- [ ] Handbooks adapter
- [ ] ACS adapter
- [ ] Source registry adapter
- [ ] Help library + glossary adapter
- [ ] Vision / PRD adapter
- [ ] Work packages adapter (links to `/platform`, does not re-render)
- [ ] ADR adapter (links to `/platform`)
- [ ] wx charts / symbology adapter
- [ ] Sim scenarios / models adapter
- [ ] `bun run track content` -- the same census in the terminal

## Phase 3 -- Depth, per corpus (Layer 2 + real gap/next)

Each corpus, one at a time. Per corpus: author its content-intent frontmatter,
build its real gap view + next-list. Order by value:

- [ ] Knowledge nodes -- intent frontmatter + gap view + next
- [ ] Cards -- intent + gap + next
- [ ] Encoded-text catalog -- close the catalog's own intent (already has the richest gap view from Phase 1)
- [ ] wx scenarios -- intent + the AIRMET-emitter + temporal-scenario gaps as real next-items
- [ ] Handbooks -- ingestion-completeness intent
- [ ] Regulations course -- modality-completeness intent
- [ ] ... remaining corpora

Phase 3 sub-phases are individually shippable. New WPs may be split off when a
corpus's depth work is large enough to earn its own.

## Known follow-ups surfaced by this WP (tracked, not lost)

These came out of the 2026-05-16 wx-catalog work and belong on a corpus's next-list:

- [ ] wx-engine AIRMET text emitter (so AIRMET/SIGMET examples can match the catalog)
- [ ] Author `frontal-pressure-march` products into the catalog (temporal scenario contributes 0)
- [ ] Engine features for ~44 uncovered token families (`+FC`, `VA`, `SQ`, `WS`, `BECMG`, ...)
