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

/**
 * The full §3.1 mode set. Phase 4 (renderer) ships full implementations for
 * `web`, `plain-text`, `print`, `tts`, plus forward-compatible surfaces for
 * the seven additional modes per §3.1's render-mode behavior table.
 */
export type RenderMode =
	| 'web'
	| 'plain-text'
	| 'print'
	| 'tts'
	| 'screen-reader'
	| 'rss'
	| 'share-card'
	| 'rag'
	| 'slack-unfurl'
	| 'transclusion'
	| 'tooltip';

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
 * returns the segmented opaque shape. Phase 3+ corpus resolvers extend with an
 * optional, corpus-specific payload (the `regs` payload below for CFR, future
 * `handbooks` / `aim` / etc.) without breaking the Phase 1 + Phase 2 readers
 * that only consume `kind` + `segments`.
 *
 * The richer payload is optional in TypeScript's structural sense: callers who
 * only read `segments` continue to work; resolvers that know about a specific
 * corpus narrow on their key (`'regs' in parsed`) before consuming the payload.
 */
export type ParsedLocator = {
	readonly kind: 'ok';
	readonly segments: readonly string[];
	/** CFR (regs) payload populated by Phase 3's `parseRegsLocator`. */
	readonly regs?: ParsedRegsLocator;
	/** Handbooks payload populated by Phase 6's `parseHandbooksLocator`. */
	readonly handbooks?: ParsedHandbooksLocator;
	/** ACS payload populated by `parseAcsLocator` (cert-syllabus WP). */
	readonly acs?: ParsedAcsLocator;
};

/**
 * Structured CFR locator surfaced by `parseRegsLocator` in `libs/sources/src/regs/locator.ts`.
 * Source of truth: ADR 019 §1.2 ("Regulations") plus the WP at
 * `docs/work-packages/reference-cfr-ingestion-bulk/`.
 */
export interface ParsedRegsLocator {
	readonly title: '14' | '49';
	readonly part: string;
	readonly subpart?: string;
	readonly section?: string;
	readonly paragraph?: readonly string[];
}

/**
 * Structured handbooks locator surfaced by `parseHandbooksLocator` in
 * `libs/sources/src/handbooks/locator.ts`. Source of truth: ADR 019 §1.2
 * ("Handbooks") plus the WP at `docs/work-packages/reference-handbook-ingestion/`.
 *
 * The doc slug + edition slug together pin the handbook (8083-25D is a new
 * doc slug entirely). Section identifiers are integers reflecting the FAA's
 * dotted-code convention (locator path `12/3` maps to manifest code `12.3`).
 *
 * Figures and tables parse correctly but do not have registry entries; they
 * resolve to derivative files via the renderer when `@text` / `@quote` is bound.
 */
export interface ParsedHandbooksLocator {
	/** Document slug -- `phak`, `afh`, `avwx`, ... */
	readonly doc: string;
	/** Edition slug -- `8083-25C`, `8083-3C`, `8083-28B`, ... (no `FAA-H-` prefix) */
	readonly edition: string;
	/** Chapter number as written in the locator (e.g. `'12'`). */
	readonly chapter?: string;
	/** Section component -- digits or the special string `'intro'`. */
	readonly section?: string;
	/** Subsection number as written (e.g. `'2'`). */
	readonly subsection?: string;
	/** Paragraph token (e.g. `'para-2'`); resolves to the containing section. */
	readonly paragraph?: string;
	/** Figure id (e.g. `'fig-12-7'`); parses but has no registry entry. */
	readonly figure?: string;
	/** Table id (e.g. `'tbl-12-3'`); parses but has no registry entry. */
	readonly table?: string;
}

/**
 * Structured ACS / PTS locator surfaced by `parseAcsLocator` in
 * `libs/sources/src/acs/locator.ts`. Source of truth: ADR 019 §1.2 ("ACS")
 * plus the WP at `docs/work-packages/cert-syllabus-and-goal-composer/`.
 *
 * Locator shape -- pinned to ADR 019 §1.2's documented convention:
 *
 *   <cert>/<edition>                                            whole publication
 *   <cert>/<edition>/area-<n>                                   area
 *   <cert>/<edition>/area-<n>/task-<x>                          task
 *   <cert>/<edition>/area-<n>/task-<x>/element-<triad><ord>     element
 *
 * `<n>` is a roman-numeral lowercased (e.g. `area-v`); `<x>` is a
 * lowercased letter (e.g. `task-a`); element names always carry the K/R/S
 * triad prefix followed by the ordinal (e.g. `element-k1`, `element-r2`,
 * `element-s3`).
 *
 * Open Question 7 (final ACS locator convention) is still pending. This
 * parser implements ADR 019 §1.2's example exactly; if the convention
 * resolves differently the parser updates here without breaking callers
 * that only consume `segments`.
 */
export interface ParsedAcsLocator {
	/** Cert slug -- `ppl-asel`, `cfi-asel`, etc. Lowercase kebab-case. */
	readonly cert: string;
	/** Edition slug -- `faa-s-acs-25`, etc. Lowercase. */
	readonly edition: string;
	/** Area roman numeral, lowercased (e.g. `'v'` for Area V). */
	readonly area?: string;
	/** Task letter, lowercased (e.g. `'a'`). */
	readonly task?: string;
	/** Element triad: `'k'`, `'r'`, or `'s'`. Always present when `elementOrdinal` is set. */
	readonly elementTriad?: 'k' | 'r' | 's';
	/** Element ordinal as written (`'1'`, `'2'`, ...). */
	readonly elementOrdinal?: string;
}

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

// ---------------------------------------------------------------------------
// Phase 4 -- Renderer runtime (ADR 019 §1.4, §2.5, §3.1, §3.4, §6.2, §6.3)
// ---------------------------------------------------------------------------

/**
 * Annotation kind derived from the lesson's `acknowledgments` cascade plus the
 * supersession chain shape. Computed once per identifier in `batchResolve`;
 * each render mode then PLACES the annotation per §3.1's render-mode table.
 */
export type AnnotationKind = 'none' | 'covered' | 'chain-advanced' | 'historical' | 'cross-corpus';

export interface ResolvedAnnotation {
	readonly kind: AnnotationKind;
	/** Display text for the annotation. Format depends on `kind`. */
	readonly text: string;
	/** Optional ack `note` for tooltip-bound rendering. */
	readonly note?: string;
}

/**
 * One identifier resolved for render-time consumption. The map returned by
 * `batchResolve` is keyed on the **raw identifier string with pin** so two
 * references to the same entry under different pins each get a row.
 */
export interface ResolvedIdentifier {
	readonly raw: string;
	readonly parsed: ParsedIdentifier;
	/** SourceEntry after pin-strip. Null when the registry has no entry. */
	readonly entry: SourceEntry | null;
	/** Supersession chain from `entry` forward (entry is element 0). Empty when entry is null. */
	readonly chain: readonly SourceEntry[];
	/** Per-corpus live URL for the pin. Null when resolver has none. */
	readonly liveUrl: string | null;
	/** Indexed-tier content. Lazily populated only when `@text`/`@quote` is bound. */
	readonly indexed: IndexedContent | null;
	readonly annotation: ResolvedAnnotation;
}

export type ResolvedIdentifierMap = ReadonlyMap<string, ResolvedIdentifier>;

/**
 * SvelteKit-transport-safe view of `ResolvedIdentifier`. `Date` becomes ISO
 * string; the `Map` flattens to a `Record`. Round-trip via `toSerializable`/
 * `fromSerializable` in `@ab/sources/render`.
 */
export interface SerializableSourceEntry extends Omit<SourceEntry, 'last_amended_date'> {
	readonly last_amended_date: string;
}

export interface SerializableResolvedIdentifier {
	readonly raw: string;
	readonly parsed: ParsedIdentifier;
	readonly entry: SerializableSourceEntry | null;
	readonly chain: readonly SerializableSourceEntry[];
	readonly liveUrl: string | null;
	readonly indexed: IndexedContent | null;
	readonly annotation: ResolvedAnnotation;
}

export type SerializableResolvedMap = Record<string, SerializableResolvedIdentifier>;

/** Multi-reference adjacency group per §1.4. */
export interface AdjacencyGroup {
	readonly corpus: string;
	readonly pin: string | null;
	/** Raw identifiers (with pin) in source order. Length >= 1. */
	readonly members: readonly string[];
	/** `'range'` when locator-prefix-equal + last-segment numeric + contiguous; `'list'` otherwise. */
	readonly shape: 'range' | 'list';
}

/** Token shape per §3.1; the registry is open via `registerToken`. */
export type TokenName = `@${string}`;

export type TokenKind = 'identity' | 'content' | 'derived';

export interface TokenContext {
	readonly resolved: ResolvedIdentifier;
	readonly mode: RenderMode;
	/** Adjacency group this identifier belongs to, if any. `@list` consumes this. */
	readonly group?: AdjacencyGroup;
	/** Pin literal for `@as-of`; null when the identifier was unpinned. */
	readonly pin: string | null;
	/** Resolved-map for `@list` to look up each member's `canonical_short`. */
	readonly resolvedMap: ResolvedIdentifierMap;
}

export interface Token {
	readonly name: TokenName;
	readonly kind: TokenKind;
	substitute(ctx: TokenContext): string;
}

/** Context passed into `batchResolve`. */
export interface BatchResolveContext {
	readonly acknowledgments: readonly LessonAcknowledgment[];
	readonly historicalLens: boolean;
	/**
	 * Lesson body. Used only to detect which identifiers have `@text`/`@quote`
	 * bound so indexed-tier reads stay lazy. `batchResolve` does not parse the
	 * body for occurrences again; that work happens in `extractIdentifiers`.
	 */
	readonly body: string;
}

/** Per-link state passed into a render-mode handler. */
export interface LinkRenderContext {
	/** Raw identifier as written. */
	readonly raw: string;
	/** Original Markdown link text (before token substitution). */
	readonly linkText: string;
	/** Token-substituted link text. */
	readonly substituted: string;
	readonly resolved: ResolvedIdentifier;
	readonly mode: RenderMode;
	readonly group?: AdjacencyGroup;
	/**
	 * Position in the adjacency group: 0 means first (emit anchor), >0 means
	 * follow-up (suppressed by the dispatcher when the mode collapses groups).
	 */
	readonly groupIndex: number;
	/** When set, the mode emits the group's combined link text instead of `substituted`. */
	readonly groupListText?: string;
	/** Footnote sink (print mode); modes that don't footnote leave it undefined. */
	readonly footnoteSink?: (text: string) => number;
}
