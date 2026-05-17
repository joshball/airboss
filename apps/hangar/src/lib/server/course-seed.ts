// @browser-globals: server-only -- never imported by client .svelte
/**
 * Hangar editor wrapper around the course seed pipeline
 * (course-reader-and-editor WP, Phase 6).
 *
 * Per design.md "Hangar editor: per-save seed pipeline integration via
 * direct function import": the editor invokes the seed pipeline by calling
 * `seedCourses()`. The pipeline lives in the BC (`@ab/bc-study/server`) --
 * apps depend on libs, not on `scripts/`. This wrapper:
 *
 *   - Surfaces the canonical `course/courses/` directory so the editor's
 *     save actions don't have to know about path math.
 *   - Surfaces the summary (rows scanned / upserted / skipped) for the
 *     post-save banner.
 *
 * Concurrency: the seed function is per-course; concurrent saves of
 * different courses are safe. Same-course concurrency is deferred per
 * OUT-OF-SCOPE "Multi-author concurrency on the same course."
 */

import { CourseSeedError, DEFAULT_COURSES_DIR, type SeedCoursesSummary, seedCourses } from '@ab/bc-study/server';

const COURSES_DIR = DEFAULT_COURSES_DIR;

export { CourseSeedError };

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
