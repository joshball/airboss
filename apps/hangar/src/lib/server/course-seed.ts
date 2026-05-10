// @browser-globals: server-only -- never imported by client .svelte
/**
 * Hangar editor wrapper around the course seed pipeline
 * (course-reader-and-editor WP, Phase 6).
 *
 * Per design.md "Hangar editor: per-save seed pipeline integration via
 * direct function import": the editor invokes the seed pipeline by
 * importing `seedCourses()` from `scripts/db/seed-courses.ts` and calling
 * it programmatically. This wrapper:
 *
 *   - Resolves the canonical `course/courses/` directory at the repo root
 *     so the editor's save action doesn't have to know about path math.
 *   - Catches `CourseSeedError` and re-throws it with a friendlier shape
 *     the form-action handler can surface as a validation error.
 *   - Surfaces the summary (rows scanned / upserted / skipped) for the
 *     post-save banner.
 *
 * Concurrency: the seed function is per-course; concurrent saves of
 * different courses are safe. Same-course concurrency is deferred per
 * OUT-OF-SCOPE "Multi-author concurrency on the same course."
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CourseSeedError, type SeedCoursesSummary, seedCourses } from '@ab/seed-courses';

const HERE = dirname(fileURLToPath(import.meta.url));
// Resolve from `apps/hangar/src/lib/server/` -> repo root -> `course/courses/`.
// Six `..` segments: `server/` -> `lib/` -> `src/` -> `hangar/` -> `apps/` -> repo root.
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..', '..', '..');
const COURSES_DIR = resolve(REPO_ROOT, 'course/courses');

export { CourseSeedError } from '@ab/seed-courses';

export interface RunCourseSeedResult {
	summary: SeedCoursesSummary;
}

/**
 * Run the seed pipeline against one course. The slug is the `course.slug`
 * column value (which matches the `course/courses/<slug>/` directory name
 * by contract).
 *
 * Throws `CourseSeedError` on every validator rejection (duplicate
 * ordinals, missing knowledge node FK, kind=personal, etc.). The form
 * action catches and reverts the YAML write.
 */
export async function runCourseSeed(slug: string): Promise<RunCourseSeedResult> {
	const summary = await seedCourses({ coursesDir: COURSES_DIR, slug });
	return { summary };
}

export { COURSES_DIR };
