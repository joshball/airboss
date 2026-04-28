---
title: 'Review: cert-syllabus-and-goal-composer (patterns)'
feature: cert-syllabus-and-goal-composer
date: 2026-04-28
reviewer: patterns
status: unread
review_status: done
scope: PRs #248, #254, #264, #270 (cumulative WP)
issues_found: 5
---

# Review: cert-syllabus patterns / CLAUDE.md compliance

## Major (1)

### P1 -- Biome lint failures introduced by WP files

`bun run check` -> biome reports 32 errors. Of those, 5 are in WP-introduced files:

- `libs/sources/src/pts/index.ts:12:1` -- `assist/source/organizeImports`
- `scripts/db/seed-credentials.ts:24:1` -- `assist/source/organizeImports`
- `scripts/db/seed-references.ts:19:1` -- `assist/source/organizeImports`
- `scripts/db/seed-syllabi.ts:25:1` -- `assist/source/organizeImports`
- `scripts/db/strip-authored-relevance.test.ts:5:1` -- `assist/source/organizeImports`

CLAUDE.md says `bun run check` must pass with 0 errors before merge. **Fix:** `bunx biome check --write` on the affected files. All five are auto-fixable.

The remaining 27 biome errors are pre-existing (PR #249 / sources/pdf, sources/ac), out of WP scope but worth flagging in a follow-on cleanup pass.

## Minor (4)

### p1 -- "void X" anti-pattern across BC files

Multiple files have `void X;` statements at the bottom that exist only to silence "unused import" warnings. This is the classic "I'm using this so the import survives" smell.

- `libs/bc/study/src/syllabi.ts:477,478` (`void SYLLABUS_KIND_VALUES; void SYLLABUS_STATUSES;`) and `:612` (`void sql;`).
- `libs/bc/study/src/goals.ts:408` (`void GoalAlreadyPrimaryError;`).
- `libs/sources/src/acs/resolver.ts:N` (none here, but flag if any appear elsewhere).

**Fix:** delete the void statements and the corresponding imports. If the symbol IS used somewhere I missed, biome will surface it on the re-run.

### p2 -- Magic strings in the ACS resolver

`libs/sources/src/acs/resolver.ts:28` -- `const SOURCE_ID_PREFIX = 'airboss-ref:acs/';`. CLAUDE.md says "no magic strings". The same prefix appears in `libs/sources/src/ac/resolver.ts` for the `ac` corpus.

The pattern is local-to-resolver, so the cost of adding a constant in `@ab/sources` shared file is unclear. Acceptable as-is, but if the value needs to change (e.g. `airboss-ref:` -> something else per a future ADR), it's now in N places. Capture as a tracking note.

**Resolution:** Drop. The prefix is `airboss-ref:` + `${corpus}/` and is built locally per resolver -- splitting the corpus-known constants into a shared file would just create another import edge.

### p3 -- `seed-credentials.ts:67-74` accepts `z.unknown()` for citation locator

The Zod schema for `structuredCitation` uses `locator: z.unknown().optional()`. The discriminated union types in `libs/types/src/citation.ts` carry per-kind locator shapes (`{ chapter, section, ... }` for handbook, `{ title, part, section }` for cfr, etc.). The seed schema doesn't preserve them, so a YAML typo in `regulatory_basis: [{ kind: 'cfr', locator: { titel: 14, ... } }]` (note typo on `titel`) would seed silently.

**Fix:** define a per-kind discriminated `z.discriminatedUnion('kind', [...])` in `seed-credentials.ts` (and `seed-syllabi.ts` if it has the same shape). Trade-off: more code; catches author typos at seed time.

**Resolution:** Defer with trigger. The volume of authored citations in `course/credentials/*.yaml` is small (1-3 per credential, all on regulatory_basis). The DB CHECK doesn't validate JSONB shape. The win at this scale is small. Capture for the next seed-tooling pass when authoring volume grows.

### p4 -- `LensTreeNode.id` for placeholder leaves uses `${node.id}:placeholder`

`libs/bc/study/src/lenses.ts:385`. When a syllabus leaf has zero `syllabus_node_link` rows, the lens emits a placeholder LensLeaf with `knowledgeNodeId: ''`. The id format `<leafId>:placeholder` is a magic suffix.

**Fix:** export a constant `LENS_LEAF_PLACEHOLDER_SUFFIX = ':placeholder'` from `lenses.ts` so callers (the cert dashboard UI) can detect placeholders without string-matching. Or use a typed `placeholder: boolean` on `LensLeaf`.

**Resolution:** add `placeholder?: boolean` to `LensLeaf` and set it where the placeholder is emitted. Cleaner than string match.

### p5 -- `study.reference` seed in `scripts/db/seed-references.ts` is silent on missing prerequisites

(observation rather than a fix request) The seed reads `course/references/*.yaml` and upserts `study.reference` rows. If a credential YAML references a `reference_id` not yet seeded, `seed-credentials.ts` silently inserts the citation array with the dangling `reference_id`. The DB has no FK from JSONB shapes to `study.reference.id`.

**Fix:** out of WP scope; track for the next reference-validation pass.

## Notes

- Routes for `/credentials`, `/credentials/[slug]`, `/goals`, `/goals/new`, `/goals/[id]`, `/goals/[id]/edit` are defined in `libs/constants/src/routes.ts` per the spec contract; pages are deliberately deferred to follow-on WPs. Good restraint.
- Constants tables (`CREDENTIAL_KINDS`, `CREDENTIAL_CATEGORIES`, `CREDENTIAL_CLASSES`, `SYLLABUS_KINDS`, `SYLLABUS_PRIMACY`, `SYLLABUS_NODE_LEVELS`, `ACS_TRIAD`, `LENS_KINDS`, `GOAL_STATUSES`, `CITATION_FRAMINGS`) all in `libs/constants/src/credentials.ts` per project rules. No magic strings in BC code (apart from the resolver prefixes flagged above).
- ID generators (`generateCredentialId`, `generateSyllabusId`, `generateSyllabusNodeId`, `generateGoalId`) in `libs/utils/src/ids.ts` follow the `prefix_ULID` shape. Good.
- All cross-lib imports use `@ab/*` aliases. No relative paths across lib boundaries.
- Drizzle ORM only; no raw SQL apart from the explicit `sql.raw(...)` in CHECK constraint composition (necessary for in-list expansion).
