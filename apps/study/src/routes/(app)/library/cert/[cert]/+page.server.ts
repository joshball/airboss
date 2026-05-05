/**
 * `/library/cert/[cert]` -- per-cert reference list with carryover sidebar.
 *
 * The cert spine: every reference whose `primary_cert` equals `[cert]`,
 * plus per-prereq carryover groups derived from the credential prereq DAG
 * (see `library-by-cert` BC).
 */

import { requireAuth } from '@ab/auth';
import { parseCertSlug } from '@ab/aviation';
import { getReadableReferenceIds, getReferencesForCertWithCarryover } from '@ab/bc-study/server';
import {
	CERT_APPLICABILITY_LABELS,
	type CertApplicability,
	externalUrlForReference,
	type ReferenceKind,
} from '@ab/constants';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

interface CardView {
	id: string;
	documentSlug: string;
	edition: string;
	title: string;
	publisher: string;
	kind: ReferenceKind;
	subjects: readonly string[];
	externalUrl: string | null;
	isReadable: boolean;
}

interface CarryoverView {
	fromCert: CertApplicability;
	label: string;
	cards: CardView[];
}

export const load: PageServerLoad = async (event) => {
	requireAuth(event);
	const cert = parseCertSlug(event.params.cert);
	if (!cert) {
		throw error(404, `Unknown cert: ${event.params.cert}`);
	}

	const bundle = await getReferencesForCertWithCarryover(cert);

	const allRefs = [...bundle.primary, ...bundle.carryover.flatMap((c) => c.refs)];
	const readableIds = await getReadableReferenceIds(allRefs.map((r) => r.id));

	const toCard = (ref: (typeof allRefs)[number]): CardView => {
		const kind = ref.kind as ReferenceKind;
		return {
			id: ref.id,
			documentSlug: ref.documentSlug,
			edition: ref.edition,
			title: ref.title,
			publisher: ref.publisher,
			kind,
			subjects: ref.subjects as readonly string[],
			externalUrl: externalUrlForReference(kind, ref.documentSlug, ref.edition, ref.url),
			isReadable: readableIds.has(ref.id),
		};
	};

	const primary: CardView[] = bundle.primary.map(toCard);
	const carryover: CarryoverView[] = bundle.carryover.map((group) => ({
		fromCert: group.fromCert,
		label: group.label,
		cards: group.refs.map(toCard),
	}));

	return {
		cert,
		certLabel: CERT_APPLICABILITY_LABELS[cert],
		primary,
		carryover,
	};
};
