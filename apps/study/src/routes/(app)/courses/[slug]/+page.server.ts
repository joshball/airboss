import { requireAuth } from '@ab/auth';
import {
	courseLens,
	courseWithCertOverlayLens,
	getCourseBySlug,
	getCourseStepsByCourse,
	getPrimaryGoal,
	pickOverlaySyllabus,
} from '@ab/bc-study/server';
import { COURSE_STATUSES, COURSE_STEP_LEVELS, type CourseStatus } from '@ab/constants';
import { db } from '@ab/db/connection';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * `/courses/[slug]` detail loader.
 *
 * 1. Resolve the course; 404 on missing or `status='draft'` (drafts are hidden
 *    from the study reader by design).
 * 2. Resolve the learner's primary goal (null when no goal set; lens still
 *    runs but returns the empty result with `mastery: null` per leaf).
 * 3. Pick the overlay syllabus -- highest-weight `goal_syllabus`, ties broken
 *    by `syllabus_id ASC`. Null when goal has no syllabi.
 * 4. Run `courseWithCertOverlayLens` when an overlay syllabus is present;
 *    otherwise run `courseLens` (no certGaps panel).
 */
export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const slug = event.params.slug;

	const course = await getCourseBySlug(slug);
	if (!course || (course.status as CourseStatus) === COURSE_STATUSES.DRAFT) {
		error(404, `Course not found: ${slug}`);
	}

	const primaryGoal = await getPrimaryGoal(user.id);
	const overlaySyllabusId = await pickOverlaySyllabus(primaryGoal);

	const [lensResult, allSteps] = await Promise.all([
		overlaySyllabusId !== null
			? courseWithCertOverlayLens(db, user.id, {
					goal: primaryGoal,
					filters: { courseId: course.id, syllabusId: overlaySyllabusId },
				})
			: courseLens(db, user.id, {
					goal: primaryGoal,
					filters: { courseId: course.id },
				}),
		getCourseStepsByCourse(course.id),
	]);

	// Lens leaves carry `course_step.id` but step reader URLs use the
	// authored `course_step.code`. Build a map from leaf id (== step row id)
	// to its code so the page can build links without a per-row query.
	const stepCodeByLeafId: Record<string, string> = {};
	for (const step of allSteps) {
		if (step.level === COURSE_STEP_LEVELS.STEP) {
			stepCodeByLeafId[step.id] = step.code;
		}
	}

	return {
		course: {
			id: course.id,
			slug: course.slug,
			title: course.title,
			description: course.description,
			status: course.status as CourseStatus,
		},
		lensResult,
		overlayActive: overlaySyllabusId !== null,
		overlaySyllabusId,
		stepCodeByLeafId,
	};
};
