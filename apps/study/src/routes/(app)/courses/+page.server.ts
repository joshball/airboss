import { requireAuth } from '@ab/auth';
import { courseLens, getCoursesByGoal, getPrimaryGoal, listCoursesForReader } from '@ab/bc-study/server';
import { COURSE_STATUSES, type CourseStatus } from '@ab/constants';
import { db } from '@ab/db/connection';
import type { PageServerLoad } from './$types';

export interface CourseListEntry {
	id: string;
	slug: string;
	title: string;
	description: string;
	status: CourseStatus;
	inGoal: boolean;
	mastery: { totalLeaves: number; masteredLeaves: number; coverageFraction: number; masteryFraction: number } | null;
}

/**
 * `/courses` index loader.
 *
 * Pulls every course visible to the reader (active + archived; drafts
 * hidden) and, when the learner has a primary goal, runs `courseLens`
 * for each course-in-goal to surface a per-course mastery rollup. Pinned
 * "in goal" rows sort to the top; the rest sort by title ascending.
 */
export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);

	const [allCourses, primaryGoal] = await Promise.all([
		listCoursesForReader(undefined, { statusIn: [COURSE_STATUSES.ACTIVE, COURSE_STATUSES.ARCHIVED] }),
		getPrimaryGoal(user.id),
	]);

	const goalCourseIds =
		primaryGoal === null ? new Set<string>() : new Set((await getCoursesByGoal(primaryGoal.id)).map((c) => c.id));

	// Per-course mastery rollup runs only for courses in the learner's goal.
	// `courseLens` walks the tree + per-node evidence; running it for every
	// course on every render would be wasteful. Goal-less rows render with
	// `mastery: null` (the page decides how to label that).
	const masteryByCourse = new Map<string, CourseListEntry['mastery']>();
	if (primaryGoal !== null && goalCourseIds.size > 0) {
		const lensResults = await Promise.all(
			[...goalCourseIds].map(async (courseId) => {
				const result = await courseLens(db, user.id, {
					goal: primaryGoal,
					filters: { courseId },
				});
				return [courseId, result.rollup] as const;
			}),
		);
		for (const [courseId, rollup] of lensResults) {
			masteryByCourse.set(courseId, {
				totalLeaves: rollup.totalLeaves,
				masteredLeaves: rollup.masteredLeaves,
				coverageFraction: rollup.coverageFraction,
				masteryFraction: rollup.masteryFraction,
			});
		}
	}

	const entries: CourseListEntry[] = allCourses.map((c) => ({
		id: c.id,
		slug: c.slug,
		title: c.title,
		description: c.description,
		status: c.status as CourseStatus,
		inGoal: goalCourseIds.has(c.id),
		mastery: masteryByCourse.get(c.id) ?? null,
	}));

	// Pin in-goal rows to the top, then alphabetical-by-title.
	entries.sort((a, b) => {
		if (a.inGoal !== b.inGoal) return a.inGoal ? -1 : 1;
		return a.title.localeCompare(b.title);
	});

	return {
		courses: entries,
		hasGoal: primaryGoal !== null,
	};
};
