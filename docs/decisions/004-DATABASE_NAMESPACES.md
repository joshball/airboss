# 004: Database Namespaces (PARTIALLY SUPERSEDED)

> **Partially superseded 2026-04-26.** The schema namespacing decision (PostgreSQL schemas via `pgSchema()`) survives the pivot. The schema list and access matrix below reference the four-app FIRC stack (sim/hangar/ops/runway) -- per [ADR 001 (superseded)](001-APP_BOUNDARIES.md) and [PIVOT.md](../platform/PIVOT.md), `ops` is gone (folded into hangar) and the post-pivot apps are study, sim, hangar plus future surfaces.
>
> Today the live schemas are `study`, `audit`, `identity`, `hangar`, `published`, `sim` (see `libs/db/src/`, `libs/auth/src/schema.ts`). The `compliance` schema is dormant per [ADR 017](017-firc-compliance-dormant.md) but the namespacing rule it followed still applies. The access-control philosophy (BC-mediated `manage` / `write` / `read`) survives unchanged from [ADR 002](002-LIB_STRUCTURE.md).
>
> **What's still authoritative below:** the "Why Namespaces Over Prefixes" rationale, the cross-schema query patterns, the migration approach.
>
> **What's stale below:** the schema list (sim and study schemas were added; some compliance/platform schemas are dormant) and the per-app access matrix.

Decided 2026-03-25.

## Context

One PostgreSQL instance, one database. Multiple apps access different data. We need logical separation without separate databases.

## Decision

PostgreSQL schemas (namespaces) for domain isolation. Drizzle supports this with `pgSchema()`.

### Schemas

| Schema       | Contains                                                          | Primary owner                    |
| ------------ | ----------------------------------------------------------------- | -------------------------------- |
| `course`     | Curriculum structure, authored content, student models, questions | hangar                           |
| `published`  | Lean read-only snapshots of published content                     | hangar writes, sim reads         |
| `enrollment` | Learner progress, time logs, completion, certificates             | ops manages, sim writes progress |
| `evidence`   | Scenario runs, scores, evidence packets                           | sim writes, ops reads            |
| `compliance` | Traceability data, FAA submissions, regulatory checks             | hangar                           |
| `identity`   | Users, sessions, accounts, roles                                  | auth lib                         |
| `audit`      | Action logs, content version history                              | audit lib                        |
| `platform`   | Tasks, boards (hangar internal)                                   | hangar                           |

### Access by App

Uses the same vocabulary as ADR 002's BC access pattern: `manage` (full control), `write` (scoped mutations + read), `read` (query only).

| Schema       | hangar           | sim                  | ops        | runway                   |
| ------------ | ---------------- | -------------------- | ---------- | ------------------------ |
| `course`     | manage           | --                   | --         | --                       |
| `published`  | manage (publish) | read                 | --         | read (catalog)           |
| `enrollment` | --               | write (own progress) | manage     | --                       |
| `evidence`   | read             | write                | manage     | --                       |
| `compliance` | manage           | --                   | read       | --                       |
| `identity`   | write (profile)  | write (sessions)     | manage     | write (signup, sessions) |
| `audit`      | write            | write                | read/write | write                    |
| `platform`   | manage           | --                   | --         | --                       |

**Notes:**

- `bc/course/read` (used by sim and runway) resolves to the `published` schema, not `course`. Sim and runway never access raw authoring data.
- Ops has read access to `audit` for compliance investigations and FAA record keeping.
- Identity write access is scoped per app: runway creates accounts, sim refreshes sessions, hangar updates profiles, ops manages all users.

### Why Namespaces Over Prefixes

- Real isolation: can grant per-schema permissions at DB level
- SQL reads naturally: `course.scenario`, `enrollment.progress`
- Clean migration path: a schema can become its own database later
- No prefix typos or inconsistencies
