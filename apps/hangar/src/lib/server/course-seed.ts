// Hangar editor -> seed-pipeline integration (course-reader-and-editor WP, Phase 6).
//
// Wraps `seedCourses({ slug })` from `scripts/db/seed-courses.ts` so
// per-save form actions can run the seed in-process. Surfaces a typed
// {ok | err} result the action layer maps onto SvelteKit's `fail`/return
// pattern. The seed itself is fast (<500ms per course); the wrapper
// is sync at the action layer.
//
// Why this thin shim instead of importing seedCourses directly:
//   1. Centralises error normalization (CourseSeedError + generic Error +
//      schema messages all funnel through one mapper).
//   2. Lets future paths (job queue, audit log, write-lock) hook in
//      without touching every action.
//   3. Caches the import path so a future move of seed-courses out of
//      `scripts/` (per design.md fallback) only changes one line here.

import { CourseSeedError, type SeedCoursesSummary, seedCourses } from '@ab/seed-courses';

export interface CourseSeedSuccess {
	readonly ok: true;
	readonly summary: SeedCoursesSummary;
}

export interface CourseSeedFailure {
	readonly ok: false;
	readonly error: string;
}

export type CourseSeedResult = CourseSeedSuccess | CourseSeedFailure;

/**
 * Run the seed pipeline for one course slug. Returns a typed result
 * carrying either the seed summary or the error message; never throws
 * (callers always reach a failure-banner path). Pass through the
 * optional courses-root override for tests.
 */
export async function runCourseSeed(slug: string, coursesDir?: string): Promise<CourseSeedResult> {
	try {
		const summary = await seedCourses({ slug, coursesDir });
		return { ok: true, summary };
	} catch (err) {
		if (err instanceof CourseSeedError) {
			return { ok: false, error: err.message };
		}
		return { ok: false, error: err instanceof Error ? err.message : String(err) };
	}
}
