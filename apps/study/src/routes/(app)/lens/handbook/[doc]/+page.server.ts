import { requireAuth } from '@ab/auth';
import {
	getReferenceByDocument,
	type HandbookSectionRow,
	listHandbookChapters,
	ReferenceNotFoundError,
	type ReferenceRow,
} from '@ab/bc-study';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export interface DocLensData {
	reference: ReferenceRow;
	chapters: HandbookSectionRow[];
}

export const load: PageServerLoad = async (event) => {
	requireAuth(event);
	const doc = event.params.doc;
	let reference: ReferenceRow;
	try {
		reference = await getReferenceByDocument(doc);
	} catch (err) {
		if (err instanceof ReferenceNotFoundError) {
			throw error(404, `Handbook '${doc}' not found.`);
		}
		throw err;
	}
	const chapters = await listHandbookChapters(reference.id);
	return { reference, chapters } satisfies DocLensData;
};
