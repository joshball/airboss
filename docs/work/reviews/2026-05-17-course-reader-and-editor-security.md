---
feature: course-reader-and-editor
category: security
date: 2026-05-17
branch: main
issues_found: 8
critical: 2
major: 2
minor: 3
nit: 1
---

## Summary

The CRE feature is well-structured on auth and ORM safety: every study route calls `requireAuth`, every hangar route + action calls `requireRole(AUTHOR|OPERATOR|ADMIN)`, all DB access is parameterised Drizzle, form actions inherit SvelteKit CSRF protection, and the markdown renderer escapes all HTML. The serious gap is the hangar editor's filesystem-write surface: the `slug`, `filename`, and `code` route params + form fields flow into `node:path` `resolve()` and `fs` write/delete/`rmSync` calls with no allowlist validation. An authenticated authoring-role user can traverse out of `course/courses/` to read, overwrite, or delete arbitrary files the server process can touch. The spec (line 242) explicitly requires the slug to match the kebab-case regex but the server actions never enforce it -- "UI does the check live" was taken literally and the server-side gate was dropped.

## Issues

### CRITICAL: Path traversal in hangar course slug -> arbitrary file write / directory delete

- **File**: `apps/hangar/src/routes/(app)/courses/[slug]/+page.server.ts:175,186,215,228,234,280,282`
- **Problem**: The `[slug]` route param is attacker-controlled and flows unvalidated into filesystem paths. `manifestPath(slug)` / `sectionsDir(slug)` build `resolve(COURSES_DIR, slug, ...)`, and `node:path` `resolve()` collapses `../` segments, so a slug escapes `course/courses/`. `updateManifest` and `addSection` never call `getCourseBySlug`, so there is no DB-existence backstop either:
  - `updateManifest` with `slug = ../../../../some/dir` writes a forged `manifest.yaml` anywhere under the repo / filesystem the server can write (`writeFile` in `runSave`).
  - `addSection` with a traversal slug runs `mkdirSync(dir, { recursive: true })` then `writeFile` of an attacker-named `.yaml` at an arbitrary location.
  - `deleteCourse` does `const dir = resolve(COURSES_DIR, slug); rmSync(dir, { recursive: true, force: true })` -- a traversal slug recursively deletes an arbitrary directory tree. `getCourseBySlug` runs first and 404s for a non-existent course, but the slug is still passed to `rmSync` only after a successful course lookup; a slug crafted to both match a real `course.slug` value *and* contain traversal is unnecessary because the more direct `updateManifest`/`addSection` paths have no lookup at all.

  SvelteKit does not URL-decode-block `%2e%2e%2f` for route params, and there is no `src/params/` matcher constraining `[slug]`. The hangar app is authoring-role-gated, but that is privilege containment, not input validation -- a compromised or curious AUTHOR account gets arbitrary filesystem write/delete on the host.
- **Fix**: Validate the slug against the canonical regex at the top of every action and the loader before any path construction. Reuse the existing `COURSE_SLUG_REGEX` (already present in `course-yaml-emit.ts`'s sibling `+page.server.ts` for `createCourse` and in `libs/bc/study/src/course-yaml-schemas.ts`). Promote it to `@ab/constants` and call it once: `if (!COURSE_SLUG_REGEX.test(slug)) throw error(400, 'Invalid slug.')`. Additionally, after every `resolve()`, assert the result still starts with `COURSES_DIR + path.sep` as defence-in-depth. Add a SvelteKit param matcher at `apps/hangar/src/params/courseSlug.ts` so a malformed slug 404s before the loader runs.

### CRITICAL: Path traversal in `deleteSection` filename -> arbitrary file delete

- **File**: `apps/hangar/src/routes/(app)/courses/[slug]/+page.server.ts:256-267`
- **Problem**: `deleteSection` reads `filename` straight from form data, trims it, and passes it to `resolve(sectionsDir(slug), filename)`. There is no check that `filename` is a bare basename, no `.yaml` extension check, no allowlist against the section files actually on disk. `resolve(dir, '../../../../etc/cron.d/whatever')` escapes `sectionsDir`. The action then calls `runSave` with a `delete` op -- `existsSync(path)` gates it, and if the traversal target exists, `unlink(path)` removes it. The `runSave` backup/revert logic will even *restore* the file content on a subsequent seed failure, but the delete itself has already executed and the seed runs against whatever is left. An authoring-role user can delete any file the server process can `unlink`.
- **Fix**: Reject any `filename` that is not a plain basename: `if (filename !== path.basename(filename) || !filename.endsWith('.yaml')) return fail(400, ...)`. Better, scan `loadSectionsFromDisk(slug)` and require `filename` to be a member of the returned set before touching the path -- the UI only ever offers real on-disk filenames, so an allowlist is the correct model.

### MAJOR: `addSection` derives filename from unvalidated `code` -- path injection + collision surface

- **File**: `apps/hangar/src/routes/(app)/courses/[slug]/+page.server.ts:217,230-234`
- **Problem**: `code` is read from the form with only an emptiness check, then interpolated into the filename: `` `${code}-${slugifiedTitle}.yaml` ``. The `title` portion is regex-scrubbed to `[a-z0-9-]`, but `code` is not -- a `code` value of `../../evil` produces `resolve(dir, '../../evil-....yaml')`, escaping `sectionsDir`. The seed validator later rejects bad codes, but the *file write* (`writeFile` in `runSave`) and the `existsSync` collision check happen against the escaped path before the seed runs. On seed failure `runSave` reverts, but the file was still created at the traversal location during the attempt.
- **Fix**: Validate `code` against a strict pattern (the course-step code shape -- e.g. `^[a-z0-9][a-z0-9.\-]*$`, no slashes, no dots-only segments) before building the filename, and `path.basename()` the final filename as a belt-and-braces check. The seed validator's code rules should be mirrored as a server-side pre-check so the rejection happens before any disk write.

### MAJOR: Seed pipeline error messages leaked verbatim to the client

- **File**: `apps/hangar/src/routes/(app)/courses/[slug]/+page.server.ts:167-168,291-294`; `apps/hangar/src/routes/(app)/courses/[slug]/sections/[code]/+page.server.ts:121-122`; `apps/hangar/src/routes/(app)/courses/+page.server.ts:112`
- **Problem**: On a non-`CourseSeedError` failure the handlers do `err instanceof Error ? err.message : String(err)` and return it in the `fail(400, { error: ... })` payload. A DB-connection failure, a Postgres FK-violation, or any unexpected throw surfaces its raw message (and for `deleteCourse`, a Postgres error string) to the browser. `deleteCourse`'s comment even acknowledges it forwards "the FK violation." This leaks internal infrastructure detail (connection strings fragments, table/constraint names, file paths) to the client. The spec's "Validation" / error-text contract (`seed failed: <error>`) intends `<error>` to be a *validation* message, not an arbitrary stack/driver message.
- **Fix**: Surface `CourseSeedError.message` (a controlled, author-facing validation string) to the client, but for any other error log it server-side and return a generic `'Seed failed unexpectedly. Check server logs.'` to the user. Do the same for the FK-violation path in `deleteCourse` -- map the known `goal_course` RESTRICT violation to a friendly "Course is referenced by one or more goals; remove it from those goals first." and never echo the raw Postgres string.

### MINOR: `cleanupOrphans` / `findSectionFile` read every `.yaml` in the slug dir with no slug validation

- **File**: `apps/hangar/src/routes/(app)/courses/[slug]/+page.server.ts:300-326`; `apps/hangar/src/routes/(app)/courses/[slug]/sections/[code]/+page.server.ts:51-63,65-91`
- **Problem**: These paths also build `resolve(COURSES_DIR, slug, 'sections')` from the unvalidated slug and `readdirSync` / `readFileSync` it. `cleanupOrphans` and the section-editor loader call `getCourseBySlug` first, which 404s for a slug with no matching `course` row -- that is partial protection, but it depends on no `course.slug` value ever itself containing traversal characters (the DB CHECK constraint currently enforces the kebab shape, so this holds today). It is fragile: the protection is incidental, not intentional, and breaks the moment the DB constraint is relaxed or a slug is inserted by a path that skips the CHECK. This is the read-side mirror of the CRITICAL write issues.
- **Fix**: Same root fix -- validate the slug against the regex at the top of the loader and `cleanupOrphans` action. Once the slug is allowlisted the read paths are safe by construction.

### MINOR: `clampWeight` writes fractional weights into integer-typed semantics without spec-stated bounds documentation

- **File**: `apps/study/src/routes/(app)/program/goals/[id]/+page.server.ts:166-170,361,412`
- **Problem**: `clampWeight` parses the form `weight`, clamps to `[GOAL_SYLLABUS_WEIGHT_MIN, GOAL_SYLLABUS_WEIGHT_MAX]`, and falls back to `1.0` for non-finite input. The `goalCourse.weight` column is `real` so the value is accepted, and the clamp prevents out-of-range writes -- functionally safe. The concern is that the *course* weight reuses the *syllabus* weight constants (`GOAL_SYLLABUS_WEIGHT_*`); if a future schema check on `goal_course.weight` uses a different range than `goal_syllabus`, the clamp silently disagrees with the DB constraint and a borderline value 500s instead of returning a clean `fail(400)`. Not currently exploitable, but a validation-vs-constraint drift waiting to happen.
- **Fix**: Introduce `GOAL_COURSE_WEIGHT_MIN/MAX` constants (even if equal to the syllabus values today) and have `clampWeight` for the course actions use them, so the server-side clamp and any DB CHECK stay coupled to the same source of truth.

### MINOR: Study course index + hangar index perform unbounded full-table fetches

- **File**: `apps/study/src/routes/(app)/courses/+page.server.ts:54`; `apps/hangar/src/routes/(app)/courses/+page.server.ts:46,53-59`
- **Problem**: `listCoursesForReader` / `listAllCourses` return every course row with no pagination or cap, and the hangar index then runs one `getCourseStepsByCourse` per course (`Promise.all` over all rows). The code comments acknowledge "at single-digit course count the cost is trivial." This is a denial-of-service / resource-exhaustion vector if the course table ever grows (course creation is authoring-role-gated, so the blast radius is limited, but a buggy seed or bulk import balloons the count). Not a confidentiality issue.
- **Fix**: Add a `LIMIT` (e.g. 200) to the reader/admin course queries, or paginate the index. At minimum replace the per-course `getCourseStepsByCourse` N+1 with a single grouped count query, as the comment itself suggests ("at scale we'd batch via a count-by-course query").

### NIT: Reader 404 strategy is consistent but draft-status check is duplicated across three loaders

- **File**: `apps/study/src/routes/(app)/courses/[slug]/+page.server.ts:67-68`; `apps/study/src/routes/(app)/courses/[slug]/[stepCode]/+page.server.ts:191-192`
- **Problem**: The `status === 'draft'` -> 404 rule (a content-authorization rule from the spec) is hand-copied into both detail loaders. This is correct today, but a missed copy in a future fourth reader route would silently expose draft courses to learners. It is an authorization rule and should not rely on per-loader copy discipline.
- **Fix**: Centralise the reader-visibility check in a single helper -- e.g. `getReaderVisibleCourseBySlug(slug)` in `libs/bc/study/src/courses.ts` that returns `null` for both "missing" and "draft", so every reader loader gets one call and the rule cannot drift. The index loader already uses `listCoursesForReader` with an explicit `statusIn` filter; the detail/step loaders should share the same gate.

## Notes (verified safe -- no finding)

- All study and hangar CRE routes call `requireAuth` / `requireRole` in both the loader and every form action; the dual-gate contract from `libs/auth/src/auth.ts` is honoured.
- Goal `[id]` actions consistently call `getOwnedGoal(id, user.id)` before any write and 404 on `GoalNotOwnedError` -- no IDOR on goal mutation. `addCourse` re-checks goal ownership before the `goal_course` insert.
- All DB access is parameterised Drizzle (`eq`, `and`, `inArray`); the one `sql` template in `getCourseStepsByCourse` is a static `ORDER BY` fragment with no interpolated user input.
- `renderMarkdown` (`libs/utils/src/markdown.ts`) HTML-escapes all text and allowlists URL protocols (`https?:`, `/`, `#`, `mailto:`), so the `{@html}` usages in the study course pages are not an XSS vector even though `body_md` / `description` originate from authored YAML.
- Form actions are SvelteKit form actions, which carry built-in origin-check CSRF protection; no custom unprotected POST endpoints were introduced.
- The `?status=` query param on the hangar index is narrowed through `narrow()` against `COURSE_STATUS_VALUES` -- safe.
- The seed pipeline is invoked via a direct function import (`seedCourses()`), not a shell-out -- there is no command-injection surface (the `Bun.spawn` option in design.md was not the path taken).
- `createCourse` in `apps/hangar/src/routes/(app)/courses/+page.server.ts` *does* validate the slug against `COURSE_SLUG_REGEX` before building paths -- it is the one hangar write action that gets this right, and is the model the `[slug]` route actions should follow.
