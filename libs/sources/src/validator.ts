/**
 * Rule engine for the `airboss-ref:` identifier scheme.
 *
 * Source of truth: ADR 019 §1.5 (15 rules) + §1.7 (the `unknown:` carve-out).
 *
 * Design: rules evaluate in order. The validator emits **exactly one ERROR
 * finding per identifier** (the first ERROR rule that fires terminates the
 * ERROR slot). WARNING and NOTICE rules can fire alongside an ERROR finding
 * and run independently.
 *
 * The validator depends on a `RegistryReader` interface; the default
 * `NULL_REGISTRY` returns "nothing accepted" for all queries, which is the
 * correct phase-1 behavior -- any author who writes a real identifier today
 * gets a row-2 ERROR until phase 2 lands the constants table.
 */

import type {
	IdentifierOccurrence,
	LessonAcknowledgment,
	ParsedIdentifier,
	ParseError,
	RegistryReader,
	Severity,
	SourceId,
	SourceLocation,
	ValidationFinding,
} from './types.ts';
import { UNKNOWN_CORPUS, UNPINNED_EDITION } from './types.ts';

/**
 * Context the rule engine needs from the lesson-parser to evaluate the
 * lesson-aware rules (rows 7, 8, 9, 13, 14).
 */
export interface RuleContext {
	readonly registry: RegistryReader;
	readonly location: SourceLocation;
	readonly occurrence?: IdentifierOccurrence;
	/** All acks in the current lesson; used by rule 13 and rule 14. */
	readonly acknowledgments?: readonly LessonAcknowledgment[];
}

/** Maximum reason-slug length before NOTICE row 14 fires. */
const REASON_SLUG_NOTICE_THRESHOLD = 48;

/**
 * Validate one identifier occurrence and return all findings (zero or more).
 *
 * @param parsed   Output of `parseIdentifier` for this occurrence's URL.
 * @param ctx      Registry + lesson context.
 * @param parseErr Optional original `ParseError` when `parsed` is `null`. Lets
 *                 row 1 carry the parser's specific error message.
 */
export function validateIdentifier(
	parsed: ParsedIdentifier | null,
	ctx: RuleContext,
	parseErr?: ParseError,
): readonly ValidationFinding[] {
	const findings: ValidationFinding[] = [];
	let errorEmitted = false;

	const raw = parsed?.raw ?? parseErr?.raw ?? '';

	const pushFinding = (severity: Severity, ruleId: number, message: string): void => {
		findings.push({
			severity,
			ruleId,
			message,
			location: ctx.location,
			identifier: raw.length > 0 ? raw : null,
		});
		if (severity === 'error') errorEmitted = true;
	};

	// -----------------------------------------------------------------
	// Row 0 -- unknown: magic prefix (§1.7)
	// Evaluated before row 1 so the parser-success path doesn't preempt
	// the migration prompt.
	// -----------------------------------------------------------------
	if (parsed !== null && parsed.corpus === UNKNOWN_CORPUS) {
		if (!errorEmitted) {
			pushFinding(
				'error',
				0,
				'Transitional reference; cannot publish. Replace with a real identifier or wait for ingestion of the relevant corpus.',
			);
		}
		// Row 0 is the only ERROR for unknown: identifiers. Skip row 1+ which
		// would otherwise fire on (e.g.) corpus-not-enumerated.
		return findings;
	}

	// -----------------------------------------------------------------
	// Row 1 -- identifier parses; corpus enumerated; non-empty locator.
	// -----------------------------------------------------------------
	if (parsed === null) {
		if (!errorEmitted) {
			const msg = parseErr?.message ?? 'identifier is malformed';
			pushFinding('error', 1, `parse failed: ${msg}`);
		}
		// No further rules can run without a parsed shape.
		return findings;
	}

	if (parsed.locator.length === 0) {
		if (!errorEmitted) {
			pushFinding('error', 1, 'identifier has empty locator');
		}
	} else if (!ctx.registry.isCorpusKnown(parsed.corpus)) {
		// Row 1 -- corpus is not enumerated in ADR 019 §1.2.
		// Phase 2 activated: the production registry returns true for every
		// enumerated corpus (regardless of whether real entries are populated).
		// `NULL_REGISTRY` still returns false; tests passing the stub explicitly
		// see this firing for any corpus, which matches Phase 1's row-2 behavior
		// in spirit (an empty registry rejects everything).
		if (!errorEmitted) {
			pushFinding('error', 1, `corpus "${parsed.corpus}" is not enumerated in ADR 019 §1.2`);
		}
	}

	const sourceId = parsed.raw as SourceId;

	// -----------------------------------------------------------------
	// Row 2 -- identifier resolves to an `accepted` or `superseded` registry entry.
	// -----------------------------------------------------------------
	const entry = ctx.registry.getEntry(sourceId);
	if (entry === null) {
		if (!errorEmitted) {
			pushFinding('error', 2, 'identifier does not resolve to a registered entry');
		}
	}

	// -----------------------------------------------------------------
	// Row 3 -- pinned edition exists in registry.
	// (Only meaningful if the entry exists; if entry is null, row 2 already
	// covered it. We still check this for completeness when the registry
	// happens to know the edition but not the entry -- defensive, harmless.)
	// -----------------------------------------------------------------
	if (parsed.pin !== null && parsed.pin !== UNPINNED_EDITION) {
		if (!ctx.registry.hasEdition(sourceId, parsed.pin)) {
			if (!errorEmitted) {
				pushFinding('error', 3, `pinned edition "${parsed.pin}" does not exist in registry`);
			}
		}
	}

	// -----------------------------------------------------------------
	// Row 4 -- entry resolves to `pending`, `draft`, or `retired`.
	// -----------------------------------------------------------------
	if (entry !== null) {
		const lifecycle = entry.lifecycle;
		if (lifecycle === 'pending' || lifecycle === 'draft' || lifecycle === 'retired') {
			if (!errorEmitted) {
				const message =
					lifecycle === 'pending'
						? 'entry is pending review'
						: lifecycle === 'draft'
							? 'entry is in draft'
							: 'entry is retired';
				pushFinding('error', 4, message);
			}
		}
	}

	// -----------------------------------------------------------------
	// Row 5 -- ?at=unpinned (WARNING).
	// -----------------------------------------------------------------
	if (parsed.pin === UNPINNED_EDITION) {
		pushFinding('warning', 5, 'identifier uses ?at=unpinned (authorial opt-out)');
	}

	// -----------------------------------------------------------------
	// Row 6 -- pinned edition is older than current `accepted` by > 1 (WARNING).
	// -----------------------------------------------------------------
	if (parsed.pin !== null && parsed.pin !== UNPINNED_EDITION) {
		const distance = ctx.registry.getEditionDistance(sourceId, parsed.pin);
		if (distance !== null && distance > 1) {
			pushFinding(
				'warning',
				6,
				`pinned edition "${parsed.pin}" is ${distance} editions older than the current accepted edition`,
			);
		}
	}

	// -----------------------------------------------------------------
	// Row 7 -- empty link text after stripping markup (ERROR).
	// -----------------------------------------------------------------
	if (
		ctx.occurrence !== undefined &&
		!ctx.occurrence.isBare &&
		ctx.occurrence.strippedText !== null &&
		ctx.occurrence.strippedText.length === 0
	) {
		if (!errorEmitted) {
			pushFinding('error', 7, 'link text is empty after stripping Markdown markup');
		}
	}

	// -----------------------------------------------------------------
	// Row 8 -- bare identifier in prose (NOTICE).
	// -----------------------------------------------------------------
	if (ctx.occurrence?.isBare === true) {
		pushFinding('notice', 8, 'bare airboss-ref: URL in prose; wrap in a Markdown link');
	}

	// -----------------------------------------------------------------
	// Row 9 -- lazy link text (NOTICE).
	// Heuristic: link text matches a canonical short pattern (e.g. "§91.103"
	// or "AC 61-65J") with no @-token. Tokens like @cite, @text, @list signal
	// authorial intent and should not be flagged.
	// -----------------------------------------------------------------
	if (
		ctx.occurrence !== undefined &&
		!ctx.occurrence.isBare &&
		ctx.occurrence.strippedText !== null &&
		isLazyLinkText(ctx.occurrence.strippedText)
	) {
		pushFinding(
			'notice',
			9,
			'lazy link text echoes the canonical short form; consider a token (@cite, @text) for render-time substitution',
		);
	}

	// -----------------------------------------------------------------
	// Rows 10-12 -- alias chain handling.
	// Row 10 silent auto-resolve; row 11 content-change WARNING; row 12
	// cross-section ERROR. Walk aliases from the identifier's pin to the
	// current accepted edition for the corpus and inspect every hop.
	// -----------------------------------------------------------------
	if (entry !== null && parsed.pin !== null && parsed.pin !== UNPINNED_EDITION) {
		const currentAccepted = ctx.registry.getCurrentAcceptedEdition(parsed.corpus);
		if (currentAccepted !== null && currentAccepted !== parsed.pin) {
			const aliases = ctx.registry.walkAliases(sourceId, parsed.pin, currentAccepted);
			for (const alias of aliases) {
				if (alias.kind === 'silent') continue; // row 10 is intentionally silent
				if (alias.kind === 'cross-section') {
					if (!errorEmitted) {
						pushFinding(
							'error',
							12,
							'cross-section alias encountered; resolver does not walk past it. Re-pin to the new identifier.',
						);
					}
					break; // resolver does NOT walk past; chain stops here.
				}
				if (alias.kind === 'content-change') {
					pushFinding(
						'warning',
						11,
						'content-change alias on the path; verify the lesson claim still holds against the new text',
					);
				}
				// 'split' and 'merge' kinds: render-time concerns; no validation finding.
			}
		}
	}

	// -----------------------------------------------------------------
	// Row 13 -- reference to superseded entry without acknowledgment (WARNING).
	// -----------------------------------------------------------------
	if (entry !== null && entry.lifecycle === 'superseded') {
		const acks = ctx.acknowledgments ?? [];
		const ackCovers = acks.some((ack) => ack.target === sourceId);
		if (!ackCovers) {
			pushFinding('warning', 13, 'reference is to a superseded entry without an acknowledgments entry');
		}
	}

	// -----------------------------------------------------------------
	// Row 14 -- ack reason slug exceeds 48 chars (NOTICE).
	// Fires once per offending ack on each occurrence that binds to it.
	// -----------------------------------------------------------------
	if (ctx.acknowledgments !== undefined) {
		for (const ack of ctx.acknowledgments) {
			if (ack.target !== sourceId) continue;
			if (ack.reason !== undefined && ack.reason.length > REASON_SLUG_NOTICE_THRESHOLD) {
				pushFinding(
					'notice',
					14,
					`acknowledgment reason slug "${ack.reason}" exceeds ${REASON_SLUG_NOTICE_THRESHOLD} chars (recommended 16-32)`,
				);
			}
		}
	}

	return findings;
}

// ---------------------------------------------------------------------------
// Lazy-link heuristic
// ---------------------------------------------------------------------------

/**
 * Lazy link text mirrors the canonical short form without an authoring token.
 * Examples that match: `§91.103`, `91.103`, `AC 61-65J`, `Order 8900.1`.
 * Examples that don't (token present): `@cite`, `@text`, `@list`,
 * `the IFR fuel and alternate trio @list`.
 *
 * Treat any link text containing an `@` followed by a letter as token-bearing
 * authorial intent; otherwise check whether the text reads as a canonical
 * short form (regulation citation, AC + revision, Order number, etc.).
 */
function isLazyLinkText(text: string): boolean {
	const trimmed = text.trim();
	if (trimmed.length === 0) return false;
	// Token present -> not lazy.
	if (/@[A-Za-z]/.test(trimmed)) return false;
	// CFR-style canonical short: optional `§`, digits, dot, digits, optional letter.
	if (/^§?\s*\d{1,3}\.\d{1,4}[a-zA-Z]?$/.test(trimmed)) return true;
	// AC-style: "AC 61-65J" or "AC 61-65 J" or "61-65J".
	if (/^(AC\s+)?\d{2,3}-\d{1,3}\s*[A-Z]?$/.test(trimmed)) return true;
	// FAA Order: "Order 8900.1" or "8900.1".
	if (/^(Order\s+)?\d{4,5}(\.\d{1,4})?$/.test(trimmed)) return true;
	return false;
}
