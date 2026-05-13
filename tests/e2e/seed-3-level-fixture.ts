/**
 * E2e fixture seeder for the 3-level course tree
 * (`course/courses/_fixtures/three-level-tree-fixture/`).
 *
 * The seed pipeline at `scripts/db/seed-courses.ts` skips the `_fixtures/`
 * top-level directory so test-only courses don't ship in the default
 * reseed. Specs that exercise N-deep tree behaviour (Phase D of
 * course-tree-arbitrary-depth WP) call this helper to opt the fixture
 * into the local e2e DB.
 *
 * Idempotent: runs `seedCourses` with `coursesDir` overridden to the
 * `_fixtures/` directory and `slug` pinned to `three-level-tree-fixture`
 * (matches the manifest's slug + the directory name, per the
 * seed-courses.ts contract that dir name === manifest slug).
 */

import { resolve } from 'node:path';
import { seedCourses } from '../../scripts/db/seed-courses';

/** Slug authored in the manifest + used as the directory name. */
export const THREE_LEVEL_FIXTURE_SLUG = 'three-level-tree-fixture';

/** Repo root relative to this file (`tests/e2e/` -> `../..`). */
const REPO_ROOT = resolve(__dirname, '..', '..');
const FIXTURES_DIR = resolve(REPO_ROOT, 'course/courses/_fixtures');

export async function seedThreeLevelFixture(): Promise<{ slug: string; stepsUpserted: number }> {
	const summary = await seedCourses({
		coursesDir: FIXTURES_DIR,
		slug: THREE_LEVEL_FIXTURE_SLUG,
		seedOrigin: 'e2e-three-level-fixture',
	});
	return { slug: THREE_LEVEL_FIXTURE_SLUG, stepsUpserted: summary.stepsUpserted };
}
