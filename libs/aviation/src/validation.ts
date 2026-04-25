/**
 * Build-time reference + content validation.
 *
 * Two distinct layers:
 *
 *   1) `validateReferences(refs)` -- audits the reference data itself:
 *      tag completeness, enum membership, symmetric `related[]`, keyword
 *      shape, `verbatim`/`sources` coherence, duplicate ids, reviewedAt
 *      staleness, and every `sources[].sourceId` resolving against the
 *      `SOURCES` registry. Pure function.
 *
 *   2) `validateContentWikilinks(scans, registry)` -- audits content
 *      (knowledge markdown, help content TS, paraphrase text) against the
 *      populated registry: every `[[*::id]]` must resolve to a known
 *      reference; malformed parser output escalates to errors; `[[text::]]`
 *      TBD-id links accumulate as warnings.
 *
 * Either layer returns `{ errors, warnings }` the caller aggregates.
 * Callers (`scripts/references/validate.ts`, `scripts/check.ts`, the dev
 * launcher) decide whether `errors.length > 0` fails the build.
 */

import {
	AVIATION_TOPIC_MAX,
	AVIATION_TOPIC_MIN,
	AVIATION_TOPIC_VALUES,
	CERT_APPLICABILITY_VALUES,
	FLIGHT_RULES_VALUES,
	KNOWLEDGE_KIND_VALUES,
	KNOWLEDGE_KINDS,
	PHASE_REQUIRING_SOURCE_TYPES,
	REFERENCE_BANNED_KEYWORDS,
	REFERENCE_KEYWORD_MAX_COUNT,
	REFERENCE_KEYWORD_MAX_LENGTH,
	REFERENCE_PHASE_OF_FLIGHT_MAX,
	REFERENCE_PHASE_OF_FLIGHT_VALUES,
	SOURCE_TYPE_VALUES,
} from '@ab/constants';
import type { Reference } from './schema/reference';
import { SOURCES } from './sources/registry';
import { extractWikilinks, type WikilinkParseError } from './wikilink/parser';

export interface ValidationIssue {
	message: string;
	/** Optional id of the offending reference. */
	referenceId?: string;
	/** Optional content source location (file path or similar). */
	location?: string;
}

export interface ValidationResult {
	errors: readonly ValidationIssue[];
	warnings: readonly ValidationIssue[];
}

const STALE_REVIEW_MS = 365 * 24 * 60 * 60 * 1000;

// -------- layer 1: reference data --------

export function validateReferences(refs: readonly Reference[]): ValidationResult {
	const errors: ValidationIssue[] = [];
	const warnings: ValidationIssue[] = [];

	const knownSourceIds = new Set<string>(SOURCES.map((s) => s.id));

	const seenIds = new Map<string, Reference>();
	for (const ref of refs) {
		validateOneReference(ref, errors, knownSourceIds);

		const existing = seenIds.get(ref.id);
		if (existing && existing !== ref) {
			errors.push({
				message: `Duplicate reference id '${ref.id}'.`,
				referenceId: ref.id,
			});
		} else {
			seenIds.set(ref.id, ref);
		}
	}

	// Cross-reference checks: related[] symmetry + reviewedAt staleness.
	const now = Date.now();
	for (const ref of refs) {
		for (const otherId of ref.related) {
			if (otherId === ref.id) {
				errors.push({
					message: `Reference '${ref.id}' lists itself in related[].`,
					referenceId: ref.id,
				});
				continue;
			}
			const other = seenIds.get(otherId);
			if (!other) {
				errors.push({
					message: `Reference '${ref.id}' has related id '${otherId}' that is not in the registry.`,
					referenceId: ref.id,
				});
				continue;
			}
			if (!other.related.includes(ref.id)) {
				errors.push({
					message: `related[] asymmetric: '${ref.id}' -> '${otherId}' but '${otherId}' does not link back.`,
					referenceId: ref.id,
				});
			}
		}

		if (ref.reviewedAt) {
			const reviewed = Date.parse(ref.reviewedAt);
			if (Number.isNaN(reviewed)) {
				errors.push({
					message: `Reference '${ref.id}' has unparseable reviewedAt '${ref.reviewedAt}'.`,
					referenceId: ref.id,
				});
			} else if (now - reviewed > STALE_REVIEW_MS) {
				warnings.push({
					message: `Reference '${ref.id}' was last reviewed ${ref.reviewedAt} (> 12 months).`,
					referenceId: ref.id,
				});
			}
		}
	}

	return { errors, warnings };
}

function validateOneReference(ref: Reference, errors: ValidationIssue[], knownSourceIds: ReadonlySet<string>): void {
	const { id, tags } = ref;

	if (!id || id.trim() === '') {
		errors.push({ message: 'Reference missing id.', referenceId: id });
	}
	if (!ref.displayName || ref.displayName.trim() === '') {
		errors.push({ message: `Reference '${id}' missing displayName.`, referenceId: id });
	}
	if (!ref.paraphrase || ref.paraphrase.trim() === '') {
		errors.push({ message: `Reference '${id}' missing paraphrase.`, referenceId: id });
	}

	// Required axes.
	if (!(SOURCE_TYPE_VALUES as readonly string[]).includes(tags.sourceType)) {
		errors.push({
			message: `Reference '${id}' has invalid sourceType '${tags.sourceType}'.`,
			referenceId: id,
		});
	}
	if (!(FLIGHT_RULES_VALUES as readonly string[]).includes(tags.flightRules)) {
		errors.push({
			message: `Reference '${id}' has invalid flightRules '${tags.flightRules}'.`,
			referenceId: id,
		});
	}
	if (!(KNOWLEDGE_KIND_VALUES as readonly string[]).includes(tags.knowledgeKind)) {
		errors.push({
			message: `Reference '${id}' has invalid knowledgeKind '${tags.knowledgeKind}'.`,
			referenceId: id,
		});
	}

	// aviationTopic: 1-4, enum, no dupes.
	if (!Array.isArray(tags.aviationTopic) || tags.aviationTopic.length === 0) {
		errors.push({
			message: `Reference '${id}' is missing aviationTopic (required, ${AVIATION_TOPIC_MIN}-${AVIATION_TOPIC_MAX} values).`,
			referenceId: id,
		});
	} else {
		if (tags.aviationTopic.length < AVIATION_TOPIC_MIN || tags.aviationTopic.length > AVIATION_TOPIC_MAX) {
			errors.push({
				message: `Reference '${id}' has ${tags.aviationTopic.length} aviationTopic entries (${AVIATION_TOPIC_MIN}-${AVIATION_TOPIC_MAX} required).`,
				referenceId: id,
			});
		}
		const seen = new Set<string>();
		for (const topic of tags.aviationTopic) {
			if (!(AVIATION_TOPIC_VALUES as readonly string[]).includes(topic)) {
				errors.push({
					message: `Reference '${id}' has invalid aviationTopic '${topic}'.`,
					referenceId: id,
				});
			}
			if (seen.has(topic)) {
				errors.push({
					message: `Reference '${id}' lists duplicate aviationTopic '${topic}'.`,
					referenceId: id,
				});
			}
			seen.add(topic);
		}
	}

	// phaseOfFlight: conditionally required, 0-3, enum, no dupes.
	const requiresPhase =
		(PHASE_REQUIRING_SOURCE_TYPES as readonly string[]).includes(tags.sourceType) ||
		tags.knowledgeKind === KNOWLEDGE_KINDS.PROCEDURE;
	if (requiresPhase && (!tags.phaseOfFlight || tags.phaseOfFlight.length === 0)) {
		errors.push({
			message: `Reference '${id}' requires phaseOfFlight (sourceType='${tags.sourceType}', knowledgeKind='${tags.knowledgeKind}').`,
			referenceId: id,
		});
	}
	if (tags.phaseOfFlight) {
		if (tags.phaseOfFlight.length > REFERENCE_PHASE_OF_FLIGHT_MAX) {
			errors.push({
				message: `Reference '${id}' has ${tags.phaseOfFlight.length} phaseOfFlight entries (max ${REFERENCE_PHASE_OF_FLIGHT_MAX}).`,
				referenceId: id,
			});
		}
		const seen = new Set<string>();
		for (const phase of tags.phaseOfFlight) {
			if (!(REFERENCE_PHASE_OF_FLIGHT_VALUES as readonly string[]).includes(phase)) {
				errors.push({
					message: `Reference '${id}' has invalid phaseOfFlight '${phase}'.`,
					referenceId: id,
				});
			}
			if (seen.has(phase)) {
				errors.push({
					message: `Reference '${id}' lists duplicate phaseOfFlight '${phase}'.`,
					referenceId: id,
				});
			}
			seen.add(phase);
		}
	}

	// certApplicability: optional, no dupes, enum.
	if (tags.certApplicability) {
		const seen = new Set<string>();
		for (const cert of tags.certApplicability) {
			if (!(CERT_APPLICABILITY_VALUES as readonly string[]).includes(cert)) {
				errors.push({
					message: `Reference '${id}' has invalid certApplicability '${cert}'.`,
					referenceId: id,
				});
			}
			if (seen.has(cert)) {
				errors.push({
					message: `Reference '${id}' lists duplicate certApplicability '${cert}'.`,
					referenceId: id,
				});
			}
			seen.add(cert);
		}
	}

	// keywords: optional, <= max count, each non-empty, <= max length, no zombies.
	if (tags.keywords) {
		if (tags.keywords.length > REFERENCE_KEYWORD_MAX_COUNT) {
			errors.push({
				message: `Reference '${id}' has ${tags.keywords.length} keywords (max ${REFERENCE_KEYWORD_MAX_COUNT}).`,
				referenceId: id,
			});
		}
		for (const keyword of tags.keywords) {
			if (!keyword || keyword.length === 0) {
				errors.push({
					message: `Reference '${id}' has an empty keyword.`,
					referenceId: id,
				});
				continue;
			}
			if (keyword.length > REFERENCE_KEYWORD_MAX_LENGTH) {
				errors.push({
					message: `Reference '${id}' keyword '${keyword}' exceeds ${REFERENCE_KEYWORD_MAX_LENGTH} chars.`,
					referenceId: id,
				});
			}
			if ((REFERENCE_BANNED_KEYWORDS as readonly string[]).includes(keyword)) {
				errors.push({
					message: `Reference '${id}' uses banned zombie keyword '${keyword}'. Use a proper tag axis.`,
					referenceId: id,
				});
			}
		}
	}

	// verbatim <-> sources coherence.
	if (ref.verbatim && ref.sources.length === 0) {
		errors.push({
			message: `Reference '${id}' has verbatim but no sources[].`,
			referenceId: id,
		});
	}

	// Shape check + registry gate: sourceId must be non-empty and resolve
	// against the populated `SOURCES` registry; locator must be an object.
	for (const citation of ref.sources) {
		if (!citation.sourceId || citation.sourceId.trim() === '') {
			errors.push({
				message: `Reference '${id}' has a sources[] entry with empty sourceId.`,
				referenceId: id,
			});
		} else if (!knownSourceIds.has(citation.sourceId)) {
			errors.push({
				message: `Reference '${id}' cites unregistered sourceId '${citation.sourceId}'. Add the source to SOURCES in libs/aviation/src/sources/registry.ts.`,
				referenceId: id,
			});
		}
		if (!citation.locator || typeof citation.locator !== 'object') {
			errors.push({
				message: `Reference '${id}' has a sources[] entry with missing or invalid locator.`,
				referenceId: id,
			});
		}
	}
}

// -------- layer 2: content wiki-links --------

export interface ContentScan {
	/** Content source path (display only -- error messages, reports). */
	path: string;
	/** The prose text to scan. */
	source: string;
}

export interface ContentValidationSummary {
	/** Total wiki-links found across scans. */
	linkCount: number;
	/** TBD-id links (`[[text::]]`) by path. */
	tbd: readonly { path: string; display: string }[];
	/** All ids observed (for orphan computation). */
	citedIds: ReadonlySet<string>;
	/**
	 * Reference ids in the registry that no content currently cites. Surfaced
	 * as a summary field (not a warning) because in early build-out most
	 * registered references are bulk-imported FAA material waiting on
	 * citing content -- a noisy `warn:` line on every dev startup is not
	 * useful. Callers (e.g. `scripts/references/validate.ts`) can promote
	 * this to a warning behind `--verbose` when they want the signal.
	 */
	orphanIds: readonly string[];
}

export function validateContentWikilinks(
	scans: readonly ContentScan[],
	options: { hasReference(id: string): boolean; knownIds: readonly string[] },
): ValidationResult & { summary: ContentValidationSummary } {
	const errors: ValidationIssue[] = [];
	const warnings: ValidationIssue[] = [];
	const tbd: { path: string; display: string }[] = [];
	const citedIds = new Set<string>();
	let linkCount = 0;

	for (const scan of scans) {
		const { wikilinks, errors: parseErrors } = extractWikilinks(scan.source);
		for (const e of parseErrors) {
			errors.push({
				message: describeParseError(e, scan.source),
				location: scan.path,
			});
		}
		for (const link of wikilinks) {
			linkCount += 1;
			if (link.id === null) {
				tbd.push({ path: scan.path, display: link.display ?? '' });
				continue;
			}
			citedIds.add(link.id);
			if (!options.hasReference(link.id)) {
				errors.push({
					message: `Wiki-link cites unknown reference id '${link.id}'.`,
					location: scan.path,
				});
			}
		}
	}

	if (tbd.length > 0) {
		warnings.push({
			message: `${tbd.length} TBD-id wiki-link${tbd.length === 1 ? '' : 's'} (first: '${tbd[0]?.display}' in ${tbd[0]?.path}).`,
		});
	}

	// Orphan detection: registered references with no citing content.
	// Returned via `summary.orphanIds` rather than pushed as a warning. See
	// the type doc for the rationale.
	const orphanIds = options.knownIds.filter((id) => !citedIds.has(id));

	return {
		errors,
		warnings,
		summary: { linkCount, tbd, citedIds, orphanIds },
	};
}

function describeParseError(error: WikilinkParseError, source: string): string {
	const [start] = error.sourceSpan;
	const before = source.slice(0, start);
	const line = before.split('\n').length;
	return `${error.message} (line ${line})`;
}
