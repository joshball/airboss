---
title: Reference Identifier System
status: draft (v2)
date: 2026-04-27
authors: Joshua Ball
related: [018-source-artifact-storage-policy]
supersedes_within_branch: decision-v1.md
incorporates_review: review-2026-04-27.md
---

# Reference Identifier System

This ADR establishes how lessons, work packages, and any other authored content in airboss reference source material (regulations, AIM, ACs, Chief Counsel letters, handbooks, POHs, sectionals, NTSB reports, etc.).

See [context.md](context.md) for the conversation that shaped this. See [decision-v1.md](decision-v1.md) for the first draft and [review-2026-04-27.md](review-2026-04-27.md) for the critique that produced this revision. See [§13 What changed from v1](#13-what-changed-from-v1) for the per-section delta.

## Decision

A four-part system:

1. **A canonical identifier scheme** -- per-corpus convention, not a universal grammar
2. **A registry** that resolves identifiers to titles, source URLs, current text, version metadata
3. **An inline syntax** -- standard Markdown link, identifier as URL, with substitution tokens in link text
4. **A five-tier storage model** (source / derivative / indexed / computed / generated) extending ADR 018

The identifier is the contract. Everything else is implementation behind it.

## 1. Identifier scheme

### 1.1 General form

```text
<corpus>:<locator>[@<edition>]
```

Where:

- `corpus` is the broad domain (`regs`, `aim`, `ac`, `interp`, `orders`, `handbooks`, `pohs`, `statutes`, `sectionals`, `ntsb`, `acs`, `forms`, `tcds`, `asrs`, future)
- `locator` is the position; **opaque to the parser**, defined per-corpus by the WP that adds the corpus
- `edition` (optional in source; **always present after validation** -- see §1.3) pins to a specific version

The separator between `corpus` and `locator` is **a colon**. (Change from v1, which used a dot. Colon makes the boundary unambiguous and allows locators to contain dots without parser confusion.)

The dotted form is the *recommended convention* for hierarchical locators (regs, AIM, handbooks). It is not required. Per-corpus rules govern locator shape.

### 1.2 Per-corpus rules

Each corpus's WP defines:

- The locator shape it uses
- The slug rules (allowed characters, hyphenation, case)
- The hierarchy (or absence of one)
- The edition convention (slug-encoded, `@`-pinned, or both)

Examples below are **convention examples**, not parser rules. The parser treats the locator as opaque and dispatches to the per-corpus resolver.

#### Regulations (`regs`)

```text
regs:cfr-14.91.103                 single section
regs:cfr-14.91.103.b               paragraph (b)
regs:cfr-14.91.103.b.1             sub-paragraph (b)(1)
regs:cfr-14.91.103.b.1.i           item (b)(1)(i)
regs:cfr-14.91.subpart-b           a whole subpart
regs:cfr-49.830.5                  NTSB Part 830, section 5 (49 CFR, not 14)
regs:cfr-49.1552.subpart-a         TSA subpart
```

#### Statutes (`statutes`)

```text
statutes:usc-49.44703              49 USC 44703 (BasicMed authority)
statutes:usc-49.44703.a            paragraph (a)
```

#### AIM (`aim`)

```text
aim:5-1-7                          chapter 5, section 1, paragraph 7
aim:glossary.pilot-in-command      glossary entry
aim:appendix-1                     appendix 1
```

#### Advisory Circulars (`ac`)

```text
ac:61-65.j                         AC 61-65 revision J
ac:61-65.j.section-3               section within revision J
ac:61-65.j.change-2                Change 2 issued against revision J
```

Note: ACs *always* have a revision pin. Unrevisioned `ac:61-65` is rejected by the validator (revisions are how ACs version; an unrevisioned reference is ambiguous).

#### Interpretations (`interp`)

```text
interp:chief-counsel.mangiamele-2009          letter, dated by year
interp:chief-counsel.walker-2017
interp:ntsb.administrator-v-lobeiko           NTSB Board order by case
interp:ntsb.administrator-v-merrell.ea-5310   with order number for disambiguation
```

Disambiguation suffix is added when two cases share a name (rare). The author chooses to add it; validator only complains if there's an ambiguous match.

#### FAA Orders (`orders`)

```text
orders:faa.2150.3                  FAA Order 2150.3 (whole)
orders:faa.8900.1.vol-5.ch-1       Volume 5, Chapter 1
orders:faa.8000.373                Compliance philosophy
```

#### Handbooks (`handbooks`)

```text
handbooks:phak.8083-25C.12.3            PHAK 8083-25C, chapter 12, section 3
handbooks:phak.8083-25C.12.3.para-2     paragraph 2 within that section
handbooks:phak.8083-25C.fig-12-7        figure
handbooks:phak.8083-25C.tbl-12-3        table
handbooks:afh.8083-3C.5.intro           AFH 8083-3C, chapter 5, intro
```

Edition is part of the doc slug (using FAA's uppercase revision letter, matching FAA convention). When 8083-25D ships, it's a new doc slug.

#### POHs (`pohs`)

```text
pohs:c172s.section-2.vne                Cessna 172S, POH section 2 (limitations), Vne
pohs:pa-28-181.emergency.engine-fire    Piper PA-28-181, emergency procedures, engine fire
```

Model code (`c172s`, `pa-28-181`) is the doc slug. Marketing names (Skyhawk, Archer III) live in the registry's `aliases` field, not in the identifier.

#### NTSB reports (`ntsb`)

```text
ntsb:WPR23LA123                     event-keyed identifier (region + year + class + sequence)
ntsb:WPR23LA123.factual             factual report
ntsb:WPR23LA123.probable-cause      probable cause statement
```

NTSB reports do NOT fit the dotted-hierarchy convention. The locator is the NTSB ID; sub-locators identify report sections. The corpus's resolver knows how to format and where to find content.

#### Sectionals and approach plates (`sectionals`, `plates`)

```text
sectionals:denver@2026-09-15            chart name + edition cycle date
plates:KAPA.ils-rwy-35R@2026-09-15      airport + procedure + cycle date
```

Editions are 28-day or 56-day cycles; `@` pin is mandatory because charts change continuously.

#### ACS / PTS (`acs`)

```text
acs:cfi-asel.area-i.task-a              Area of Operation I, Task A in CFI ASEL ACS
acs:cfi-asel.area-i.task-a.element-1    specific element
```

ACS structure: Area of Operation -> Task -> Element.

#### FAA forms (`forms`), InFOs / SAFOs (`info`, `safo`), TCDS (`tcds`)

Each gets its own corpus with its own resolver. WP-per-corpus pattern. None are reasoned about in this ADR; their per-corpus rules are defined when the corpus is added.

#### Future / unknown (`unknown`)

```text
unknown:<author-string>
```

Reserved corpus prefix for the gap before bulk ingestion. Authors who *must* reference something not yet in the registry can write `unknown:<descriptive-string>` and the validator emits a WARNING. These are tracked, surfaced in CI, and must be replaced before publish. See §1.5.1.

### 1.3 Edition pinning

**Mandatory pinning.** Every identifier is pinned. Authors may write unpinned (`regs:cfr-14.91.103`); the validator auto-stamps `@<current>` on first save and rewrites the body. After validation, every identifier in the body is pinned. The author sees the auto-stamp in the PR diff and can override.

The lesson-level `references_pinned_to` shortcut is REMOVED. (Was in v1; created drift risk between body pins and frontmatter.)

**Pin format depends on corpus convention:**

- `@2026` -- year
- `@2027-04` -- year-month
- `@2026-09-15` -- date (sectionals/plates use exact cycle date)
- Slug-encoded editions are *also* pins (e.g. `phak.8083-25C` is implicitly pinned)

**Resolution rules:**

- Identifier resolves against the pinned edition.
- If pinned edition exists in the registry: success.
- If pinned edition doesn't exist (typo, future date): validator ERROR.
- If pinned edition is older than current: success, no warning during normal validation; the **versioning diff job** (§5) is the mechanism for surfacing staleness, not the validator.

### 1.4 Multi-reference

Multi-reference syntax is REMOVED from the URL portion. (Was `..` and `!` in v1; broke Markdown.) Authors write multiple separate links:

```markdown
The IFR fuel and alternate trio at [§91.167](regs:cfr-14.91.167@2026), [§91.169](regs:cfr-14.91.169@2026), and [§91.171](regs:cfr-14.91.171@2026).
```

The renderer detects adjacent identifiers from the same corpus, same pin, and emits a normalized list ("§91.167-91.171"):

```html
The IFR fuel and alternate trio at <a>§91.167-91.171</a>.
```

For lesson-level groupings ("the IFR fuel + alternate trio"), the grouping is in the link text:

```markdown
[The IFR fuel and alternate trio @list](regs:cfr-14.91.167@2026)
```

`@list` plus the per-link metadata is enough; the renderer constructs the prose grouping at render time.

### 1.5 Validation rules

Build-time validation is tiered. See §1.5.1.

Rules (ordered roughly by severity):

| Rule | Severity | Notes |
| --- | --- | --- |
| Identifier must parse (corpus exists, syntax valid for corpus) | ERROR | Blocks merge |
| Identifier resolves (registry has accepted entry) | ERROR | Blocks merge; `unknown:` is the only exception (see §1.5.1) |
| Pinned edition exists in registry | ERROR | Blocks merge |
| Identifier is `unknown:<string>` | WARNING | Surfaces in CI; cannot publish |
| Link text is empty (`[](regs:cfr-14.91.103@2026)`) | ERROR | Blocks merge |
| Bare identifier in prose (not in link) | NOTICE | IDE-level; doesn't affect CI |
| Pinned edition is older than current | (no signal here -- see §5 diff job) | Different mechanism |
| Lazy link text (just the section number echoed back, no @-token, no canonical short) | NOTICE | IDE-level; encourages `@cite` or `@short` |
| Ingestion-introduced renumbering: paragraph alias within section, content unchanged | (silent auto-resolve) | Not surfaced |
| Ingestion-introduced renumbering: paragraph alias, content changed | WARNING | Surfaces; author must re-verify |
| Ingestion-introduced renumbering: cross-section move | ERROR (auto-resolve refused) | Author must manually re-pin |
| Identifier references a superseded entry without acknowledgment | WARNING | See §6 supersession handling |

#### 1.5.1 Severity tiers

| Tier | Effect | Where surfaced |
| --- | --- | --- |
| ERROR | Blocks `bun run check` (and PR merge by CI gate) | CLI, CI, IDE |
| WARNING | Visible in CI logs; doesn't block; aggregates in a per-PR report | CLI, CI, IDE |
| NOTICE | IDE-only; not in CI | IDE language server only |

`bun run check` exits non-zero on ERROR, zero on WARNING. CI optionally has a "no warnings on main" gate that is independent of the validator.

### 1.6 The `unknown:` escape hatch

Per the bulk-ingestion-before-authoring decision (§8): the registry should be populated for every corpus before lessons reference it. But during *transitional* states -- a new corpus's ingestion is still being authored, a one-off reference points at something the registry doesn't yet know -- authors can write `unknown:<descriptive-string>`.

Properties:

- `unknown:` identifiers parse and resolve through the renderer (display the descriptive string + a "[unresolved]" badge).
- They emit a WARNING from the validator.
- They cannot be published. CI gates published lessons against any `unknown:` references.
- They surface in a "needs registry entry" report so they can be cleaned up systematically.

This replaces the v1 "lesson-driven discovery" mechanism (which incorrectly framed hand-population as a normal workflow). `unknown:` is explicitly the unhappy path.

## 2. Registry

The registry is owned by a new lib `@ab/sources`. Three concerns:

1. **Static identity** (TypeScript constants) -- canonical names, hierarchy via slug, supersedes/superseded_by relationships
2. **Per-corpus resolver functions** -- each corpus registers a resolver; the resolver knows where content for that corpus lives
3. **Query API** -- find entries, walk hierarchy, get current edition, filter by attributes, batch resolve

### 2.1 Static identity

```typescript
interface SourceEntry {
	id: SourceId;                          // 'regs:cfr-14.91.103'
	corpus: string;                        // 'regs' (string, not closed enum -- see below)
	canonical_short: string;               // '§91.103'
	canonical_formal: string;              // '14 CFR § 91.103'
	canonical_title: string;               // 'Preflight action'
	aliases?: string[];                    // ['Skyhawk' for c172s]
	supersedes?: SourceId;                 // pointer to a superseded entry
	superseded_by?: SourceId;              // pointer to the successor (single; chain via traversal)
	lifecycle: 'pending' | 'accepted';     // see §2.4
}
```

Removed from v1: `parent` (computed from id), `editions: Edition[]` (moved to indexed tier), `current_edition` (computed), `derivative_path` and `indexed_table` (resolver function), `last_verified` (no audit trail at this layer).

`corpus` is a string, not a closed TypeScript enum. New corpus = new module that registers; no constants change required.

### 2.2 Per-corpus resolver

Each corpus registers a resolver function:

```typescript
interface CorpusResolver {
	corpus: string;
	parseLocator(locator: string): ParsedLocator | ParseError;
	formatCitation(entry: SourceEntry, style: 'short' | 'formal' | 'title'): string;
	getCurrentEdition(): EditionId;
	getEditions(id: SourceId): Edition[];     // queries indexed tier
	getLiveUrl(id: SourceId, edition: EditionId): string | null;
	getDerivativeContent(id: SourceId, edition: EditionId): string | null;
	getIndexedContent(id: SourceId, edition: EditionId): Promise<IndexedContent | null>;
}
```

Adding a new corpus = adding a new resolver. The static registry is corpus-agnostic; resolvers carry the per-corpus knowledge.

### 2.3 Query API

```typescript
// Static queries
resolveIdentifier(id: SourceId): SourceEntry | null;
hasEntry(id: SourceId): boolean;
getChildren(id: SourceId): SourceEntry[];     // computed via slug prefix
walkSupersessionChain(id: SourceId): SourceEntry[];

// Cross-corpus queries
findEntriesByCanonicalShort(short: string): SourceEntry[];
findEntriesCitingFromLessons(id: SourceId): LessonId[];   // reverse index
findLessonsCitingMultiple(ids: SourceId[]): LessonId[];   // S2 fix from review

// Edition queries (delegate to per-corpus resolver, queries indexed tier)
getCurrentEdition(corpus: string): EditionId;
getEditions(id: SourceId): Promise<Edition[]>;
isPinStale(id: SourceId, pin: EditionId): Promise<boolean>;
```

### 2.4 Registry entry lifecycle

Ingestion writes entries in `pending` lifecycle. An engineer reviews each per-corpus batch and promotes to `accepted`. Only `accepted` entries pass the validator's resolution check. (Same pattern as work-package `review_status`.)

This catches ingestion bugs (wrong slug, encoding errors) before they propagate into lesson references.

### 2.5 Render-time loading strategy

The renderer does NOT do per-identifier DB queries. The lesson-page's server load function:

1. Parses the lesson body once
2. Collects all unique identifiers
3. Batch-resolves: one query for static metadata, one query for indexed content (current text + citation metadata)
4. Passes the resolved set as `data` to the lesson component

Component then performs token substitution and link generation in pure rendering -- no async work per identifier.

### 2.6 Registry population

In order:

1. **Bulk ingestion** is the primary mechanism. WPs ship per corpus; ingestion populates the registry from authoritative source.
2. **Engineering hand-authoring** for irregular corpora that don't have a clean ingestion target (Chief Counsel letters, NTSB Board orders) -- batch-authored when the corpus is introduced.
3. **`unknown:` escape hatch** for transitional gaps -- never the normal flow.

Lessons should not be authored for a corpus until that corpus's bulk ingestion has landed and its registry entries are `accepted`.

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
| `@list` | normalized list (when adjacent identifiers same corpus + pin) | `§91.103, §91.104, §91.106, §91.107` |
| `@as-of` | the pin, as a literal | `2026` (just the value; author writes "as of @as-of" inline) |
| `@text` | inline current text of the section (short refs only; long refs render as block) | (full quoted text) |
| `@quote` | block-quoted full text with citation footer | (full text + citation) |
| `@last-amended` | date the referenced section was last amended | `2024-09-15` |
| `@deeplink` | the URL only, for "see also" formatting | (URL) |
| `@chapter` / `@subpart` / `@part` | containing-element titles, for breadcrumb rendering | `Subpart B - Flight Rules` |

Render-mode behavior (per S8 of the review):

| Render mode | Behavior |
| --- | --- |
| Web (HTML, default) | Tokens substitute; identifier becomes hyperlink |
| Print export (PDF) | Tokens substitute; identifier becomes inline text + footnote with URL |
| Audio TTS | Tokens substitute; identifier is omitted from spoken output (the *substituted text* is what's spoken) |
| Screen reader | Same as web; aria-label set from `@cite` |
| Plain-text export | Tokens substitute; identifier appended as `(<URL>)` after substituted text |
| RSS / email digest | Same as web; URLs are absolute |
| Share-card preview (1200x630) | Tokens substitute to abbreviated form; truncate at 80 chars; identifier omitted |
| RAG citation footnote | `@formal` (or `@cite` if length permits) plus URL; identifier preserved as machine-readable hint |
| Slack / iMessage unfurl | Title from `@cite`; description from lesson title |
| Transclusion (lesson included in another lesson) | Tokens substitute at host-render time, against the host's registry context |
| Tooltip / hover preview | `@cite`; truncate at 200 chars |

### 3.2 Authoring posture

| Pattern | Severity | Notes |
| --- | --- | --- |
| `[<text>](identifier@pin)` | OK | Standard form |
| `[<text>](identifier)` (no pin) | OK after auto-stamp | Validator stamps current pin |
| `[](identifier)` empty link text | ERROR | Per §1.5 |
| `identifier` bare in prose | NOTICE | IDE-only; encourages link wrapping |
| `[91.103](regs:cfr-14.91.103@2026)` lazy text | NOTICE | Encourages `@short` or `@cite` |
| `[@cite](identifier@pin)` | OK | Recommended default for canonical citations |

The `@` symbol is overloaded by position: in link text it's a substitution token; in URL it's an edition pin. The validator distinguishes by which side of the parentheses.

### 3.3 Bibliography is derived

Lessons do NOT carry a frontmatter `references` list. The parser walks the body, extracts every identifier-shaped URL, and builds the bibliography. This avoids drift between body and frontmatter.

Frontmatter contains only lesson identity:

```yaml
---
title: <lesson title>
week: <N>
section_order: "NN"
---
```

`last_verified`, `verification_due`, `references_pinned_to` are all REMOVED. (Were in v1; provided no value the registry doesn't already.)

The verification machinery is the diff job (§5), not date fields.

## 4. Five-tier storage model (extending ADR 018)

ADR 018 has three tiers. The reviewer correctly observed (C4) that "indexed" + "generated" was conflating two different lifecycles. This ADR splits them into five:

| Tier | What it is | Where | Owner | Invalidation trigger |
| --- | --- | --- | --- | --- |
| **Source** | Original artifact published by an outside authority | `$AIRBOSS_HANDBOOK_CACHE/` outside repo | External | Outside our control |
| **Derivative** | Pipeline-extracted markdown, figures, tables, manifest | In repo, committed | Corpus pipeline | Source change |
| **Indexed** | Structured DB rows mirroring derivatives | Postgres | Corpus pipeline | Derivative change OR ingestion schema migration |
| **Computed** | Embeddings, full-text indexes, knowledge graph edges, cross-corpus joins | Postgres (different tables) | Platform | Indexed change OR algorithm/schema migration; rebuilt on schedule |
| **Generated** | User-state computations (mastery scores, leaderboards, recommendations) | Postgres (different tables) | Platform | Continuously, from user interaction |

ADR 018 / [STORAGE.md](../../platform/STORAGE.md) updated to reflect.

## 5. Versioning workflow

```text
Year N:
  1. Edition 2026 of CFR (or AIM, or AC, or whatever) published.
  2. Ingestion pipeline runs; creates registry editions for 2026.
  3. Lessons authored cite identifiers; validator auto-stamps @2026 if unpinned.

Year N+1:
  4. Edition 2027 published.
  5. Ingestion runs; registry now has 2026 and 2027 editions per section.
  6. Diff job runs across the registry:
     - For each section that has 2026 entry and 2027 entry: hash-compare.
     - Hash equal -> auto-advance lesson pins from @2026 to @2027 (rewrite lesson body, commit on a branch for review).
     - Hash differs -> emit "needs human review" report. The lesson stays at @2026.
  7. Author walks the report. For each flagged reference:
     - Read the diff between 2026 and 2027 text.
     - If lesson's claim still holds, advance pin to @2027 (and optionally add a supersession-acknowledgment, see §6).
     - If lesson's claim no longer holds, edit the lesson.

Year N+2:
  8. Repeat.
```

The system mechanically handles "no change" propagation. Humans only see actual changes. Date fields in lesson frontmatter are not part of this workflow -- pins do the work.

The "list of references that need human review" is a first-class platform output -- a query against the registry + lesson index.

## 6. Aliases, supersession, and acknowledgment

Three distinct concepts:

### 6.1 Aliases (within an edition transition)

When an edition introduces a renumbering (FAA renumbers a paragraph), the new edition's registry entry carries an alias map:

```typescript
interface Edition {
	id: EditionId;
	published_date: Date;
	last_amended_date: Date;        // non-null; defaults to published_date
	source_url: string;
	aliases?: AliasEntry[];
}

interface AliasEntry {
	from: string;                    // '91.103.b.2'
	to: string;                      // '91.103.c.2'
	kind: 'silent' | 'content-change' | 'cross-section';
}
```

Per §1.5.1:

- `silent` -- pure renumbering, content unchanged. Validator auto-resolves; no signal.
- `content-change` -- paragraph moved AND text changed. Validator emits WARNING.
- `cross-section` -- rule moved between sections. Validator emits ERROR; auto-resolve refused.

Aliases chain. Resolver walks from the lesson's pinned edition forward, applying aliases in order. Chain depth is unbounded; lessons N years old still resolve via traversal. Gaps (an edition was skipped during ingestion) are an ERROR -- the chain must be unbroken.

### 6.2 Supersession (across distinct entries)

Some references go away entirely and are replaced. A Chief Counsel letter is superseded by a later letter. An AC revision is replaced by the next revision. An NTSB recommendation is closed.

Modeled via `supersedes` and `superseded_by` pointers on the SourceEntry. Single-link; chains via traversal.

### 6.3 Supersession acknowledgment

When an entry is superseded, lessons referencing the old entry get a WARNING from the validator. The author can resolve in three ways:

**A) Update the reference** to the superseding entry. Default; what the author does when the supersession invalidates the lesson's claim.

**B) Acknowledge and retain.** The author has read the superseding entry and decided the lesson's specific use of the original is still valid. Inline syntax:

```markdown
The [Mangiamele letter (2009)](interp:chief-counsel.mangiamele-2009 "+ack:smith-2027:original-intact")
established the common-purpose limit on §61.113 cost-sharing.
```

The link title (HTML `title` attribute slot) carries the acknowledgment as a structured string `+ack:<superseding-id-shortform>:<reason-slug>`. The validator parses it. With a valid acknowledgment, the supersession warning is suppressed for this lesson; the renderer shows a small "(acknowledged 2027 supersession)" annotation in the rendered output.

The acknowledgment carries:

- The superseding entry it acknowledges (so a *future* supersession of the superseder re-triggers warnings)
- A reason slug (free-form short string for human readability)
- Optionally a date (else inferred from git blame)

**C) Mark as historical.** The author specifically wants to cite the original *as historical context* and is not making a current claim:

```markdown
At the time, the [Mangiamele letter (2009)](interp:chief-counsel.mangiamele-2009 "+historical")
required ...
```

Validator suppresses the warning unconditionally; renderer adds a "(historical reference)" annotation.

The link `title` attribute is a small but real syntax extension of standard Markdown. It survives all renderers (it's standard Markdown); only ours interprets the `+ack:` / `+historical` prefixes specifically.

## 7. Cross-references between corpora

Lessons cite multiple corpora. The lesson body weaves them in prose. The registry's reverse index (§2.3) supports queries like "lessons citing both X and Y."

For lesson-level groupings ("the IFR fuel + alternate trio") the grouping lives in the link prose -- one link per identifier, the renderer adjacency-merges the displayed citation. The registry stays per-section; no composite identifier type.

## 8. Implementation phases

Bulk ingestion comes first. Lesson authoring resumes against a populated registry.

| Phase | Work package | Deliverable | Prereq |
| --- | --- | --- | --- |
| 0 | This ADR | Decision document | -- |
| 1 | reference-identifier-scheme-validator | Markdown parser; validator runs at `bun run check` time. Produces ERROR/WARNING/NOTICE per §1.5.1. Falls back to per-corpus URL formula for `unknown:` references. | ADR approved |
| 2 | reference-source-registry-core | `@ab/sources` lib: schema, types, query API, resolver-registration mechanism. Empty registry. | Phase 1 |
| 3 | reference-renderer-runtime | Renderer in `apps/study/` resolves identifiers at render time, performs token substitution, applies render-mode rules. | Phases 1-2 |
| 4 | reference-cfr-ingestion-bulk | Full eCFR ingestion (Title 14, 49 CFR 830, 49 CFR 1552). Populates registry to `pending`; engineer review promotes to `accepted`. | Phase 2 |
| 5 | reference-handbook-ingestion | PHAK + AFH ingestion (per ADR 018 cache pattern). | Phase 2 |
| 6 | reference-aim-ingestion | AIM ingestion. | Phase 2 |
| 7 | reference-ac-ingestion | AC catalog (per-AC full-text where licensing permits). | Phase 2 |
| 8 | reference-versioning-tooling | Annual diff job, hash-compare, lesson rewrite generator. | Phases 1-7 (CFR ingestion at minimum) |
| 9 | reference-lesson-migration | One-pass mechanical migration of pre-ADR-019 lessons to identifier syntax. | Phases 1-7 |
| 10 | reference-irregular-corpora | NTSB reports, Chief Counsel letters, FAA Orders, sectionals, plates, ACS, etc. -- per-corpus WPs as needed. | Phase 2 |

Phases 1-3 unblock authoring with the validator and renderer present. Phases 4-7 populate the registry. Phase 8 unlocks the annual rollover. Phase 9 migrates existing lessons. Phase 10 expands corpus coverage.

**Authoring lessons against any new corpus requires that corpus's ingestion to have landed.** No "stub the registry, author the lesson, hope for the best."

## 9. Resolved deferrals

Per CLAUDE.md "no undecided 'considerations for future work,'" each item the v1 reviewer flagged is resolved here:

| Topic | Resolution |
| --- | --- |
| Internationalization (ICAO, EASA, translations) | DEFERRED with trigger: when first non-English / non-FAA corpus is ingested, ADR 019 gets an i18n revision. The corpus prefix model accommodates (`icao:annex-6.4.3.1@en-2024`). Out of scope until trigger fires. |
| Registry availability at render time | Static parts loaded at build; dynamic parts fetched in lesson-page server load function. See §2.5. |
| Multi-deployment registry consistency (dev vs prod) | Static registry is in code; identical across deployments. Indexed tier varies; the renderer surfaces an ENV-tagged build identifier so dev/prod divergence is debuggable. |
| External tool registry access | `@ab/sources` exposes the query API as a public lib; external scripts import it directly. |
| Registry deletion safety | Registry entries are not deletable once `accepted` -- they get `lifecycle: 'retired'` (additional state) plus a `superseded_by` pointer. Lessons referencing retired entries get a WARNING. |
| Lesson deletion / orphaned entries | Lesson deletion is normal. Registry entries that no lesson references are not orphans; corpus is allowed to have unused entries. |
| `references_pinned_to` lesson-level conflict with body pin | Field REMOVED. Body pins are the only pin level. |
| One-to-many alias (paragraph splits) | Resolved: alias entry's `to` field is `string \| string[]`. Author chooses which sub-paragraph their original reference now points at; warning emitted. |
| Many-to-one alias (paragraphs merge) | Resolved: alias entry's `from` field is single, `to` is shared. Multiple lessons may map to the same target post-merge; deduplication is a renderer concern. |
| Reserved sections | A reserved registry entry exists with `canonical_title: "Reserved"`. Validator allows references to it but emits a NOTICE -- referencing a reserved section is unusual. |
| Deleted sections | Deletion is supersession with no successor. Lessons get WARNING; author resolves via §6.3. |
| Two-edition race (annual + mid-year correction same week) | Editions are timestamped to date precision. Latest by date wins. Diff job handles both edition transitions. |
| Partial ingestion | Ingestion lifecycle is `pending` -> `accepted` per-batch. Lessons resolve against `accepted` only. Validator surfaces "X% of registry is pending" in CI but doesn't block. |
| Multi-paragraph range crossing missing sections | Resolved: §1.4 dropped range/exclusion microsyntax. Each link is a single identifier. |
| Lesson moved between repos (FIRC migration) | Identifiers are globally unique by construction. `@ab/sources` is consumed wherever; importable from the parent monorepo or vendored. |
| User-generated card / scenario fixture / non-Markdown reference | Identifier is plain text; the registry's query API is callable from anywhere. Markdown link syntax is one consumer; TypeScript imports of identifiers from `@ab/sources` is another. Hangar UI for user-generated content uses a picker that emits the same identifier strings. |
| Scenario fixture file (TypeScript, not Markdown) | Imports identifier constants from `@ab/sources`; same registry, same rules; no link-text validation since there's no link. |
| Audio transcript spoken-form citations | Out of scope for v1 of registry. When audio surface ships, the indexed tier adds spoken-form aliases. |
| Search query "lessons mentioning fuel reserves" | Not an identifier query; topic search lives in the indexed tier's full-text index, not in the registry. Reachable from the same `@ab/sources` query API. |
| Embedding-based "lessons related to this concept" | Computed tier (per §4). Vector indexes are computed-tier artifacts; query path lives in `@ab/sources`. |
| Mass-recompute when an AC is revised | Diff job (§5) is the mechanism. Subscribed lessons recomputed automatically; un-pinnable via §6.3. |
| Academic-style bibliography export | `@ab/sources` query API exposes a fielded export (IEEE/Chicago/APA formatters live in a separate module). |
| Regulation-diff alerts to subscribers | Pub/sub on registry edition changes. Out of scope for ADR 019; deferred to a notifications WP with trigger ("when learner-account features ship"). |
| Change-history visualizations across editions | Reading multiple `Edition` records and rendering a diff is a feature; UX defined in a future WP. |
| Cited reference doesn't have a stable URL | `live_url` is `null`. Renderer falls back to a generic registry-internal page that displays canonical metadata + manifest link if a derivative exists. |
| POH from a non-standard manufacturer format | Per-corpus WP defines the convention. POH corpus's resolver handles drift; old POH formats register their own slug shape. |
| NTSB redaction / re-release | Re-release with new redactions = new edition (date-pinned). Old edition retained in registry. |
| Share-card / tooltip / RSS / Slack render modes | Specified in §3.1 render-mode table. |
| Lesson rendered in non-airboss Markdown viewer (GitHub) | Identifier-URLs render as plain links pointing at our resolver service (e.g. `https://refs.airboss.dev/regs:cfr-14.91.103@2026`). The service does the resolution; external viewers see useful URLs. |
| Registry diverges between branches | Static registry is a TypeScript module; PR diff shows registry changes. PR review catches divergence before merge. |
| Registry entry deleted in error | Not possible: deletion requires `lifecycle: 'retired'` with explicit superseder. |
| `references_pinned_to` lesson body conflicts with body pin | Resolved: lesson-level pin field removed. |

Anything not in this table is in scope for the ADR or genuinely out of scope.

## 10. Out of scope

- DB schema for indexed tier -- specified by per-corpus ingestion WPs
- Hangar UI for non-engineer-edited registry entries -- separate WP
- I18n / language facet -- deferred until first non-English corpus (§9)
- Audio transcript spoken-form aliases -- deferred until audio surface
- Pub/sub regulation-diff alerts -- deferred until notifications WP
- Academic citation formatters -- deferred; trivial extension when needed

## 11. Acceptance criteria

Before this ADR moves to `accepted`:

- [ ] §1 (identifier scheme) reviewed against all corpora named in the reviewer charter
- [ ] §1.5.1 (severity tiers) lists every validation case and assigns a tier
- [ ] §2 (registry) specifies the `@ab/sources` lib structure and responsibility boundaries
- [ ] §3.1 (substitution tokens) covers every render mode named in S8
- [ ] §4 (storage tiers) updated in [STORAGE.md](../../platform/STORAGE.md) to match
- [ ] §5 (versioning workflow) free of `last_verified`, `verification_due`, `references_pinned_to`
- [ ] §6 (aliases / supersession) covers silent, content-change, cross-section, supersession-with-ack, supersession-mark-historical
- [ ] §8 (phases) ordered with bulk ingestion before authoring
- [ ] §9 (resolved deferrals) addresses every reviewer item explicitly
- [ ] No `TBD` anywhere in the document; every "future" item has a trigger

## 12. Worked example -- lesson body to rendered output

```markdown
---
title: Preflight Action
week: 4
section_order: "05"
---

# Preflight Action

Per [@cite](regs:cfr-14.91.103), the PIC must become familiar with all available
information before any flight.

The phrase "all available information" is interpreted by the
[Walker letter (2017)](interp:chief-counsel.walker-2017 "+ack:smith-2030:scope-narrowed-but-91-103-claim-intact")
to require active investigation, not passive review.

The pre-flight briefing recommended in [@cite](ac:91-92.a) gives one
acceptable means of compliance.
```

End-to-end:

1. **Author writes** the body above.
2. **`bun run check`** parses; finds three identifiers (one with an `+ack` annotation); auto-stamps editions if missing (`regs:cfr-14.91.103@2026`, `ac:91-92.a@2018`); validates link text non-empty; validates registry resolution; validates the Walker reference is acknowledged with a known superseder.
3. **CI passes** (no ERROR-tier issues).
4. **Render time on `/lessons/.../preflight-action`:** server load batch-resolves the three identifiers via `@ab/sources`. Component substitutes `@cite` tokens. Renders to HTML.
5. **Rendered HTML:**
   - "Per **§91.103 Preflight action**, the PIC..."
   - "...the **Walker letter (2017) (acknowledged 2030 supersession; 91.103 claim intact)** to require..."
   - "...recommended in **AC 91-92A**..."
6. **Print export** uses the same data, with footnote URLs for each link.
7. **TTS** speaks "section ninety-one one-oh-three Preflight action" without speaking the identifier.

## 13. What changed from v1

| Section | v1 | v2 (this ADR) | Why |
| --- | --- | --- | --- |
| §1.1 separator | dot (`.`) between corpus and locator | colon (`:`) | Locators contain dots; need unambiguous parser boundary |
| §1.1 grammar | "always reads outside-in" universal rule | per-corpus convention; locator opaque to parser | Reviewer C1: corpora like NTSB don't fit hierarchy |
| §1.3 pinning | optional, with lesson-level shortcut | mandatory; auto-stamped at validation | Reviewer C2: optional pinning silently drifts |
| §1.4 multi-reference | `..` and `!` URL microsyntax | dropped; one identifier per link, renderer adjacency-merges | Reviewer C3: microsyntax breaks Markdown |
| §1.5 validation | rules listed without severity | tiered ERROR/WARNING/NOTICE in §1.5.1 | Reviewer N7 + general rigor |
| §1.6 unknown corpus | not present | `unknown:` escape hatch with WARNING | Replaces v1 "lesson-driven discovery" framing |
| §2 registry | conflated static and runtime concerns | three concerns: static identity / per-corpus resolver / query API; new `@ab/sources` lib | Reviewer S2, S5, S7 |
| §2.1 SourceEntry | `parent`, `editions`, `current_edition`, `derivative_path`, `indexed_table`, `last_verified` | only static identity fields; computed/dynamic moved out | Audit: removed redundant fields |
| §2.4 lifecycle | not present | `pending` / `accepted` lifecycle | Reviewer S6 + audit: catch ingestion bugs |
| §2.5 render strategy | not specified | server load batch-resolves | Reviewer S7 |
| §3.1 tokens | closed set of 6 | open set; initial 12 plus extension procedure | Reviewer S3 |
| §3.1 render modes | not specified | per-mode table | Reviewer S8 |
| §3.3 frontmatter | `last_verified`, `verification_due`, `references_pinned_to` | none of those fields | Audit: dropped redundant fields |
| §4 storage tiers | four (source/derivative/indexed/generated) | five (added computed) | Reviewer C4 |
| §5 workflow | included date-stamping step | pins do the work; no date fields | Audit |
| §6 aliases | "info-level notice" | tiered silent/content-change/cross-section | Reviewer + audit |
| §6.3 supersession ack | not present | new section | User direction: retain original references with annotation |
| §8 phasing | validator before registry; lessons-on-demand | bulk ingestion first; `unknown:` for transitions | User direction; reviewer C5 |
| §9 deferrals | implicit | explicit per-item table | CLAUDE.md "no undecided" |
| §11 acceptance | not present | checklist | Reviewer N9 |
| §12 worked example | not present | end-to-end walkthrough | Reviewer Priority 4 |
