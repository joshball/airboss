// Seed-revert path test (course-reader-and-editor WP, Phase 7).
//
// The hangar editor's per-save flow writes the YAML file, calls
// runCourseSeed, and on failure must revert the file bytes to their
// pre-write state. This test simulates that flow against a tmp
// course directory + the seed pipeline rejecting a duplicate-ordinal
// section file.

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runCourseSeed } from '../course-seed';

let coursesDir: string;
const TEST_SLUG = 'seed-revert-fixture';

beforeAll(() => {
	coursesDir = mkdtempSync(resolve(tmpdir(), 'course-seed-revert-'));
	const courseDir = resolve(coursesDir, TEST_SLUG);
	mkdirSync(resolve(courseDir, 'sections'), { recursive: true });
	writeFileSync(
		resolve(courseDir, 'manifest.yaml'),
		[
			'slug: seed-revert-fixture',
			'kind: instructor',
			'title: Seed Revert Fixture',
			'status: draft',
			"description: ''",
			'',
		].join('\n'),
	);
	// One legitimate section.
	writeFileSync(
		resolve(courseDir, 'sections', 's1.yaml'),
		['code: s1', 'ordinal: 1', 'title: Section One', "body_md: ''", 'steps: []', ''].join('\n'),
	);
});

afterAll(() => {
	rmSync(coursesDir, { recursive: true, force: true });
});

describe('runCourseSeed with rejected YAML', () => {
	it('returns ok=false with a CourseSeedError-shaped message and leaves the file path intact', async () => {
		const courseDir = resolve(coursesDir, TEST_SLUG);
		const collidingPath = resolve(courseDir, 'sections', 's2.yaml');
		const collidingBytes = [
			'code: s2',
			// Duplicate ordinal across sections fires the "duplicate ordinal in
			// course '<slug>' sections" rejection.
			'ordinal: 1',
			'title: Section Two',
			"body_md: ''",
			'steps: []',
			'',
		].join('\n');
		writeFileSync(collidingPath, collidingBytes);

		const result = await runCourseSeed(TEST_SLUG, coursesDir);

		expect(result.ok).toBe(false);
		if (result.ok === false) {
			expect(result.error).toMatch(/duplicate ordinal/);
		}

		// The file the test wrote is still on disk; the seed never deletes
		// authored YAML. The action layer is responsible for the revert (which
		// it does by writing the backup back). This test confirms the seed
		// surfaces the rejection cleanly so the action's revert path can fire.
		const onDisk = readFileSync(collidingPath, 'utf8');
		expect(onDisk).toBe(collidingBytes);
	});
});
