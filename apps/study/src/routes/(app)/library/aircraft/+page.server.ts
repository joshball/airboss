/**
 * `/library/aircraft` -- POH/AFM landing.
 *
 * Lists every authored per-aircraft POH reference (`kind = poh`) as a
 * grid of PohCards. The umbrella `poh-afm` row is excluded because it is
 * the generic landing for citations without a specific aircraft, not an
 * aircraft in its own right.
 */

import { requireAuth } from '@ab/auth';
import { listReferences } from '@ab/bc-study/server';
import { externalUrlForReference, REFERENCE_KINDS, type ReferenceKind } from '@ab/constants';
import type { PageServerLoad } from './$types';

/** Slug of the legacy umbrella row -- excluded from the per-aircraft grid. */
const POH_UMBRELLA_SLUG = 'poh-afm';

function readString(metadata: unknown, key: string): string | null {
	if (metadata === null || typeof metadata !== 'object') return null;
	const value = (metadata as Record<string, unknown>)[key];
	if (typeof value !== 'string') return null;
	if (value.trim() === '') return null;
	return value;
}

function readTopics(metadata: unknown): readonly string[] {
	if (metadata === null || typeof metadata !== 'object') return [];
	const value = (metadata as Record<string, unknown>).topics;
	if (!Array.isArray(value)) return [];
	return value.filter((t): t is string => typeof t === 'string');
}

export interface AircraftCardEntry {
	readonly id: string;
	readonly documentSlug: string;
	readonly title: string;
	readonly aircraftModel: string;
	readonly manufacturer: string;
	readonly revision: string;
	readonly revisionDate: string | null;
	readonly applicableSerialNumbers: string | null;
	readonly description: string | null;
	readonly whyItMatters: string | null;
	readonly topics: readonly string[];
	readonly externalUrl: string | null;
}

export const load: PageServerLoad = async (event) => {
	requireAuth(event);

	const allRefs = await listReferences();
	const aircraft: AircraftCardEntry[] = allRefs
		.filter((ref) => ref.kind === REFERENCE_KINDS.POH && ref.documentSlug !== POH_UMBRELLA_SLUG)
		.map((ref) => {
			const refKind = ref.kind as ReferenceKind;
			const metadata = ref.metadata;
			return {
				id: ref.id,
				documentSlug: ref.documentSlug,
				title: ref.title,
				aircraftModel: readString(metadata, 'aircraftModel') ?? ref.documentSlug,
				manufacturer: readString(metadata, 'manufacturer') ?? ref.publisher,
				revision: readString(metadata, 'revision') ?? ref.edition,
				revisionDate: readString(metadata, 'revisionDate'),
				applicableSerialNumbers: readString(metadata, 'applicableSerialNumbers'),
				description: readString(metadata, 'description'),
				whyItMatters: readString(metadata, 'whyItMatters'),
				topics: readTopics(metadata),
				externalUrl: externalUrlForReference(refKind, ref.documentSlug, ref.edition, ref.url),
			};
		})
		.sort((a, b) => a.title.localeCompare(b.title));

	return { aircraft };
};
