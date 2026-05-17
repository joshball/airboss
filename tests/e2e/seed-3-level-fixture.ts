/**
 * E2e fixture seeder for the 3-level course tree
 * (`course/courses/_fixtures/three-level-tree-fixture/`).
 *
 * The seed pipeline (`libs/bc/study/src/seed-courses.ts`) skips the
 * `_fixtures/` top-level directory so test-only courses don't ship in the
 * default reseed. Specs that exercise N-deep tree behaviour (Phase D of
 * course-tree-arbitrary-depth WP) call this helper to opt the fixture
 * into the local e2e DB.
 *
 * Idempotent: runs `seedCourses` with `coursesDir` overridden to the
 * `_fixtures/` directory and `slug` pinned to `three-level-tree-fixture`
 * (matches the manifest's slug + the directory name, per the seed
 * pipeline contract that dir name === manifest slug).
 *
 * Also links the fixture course and the dev-seeded `weather-comprehensive`
 * course to Abby's primary goal via `goal_course`. `courseLens` returns
 * an empty tree when a logged-in user's primary goal does not reference
 * the course (matches `acsLens`'s "goal has no syllabi" path); the
 * n-deep spec suite runs as Abby, so the link rows are required for the
 * lens to emit the outline.
 */

import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { seedCourses } from '../../libs/bc/study/src/seed-courses';
import { course, goal, goalCourse } from '../../libs/bc/study/src/schema';
import { DEV_DB_URL_E2E } from '../../libs/constants/src';

/** Slug authored in the manifest + used as the directory name. */
export const THREE_LEVEL_FIXTURE_SLUG = 'three-level-tree-fixture';

/** Slug of the dev-seeded comprehensive course exercised by CT-7 / CT-8. */
const WEATHER_COMP_SLUG = 'weather-comprehensive';

/** seedOrigin tag the e2e suite owns. */
const E2E_GOAL_COURSE_ORIGIN = 'e2e-three-level-fixture';

/** Repo root relative to this file (`tests/e2e/` -> `../..`). */
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const FIXTURES_DIR = resolve(REPO_ROOT, 'course/courses/_fixtures');

export async function seedThreeLevelFixture(): Promise<{
	slug: string;
	stepsUpserted: number;
	stepsSeeded: number;
	goalCoursesLinked: number;
}> {
	const summary = await seedCourses({
		coursesDir: FIXTURES_DIR,
		slug: THREE_LEVEL_FIXTURE_SLUG,
		seedOrigin: E2E_GOAL_COURSE_ORIGIN,
	});

	// Link the fixture course + weather-comprehensive to Abby's primary goal.
	// `courseLens` returns an empty tree when the logged-in user's primary
	// goal does not reference the course; the CT specs render the course
	// outline as Abby and need the link rows to exist.
	const goalCoursesLinked = await linkGoalCourses();

	// `stepsUpserted` counts rows actually written; `stepsSkipped` counts
	// rows whose content_hash matched and were left in place. The fixture
	// is present on disk so the total of the two is the row count the spec
	// can rely on -- idempotent re-runs (no DB wipe between sessions) flip
	// the rows from "upserted" to "skipped" but the fixture is still there.
	return {
		slug: THREE_LEVEL_FIXTURE_SLUG,
		stepsUpserted: summary.stepsUpserted,
		stepsSeeded: summary.stepsUpserted + summary.stepsSkipped,
		goalCoursesLinked,
	};
}

/**
 * Idempotently insert `goal_course` rows that link Abby's primary goal to
 * the courses exercised by the n-deep spec suite. Returns the count of
 * link rows targeted (existing or newly inserted).
 */
async function linkGoalCourses(): Promise<number> {
	const client = postgres(DEV_DB_URL_E2E, { max: 1 });
	const db = drizzle(client);
	try {
		const primaryGoals = await db.select().from(goal).where(eq(goal.isPrimary, true)).limit(1);
		const primaryGoal = primaryGoals[0];
		if (!primaryGoal) return 0;
		const courses = await db.select().from(course);
		const bySlug = new Map(courses.map((c) => [c.slug, c.id] as const));
		const targets = [THREE_LEVEL_FIXTURE_SLUG, WEATHER_COMP_SLUG]
			.map((slug) => bySlug.get(slug))
			.filter((id): id is string => typeof id === 'string');
		for (const courseId of targets) {
			await db
				.insert(goalCourse)
				.values({
					goalId: primaryGoal.id,
					courseId,
					weight: 1.0,
					seedOrigin: E2E_GOAL_COURSE_ORIGIN,
				})
				.onConflictDoNothing();
		}
		return targets.length;
	} finally {
		await client.end();
	}
}
