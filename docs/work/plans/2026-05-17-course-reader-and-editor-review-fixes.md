# Course Reader and Editor -- review fix plan

DateTime: 2026-05-17
Branch: fix/cre-review-findings
Context: 10-category review of CRE (already merged to main). 105 findings across UX, Svelte, Security, Perf, Architecture, Patterns, Correctness, A11y, Backend; Schema clean (0). This PR closes every finding.

## Convergent root causes (fixed once)

1. **Course-slug regex** -- promote `COURSE_SLUG_REGEX` + `COURSE_SLUG_REGEX_SOURCE` to `libs/constants/src/credentials.ts`. Consumers: hangar `courses/+page.server.ts`, hangar `courses/+page.svelte` `pattern=`, `course-yaml-schemas.ts`, every `[slug]` hangar loader/action.
2. **Goal composer bypasses the BC** -- add `addGoalCourse` / `removeGoalCourse` / `setGoalCourseWeight` / `getGoalCourseLinks` to `libs/bc/study/src/goals.ts`. Route the three goal actions through them.
3. **13 unused `ROUTES.*_ACTION`** -- wire every CRE form `action="?/..."` through the constant.

## Path-traversal hardening (Critical x2 + Major + Minors)

- `assertSafeSlug(slug)` + `assertSafeBasename(filename, ext)` validators in the hangar app server lib. Validate `[slug]` at the top of every hangar action/loader. Validate `filename`/`code` as bare basenames. Assert resolved paths stay under `COURSES_DIR`.

## Judgement call

`archived` lifecycle: `NODE_LIFECYCLES` is skeleton/started/complete only; DB CHECK + `lifecycleFromContent` confirm there is no `archived` knowledge-node lifecycle. Decision: REMOVE the dead archived filter + checkbox from KnowledgeNodePicker (retire on sight).

## Per-file work groups

See review files under docs/work/reviews/2026-05-17-course-reader-and-editor-*.md. Every finding (Critical through Nit) is closed in this PR. WP docs reconciled for the shipped CourseStepChart real component (prose only, no frontmatter touch).
