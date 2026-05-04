import { requireAuth } from '@ab/auth';
import { getHandbookProgressMap, type HandbookProgressSummary, listReferences, type ReferenceRow } from '@ab/bc-study';
import { REFERENCE_KINDS } from '@ab/constants';
import type { PageServerLoad } from './$types';

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
	const references = await listReferences();
	// Show only handbook-kind references; ADR 020 says the active edition is
	// the non-superseded row per documentSlug. listReferences returns active by
	// default (no superseded rows).
	const handbooks = references.filter((r) => r.kind === REFERENCE_KINDS.HANDBOOK);
	// Batched progress: one BC call returns a summary per handbook instead of
	// N independent `getHandbookProgress` round trips. See
	// `getHandbookProgressMap` in `@ab/bc-study/references.ts`. Closes the
	// chunk-1 perf MAJOR / backend MAJOR N+1 (review-tail-2026-05).
	const progressById = await getHandbookProgressMap(
		user.id,
		handbooks.map((h) => h.id),
	);
	const entries: HandbookLensIndexEntry[] = handbooks.map((ref) => ({
		reference: ref,
		progress: progressById.get(ref.id) ?? ZERO_PROGRESS,
	}));
	entries.sort((a, b) => a.reference.title.localeCompare(b.reference.title));
	return { entries };
};
