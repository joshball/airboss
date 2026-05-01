/**
 * `/library/regulations` -- top-level regulations & policy index.
 *
 * Lists each `LIBRARY_REGULATIONS_KIND` bucket with the number of active
 * references inside. Buckets with zero references render as muted cards so
 * the structure stays visible while seeding catches up.
 */

import { requireAuth } from '@ab/auth';
import { listReferences } from '@ab/bc-study';
import {
	LIBRARY_REGULATIONS_KIND_LABELS,
	LIBRARY_REGULATIONS_KIND_VALUES,
	type LibraryRegulationsKind,
	REFERENCE_KINDS,
	type ReferenceKind,
} from '@ab/constants';
import type { PageServerLoad } from './$types';

interface BucketView {
	kind: LibraryRegulationsKind;
	label: string;
	count: number;
}

function bucketMatches(kind: LibraryRegulationsKind, refKind: ReferenceKind, slug: string): boolean {
	switch (kind) {
		case '14-cfr':
			return refKind === REFERENCE_KINDS.CFR && slug.startsWith('14cfr');
		case '49-cfr':
			return refKind === REFERENCE_KINDS.CFR && slug.startsWith('49cfr');
		case 'aim':
			return refKind === REFERENCE_KINDS.AIM || refKind === REFERENCE_KINDS.PCG;
		case 'ac':
			return refKind === REFERENCE_KINDS.AC;
		case 'ntsb':
			return refKind === REFERENCE_KINDS.NTSB;
	}
}

export const load: PageServerLoad = async (event) => {
	requireAuth(event);
	const refs = await listReferences();

	const buckets: BucketView[] = LIBRARY_REGULATIONS_KIND_VALUES.map((kind) => {
		const count = refs.reduce(
			(acc, ref) => (bucketMatches(kind, ref.kind as ReferenceKind, ref.documentSlug) ? acc + 1 : acc),
			0,
		);
		return { kind, label: LIBRARY_REGULATIONS_KIND_LABELS[kind], count };
	});

	return { buckets };
};
