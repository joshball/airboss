/**
 * `/library/aircraft/[slug]` -- POH/AFM detail surface.
 *
 * POH/AFM data lives outside the public-document model -- the FAA doesn't
 * publish it, manufacturers do, and the bytes belong on the operator's
 * device, not in the platform. The detail page renders the V3.5 PohCard
 * with manufacturer voice + topic chips + why-it-matters expander, all
 * sourced from `aircraft/_authoring/poh.yaml` and merged into
 * `reference.metadata` by the seed step.
 */

import { requireAuth } from '@ab/auth';
import { parseAircraftSlug } from '@ab/aviation';
import { listReferences } from '@ab/bc-study/server';
import { externalUrlForReference, REFERENCE_KINDS, type ReferenceKind } from '@ab/constants';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Pull a string field off a JSONB metadata blob safely. Returns `null` for
 * anything that isn't a non-empty string -- the validator counts the
 * empty-string and null cases identically as "missing".
 */
function readString(metadata: unknown, key: string): string | null {
	if (metadata === null || typeof metadata !== 'object') return null;
	const value = (metadata as Record<string, unknown>)[key];
	if (typeof value !== 'string') return null;
	if (value.trim() === '') return null;
	return value;
}

/**
 * Read the `topics` array off a JSONB metadata blob. Returns an empty
 * array for anything not a string array. Topic strings are validated
 * against `AVIATION_TOPIC_VALUES` at seed time, so a value here is always
 * a known topic slug.
 */
function readTopics(metadata: unknown): readonly string[] {
	if (metadata === null || typeof metadata !== 'object') return [];
	const value = (metadata as Record<string, unknown>).topics;
	if (!Array.isArray(value)) return [];
	return value.filter((t): t is string => typeof t === 'string');
}

export const load: PageServerLoad = async (event) => {
	requireAuth(event);
	const slug = parseAircraftSlug(event.params.slug);
	if (!slug) throw error(404, 'Aircraft not found.');

	const refs = await listReferences();
	const ref = refs.find((r) => r.kind === REFERENCE_KINDS.POH && r.documentSlug === slug);
	if (!ref) throw error(404, 'Aircraft not found.');

	const refKind = ref.kind as ReferenceKind;
	const metadata = ref.metadata;
	return {
		reference: {
			id: ref.id,
			documentSlug: ref.documentSlug,
			edition: ref.edition,
			title: ref.title,
			publisher: ref.publisher,
			kind: refKind,
			subjects: ref.subjects as readonly string[],
			externalUrl: externalUrlForReference(refKind, ref.documentSlug, ref.edition, ref.url),
			// Card-copy projection -- mirrors the audit-page shape so the
			// PohCard renders the same fields regardless of surface.
			aircraftModel: readString(metadata, 'aircraftModel') ?? ref.documentSlug,
			manufacturer: readString(metadata, 'manufacturer') ?? ref.publisher,
			revision: readString(metadata, 'revision') ?? ref.edition,
			revisionDate: readString(metadata, 'revisionDate'),
			applicableSerialNumbers: readString(metadata, 'applicableSerialNumbers'),
			description: readString(metadata, 'description'),
			whyItMatters: readString(metadata, 'whyItMatters'),
			topics: readTopics(metadata),
		},
	};
};
