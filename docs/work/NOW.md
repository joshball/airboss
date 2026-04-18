# Now

Single entry point for "what should I work on?" across both tracks.

## Platform Track

**Completed:** Phase 0 (Platform), Phase 1 (Hangar), Phase 2 (Sim Core), Phase 3 (Ops Foundation), Phase 4a (Runway Foundation), Phase 5 (Hangar Compliance + Versioning)

**Recently shipped:**

- Aviation glossary system (74 entries, sidebar page, search, tooltips, `GlossaryText` runtime processor)
- FAA ingest pipeline (`bun run faa all` -- fetch, extract, glossary, index, pcg, pages, seed-glossary)
- FAA search API + UI (`/faa-reference` in sim, `/api/faa-search`)
- FAA reference pages (Parts 1, 61, 91, 141 browsable in hangar docs)

**In progress:**

- Glossary seed review -- 292 draft entries from FAA Part 1 need agent review and integration
- Remaining glossary tasks -- Vite plugin (`[[id]]` build-time), scanner CLI, other app routes

**Next:** Pick one:

- Phase 4b -- Payment Integration (Stripe, webhooks, receipts) -- [runway ROADMAP](../products/runway/ROADMAP.md#phase-4b----payment-integration-future)
- Phase 6 -- Polish, Analytics, Advanced Features -- [platform ROADMAP](../platform/ROADMAP.md)

## Curriculum Track

**Completed:** C0 (Course Design), C1 (43+ Scenario Scripts), C2 (Question Bank), C3 (Content Entry -- all seeded)
**Deferred:** C4 -- FAA Package (deferred per [platform pivot](../platform/PIVOT.md))
**Active phase:** C1.5 -- Module Design Docs

**Module 1 design complete:**

- L03 objectives (21 learning objectives with scenario traceability)
- L04 lesson flow (3 lessons, 165 min, adaptive scenario selection)
- L04 landscape (territory map, 13 candidate scenarios, coverage analysis)

**Module 1 design complete. Modules 2-6 need the same treatment:**

- Cross-module design philosophy written -- [COURSE_DESIGN.md](../../course/L04-Design/COURSE_DESIGN.md)
- Per-module task specs with research pointers in COURSE_DESIGN.md and [ROADMAP.md](../../course/L04-Design/ROADMAP.md)
- Each module needs: objectives, lesson flow, landscape (15 documents total)

**Roadmap:** [course/L04-Design/ROADMAP.md](../../course/L04-Design/ROADMAP.md)

## Business

- [Market Research](../business/MARKET_RESEARCH.md) -- CFI population, competitor pricing, revenue scenarios, chief instructor requirements
- **Blocker:** Need a chief instructor meeting 14 CFR SS 141.35(d) before FAA submission. See [MARKET_RESEARCH.md](../business/MARKET_RESEARCH.md#chief-instructor-requirement).
- **Recommended:** Pre-submission inquiry to FAA (`9-AWA-AVS-AFS-FIRC@faa.gov`) before writing all content. See AC 61-83K SS 12.1.

## Open Plans

- [DOC-CLEANUP-PLAN.md](plans/20260325-DOC-CLEANUP-PLAN.md) -- Phases 1-3 done, Phase 4 partially done (D6 decision blocking), Phases 5-6 open
- [APP-THEME-PLAN.md](plans/20260327-APP-THEME-PLAN.md) -- theme family rollout, not started
- [PDF-GENERATION.md](plans/20260328-PDF-GENERATION.md) -- certificate PDF generation, deferred from Phase 3

## Links

- Platform roadmap: [docs/platform/ROADMAP.md](../platform/ROADMAP.md)
- Curriculum roadmap: [course/L04-Design/ROADMAP.md](../../course/L04-Design/ROADMAP.md)
- Business docs: [docs/business/](../business/README.md)
- Hangar tasks: [docs/products/hangar/TASKS.md](../products/hangar/TASKS.md)
- Sim tasks: [docs/products/sim/TASKS.md](../products/sim/TASKS.md)
- Ops tasks: [docs/products/ops/TASKS.md](../products/ops/TASKS.md)
- Runway tasks: [docs/products/runway/TASKS.md](../products/runway/TASKS.md)
