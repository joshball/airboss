/**
 * Per-kind projection from a `study.reference` row to a typed card-wrapper
 * payload. Used by the cert + topic library spines to render the right
 * wrapper (HandbookCard, CfrPartCard, AcsCard, ...) per result.
 *
 * Mirrors `projectForVariant` on the `/cards` audit page. The audit page
 * reads from raw fields (description, whyItMatters, ...) on `metadata`;
 * this helper does the same so a Wave 1 authoring gap surfaces the same
 * way on the spine pages as on the audit dashboard.
 *
 * Pure function -- no DB access; all inputs come from a `ReferenceRow`,
 * a precomputed `isReadable` flag, and the URL builders in `@ab/sources`
 * (which are themselves pure for the public surface used here).
 */

import {
	AVIATION_TOPIC_LABELS,
	type AviationTopic,
	externalUrlForReference,
	REFERENCE_KIND_LABELS,
	REFERENCE_KINDS,
	type ReferenceKind,
	ROUTES,
} from '@ab/constants';
import { urlForReferenceRow } from '@ab/sources';
import type { ReferenceRow } from './schema';

/** Topic chip shape consumed by the wrappers (HandbookCard, CfrPartCard, ...). */
export interface LibraryTopicChip {
	readonly value: string;
	readonly label: string;
}

export interface ExternalLink {
	readonly url: string;
	readonly label: string;
}

/**
 * Discriminated union over wrapper variant -> wrapper props. Each branch
 * lists exactly the props its target wrapper consumes; .svelte renderers
 * switch on `variant` and spread `props` into the matching component.
 */
export type LibraryCardPayload =
	| {
			readonly variant: 'HandbookCard';
			readonly props: {
				readonly shortSlug: string;
				readonly fullTitle: string;
				readonly edition: string;
				readonly publisher: string;
				readonly description: string | null;
				readonly whyItMatters: string | null;
				readonly topics: readonly LibraryTopicChip[];
				readonly href: string;
				readonly external: ExternalLink | null;
			};
	  }
	| {
			readonly variant: 'CfrPartCard';
			readonly props: {
				readonly titleNumber: 14 | 49;
				readonly partNumber: string;
				readonly partTitle: string;
				readonly description: string | null;
				readonly whyItMatters: string | null;
				readonly topics: readonly LibraryTopicChip[];
				readonly href: string;
				readonly external: ExternalLink;
			};
	  }
	| {
			readonly variant: 'AcCard';
			readonly props: {
				readonly acNumber: string;
				readonly acTitle: string;
				readonly edition: string;
				readonly description: string | null;
				readonly external: ExternalLink | null;
			};
	  }
	| {
			readonly variant: 'AcsCard';
			readonly props: {
				readonly slug: string;
				readonly title: string;
				readonly edition: string;
				readonly description: string | null;
				readonly whyItMatters: string | null;
				readonly topics: readonly LibraryTopicChip[];
				readonly external: ExternalLink | null;
			};
	  }
	| {
			readonly variant: 'PtsCard';
			readonly props: {
				readonly slug: string;
				readonly title: string;
				readonly edition: string;
				readonly description: string | null;
				readonly external: ExternalLink | null;
			};
	  }
	| {
			readonly variant: 'AimCorpusCard';
			readonly props: {
				readonly title: string;
				readonly description: string;
				readonly whyItMatters: string;
				readonly edition: string | null;
				readonly kindBadge: 'AIM' | 'PCG';
				readonly external: ExternalLink | null;
			};
	  }
	| {
			readonly variant: 'NtsbCard';
			readonly props: {
				readonly reportNumber: string;
				readonly reportTitle: string;
				readonly summary: string | null;
				readonly date: string | null;
				readonly external: ExternalLink | null;
			};
	  }
	| {
			readonly variant: 'PohCard';
			readonly props: {
				readonly aircraftModel: string;
				readonly title: string;
				readonly revision: string;
				readonly manufacturer: string;
				readonly description: string | null;
				readonly whyItMatters: string | null;
				readonly topics: readonly LibraryTopicChip[];
				readonly href: string | null;
				readonly external: ExternalLink | null;
			};
	  }
	| {
			readonly variant: 'SafoCard';
			readonly props: {
				readonly safoNumber: string;
				readonly title: string;
				readonly summary: string | null;
				readonly date: string | null;
				readonly audience: string | null;
				readonly external: ExternalLink | null;
			};
	  }
	| {
			readonly variant: 'InfoCard';
			readonly props: {
				readonly infoNumber: string;
				readonly title: string;
				readonly summary: string | null;
				readonly date: string | null;
				readonly audience: string | null;
				readonly external: ExternalLink | null;
			};
	  }
	| {
			readonly variant: 'UmbrellaCard';
			readonly props: {
				readonly title: string;
				readonly description: string | null;
				readonly whyItMatters: string | null;
				readonly kindBadge: string;
				readonly identifier: string | null;
				readonly external: ExternalLink | null;
			};
	  };

export type LibraryCardVariant = LibraryCardPayload['variant'];

/** Narrow `unknown` to `string | null` -- treats empty strings as missing. */
function asNonEmptyString(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed === '' ? null : trimmed;
}

/** Lift a `metadata.topics` array onto chip shape. Skips non-string entries. */
function topicsFromMetadata(meta: Record<string, unknown>): readonly LibraryTopicChip[] {
	const raw = meta.topics;
	if (!Array.isArray(raw)) return [];
	const out: LibraryTopicChip[] = [];
	for (const value of raw) {
		if (typeof value !== 'string') continue;
		out.push({ value, label: AVIATION_TOPIC_LABELS[value as AviationTopic] ?? value });
	}
	return out;
}

/** Lift `subjects[]` onto the same chip shape -- used as a fallback. */
function topicsFromSubjects(subjects: readonly string[]): readonly LibraryTopicChip[] {
	return subjects.map((value) => ({
		value,
		label: AVIATION_TOPIC_LABELS[value as AviationTopic] ?? value,
	}));
}

function readMetadata(metadata: unknown): Record<string, unknown> {
	if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
		return metadata as Record<string, unknown>;
	}
	return {};
}

/**
 * Loader-supplied resolver for the chapter-aware eCFR Part URL. Pulled
 * out of the projection helper so the helper stays free of the
 * `@ab/sources` side-effect registry chain (which would otherwise drag
 * the entire ingest toolchain into any module that consumes this BC).
 *
 * Loaders pass `buildPartUrl` from `@ab/sources/regs/nav-tree.ts`; tests
 * and stubs can pass a deterministic mock.
 */
export type CfrPartUrlResolver = (titleNumber: 14 | 49, partNumber: string) => string;

/**
 * Default chapter-agnostic eCFR URL builder. Used as a fallback when no
 * resolver is supplied. Equivalent to `buildEcfrUrl(title, { part })` --
 * inlined to keep the projection module dependency-free.
 */
function defaultCfrPartUrl(titleNumber: 14 | 49, partNumber: string): string {
	return `https://www.ecfr.gov/current/title-${titleNumber}/part-${partNumber}`;
}

/**
 * Project a single reference row into the right card-wrapper payload.
 *
 * `isReadable` is precomputed by the loader (one batch query for the whole
 * page) so this function stays pure and synchronous. `resolveCfrPartUrl`
 * is also loader-supplied (defaults to the chapter-agnostic shortcut form);
 * pass `buildPartUrl` from `@ab/sources/regs/nav-tree.ts` to honour the
 * canonical chapter-aware URL.
 */
export function projectReferenceToLibraryCard(
	ref: ReferenceRow,
	isReadable: boolean,
	resolveCfrPartUrl: CfrPartUrlResolver = defaultCfrPartUrl,
): LibraryCardPayload {
	const kind = ref.kind as ReferenceKind;
	const meta = readMetadata(ref.metadata);
	const description = asNonEmptyString(meta.description);
	const whyItMatters = asNonEmptyString(meta.whyItMatters);
	const officialTitle = asNonEmptyString(meta.officialTitle);
	const externalUrl = externalUrlForReference(kind, ref.documentSlug, ref.edition, ref.url);
	const externalLink: ExternalLink | null = externalUrl ? { url: externalUrl, label: ref.publisher } : null;
	const subjects = ref.subjects as readonly string[];

	switch (kind) {
		case REFERENCE_KINDS.HANDBOOK: {
			return {
				variant: 'HandbookCard',
				props: {
					shortSlug: ref.documentSlug,
					fullTitle: officialTitle ?? ref.title,
					edition: ref.edition,
					publisher: ref.publisher,
					description,
					whyItMatters,
					topics: topicsFromSubjects(subjects),
					// Flightbag-direct reader URL when the handbook is ingested;
					// the flightbag landing otherwise. `urlForReferenceRow`
					// returns a path -- the svelte renderer prefixes the
					// flightbag origin via `siblingOrigin` at the render site.
					href: isReadable ? urlForReferenceRow(ref) : ROUTES.FLIGHTBAG_HOME,
					external: externalLink,
				},
			};
		}
		case REFERENCE_KINDS.CFR: {
			const titleNumber: 14 | 49 = ref.documentSlug.startsWith('49cfr') ? 49 : 14;
			const partNumber = ref.documentSlug.replace(/^(14|49)cfr/, '');
			const cfrExternal: ExternalLink = externalLink ?? {
				url: resolveCfrPartUrl(titleNumber, partNumber),
				label: 'eCFR',
			};
			return {
				variant: 'CfrPartCard',
				props: {
					titleNumber,
					partNumber,
					partTitle: officialTitle ?? ref.title,
					description,
					whyItMatters,
					topics: topicsFromMetadata(meta),
					href: cfrExternal.url,
					external: cfrExternal,
				},
			};
		}
		case REFERENCE_KINDS.AC: {
			return {
				variant: 'AcCard',
				props: {
					acNumber: ref.documentSlug.replace(/^ac-/, ''),
					acTitle: ref.title,
					edition: ref.edition,
					description,
					external: externalLink,
				},
			};
		}
		case REFERENCE_KINDS.ACS: {
			return {
				variant: 'AcsCard',
				props: {
					slug: ref.documentSlug,
					title: officialTitle ?? ref.title,
					edition: ref.edition,
					description,
					whyItMatters,
					topics: topicsFromSubjects(subjects),
					external: externalLink,
				},
			};
		}
		case REFERENCE_KINDS.PTS: {
			return {
				variant: 'PtsCard',
				props: {
					slug: ref.documentSlug,
					title: officialTitle ?? ref.title,
					edition: ref.edition,
					description,
					external: externalLink,
				},
			};
		}
		case REFERENCE_KINDS.AIM:
		case REFERENCE_KINDS.PCG: {
			return {
				variant: 'AimCorpusCard',
				props: {
					title: officialTitle ?? ref.title,
					description: description ?? '',
					whyItMatters: whyItMatters ?? '',
					edition: ref.edition && ref.edition !== '-' ? ref.edition : null,
					kindBadge: kind === REFERENCE_KINDS.PCG ? 'PCG' : 'AIM',
					external: externalLink,
				},
			};
		}
		case REFERENCE_KINDS.NTSB: {
			return {
				variant: 'NtsbCard',
				props: {
					reportNumber: ref.documentSlug,
					reportTitle: ref.title,
					summary: description,
					date: asNonEmptyString(meta.date),
					external: externalLink,
				},
			};
		}
		case REFERENCE_KINDS.POH: {
			const aircraftModel = asNonEmptyString(meta.aircraftModel) ?? ref.documentSlug;
			const manufacturer = asNonEmptyString(meta.manufacturer) ?? ref.publisher;
			// External label on POH is the manufacturer name (Cessna, Piper, ...)
			// rather than the generic publisher; mirrors the aircraft surface.
			const pohExternal: ExternalLink | null = externalUrl ? { url: externalUrl, label: manufacturer } : null;
			return {
				variant: 'PohCard',
				props: {
					aircraftModel,
					title: ref.title,
					revision: ref.edition,
					manufacturer,
					description,
					whyItMatters,
					topics: topicsFromMetadata(meta),
					// Chrome-only: the flightbag app has no per-aircraft reader
					// yet, and the legacy study `/library/aircraft/*` route is
					// 410 Gone. The card renders its body as chrome (not a
					// link); the manufacturer external link is preserved. See
					// docs/work-packages/flightbag-citation-url-migration/
					// OUT-OF-SCOPE.md -- re-add the href when a flightbag
					// per-aircraft surface ships.
					href: null,
					external: pohExternal,
				},
			};
		}
		case REFERENCE_KINDS.SAFO: {
			return {
				variant: 'SafoCard',
				props: {
					safoNumber: ref.documentSlug,
					title: officialTitle ?? ref.title,
					summary: description,
					date: asNonEmptyString(meta.date),
					audience: asNonEmptyString(meta.audience),
					external: externalLink,
				},
			};
		}
		case REFERENCE_KINDS.INFO: {
			return {
				variant: 'InfoCard',
				props: {
					infoNumber: ref.documentSlug,
					title: officialTitle ?? ref.title,
					summary: description,
					date: asNonEmptyString(meta.date),
					audience: asNonEmptyString(meta.audience),
					external: externalLink,
				},
			};
		}
		case REFERENCE_KINDS.OTHER: {
			return {
				variant: 'UmbrellaCard',
				props: {
					title: officialTitle ?? ref.title,
					description,
					whyItMatters,
					kindBadge: REFERENCE_KIND_LABELS[kind],
					identifier: ref.edition && ref.edition !== '-' ? ref.edition : null,
					external: externalLink,
				},
			};
		}
		default: {
			const exhaustive: never = kind;
			void exhaustive;
			return {
				variant: 'UmbrellaCard',
				props: {
					title: ref.title,
					description,
					whyItMatters,
					kindBadge: REFERENCE_KIND_LABELS[kind as ReferenceKind] ?? 'Reference',
					identifier: ref.edition && ref.edition !== '-' ? ref.edition : null,
					external: externalLink,
				},
			};
		}
	}
}
