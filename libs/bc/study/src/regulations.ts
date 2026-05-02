/**
 * Regulations BC aggregator.
 *
 * Single entry point that composes the existing reference / handbook BC reads
 * for the four `/library/regulations/*` routes. The route loaders parse slug
 * shapes (via `@ab/aviation`) and forward to {@link getRegulationsView}; the
 * aggregator walks the reference catalog, groups by the regulations-kind
 * partitioning rules, and returns a view-shaped payload. The aggregator
 * introduces no new query semantics -- every read goes through an existing
 * BC function so the aggregator stays a composition layer, not a parallel
 * reader.
 *
 * View shapes (discriminated by `view`):
 *
 *   - `landing` -- top-level kind buckets with reference counts.
 *   - `group`   -- one regulations kind, listing groups (CFR Parts, AC series)
 *                  and umbrella refs (AIM, NTSB, AC orphans).
 *   - `section` -- one Part / series / umbrella, listing inline section rows
 *                  when ingested + the umbrella card.
 *   - `detail`  -- the leaf reader payload (section body, figures, siblings,
 *                  read state, citing nodes, errata, edition supersession).
 *
 * Errors:
 *   - {@link RegulationsViewNotFoundError} when a slug shape is valid but
 *     resolves to no reference or no inline section. Route loaders translate
 *     this to a SvelteKit 404.
 *
 * The `landing` and `group` views fan out via the existing
 * {@link listReferences} read; the `section` view layers a single
 * {@link listHandbookChapters} call on top; the `detail` view fans out the
 * per-section reads (`getHandbookSection`, `getReadState`,
 * `getNodesCitingSection`, `listErrataForSection`, `getReferenceById` for the
 * superseded-by chain) in parallel via `Promise.all` so the per-page latency
 * matches the pre-aggregator route loaders.
 */

import {
	externalUrlForReference,
	HANDBOOK_READ_STATUSES,
	LIBRARY_REGULATIONS_KIND_LABELS,
	LIBRARY_REGULATIONS_KIND_VALUES,
	LIBRARY_REGULATIONS_KINDS,
	type LibraryRegulationsKind,
	REFERENCE_KIND_LABELS,
	REFERENCE_KINDS,
	type ReferenceKind,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { type ErrataDisplay, formatErrataForDisplay, listErrataForSection } from './reference-errata';
import {
	getHandbookSection,
	getNodesCitingSection,
	getReadState,
	getReferenceById,
	listHandbookChapters,
	listReferences,
} from './references';
import type { ReferenceRow, ReferenceSectionReadStateRow } from './schema';

type Db = typeof defaultDb;

// ---------------------------------------------------------------------------
// View-shape types
// ---------------------------------------------------------------------------

/** Card on the landing page -- one bucket per `LIBRARY_REGULATIONS_KIND`. */
export interface RegulationsBucketCard {
	kind: LibraryRegulationsKind;
	label: string;
	count: number;
}

/** Card on the kind page -- one CFR Part, AIM chapter, or AC series. */
export interface RegulationsGroupCard {
	groupKey: string;
	label: string;
	referenceCount: number;
}

/** Umbrella card -- a reference rendered as a link to its external publisher. */
export interface RegulationsUmbrellaCard {
	id: string;
	documentSlug: string;
	edition: string;
	title: string;
	publisher: string;
	kind: ReferenceKind;
	kindLabel: string;
	externalUrl: string | null;
}

/** Inline section row on the group page (per-Part section TOC). */
export interface RegulationsSectionRow {
	id: string;
	code: string;
	title: string;
	ordinal: number;
}

/** Reference summary embedded in the detail view payload. */
export interface RegulationsReferenceSummary {
	id: string;
	documentSlug: string;
	edition: string;
	title: string;
	supersededByEdition: string | null;
}

/** Section body summary -- the reader's primary content payload. */
export interface RegulationsSectionDetail {
	id: string;
	code: string;
	title: string;
	contentMd: string;
	sourceLocator: string;
	faaPageStart: string | null;
	faaPageEnd: string | null;
}

/** Chapter-row summary used to render the section breadcrumb. */
export interface RegulationsChapterDetail {
	id: string;
	code: string;
	title: string;
}

/** Figure tile rendered alongside the section body. */
export interface RegulationsFigureTile {
	id: string;
	ordinal: number;
	caption: string;
	assetPath: string;
	width: number | null;
	height: number | null;
}

/** Sibling-section row used by the sticky TOC. */
export interface RegulationsSiblingRow {
	id: string;
	code: string;
	title: string;
	ordinal: number;
}

/** Knowledge node summary surfaced by the citing-nodes panel. */
export interface RegulationsCitingNode {
	id: string;
	title: string;
	domain: string;
}

/** Read-state shape returned to the section detail loader. Always present. */
export interface RegulationsReadState {
	status: ReferenceSectionReadStateRow['status'];
	comprehended: boolean;
	notesMd: string;
	totalSecondsVisible: number;
}

/** Landing payload -- `/library/regulations`. */
export interface RegulationsLandingView {
	view: 'landing';
	buckets: RegulationsBucketCard[];
}

/** Group payload -- `/library/regulations/[kind]`. */
export interface RegulationsGroupView {
	view: 'group';
	kind: LibraryRegulationsKind;
	kindLabel: string;
	groups: RegulationsGroupCard[];
	umbrellas: RegulationsUmbrellaCard[];
}

/** Section list payload -- `/library/regulations/[kind]/[group]`. */
export interface RegulationsSectionListView {
	view: 'section';
	kind: LibraryRegulationsKind;
	kindLabel: string;
	group: string;
	groupLabel: string;
	umbrellas: RegulationsUmbrellaCard[];
	sections: RegulationsSectionRow[];
}

/** Section detail payload -- `/library/regulations/[kind]/[group]/[section]`. */
export interface RegulationsDetailView {
	view: 'detail';
	kind: LibraryRegulationsKind;
	group: string;
	reference: RegulationsReferenceSummary;
	section: RegulationsSectionDetail;
	chapter: RegulationsChapterDetail;
	figures: RegulationsFigureTile[];
	siblings: RegulationsSiblingRow[];
	readState: RegulationsReadState;
	citingNodes: RegulationsCitingNode[];
	errata: ErrataDisplay[];
}

export type RegulationsView =
	| RegulationsLandingView
	| RegulationsGroupView
	| RegulationsSectionListView
	| RegulationsDetailView;

// ---------------------------------------------------------------------------
// Param shapes -- discriminated so each view's required inputs are typed
// ---------------------------------------------------------------------------

export type RegulationsViewParams =
	| { view: 'landing' }
	| { view: 'group'; kind: LibraryRegulationsKind }
	| { view: 'section'; kind: LibraryRegulationsKind; group: string }
	| {
			view: 'detail';
			kind: LibraryRegulationsKind;
			group: string;
			section: { chapterCode: string; sectionCode: string };
			userId: string;
	  };

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type RegulationsViewNotFoundKey =
	| { kind: LibraryRegulationsKind; group: string }
	| { kind: LibraryRegulationsKind; group: string; section: string; reason: 'section-not-found' };

/**
 * Thrown when a slug-valid request resolves to no reference, no group, or no
 * inline section. Route loaders catch and emit a SvelteKit 404 with the
 * supplied message.
 */
export class RegulationsViewNotFoundError extends Error {
	constructor(
		public readonly key: RegulationsViewNotFoundKey,
		message: string,
	) {
		super(message);
		this.name = 'RegulationsViewNotFoundError';
	}
}

// ---------------------------------------------------------------------------
// Bucket-matching helpers (kept private; the public surface is one function)
// ---------------------------------------------------------------------------

/** True when a reference belongs to the given regulations bucket. */
function bucketMatches(kind: LibraryRegulationsKind, refKind: ReferenceKind, slug: string): boolean {
	switch (kind) {
		case LIBRARY_REGULATIONS_KINDS.CFR_14:
			return refKind === REFERENCE_KINDS.CFR && slug.startsWith('14cfr');
		case LIBRARY_REGULATIONS_KINDS.CFR_49:
			return refKind === REFERENCE_KINDS.CFR && slug.startsWith('49cfr');
		case LIBRARY_REGULATIONS_KINDS.AIM:
			return refKind === REFERENCE_KINDS.AIM || refKind === REFERENCE_KINDS.PCG;
		case LIBRARY_REGULATIONS_KINDS.AC:
			return refKind === REFERENCE_KINDS.AC;
		case LIBRARY_REGULATIONS_KINDS.NTSB:
			return refKind === REFERENCE_KINDS.NTSB;
	}
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

/** Map a (kind, group) pair to the document-slug expected on the matching reference. */
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

/** Project a reference row into the umbrella-card view shape. */
function toUmbrella(ref: ReferenceRow): RegulationsUmbrellaCard {
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
}

/** Resolve the references that fall under a given (kind, group) pair. */
function filterRefsForGroup(
	allRefs: readonly ReferenceRow[],
	kind: LibraryRegulationsKind,
	group: string,
): ReferenceRow[] {
	const expectedSlug = expectedSlugForGroup(kind, group);
	if (expectedSlug !== null) return allRefs.filter((r) => r.documentSlug === expectedSlug);
	if (kind === LIBRARY_REGULATIONS_KINDS.AC) {
		const prefix = `ac-${group}-`;
		return allRefs.filter((r) => r.kind === REFERENCE_KINDS.AC && r.documentSlug.startsWith(prefix));
	}
	if (kind === LIBRARY_REGULATIONS_KINDS.AIM) {
		return allRefs.filter((r) => r.kind === REFERENCE_KINDS.AIM && r.documentSlug === group);
	}
	// NTSB
	return allRefs.filter((r) => r.kind === REFERENCE_KINDS.NTSB && r.documentSlug === group);
}

/** Human-readable label for a (kind, group) pair (`14 CFR Part 91`, `AC Series 120`). */
function labelForGroup(kind: LibraryRegulationsKind, group: string): string {
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
}

// ---------------------------------------------------------------------------
// Per-view builders
// ---------------------------------------------------------------------------

async function buildLandingView(db: Db): Promise<RegulationsLandingView> {
	const refs = await listReferences({}, db);
	const buckets: RegulationsBucketCard[] = LIBRARY_REGULATIONS_KIND_VALUES.map((kind) => {
		const count = refs.reduce(
			(acc, ref) => (bucketMatches(kind, ref.kind as ReferenceKind, ref.documentSlug) ? acc + 1 : acc),
			0,
		);
		return { kind, label: LIBRARY_REGULATIONS_KIND_LABELS[kind], count };
	});
	return { view: 'landing', buckets };
}

async function buildGroupView(kind: LibraryRegulationsKind, db: Db): Promise<RegulationsGroupView> {
	const refs = await listReferences({}, db);
	let groups: RegulationsGroupCard[] = [];
	let umbrellas: RegulationsUmbrellaCard[] = [];

	if (kind === LIBRARY_REGULATIONS_KINDS.CFR_14 || kind === LIBRARY_REGULATIONS_KINDS.CFR_49) {
		const prefix = kind === LIBRARY_REGULATIONS_KINDS.CFR_14 ? '14cfr' : '49cfr';
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
	} else if (kind === LIBRARY_REGULATIONS_KINDS.AIM) {
		// AIM umbrella + PCG always render as umbrella cards; per-chapter
		// section navigation is forward-compatible (rendered when
		// reference_section rows exist for AIM, see [group] route).
		const aimRefs = refs.filter((r) => r.kind === REFERENCE_KINDS.AIM || r.kind === REFERENCE_KINDS.PCG);
		umbrellas = aimRefs.map(toUmbrella);
	} else if (kind === LIBRARY_REGULATIONS_KINDS.AC) {
		const acRefs = refs.filter((r) => r.kind === REFERENCE_KINDS.AC);
		const bySeries = new Map<string, number>();
		const orphans: ReferenceRow[] = [];
		for (const ref of acRefs) {
			const series = extractAcSeries(ref.documentSlug);
			if (series === null || !AC_SERIES_BUCKETS.includes(series)) {
				orphans.push(ref);
				continue;
			}
			bySeries.set(series, (bySeries.get(series) ?? 0) + 1);
		}
		// Render one card per *populated* series. Empty series buckets are
		// omitted so the page never shows a "Series 00 (0 references)" dead
		// card -- readers can hop directly to the AC index for any series we
		// haven't catalogued yet.
		groups = AC_SERIES_BUCKETS.filter((s) => bySeries.has(s)).map((series) => ({
			groupKey: series,
			label: `Series ${series}`,
			referenceCount: bySeries.get(series) ?? 0,
		}));
		umbrellas = orphans.map(toUmbrella);
	} else if (kind === LIBRARY_REGULATIONS_KINDS.NTSB) {
		const ntsbRefs = refs.filter((r) => r.kind === REFERENCE_KINDS.NTSB);
		umbrellas = ntsbRefs.map(toUmbrella);
	}

	return {
		view: 'group',
		kind,
		kindLabel: LIBRARY_REGULATIONS_KIND_LABELS[kind],
		groups,
		umbrellas,
	};
}

async function buildSectionListView(
	kind: LibraryRegulationsKind,
	group: string,
	db: Db,
): Promise<RegulationsSectionListView> {
	const allRefs = await listReferences({}, db);
	const groupRefs = filterRefsForGroup(allRefs, kind, group);

	if (groupRefs.length === 0) {
		throw new RegulationsViewNotFoundError({ kind, group }, `No reference found for ${kind} / ${group}`);
	}

	const umbrellas = groupRefs.map(toUmbrella);

	// If exactly one reference resolves, probe for inline sections so a
	// future per-section leaf reader can light up without a route change.
	let sections: RegulationsSectionRow[] = [];
	if (groupRefs.length === 1) {
		const only = groupRefs[0];
		if (only) {
			const chapters = await listHandbookChapters(only.id, db);
			sections = chapters.map((c) => ({ id: c.id, code: c.code, title: c.title, ordinal: c.ordinal }));
		}
	}

	return {
		view: 'section',
		kind,
		kindLabel: LIBRARY_REGULATIONS_KIND_LABELS[kind],
		group,
		groupLabel: labelForGroup(kind, group),
		umbrellas,
		sections,
	};
}

async function buildDetailView(
	kind: LibraryRegulationsKind,
	group: string,
	section: { chapterCode: string; sectionCode: string },
	userId: string,
	db: Db,
): Promise<RegulationsDetailView> {
	const allRefs = await listReferences({}, db);
	const groupRefs = filterRefsForGroup(allRefs, kind, group);
	const ref = groupRefs[0];
	if (!ref) {
		throw new RegulationsViewNotFoundError({ kind, group }, `No reference for ${kind} / ${group}`);
	}

	const view = await getHandbookSection(ref.id, section.chapterCode, section.sectionCode, db).catch(() => null);
	if (!view) {
		throw new RegulationsViewNotFoundError(
			{
				kind,
				group,
				section: section.sectionCode === '' ? section.chapterCode : `${section.chapterCode}.${section.sectionCode}`,
				reason: 'section-not-found',
			},
			'Section not found.',
		);
	}

	// Fan out the leaf-page reads in parallel. The pre-aggregator route loader
	// issued these sequentially; parallelizing matches the per-page latency
	// model the other library readers already use.
	const [readState, citingNodes, errataRows, latestRow] = await Promise.all([
		getReadState(userId, view.section.id, db),
		getNodesCitingSection(
			{
				referenceId: ref.id,
				chapter: Number(section.chapterCode),
				section: section.sectionCode === '' ? undefined : Number(section.sectionCode),
			},
			db,
		),
		listErrataForSection(view.section.id, db),
		getReferenceById(ref.id, db).catch(() => null),
	]);

	const supersededByEdition = latestRow?.supersededById
		? ((await getReferenceById(latestRow.supersededById, db).catch(() => null))?.edition ?? null)
		: null;

	const errata = errataRows.map(formatErrataForDisplay);

	return {
		view: 'detail',
		kind,
		group,
		reference: {
			id: ref.id,
			documentSlug: ref.documentSlug,
			edition: ref.edition,
			title: ref.title,
			supersededByEdition,
		},
		section: {
			id: view.section.id,
			code: view.section.code,
			title: view.section.title,
			contentMd: view.section.contentMd,
			sourceLocator: view.section.sourceLocator,
			faaPageStart: view.section.faaPageStart,
			faaPageEnd: view.section.faaPageEnd,
		},
		chapter: {
			id: view.chapter.id,
			code: view.chapter.code,
			title: view.chapter.title,
		},
		figures: view.figures.map((f) => ({
			id: f.id,
			ordinal: f.ordinal,
			caption: f.caption,
			assetPath: f.assetPath,
			width: f.width,
			height: f.height,
		})),
		siblings: view.siblings.map((s) => ({
			id: s.id,
			code: s.code,
			title: s.title,
			ordinal: s.ordinal,
		})),
		readState: readState
			? {
					status: readState.status,
					comprehended: readState.comprehended,
					notesMd: readState.notesMd,
					totalSecondsVisible: readState.totalSecondsVisible,
				}
			: {
					status: HANDBOOK_READ_STATUSES.UNREAD,
					comprehended: false,
					notesMd: '',
					totalSecondsVisible: 0,
				},
		citingNodes: citingNodes.map((n) => ({
			id: n.id,
			title: n.title,
			domain: n.domain,
		})),
		errata,
	};
}

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

/**
 * One entry point for every `/library/regulations/*` page. Pass a discriminated
 * params object describing which view the loader needs; receive the
 * view-shaped payload (or {@link RegulationsViewNotFoundError} when the slug
 * resolves to nothing).
 *
 * The overload set narrows the return type by the input `view` discriminant
 * so callers don't have to cast. The aggregator is a composition layer over
 * existing reads -- it does not introduce new query semantics. Per-view
 * fan-out parallelizes the same reads the route loaders previously issued
 * sequentially.
 */
export async function getRegulationsView(params: { view: 'landing' }, db?: Db): Promise<RegulationsLandingView>;
export async function getRegulationsView(
	params: { view: 'group'; kind: LibraryRegulationsKind },
	db?: Db,
): Promise<RegulationsGroupView>;
export async function getRegulationsView(
	params: { view: 'section'; kind: LibraryRegulationsKind; group: string },
	db?: Db,
): Promise<RegulationsSectionListView>;
export async function getRegulationsView(
	params: {
		view: 'detail';
		kind: LibraryRegulationsKind;
		group: string;
		section: { chapterCode: string; sectionCode: string };
		userId: string;
	},
	db?: Db,
): Promise<RegulationsDetailView>;
export async function getRegulationsView(params: RegulationsViewParams, db: Db = defaultDb): Promise<RegulationsView> {
	switch (params.view) {
		case 'landing':
			return buildLandingView(db);
		case 'group':
			return buildGroupView(params.kind, db);
		case 'section':
			return buildSectionListView(params.kind, params.group, db);
		case 'detail':
			return buildDetailView(params.kind, params.group, params.section, params.userId, db);
	}
}

/**
 * Resolve the `reference_section.id` for a (kind, group, section) tuple
 * without hydrating the rest of the detail-view payload. Used by the section
 * detail loader's form actions where only the section id is needed to call
 * the read-state writers. Throws {@link RegulationsViewNotFoundError} on a
 * missing reference or missing section so the route loader can adapt to a
 * SvelteKit 404 the same way it does for the load function.
 */
export async function resolveRegulationsSectionId(
	args: {
		kind: LibraryRegulationsKind;
		group: string;
		section: { chapterCode: string; sectionCode: string };
	},
	db: Db = defaultDb,
): Promise<string> {
	const allRefs = await listReferences({}, db);
	const groupRefs = filterRefsForGroup(allRefs, args.kind, args.group);
	const ref = groupRefs[0];
	if (!ref) {
		throw new RegulationsViewNotFoundError(
			{ kind: args.kind, group: args.group },
			`No reference for ${args.kind} / ${args.group}`,
		);
	}
	const view = await getHandbookSection(ref.id, args.section.chapterCode, args.section.sectionCode, db).catch(
		() => null,
	);
	if (!view) {
		throw new RegulationsViewNotFoundError(
			{
				kind: args.kind,
				group: args.group,
				section:
					args.section.sectionCode === ''
						? args.section.chapterCode
						: `${args.section.chapterCode}.${args.section.sectionCode}`,
				reason: 'section-not-found',
			},
			'Section not found.',
		);
	}
	return view.section.id;
}
