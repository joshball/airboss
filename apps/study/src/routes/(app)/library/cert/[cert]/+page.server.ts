/**
 * `/library/cert/[cert]` -- per-cert reference list with carryover sidebar.
 *
 * The cert spine: every reference whose `primary_cert` equals `[cert]`,
 * plus per-prereq carryover groups derived from the credential prereq DAG
 * (see `library-by-cert` BC).
 */

import { requireAuth } from '@ab/auth';
import { parseCertSlug } from '@ab/aviation';
import {
	getReadableReferenceIds,
	getReferencesForCertWithCarryover,
	type LibraryCardPayload,
	projectReferenceToLibraryCard,
} from '@ab/bc-study/server';
import { CERT_APPLICABILITY_LABELS, type CertApplicability } from '@ab/constants';
import { buildPartUrl } from '@ab/sources';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

interface CardEntry {
	id: string;
	payload: LibraryCardPayload;
}

interface CarryoverView {
	fromCert: CertApplicability;
	label: string;
	cards: CardEntry[];
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

	const toEntry = (ref: (typeof allRefs)[number]): CardEntry => ({
		id: ref.id,
		payload: projectReferenceToLibraryCard(ref, readableIds.has(ref.id), buildPartUrl),
	});

	const primary: CardEntry[] = bundle.primary.map(toEntry);
	const carryover: CarryoverView[] = bundle.carryover.map((group) => ({
		fromCert: group.fromCert,
		label: group.label,
		cards: group.refs.map(toEntry),
	}));

	return {
		cert,
		certLabel: CERT_APPLICABILITY_LABELS[cert],
		primary,
		carryover,
	};
};
