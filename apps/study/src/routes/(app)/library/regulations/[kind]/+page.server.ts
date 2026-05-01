/**
 * `/library/regulations/[kind]` -- one regulations bucket.
 *
 * Inside each bucket the references are split into structural groups:
 *   - 14 CFR / 49 CFR: by Part (slug `14cfr91` -> Part 91).
 *   - AIM: by chapter when section data exists, else AIM umbrella + PCG.
 *   - AC: by series (slug `ac-91-23` -> series 91), per spec the live series
 *     buckets are 00, 60, 61, 90, 91, 120, 150.
 *   - NTSB: single umbrella card.
 *
 * Each group renders as a card linking to `/library/regulations/[kind]/[group]`.
 */

import { requireAuth } from '@ab/auth';
import { listReferences } from '@ab/bc-study';
import {
	externalUrlForReference,
	LIBRARY_REGULATIONS_KIND_LABELS,
	LIBRARY_REGULATIONS_KIND_VALUES,
	type LibraryRegulationsKind,
	REFERENCE_KIND_LABELS,
	REFERENCE_KINDS,
	type ReferenceKind,
} from '@ab/constants';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

interface GroupCard {
	groupKey: string;
	label: string;
	referenceCount: number;
}

interface UmbrellaCard {
	id: string;
	documentSlug: string;
	edition: string;
	title: string;
	publisher: string;
	kind: ReferenceKind;
	kindLabel: string;
	externalUrl: string | null;
}

function isLibraryRegulationsKind(value: string): value is LibraryRegulationsKind {
	return (LIBRARY_REGULATIONS_KIND_VALUES as readonly string[]).includes(value);
}

/**
 * 14 CFR / 49 CFR Part extraction. Slug shape is `14cfr91` (Part 91)
 * or `49cfr830` (Part 830). Returns the Part number as a string, or
 * null if the slug doesn't match.
 */
function extractCfrPart(slug: string): string | null {
	const match = slug.match(/^(?:14|49)cfr(.+)$/);
	return match?.[1] ?? null;
}

/**
 * AC series extraction. Slug shape is `ac-91-23` (series 91, doc 23).
 * Returns the series number as a string, or null if the slug doesn't
 * match. The static set of live AC series buckets per spec is
 * 00, 60, 61, 90, 91, 120, 150.
 */
const AC_SERIES_BUCKETS: readonly string[] = ['00', '60', '61', '90', '91', '120', '150'];
function extractAcSeries(slug: string): string | null {
	const match = slug.match(/^ac-(\d+)-/);
	return match?.[1] ?? null;
}

export const load: PageServerLoad = async (event) => {
	requireAuth(event);
	const kindParam = event.params.kind;
	if (!isLibraryRegulationsKind(kindParam)) {
		throw error(404, `Unknown regulations kind: ${kindParam}`);
	}
	const kind = kindParam;

	const refs = await listReferences();

	let groups: GroupCard[] = [];
	let umbrellas: UmbrellaCard[] = [];

	if (kind === '14-cfr' || kind === '49-cfr') {
		const prefix = kind === '14-cfr' ? '14cfr' : '49cfr';
		const matching = refs.filter((r) => r.kind === REFERENCE_KINDS.CFR && r.documentSlug.startsWith(prefix));
		const byPart = new Map<string, number>();
		for (const ref of matching) {
			const part = extractCfrPart(ref.documentSlug);
			if (part === null) continue;
			byPart.set(part, (byPart.get(part) ?? 0) + 1);
		}
		groups = [...byPart.entries()]
			.sort(([a], [b]) => Number(a) - Number(b))
			.map(([part, count]) => ({ groupKey: part, label: `Part ${part}`, referenceCount: count }));
	} else if (kind === 'aim') {
		// AIM umbrella + PCG always render as umbrella cards; per-chapter
		// section navigation is forward-compatible (rendered when
		// handbook_section rows exist for AIM, see [group] route).
		const aimRefs = refs.filter((r) => r.kind === REFERENCE_KINDS.AIM || r.kind === REFERENCE_KINDS.PCG);
		umbrellas = aimRefs.map((ref) => {
			const refKind = ref.kind as ReferenceKind;
			return {
				id: ref.id,
				documentSlug: ref.documentSlug,
				edition: ref.edition,
				title: ref.title,
				publisher: ref.publisher,
				kind: refKind,
				kindLabel: REFERENCE_KIND_LABELS[refKind],
				externalUrl: externalUrlForReference(refKind, ref.documentSlug, ref.edition, ref.url),
			};
		});
	} else if (kind === 'ac') {
		const acRefs = refs.filter((r) => r.kind === REFERENCE_KINDS.AC);
		const bySeries = new Map<string, number>();
		const orphans: typeof acRefs = [];
		for (const ref of acRefs) {
			const series = extractAcSeries(ref.documentSlug);
			if (series === null || !AC_SERIES_BUCKETS.includes(series)) {
				orphans.push(ref);
				continue;
			}
			bySeries.set(series, (bySeries.get(series) ?? 0) + 1);
		}
		// Render one card per *populated* series. Empty series buckets are
		// omitted so the page never shows a "Series 00 (0 references)"
		// dead card -- the page exists; readers can hop directly to the
		// AC index for any series we haven't catalogued yet.
		groups = AC_SERIES_BUCKETS.filter((s) => bySeries.has(s)).map((series) => ({
			groupKey: series,
			label: `Series ${series}`,
			referenceCount: bySeries.get(series) ?? 0,
		}));
		umbrellas = orphans.map((ref) => {
			const refKind = ref.kind as ReferenceKind;
			return {
				id: ref.id,
				documentSlug: ref.documentSlug,
				edition: ref.edition,
				title: ref.title,
				publisher: ref.publisher,
				kind: refKind,
				kindLabel: REFERENCE_KIND_LABELS[refKind],
				externalUrl: externalUrlForReference(refKind, ref.documentSlug, ref.edition, ref.url),
			};
		});
	} else if (kind === 'ntsb') {
		const ntsbRefs = refs.filter((r) => r.kind === REFERENCE_KINDS.NTSB);
		umbrellas = ntsbRefs.map((ref) => {
			const refKind = ref.kind as ReferenceKind;
			return {
				id: ref.id,
				documentSlug: ref.documentSlug,
				edition: ref.edition,
				title: ref.title,
				publisher: ref.publisher,
				kind: refKind,
				kindLabel: REFERENCE_KIND_LABELS[refKind],
				externalUrl: externalUrlForReference(refKind, ref.documentSlug, ref.edition, ref.url),
			};
		});
	}

	return {
		kind,
		kindLabel: LIBRARY_REGULATIONS_KIND_LABELS[kind],
		groups,
		umbrellas,
	};
};
