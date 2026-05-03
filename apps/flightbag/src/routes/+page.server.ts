/**
 * Flightbag landing -- the canonical browse view over every FAA reference
 * the platform has ingested.
 *
 * Pulls live data from `study.reference` (and indirectly `study.reference_section`
 * via the BC's "has body" probe). Groups references by kind into the buckets a
 * pilot actually thinks about: Handbooks, AIM, 14 CFR, 49 CFR, Advisory
 * Circulars, ACS, with an "Other references" bucket for the long tail. Every
 * card resolves to its in-app landing route (or to an external eCFR / AC
 * index when the corpus has no inline section content yet).
 */

import { getReadableReferenceIds, listReferences } from '@ab/bc-study';
import { externalUrlForReference, REFERENCE_KINDS, type ReferenceKind } from '@ab/constants';
import type { PageServerLoad } from './$types';
import { readerUrlFor } from './reader-url';

export interface FlightbagReferenceCard {
	readonly id: string;
	readonly kind: ReferenceKind;
	readonly documentSlug: string;
	readonly edition: string;
	readonly title: string;
	readonly publisher: string;
	readonly subjects: readonly string[];
	/** In-app reader URL when the corpus is wired up; null when only an external link is available. */
	readonly readerUrl: string | null;
	/** External fallback URL (eCFR Part, FAA AC index, etc.); null when not applicable. */
	readonly externalUrl: string | null;
	/** True when at least one `reference_section` row carries body content -- signal for "Read in-app". */
	readonly hasInlineBody: boolean;
}

export interface FlightbagGroup {
	readonly id: string;
	readonly label: string;
	readonly subtitle: string;
	readonly cards: readonly FlightbagReferenceCard[];
}

interface BucketDef {
	readonly id: string;
	readonly label: string;
	readonly subtitle: string;
	readonly match: (ref: { kind: ReferenceKind; documentSlug: string }) => boolean;
}

/**
 * Bucket order on the page is intentional: handbooks first (most-read), then
 * AIM (operational reference), then federal regulations split by Title (the
 * shape pilots think in), then advisory material, then test standards, then
 * the long tail. Empty buckets are dropped at render-time.
 */
const BUCKET_DEFS: readonly BucketDef[] = [
	{
		id: 'handbooks',
		label: 'Handbooks',
		subtitle: 'FAA aeronautical handbooks (PHAK, AFH, AvWX, IFH, IPH, RMH, AIH, plus specialty handbooks).',
		match: (ref) => ref.kind === REFERENCE_KINDS.HANDBOOK,
	},
	{
		id: 'aim',
		label: 'AIM',
		subtitle: 'Aeronautical Information Manual + Pilot/Controller Glossary.',
		match: (ref) => ref.kind === REFERENCE_KINDS.AIM || ref.kind === REFERENCE_KINDS.PCG,
	},
	{
		id: 'cfr14',
		label: '14 CFR -- Aeronautics & Space',
		subtitle: 'Title 14 of the Code of Federal Regulations: airworthiness, certification, operating rules.',
		match: (ref) => ref.kind === REFERENCE_KINDS.CFR && ref.documentSlug.startsWith('14cfr'),
	},
	{
		id: 'cfr49',
		label: '49 CFR -- Transportation',
		subtitle: 'Title 49 Parts that touch aviation operations (NTSB notification, TSA flight-school program).',
		match: (ref) => ref.kind === REFERENCE_KINDS.CFR && ref.documentSlug.startsWith('49cfr'),
	},
	{
		id: 'ac',
		label: 'Advisory Circulars',
		subtitle: 'FAA guidance ACs -- weather, flight test, operations, training.',
		match: (ref) => ref.kind === REFERENCE_KINDS.AC,
	},
	{
		id: 'acs',
		label: 'Airman Certification Standards',
		subtitle: 'Knowledge / risk-management / skill standards for each pilot certificate and rating.',
		match: (ref) => ref.kind === REFERENCE_KINDS.ACS || ref.kind === REFERENCE_KINDS.PTS,
	},
	{
		id: 'other',
		label: 'Other references',
		subtitle: 'NTSB archive, charts, orders, third-party research, POH umbrella.',
		match: (ref) =>
			ref.kind === REFERENCE_KINDS.NTSB || ref.kind === REFERENCE_KINDS.POH || ref.kind === REFERENCE_KINDS.OTHER,
	},
];

export const load: PageServerLoad = async () => {
	const refs = await listReferences();
	const readableIds = await getReadableReferenceIds(refs.map((r) => r.id));

	const cards: FlightbagReferenceCard[] = refs.map((ref) => {
		const refKind = ref.kind as ReferenceKind;
		const reader = readerUrlFor(refKind, ref.documentSlug, ref.edition);
		const external = externalUrlForReference(refKind, ref.documentSlug, ref.edition, ref.url);
		return {
			id: ref.id,
			kind: refKind,
			documentSlug: ref.documentSlug,
			edition: ref.edition,
			title: ref.title,
			publisher: ref.publisher,
			subjects: [...ref.subjects],
			readerUrl: reader,
			externalUrl: external,
			hasInlineBody: readableIds.has(ref.id),
		};
	});

	const groups: FlightbagGroup[] = BUCKET_DEFS.map((def) => {
		const matching = cards
			.filter((c) => def.match({ kind: c.kind, documentSlug: c.documentSlug }))
			.sort((a, b) => a.title.localeCompare(b.title));
		return {
			id: def.id,
			label: def.label,
			subtitle: def.subtitle,
			cards: matching,
		};
	}).filter((g) => g.cards.length > 0);

	const totalReferences = cards.length;

	return {
		groups,
		totalReferences,
	};
};
