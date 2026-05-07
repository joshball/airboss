/**
 * Advisories BC aggregator.
 *
 * Single entry point that composes the existing reference reads for the two
 * `/library/advisories/*` routes -- SAFO and InFO bulletins. Sibling to
 * {@link ./regulations.ts}; same shape, narrower partitioning rules.
 *
 * View shapes (discriminated by `view`):
 *
 *   - `landing` -- top-level kind buckets (SAFO, InFO) with bulletin lists.
 *   - `detail`  -- one bulletin reader payload, identified by slug.
 *
 * The aggregator is a composition layer over {@link listReferences} and
 * {@link getReferenceByDocument}. No new query semantics live here; route
 * loaders parse slug shapes and forward to {@link getAdvisoriesView}.
 *
 * Errors:
 *   - {@link AdvisoriesViewNotFoundError} when a slug shape is valid but
 *     resolves to no reference. Route loaders translate this to a SvelteKit
 *     404.
 */

import {
	externalUrlForReference,
	LIBRARY_ADVISORIES_KIND_COPY,
	LIBRARY_ADVISORIES_KIND_LABELS,
	LIBRARY_ADVISORIES_KIND_VALUES,
	LIBRARY_ADVISORIES_KINDS,
	type LibraryAdvisoriesKind,
	REFERENCE_KIND_LABELS,
	REFERENCE_KINDS,
	type ReferenceKind,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { getReferenceByDocument, listReferences } from './references';
import type { ReferenceRow } from './schema';

type Db = typeof defaultDb;

// ---------------------------------------------------------------------------
// View-shape types
// ---------------------------------------------------------------------------

/** Generic external link carried by every advisory card. */
export interface AdvisoriesExternalLink {
	url: string;
	label: string;
}

/**
 * Hand-authored / metadata-driven copy attached to advisory cards. The shape
 * is intentionally narrow -- only the four card-copy fields. Anything else in
 * `metadata` (date, audience) is carried alongside via dedicated fields.
 */
export interface AdvisoriesReferenceCopy {
	officialTitle?: string;
	description?: string;
	whyItMatters?: string;
}

/** One bulletin row rendered as a card on the landing page or detail page. */
export interface AdvisoriesBulletinCard extends AdvisoriesReferenceCopy {
	id: string;
	documentSlug: string;
	edition: string;
	title: string;
	publisher: string;
	kind: LibraryAdvisoriesKind;
	kindLabel: string;
	/** Publication date pulled off `metadata.date`; null when not authored. */
	date: string | null;
	/** Operator audience tag pulled off `metadata.audience`; null when not authored. */
	audience: string | null;
	/** Canonical FAA URL for this bulletin (or kind-level index when no per-bulletin URL exists). */
	external: AdvisoriesExternalLink | null;
}

/** Per-bucket summary on the landing page. */
export interface AdvisoriesBucketCard {
	kind: LibraryAdvisoriesKind;
	label: string;
	shortLabel: string;
	topic: string;
	officialTitle: string;
	description: string;
	whyItMatters: string;
	count: number;
	bulletins: AdvisoriesBulletinCard[];
}

/** Landing payload -- `/library/advisories`. */
export interface AdvisoriesLandingView {
	view: 'advisories-landing';
	buckets: AdvisoriesBucketCard[];
}

/** Detail payload -- `/library/advisories/[slug]`. */
export interface AdvisoriesDetailView {
	view: 'advisories-detail';
	bulletin: AdvisoriesBulletinCard;
	/** Kind-level copy carried for breadcrumb / page header rendering. */
	kindCopy: {
		shortLabel: string;
		topic: string;
		officialTitle: string;
		description: string;
		whyItMatters: string;
	};
}

export type AdvisoriesView = AdvisoriesLandingView | AdvisoriesDetailView;

// ---------------------------------------------------------------------------
// Param shapes -- discriminated so each view's required inputs are typed
// ---------------------------------------------------------------------------

export type AdvisoriesViewParams = { view: 'advisories-landing' } | { view: 'advisories-detail'; slug: string };

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export interface AdvisoriesViewNotFoundKey {
	slug: string;
}

/**
 * Thrown when a slug-valid request resolves to no reference. Route loaders
 * catch and emit a SvelteKit 404 with the supplied message.
 */
export class AdvisoriesViewNotFoundError extends Error {
	constructor(
		public readonly key: AdvisoriesViewNotFoundKey,
		message: string,
	) {
		super(message);
		this.name = 'AdvisoriesViewNotFoundError';
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** True when a reference belongs to the given advisories bucket. */
function bucketMatches(kind: LibraryAdvisoriesKind, refKind: ReferenceKind): boolean {
	switch (kind) {
		case LIBRARY_ADVISORIES_KINDS.SAFO:
			return refKind === REFERENCE_KINDS.SAFO;
		case LIBRARY_ADVISORIES_KINDS.INFO:
			return refKind === REFERENCE_KINDS.INFO;
	}
}

/**
 * Map a `study.reference.kind` value onto the matching advisories kind. Returns
 * null for non-advisory kinds (CFR, AC, NTSB, ...) so the detail view loader
 * can detect a slug that resolves to a non-advisory reference.
 */
function advisoriesKindForReferenceKind(refKind: ReferenceKind): LibraryAdvisoriesKind | null {
	if (refKind === REFERENCE_KINDS.SAFO) return LIBRARY_ADVISORIES_KINDS.SAFO;
	if (refKind === REFERENCE_KINDS.INFO) return LIBRARY_ADVISORIES_KINDS.INFO;
	return null;
}

/**
 * Pull descriptive copy off a reference's `metadata` JSONB. Mirrors the shape
 * used by `regulations.extractCardCopy` -- only the four card-copy fields.
 * The advisory-specific date / audience tags are projected separately.
 */
function extractReferenceCopy(metadata: ReferenceRow['metadata']): AdvisoriesReferenceCopy {
	if (!metadata || typeof metadata !== 'object') return {};
	const m = metadata as Record<string, unknown>;
	const out: AdvisoriesReferenceCopy = {};
	if (typeof m.officialTitle === 'string' && m.officialTitle.trim()) out.officialTitle = m.officialTitle;
	if (typeof m.description === 'string' && m.description.trim()) out.description = m.description;
	if (typeof m.whyItMatters === 'string' && m.whyItMatters.trim()) out.whyItMatters = m.whyItMatters;
	return out;
}

function extractMetadataString(metadata: ReferenceRow['metadata'], key: string): string | null {
	if (!metadata || typeof metadata !== 'object') return null;
	const v = (metadata as Record<string, unknown>)[key];
	return typeof v === 'string' && v.trim() ? v : null;
}

/** Project a reference row into the bulletin-card view shape. */
function toBulletinCard(ref: ReferenceRow, kind: LibraryAdvisoriesKind): AdvisoriesBulletinCard {
	const refKind = ref.kind as ReferenceKind;
	return {
		id: ref.id,
		documentSlug: ref.documentSlug,
		edition: ref.edition,
		title: ref.title,
		publisher: ref.publisher,
		kind,
		kindLabel: REFERENCE_KIND_LABELS[refKind],
		date: extractMetadataString(ref.metadata, 'date'),
		audience: extractMetadataString(ref.metadata, 'audience'),
		external: (() => {
			const url = externalUrlForReference(refKind, ref.documentSlug, ref.edition, ref.url);
			if (url === null) return null;
			return { url, label: ref.publisher };
		})(),
		...extractReferenceCopy(ref.metadata),
	};
}

/**
 * Sort bulletins newest-first by document slug. Slug shape is `safo-NNNNN` /
 * `info-NNNNN` where the leading two digits are the publication year and the
 * trailing three are the in-year sequence; lexicographic sort on the trailing
 * digits gives chronological order. Falls back to slug-string compare when
 * the trailing-digit extraction fails (defensive -- the seed schema gates).
 */
function sortBulletinsNewestFirst(bulletins: AdvisoriesBulletinCard[]): AdvisoriesBulletinCard[] {
	return [...bulletins].sort((a, b) => {
		const aTail = a.documentSlug.split('-')[1] ?? '';
		const bTail = b.documentSlug.split('-')[1] ?? '';
		if (aTail !== bTail) return bTail.localeCompare(aTail);
		return b.documentSlug.localeCompare(a.documentSlug);
	});
}

// ---------------------------------------------------------------------------
// Per-view builders
// ---------------------------------------------------------------------------

async function buildLandingView(db: Db): Promise<AdvisoriesLandingView> {
	const refs = await listReferences({}, db);
	const buckets: AdvisoriesBucketCard[] = LIBRARY_ADVISORIES_KIND_VALUES.map((kind) => {
		const matching = refs.filter((ref) => bucketMatches(kind, ref.kind as ReferenceKind));
		const bulletins = sortBulletinsNewestFirst(matching.map((ref) => toBulletinCard(ref, kind)));
		const copy = LIBRARY_ADVISORIES_KIND_COPY[kind];
		return {
			kind,
			label: LIBRARY_ADVISORIES_KIND_LABELS[kind],
			shortLabel: copy.shortLabel,
			topic: copy.topic,
			officialTitle: copy.officialTitle,
			description: copy.description,
			whyItMatters: copy.whyItMatters,
			count: bulletins.length,
			bulletins,
		};
	});
	return { view: 'advisories-landing', buckets };
}

async function buildDetailView(slug: string, db: Db): Promise<AdvisoriesDetailView> {
	const ref = await getReferenceByDocument(slug, {}, db).catch(() => null);
	if (!ref) {
		throw new AdvisoriesViewNotFoundError({ slug }, `No advisory bulletin found for slug ${slug}.`);
	}
	const kind = advisoriesKindForReferenceKind(ref.kind as ReferenceKind);
	if (!kind) {
		throw new AdvisoriesViewNotFoundError(
			{ slug },
			`Reference ${slug} is not an advisory bulletin (kind=${ref.kind}).`,
		);
	}
	const copy = LIBRARY_ADVISORIES_KIND_COPY[kind];
	return {
		view: 'advisories-detail',
		bulletin: toBulletinCard(ref, kind),
		kindCopy: {
			shortLabel: copy.shortLabel,
			topic: copy.topic,
			officialTitle: copy.officialTitle,
			description: copy.description,
			whyItMatters: copy.whyItMatters,
		},
	};
}

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

/**
 * One entry point for every `/library/advisories/*` page. Pass a discriminated
 * params object describing which view the loader needs; receive the
 * view-shaped payload (or {@link AdvisoriesViewNotFoundError} when the slug
 * resolves to nothing).
 */
export async function getAdvisoriesView(
	params: { view: 'advisories-landing' },
	db?: Db,
): Promise<AdvisoriesLandingView>;
export async function getAdvisoriesView(
	params: { view: 'advisories-detail'; slug: string },
	db?: Db,
): Promise<AdvisoriesDetailView>;
export async function getAdvisoriesView(params: AdvisoriesViewParams, db: Db = defaultDb): Promise<AdvisoriesView> {
	switch (params.view) {
		case 'advisories-landing':
			return buildLandingView(db);
		case 'advisories-detail':
			return buildDetailView(params.slug, db);
	}
}
