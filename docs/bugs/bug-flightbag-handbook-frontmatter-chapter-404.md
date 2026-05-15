---
id: bug-flightbag-handbook-frontmatter-chapter-404
title: Flightbag handbook front-matter sections 404 (chapter 0 reader)
product: flightbag
severity: major
status: open
discovered_pr: null
discovered_date: 2026-05-15
fix_pr: null
fix_wp: null
tags: [flightbag, reader, references, handbook, integration-coverage]
---

# Flightbag handbook front-matter sections 404 (chapter 0 reader)

Every handbook front-matter section (`/handbook/<slug>/<edition>/0/<N>`) returns
a 404 from the flightbag reader. Surfaced by the flightbag integration coverage
sweep (`tests/integration/flightbag-coverage.spec.ts`).

## Repro

```text
GET /handbook/avwx/8083-28B/0/2   -> 404
GET /handbook/phak/8083-25C/0/1   -> 404
```

36 distinct front-matter URLs 404 across 7 handbooks (afh, aviation-instructor,
avwx, ifh, iph, phak, risk-management).

## Root cause

Front-matter rows in `study.reference_section` are seeded as depth-0 rows with
`code` of the form `0.N` (`0.1`, `0.2`, ...), `parentId: null`, and
`level: 'front-matter'`. There is **no chapter `0` row** -- the front-matter
sections are top-level peers of the real chapters, not children of a chapter.

The section reader `/handbook/[slug]/[edition]/[chapter]/[section]` resolves the
chapter via `getHandbookChapter(ref.id, '0')`. That lookup returns `null`
because no row with `code = '0'` exists, so the loader throws
`error(404, ...)`.

`level: 'front-matter'` is also not a member of `REFERENCE_SECTION_LEVELS` in
`libs/constants/src/study.ts` -- it is a value the handbook seeder writes that
the level enum does not declare.

## Surfaced by

`tests/integration/flightbag-coverage.spec.ts` -- the integration sweep
deliberately emits these URLs (the `sectionUrlFor` helper at
`apps/flightbag/src/lib/section-url.ts` routes a `0.N` code to
`FLIGHTBAG_HANDBOOK_SECTION(..., '0', 'N')` on purpose, so the sweep catches
the bug instead of silently skipping it).

## Fix direction

Two coherent options -- the triage plan
(`docs/work/todos/2026-05-15-01-flightbag-coverage-plan.md`) carries the full
analysis:

1. Add a chapter `0` reader path that renders the front-matter list (a real
   front-matter index page), or
2. Render the front-matter sections under the handbook landing only and have
   `sectionUrlFor` classify `0.N` as `covered-by-parent` of the handbook
   landing -- but the landing must actually deep-link each front-matter row.

The decision needs the handbook reader owner; both options keep the rows
reachable.

## Cross-references

- Sibling routing gap: `bug-flightbag-ac-appendix-chapter-404`.
- The existing rep spec `tests/e2e/flightbag/representative-pages.spec.ts`
  intentionally skips chapter `0` (its `buildSectionUrl` returns `null`),
  which is why this never surfaced before the integration sweep.
