import { requireAuth } from '@ab/auth';
import {
	getHandbookProgressMap,
	getReadableReferenceIds,
	type HandbookProgressSummary,
	listReferences,
	type ReferenceRow,
} from '@ab/bc-study/server';
import { REFERENCE_KINDS } from '@ab/constants';
import { createLogger } from '@ab/utils';
import type { PageServerLoad } from './$types';

const log = createLogger('study:lens-handbook-index');

export interface HandbookLensIndexEntry {
	reference: ReferenceRow;
	progress: HandbookProgressSummary;
}

const ZERO_PROGRESS: HandbookProgressSummary = {
	totalSections: 0,
	readSections: 0,
	readingSections: 0,
	unreadSections: 0,
	comprehendedSections: 0,
};

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	try {
		const references = await listReferences();
		// Show only handbook-kind references with ingested chapters.
		// `course/references/handbooks-noningested.yaml` seeds prior-edition
		// anchor rows (e.g. AFH 3B) so historical citations resolve, but those
		// rows have no `reference_section` chapters and don't belong on a
		// browse-by-chapter lens. Filter on body presence via the readable-ids
		// probe, not on document_slug, so the rule generalises to any future
		// citation-anchor entry.
		const allHandbooks = references.filter((r) => r.kind === REFERENCE_KINDS.HANDBOOK);
		const readableIds = await getReadableReferenceIds(allHandbooks.map((h) => h.id));
		const handbooks = allHandbooks.filter((h) => readableIds.has(h.id));
		const dropped = allHandbooks.length - handbooks.length;
		if (dropped > 0) {
			log.debug('filtered out handbook rows with zero ingested chapters', {
				dropped,
				droppedSlugs: allHandbooks.filter((h) => !readableIds.has(h.id)).map((h) => `${h.documentSlug}@${h.edition}`),
			});
		}
		// Batched progress: one BC call returns a summary per handbook instead of
		// N independent `getHandbookProgress` round trips.
		const progressById = await getHandbookProgressMap(
			user.id,
			handbooks.map((h) => h.id),
		);
		const entries: HandbookLensIndexEntry[] = handbooks.map((ref) => ({
			reference: ref,
			progress: progressById.get(ref.id) ?? ZERO_PROGRESS,
		}));
		entries.sort((a, b) => a.reference.title.localeCompare(b.reference.title));
		log.debug('loaded handbook lens index', { handbookCount: entries.length });
		return { entries };
	} catch (err) {
		log.error('failed to load handbook lens index', { error: err });
		throw err;
	}
};
