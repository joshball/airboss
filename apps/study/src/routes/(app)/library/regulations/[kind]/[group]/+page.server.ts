/**
 * `/library/regulations/[kind]/[group]` -- one Part / Chapter / AC series.
 *
 * Forward-compatible loader: if the matching reference has any
 * `handbook_section` rows, render the section list (ready for the per-section
 * leaf reader). Otherwise render the umbrella card so the page never 404s
 * just because inline content hasn't been ingested yet.
 *
 * The unknown-group case (a slug that doesn't resolve to any reference and
 * doesn't match a published bucket) does 404 -- that's a typo'd URL, not a
 * missing-content gap.
 */

import { requireAuth } from '@ab/auth';
import { listHandbookChapters, listReferences } from '@ab/bc-study';
import {
	externalUrlForReference,
	LIBRARY_REGULATIONS_KIND_LABELS,
	LIBRARY_REGULATIONS_KIND_VALUES,
	LIBRARY_REGULATIONS_KINDS,
	type LibraryRegulationsKind,
	REFERENCE_KIND_LABELS,
	REFERENCE_KINDS,
	type ReferenceKind,
} from '@ab/constants';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

interface SectionRowView {
	id: string;
	code: string;
	title: string;
	ordinal: number;
}

interface ReferenceUmbrella {
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
 * Map a (kind, group) pair to the document-slug that should match the
 * `study.reference` row representing this group.
 *
 * - `14-cfr` / `49-cfr`: Part 91 lives under slug `14cfr91`.
 * - `aim`: any group key resolves to the AIM umbrella (single document).
 * - `ac`: per-series; the AC series slug is itself a reference for the
 *   index publication when one exists.
 * - `ntsb`: same as AIM -- single umbrella.
 */
function expectedSlugForGroup(kind: LibraryRegulationsKind, group: string): string | null {
	switch (kind) {
		case LIBRARY_REGULATIONS_KINDS.CFR_14:
			return `14cfr${group}`;
		case LIBRARY_REGULATIONS_KINDS.CFR_49:
			return `49cfr${group}`;
		case LIBRARY_REGULATIONS_KINDS.AIM:
		case LIBRARY_REGULATIONS_KINDS.AC:
		case LIBRARY_REGULATIONS_KINDS.NTSB:
			return null;
	}
}

export const load: PageServerLoad = async (event) => {
	requireAuth(event);
	const kindParam = event.params.kind;
	if (!isLibraryRegulationsKind(kindParam)) {
		throw error(404, `Unknown regulations kind: ${kindParam}`);
	}
	const kind = kindParam;
	const group = event.params.group;

	const allRefs = await listReferences();
	const expectedSlug = expectedSlugForGroup(kind, group);

	let groupRefs: typeof allRefs;
	if (expectedSlug !== null) {
		groupRefs = allRefs.filter((r) => r.documentSlug === expectedSlug);
	} else if (kind === LIBRARY_REGULATIONS_KINDS.AC) {
		// AC series group key -- match every AC reference whose slug
		// shape is `ac-<group>-...`.
		const prefix = `ac-${group}-`;
		groupRefs = allRefs.filter((r) => r.kind === REFERENCE_KINDS.AC && r.documentSlug.startsWith(prefix));
	} else if (kind === LIBRARY_REGULATIONS_KINDS.AIM) {
		// The AIM doesn't have an inline group concept yet; the page
		// is reachable only if the group string matches an AIM-like
		// slug. Fall through to umbrella resolution below.
		groupRefs = allRefs.filter((r) => r.kind === REFERENCE_KINDS.AIM && r.documentSlug === group);
	} else {
		// ntsb: single umbrella; the group string should match the
		// reference slug directly.
		groupRefs = allRefs.filter((r) => r.kind === REFERENCE_KINDS.NTSB && r.documentSlug === group);
	}

	if (groupRefs.length === 0) {
		throw error(404, `No reference found for ${kind} / ${group}`);
	}

	const umbrellas: ReferenceUmbrella[] = groupRefs.map((ref) => {
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

	// If exactly one reference resolves, probe for inline sections so a
	// future per-section leaf reader can light up without a route change.
	let sections: SectionRowView[] = [];
	if (groupRefs.length === 1) {
		const only = groupRefs[0];
		if (only) {
			const chapters = await listHandbookChapters(only.id);
			sections = chapters.map((c) => ({ id: c.id, code: c.code, title: c.title, ordinal: c.ordinal }));
		}
	}

	const groupLabel = (() => {
		switch (kind) {
			case LIBRARY_REGULATIONS_KINDS.CFR_14:
				return `14 CFR Part ${group}`;
			case LIBRARY_REGULATIONS_KINDS.CFR_49:
				return `49 CFR Part ${group}`;
			case LIBRARY_REGULATIONS_KINDS.AIM:
				return `AIM -- ${group}`;
			case LIBRARY_REGULATIONS_KINDS.AC:
				return `AC Series ${group}`;
			case LIBRARY_REGULATIONS_KINDS.NTSB:
				return `NTSB -- ${group}`;
		}
	})();

	return {
		kind,
		kindLabel: LIBRARY_REGULATIONS_KIND_LABELS[kind],
		group,
		groupLabel,
		umbrellas,
		sections,
	};
};
