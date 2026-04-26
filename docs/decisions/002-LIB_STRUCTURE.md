# 002: Lib Structure and Bounded Contexts (PARTIALLY SUPERSEDED)

> **Partially superseded 2026-04-26.** The architectural rules (apps are thin routing shells, business logic in BCs, three access levels per BC: `manage` / `write` / `read`, dependency direction `constants -> types -> bc/engine -> apps`) survive the pivot and are still authoritative.
>
> The specific BC list is FIRC-flavored. Today airboss has `bc/study` (cards, reviews, scenarios, calibration, knowledge graph) -- not in the original list. Pre-pivot BCs (`bc/course`, `bc/enrollment`, `bc/evidence`, `bc/compliance`, `bc/platform`) live in airboss-firc and migrate when `apps/firc/` lands per [MULTI_PRODUCT_ARCHITECTURE.md](../platform/MULTI_PRODUCT_ARCHITECTURE.md). The `bc/compliance` BC is dormant per [ADR 017](017-firc-compliance-dormant.md).
>
> **What's still authoritative:** lib categories (Infrastructure / Domain / Presentation / Shared), three-access-level pattern, dependency direction, "auth and audit are not BCs" rationale.
>
> **What's stale:** the specific BC list and feature responsibilities below.

Decided 2026-03-25.

## Context

Apps are thin routing shells. All business logic, data access, components, and design live in shared libs. We need to define what libs exist, how bounded contexts are structured, and how access control works.

## Decision

### Lib Categories

| Category       | Libs                                                                        | Purpose                                              |
| -------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| Infrastructure | `auth`, `audit`                                                             | Cross-cutting services. Same interface for all apps. |
| Domain (BCs)   | `bc/course`, `bc/enrollment`, `bc/evidence`, `bc/compliance`, `bc/platform` | Rich domain logic. Consumer-specific access levels.  |
| Presentation   | `themes`, `ui`                                                              | Visual layer. Design system, components, layouts.    |
| Shared         | `constants`, `types`, `engine`                                              | Foundation everything depends on.                    |

### Directory Structure

```
libs/
  auth/               Identity, sessions, permissions
  audit/              Action logging, content versioning
  bc/
    course/           Curriculum + content authoring. course/read serves published content to sim.
    enrollment/       Learner progress + completion
    evidence/         Scenario runs, scores, proof of learning
    compliance/       FAA traceability, submissions, regulatory state
    platform/         Tasks, boards (hangar internal)
  constants/          Routes, ports, enums, config
  types/              Shared types, Zod schemas
  engine/             Tick engine, scoring, student models
  themes/             Design tokens, theme definitions
  ui/                 Svelte components, layout shells
```

### Why auth and audit are not BCs

Auth and audit are infrastructure, not domain logic. They don't model a business concept with rich rules, different consumer views, or domain-specific language. Every app uses them the same way. No manage/write/read split needed.

## BC Access Pattern

Three access levels, consistent naming everywhere:

| Level        | Name     | Meaning                         |
| ------------ | -------- | ------------------------------- |
| Full control | `manage` | Read, write, delete, administer |
| Scoped write | `write`  | Read + write within constraints |
| Read only    | `read`   | Query, no mutations             |

### Access Matrix

| BC         | `manage` | `write` | `read`      |
| ---------- | -------- | ------- | ----------- |
| course     | hangar   | --      | sim, runway |
| enrollment | ops      | sim     | --          |
| evidence   | ops      | sim     | hangar      |
| compliance | hangar   | --      | ops         |
| platform   | hangar   | --      | --          |

**Note:** `bc/course/read` resolves to the `published` schema at the database level, not `course`. Sim and runway never read raw authoring data. See [ADR 004](004-DATABASE_NAMESPACES.md) and [ADR 005](005-PUBLISHED_CONTENT.md).

### Import Pattern

```typescript
// hangar authoring a scenario
import { createScenario } from "@firc/bc/course/manage";

// sim reading published content
import { getPublishedScenarios } from "@firc/bc/course/read";

// sim recording a scenario run
import { recordScenarioRun } from "@firc/bc/evidence/write";

// ops pulling completion reports
import { getCompletionReport } from "@firc/bc/evidence/manage";
```

If `@firc/bc/course/manage` appears in the sim app, that's a red flag in review.

### Auth Lib Structure

```
libs/auth/src/
  schema.ts        Users, sessions, accounts, roles
  auth.ts          Sign in/out, sessions, guards (all apps)
  accounts.ts      User management, role assignment (ops-only functions, clearly scoped)
```

Note: `accounts.ts` contains ops-only functions. While all apps can technically import it, the access matrix above makes the boundary clear. Enforcement is via review convention and TS path aliases (see Enforcement below).

### Audit Lib Structure

```
libs/audit/src/
  schema.ts        Log entries, content versions
  log.ts           logAction() (all apps write)
  query.ts         queryLog() (ops reads, hangar reads content version history)
```

### Engine Lib Role

Engine is a **pure computation library** -- it takes inputs (scenario state, student model parameters, instructor actions) and returns outputs (new state, scores, events). It has no database access and no domain awareness.

BCs persist engine results: `bc/evidence/write` stores scenario run outcomes, `bc/enrollment/write` updates progress. Engine never calls BCs directly.

```
sim form action:
  1. Load published content via bc/course/read
  2. Run tick via engine (pure computation)
  3. Store results via bc/evidence/write
  4. Update progress via bc/enrollment/write
```

### Enforcement

BC access levels are enforced structurally:

1. **File-level separation** -- each BC exports `manage.ts`, `write.ts`, and/or `read.ts` as separate modules. The access level is the file, not a runtime check.
2. **Code review convention** -- seeing `import { manage } from '@firc/bc/course'` in sim is a red flag. The access matrix makes violations obvious.
3. **Future: eslint import restrictions** -- `eslint-plugin-import` rules to enforce per-app access. Added when the team grows beyond one developer.

TS path aliases use wildcards (`@firc/bc/course/*`) intentionally -- the structural enforcement is at the module level, not the alias level. Restricting aliases per-file would be brittle.

## Thin Apps Rule

Apps contain only:

- Route definitions (`+page.svelte`, `+page.server.ts`, `+layout.svelte`)
- Form actions that call into lib functions
- Data loading that calls into lib functions
- Layout assembly (handing data to theme-driven layouts)

Apps do NOT contain:

- Business logic (-> libs/bc/)
- Components (-> libs/ui/)
- Styling beyond layout flow (-> libs/themes/)
- Database queries (-> libs/bc/ or libs/auth/ or libs/audit/)
- Type definitions (-> libs/types/)
- Constants (-> libs/constants/)

Rule: **if you're writing business logic, a component, or styling in an `apps/` directory -- stop and put it in a lib.**
