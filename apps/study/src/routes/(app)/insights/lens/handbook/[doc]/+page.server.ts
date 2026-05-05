import { requireAuth } from '@ab/auth';
import {
	getReferenceByDocument,
	listHandbookChapters,
	ReferenceNotFoundError,
	type ReferenceRow,
	type ReferenceSectionRow,
} from '@ab/bc-study';
import { createLogger } from '@ab/utils';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const log = createLogger('study:lens-handbook-doc');

export interface DocLensData {
	reference: ReferenceRow;
	chapters: ReferenceSectionRow[];
}

export const load: PageServerLoad = async (event) => {
	requireAuth(event);
	const doc = event.params.doc;
	let reference: ReferenceRow;
	try {
		reference = await getReferenceByDocument(doc);
	} catch (err) {
		if (err instanceof ReferenceNotFoundError) {
			log.warn('handbook not found', { doc });
			throw error(404, `Handbook '${doc}' not found.`);
		}
		log.error('failed to resolve handbook', { doc, error: err });
		throw err;
	}
	const chapters = await listHandbookChapters(reference.id);
	if (chapters.length === 0) {
		// Empty chapters on a resolved handbook means seeding produced a
		// reference row but no reference_section rows for it -- usually a stale
		// pre-naming-convention duplicate (e.g. `8083-3B`) shadowing the real
		// row. The operator should run `bun run db reset` to wipe and reseed.
		log.warn('handbook resolved but has zero chapters', {
			doc,
			referenceId: reference.id,
			edition: reference.edition,
		});
	}
	return { reference, chapters } satisfies DocLensData;
};
