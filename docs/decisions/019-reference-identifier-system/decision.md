---
title: Reference Identifier System
status: accepted (v3, with round-3 fixes applied)
date: 2026-04-27
authors: Joshua Ball
related: [018-source-artifact-storage-policy]
revision_history:
  - v1 (decision-v1.md) -- initial draft
  - v2 (decision-v2.md) -- response to round-1 review
  - v3 (this file) -- response to round-2 review and explicit C1-C5 + walk decisions
incorporates_reviews:
  - review-2026-04-27.md (round 1)
  - review-v2-2026-04-27.md (round 2)
---

# Reference Identifier System

This ADR establishes how lessons, work packages, scenario fixtures, and any other authored content in airboss reference source material (regulations, AIM, ACs, Chief Counsel letters, handbooks, POHs, sectionals, NTSB reports, etc.).

See [context.md](context.md) for the conversation that shaped this. See [revisit.md](revisit.md) for items deliberately deferred with concrete triggers.

## Decision

A four-part system:

1. **A canonical identifier scheme** built on a real URI scheme (`airboss-ref:`), per-corpus locator conventions, and mandatory edition pinning.
2. **A registry** that resolves identifiers to titles, source URLs, current text, version metadata. Owned by a new lib `@ab/sources`.
3. **An inline syntax** -- standard Markdown link, identifier as URL, with substitution tokens in link text. Acknowledgments live in lesson frontmatter, not in link attributes.
4. **A five-tier storage model** (source / derivative / indexed / computed / generated) extending ADR 018, with explicit invalidation contracts.

The identifier is the contract. Everything else is implementation behind it.

## 1. Identifier scheme

### 1.1 General form

Identifiers are real URIs with a registered scheme:

```text
airboss-ref:<corpus>/<locator>?at=<edition>
```

Where:

- `airboss-ref:` is the URI scheme. Registered, parseable by every URI library, survives copy-paste through every external system (browser, Slack, RAG, archive tools).
- `<corpus>` is the broad domain (`regs`, `aim`, `ac`, `interp`, `orders`, `handbooks`, `pohs`, `statutes`, `sectionals`, `plates`, `ntsb`, `acs`, `forms`, `tcds`, `asrs`, plus any future corpora).
- `<locator>` is the position within the corpus. **Opaque to the parser**; per-corpus convention defines its shape. Multiple `/`-separated segments allowed.
- `?at=<edition>` is the edition pin. **Mandatory** -- see §1.3. Query-parameter form gives us URL encoding, escape rules, and standard parsers.

The scheme is real. Browsers, IDEs, and other tools can register handlers for `airboss-ref:` to open identifiers in our app or in a designated viewer.

### 1.1.1 URI form constraints

The WHATWG URL parser accepts three syntactic variants for non-special schemes (`airboss-ref:foo`, `airboss-ref:/foo`, `airboss-ref://foo`), each producing a different `pathname`. To prevent silent breakage from editor or browser auto-normalization:

- The **canonical form is path-rootless**: `airboss-ref:regs/cfr-14/91/103?at=2026`. The validator REJECTS path-absolute (`airboss-ref:/regs/...`) and authority-based (`airboss-ref://regs/...`) forms with a specific error message.
- The validator **trims leading and trailing whitespace** on the raw URL string before parsing.
- **Relative URL resolution is not supported.** The renderer treats identifiers as opaque strings except for `parseLocator`; no `new URL(rel, base)` style composition.

### 1.2 Per-corpus rules

Each corpus's WP defines:

- The locator shape it uses
- The slug rules (allowed characters, hyphenation, case)
- The hierarchy (or absence of one)
- The edition convention (slug-encoded, `?at=` pinned, or both)

Examples below are **convention examples**. The parser treats the locator as opaque and dispatches to the per-corpus resolver.

#### Regulations (`regs`)

```text
airboss-ref:regs/cfr-14/91/103?at=2026                  single section
airboss-ref:regs/cfr-14/91/103/b?at=2026                paragraph (b)
airboss-ref:regs/cfr-14/91/103/b/1?at=2026              sub-paragraph
airboss-ref:regs/cfr-14/91/103/b/1/i?at=2026            item
airboss-ref:regs/cfr-14/91/subpart-b?at=2026            whole subpart
airboss-ref:regs/cfr-14/91?at=2026                      whole part
airboss-ref:regs/cfr-49/830/5?at=2026                   NTSB Part 830 section 5
airboss-ref:regs/cfr-49/1552/subpart-a?at=2026          TSA subpart
```

#### Statutes (`statutes`)

```text
airboss-ref:statutes/usc-49/44703?at=2026               49 USC 44703 (BasicMed)
airboss-ref:statutes/usc-49/44703/a?at=2026             paragraph (a)
```

#### AIM (`aim`)

```text
airboss-ref:aim/5-1-7?at=2026-09                        AIM chapter 5, section 1, paragraph 7
airboss-ref:aim/glossary/pilot-in-command?at=2026-09    glossary entry
airboss-ref:aim/appendix-1?at=2026-09                   appendix 1
```

#### Advisory Circulars (`ac`)

```text
airboss-ref:ac/61-65/j                                  AC 61-65 revision J (slug-encoded edition)
airboss-ref:ac/61-65/j/section-3                        section within revision J
airboss-ref:ac/61-65/j/change-2                         Change 2 issued against revision J
```

ACs always have a revision pin. Unrevisioned `airboss-ref:ac/61-65` is rejected by the validator.

#### Interpretations (`interp`)

```text
airboss-ref:interp/chief-counsel/mangiamele-2009                    Chief Counsel letter
airboss-ref:interp/chief-counsel/walker-2017
airboss-ref:interp/ntsb/administrator-v-lobeiko                     NTSB Board order
airboss-ref:interp/ntsb/administrator-v-merrell?ea=5310             with order-number disambiguation
```

Disambiguation is added when two cases share a name. Validator complains only on an actual ambiguous match.

#### FAA Orders (`orders`)

```text
airboss-ref:orders/faa/2150-3?at=2018-04                FAA Order 2150.3
airboss-ref:orders/faa/8900-1/vol-5/ch-1?at=2026        Order 8900.1, Volume 5, Chapter 1
airboss-ref:orders/faa/8000-373?at=2018                 Order 8000.373
```

#### Handbooks (`handbooks`)

```text
airboss-ref:handbooks/phak/8083-25C/12/3                PHAK 8083-25C, chapter 12, section 3
airboss-ref:handbooks/phak/8083-25C/12/3/para-2         paragraph 2 within that section
airboss-ref:handbooks/phak/8083-25C/fig-12-7            figure
airboss-ref:handbooks/phak/8083-25C/tbl-12-3            table
airboss-ref:handbooks/afh/8083-3C/5/intro               AFH 8083-3C, chapter 5, intro
```

Edition is part of the doc slug (uppercase revision letter, matching FAA convention). 8083-25D is a new doc slug entirely.

#### POHs (`pohs`)

```text
airboss-ref:pohs/c172s/section-2/vne                    Cessna 172S POH section 2 (limitations), Vne
airboss-ref:pohs/pa-28-181/emergency/engine-fire        PA-28-181 emergency procedures, engine fire
```

Model code is the doc slug. Marketing names ("Skyhawk", "Archer III") live in the registry's `alternative_names` field.

#### NTSB reports (`ntsb`)

```text
airboss-ref:ntsb/WPR23LA123                             NTSB ID
airboss-ref:ntsb/WPR23LA123/factual                     factual report section
airboss-ref:ntsb/WPR23LA123/probable-cause              probable cause statement
```

NTSB reports do NOT fit dotted-hierarchy. Locator is the NTSB ID; sub-locators identify report sections.

#### Sectionals and approach plates (`sectionals`, `plates`)

```text
airboss-ref:sectionals/denver?at=2026-09-15             chart name + cycle date
airboss-ref:plates/KAPA/ils-rwy-35R?at=2026-09-15       airport + procedure + cycle date
```

28-day or 56-day cycles; pin is mandatory because charts change continuously.

#### ACS / PTS (`acs`)

```text
airboss-ref:acs/cfi-asel/faa-s-acs-25/area-i/task-a               Area of Operation, Task
airboss-ref:acs/cfi-asel/faa-s-acs-25/area-i/task-a/element-1     specific element
```

ACS uses slug-encoded edition (the publication ID, e.g. `faa-s-acs-25`). No `?at=` needed; the slug pins.

#### FAA forms (`forms`), InFOs (`info`), SAFOs (`safo`), TCDS (`tcds`), ASRS (`asrs`)

Each gets its own corpus and resolver. Per-corpus rules defined when the corpus is added.

### 1.3 Edition pinning

**Mandatory.** Every identifier is pinned. There are two forms:

- **Slug-encoded edition.** The edition is part of the locator path (`8083-25C`, `61-65/j`, `faa-s-acs-25`). No `?at=` suffix needed; the slug satisfies the pinning rule.
- **`?at=<edition>` query parameter.** Used when the corpus has continuous editions (CFR, AIM, FAA Orders) without per-publication slugs.

Pin formats:

- `?at=2026` -- year (CFR annual cycle)
- `?at=2026-09` -- year-month (AIM publication cycle)
- `?at=2026-09-15` -- date (sectionals/plates cycle dates)

#### Auto-stamp

Authors may write unpinned identifiers (`airboss-ref:regs/cfr-14/91/103`). The validator's `--fix` mode auto-stamps the current `accepted` edition during local development:

```bash
bun run check --fix
```

Behaviors:

- **`bun run check` (no flag) is read-only.** ERRORS on any unpinned identifier; never writes.
- **`bun run check --fix` writes** to lesson files. Stamps `?at=<edition>` onto unpinned identifiers, choosing the most recent `accepted` edition for the corpus.
- **CI runs `bun run check` only** (no `--fix`). CI never writes to author files.
- **Authors run `--fix` before committing.** PRs land with all references pinned.

Failure modes:

| Case | Behavior |
| --- | --- |
| Author writes unpinned, runs `--fix` against current registry | Stamps current `accepted` edition. Author sees the stamp in `git diff`. |
| Author copy-pastes a stale pin from another lesson | Validator emits WARNING when any pin is older than current `accepted` by more than 1 edition. |
| Stale registry (`pending` for current edition, `accepted` only for previous) | `--fix` stamps the most-recent `accepted` edition. PR review catches the lag if relevant. |
| Mid-PR registry change (new edition lands while PR is in review) | `--fix` is opt-in; only re-stamps when author runs it. PR diff stays stable until author chooses. |
| Multi-machine workflow | `--fix` is opt-in per machine. Branch tip is the source of truth; merge resolves divergences. |
| Author wants explicit unpinned (rare) | Use `airboss-ref:regs/cfr-14/91/103?at=unpinned`. Validator emits WARNING (not ERROR). For lessons that genuinely speak about a regulation abstractly. |

#### Resolution rules

- Identifier resolves against the pinned edition.
- If pinned edition exists in the registry as `accepted` (or `superseded` with successor): success.
- If pinned edition is `pending`, `draft`, or `retired`: ERROR (cannot publish).
- If pinned edition doesn't exist (typo, future date): ERROR.
- If pinned edition is older than current `accepted` by > 1 edition: WARNING (staleness signal).

### 1.4 Multi-reference

There is **no in-URL multi-reference syntax**. Each identifier is a single link. The renderer detects adjacent identifiers from the same corpus and same pin and emits a normalized list ("§91.167-91.171") at render time.

Authors write:

```markdown
The IFR fuel and alternate trio at [§91.167](airboss-ref:regs/cfr-14/91/167?at=2026), [§91.169](airboss-ref:regs/cfr-14/91/169?at=2026), and [§91.171](airboss-ref:regs/cfr-14/91/171?at=2026).
```

Renderer outputs:

```html
The IFR fuel and alternate trio at <a>§91.167-91.171</a>.
```

For lesson-level groupings ("the IFR fuel + alternate trio"), the grouping is in link text using `@list`:

```markdown
[The IFR fuel and alternate trio @list](airboss-ref:regs/cfr-14/91/167?at=2026)
```

The renderer collects adjacent identifiers and substitutes the grouped list. A single-reference `@list` produces the canonical_short of that one entry (a list of one).

### 1.5 Validation rules

Build-time validation is tiered.

Rules are evaluated **in order**; the validator emits exactly one error per identifier (the first matching rule).

| # | Rule | Severity |
| --- | --- | --- |
| 0 | Identifier uses `unknown` magic prefix (e.g. `airboss-ref:unknown/<descriptive-string>`) | ERROR with message: "Transitional reference; cannot publish. Replace with a real identifier or wait for ingestion of the relevant corpus." |
| 1 | Identifier must parse (URL form is path-rootless per §1.1.1, corpus is enumerated in §1.2 — `unknown` is excluded from this check, handled by row 0 — and locator is syntactically valid for that corpus's resolver) | ERROR |
| 2 | Identifier resolves to an `accepted` or `superseded` registry entry | ERROR |
| 3 | Pinned edition exists in registry | ERROR |
| 4 | Identifier resolves to `pending`, `draft`, or `retired` | ERROR (message distinguishes the state: "entry is pending review", "entry is in draft", "entry is retired") |
| 5 | Identifier uses `?at=unpinned` | WARNING |
| 6 | Pinned edition is older than current `accepted` by > 1 edition | WARNING |
| 7 | Link text is empty (after stripping Markdown markup) | ERROR |
| 8 | Bare identifier in prose (not in link) | NOTICE |
| 9 | Lazy link text (just the section number echoed back, no token) | NOTICE |
| 10 | Renumbering alias within section, content unchanged | (silent auto-resolve) |
| 11 | Renumbering alias, content changed | WARNING |
| 12 | Cross-section move (a `cross-section` `AliasEntry`) | ERROR. The resolver does NOT walk past a `cross-section` alias; chain resolution stops at the first cross-section hop. Author must manually re-pin to the new identifier. See §6.1. |
| 13 | Reference to superseded entry without `acknowledgments` entry | WARNING |
| 14 | Reason slug in acknowledgments exceeds 48 characters | NOTICE |

Severity tiers:

| Tier | Effect | Surfaced in |
| --- | --- | --- |
| ERROR | Blocks `bun run check`; blocks merge | CLI, CI, IDE |
| WARNING | Visible in CI; doesn't block | CLI, CI, IDE |
| NOTICE | IDE language server only | IDE |

`bun run check` exits non-zero on any ERROR. CI optionally has a no-warnings-on-main gate as a separate enforcement.

#### 1.5.1 Edge cases

These cover the corner cases that would otherwise be ambiguous:

- **Future-pin (pinning to an edition that doesn't yet exist).** ERROR per row 3. There is no `?at=future` machinery. Authors who want to write ahead of an upcoming publication either pin to the most recent existing edition (and re-pin once the new edition lands via the diff job) or use the `unknown:` escape hatch to mark the reference as transitional.
- **Reserved sections.** A `[Reserved]` registry entry has `canonical_title: "[Reserved]"` and resolves normally. `@cite` substitutes "§91.149 [Reserved]" (canonical_short + literal title). `@text` substitutes "[Reserved]". A pin to a year when the section was reserved resolves to the Reserved entry; a pin to a later year when the section was re-occupied resolves to whatever the new content is. Authorial intent is disambiguated by the pin choice.
- **Newly-created sections (section appears for the first time in this edition; no prior amendment history).** `last_amended_date` is initialized to the section's first-appearance publication date; never null. Per §2.1.
- **Redacted sections (e.g. some NTSB report contents).** `@text` substitutes the literal `[redacted]` and emits NOTICE in the build log. Authors can use `@cite` instead (which doesn't depend on full text).
- **CI re-running on a stale PR branch (PR opened in 2026, sits unreviewed, CI re-runs in 2027 after main has advanced).** `bun run check` runs without `--fix` and emits WARNING for any pin > 1 edition stale; doesn't block; PR can still merge. Author re-runs `--fix` locally to advance pins; otherwise the diff job catches it next cycle.

### 1.6 The publish gate

**"Publish" means merge to main.** No separate "publish gate" tooling.

The validator's ERROR-tier rules ARE the publish gate:

- Unresolvable identifier: ERROR -> CI fails -> PR cannot merge -> not published.
- `unknown:` references: ERROR -> CI fails -> not published.
- Unpinned references (no `?at=` and no slug-encoded edition): ERROR -> CI fails -> not published.

Authors run `bun run check --fix` locally to auto-stamp pins, then commit. CI catches anything missed.

"Publish" in this ADR means "merge to main." Pre-merge previews, feature-flagged content, and deploy environments (dev/staging/prod) are downstream consumers of merged content; each may have its own additional gates (preview rendering may show `[unresolved]` badges; feature flags may gate visibility), but none is a separate validation gate for this ADR's purposes.

### 1.7 The `unknown:` escape hatch (transitional only)

During phases between ADR approval and full corpus ingestion, authors who must reference something not yet in the registry write:

```text
airboss-ref:unknown/<descriptive-string>
```

The validator emits ERROR. The lesson cannot merge.

`unknown:` is a **magic prefix** recognized by the validator, NOT a corpus with a `CorpusResolver`. It exists to document intent during transitions; it never publishes.

When a corpus is added and ingested, lessons referencing `unknown:` placeholders are mechanically replaced via the migration tool (Phase 9 of §8).

Escape hatch usage is itself a signal -- it surfaces in a "deferred references" report so we can prioritize ingestion of the most-referenced corpora first.

## 2. Registry

The registry is owned by a new lib `@ab/sources`. Three concerns:

1. **Static identity** (TypeScript constants) -- canonical names, hierarchy via slug, supersession relationships, alternative names.
2. **Per-corpus resolver functions** -- each corpus registers a resolver; the resolver knows where its content lives.
3. **Query API** -- find entries, walk hierarchy, get current edition, filter by attributes, batch resolve.

The registry is a sibling lib of `@ab/constants`, not part of it. `@ab/constants` is for *project-wide constants* (routes, ports, enum values); `@ab/sources` is a domain-specific lib with its own internals (typed registry + runtime resolvers + query API). Project-wide CLAUDE.md rules about constants don't bind here; this is a domain lib.

### 2.1 Static identity

```typescript
interface SourceEntry {
	id: SourceId;                          // 'airboss-ref:regs/cfr-14/91/103'
	corpus: string;                        // 'regs'
	canonical_short: string;               // '§91.103'
	canonical_formal: string;              // '14 CFR § 91.103'
	canonical_title: string;               // 'Preflight action'
	last_amended_date: Date;               // most recent amendment of THIS section
	alternative_names?: string[];          // ['Skyhawk'] for c172s; ['BasicMed'] for cfr-14/68
	supersedes?: SourceId;                 // pointer to what this superseded (single)
	superseded_by?: SourceId;              // pointer to successor (single; chain via traversal)
	lifecycle: SourceLifecycle;            // see §2.4
}

type SourceLifecycle = 'draft' | 'pending' | 'accepted' | 'retired' | 'superseded';
```

Removed from v2: `parent` (compute from id), `editions: Edition[]` (move to indexed tier), `current_edition` (compute), `derivative_path` and `indexed_table` (per-corpus resolver function), `last_verified` (no audit trail at this layer).

Renamed from v2: `aliases?: string[]` → `alternative_names?: string[]` (to disambiguate from `Edition.aliases` which is for renumbering).

Moved from v2: `last_amended_date` is per-section (on `SourceEntry`), not per-edition.

`corpus` is a string, not a closed enum. New corpus = new resolver registration; no constants change.

### 2.2 Per-corpus resolver

Each corpus registers a resolver function:

```typescript
interface CorpusResolver {
	corpus: string;
	parseLocator(locator: string): ParsedLocator | ParseError;
	formatCitation(entry: SourceEntry, style: 'short' | 'formal' | 'title'): string;
	getCurrentEdition(): EditionId;
	getEditions(id: SourceId): Promise<Edition[]>;
	getLiveUrl(id: SourceId, edition: EditionId): string | null;
	getDerivativeContent(id: SourceId, edition: EditionId): string | null;
	getIndexedContent(id: SourceId, edition: EditionId): Promise<IndexedContent | null>;
}
```

Adding a new corpus = adding a new resolver. The static registry is corpus-agnostic.

### 2.3 Query API

```typescript
// Static queries
resolveIdentifier(id: SourceId): SourceEntry | null;
hasEntry(id: SourceId): boolean;
getChildren(id: SourceId): SourceEntry[];                  // computed via slug prefix
walkSupersessionChain(id: SourceId): SourceEntry[];
isSupersessionChainBroken(id: SourceId): boolean;

// Cross-corpus queries
findEntriesByCanonicalShort(short: string): SourceEntry[];
findLessonsCitingEntry(id: SourceId): LessonId[];          // direct references only
findLessonsTransitivelyCitingEntry(id: SourceId): LessonId[];  // walks lesson-to-lesson refs
findLessonsCitingMultiple(ids: SourceId[]): LessonId[];

// Edition queries
getCurrentEdition(corpus: string): EditionId;
getEditions(id: SourceId): Promise<Edition[]>;
isPinStale(id: SourceId, pin: EditionId): Promise<boolean>;
```

### 2.4 Lifecycle state machine

```text
draft → pending → accepted → retired
                       ↓
                  superseded
```

| State | Meaning | Validator behavior |
| --- | --- | --- |
| `draft` | Corpus WP author writing entries before bulk-load. Not visible to validator. | N/A |
| `pending` | Ingestion-loaded, awaiting engineer review. | ERROR on resolution |
| `accepted` | Engineer-reviewed, valid. | OK on resolution |
| `retired` | Was correct, no longer current (e.g. sunset clause with no successor). | ERROR on resolution (lessons must `acknowledge` or update) |
| `superseded` | Replaced by another entry (`superseded_by` populated). | WARNING on resolution unless lesson acknowledges |

Transition rules:

- `draft → pending`: automated bulk-load.
- `pending → accepted`: requires designated reviewer approval (currently the project owner; future delegation requires a separate ADR).
- `accepted → retired`: rare; manual mark with reason recorded in commit message.
- `accepted → superseded`: via supersession relationship (creating a new entry with `supersedes` pointing back) or manual mark.
- `pending → accepted`: can be **un-promoted** (pending again or retired) if engineer review later finds a problem. The de-promote path produces a WARNING for any lesson that auto-stamped to that edition; author re-runs `--fix`.

There is no `wrong` state. Mistakes are corrected via: add corrected entry to `pending`, promote, mark wrong entry as `retired` with `superseded_by` pointing to the corrected one.

**Atomic batch promotion.** Entries are promoted in batches or not at all. Half-promoted batches are forbidden. The reviewer signs off on the full batch.

A **batch** is the unit produced by one ingestion-pipeline run (e.g., one CFR Part, one AC Change document, one AIM section, one NTSB report set). Batches are recorded in a registry-internal table `promotion_batches` with `reviewer_id`, `promotion_date`, `scope` (the list of `SourceId`s in the batch), and the run's input source. A batch does not span multiple corpora. A batch may be a single entry (used for corrections).

**Recovery from a wrong promotion.** A single entry in a batch can transition to `retired` (or back to `pending`) independently; the rest of the batch stays `accepted`. The de-promote produces a WARNING for any lesson that auto-stamped to the affected edition; author re-runs `--fix`. The original `promotion_batches` record is preserved for audit; a new record marks the de-promotion event.

### 2.5 Render-time loading strategy

The renderer does NOT do per-identifier DB queries. Batch resolution is exposed by `@ab/sources/render` and consumed by every render surface:

```typescript
// @ab/sources/render
export function extractIdentifiers(body: string): SourceId[];
export function batchResolve(ids: SourceId[]): Promise<ResolvedIdentifierMap>;
export function substituteTokens(body: string, resolved: ResolvedIdentifierMap, mode: RenderMode): string;
```

Render surfaces:

| Surface | Loading pattern |
| --- | --- |
| Lesson page (SvelteKit SSR + hydration) | Server load function calls `extractIdentifiers` + `batchResolve`; passes `data` to component; component substitutes |
| RAG citation snippet builder | Same, called from RAG indexer |
| Share-card preview generator (1200x630 image) | Same, called from image builder |
| RSS feed | Same, called from feed generator |
| CLI PDF export | Same, called from CLI tool |
| CLI bibliography export | Same, called from CLI tool |
| Search-result snippet | Same, called from search service |

All TypeScript surfaces consume the same `@ab/sources/render` API. No per-surface batch-resolve reimplementation.

For **non-TypeScript consumers** (e.g. Python RAG pipelines, Lambda image builders without Postgres connections, offline CLI tools), `@ab/sources` produces a **JSON snapshot** of the static + indexed tier at deploy time. The snapshot is a hash-map lookup, no async, no Postgres connection required. Snapshot generation is its own implementation concern; the contract is "everything `batchResolve` could return is in the snapshot." This split lets us serve any runtime profile.

### 2.6 Registry population

In order:

1. **Bulk ingestion** is the primary mechanism. WPs ship per corpus; ingestion populates the registry from authoritative sources.
2. **Engineering hand-authoring** for irregular corpora that don't have a clean ingestion target (Chief Counsel letters, NTSB Board orders) -- batch-authored when the corpus is introduced.
3. **`unknown:` escape hatch** for transitional gaps -- never the normal flow.

Lessons should not be authored for a corpus until that corpus's bulk ingestion has landed and its registry entries are `accepted`.

### 2.7 Registry availability and consistency

| Concern | Resolution |
| --- | --- |
| Registry unavailable at render time | Static parts (`SourceEntry`) are constants in TypeScript, loaded at build. Dynamic parts (indexed content, current text) are fetched at render time per §2.5. If indexed tier is down, renderer falls back to live URL display. |
| Registry diverges between dev/prod | Static registry is identical across deployments (in code). Indexed tier varies; the renderer surfaces an ENV-tagged build identifier so dev/prod divergence is debuggable. |
| Registry queried by external tools | `@ab/sources` exports the query API as a public lib; external scripts import it directly. No HTTP API in v3 scope. |
| Registry deletion safety | `accepted` entries are not deletable. They transition to `retired` with explicit reason. Lessons referencing retired entries get WARNING. |
| Registry diverges between branches | Static registry is a TypeScript module; PR diff shows registry changes. PR review catches divergence before merge. |

## 3. Inline syntax

Standard Markdown link:

```markdown
[<link text>](<identifier>)
```

Link text is required and validated. URL is the identifier. The renderer rewrites identifier-shaped URLs to the appropriate destination at render time.

### 3.1 Substitution tokens

Tokens in link text are substituted from the registry at render time. The token set is **open** (`@ab/sources/tokens.ts` registers them); new tokens are added via that module without ADR amendment.

Initial vocabulary:

| Token | Substitutes with | Example |
| --- | --- | --- |
| `@short` | `canonical_short` field | `§91.103` |
| `@formal` | `canonical_formal` field | `14 CFR § 91.103` |
| `@title` | `canonical_title` field | `Preflight action` |
| `@cite` | `canonical_short` + space + `canonical_title` | `§91.103 Preflight action` |
| `@list` | normalized list (when adjacent identifiers same corpus + pin); single ref produces list-of-one | `§91.103, §91.104, §91.106, §91.107` |
| `@as-of` | the pin, as a literal | `2026` (just the value; author writes "as of @as-of") |
| `@text` | inline current text of the section | (full quoted text -- short refs only; long refs use `@quote`) |
| `@quote` | block-quoted full text with citation footer | (full text + citation) |
| `@last-amended` | date this section was last amended (per-section, from `SourceEntry.last_amended_date`) | `2024-09-15` |
| `@deeplink` | the resolver service URL only, for "see also" formatting | (URL) |
| `@chapter` / `@subpart` / `@part` | containing-element titles, for breadcrumb rendering | `Subpart B - Flight Rules` |

Render-mode behavior:

| Render mode | Behavior |
| --- | --- |
| Web (HTML, default) | Tokens substitute; identifier becomes hyperlink |
| Print export (PDF) | Tokens substitute; identifier becomes inline text + footnote with resolver service URL |
| Audio TTS | Tokens substitute; identifier omitted from spoken output. Author's choice of token determines length: `@cite` is read fully; `@text`/`@quote` reads the regulation aloud (intentional -- if you wanted shorter, use `@cite`). |
| Screen reader | Same as web; aria-label set from `@cite` |
| Plain-text export | Tokens substitute; **resolver service URL** appended as `(<URL>)` after substituted text |
| RSS / email digest | Same as web; URLs are absolute |
| Share-card preview (1200x630) | Tokens substitute to abbreviated form; truncate at 80 chars; identifier omitted |
| RAG citation footnote | `@formal` (or `@cite` if length permits) plus resolver service URL; identifier preserved as machine-readable hint |
| Slack / iMessage unfurl | Title from `@cite`; description from lesson title |
| Transclusion (lesson included in another lesson) | Tokens substitute against the **included lesson's pins** (mandatory pinning means each ref carries its edition; transclusion preserves) |
| Tooltip / hover preview | Author's chosen token rendered; truncate at 200 chars (does not override author choice) |

### 3.2 Authoring posture

| Pattern | Severity | Notes |
| --- | --- | --- |
| `[<text>](airboss-ref:.../...?at=2026)` | OK | Standard form |
| `[<text>](airboss-ref:.../...)` (no pin, slug doesn't encode) | ERROR | Author must run `--fix` or add pin |
| `[](airboss-ref:.../...?at=2026)` empty link text | ERROR | |
| `airboss-ref:.../...` bare in prose | NOTICE | IDE-only; encourages link wrapping |
| `[91.103](airboss-ref:.../91/103?at=2026)` lazy text | NOTICE | Encourages `@short` or `@cite` |
| `[@cite](airboss-ref:.../91/103?at=2026)` | OK | Recommended default |
| `[*emphasized text*](airboss-ref:...)` | OK | Markdown emphasis allowed; "empty" check is on stripped text |

### 3.3 Bibliography is derived

Lessons do NOT carry a frontmatter `references` list. The parser walks the body, extracts every identifier-shaped URL, and builds the bibliography. This avoids drift between body and frontmatter.

The parser walks Markdown AND embedded HTML AND included Svelte component imports of `@ab/sources` constants. A lesson's full reference graph includes:

- All `airboss-ref:` URLs in lesson Markdown (including inside `<details>`/HTML embeds)
- All identifier constants imported by Svelte components rendered as part of the lesson
- All identifier constants imported by scenario fixtures bound to the lesson

### 3.4 Lesson frontmatter

Frontmatter contains lesson identity and acknowledgments. Removed from v2: `last_verified`, `verification_due`, `references_pinned_to`.

```yaml
---
title: <lesson title>
week: <N>
section_order: "NN"
historical_lens: false                 # optional; default false; true means whole lesson is historical context
acknowledgments:                       # optional; per-link acks
  - id: mangiamele-cost-sharing        # optional; matches Markdown reference label in body
    target: airboss-ref:interp/chief-counsel/mangiamele-2009
    superseder: airboss-ref:interp/chief-counsel/smith-2027
    reason: original-intact
    historical: false
    note: "Smith narrows but does not overturn the cost-sharing analysis cited here."
  - id: mangiamele-compensation        # different label, same target, different reason
    target: airboss-ref:interp/chief-counsel/mangiamele-2009
    superseder: airboss-ref:interp/chief-counsel/smith-2027
    reason: scope-narrowed
    historical: false
    note: "Smith narrows the broader compensation discussion specifically."
---
```

In the lesson body, authors use **Markdown reference-style links** to bind specific references to specific acks:

```markdown
The [Mangiamele letter (2009)][mangiamele-cost-sharing] established the limit
on cost-sharing under §61.113.

Later, the [Mangiamele letter][mangiamele-compensation] also addresses
[...different facet...].

[mangiamele-cost-sharing]: airboss-ref:interp/chief-counsel/mangiamele-2009
[mangiamele-compensation]: airboss-ref:interp/chief-counsel/mangiamele-2009
```

The bracket label after the link text (`[mangiamele-cost-sharing]`) matches the `id` field in the frontmatter ack. Each reference can carry its own ack reason. Inline links (without a reference label) bind to acks by `target` only, which is fine when there's exactly one ack for that target.

#### Acknowledgments rules

- `id` is the Markdown reference label used in the lesson body. Optional; if absent, acks bind by `target` only. Required when a single lesson has multiple acks for the same `target`.
- `target` must be an identifier the lesson body actually references; validator emits WARNING on orphan acknowledgments (and the orphan can be promoted to ERROR via a CI gate after a 30-day grace period -- the cost of an over-flag here is tiny).
- `superseder` must point to the current end of the supersession chain from `target`. If the chain advances (a new supersession occurs), the validator emits WARNING and the author re-validates the ack.
- `reason` is a slug: `[a-z0-9-]`, max 64 chars, recommended 16-32. Validator NOTICE if > 48.
- `historical: true` flags the reference as deliberately historical -- the renderer adds a "(historical reference)" annotation. Validator does not surface staleness warnings for historical refs.
- `note` is free-form prose for context, displayed in the rendered output (location per render mode in §3.1: tooltip in web, footnote in print, omitted in TTS share-card preview, inline in plain-text export).

#### `historical_lens: true`

Lesson-level shortcut for "the whole lesson is historical context" -- every reference in the body is treated as `+historical` without per-link annotation. The bibliography surfaces this in the rendered output ("This lesson is a historical-context reference; not a current-state claim"). If a lesson has both `historical_lens: true` AND a per-target `acknowledgments` entry for a specific reference, **the per-target ack overrides** for that specific reference (use case: "this whole lesson is historical EXCEPT for the Walker reference, which is still applicable").

## 4. Five-tier storage model

ADR 018 has three tiers (source / derivative / generated). This ADR introduces two more:

| Tier | What it is | Where | Owner | Invalidation trigger |
| --- | --- | --- | --- | --- |
| **Source** | Original artifact published by an outside authority | `$AIRBOSS_HANDBOOK_CACHE/` outside repo | External | Outside our control |
| **Derivative** | Pipeline-extracted markdown, figures, tables, manifest | In repo, committed | Corpus pipeline | Source change |
| **Indexed** | Structured DB rows mirroring derivatives | Postgres | Corpus pipeline | Derivative change OR ingestion schema migration |
| **Computed** | Embeddings, full-text indexes, knowledge graph edges, cross-corpus joins | Postgres (different tables) | Platform | Per-artifact dependency contract (see §4.1) |
| **Generated** | User-state computations (mastery scores, leaderboards, recommendations) | Postgres (different tables) | Platform | Continuously, from user interaction |

ADR 018 / [STORAGE.md](../../platform/STORAGE.md) updated to reflect.

### 4.1 Computed-tier dependency contracts

Each computed-tier artifact declares its dependencies:

```typescript
interface ComputedArtifact {
	id: string;
	depends_on: {
		corpora?: string[];      // ['regs', 'aim']
		lessons?: LessonId[];    // specific lessons
		user_session?: boolean;  // true if per-session
		schema_version: string;  // algorithm/schema bump invalidates
	};
}
```

When any dependency invalidates, the artifact is marked stale and rebuilt on next access (or on schedule, depending on the artifact).

Examples:

- **Lesson-to-source edges:** `depends_on: { corpora: ['regs'], lessons: [<all>] }`. Invalidate when either changes.
- **Per-session caches:** `depends_on: { user_session: true, ... }`. Live in computed tier; invalidate per session.
- **Cross-corpus joins:** `depends_on: { corpora: [<list>] }`. Multi-source invalidation falls out of the dependency array.

## 5. Versioning workflow

```text
Year N:
  1. Edition 2026 of CFR (or AIM, AC, etc.) published.
  2. Ingestion pipeline runs. Creates registry entries in `pending` with normalized text (whitespace stripped, line endings LF, Unicode NFC).
  3. Designated reviewer reviews `pending` batches; promotes to `accepted`.
  4. Lessons authored cite identifiers; validator auto-stamps via `--fix` to current `accepted` edition.

Year N+1:
  5. Edition 2027 published.
  6. Ingestion runs; registry now has 2026 and 2027 editions per section.
  7. Diff job runs across the registry:
     - For each section that has 2026 entry and 2027 entry: hash-compare on normalized text.
     - Hash equal -> auto-advance lesson pins from `?at=2026` to `?at=2027` (rewrite lesson body, commit on a branch for review).
     - Hash differs -> emit "needs human review" report. The lesson stays at `?at=2026`.
  8. Author walks the report. For each flagged reference:
     - Read the diff between 2026 and 2027 text.
     - If lesson's claim still holds, advance pin to `?at=2027` (and optionally add a `acknowledgments` entry per §3.4).
     - If lesson's claim no longer holds, edit the lesson.

Year N+2:
  9. Repeat.
```

The system mechanically handles "no change" propagation. Humans only see actual changes. No date fields in lesson frontmatter -- pins and acks do the work.

The "list of references that need human review" is a first-class output -- a query against the registry + lesson index.

## 6. Aliases, supersession, acknowledgment

Three distinct concepts:

### 6.1 Aliases (within an edition transition)

When an edition introduces a renumbering, the new edition's registry entry carries an alias map:

```typescript
interface Edition {
	id: EditionId;
	published_date: Date;
	source_url: string;
	aliases?: AliasEntry[];
}

interface AliasEntry {
	from: SourceId;                  // 'airboss-ref:regs/cfr-14/91/103/b/2'
	to: SourceId | SourceId[];       // single (silent, content-change, cross-section) or multiple (one-to-many split)
	kind: 'silent' | 'content-change' | 'cross-section' | 'split' | 'merge';
}
```

Behaviors per kind:

- **`silent`**: pure renumbering, content unchanged. Validator auto-resolves; no signal.
- **`content-change`**: paragraph moved AND text changed. Validator WARNING.
- **`cross-section`**: rule moved between sections. Validator ERROR. The resolver **does NOT walk past** a `cross-section` alias; chain resolution stops at the first cross-section hop. Author must manually re-pin to the new identifier. (This is the load-bearing rule that makes §1.5 row 12 and the chain-traversal rule below consistent.)
- **`split`**: one paragraph becomes multiple (e.g. `(b)(2) → (b)(2)(i) and (b)(2)(ii)`). `to` is an array. Author chooses which target their lesson now points at.
- **`merge`**: multiple paragraphs become one. Multiple `from` entries map to the same `to`. Lessons referencing any `from` resolve to the merged target; renderer dedupes if the lesson has multiple references to the merged target.

Aliases chain. Resolver walks from the lesson's pinned edition forward, applying aliases in order, **until it hits a `cross-section` alias** -- at which point it stops with ERROR (per §1.5 row 12). Chain depth is otherwise unbounded; lessons N years old still resolve via traversal as long as no cross-section move occurred. Gaps (an edition was skipped during ingestion) are an ERROR -- the chain must be unbroken. Ingestion itself detects gaps and reports them at ingestion time, before any lesson references can fail.

### 6.2 Supersession (across distinct entries)

Some references go away entirely and are replaced. Modeled via `supersedes` and `superseded_by` pointers on `SourceEntry`. Single-link; chains via traversal.

Cross-corpus supersession is supported (e.g. a regulation reorganized into a new corpus). The pointer crosses corpus boundaries. When the renderer walks a chain that crosses corpora, it displays the original reference's `canonical_short` with an annotation indicating cross-corpus supersession ("(via §[some-tsa-section] in `regs:tsa-49`)"); the successor's per-corpus resolver provides the citation format for the annotation.

`walkSupersessionChain(id)` returns the full chain from the named entry forward.

### 6.3 Acknowledgment of supersession

When an entry is superseded, lessons referencing the old entry get a WARNING from the validator. The author resolves in three ways:

**A) Update the reference** to the superseding entry. Default; lesson's claim no longer applies to the old entry alone.

**B) Acknowledge and retain** via lesson frontmatter `acknowledgments` (see §3.4). The lesson keeps the original reference; warning suppressed; renderer adds an "(acknowledged supersession)" annotation.

**C) Mark as historical** via `acknowledgments` entry with `historical: true` (or lesson-level `historical_lens: true`). The renderer adds a "(historical reference)" annotation.

#### Cascade behavior

When a `+ack` references a superseder that is itself later superseded:

- Validator walks the supersession chain from the named superseder forward.
- If the chain has a current entry, the renderer adds a "(via [chain])" annotation; the ack remains valid.
- If the chain is broken (superseder retired with no successor), validator WARNING; author re-validates the ack.

## 7. Cross-references between corpora

Lessons cite multiple corpora. The lesson body weaves them in prose. The registry's reverse index (§2.3) supports queries like "lessons citing both X and Y."

For lesson-level groupings, the grouping lives in link prose -- one link per identifier, the renderer adjacency-merges. The registry stays per-section; no composite identifier type.

**Cross-reference staleness across editions** is NOT modeled in v3. Per-identifier staleness is caught by the diff job (§5). When a referenced regulation changes, the lesson is flagged for review; the author's review is the catcher of cross-reference issues in the lesson's claim. See [revisit.md](revisit.md) for the trigger to add explicit cross-reference tracking.

## 8. Implementation phases

Bulk ingestion lands before the renderer. Lesson authoring resumes against a populated registry.

| Phase | Work package | Deliverable | Prereq |
| --- | --- | --- | --- |
| 0 | This ADR | Decision document | -- |
| 1 | reference-identifier-scheme-validator | Markdown parser; validator runs at `bun run check` time. Produces ERROR/WARNING/NOTICE per §1.5. Falls back to per-corpus URL formula for `unknown:` references. | ADR approved |
| 2 | reference-source-registry-core | `@ab/sources` lib: schema, types, query API, resolver registration. Empty registry. | Phase 1 |
| 3 | reference-cfr-ingestion-bulk | Full eCFR ingestion (Title 14, 49 CFR 830, 49 CFR 1552). Populates registry to `pending`; reviewer promotes to `accepted`. | Phase 2 |
| 4 | reference-renderer-runtime | Renderer in `apps/study/` resolves identifiers at render time, performs token substitution, applies render-mode rules. `@ab/sources/render` exposed for all surfaces. | Phases 1-3 |
| 5 | reference-versioning-tooling | Annual diff job, hash-compare, lesson rewrite generator. | Phases 1-3 |
| 6 | reference-handbook-ingestion | PHAK + AFH ingestion (per ADR 018 cache pattern). | Phase 2 |
| 7 | reference-aim-ingestion | AIM ingestion. | Phase 2 |
| 8 | reference-ac-ingestion | AC catalog ingestion (full text where licensing permits). | Phase 2 |
| 9 | reference-lesson-migration | One-pass migration of pre-ADR-019 lessons to identifier syntax (see §9). | Phases 1-4 |
| 10 | reference-irregular-corpora | NTSB reports, Chief Counsel letters, FAA Orders, sectionals, plates, ACS, etc. -- per-corpus WPs as needed. | Phase 2 |

CFR ingestion (Phase 3) before renderer (Phase 4) so the validator's resolution check is meaningful when authoring resumes. Lessons authored in Phase 3 (post-CFR-ingestion, pre-renderer) display via per-corpus URL formula fallback (live eCFR URL); the renderer is enhancement, not foundation.

## 9. Phase 9 -- Lesson migration spec

Pre-ADR-019 lessons (Week 1 + 2 capstones) reference regulations in three forms:

```markdown
[§91.103](https://www.ecfr.gov/...)        Existing eCFR URL
**§91.103**                                 Bold prose, no link
91.103                                      Bare prose
```

Migration is per-lesson, interactive (not fully mechanical):

| Form | Migration rule |
| --- | --- |
| Existing eCFR URL | Parse URL, extract section, generate identifier. Pin to the **year of the lesson's last meaningful edit** (read from `git log`). Surface as a WARNING during migration; author reviews each batch. |
| Bold prose without URL | Treated as bare prose -- interactive review. |
| Bare prose | Migration tool presents candidate matches; author confirms each. Some occurrences are intentional ("the §91.103 family of rules"); migration tool offers "leave as prose" option. |

Edition pinning: each migrated reference pins to the year the lesson was last meaningfully edited. The git log is the audit trail. After migration, references are pinned; they participate in the annual rollover diff job from the next cycle onward.

The migration tool itself is a Phase 9 WP deliverable; this ADR specifies the rules.

## 10. Resolved deferrals

| Topic | Resolution |
| --- | --- |
| Internationalization (ICAO, EASA, translations) | DEFERRED with trigger: when first non-English / non-FAA corpus is ingested (see [revisit.md](revisit.md)). |
| Audio transcript spoken-form citations | DEFERRED with trigger: when `apps/audio/` ships its first surface that consumes content from the registry (see [revisit.md](revisit.md)). |
| Pub/sub regulation-diff alerts | DEFERRED with trigger: when learner notifications surface ships in `apps/study/` (see [revisit.md](revisit.md)). |
| Cross-reference staleness modeling | DEFERRED with trigger: when third lesson is flagged for cross-reference issues during annual rollover (see [revisit.md](revisit.md)). |
| Hangar UI for non-engineer-edited registry entries | DEFERRED with trigger: when `apps/hangar/` ships content authoring (see [revisit.md](revisit.md)). |
| Academic citation formatters | DROPPED. No concrete trigger. If a real need arises, the need itself becomes the trigger; we don't pre-author a deferral. |
| Resolver service infrastructure (`refs.airboss.dev`) | DROPPED from v3 scope. External-viewer fallback is the per-corpus live URL (eCFR for regs, faa.gov for AIM/ACs). Resolver service can be added later as enhancement; not load-bearing. |
| `@unspecified` pin form | DROPPED. Mandatory pinning is the discipline; "deliberately ambiguous" cases use `+historical` ack on a representative pin instead. |

## 11. Acceptance criteria

Before this ADR moves to `accepted`:

- [ ] §1 covers each corpus listed in §1.2 with at least one example identifier per corpus.
- [ ] §1.5 lists every validation case with a tier assignment (ERROR / WARNING / NOTICE).
- [ ] §2.3 specifies the `@ab/sources` query API as a named list of TypeScript function signatures.
- [ ] §2.4 specifies the lifecycle state machine with all 5 states (`draft`, `pending`, `accepted`, `retired`, `superseded`) and transition rules.
- [ ] §3.1 lists every render mode in the table; no row says "TBD".
- [ ] §4 has exactly 5 tier rows.
- [ ] STORAGE.md updated to match §4.
- [ ] §5 (versioning workflow) does not reference `last_verified`, `verification_due`, `references_pinned_to`.
- [ ] §6 specifies behavior for: silent alias, content-change alias, cross-section alias, split alias, merge alias, supersession with ack, supersession marked historical, cascade resolution.
- [ ] §8 lists CFR ingestion (phase 3) before renderer (phase 4).
- [ ] §10 has zero rows with weaker triggers than "when X ships" or "when Y is requested" or "DROPPED".
- [ ] [revisit.md](revisit.md) exists and lists every deferred item with a concrete trigger and a path to action.
- [ ] No occurrence of `TBD`, `???`, `tbd` in this document.

## 12. Worked example -- happy path

```markdown
---
title: Preflight Action
week: 4
section_order: "05"
acknowledgments:
  - target: airboss-ref:interp/chief-counsel/walker-2017
    superseder: airboss-ref:interp/chief-counsel/smith-2030
    reason: original-intact
    note: "Smith narrows but does not overturn the active-investigation standard cited here."
---

# Preflight Action

Per [@cite](airboss-ref:regs/cfr-14/91/103?at=2026), the PIC must become familiar
with all available information before any flight.

The phrase "all available information" is interpreted by the
[Walker letter (2017)](airboss-ref:interp/chief-counsel/walker-2017)
to require active investigation, not passive review.

The pre-flight briefing recommended in [@cite](airboss-ref:ac/91-92/a)
gives one acceptable means of compliance.
```

End-to-end:

1. **Author writes** the body above.
2. **`bun run check`** parses; finds three identifiers; validates pins; validates acknowledgments target a real reference; validates supersession chain. Auto-stamps any unpinned identifier (none in this example).
3. **CI passes** (no ERROR-tier issues; the Walker reference has a valid ack so its supersession warning is suppressed).
4. **Render time on `/lessons/.../preflight-action`:** server load batch-resolves the three identifiers via `@ab/sources/render`. Component substitutes `@cite` tokens. Renders to HTML.
5. **Rendered HTML:**
   - "Per **§91.103 Preflight action**, the PIC..."
   - "...the **Walker letter (2017)** (acknowledged 2030 supersession; original-intact) to require..."
   - "...recommended in **AC 91-92A**..."
6. **Print export** uses the same data, with footnote URLs for each link.
7. **TTS** speaks "section ninety-one one-oh-three Preflight action" without speaking the identifier.
8. **2030 annual rollover** advances `?at=2026` to `?at=2030` if the section text hash is unchanged; flags for review if changed.

## 13. Worked example -- failure modes

A failure tour:

**Lesson with stale pin + ack against superseded letter + rendered to PDF + pulled into a quiz card.**

```markdown
---
title: Cost-Sharing Limits
acknowledgments:
  - target: airboss-ref:interp/chief-counsel/mangiamele-2009
    superseder: airboss-ref:interp/chief-counsel/smith-2027
    reason: original-intact
    note: "Smith narrows scope but the cost-sharing analysis cited here is intact."
---

Per [@cite](airboss-ref:regs/cfr-14/61/113?at=2024), pilots may share costs with passengers under the common-purpose test established in the [Mangiamele letter (2009)](airboss-ref:interp/chief-counsel/mangiamele-2009).
```

What happens:

1. The 2024 pin is stale (current is 2026, > 1 edition gap). Validator emits WARNING.
2. The Mangiamele letter is superseded by Smith-2027, which is itself superseded by Jones-2030. Validator walks the chain; the lesson's ack points at Smith-2027, not Jones-2030. Validator emits WARNING ("ack chain advanced; please re-validate").
3. Author runs `bun run check --fix`. Pin advances 2024→2026 (CFR text unchanged, hash equal). Ack chain warning persists; author opens Jones-2030, decides Mangiamele is still intact relative to it, updates `superseder: airboss-ref:interp/chief-counsel/jones-2030`.
4. Lesson rendered to PDF. Identifiers resolve via `@ab/sources/render`. Footnotes include resolver service URLs. Pin metadata baked in via `renderer_version` frontmatter (added at snapshot time).
5. Quiz card pulls the same lesson. Tokens substitute against the lesson's pins, not the quiz's host context (transclusion preserves pins).

## 14. What changed from v2

The v2 → v3 change is comprehensive enough that a per-row table would mislead. v3 supersedes v2 as a complete rewrite. Key load-bearing changes:

- Identifier scheme uses real URI scheme `airboss-ref:` (was `corpus:locator` shape that collided with URI parsers)
- Pinning is mandatory at all times; auto-stamp via opt-in `--fix` flag (was conditionally optional)
- Multi-reference syntax removed entirely (was `..` and `!` URL microsyntax)
- Acknowledgments live in lesson frontmatter (were in Markdown link `title` attribute)
- Phase ordering: CFR ingestion before renderer (was renderer before ingestion)
- Five-tier storage with explicit per-artifact dependency contracts (was four tiers with implicit invalidation)
- Lifecycle state machine with 5 states (was 2 states)
- "Publish gate" is the validator itself, no separate tooling (was unspecified separate gate)
- `unknown:` is a magic prefix, not a corpus (was conflated)
- Resolver service infrastructure dropped from scope (was assumed but unbuilt)
- `last_verified`, `verification_due`, `references_pinned_to` lesson frontmatter fields all dropped (were present, no value)
- `parent`, `editions`, `current_edition`, `derivative_path`, `indexed_table`, registry `last_verified` all dropped from `SourceEntry` (computed or moved)
- Per-section `last_amended_date` (was per-edition)
- `SourceEntry.aliases` renamed to `alternative_names` (was naming-collision with `Edition.aliases`)
- Token vocabulary expanded to 12; declared as open set with extension procedure
- Render-mode behavior specified for 11 modes (was specified for one)
- Acceptance criteria are machine-checkable (was checkbox theater)

See [decision-v1.md](decision-v1.md), [decision-v2.md](decision-v2.md), [review-2026-04-27.md](review-2026-04-27.md), [review-v2-2026-04-27.md](review-v2-2026-04-27.md) for the full revision history.
