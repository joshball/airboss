/**
 * `/library` -- subject-grouped browse over every active reference.
 *
 * Hydrates one card per non-superseded `study.reference` row (handbooks, CFRs,
 * ACs, ACS / PTS, AIM, PCG, NTSB, POH, other). For each row the loader probes
 * whether the reference is "readable in-app" -- meaning it has at least one
 * non-chapter `handbook_section` in the DB -- and computes its external URL
 * via the single-source `externalUrlForReference` helper so the card always
 * builds a link from the same path the citation resolver does.
 *
 * Group-by-subject + filters happen on the client so a chip toggle stays
 * snappy without a server round-trip; the URL state survives reloads.
 */

import { requireAuth } from '@ab/auth';
import {
	getHandbookProgress,
	getReadableReferenceIds,
	type HandbookProgressSummary,
	listReferences,
} from '@ab/bc-study';
import { externalUrlForReference, type ReferenceKind } from '@ab/constants';
import type { PageServerLoad } from './$types';

export interface LibraryReferenceCard {
	id: string;
	documentSlug: string;
	edition: string;
	title: string;
	publisher: string;
	kind: ReferenceKind;
	subjects: readonly string[];
	externalUrl: string | null;
	isReadable: boolean;
	progress: HandbookProgressSummary | null;
}

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const references = await listReferences();
	const readableIds = await getReadableReferenceIds(references.map((r) => r.id));

	const cards: LibraryReferenceCard[] = await Promise.all(
		references.map(async (ref) => {
			const isReadable = readableIds.has(ref.id);
			const progress = isReadable ? await getHandbookProgress(user.id, ref.id) : null;
			const kind = ref.kind as ReferenceKind;
			const externalUrl = externalUrlForReference(kind, ref.documentSlug, ref.edition, ref.url);
			return {
				id: ref.id,
				documentSlug: ref.documentSlug,
				edition: ref.edition,
				title: ref.title,
				publisher: ref.publisher,
				kind,
				subjects: ref.subjects,
				externalUrl,
				isReadable,
				progress,
			};
		}),
	);

	return { cards };
};
