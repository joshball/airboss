/**
 * `/handbooks` -- index of every active handbook.
 *
 * Lists one card per non-superseded `study.reference` row. Per-handbook
 * progress is computed against the current user (count of `read` and
 * `reading` sections vs. total non-chapter rows).
 */

import { requireAuth } from '@ab/auth';
import { getHandbookProgress, listReferences } from '@ab/bc-study';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const references = await listReferences();
	const progress = await Promise.all(
		references.map(async (ref) => ({
			referenceId: ref.id,
			summary: await getHandbookProgress(user.id, ref.id),
		})),
	);
	const progressByRef = new Map(progress.map((p) => [p.referenceId, p.summary]));

	return {
		references: references.map((ref) => ({
			id: ref.id,
			documentSlug: ref.documentSlug,
			edition: ref.edition,
			title: ref.title,
			publisher: ref.publisher,
			progress: progressByRef.get(ref.id) ?? {
				totalSections: 0,
				readSections: 0,
				readingSections: 0,
				unreadSections: 0,
				comprehendedSections: 0,
			},
		})),
	};
};
