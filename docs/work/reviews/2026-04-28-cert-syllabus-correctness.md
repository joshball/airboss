---
title: 'Review: cert-syllabus-and-goal-composer (correctness)'
feature: cert-syllabus-and-goal-composer
date: 2026-04-28
reviewer: correctness
status: unread
review_status: done
scope: PRs #248, #254, #264, #270 (cumulative WP)
issues_found: 4
---

# Review: cert-syllabus correctness

## Critical (1)

### C1 -- `resolveCitationUrl` and `validateAirbossRefForLeaf` regress when other tests run first

`libs/sources/src/registry/corpus-resolver.ts:163` exposes `__corpus_resolver_internal__.resetToDefaults()`, called from `afterEach` in `libs/sources/src/render/{batch-resolve,substitute}.test.ts` and `libs/sources/src/registry/__test_helpers__.ts:resetRegistry`. That helper wipes every entry in `RESOLVERS` and reseats only the no-op default per-corpus. In a single bun-test process those side-effect-imported real resolvers (regs, handbooks, acs, pts, aim, ac) never come back, so subsequent tests run against the no-op defaults.

Symptoms reproduced today (full suite):

- `libs/bc/study/src/handbooks.test.ts:562` -- `resolveCitationUrl(... acs ... airboss_ref ...)` falls back to the kind template `https://www.faa.gov/training_testing/testing/acs` instead of the per-publication PDF returned by `ACS_RESOLVER.getLiveUrl`.
- `libs/bc/study/src/syllabi.test.ts:69` -- `validateAirbossRefForLeaf(... acs/.../elem-x09 ...)` should throw because `parseAcsLocator` rejects `elem-x09`, but the default resolver's `parseLocator` returns `{ kind: 'ok', segments: ... }` and the validator never throws.
- `libs/sources/src/ac/resolver.test.ts:16` -- `getCorpusResolver(AC_CORPUS)` returns a default resolver instead of `AC_RESOLVER`.

Each test passes in isolation, so the WP code is correct; the test infrastructure is the problem.

**Fix:** make `resetToDefaults()` restore the **last real registration** for each corpus rather than the no-op default. Track real registrations as they come in via `registerCorpusResolver` so the snapshot is captured at module-load time (after side-effect imports run).

### C2 -- `acsLens` synthetic root labels with the syllabus id, not the syllabus title

`libs/bc/study/src/lenses.ts:325-327`:

```typescript
const certNode: LensTreeNode = {
    id: nodes[0]?.syllabusId ?? '',
    level: 'cert',
    title: nodes[0]?.syllabusId ?? '',
    rollup: emptyRollup(),
    children: [],
};
```

`title` is set to the syllabus id (a `syl_ULID` string), not the syllabus's display title. The cert dashboard would show ULIDs as section headings.

**Fix:** join `syllabus` rows in `acsLens` and use `syllabus.title` for the synthetic root's `title` (and `syllabus.slug` is a better candidate for `id` if the consumer needs a stable URL).

## Major (2)

### M1 -- `rebuildKnowledgeNodeRelevanceCache` BC export is a stub returning `knowledgeNodesUpdated: 0`

`libs/bc/study/src/syllabi.ts:595-607`. Docstring says "Placeholder for the relevance cache rebuild ... full implementation lands in cert-syllabus phase 18 where the syllabus YAML pipeline + at least one transcribed area exists". The full implementation **did land** as `scripts/db/build-relevance-cache.ts` (PR #264). The BC export is now misleading: it claims to rebuild the cache but only counts active syllabi.

Per CLAUDE.md prime directive: **a stub is a known issue**.

**Fix:** delete the `rebuildKnowledgeNodeRelevanceCache` BC export (and its test) -- the script in `scripts/db/build-relevance-cache.ts` is the real implementation; nothing else imports the BC stub. Or: have the BC export call into the script. The docstring at line 19 needs to track whichever choice.

### M2 -- `setGoalNodeWeight` is documented but not implemented

`libs/bc/study/src/goals.ts:16` lists `setGoalNodeWeight` in the BC's docstring contract, but the function is never defined. `addGoalNode` upserts a weight via `onConflictDoUpdate`, so callers can update via add. But the docstring promises a separate weight-only update.

**Fix:** either implement `setGoalNodeWeight(goalId, userId, knowledgeNodeId, weight, db)` (mirrors `setGoalSyllabusWeight`) or remove the line from the docstring. Implementation is the right answer per "no undecided considerations" rule.

## Minor (1)

### m1 -- `getCredentialMastery` does an O(leaves * nodes) `nodes.find` in `ancestorAreaId`

`libs/bc/study/src/credentials.ts:382-391`. The closure does `nodes.find((n) => n.id === cur)` per ancestor walk. Up to a 600-leaf ACS that's bounded; if a future syllabus has thousands of leaves the rebuild becomes O(n²). The `parentById` Map is already built; missing is a `byId: Map<string, SyllabusNodeRow>` so `ancestorAreaId` can index by id.

**Fix:** materialise a `nodesById = new Map(nodes.map((n) => [n.id, n]))` once and replace the `.find` with a Map lookup. Pure refactor.

## Notes / nits

- `libs/bc/study/src/syllabi.ts:477-478` -- `void SYLLABUS_KIND_VALUES;` and `void SYLLABUS_STATUSES;` plus `void sql;` at line 612 are dead "use" calls that exist only to keep imports. The imports themselves are unused; delete them and the void statements.
- `libs/bc/study/src/goals.ts:408` -- `void GoalAlreadyPrimaryError;` is dead; the class is exported at line 82.
- `libs/sources/src/acs/resolver.ts:34,48` -- module-level mutable `_derivativeRoot` + `_manifestCache` are process-global. Documented as test-only override; production code never mutates after start. Fine as a known pattern.
