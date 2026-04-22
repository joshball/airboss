/**
 * The `Reference` type -- one authoritative chunk of content (a CFR section, a
 * glossary term, an AIM paragraph, a hand-authored explainer). The central
 * type the rest of `libs/aviation/` revolves around.
 *
 * Field-by-field rationale: architecture doc
 * `docs/work/todos/20260422-reference-system-architecture.md#the-reference-schema`.
 * The interface here intentionally mirrors that shape; don't add fields in
 * one place without updating the other.
 */

import type { SourceCitation } from './source';
import type { ReferenceTags } from './tags';

export interface Reference {
	/**
	 * Stable id. Source-prefixed so the id is guessable from the citation:
	 *   cfr-14-91-155         -> 14 CFR 91.155
	 *   aim-7-1-1             -> AIM 7-1-1
	 *   poh-c172s-4-5         -> POH Cessna 172S section 4.5
	 *   term-metar            -> hand-authored term
	 */
	id: string;

	/** The canonical label shown in UI. "14 CFR 91.155", "METAR", "Class B". */
	displayName: string;

	/**
	 * Alternate labels + nicknames the user might search by. Drives the
	 * `[[Something::]]` fuzzy-match + text-search.
	 */
	aliases: readonly string[];

	/** Tag bag on the 5-axis taxonomy. Required axes gated by validation. */
	tags: ReferenceTags;

	/**
	 * Plain-English explanation authored by the team. This is the teaching
	 * voice. Always present. Markdown + wiki-links both allowed.
	 */
	paraphrase: string;

	/**
	 * Source-verbatim text. Present for references with an authoritative
	 * primary source (CFR, AIM, POH, ...). Absent for hand-authored terms
	 * that paraphrase multiple sources.
	 */
	verbatim?: VerbatimBlock;

	/**
	 * Citations into the source registry. Non-empty when `verbatim` is
	 * present (enforced by validator). May carry multiple citations when a
	 * reference spans sections.
	 */
	sources: readonly SourceCitation[];

	/**
	 * "See also" ids. Must be symmetric: if `a.related` includes `b`, then
	 * `b.related` must include `a` (enforced by validator).
	 */
	related: readonly string[];

	/** Author attribution for hand-authored content. Optional. */
	author?: string;

	/**
	 * ISO-8601 date of the last human review. Drives the "stale reference"
	 * warning (>12 months). Optional because machine-extracted content
	 * doesn't pass through a human review gate on every rebuild.
	 */
	reviewedAt?: string;
}

export interface VerbatimBlock {
	/** The exact text from the source. Preserve whitespace + formatting. */
	text: string;

	/** Version of the source this text came from. Drives the yearly diff. */
	sourceVersion: string;

	/** ISO-8601 datetime the extraction ran. */
	extractedAt: string;
}
