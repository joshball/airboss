/**
 * Study courses index loader (course-reader-and-editor WP, Phase 3).
 *
 * Lists every active or archived instructor-authored course. Drafts are
 * hidden from the learner per spec.md ("Course in `status='draft'`: hidden
 * from study-app reader (404). Visible in hangar editor (any status).").
 *
 * Per-row mastery rollup:
 *   - When the learner has a primary goal that holds a `goal_course` row
 *     for this course, the row carries the matching course-level
 *     `MasteryRollup` from `courseLens`. The rollup is computed lazily --
 *     one lens call per "in-goal" course -- so a goal that holds 0 courses
 *     pays zero lens cost.
 *   - When the course is NOT in the goal (or there is no primary goal), the
 *     row carries an empty rollup so the UI can render zero state without
 *     branching.
 *
 * Goal-pinned ordering: courses currently in the primary goal pin to the
 * top, then everything else by title ASC. The pinning key lives on every
 * row (`inGoal: boolean`) so the page can render a divider / badge.
 */

import { requireAuth } from '@ab/auth';
import {
	type CourseRow,
	courseLens,
	getCoursesByGoal,
	getPrimaryGoal,
	listCoursesForReader,
	type MasteryRollup,
} from '@ab/bc-study/server';
import { COURSE_STATUSES } from '@ab/constants';
import { db } from '@ab/db/connection';
import type { PageServerLoad } from './$types';

export interface CourseIndexRow {
	course: CourseRow;
	inGoal: boolean;
	rollup: MasteryRollup;
}

const EMPTY_ROLLUP: MasteryRollup = {
	totalLeaves: 0,
	coveredLeaves: 0,
	masteredLeaves: 0,
	masteryFraction: 0,
	coverageFraction: 0,
	byEvidenceKind: {},
};

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const [courses, primaryGoal] = await Promise.all([
		listCoursesForReader(db, { statusIn: [COURSE_STATUSES.ACTIVE, COURSE_STATUSES.ARCHIVED] }),
		getPrimaryGoal(user.id),
	]);
	const goalCourses = primaryGoal !== null ? await getCoursesByGoal(primaryGoal.id) : [];
	const goalCourseIds = new Set(goalCourses.map((c) => c.id));

	// Per-row rollup. Only courses in the goal need a lens call; courses
	// outside the goal carry an empty rollup (the lens for those would
	// short-circuit to the empty result anyway because there's no
	// goal_course row -- see lenses-course.ts "goal has no goal_course
	// row" path).
	const rollupByCourseId = new Map<string, MasteryRollup>();
	if (primaryGoal !== null && goalCourseIds.size > 0) {
		// Sequential per-course lens calls would N+1 here. The lens runs
		// one per course because every course has its own tree; parallelize
		// via Promise.all so the loader stays under the per-render budget
		// even when the goal holds many courses.
		const lensResults = await Promise.all(
			Array.from(goalCourseIds).map(async (courseId) => {
				const result = await courseLens(db, user.id, {
					goal: primaryGoal,
					filters: { courseId },
				});
				return { courseId, rollup: result.rollup };
			}),
		);
		for (const { courseId, rollup } of lensResults) {
			rollupByCourseId.set(courseId, rollup);
		}
	}

	const rows: CourseIndexRow[] = courses.map((course) => ({
		course,
		inGoal: goalCourseIds.has(course.id),
		rollup: rollupByCourseId.get(course.id) ?? EMPTY_ROLLUP,
	}));

	// Pin in-goal courses to the top; lexically sort within each bucket
	// (the BC already returned them by title ASC, but the partition step
	// can scramble the order).
	rows.sort((a, b) => {
		if (a.inGoal !== b.inGoal) return a.inGoal ? -1 : 1;
		return a.course.title.localeCompare(b.course.title);
	});

	return {
		rows,
		hasPrimaryGoal: primaryGoal !== null,
	};
};
