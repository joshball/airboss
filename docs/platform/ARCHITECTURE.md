# Architecture

A regulated, adaptive decision-training platform for flight instructor certification renewal. Four apps, shared libraries, one monorepo.

## Apps

| App        | Name     | Port | Purpose                                                 | SSR |
| ---------- | -------- | ---- | ------------------------------------------------------- | --- |
| Training   | `sim`    | 7600 | Run scenarios, track progress, assessments              | No  |
| Authoring  | `hangar` | 7610 | Build content, manage curriculum, FAA compliance, tasks | No  |
| Operations | `ops`    | 7620 | Users, certificates, fraud, analytics, FAA records      | No  |
| Public     | `runway` | 7640 | Marketing, signup, payments, course catalog             | Yes |

Details: [001-APP_BOUNDARIES.md](../decisions/001-APP_BOUNDARIES.md)

## Libs

| Category       | Libs                                                                        | Purpose                            |
| -------------- | --------------------------------------------------------------------------- | ---------------------------------- |
| Infrastructure | `auth`, `audit`                                                             | Cross-cutting services             |
| Domain (BCs)   | `bc/course`, `bc/enrollment`, `bc/evidence`, `bc/compliance`, `bc/platform` | Business logic with access control |
| Presentation   | `themes`, `ui`                                                              | Design system, components, layouts |
| Shared         | `constants`, `types`, `db`, `engine`                                        | Foundation                         |

Apps are thin routing shells -- routes, form actions, data loading, layout assembly only. All business logic in libs. BCs export three access levels (manage/write/read) consumed by specific apps. Dependencies flow one way: constants -> types -> bc/engine -> apps.

Engine is a pure computation lib (no DB access). It takes inputs, returns outputs. BCs persist results.

Details: [002-LIB_STRUCTURE.md](../decisions/002-LIB_STRUCTURE.md)

## Database

One PostgreSQL instance. Namespaced schemas:

| Schema       | Owner         | Purpose                       |
| ------------ | ------------- | ----------------------------- |
| `course`     | hangar        | Curriculum, authored content  |
| `published`  | hangar -> sim | Lean read-only snapshots      |
| `enrollment` | ops / sim     | Progress, completion          |
| `evidence`   | sim -> ops    | Scenario runs, scores         |
| `compliance` | hangar        | FAA traceability, submissions |
| `identity`   | auth lib      | Users, sessions               |
| `audit`      | audit lib     | Action logs                   |
| `platform`   | hangar        | Tasks, boards                 |

Details: [004-DATABASE_NAMESPACES.md](../decisions/004-DATABASE_NAMESPACES.md)

## Design System

Two libs: `themes` (token contract + implementations) and `ui` (components + layouts).

- Themes control layout via CSS tokens, not theme-specific components
- Pages are routes, not layouts -- they hand data to theme-driven layout shells
- All colors OKLCH, 8 font roles by purpose, semantic color groups
- Zero styles in app route files

Details: [003-DESIGN_SYSTEM.md](../decisions/003-DESIGN_SYSTEM.md)

## Content Publishing

Separate `published.*` schema with lean, versioned snapshots. All published releases retained (keyed by `release_id`), not just the latest. Hangar publishes atomically, sim reads with release filter. Sim never sees drafts. Always roll forward, never unpublish.

Details: [005-PUBLISHED_CONTENT.md](../decisions/005-PUBLISHED_CONTENT.md)

## Versioning

Two-tier: content versions (granular, per-edit) and release versions (semver, curated snapshots). FAA approval tracked as independent axis per-change. Patches available mid-lesson, structural changes per-module based on student progress. Never auto-upgrade into unapproved content.

Details: [006-CONTENT_VERSIONING.md](../decisions/006-CONTENT_VERSIONING.md)

## Auth

Shared session via HTTP-only cookie on common domain (`*.fircboss.com`). One auth lib, one session table. Role-based app access (learner, author, operator, admin).

Details: [007-AUTH_TOPOLOGY.md](../decisions/007-AUTH_TOPOLOGY.md)

## Monorepo Structure

```text
apps/
  sim/            SvelteKit :7600
  hangar/         SvelteKit :7610
  ops/            SvelteKit :7620
  runway/         SvelteKit :7640
libs/
  auth/           Identity, sessions, permissions
  audit/          Action logging, content versions
  bc/
    course/       Curriculum + content (manage, write, read). read = published schema.
    enrollment/   Progress + completion (manage, write)
    evidence/     Runs + scores (manage, write, read)
    compliance/   FAA state (manage, read)
    platform/     Tasks, boards (manage: hangar only)
  constants/      Routes, ports, enums
  db/             Shared Drizzle connection
  types/          Shared types, Zod schemas
  engine/         Tick engine, scoring, student models
  themes/         Token contract, theme implementations
  ui/             Components, layout shells
docs/
  platform/       Architecture, vision, engine spec
  firc/           Course definition, TCO, FAA docs
  products/       Per-app docs (sim/, hangar/, ops/, runway/)
  decisions/      Architecture Decision Records
  agents/         Agent instructions, workflow
  devops/         Deployment, infrastructure
  work/           Session todos, plans, research
```

## Tech Stack

- **Runtime:** Bun
- **Framework:** SvelteKit + Svelte 5 (runes only)
- **Database:** PostgreSQL + Drizzle ORM (OrbStack local)
- **Styling:** CSS custom properties via theme tokens (OKLCH)
- **Formatting:** Biome
- **Testing:** Vitest (unit) + Playwright (e2e)

## Inter-App Communication

No direct app-to-app calls. Cross-boundary workflows use shared database + BC libs. If a workflow can't be "write to DB, other app reads later," the boundary is wrong. See [ADR 001](../decisions/001-APP_BOUNDARIES.md#inter-app-communication).

## Key Decisions Index

| #   | Decision                                                      | Doc                                            |
| --- | ------------------------------------------------------------- | ---------------------------------------------- |
| 001 | App boundaries, inter-app communication, learner self-service | [001](../decisions/001-APP_BOUNDARIES.md)      |
| 002 | Lib structure, bounded contexts, access matrix, enforcement   | [002](../decisions/002-LIB_STRUCTURE.md)       |
| 003 | Design system (two libs, layout tokens, naming convention)    | [003](../decisions/003-DESIGN_SYSTEM.md)       |
| 004 | Database namespaces and access matrix                         | [004](../decisions/004-DATABASE_NAMESPACES.md) |
| 005 | Published content model (versioned, atomic publish)           | [005](../decisions/005-PUBLISHED_CONTENT.md)   |
| 006 | Content versioning, releases, multi-version serving           | [006](../decisions/006-CONTENT_VERSIONING.md)  |
| 007 | Auth topology (shared session, subdomains, roles)             | [007](../decisions/007-AUTH_TOPOLOGY.md)       |

## Platform Docs

| Doc                                                | Purpose                                                                                |
| -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [DESIGN_PRINCIPLES.md](DESIGN_PRINCIPLES.md)       | Core beliefs that shape every feature (debrief culture, two systems, emotional safety) |
| [SCENARIO_ENGINE_SPEC.md](SCENARIO_ENGINE_SPEC.md) | Tick engine, student behavior model, scoring, spaced repetition, evidence              |
| [VOCABULARY.md](VOCABULARY.md)                     | Aviation terminology bank for naming features and UI elements                          |
| [IDEAS.md](IDEAS.md)                               | Idea intake and review tracking                                                        |
| [ROADMAP.md](ROADMAP.md)                           | Platform-level sequencing (Phase 0-6)                                                  |
