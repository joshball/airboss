/**
 * Testing-standards BC aggregator.
 *
 * Composes the existing reference reads for the `/library/testing/*` routes.
 * Two views: a landing payload with one bucket per `LIBRARY_TESTING_KIND`
 * (ACS, PTS) and per-publication card lists, and a detail payload that
 * resolves a single publication by document slug.
 *
 * Mirrors the shape of `regulations.ts` -- bucket cards on the landing page,
 * publication cards inside each bucket, a detail view that returns a single
 * reference summary plus its body (when ingested) for the leaf reader.
 *
 * The aggregator introduces no new query semantics. Every read goes through
 * an existing BC function so this stays a composition layer.
 */

import {
	externalUrlForReference,
	LIBRARY_TESTING_KIND_COPY,
	LIBRARY_TESTING_KIND_LABELS,
	LIBRARY_TESTING_KIND_VALUES,
	LIBRARY_TESTING_KINDS,
	type LibraryTestingKind,
	REFERENCE_KIND_LABELS,
	REFERENCE_KINDS,
	type ReferenceKind,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { listReferences } from './references';
import type { ReferenceCardCopy, RegulationsExternalLink } from './regulations';
import type { ReferenceRow } from './schema';

type Db = typeof defaultDb;

// ---------------------------------------------------------------------------
// View-shape types
// ---------------------------------------------------------------------------

/** Card on the testing landing page -- one bucket per `LIBRARY_TESTING_KIND`. */
export interface TestingBucketCard extends ReferenceCardCopy {
	kind: LibraryTestingKind;
	label: string;
	count: number;
	/** Canonical FAA testing-standards index URL. */
	external: RegulationsExternalLink | null;
}

/**
 * Publication card -- one ACS or PTS reference rendered with its
 * publisher metadata. Mirrors the regulations umbrella card shape so the
 * landing-page wrapper components (AcsCard, PtsCard) project cleanly.
 */
export interface TestingPublicationCard extends ReferenceCardCopy {
	id: string;
	documentSlug: string;
	edition: string;
	title: string;
	publisher: string;
	kind: ReferenceKind;
	kindLabel: string;
	testingKind: LibraryTestingKind;
	externalUrl: string | null;
}

/** Reference summary embedded in the detail view. */
export interface TestingReferenceSummary {
	id: string;
	documentSlug: string;
	edition: string;
	title: string;
	publisher: string;
	kind: ReferenceKind;
	testingKind: LibraryTestingKind;
}

/** Landing payload -- `/library/testing`. */
export interface TestingLandingView {
	view: 'testing-landing';
	buckets: TestingBucketCard[];
	publications: TestingPublicationCard[];
}

/** Detail payload -- `/library/testing/[slug]`. */
export interface TestingDetailView {
	view: 'testing-detail';
	reference: TestingReferenceSummary;
	/** Hand-authored card copy (description / whyItMatters) projected from metadata + kind copy. */
	copy: ReferenceCardCopy;
	/** Canonical publisher URL for the publication. */
	external: RegulationsExternalLink | null;
}

export type TestingView = TestingLandingView | TestingDetailView;

// ---------------------------------------------------------------------------
// Param shapes
// ---------------------------------------------------------------------------

export type TestingViewParams = { view: 'testing-landing' } | { view: 'testing-detail'; slug: string };

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Thrown when a slug-valid request resolves to no reference. Route loaders
 * catch and emit a SvelteKit 404 with the supplied message.
 */
export class TestingViewNotFoundError extends Error {
	constructor(
		public readonly slug: string,
		message: string,
	) {
		super(message);
		this.name = 'TestingViewNotFoundError';
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map `reference.kind` to the matching testing-standards bucket, or null. */
function testingKindFor(refKind: ReferenceKind): LibraryTestingKind | null {
	if (refKind === REFERENCE_KINDS.ACS) return LIBRARY_TESTING_KINDS.ACS;
	if (refKind === REFERENCE_KINDS.PTS) return LIBRARY_TESTING_KINDS.PTS;
	return null;
}

/** Pull descriptive copy from a reference's `metadata` JSONB. */
function extractCardCopy(metadata: ReferenceRow['metadata']): ReferenceCardCopy {
	if (!metadata || typeof metadata !== 'object') return {};
	const m = metadata as Record<string, unknown>;
	const out: ReferenceCardCopy = {};
	if (typeof m.officialTitle === 'string' && m.officialTitle.trim()) out.officialTitle = m.officialTitle;
	if (typeof m.description === 'string' && m.description.trim()) out.description = m.description;
	if (typeof m.whyItMatters === 'string' && m.whyItMatters.trim()) out.whyItMatters = m.whyItMatters;
	if (typeof m.scope === 'string' && m.scope.trim()) out.scope = m.scope;
	return out;
}

/** Project a reference row into a publication card view shape. */
function toPublicationCard(ref: ReferenceRow, testingKind: LibraryTestingKind): TestingPublicationCard {
	const refKind = ref.kind as ReferenceKind;
	const kindCopy = LIBRARY_TESTING_KIND_COPY[testingKind];
	const cardCopy = extractCardCopy(ref.metadata);
	return {
		id: ref.id,
		documentSlug: ref.documentSlug,
		edition: ref.edition,
		title: ref.title,
		publisher: ref.publisher,
		kind: refKind,
		kindLabel: REFERENCE_KIND_LABELS[refKind],
		testingKind,
		externalUrl: externalUrlForReference(refKind, ref.documentSlug, ref.edition, ref.url),
		// Card copy precedence: metadata-authored, then the kind-level fallback
		// so every publication card has at least the corpus-level framing.
		officialTitle: cardCopy.officialTitle,
		description: cardCopy.description ?? kindCopy.description,
		whyItMatters: cardCopy.whyItMatters ?? kindCopy.whyItMatters,
		scope: cardCopy.scope,
	};
}

const FAA_ACS_INDEX_URL = 'https://www.faa.gov/training_testing/testing/acs';
const FAA_TESTING_LABEL = 'FAA';

function externalForKind(kind: LibraryTestingKind): RegulationsExternalLink | null {
	// Both ACS and PTS publications live on the same FAA testing-standards
	// index page. Per VOCABULARY.md we use the publisher tag rather than a
	// per-document tag.
	void kind;
	return { url: FAA_ACS_INDEX_URL, label: FAA_TESTING_LABEL };
}

// ---------------------------------------------------------------------------
// Per-view builders
// ---------------------------------------------------------------------------

async function buildLandingView(db: Db): Promise<TestingLandingView> {
	const refs = await listReferences({}, db);
	const publications: TestingPublicationCard[] = [];
	const counts: Record<LibraryTestingKind, number> = {
		[LIBRARY_TESTING_KINDS.ACS]: 0,
		[LIBRARY_TESTING_KINDS.PTS]: 0,
	};
	for (const ref of refs) {
		const refKind = ref.kind as ReferenceKind;
		const testingKind = testingKindFor(refKind);
		if (testingKind === null) continue;
		counts[testingKind] += 1;
		publications.push(toPublicationCard(ref, testingKind));
	}
	// Sort by kind then by title so the rendered grid reads ACS first
	// (current standard) then PTS (legacy), each block alphabetised.
	publications.sort((a, b) => {
		if (a.testingKind !== b.testingKind) {
			return a.testingKind === LIBRARY_TESTING_KINDS.ACS ? -1 : 1;
		}
		return a.title.localeCompare(b.title);
	});
	const buckets: TestingBucketCard[] = LIBRARY_TESTING_KIND_VALUES.map((kind) => {
		const copy = LIBRARY_TESTING_KIND_COPY[kind];
		return {
			kind,
			label: LIBRARY_TESTING_KIND_LABELS[kind],
			count: counts[kind],
			topic: copy.topic,
			officialTitle: copy.officialTitle,
			description: copy.description,
			whyItMatters: copy.whyItMatters,
			external: externalForKind(kind),
		};
	});
	return { view: 'testing-landing', buckets, publications };
}

async function buildDetailView(slug: string, db: Db): Promise<TestingDetailView> {
	const refs = await listReferences({}, db);
	const ref = refs.find((r) => r.documentSlug === slug);
	if (!ref) {
		throw new TestingViewNotFoundError(slug, `No testing-standards publication for slug ${slug}`);
	}
	const refKind = ref.kind as ReferenceKind;
	const testingKind = testingKindFor(refKind);
	if (testingKind === null) {
		throw new TestingViewNotFoundError(slug, `Reference ${slug} is not a testing-standards publication`);
	}
	const kindCopy = LIBRARY_TESTING_KIND_COPY[testingKind];
	const cardCopy = extractCardCopy(ref.metadata);
	const externalUrl = externalUrlForReference(refKind, ref.documentSlug, ref.edition, ref.url);
	return {
		view: 'testing-detail',
		reference: {
			id: ref.id,
			documentSlug: ref.documentSlug,
			edition: ref.edition,
			title: ref.title,
			publisher: ref.publisher,
			kind: refKind,
			testingKind,
		},
		copy: {
			officialTitle: cardCopy.officialTitle ?? kindCopy.officialTitle,
			description: cardCopy.description ?? kindCopy.description,
			whyItMatters: cardCopy.whyItMatters ?? kindCopy.whyItMatters,
			scope: cardCopy.scope,
			topic: kindCopy.topic,
		},
		external: externalUrl ? { url: externalUrl, label: ref.publisher || FAA_TESTING_LABEL } : null,
	};
}

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

/**
 * One entry point for every `/library/testing/*` page. Pass a discriminated
 * params object describing which view the loader needs; receive the
 * view-shaped payload (or {@link TestingViewNotFoundError} when the slug
 * resolves to nothing).
 */
export async function getTestingView(params: { view: 'testing-landing' }, db?: Db): Promise<TestingLandingView>;
export async function getTestingView(
	params: { view: 'testing-detail'; slug: string },
	db?: Db,
): Promise<TestingDetailView>;
export async function getTestingView(params: TestingViewParams, db: Db = defaultDb): Promise<TestingView> {
	switch (params.view) {
		case 'testing-landing':
			return buildLandingView(db);
		case 'testing-detail':
			return buildDetailView(params.slug, db);
	}
}
