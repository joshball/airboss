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

import { getCorpusResolver } from './registry/corpus-resolver.ts';
import { type CitationSentinel, compareSentinel, type SentinelLookup } from './sentinels.ts';
import type {
	IdentifierOccurrence,
	LessonAcknowledgment,
	ParsedIdentifier,
	ParseError,
	RegistryReader,
	RegistrySlugEdition,
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
	/**
	 * Per ADR 019 amendment 2026-05 §1: locator precision determines whether
	 * unpinned editions are tolerated.
	 *
	 * - `'doc-or-chapter-level'` -- doc-only, doc+chapter, doc+chapter+section.
	 *   Unpinned is OK; resolves to current edition; drift sentinel optionally
	 *   verifies content equivalence.
	 * - `'edition-sensitive'` -- includes a page number, paragraph (where
	 *   regs renumbered), or a sibling `quote:` field. Unpinned is ERROR.
	 *
	 * The lesson-parser computes this from the parsed locator + sibling
	 * frontmatter fields; the validator routes on it. When undefined the
	 * validator defaults to `'edition-sensitive'` (conservative -- matches
	 * pre-amendment behavior so callers that don't yet supply precision keep
	 * getting today's row-3 ERROR for missing pins).
	 */
	readonly locatorPrecision?: 'doc-or-chapter-level' | 'edition-sensitive' | 'editionless-corpus';
	/**
	 * Per ADR 019 amendment 2026-05 §2: drift sentinels captured alongside
	 * this citation (e.g. `chapter_title: Basic Flight Maneuvers`). The
	 * validator looks up the actual value via `sentinelLookup` and emits
	 * NOTICE on mismatch.
	 */
	readonly sentinels?: readonly CitationSentinel[];
	/**
	 * Per ADR 019 amendment 2026-05 §2: per-corpus resolver hook for sentinel
	 * comparison. The validator calls this once per (citation, sentinel)
	 * pair when sentinels are present.
	 */
	readonly sentinelLookup?: SentinelLookup;
	/**
	 * Per ADR 019 amendment 2026-05 §2 "Sentinel-laundering safeguard": when
	 * true, the citation's sentinel was modified in the same commit as a
	 * registry edition advance for the cited slug. The validator emits
	 * NOTICE so reviewers can confirm content equivalence; this NOTICE does
	 * NOT block the publish gate per ADR 019 §1.6.
	 */
	readonly sentinelLaundering?: boolean;
}

/** Maximum reason-slug length before NOTICE row 14 fires. */
const REASON_SLUG_NOTICE_THRESHOLD = 48;

/**
 * Corpora whose identifiers are immutable post-publication and never carry
 * an edition pin (per ADR 019 §1.2). The amendment §1 unpinned-precision
 * rule does not apply to these -- absent `?at=` is always OK.
 */
const EDITIONLESS_CORPORA: ReadonlySet<string> = new Set(['ntsb', 'ntsb-alj', 'asrs', 'interp', 'tcds']);

/**
 * Per ADR 019 amendment 2026-05 §1: derive `locatorPrecision` from a parsed
 * identifier so callers (e.g. `validateReferences`) don't have to re-parse
 * the locator. The amendment defines three classes:
 *
 *   - `editionless-corpus` -- corpora whose identifiers never carry editions
 *     (NTSB rulings, ASRS reports, Chief Counsel interpretations, TCDS).
 *   - `edition-sensitive` -- locator includes a paragraph, figure/table, or
 *     page-level token whose meaning depends on the cited edition. Unpinned
 *     is ERROR.
 *   - `doc-or-chapter-level` -- doc-only, doc+chapter, doc+chapter+section,
 *     or doc+chapter+section+subsection. Unpinned resolves to current edition.
 *
 * Pattern-matching on the locator string keeps this helper independent of
 * the per-corpus parsers: callers don't need a fully parsed locator to
 * decide pin policy. Each corpus is handled explicitly so a future
 * "page-12" or "para-7" extension lands as a one-line edit here.
 */
export function determineLocatorPrecision(
	parsed: ParsedIdentifier,
): 'doc-or-chapter-level' | 'edition-sensitive' | 'editionless-corpus' {
	if (EDITIONLESS_CORPORA.has(parsed.corpus)) return 'editionless-corpus';
	const locator = parsed.locator;
	switch (parsed.corpus) {
		case 'handbooks':
			// `<doc>/<edition>/<chapter>/<section>/para-N` (paragraph),
			// `<doc>/<edition>/fig-<N>-<M>` (figure),
			// `<doc>/<edition>/tbl-<N>-<M>` (table) -- all edition-sensitive.
			if (/\/para-[0-9]/.test(locator)) return 'edition-sensitive';
			if (/\/fig-[0-9]/.test(locator)) return 'edition-sensitive';
			if (/\/tbl-[0-9]/.test(locator)) return 'edition-sensitive';
			return 'doc-or-chapter-level';
		case 'regs': {
			// `cfr-<title>/<part>/<section>/<paragraph>...` -- 4+ segments past
			// the title prefix means a paragraph component is present.
			const segments = locator.split('/');
			// segments[0] = "cfr-14" / "cfr-49"; section is segments[2]; any
			// segment beyond that is paragraph-level (per ADR, paragraph
			// numbering can shift across edition snapshots).
			if (segments.length > 3) return 'edition-sensitive';
			return 'doc-or-chapter-level';
		}
		case 'aim':
			// AIM glossary entries (`/glossary/<slug>`) are slug-pinned to the
			// edition catalog and don't carry edition-sensitive precision; the
			// chapter-section-paragraph shape (`5-1-7`) does NOT include a
			// paragraph beyond what the locator already encodes via the third
			// numeric segment, but per ADR amendment those triples are still
			// "doc-or-chapter-level" precision (paragraph numbering is
			// AIM-section-stable across the rolling-update editions). Unpinned
			// is OK for the entire AIM corpus until we re-classify post-launch.
			return 'doc-or-chapter-level';
		case 'orders':
			// `<authority>/<order>/par-<N>` or `<authority>/<order>/page-<N>`
			// would be edition-sensitive; whole-order / chapter is not.
			if (/\/par-[0-9]/.test(locator)) return 'edition-sensitive';
			if (/\/page-[0-9]/.test(locator)) return 'edition-sensitive';
			return 'doc-or-chapter-level';
		default:
			// AC, ACS, PTS, statutes, sectionals, plates, pohs, forms, info,
			// safo: locator shapes don't carry paragraph/page tokens today, so
			// they're always doc-or-chapter-level. New corpora landing with
			// edition-sensitive precision must extend this switch.
			return 'doc-or-chapter-level';
	}
}

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
	// Row 2 -- identifier resolves to an `accepted` or `superseded` registry
	// entry, OR the corpus resolver recognises the locator.
	//
	// Per ADR 019 §2.1, the static `SOURCES` table is the registry's source
	// of truth, but corpora that ship content as on-disk derivatives keyed
	// by `(doc, edition)` (handbooks today; CFR sections eventually) do not
	// need a `SOURCES` row per locator -- the resolver IS the registry for
	// those corpora. When the static lookup misses, we ask the resolver via
	// its optional `isKnownLocator` predicate. Corpora that haven't opted
	// into resolver-as-registry leave `isKnownLocator` unset and the
	// fallback is a no-op (rule 2 ERROR fires as before).
	// -----------------------------------------------------------------
	const entry = ctx.registry.getEntry(sourceId);
	if (entry === null) {
		const resolver = getCorpusResolver(parsed.corpus);
		const resolverKnowsIt = resolver?.isKnownLocator?.(parsed) === true;
		if (!resolverKnowsIt && !errorEmitted) {
			pushFinding('error', 2, 'identifier does not resolve to a registered entry');
		}
	}

	// -----------------------------------------------------------------
	// Row 3 -- edition pin existence + amendment §1 unpinned-precision rule.
	//
	// Pre-amendment behavior: any unpinned identifier was an ERROR. Per ADR
	// 019 amendment 2026-05 §1, unpinned is now allowed for doc-or-chapter-
	// level locators (resolves to current edition) and remains an ERROR for
	// edition-sensitive locators (page, paragraph, quote). When the pin IS
	// supplied, the registry must contain it (the original row 3 check).
	// -----------------------------------------------------------------
	if (parsed.pin !== null && parsed.pin !== UNPINNED_EDITION) {
		if (!ctx.registry.hasEdition(sourceId, parsed.pin)) {
			if (!errorEmitted) {
				pushFinding('error', 3, `pinned edition "${parsed.pin}" does not exist in registry`);
			}
		}
	} else if (parsed.pin === UNPINNED_EDITION || parsed.pin === null) {
		// Per ADR 019 amendment 2026-05 D3, `?at=unpinned` is a legacy literal
		// with no remaining semantics. Treat it identically to omitting the
		// pin. Per amendment §1, missing pin is OK for doc-or-chapter-level
		// locators and for editionless corpora (NTSB, interp, ASRS, etc.); it
		// is ERROR for edition-sensitive locators (page, paragraph, quote).
		const isEditionless = EDITIONLESS_CORPORA.has(parsed.corpus);
		const precision = ctx.locatorPrecision ?? (isEditionless ? 'editionless-corpus' : 'edition-sensitive');
		if (precision === 'edition-sensitive' && !errorEmitted) {
			pushFinding(
				'error',
				3,
				'edition pin is required for edition-sensitive precision (page, paragraph, or quote). ' +
					'Add `?at=<edition>` or include the slug-encoded edition in the locator.',
			);
		}
		// 'doc-or-chapter-level' / 'editionless-corpus' + null pin: OK (no
		// row-3 finding). The new "no current edition for slug" rule below
		// covers the case where the registry has no current edition for the
		// slug; that rule does not apply to editionless corpora.
	}

	// -----------------------------------------------------------------
	// Row 3a (amendment §1 + D5) -- no current edition for slug.
	//
	// When an unpinned doc-or-chapter-level citation's slug has no current
	// (non-superseded, non-retired) edition in the registry, emit ERROR
	// with a registry-aware hint per amendment D5.
	// -----------------------------------------------------------------
	const effectivePrecision =
		ctx.locatorPrecision ?? (EDITIONLESS_CORPORA.has(parsed.corpus) ? 'editionless-corpus' : 'edition-sensitive');
	if (
		parsed.pin === null &&
		effectivePrecision === 'doc-or-chapter-level' &&
		ctx.registry.listEditionsForSlug !== undefined
	) {
		const slug = extractSlug(parsed.corpus, parsed.locator);
		if (slug !== null) {
			const editions = ctx.registry.listEditionsForSlug(parsed.corpus, slug);
			const hasCurrent = editions.some((e) => e.lifecycle === 'accepted');
			if (editions.length > 0 && !hasCurrent) {
				if (!errorEmitted) {
					pushFinding('error', 3, formatNoCurrentEditionHint(parsed.raw, slug, editions));
				}
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
	// Row 5 -- REMOVED per ADR 019 amendment 2026-05 D3.
	//
	// The `?at=unpinned` WARNING was retired in the same change that
	// introduced optional editions: authors learn one mechanism (omit the
	// edition entirely) instead of two. There were zero usages of
	// `?at=unpinned` in the wild at amendment time; no deprecation window
	// is required. The literal `?at=unpinned` is now treated as any other
	// pinned edition by the validator -- if the registry doesn't know it,
	// row 3 fires; if it does know it, no finding fires here.
	// -----------------------------------------------------------------

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

	// -----------------------------------------------------------------
	// Row 15 -- drift sentinel mismatch (NOTICE).
	// Per ADR 019 amendment 2026-05 §2: when an author captures a sentinel
	// (e.g. `chapter_title: Basic Flight Maneuvers`), the validator looks up
	// the actual value in the resolved (current) edition and emits NOTICE
	// when they differ. NOTICE does not block the publish gate.
	// -----------------------------------------------------------------
	if (ctx.sentinels !== undefined && ctx.sentinels.length > 0 && ctx.sentinelLookup !== undefined) {
		for (const sentinel of ctx.sentinels) {
			const actual = ctx.sentinelLookup(parsed, sentinel.field);
			const cmp = compareSentinel(sentinel.expected, actual);
			if (!cmp.match) {
				const actualText = cmp.actual ?? '(not found in registry)';
				pushFinding(
					'notice',
					15,
					`drift sentinel mismatch on ${sentinel.field}: expected "${sentinel.expected}", actual "${actualText}". ` +
						'Update the sentinel (content equivalent, retitled) or pin to the previous edition (content changed).',
				);
			}
		}
	}

	// -----------------------------------------------------------------
	// Row 16 -- sentinel-laundering safeguard (NOTICE).
	// Per ADR 019 amendment 2026-05 §2 "Sentinel-laundering safeguard":
	// when the citation's sentinel was modified in the same commit as a
	// registry edition advance for the cited slug, surface a NOTICE so the
	// reviewer can confirm content equivalence. NOTICE does NOT block the
	// publish gate per ADR 019 §1.6.
	// -----------------------------------------------------------------
	if (ctx.sentinelLaundering === true) {
		pushFinding(
			'notice',
			16,
			'sentinel updated against new edition -- reviewer should confirm content equivalence ' +
				'(this NOTICE does not block the publish gate).',
		);
	}

	return findings;
}

// ---------------------------------------------------------------------------
// No-current-edition hint formatting
// ---------------------------------------------------------------------------

/**
 * Pull the corpus-specific slug out of a locator. Per ADR 019 §1.2, the
 * slug is the first path segment for handbooks (`phak`, `afh`), the
 * authority+order-number pair for orders, etc. The validator's "no current
 * edition" rule only needs a stable key the registry can look up, so we
 * extract the first segment by default and let per-corpus refinement land
 * via the resolver registry when corpora need different slug shapes.
 */
function extractSlug(corpus: string, locator: string): string | null {
	const segments = locator.split('/');
	const first = segments[0];
	if (first === undefined || first.length === 0) return null;
	// Corpora whose slug spans multiple path segments override here. None
	// today need this; orders is `<authority>/<orderNumber>` but the
	// "no current edition" rule is moot for orders (no current-edition
	// concept yet). Add per-corpus extractors when needed.
	if (corpus === 'orders' && segments.length > 1) {
		return `${first}/${segments[1] ?? ''}`;
	}
	return first;
}

/**
 * Format the registry-aware ERROR hint per ADR 019 amendment 2026-05 D5.
 * Names the slug, lists up to 3 most-recent superseded editions with
 * supersession dates, and quotes the suggested pin string.
 */
function formatNoCurrentEditionHint(raw: string, slug: string, editions: readonly RegistrySlugEdition[]): string {
	const lines: string[] = [];
	lines.push(`${raw} has no current edition.`);
	lines.push(`  All editions of \`${slug}\` are superseded or retired.`);
	const superseded = editions
		.filter((e) => e.lifecycle === 'superseded' && e.supersededAt !== null)
		.sort((a, b) => {
			const aMs = a.supersededAt?.getTime() ?? 0;
			const bMs = b.supersededAt?.getTime() ?? 0;
			return bMs - aMs;
		})
		.slice(0, 3);
	if (superseded.length > 0) {
		lines.push('  Most recent prior editions:');
		for (const ed of superseded) {
			const date = ed.supersededAt?.toISOString().slice(0, 10) ?? 'unknown';
			lines.push(`    - ${ed.edition} (superseded ${date})`);
		}
		const newest = superseded[0];
		if (newest !== undefined) {
			lines.push(`  To cite the most recent: ${suggestedPinUri(raw, newest.edition)}`);
		}
	}
	return lines.join('\n');
}

/**
 * Build the suggested pin URI for the no-current-edition hint. Strips any
 * existing pin from `raw` and appends `?at=<edition>`. Round-trips through
 * the parser cleanly because the original raw string already passed it.
 */
function suggestedPinUri(raw: string, edition: string): string {
	const queryStart = raw.indexOf('?');
	const base = queryStart === -1 ? raw : raw.slice(0, queryStart);
	return `${base}?at=${edition}`;
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
