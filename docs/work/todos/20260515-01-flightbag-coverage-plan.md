# Flightbag coverage sweep -- triage plan

DateTime: 2026-05-15
Machine: local worktree (agent-ad9b90d894c097d2f)
Branch: feat/flightbag-integration-suite
Triggering prompt: build the flightbag integration coverage suite, run it, emit
a bug list + triage plan.
Context: first run of `tests/integration/flightbag-coverage.spec.ts` against the
dev seed (`airboss_integration` DB).

## First run -- 2026-05-15

```text
sanity    : 2586 / 2645 passed (59 failed)
structural: 280 / 339 passed (59 failed)
content   : 423 / 423 passed
```

118 total failures = 59 unique URLs, each failing twice (once in the sanity
tier, once in the structural tier). All 118 failures are HTTP 404. The full run
report is at `tests/integration/.out/coverage-report.md`; the machine-readable
summary at `tests/integration/.out/coverage-summary.json`.

## Failure classes

The 59 unique failing URLs split into exactly two classes.

| Class                 | Count | Symptom                               |
| --------------------- | ----- | ------------------------------------- |
| Handbook front-matter | 36    | `/handbook/<slug>/<ed>/0/<N>` -> 404  |
| AC appendix chapters  | 23    | `/ac/<doc>/<rev>/appendix-<x>` -> 404 |

Neither class is a test-infra bug. The integration suite emits these URLs on
purpose -- `sectionUrlFor` routes them to the deep-linkable reader URL the
catalog would use -- so the sweep surfaces the routing gap instead of hiding
it. The app bugs are filed; this PR does not fix them.

## Class 1 -- Handbook front-matter chapter 0 (bug-flightbag-handbook-frontmatter-chapter-404)

Front-matter rows are depth-0 `reference_section` rows with `code = '0.N'`,
`parentId: null`, `level: 'front-matter'`. There is no chapter `0` row, so the
section reader's `getHandbookChapter(ref.id, '0')` returns `null` and the
loader 404s.

- Severity: major (every handbook ships front-matter; all of it is unreachable).
- Affected handbooks: afh, aviation-instructor, avwx, ifh, iph, phak,
  risk-management.
- Files a fix would touch:
  - `apps/flightbag/src/routes/handbook/[slug]/[edition]/[chapter]/+page.server.ts`
    and the `[section]` child loader (chapter `0` resolution).
  - Possibly `libs/constants/src/study.ts` -- `level: 'front-matter'` is not a
    declared `REFERENCE_SECTION_LEVELS` member; the seeder writes a value the
    enum does not list. Decide whether to add `FRONT_MATTER` to the enum or
    re-level the rows.
  - `apps/flightbag/src/lib/section-url.ts` -- if the fix routes front-matter
    to the handbook landing rather than a chapter-0 page, the helper's
    handbook branch flips `0.N` from `url` to `covered-by-parent`.
- Open decision (needs the handbook reader owner): build a real chapter-0
  front-matter index page, or fold front-matter into the handbook landing with
  per-row deep links. Both keep the rows reachable. Default recommendation: a
  chapter-0 reader page, because the front-matter sections carry real body
  content (preface, errata, how-to-use) that deserves its own read surface and
  reading-progress credit, same as a chapter.

## Class 2 -- AC appendix chapters (bug-flightbag-ac-appendix-chapter-404)

AC appendix rows are depth-0 `reference_section` rows with `code =
'appendix-a'`, `level: 'chapter'`. The AC chapter route validates `[chapter]`
against `CHAPTER_SHAPE = /^[a-z0-9]+$/i`, which rejects the hyphen in
`appendix-a`; the loader 404s before any DB lookup.

- Severity: major (every AC with appendices loses them; 5 ACs in the dev seed).
- Affected ACs: 120-71, 25-7, 61-65, 61-98, 90-66.
- Files a fix would touch:
  - `apps/flightbag/src/routes/ac/[doc]/[rev]/[chapter]/+page.server.ts` --
    widen `CHAPTER_SHAPE` to admit `appendix-<x>` (e.g.
    `/^[a-z0-9]+(?:-[a-z0-9]+)*$/i`).
  - `apps/flightbag/src/routes/ac/[doc]/[rev]/[chapter]/[section]/+page.server.ts`
    -- same `CHAPTER_SHAPE` constant, same widening, so an appendix section
    deep link resolves too.
- No open decision: the row exists, the data is correct, the regex is the only
  blocker. Lowest-risk, smallest-diff fix of the two classes -- do this first.

## Suggested fix order

1. **AC appendix regex** (Class 2). One-constant widening in two route files,
   no data or schema change, no product decision. Verify with
   `bun run test integration` -- the 23 AC URLs should flip green.
2. **Handbook front-matter** (Class 1). Needs the chapter-0-page vs
   landing-fold decision first. After the decision, the fix touches the
   handbook loader (+ possibly the level enum + `sectionUrlFor`). Re-run the
   sweep to confirm the 36 front-matter URLs resolve.

After each fix, re-run `bun run test integration` and confirm the class drops
to zero failures; the suite is the regression gate for both.

## Out of scope for this PR

- Fixing the two app bugs. This PR ships the integration suite + the bug list;
  the fixes are separate, tracked by the two `docs/bugs/` entries.
- ACS per-task URL coverage. `sectionUrlFor` currently routes every ACS row to
  the publication landing (`covered-by-parent`) because the per-task reader
  needs `area_padded` / `task_letter` row metadata that the helper's input
  shape does not carry. Wiring that metadata through is a follow-up: it would
  let the sweep hit `/acs/<doc>/area/<area>/task/<task>` leaf URLs directly.
