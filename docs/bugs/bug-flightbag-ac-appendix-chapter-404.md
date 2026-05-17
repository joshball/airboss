---
id: bug-flightbag-ac-appendix-chapter-404
title: Flightbag AC appendix chapters 404 (hyphenated chapter code rejected)
product: flightbag
severity: major
status: fixed
discovered_pr: null
discovered_date: 2026-05-15
fix_pr: 1005
fix_wp: null
tags: [flightbag, reader, references, ac, integration-coverage]
---

# Flightbag AC appendix chapters 404 (hyphenated chapter code rejected)

Every AC appendix chapter (`/ac/<doc>/<rev>/appendix-<x>`) returns a 404 from
the flightbag reader. Surfaced by the flightbag integration coverage sweep
(`tests/integration/flightbag-coverage.spec.ts`).

## Repro

```text
GET /ac/61-65/j/appendix-a   -> 404
GET /ac/25-7/d/appendix-c    -> 404
```

23 distinct AC appendix URLs 404 across 5 ACs (120-71, 25-7, 61-65, 61-98,
90-66).

## Root cause

AC appendix rows in `study.reference_section` are seeded as depth-0 rows with
`code = 'appendix-a'` (`appendix-b`, ...) and `level: 'chapter'` -- they are
chapter-level rows whose code carries a hyphen.

The AC chapter route
`apps/flightbag/src/routes/ac/[doc]/[rev]/[chapter]/+page.server.ts` validates
the `[chapter]` URL param against:

```typescript
const CHAPTER_SHAPE = /^[a-z0-9]+$/i;
```

`appendix-a` contains a hyphen, fails the shape check, and the loader throws
`error(404, 'Invalid AC chapter.')` before any DB lookup. The numbered AC
chapters (`1`, `2`, ...) pass the regex, so only appendices break.

## Surfaced by

`tests/integration/flightbag-coverage.spec.ts` -- the `sectionUrlFor` helper
(`apps/flightbag/src/lib/section-url.ts`) treats a single-segment AC code as a
chapter and builds `FLIGHTBAG_AC_CHAPTER(doc, rev, 'appendix-a')`, so the sweep
exercises the URL the catalog would link to and catches the rejection.

## Fix direction

The `CHAPTER_SHAPE` regex needs to admit the `appendix-<letter>` form (e.g.
`/^[a-z0-9]+(?:-[a-z0-9]+)*$/i`), and the same widening must be applied to the
AC `[section]` route's `CHAPTER_SHAPE`. Verify `getHandbookChapter(ref.id,
'appendix-a')` resolves once the param passes the gate -- the row exists, so
the only blocker is the regex. The triage plan
(`docs/work/todos/2026-05-15-01-flightbag-coverage-plan.md`) carries the full
file list.

## Cross-references

- Sibling routing gap: `bug-flightbag-handbook-frontmatter-chapter-404`.
- The existing rep spec `tests/e2e/flightbag/representative-pages.spec.ts` has
  no AC URL builder at all, which is why this never surfaced before the
  integration sweep.
