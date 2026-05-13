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
 *   - Course `status === 'draft'` (drafts hidden from the learner per
 *     spec.md "Course in `status='draft'`")
 *
 * The overlay syllabus is selected by `pickOverlaySyllabus`: highest-weight
 * `goal_syllabus`, ties broken by `syllabus_id ASC` for determinism. A
 * future picker UI is deferred per OUT-OF-SCOPE.
 */

import { requireAuth } from '@ab/auth';
import type { NoteRow } from '@ab/bc-study';
import {
	type CourseRow,
	courseLens,
	courseWithCertOverlayLens,
	getCourseBySlug,
	getCourseStepsByCourse,
	getPrimaryGoal,
	type LensResult,
	listNotesForCourse,
	pickOverlaySyllabus,
} from '@ab/bc-study/server';
import { COURSE_STATUSES } from '@ab/constants';
import { db } from '@ab/db/connection';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

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
	 * The page uses the code for step-reader URLs so they stay grep-able and
	 * shareable. Every row (section, lesson, leaf) is included so the nested
	 * outline can link interior nodes (lesson / section landings) and leaves
	 * alike. The lens does not carry the code -- the loader joins it on.
	 */
	stepCodeById: Record<string, string>;
	/**
	 * Notes the user has captured against this course (wp-notes-primitive
	 * Phase 2). Soft-archived rows are excluded.
	 */
	courseNotes: NoteRow[];
}

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const course = await getCourseBySlug(event.params.slug);
	if (course === null) throw error(404, 'Course not found.');
	if (course.status === COURSE_STATUSES.DRAFT) throw error(404, 'Course not found.');

	const primaryGoal = await getPrimaryGoal(user.id);
	const overlaySyllabusId = await pickOverlaySyllabus(primaryGoal);

	const [lensResult, allSteps, courseNotes] = await Promise.all([
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
	} satisfies CourseDetailData;
};
