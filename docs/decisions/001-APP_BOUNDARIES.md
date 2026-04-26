# 001: App Boundaries (SUPERSEDED)

> **Superseded 2026-04-26.** This ADR defined the four-app FIRC stack (sim/hangar/ops/runway) under `*.fircboss.com`. Per [PIVOT.md](../platform/PIVOT.md), airboss is surface-typed (study, sim, hangar, plus future spatial/audio/reflect/avionics/firc/runway), the `ops` app is gone (folded into hangar), and the FIRC-specific app responsibilities below no longer match.
>
> **Current source of truth:** [docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](../platform/MULTI_PRODUCT_ARCHITECTURE.md). The "Inter-App Communication" rule (shared DB + BC libs, no app-to-app calls, no event bus) and the "no separate API server" rule survive the pivot. The app list and the FAA-flavored responsibilities don't.
>
> Kept for historical context only.

Decided 2026-03-25.

## Context

We need to define what apps exist, what each one does, and what it doesn't do.

## Decision

Four SvelteKit apps, no separate API server.

| App         | Internal name | Port | Purpose                                                            | Auth                | SSR       |
| ----------- | ------------- | ---- | ------------------------------------------------------------------ | ------------------- | --------- |
| Training    | **sim**       | 7600 | Run scenarios, track progress, assessments                         | Authenticated       | No        |
| Authoring   | **hangar**    | 7610 | Build content, manage curriculum, FAA compliance, product tracking | Authenticated       | No        |
| Operations  | **ops**       | 7620 | User management, certificates, fraud, analytics, FAA records       | Authenticated       | No        |
| Public site | **runway**    | 7640 | Marketing, signup, payments, course catalog                        | Public + auth flows | Yes (SEO) |

## Rationale

- **No separate API app.** Each SvelteKit app handles its own server-side logic via form actions and `+server.ts` routes. Business logic lives in `libs/`, not in any app. A separate API would just be a proxy layer.
- **Separate apps, not one monolith.** Prevents implementation leaks across boundaries. Apps can be deployed independently when needed.
- **SSR only for runway.** The other three apps are fully authenticated -- no public pages, no SEO. Disabling SSR eliminates hydration mismatch bugs.

## App Responsibilities

### sim

- Scenario execution (tick engine, intervention, debrief, replay)
- Discovery phase (profile building)
- Progress tracking, mastery state
- Spaced repetition, adaptive scheduling
- Knowledge checks
- Time tracking (FAA-qualified vs exploratory)
- Certificate display
- Does NOT manage users, author content, or track compliance

### hangar

- Scenario authoring (tick scripts, student models, environments)
- Module/curriculum structure editing
- Competency registry management
- Question bank management
- Content workflow (draft -> publish)
- Content versioning with audit trail
- Traceability matrix editing
- FAA package generation
- Task boards and product tracking
- Does NOT serve the course to learners or manage user accounts

### ops

- User account management
- Enrollment management
- Certificate issuance (graduation vs completion)
- FAA record keeping (24-month retention)
- Fraud detection
- Analytics (completion rates, struggle points)
- Does NOT author content or run scenarios

### runway

- Marketing and information pages
- Account creation / signup
- Payment processing
- Course catalog
- SEO-optimized public content
- Does NOT require authentication for browsing (auth for signup/payment)

## Inter-App Communication

All apps share one database. No direct app-to-app calls, no event bus, no message queue.

Cross-boundary workflows use **shared database + BC libs**:

| Flow                            | How it works                                                                                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Signup -> enrollment            | Runway creates account via auth lib. Ops (or background job) creates enrollment via `bc/enrollment/manage`.                               |
| Publish -> availability         | Hangar writes to `published` schema via `bc/course/manage`. Sim reads on next session start via `bc/course/read`. No notification needed. |
| Scenario completion -> evidence | Sim writes run via `bc/evidence/write` and updates progress via `bc/enrollment/write`. Ops reads via `bc/evidence/manage`.                |
| Certificate issuance -> display | Ops issues via `bc/enrollment/manage`. Sim reads completion status via `bc/enrollment/write` (own progress includes read).                |

If a workflow can't be expressed as "write to shared DB, other app reads later," that's a signal the boundary is wrong.

## Learner Self-Service

Learner account management lives in **sim** (not ops, not runway):

- Profile viewing and editing (sim reads/writes via auth lib)
- Password/email changes (sim calls auth lib)
- Certificate viewing and download (sim reads via `bc/enrollment/write` -- own data)
- Course progress and history (sim reads via `bc/enrollment/write` -- own data)

Sim "does not manage users" means it doesn't manage _other_ users. A learner managing their own account is self-service, not user management.

## Auth Topology

All apps share a session via cookie on a common domain (e.g., `*.fircboss.com`). One auth lib, one session table, one cookie. See [ADR 007](007-AUTH_TOPOLOGY.md).

## Deployment

Separate apps, shared database. Can deploy to one machine (multiple processes) or separate machines. Decision deferred -- see `docs/devops/DEPLOYMENT_OPTIONS.md`.
