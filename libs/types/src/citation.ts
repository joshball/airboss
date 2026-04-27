/**
 * Citation shapes carried on `knowledge_node.references` JSONB array entries.
 *
 * Two shapes coexist on the same column:
 *
 * 1. {@link LegacyCitation} -- the original freeform shape used by every node
 *    authored before the handbook-ingestion-and-reader WP. Survives untouched;
 *    the cert-syllabus WP runs the migration that converts these to structured
 *    citations once the syllabus tree is known.
 * 2. {@link StructuredCitation} -- discriminated by `kind`. v1 only resolves
 *    `kind === 'handbook'`; every other kind is a valid storage shape that
 *    `resolveCitationUrl` returns `null` for until the cert-syllabus WP fills
 *    in the per-kind resolvers.
 *
 * The build script (`bun run db build`) narrows on the presence of a `kind`
 * field to decide which shape it parsed. Both shapes round-trip through the
 * same JSONB column.
 *
 * Cert-syllabus WP extends each `StructuredCitation` variant with two
 * optional fields:
 *
 * - `framing?: CitationFraming` (`survey | operational | procedural |
 *   regulatory | examiner`) -- orthogonal authoring affordance applied
 *   across every citation kind. Defaults per kind on the migration script.
 * - `airboss_ref?: string` -- canonical ADR 019 identifier. When present,
 *   the URL resolver may delegate to the `@ab/sources` registry instead of
 *   formatting from the locator directly.
 *
 * Both extensions are additive; entries seeded by WP #1 without these
 * fields continue to validate.
 *
 * See `docs/work-packages/handbook-ingestion-and-reader/spec.md`,
 * `docs/work-packages/cert-syllabus-and-goal-composer/spec.md`, and ADR 019.
 */

import type { CitationFraming } from '@ab/constants';

/**
 * Pre-WP freeform citation. Three string fields, no resolver. The reader
 * renders these as plain text; click-through is not available until the
 * citation is converted to a {@link StructuredCitation}.
 */
export interface LegacyCitation {
	source: string;
	detail: string;
	note: string;
}

/**
 * Optional fields added across every {@link StructuredCitation} variant by
 * the cert-syllabus WP.
 */
export interface StructuredCitationCommon {
	/**
	 * Optional framing -- how this citation is being used. Defaults per
	 * kind in the migration; authored values override the default.
	 */
	framing?: CitationFraming;
	/**
	 * Optional canonical identifier per ADR 019. When present, this is the
	 * authoritative cross-corpus reference; the kind-specific locator
	 * fields stay as the human-readable fallback. The URL resolver may
	 * delegate to `@ab/sources.getLiveUrl()` when this is populated.
	 */
	airboss_ref?: string;
}

/**
 * Structured citation. Discriminated by `kind`. Each kind carries its own
 * locator shape; the resolver per kind is defined in `@ab/bc-study handbooks`.
 *
 * `reference_id` always points at a `study.reference` row. Locator fields are
 * kind-specific because each reference family has different addressing (CFR
 * uses title/part/section; AC uses paragraph; ACS uses area/task/element).
 *
 * Every variant also accepts the optional fields in
 * {@link StructuredCitationCommon}.
 */
export type StructuredCitation = StructuredCitationCommon &
	(
		| {
				kind: 'handbook';
				reference_id: string;
				locator: {
					chapter: number;
					section?: number;
					subsection?: number;
					/** FAA pagination is hyphenated, e.g. `12-7`. Stored as text. */
					page_start?: string;
					page_end?: string;
				};
				note?: string;
		  }
		| {
				kind: 'cfr';
				reference_id: string;
				locator: {
					title: number;
					part: number;
					/** Section number; may include subparts like `175(b)(2)`. */
					section: string;
				};
				note?: string;
		  }
		| {
				kind: 'ac';
				reference_id: string;
				locator: {
					paragraph?: string;
				};
				note?: string;
		  }
		| {
				kind: 'acs' | 'pts';
				reference_id: string;
				locator: {
					area?: string;
					task?: string;
					element?: string;
				};
				note?: string;
		  }
		| {
				kind: 'aim';
				reference_id: string;
				locator: {
					/** AIM paragraph code, e.g. `5-1-7`. */
					paragraph?: string;
				};
				note?: string;
		  }
		| {
				kind: 'pcg';
				reference_id: string;
				locator: {
					term?: string;
				};
				note?: string;
		  }
		| {
				kind: 'ntsb' | 'poh' | 'other';
				reference_id: string;
				locator: {
					detail?: string;
				};
				note?: string;
		  }
	);

/** Either citation shape -- legacy freeform or structured. */
export type Citation = LegacyCitation | StructuredCitation;

/**
 * Type guard distinguishing structured citations from legacy freeform ones.
 * Structured citations carry a `kind` discriminator; legacy ones do not.
 */
export function isStructuredCitation(citation: Citation): citation is StructuredCitation {
	return typeof (citation as { kind?: unknown }).kind === 'string';
}

/**
 * Type guard for handbook-kind citations specifically. v1 resolver target.
 */
export function isHandbookCitation(citation: Citation): citation is Extract<StructuredCitation, { kind: 'handbook' }> {
	return isStructuredCitation(citation) && citation.kind === 'handbook';
}
