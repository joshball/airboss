import { requireAuth } from '@ab/auth';
import { getHandbookProgress, listReferences, type ReferenceRow } from '@ab/bc-study';
import type { PageServerLoad } from './$types';

export interface HandbookLensIndexEntry {
	reference: ReferenceRow;
	progress: Awaited<ReturnType<typeof getHandbookProgress>>;
}

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const references = await listReferences();
	// Show only handbook-kind references; ADR 020 says the active edition is
	// the non-superseded row per documentSlug. listReferences returns active by
	// default (no superseded rows).
	const handbooks = references.filter((r) => r.kind === 'handbook');
	const entries: HandbookLensIndexEntry[] = await Promise.all(
		handbooks.map(async (ref) => ({
			reference: ref,
			progress: await getHandbookProgress(user.id, ref.id),
		})),
	);
	entries.sort((a, b) => a.reference.title.localeCompare(b.reference.title));
	return { entries };
};
