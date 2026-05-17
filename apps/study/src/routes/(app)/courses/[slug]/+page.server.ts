/**
 * Study course detail loader (course-reader-and-editor WP, Phase 3).
 *
 * Loads one course by slug and projects it through `courseLens` (no overlay)
 * or `courseWithCertOverlayLens` (overlay) based on whether the learner's
 * primary goal holds at least one syllabus. The lens picks itself per the
 * "one detail-page route, lens picked at load time" decision in design.md.
 *
 * 404s on:
 *   - Slug not found in `study.course`
 *   - Course `status === 'draft'` (drafts hidden from the learner) -- the
 *     draft gate is centralised in `getReaderVisibleCourseBySlug`.
 *
 * The overlay syllabus is selected by `pickOverlaySyllabus`: highest-weight
 * `goal_syllabus`, ties broken by `syllabus_id ASC` for determinism.
 *
 * `addCourse` action: lets a learner add the course to their primary goal
 * straight from the detail page (delegates to the `addGoalCourse` BC helper).
 */

import { requireAuth } from '@ab/auth';
import type { NoteRow } from '@ab/bc-study';
import {
	addGoalCourse,
	CourseAlreadyInGoalError,
	CourseNotActiveError,
	CourseNotFoundError,
	type CourseRow,
	courseLens,
	courseWithCertOverlayLens,
	getCoursesByGoal,
	getCourseStepsByCourse,
	getPrimaryGoal,
	GoalNotFoundError,
	GoalNotOwnedError,
	type LensResult,
	listNotesForCourse,
	pickOverlaySyllabus,
	getReaderVisibleCourseBySlug,
} from '@ab/bc-study/server';
import { error, fail } from '@sveltejs/kit';
import { db } from '@ab/db/connection';
import type { Actions, PageServerLoad } from './$types';

export interface CourseDetailData {
	course: CourseRow;
	lensResult: LensResult;
	overlayActive: boolean;
	/**
	 * Identifier of the cert syllabus the overlay was projected against; null
	 * when no overlay was applied. Surfaced so the page can pass it through
	 * to `aggregateCertCoverage` (Phase E) for the per-lesson / per-section
	 * rollup the renderer displays.
	 */
	overlaySyllabusId: string | null;
	/**
	 * Maps `course_step.id` (`cst_<ulid>` -- the lens-emitted node / leaf id)
	 * to the human-readable `course_step.code` (e.g. `s1.1` or `s1.1.1`).
	 */
	stepCodeById: Record<string, string>;
	/**
	 * Notes the user has captured against this course (wp-notes-primitive
	 * Phase 2). Soft-archived rows are excluded.
	 */
	courseNotes: NoteRow[];
	/** The learner's primary goal id, when set -- drives the add-to-goal CTA. */
	primaryGoalId: string | null;
	/** True when the course is already linked to the learner's primary goal. */
	inGoal: boolean;
}

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const course = await getReaderVisibleCourseBySlug(event.params.slug);
	if (course === null) throw error(404, 'Course not found.');

	const primaryGoal = await getPrimaryGoal(user.id);
	const overlaySyllabusId = await pickOverlaySyllabus(primaryGoal);

	const [lensResult, allSteps, courseNotes, goalCourses] = await Promise.all([
		overlaySyllabusId !== null && primaryGoal !== null
			? courseWithCertOverlayLens(db, user.id, {
					goal: primaryGoal,
					filters: { courseId: course.id, syllabusId: overlaySyllabusId },
				})
			: courseLens(db, user.id, {
					goal: primaryGoal,
					filters: { courseId: course.id },
				}),
		getCourseStepsByCourse(course.id),
		listNotesForCourse(user.id, course.id),
		primaryGoal !== null ? getCoursesByGoal(primaryGoal.id) : Promise.resolve([]),
	]);

	// Map every row (section / lesson / step) -- the recursive renderer
	// produces clickable links for non-leaf rows too (landing pages), so the
	// lookup is no longer leaf-only.
	const stepCodeById: Record<string, string> = {};
	for (const step of allSteps) {
		stepCodeById[step.id] = step.code;
	}

	return {
		course,
		lensResult,
		overlayActive: overlaySyllabusId !== null,
		overlaySyllabusId,
		stepCodeById,
		courseNotes,
		primaryGoalId: primaryGoal?.id ?? null,
		inGoal: goalCourses.some((c) => c.id === course.id),
	} satisfies CourseDetailData;
};

export const actions: Actions = {
	// Add this course to the learner's primary goal -- the detail page's
	// primary call to action. Delegates to the `addGoalCourse` BC helper.
	addCourse: async (event) => {
		const user = requireAuth(event);
		const form = await event.request.formData();
		const goalId = String(form.get('goalId') ?? '').trim();
		const courseId = String(form.get('courseId') ?? '').trim();
		if (goalId === '' || courseId === '') {
			return fail(400, { intent: 'addCourse', error: 'Missing goal or course id.' });
		}
		try {
			await addGoalCourse(goalId, user.id, { courseId, weight: 1.0 });
		} catch (err) {
			if (err instanceof GoalNotFoundError || err instanceof GoalNotOwnedError) {
				return fail(404, { intent: 'addCourse', error: 'Goal not found.' });
			}
			if (err instanceof CourseNotFoundError) {
				return fail(400, { intent: 'addCourse', error: 'Course not found.' });
			}
			if (err instanceof CourseNotActiveError) {
				return fail(400, { intent: 'addCourse', error: 'Course is not active.' });
			}
			if (err instanceof CourseAlreadyInGoalError) {
				return fail(400, { intent: 'addCourse', error: 'Course already in goal.' });
			}
			throw err;
		}
		return { intent: 'addCourse', success: true };
	},
};
