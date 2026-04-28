---
status: deferred
trigger: next review of the citations surface, OR when a third BC needs cross-cutting reference reads
source: 2026-04-27 architecture review
---

# Decide: own `libs/bc/citations` or fold into `bc-study`

## Problem

`libs/bc/citations/src/citations.ts` imports raw Drizzle table objects from `@ab/bc-study` (`card`, `knowledgeNode`, `scenario`) to verify ownership. `libs/bc/citations/src/schema.ts` redeclares `pgSchema(SCHEMAS.STUDY)` rather than importing `studySchema` from `@ab/bc-study`. The `content_citations` table itself lives under the `study` Postgres schema. Result: "separate BC, leaky imports" -- worst of both worlds.

## Scope

Decide between:

1. Tighten the boundary: `bc-study` exposes `cardExistsForUser(id, userId)`, `knowledgeNodeExists(id)`, `scenarioExistsForUser(id, userId)` predicates; `bc-citations` calls those instead of reaching into the table object. Replace the `studySchema` redeclaration with an import from `@ab/bc-study`.
2. Fold citations into bc-study: `content_citations` already lives in the study Postgres schema; the BC boundary is artificial. Move `libs/bc/citations/src/*` under `libs/bc/study/src/citations/`, drop the package.

The redeclaration of `studySchema` should resolve in both options.

## Trigger

- Next review pass that touches the citation surface.
- A third BC needing cross-cutting reference reads (forces the boundary question).
