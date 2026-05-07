/**
 * `/library` -- three-spine landing page.
 *
 * Replaces the old subject-grouped browse with three distinct entry points:
 *   - "By cert"  -> `/library/cert/[cert]`
 *   - "By topic" -> `/library/topic/[topic]`
 *   - "Regulations & policy" -> `/library/regulations/[kind]`
 *   - "Aircraft-specific"    -> `/library/aircraft/[slug]` (POH/AFM)
 *
 * Counts are pre-aggregated server-side so each card on the landing page can
 * show its size without an N+1 fetch on the client. See
 * `docs/work-packages/library-by-cert/spec.md`.
 */

import { requireAuth } from '@ab/auth';
import { getReferenceCountsByCert, getReferenceCountsByTopic, listReferences } from '@ab/bc-study/server';
import {
	AVIATION_TOPIC_VALUES,
	CERT_APPLICABILITY_VALUES,
	type CertApplicability,
	LIBRARY_REGULATIONS_KIND_VALUES,
	LIBRARY_REGULATIONS_KINDS,
	LIBRARY_TESTING_KIND_VALUES,
	LIBRARY_TESTING_KINDS,
	type LibraryRegulationsKind,
	type LibraryTestingKind,
	REFERENCE_KINDS,
	type ReferenceKind,
} from '@ab/constants';
import type { PageServerLoad } from './$types';

interface CertSpineEntry {
	cert: CertApplicability;
	count: number;
}

interface TopicSpineEntry {
	topic: string;
	count: number;
}

interface RegulationsBucket {
	kind: LibraryRegulationsKind;
	count: number;
}

interface TestingBucket {
	kind: LibraryTestingKind;
	count: number;
}

interface AircraftEntry {
	id: string;
	documentSlug: string;
	title: string;
}

/**
 * Map a `LibraryRegulationsKind` slug to the predicate that tests whether a
 * `study.reference` row belongs in that bucket.
 *
 * - `14-cfr` / `49-cfr`: `kind = cfr` AND slug starts with `14cfr` / `49cfr`.
 * - `aim`: `kind = aim` OR `pcg` (the Pilot/Controller Glossary belongs
 *   under AIM since it ships with the AIM publication).
 * - `ac`: `kind = ac`.
 * - `ntsb`: `kind = ntsb`.
 */
function regulationsBucketMatcher(
	kind: LibraryRegulationsKind,
): (ref: { kind: ReferenceKind; documentSlug: string }) => boolean {
	switch (kind) {
		case LIBRARY_REGULATIONS_KINDS.CFR_14:
			return (ref) => ref.kind === REFERENCE_KINDS.CFR && ref.documentSlug.startsWith('14cfr');
		case LIBRARY_REGULATIONS_KINDS.CFR_49:
			return (ref) => ref.kind === REFERENCE_KINDS.CFR && ref.documentSlug.startsWith('49cfr');
		case LIBRARY_REGULATIONS_KINDS.AIM:
			return (ref) => ref.kind === REFERENCE_KINDS.AIM || ref.kind === REFERENCE_KINDS.PCG;
		case LIBRARY_REGULATIONS_KINDS.AC:
			return (ref) => ref.kind === REFERENCE_KINDS.AC;
		case LIBRARY_REGULATIONS_KINDS.NTSB:
			return (ref) => ref.kind === REFERENCE_KINDS.NTSB;
		default: {
			const exhaustive: never = kind;
			throw new Error(`Unknown regulations kind: ${exhaustive as string}`);
		}
	}
}

export const load: PageServerLoad = async (event) => {
	requireAuth(event);

	const [certCounts, topicCounts, allRefs] = await Promise.all([
		getReferenceCountsByCert(),
		getReferenceCountsByTopic(),
		listReferences(),
	]);

	const certSpine: CertSpineEntry[] = CERT_APPLICABILITY_VALUES.map((cert) => ({
		cert,
		count: certCounts[cert] ?? 0,
	}));

	const topicSpine: TopicSpineEntry[] = AVIATION_TOPIC_VALUES.map((topic) => ({
		topic,
		count: topicCounts[topic] ?? 0,
	}));

	const regulationBuckets: RegulationsBucket[] = LIBRARY_REGULATIONS_KIND_VALUES.map((kind) => {
		const matcher = regulationsBucketMatcher(kind);
		const count = allRefs.reduce(
			(acc, ref) => (matcher({ kind: ref.kind as ReferenceKind, documentSlug: ref.documentSlug }) ? acc + 1 : acc),
			0,
		);
		return { kind, count };
	});

	const testingBuckets: TestingBucket[] = LIBRARY_TESTING_KIND_VALUES.map((kind) => {
		const matchKind = kind === LIBRARY_TESTING_KINDS.ACS ? REFERENCE_KINDS.ACS : REFERENCE_KINDS.PTS;
		const count = allRefs.reduce((acc, ref) => (ref.kind === matchKind ? acc + 1 : acc), 0);
		return { kind, count };
	});
	const testingCount = testingBuckets.reduce((acc, b) => acc + b.count, 0);

	// Exclude the legacy `poh-afm` umbrella row -- it's the generic citation
	// landing for "the POH" without a specific aircraft, not an aircraft in
	// its own right. Counting it would mislead the landing-tile total.
	const aircraft: AircraftEntry[] = allRefs
		.filter((ref) => ref.kind === REFERENCE_KINDS.POH && ref.documentSlug !== 'poh-afm')
		.map((ref) => ({ id: ref.id, documentSlug: ref.documentSlug, title: ref.title }))
		.sort((a, b) => a.title.localeCompare(b.title));

	return {
		certSpine,
		topicSpine,
		regulationBuckets,
		testingBuckets,
		testingCount,
		aircraft,
	};
};
