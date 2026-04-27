/**
 * Type set for the airboss-ref: identifier scheme.
 *
 * Source of truth: ADR 019 §1, §2.1, §3.4, §6.1.
 *
 * Phase 1 ships these types alongside the parser, validator, and lesson-parser.
 * Phase 2 (`reference-source-registry-core`) provides the real `RegistryReader`
 * implementation against the constants table; the types do not change.
 */

// ---------------------------------------------------------------------------
// Identifier shape -- ADR 019 §1.1, §1.2
// ---------------------------------------------------------------------------

/**
 * Branded canonical identifier string. Always of the form
 * `airboss-ref:<corpus>/<locator>(?at=<edition>)?`.
 */
export type SourceId = string & { readonly __brand: 'SourceId' };

/**
 * Magic prefix used by the parser when an author writes `airboss-ref:unknown/...`.
 * The validator's row 0 ERROR fires for any identifier with this corpus.
 * See ADR 019 §1.7.
 */
export const UNKNOWN_CORPUS = 'unknown' as const;

/**
 * Special value of the `?at=` query parameter for explicit unpinned references.
 * See ADR 019 §1.3 (last row of the table).
 */
export const UNPINNED_EDITION = 'unpinned' as const;

/** Successful parse of an `airboss-ref:` URL. */
export interface ParsedIdentifier {
	readonly raw: string;
	readonly corpus: string;
	readonly locator: string;
	readonly pin: string | null;
}

/** Reasons a raw string can fail to parse as an `airboss-ref:` URL. */
export type ParseErrorKind =
	| 'not-airboss-ref'
	| 'path-absolute'
	| 'authority-based'
	| 'empty-corpus'
	| 'empty-locator'
	| 'malformed-query';

export interface ParseError {
	readonly kind: ParseErrorKind;
	readonly message: string;
	readonly raw: string;
}

// ---------------------------------------------------------------------------
// Registry shape -- ADR 019 §2.1, §2.4, §6.1
// ---------------------------------------------------------------------------

export type SourceLifecycle = 'draft' | 'pending' | 'accepted' | 'retired' | 'superseded';

export interface SourceEntry {
	readonly id: SourceId;
	readonly corpus: string;
	readonly canonical_short: string;
	readonly canonical_formal: string;
	readonly canonical_title: string;
	readonly last_amended_date: Date;
	readonly alternative_names?: readonly string[];
	readonly supersedes?: SourceId;
	readonly superseded_by?: SourceId;
	readonly lifecycle: SourceLifecycle;
}

export type AliasKind = 'silent' | 'content-change' | 'cross-section' | 'split' | 'merge';

export interface AliasEntry {
	readonly from: SourceId;
	readonly to: SourceId | readonly SourceId[];
	readonly kind: AliasKind;
}

export interface Edition {
	readonly id: string;
	readonly published_date: Date;
	readonly source_url: string;
	readonly aliases?: readonly AliasEntry[];
}

/**
 * Minimal registry interface the validator depends on. Phase 2 provides the
 * real implementation; Phase 1 ships only the `NULL_REGISTRY` stub plus inline
 * fixtures in tests.
 */
export interface RegistryReader {
	hasEntry(id: SourceId): boolean;
	getEntry(id: SourceId): SourceEntry | null;
	hasEdition(id: SourceId, edition: string): boolean;
	getEditionLifecycle(id: SourceId, edition: string): SourceLifecycle | null;
	getCurrentAcceptedEdition(corpus: string): string | null;
	/**
	 * Number of editions between `pin` and the current `accepted` edition for the
	 * entry's corpus. 0 means "pin is current". Positive values mean "pin is
	 * older than current". `null` means the registry can't compute it (unknown
	 * corpus, unknown pin, etc.).
	 */
	getEditionDistance(id: SourceId, pin: string): number | null;
	walkAliases(id: SourceId, fromEdition: string, toEdition: string): readonly AliasEntry[];
	walkSupersessionChain(id: SourceId): readonly SourceEntry[];
	isCorpusKnown(corpus: string): boolean;
}

// ---------------------------------------------------------------------------
// Validation -- ADR 019 §1.5
// ---------------------------------------------------------------------------

export type Severity = 'error' | 'warning' | 'notice';

/** A finding from the rule engine or the lesson-parser. */
export interface ValidationFinding {
	readonly severity: Severity;
	/** Rule index 0..14 per ADR 019 §1.5. -1 for lesson-parser-internal findings. */
	readonly ruleId: number;
	readonly message: string;
	readonly location: SourceLocation;
	/** Raw URL string. `null` for ack-level findings (orphan ack, etc.). */
	readonly identifier: string | null;
}

export interface SourceLocation {
	readonly file: string;
	readonly line: number;
	readonly column: number;
}

// ---------------------------------------------------------------------------
// Render mode -- ADR 019 §3.1
// ---------------------------------------------------------------------------

export type RenderMode = 'web' | 'print' | 'tts' | 'plain-text';

// ---------------------------------------------------------------------------
// Phase 2 -- registry core (ADR 019 §2)
// ---------------------------------------------------------------------------

/** An edition slug, matching the `?at=` value (e.g. '2026', '2026-09', '2026-09-15'). */
export type EditionId = string;

/**
 * Repo-relative path of a lesson file with `.md` stripped (e.g.
 * `course/regulations/week-04-part-91-general-and-flight-rules/05-preflight-action`).
 */
export type LessonId = string;

/**
 * Per-corpus parsed locator. Phase 2 ships the default no-op resolver which
 * returns segmented opaque shape. Phase 3+ corpus resolvers may return richer
 * shapes (CFR returns `{ title, part, section, paragraph }`, etc.) by extending
 * this discriminated union when their corpus lands.
 */
export type ParsedLocator = { readonly kind: 'ok'; readonly segments: readonly string[] };

export interface LocatorError {
	readonly kind: 'error';
	readonly message: string;
}

/**
 * Indexed-tier content surfaced via `CorpusResolver.getIndexedContent`. Per ADR
 * 019 §2.5 + §4. Phase 2 returns null from the default resolver; Phase 3+ fill
 * this in with corpus-specific structured content (CFR section text, AIM
 * paragraph, AC chapter, etc.).
 */
export interface IndexedContent {
	readonly id: SourceId;
	readonly edition: EditionId;
	readonly normalizedText: string;
	readonly figures?: readonly string[];
	readonly tables?: readonly string[];
}

// ---------------------------------------------------------------------------
// Lesson-parser surface -- ADR 019 §3.4
// ---------------------------------------------------------------------------

export interface LessonAcknowledgment {
	/** Optional Markdown reference label that body links use to bind to this ack. */
	readonly id?: string;
	readonly target: SourceId;
	readonly superseder?: SourceId;
	readonly reason?: string;
	/** Default false. */
	readonly historical: boolean;
	readonly note?: string;
}

/**
 * One occurrence of an `airboss-ref:` URL inside a lesson body. The validator
 * receives one of these per occurrence and produces zero-or-more findings.
 */
export interface IdentifierOccurrence {
	readonly raw: string;
	readonly location: SourceLocation;
	readonly linkText: string | null;
	/** Link text after stripping Markdown markup (`*`, `_`, `` ` ``, etc.). */
	readonly strippedText: string | null;
	/** True when the occurrence was bare prose (no `[text](url)` wrapping). */
	readonly isBare: boolean;
	/** Reference-style label, when the occurrence used `[text][label]` form. */
	readonly referenceLabel: string | null;
}

/** Result of parsing one lesson Markdown file. */
export interface LessonParseResult {
	readonly file: string;
	readonly acknowledgments: readonly LessonAcknowledgment[];
	readonly occurrences: readonly IdentifierOccurrence[];
	/** Findings from the lesson-parser itself (frontmatter / label resolution / orphan acks). */
	readonly findings: readonly ValidationFinding[];
}
