# Platform Roadmap

What gets built, in what order. Platform work unblocks app work. App roadmaps ([hangar](../products/hangar/ROADMAP.md), sim, ops, runway) handle feature-level detail.

## Current Work

**Phases 0-5 complete.** No active phase.

Next phase -- pick one:

- **Phase 4b -- Payment Integration** (Stripe, webhooks, receipts)
- **Phase 6 -- Polish, Analytics, Advanced Features**

Open cleanup: [DOC-CLEANUP-PLAN.md](../work/plans/20260325-DOC-CLEANUP-PLAN.md)

## Maintenance

After completing any task:

- Check off the item in the relevant `TASKS.md` Active section
- Update session `TODO.md`
- If a cleanup item is resolved, mark it in `DOC-CLEANUP-PLAN.md`

After completing a phase:

- Mark phase header `[DONE]` in this file
- Update `## Current Work` pointer above to the next phase
- Update `TASKS.md` for the newly active app (move items from Up Next to Active)

## Phase 0 -- Platform Foundation `[DONE]`

Cross-cutting infrastructure that all apps depend on. Must be done before any app feature work.

| Task                                                                    | Depends on      | Status                                                                                   |
| ----------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------- |
| Restructure libs to match ADR 002 (bc/, audit, ui, platform)            | --              | Done                                                                                     |
| Set up TS path aliases for BC access enforcement per app                | Lib restructure | Done (root tsconfig; per-access-level aliases not enforced -- review convention instead) |
| Database schema: all 8 namespaces in Drizzle (`pgSchema()`)             | Lib restructure | Done                                                                                     |
| Auth lib: sessions, guards, accounts (better-auth + Drizzle)            | DB schema       | Done                                                                                     |
| Audit lib: action logging, content version tracking                     | DB schema       | Done                                                                                     |
| Design system: base theme tokens (aviation + glass-cockpit, light/dark) | --              | Done                                                                                     |
| UI lib: layout shells, basic components                                 | Theme tokens    | Done (30 components)                                                                     |
| Seed data: competencies, FAA topics, modules                            | DB schema       | Done (`scripts/db/seed.ts`)                                                              |

**Exit criteria:** `bun run check` passes. All 4 apps start. Auth works. One theme renders. BC imports enforced by TS config.

**Status:** Phase 0 complete.

## Phase 1 -- Hangar Foundation `[DONE]`

First real app. Content authoring drives the schema and validates the architecture.

See [hangar ROADMAP Phase 1](../products/hangar/ROADMAP.md#phase-1----foundation) and [hangar TASKS](../products/hangar/TASKS.md).

- [x] Hangar app shell (nav, routes, auth)
- [x] Content CRUD (scenarios, modules, competencies, questions, micro-lessons, student models)
- [x] Task board (kanban, drag-and-drop, filters)
- [x] Content publishing (atomic publish action, release creation, published content viewer)

**Exit criteria:** Can author a complete scenario, assign to module, link competencies, publish to `published` schema. Sim can read it.

## Phase 2 -- Sim Core `[DONE]`

Learner-facing course execution. Depends on published content from hangar.

See [sim TASKS](../products/sim/TASKS.md) and [sim features/PHASE2.md](../products/sim/features/PHASE2.md).

- [x] Sim app shell (nav, routes, auth, learner self-service)
- [x] Discovery phase (profile building, soft knowledge probing)
- [x] Scenario player (tick engine integration, intervention ladder UI)
- [x] Debrief (post-scenario review, tape replay)
- [x] Progress tracking (module completion, time logging)
- [x] Knowledge checks (question rendering, scoring)

**Exit criteria:** A learner can log in, complete discovery, play a published scenario, see a debrief, and track progress. FAA time tracking works.

## Phase 3 -- Ops Foundation `[DONE]`

Operations and compliance. Depends on enrollment and evidence data from sim.

Archived post-pivot: see [ops ARCHIVED.md](../.archive/products/ops/ARCHIVED.md) for context, and the original [ops TASKS](../.archive/products/ops/TASKS.md) and [ops features/PHASE3.md](../.archive/products/ops/features/PHASE3.md). The `ops` app does not exist post-pivot; admin / operations responsibilities will be picked up by `hangar` and per-surface admin views as needed.

- [x] Ops app shell
- [x] User management (accounts, roles, enrollment)
- [x] Enrollment management (create, view, status changes)
- [x] Learner progress view
- [x] Certificate issuance (graduation vs completion)
- [x] FAA record keeping (24-month retention, evidence packets)
- [x] Analytics dashboards (completion rates, struggle points)

**Exit criteria:** An operator can manage users, view learner progress, issue certificates, and pull FAA records.

## Phase 4a -- Runway Foundation `[DONE]`

Public-facing site. See [runway ROADMAP](../products/runway/ROADMAP.md) and [Phase 4 plan](../work/plans/20260329-PHASE4-RUNWAY-PLAN.md).

- [x] Runway app shell (SSR, SEO, auth, route groups)
- [x] Marketing pages (landing, about, pricing)
- [x] Course catalog (reads from `published` schema)
- [x] Signup flow (account creation, self-registration)
- [x] Payment stub (mock with 12 configurable failure scenarios)
- [x] Enrollment creation (post-payment)

**Exit criteria:** A visitor can browse the catalog, sign up, pay (stubbed), and be enrolled. Redirects to sim.

**Note:** Real payment integration deferred to Phase 4b.

## Phase 5 -- Hangar Compliance + Versioning `[DONE]`

Back to hangar for the compliance pipeline. See [hangar ROADMAP Phases 2-4](../products/hangar/ROADMAP.md).

- [x] Content validation engine (10 declarative rules, publish gate)
- [x] Traceability matrix editor (13-row interactive, auto-populate, live validation)
- [x] Content versioning (5-state workflow, version history, rollback)
- [x] TCO editor (structured form)
- [x] FAA package generator (validation + traceability + TCO + assessment)
- [x] Compliance dashboard (single-view compliance status)
- [x] Submission tracker (6-state FAA submission workflow)

**Exit criteria:** Full content lifecycle. FAA submission package generation. Version traceability.

## Phase 6 -- Polish, Analytics, Advanced Features `[NOT STARTED]`

- Hangar analytics (coverage, question stats, time projection)
- Hangar reference library + regulatory monitoring
- Sim adaptive engine (spaced repetition, difficulty adjustment)
- Sim game modes (free play, drill mode)
- Cross-app analytics
- Deployment hardening

## Sequencing Principles

- **Platform before apps.** Lib structure, schema, auth, and theme must exist before feature work.
- **Hangar before sim.** You need content before you can play it.
- **One app at a time.** Complete the foundation of each app before starting the next. Exception: runway can overlap with sim/ops since it's mostly independent.
- **Schema validates architecture.** Writing Drizzle schema for all 8 namespaces is the first real test of the ADRs.
