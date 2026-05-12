---
title: Command palette Phase 2 -- test quality review
date: 2026-05-11
branch: ball/palette-phase2-f191fb12
pr: 831
reviewer: agent (close-pass synthesis)
category: testing
status: pending
review_status: done
issues_found: 5
---

# Test quality review

Assertion strength, coverage of edge cases, no skipped/no-op tests, test independence, mock vs real boundaries, fixture hygiene.

## Findings

### T1. (Major) `loadCfrSections` test does not seed a 49 CFR row -- C1 bug stays latent

**File:** `libs/help/src/loaders/__tests__/db-loaders.test.ts` (lines 393-406)

The CFR test seeds `documentSlug: 'palette-cfr-${SUITE_TAG.slice(-12)}'` -- a slug whose leading characters are not "14" or "49". The test then asserts `title.toContain('§')`. That assertion passes for any title containing `§` regardless of which CFR title it claims.

This is why correctness C1 (hardcoded "14 CFR §") shipped. Add a Title 49 fixture and an assertion that pins the title prefix per-title:

```ts
it('discriminates 14 vs 49 CFR by documentSlug', async () => {
  const out14 = await loadCfrSections(parseQuery('zephyr-14'), HOST_AUTHED);
  expect(out14.every((r) => r.title.startsWith('14 CFR'))).toBe(true);
  const out49 = await loadCfrSections(parseQuery('zephyr-49'), HOST_AUTHED);
  expect(out49.every((r) => r.title.startsWith('49 CFR'))).toBe(true);
});
```

Once C1 is fixed, this test pins it.

### T2. (Major) `loadReps` + `loadPlans` lack a cross-user leak test

**File:** `libs/help/src/loaders/__tests__/db-loaders.test.ts` (lines 457-483)

`loadCards` has the "never leaks another user card" assertion (line 445-449). `loadReps` and `loadPlans` only have the positive + anon-empty tests. The user-scoping clause in each query is the security-critical guard; the test suite needs to fail loud when it's missing.

Mirror the cards test for reps and plans -- this is the convergent fix for security S2 + this finding.

### T3. (Major) `loadExternalTools` test codifies the wrong behavior

**File:** `libs/help/src/loaders/external-tools.test.ts` (line 8-11)

```ts
test('empty query returns every tool', () => {
  const rows = loadExternalTools(parseQuery(''), HOST);
  expect(rows.length).toBeGreaterThanOrEqual(7);
});
```

This is the C3 bug (External Tools loader returns all 7 rows on empty needle / filter-only queries). The test pins the wrong shape: when C3 is fixed (empty -> `[]`), this test must invert.

**Fix:** rewrite this test as:

```ts
test('empty query returns []', () => {
  const rows = loadExternalTools(parseQuery(''), HOST);
  expect(rows).toEqual([]);
});
```

### T4. (Minor) `command-palette-smoke.spec.ts` defines `expectColumn` but never asserts against it

**File:** `tests/e2e/command-palette-smoke.spec.ts` (lines 31-36 + 102-108)

```ts
const SMOKE_QUERIES = [
  { q: 'weather', expectColumn: 'faa-resources' },
  { q: 'Part 91', expectColumn: 'faa-resources' },
  ...
];
```

Then:

```ts
if (expectColumn) {
  const totalRows = await page.locator(`${PALETTE_COLUMNS} button[data-result-id]`).count();
  expect(totalRows, `expected at least 1 row for "${q}"`).toBeGreaterThan(0);
}
```

`expectColumn` is read as a truthy guard but never actually used in the assertion -- the test only checks "at least 1 row anywhere," not "at least 1 row in the specified column." Either use it (`page.locator('section[data-column="${expectColumn}"] button')`) or drop the field.

**Fix:** scope the locator to the target column. The test data implies a column contract; the assertion should pin it.

### T5. (Minor) `db-loaders.test.ts` does not assert `parentDocCode` cluster contract

**File:** `libs/help/src/loaders/__tests__/db-loaders.test.ts`

Each loader's positive test asserts `type`, `id`, `title`. None of them assert that `parentDocCode` matches the parent reference's id (or some other handshake key with the aviation registry).

This is why correctness C2 (cluster bond mismatch between aviation registry and DB loaders) shipped -- nothing in the test suite forced the two sides to agree.

**Fix:** add a test that runs `loadHandbookSections('weather')`, also runs `loadAviationRefs(parseQuery('PHAK'))`, and asserts that the chapter rows' `parentDocCode` matches some root row's `id` -- proving the cluster will form. Repeat for CFR.

This is a contract-level test, not a unit test; co-locate at `libs/help/src/__tests__/cluster-bond.test.ts`.

## Out of scope (verified)

- Test isolation via `SUITE_TAG = Date.now()-random()` is correct (collision-free across parallel suites).
- `afterAll` cleanup walks FK-safe deletion order. Correct.
- Real Postgres is the right boundary for these tests (the loaders are SQL-heavy; mocked Drizzle would silently regress on query-shape changes).
- The `bauthUser` rows are properly seeded + torn down -- no orphan `auth.user` rows left after a run.
- Test lint rules (no `.toBeTruthy()`, see global feedback) appear to be respected.
