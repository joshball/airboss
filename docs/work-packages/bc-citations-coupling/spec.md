---
status: done
shipped: PR #278 (2026-04-28) -- option 2 (fold into bc-study)
source: 2026-04-27 architecture review
---

# Decide: own `libs/bc/citations` or fold into `bc-study`

## Decision

Option 2: fold `libs/bc/citations` into `libs/bc/study`. Shipped 2026-04-28.

Rationale:

- `content_citations` already lives in the `study` Postgres schema -- the BC boundary lied about where the data belonged.
- All three predicates the citations code needed (`cardExistsForUser`, `knowledgeNodeExists`, `scenarioExistsForUser`) are ownership checks against study tables. The citations package had no domain of its own.
- Tightening the boundary (option 1) would have added ceremony without semantic value -- a separate package whose only purpose was calling 3 study predicates is not a bounded context.
- If a third BC ever needs cross-cutting reference reads, that's when a real citations BC gets extracted (with its own domain: policies, link-rot, audit). What was here today was study domain.
- "No legacy in airboss -- retire on sight." A speculatively-extracted package with no domain was legacy.

The citation BC functions now live in `libs/bc/study/src/citations/` and are re-exported from the `@ab/bc-study` barrel. The `studySchema` redeclaration in the citations schema is gone -- the table reuses `studySchema` from the sibling `libs/bc/study/src/schema.ts`.

## History

`libs/bc/citations/src/citations.ts` imported raw Drizzle table objects from `@ab/bc-study` (`card`, `knowledgeNode`, `scenario`) to verify ownership. `libs/bc/citations/src/schema.ts` redeclared `pgSchema(SCHEMAS.STUDY)` rather than importing `studySchema` from `@ab/bc-study`. The `content_citations` table itself lived under the `study` Postgres schema. Result: "separate BC, leaky imports" -- worst of both worlds.

The two options considered:

1. Tighten the boundary: `bc-study` exposes `cardExistsForUser(id, userId)`, `knowledgeNodeExists(id)`, `scenarioExistsForUser(id, userId)` predicates; `bc-citations` calls those instead of reaching into the table object. Replace the `studySchema` redeclaration with an import from `@ab/bc-study`.
2. Fold citations into bc-study: `content_citations` already lives in the study Postgres schema; the BC boundary is artificial. Move `libs/bc/citations/src/*` under `libs/bc/study/src/citations/`, drop the package.

Option 2 won.
