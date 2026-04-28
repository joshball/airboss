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
	/** PTS payload populated by `parsePtsLocator` (cert-syllabus WP). */
	readonly pts?: ParsedPtsLocator;
	/** AIM payload populated by Phase 7's `parseAimLocator`. */
	readonly aim?: ParsedAimLocator;
	/** AC payload populated by Phase 8's `parseAcLocator`. */
	readonly ac?: ParsedAcLocator;
	/** FAA Orders payload populated by Phase 10's `parseOrdersLocator`. */
	readonly orders?: ParsedOrdersLocator;
	/** NTSB payload populated by Phase 10's `parseNtsbLocator`. */
	readonly ntsb?: ParsedNtsbLocator;
	/** Legal interpretations payload populated by Phase 10's `parseInterpLocator`. */
	readonly interp?: ParsedInterpLocator;
	/** Pilot Operating Handbooks payload populated by Phase 10's `parsePohsLocator`. */
	readonly pohs?: ParsedPohsLocator;
	/** Sectional charts payload populated by Phase 10's `parseSectionalsLocator`. */
	readonly sectionals?: ParsedSectionalsLocator;
	/** Approach plates payload populated by Phase 10's `parsePlatesLocator`. */
	readonly plates?: ParsedPlatesLocator;
	/** Federal statutes payload populated by Phase 10's `parseStatutesLocator`. */
	readonly statutes?: ParsedStatutesLocator;
	/** FAA forms payload populated by Phase 10's `parseFormsLocator`. */
	readonly forms?: ParsedFormsLocator;
	/** Information for Operators payload populated by Phase 10's `parseInfoLocator`. */
	readonly info?: ParsedInfoLocator;
	/** Safety Alerts for Operators payload populated by Phase 10's `parseSafoLocator`. */
	readonly safo?: ParsedSafoLocator;
	/** Type Certificate Data Sheets payload populated by Phase 10's `parseTcdsLocator`. */
	readonly tcds?: ParsedTcdsLocator;
	/** Aviation Safety Reporting System payload populated by Phase 10's `parseAsrsLocator`. */
	readonly asrs?: ParsedAsrsLocator;
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
 * Structured ACS locator surfaced by `parseAcsLocator` in
 * `libs/sources/src/acs/locator.ts`. Source of truth: ADR 019 §1.2 ("ACS")
 * plus the cert-syllabus WP's locked Q7 format.
 *
 * Locator shape (locked 2026-04-27):
 *
 *   <slug>                                                    whole publication
 *   <slug>/area-<NN>                                          area
 *   <slug>/area-<NN>/task-<x>                                 task
 *   <slug>/area-<NN>/task-<x>/elem-<triad><NN>                element
 *
 * `<slug>` collapses cert+category+edition into one publication slug
 * (e.g. `ppl-airplane-6c`, `cfi-airplane-25`). Area + element ordinals are
 * 2-digit zero-padded; task is a single lowercase letter; element prefix
 * is `elem-` (not `element-`) carrying the K/R/S triad letter.
 *
 * The `at=YYYY-MM` pin (parsed by the upstream `parseIdentifier`) is
 * belt-and-suspenders with the slug-encoded edition.
 */
export interface ParsedAcsLocator {
	/** Publication slug -- e.g. `ppl-airplane-6c`, `cfi-airplane-25`. Lowercase kebab-case. */
	readonly slug: string;
	/** Area ordinal as written (2-digit zero-padded, e.g. `'05'`). */
	readonly area?: string;
	/** Task letter, lowercased (e.g. `'a'`). */
	readonly task?: string;
	/** Element triad: `'k'`, `'r'`, or `'s'`. Always present when `elementOrdinal` is set. */
	readonly elementTriad?: 'k' | 'r' | 's';
	/** Element ordinal as written (2-digit zero-padded, e.g. `'01'`). */
	readonly elementOrdinal?: string;
}

/**
 * Structured PTS locator surfaced by `parsePtsLocator` in
 * `libs/sources/src/pts/locator.ts`. Source of truth: cert-syllabus WP's
 * locked Q7 format. PTS is ACS's predecessor; CFII (FAA-S-8081-9E) and a
 * handful of other practical-test standards still publish in this format.
 * PTS does NOT split K/R/S elements -- each task has a flat list of
 * Objectives identified by ordinal alone.
 *
 * Locator shape:
 *
 *   <slug>                                       whole publication
 *   <slug>/area-<NN>                             area of operation
 *   <slug>/area-<NN>/task-<x>                    task
 *   <slug>/area-<NN>/task-<x>/elem-<NN>          objective / element (no triad)
 */
export interface ParsedPtsLocator {
	/** Publication slug -- e.g. `cfii-airplane-9e`. Lowercase kebab-case. */
	readonly slug: string;
	/** Area ordinal as written (2-digit zero-padded, e.g. `'05'`). */
	readonly area?: string;
	/** Task letter, lowercased (e.g. `'a'`). */
	readonly task?: string;
	/** Element ordinal as written (2-digit zero-padded, e.g. `'01'`). No triad. */
	readonly elementOrdinal?: string;
}

/**
 * Structured AIM locator surfaced by `parseAimLocator` in
 * `libs/sources/src/aim/locator.ts`. Source of truth: ADR 019 §1.2 ("AIM")
 * plus the WP at `docs/work-packages/reference-aim-ingestion/`.
 *
 * The AIM is a single continuous publication (no doc slug). Chapter / section /
 * paragraph numbering uses dashes between numerics in the locator path
 * (`aim/5-1-7` -> chapter 5, section 1, paragraph 7). Glossary entries use a
 * `glossary/<slug>` shape; appendices use `appendix-<N>`.
 *
 * Pin format: `?at=YYYY-MM`. AIM publishes change cycles roughly twice a year.
 */
export interface ParsedAimLocator {
	/** Chapter number (e.g. `'5'`). */
	readonly chapter?: string;
	/** Section number (e.g. `'1'`). */
	readonly section?: string;
	/** Paragraph number (e.g. `'7'`). */
	readonly paragraph?: string;
	/** Glossary entry slug (e.g. `'pilot-in-command'`); mutually exclusive with chapter/section/paragraph. */
	readonly glossarySlug?: string;
	/** Appendix number as written (e.g. `'1'`); mutually exclusive with chapter/section/paragraph. */
	readonly appendix?: string;
}

/**
 * Structured Advisory Circular locator surfaced by `parseAcLocator` in
 * `libs/sources/src/ac/locator.ts`. Source of truth: ADR 019 §1.2 ("AC")
 * plus the WP at `docs/work-packages/reference-ac-ingestion/`.
 *
 * Locator shape:
 *
 *   <doc-number>/<revision>                                whole AC at this revision
 *   <doc-number>/<revision>/section-<n>                    section within the revision
 *   <doc-number>/<revision>/change-<n>                     Change <n> issued against revision
 *
 * Doc number is the FAA's catalog number (`61-65`, `91-21.1`, `00-6`); digits,
 * dots, and dashes only. Revision is a lowercase ASCII letter (`j`, `b`, `d`).
 * Per ADR 019 §1.2, an unrevisioned `ac/<doc-number>` is rejected by the
 * validator -- the locator parser enforces this by failing on missing revision.
 *
 * Pin format: `?at=YYYY-MM-DD` -- the publication date of the revision (or the
 * Change-issuance date). A new revision letter is a new doc slug entirely; pin
 * advances forward when a Change is issued against the same revision.
 */
export interface ParsedAcLocator {
	/** AC doc number as written in the locator (e.g. `'61-65'`, `'91-21.1'`). */
	readonly docNumber: string;
	/** Revision letter, lowercased (e.g. `'j'`). */
	readonly revision: string;
	/** Section number as written (e.g. `'3'`); mutually exclusive with `change`. */
	readonly section?: string;
	/** Change number as written (e.g. `'2'`); mutually exclusive with `section`. */
	readonly change?: string;
}

/**
 * Structured FAA Orders locator surfaced by `parseOrdersLocator` in
 * `libs/sources/src/orders/locator.ts`. Source of truth: ADR 019 §1.2
 * ("FAA Orders").
 *
 * Locator shape (Phase 10 first slice):
 *
 *   <authority>/<order-number>                               whole order
 *   <authority>/<order-number>/vol-<N>                       volume
 *   <authority>/<order-number>/vol-<N>/ch-<N>                volume + chapter
 *   <authority>/<order-number>/ch-<N>                        chapter (single-volume orders)
 *   <authority>/<order-number>/par-<N(.N(.N))>               paragraph (TERPS-style hierarchical)
 *
 * Authority is `faa` for now -- ADR 019 anticipates other authorities
 * (`dot`, `tsa`) joining when content demand surfaces. Order number is
 * the FAA's catalog number with optional dotted-suffix revision letter
 * (`2150-3`, `8900-1`, `8260-3C`, `8000-373`).
 *
 * Pin format: `?at=YYYY-MM` or `?at=YYYY` -- the publication or amendment
 * date. Amendments are integral to the order; pin advances when an order's
 * amendment changes meaningful content.
 */
export interface ParsedOrdersLocator {
	/** Issuing authority (currently always `'faa'`). */
	readonly authority: string;
	/** Order number as written (e.g. `'2150-3'`, `'8900-1'`, `'8260-3C'`). */
	readonly orderNumber: string;
	/** Volume number as written (e.g. `'5'`); only set when the locator includes `vol-<N>`. */
	readonly volume?: string;
	/** Chapter number as written (e.g. `'1'`); only set when the locator includes `ch-<N>`. */
	readonly chapter?: string;
	/** Paragraph reference as written (e.g. `'5.2.1'`); only set when the locator includes `par-<...>`. */
	readonly paragraph?: string;
}

/**
 * Structured NTSB report locator surfaced by `parseNtsbLocator` in
 * `libs/sources/src/ntsb/locator.ts`. Source of truth: ADR 019 §1.2
 * ("NTSB reports").
 *
 * Locator shape:
 *
 *   <ntsb-id>                                                whole report (default = final)
 *   <ntsb-id>/<section>                                      named section
 *
 * NTSB ID format: `<region><YY><type><sequence>` -- 3-letter region
 * (e.g. `WPR`, `CEN`, `ANC`, `ERA`), 2-digit year, 2-letter type
 * (`LA`/`FA`/`MA`/`IA`), 3-digit sequence (e.g. `WPR23LA123`,
 * `CEN24FA045`). The ID is the immutable artifact identifier; no `?at=`
 * pin is required because reports are not amended after publication.
 *
 * Section is one of `factual`, `probable-cause`, `recommendations`,
 * `dockets`, `final` (default). Names are kebab-case lowercase.
 */
export interface ParsedNtsbLocator {
	/** NTSB ID as written (preserved case). Validated against the regional+yyyy+type+seq pattern. */
	readonly ntsbId: string;
	/** 3-letter region prefix, uppercased (e.g. `'WPR'`). */
	readonly region: string;
	/** 2-digit year, as written (e.g. `'23'`). */
	readonly year: string;
	/** 2-letter type code, uppercased (`'LA'`/`'FA'`/`'MA'`/`'IA'`). */
	readonly type: string;
	/** 3-digit sequence number, as written (e.g. `'123'`). */
	readonly sequence: string;
	/** Section name (e.g. `'factual'`); omitted means "whole report" (= final). */
	readonly section?: string;
}

/**
 * Structured legal interpretations locator surfaced by `parseInterpLocator`
 * in `libs/sources/src/interp/locator.ts`. Source of truth: ADR 019 §1.2
 * ("Legal interpretations").
 *
 * Locator shape (Phase 10 first slice):
 *
 *   chief-counsel/<author-year>                     e.g. mangiamele-2009, walker-2017
 *   ntsb/<case-name>                                e.g. administrator-v-lobeiko
 *   ntsb/<case-name>?ea=<order-number>              EA-order disambiguation
 *
 * The `?ea=` query param is part of the URL but stripped before the parser
 * sees the locator; callers carrying an EA discriminator should pass it
 * separately via `eaOrder`.
 */
export interface ParsedInterpLocator {
	/** Issuing authority (`'chief-counsel'` or `'ntsb'`). */
	readonly authority: 'chief-counsel' | 'ntsb';
	/** For chief-counsel: author surname (lowercased kebab). For ntsb: case name (kebab). */
	readonly slug: string;
	/** Author surname; only populated for `chief-counsel`. */
	readonly author?: string;
	/** 4-digit issuance year; only populated for `chief-counsel`. */
	readonly year?: string;
	/** EA order number disambiguator (if the caller pre-stripped `?ea=` and re-passed it). */
	readonly eaOrder?: string;
}

/**
 * Structured Pilot Operating Handbook locator surfaced by `parsePohsLocator`
 * in `libs/sources/src/pohs/locator.ts`. Source of truth: ADR 019 §1.2
 * ("POH/AFM").
 *
 * Locator shape (Phase 10 first slice):
 *
 *   <aircraft-slug>                                            whole POH
 *   <aircraft-slug>/<section>                                  section (e.g. section-2)
 *   <aircraft-slug>/<section>/<subsection>                     subsection (e.g. vne)
 *   <aircraft-slug>/emergency/<procedure>                      emergency procedure
 *
 * Aircraft slug is lowercase kebab-case (`c172s`, `pa-28-181`, `sr22`).
 * Section may be `section-<N>` or the literal `emergency`.
 */
export interface ParsedPohsLocator {
	/** Aircraft slug as written (e.g. `'c172s'`, `'pa-28-181'`). */
	readonly aircraftSlug: string;
	/** Section component (e.g. `'section-2'`); the literal `'emergency'` is captured here. */
	readonly section?: string;
	/** Subsection / sub-tag (e.g. `'vne'`); only set when the locator includes a third segment. */
	readonly subsection?: string;
	/** Emergency procedure slug (e.g. `'engine-fire'`); only set when section === `'emergency'`. */
	readonly emergencyProcedure?: string;
}

/**
 * Structured sectional chart locator surfaced by `parseSectionalsLocator` in
 * `libs/sources/src/sectionals/locator.ts`. Source of truth: ADR 019 §1.2
 * ("Sectionals").
 *
 * Locator shape:
 *
 *   <chart-name>                              e.g. denver, los-angeles, seattle
 *
 * Pin format: `?at=YYYY-MM-DD` (NACO 56-day cycle date).
 */
export interface ParsedSectionalsLocator {
	/** Chart name as written (e.g. `'denver'`). Lowercase kebab-case. */
	readonly chartName: string;
}

/**
 * Structured approach-plate locator surfaced by `parsePlatesLocator` in
 * `libs/sources/src/plates/locator.ts`. Source of truth: ADR 019 §1.2
 * ("Plates").
 *
 * Locator shape:
 *
 *   <airport-id>/<procedure-slug>             e.g. KAPA/ils-rwy-35R, KSFO/airport-diagram
 *
 * Airport ID is uppercase 3-4 char ICAO style. Procedure slug is lowercase
 * kebab-case but may include uppercase runway suffixes (e.g. `35R`, `28L`).
 *
 * Pin format: `?at=YYYY-MM-DD` (28-day TPP cycle).
 */
export interface ParsedPlatesLocator {
	/** Airport ID as written (uppercase, e.g. `'KAPA'`). */
	readonly airportId: string;
	/** Procedure slug as written (e.g. `'ils-rwy-35R'`, `'airport-diagram'`). */
	readonly procedureSlug: string;
}

/**
 * Structured federal-statutes locator surfaced by `parseStatutesLocator` in
 * `libs/sources/src/statutes/locator.ts`. Source of truth: ADR 019 §1.2
 * ("Statutes").
 *
 * Locator shape:
 *
 *   <title>/<section>                         e.g. usc-49/40103
 *   <title>/<section>/<subsection>            e.g. usc-49/44102/a
 *
 * Title format: `usc-<title-number>` (e.g. `usc-49`, `usc-14`).
 */
export interface ParsedStatutesLocator {
	/** Title slug as written (e.g. `'usc-49'`). */
	readonly title: string;
	/** Title number extracted from the slug (e.g. `'49'`). */
	readonly titleNumber: string;
	/** Section number as written (e.g. `'40103'`). */
	readonly section: string;
	/** Subsection identifier as written (e.g. `'a'`); only set when present. */
	readonly subsection?: string;
}

/**
 * Structured FAA-forms locator surfaced by `parseFormsLocator` in
 * `libs/sources/src/forms/locator.ts`. Source of truth: ADR 019 §1.2
 * ("Forms").
 *
 * Locator shape:
 *
 *   <form-number>                             e.g. 8710-1, 8500-9
 *
 * Form numbers use the FAA's catalog form (digits + dashes, optional
 * trailing letter). Pin format: `?at=YYYY-MM` for the rev tag.
 */
export interface ParsedFormsLocator {
	/** Form number as written (e.g. `'8710-1'`). */
	readonly formNumber: string;
}

/**
 * Structured Information for Operators locator surfaced by `parseInfoLocator`
 * in `libs/sources/src/info/locator.ts`. Source of truth: ADR 019 §1.2
 * ("InFO").
 *
 * Locator shape:
 *
 *   <info-id>                                 5-digit id (year + sequence), e.g. 21010
 *
 * The first 2 digits are the year (e.g. `21` -> 2021); the last 3 are the
 * sequence within that year.
 */
export interface ParsedInfoLocator {
	/** InFO id as written, 5 digits (e.g. `'21010'`). */
	readonly infoId: string;
	/** 2-digit year prefix (e.g. `'21'`). */
	readonly year: string;
	/** 3-digit within-year sequence (e.g. `'010'`). */
	readonly sequence: string;
}

/**
 * Structured Safety Alerts for Operators locator surfaced by
 * `parseSafoLocator` in `libs/sources/src/safo/locator.ts`. Source of
 * truth: ADR 019 §1.2 ("SAFO").
 *
 * Locator shape:
 *
 *   <safo-id>                                 5-digit id (year + sequence), e.g. 23004
 *
 * Same shape as `info` (year + sequence). Distinct corpus because SAFO is a
 * regulatory category separate from InFO.
 */
export interface ParsedSafoLocator {
	/** SAFO id as written, 5 digits (e.g. `'23004'`). */
	readonly safoId: string;
	/** 2-digit year prefix (e.g. `'23'`). */
	readonly year: string;
	/** 3-digit within-year sequence (e.g. `'004'`). */
	readonly sequence: string;
}

/**
 * Structured Type Certificate Data Sheet locator surfaced by
 * `parseTcdsLocator` in `libs/sources/src/tcds/locator.ts`. Source of
 * truth: ADR 019 §1.2 ("TCDS").
 *
 * Locator shape:
 *
 *   <tcds-number>                             FAA catalog number, e.g. 3a12, a00009ch
 *
 * TCDS numbers are lowercase alphanumeric; FAA's catalog mixes letters
 * and digits in arbitrary order. The locator preserves the exact form.
 */
export interface ParsedTcdsLocator {
	/** TCDS number as written (lowercase, e.g. `'3a12'`, `'a00009ch'`). */
	readonly tcdsNumber: string;
}

/**
 * Structured Aviation Safety Reporting System (ASRS) report locator
 * surfaced by `parseAsrsLocator` in `libs/sources/src/asrs/locator.ts`.
 * Source of truth: ADR 019 §1.2 ("ASRS").
 *
 * Locator shape:
 *
 *   <acn>                                     7-digit ACN, e.g. 1234567
 *
 * The Accession Number (ACN) is NASA's monotonically-increasing report id.
 * ASRS reports are immutable after publication so no `?at=` pin is used.
 */
export interface ParsedAsrsLocator {
	/** ACN as written, 7 digits (e.g. `'1234567'`). */
	readonly acn: string;
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
