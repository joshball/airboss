# Todo -- 2026-05-04 -- finish study-home WP (steps 5-14)

Branch: `feat/study-home-impl-finish` (off `origin/feat/study-home-impl`)

## Bootstrap

- [x] Apply Drizzle migration `0001_greedy_blob.sql` (study.user_pref + audit_log target widening).
- [x] Confirm user-prefs + first-touch + today-prose tests green.

## Step 5 -- ACS map tree builder

- [ ] `_lib/build-acs-tree.ts`
- [ ] Vitest

## Step 6 -- Handbook map tree builder

- [ ] `_lib/build-handbook-tree.ts`
- [ ] Vitest

## Step 7 -- Course frontmatter backfill (all 10 weeks)

- [ ] `tools/course-frontmatter-backfill.ts`
- [ ] All 52 lesson files cited. No `pending_review:`.
- [ ] `tools/check-course-frontmatter.ts` validator.

## Step 8 -- Course map tree builder

- [ ] `_lib/build-course-tree.ts`
- [ ] Vitest

## Step 9 -- Real loader composition

- [ ] `_lib/build-today-briefing.ts`
- [ ] `+page.server.ts` full data wiring + form action.

## Step 10 -- Panels

- [ ] ProgressPanel / TodayPanel / TilesPanel / MapPanel / MapTree / LeafRow / CitationStacks.

## Step 11 -- Nav / redirect

- [x] Already landed.

## Step 12 -- Tests

- [ ] Playwright e2e SH-1..SH-39 (skip multi-device + interactive admin).

## Step 13 -- Polish

- [ ] biome format, `bun run check`, mobile, a11y.
