---
title: Reference Identifier System
status: draft
date: 2026-04-27
authors: Joshua Ball
related: [018-source-artifact-storage-policy]
---

# Reference Identifier System

This ADR establishes how lessons, work packages, and any other authored content in airboss reference source material (regulations, AIM, ACs, Chief Counsel letters, handbooks, POHs, etc.).

See [context.md](context.md) for the conversation that shaped this.

## Decision

A four-part system:

1. **A canonical identifier scheme** (dotted slug, domain-prefixed, edition-aware)
2. **A registry** that resolves identifiers to titles, source URLs, current text, version metadata
3. **An inline syntax** (standard Markdown link, identifier as URL, with substitution tokens in link text)
4. **A four-tier storage model** (source / derivative / indexed / generated) extending ADR 018

The identifier is the contract. Everything else is implementation behind it.

## 1. Identifier scheme

### 1.1 General form

```text
<corpus>.<doc>.<location>[@<edition>]
```

Where:

- `corpus` is the broad domain (`regs`, `aim`, `ac`, `interp`, `orders`, `handbooks`, `pohs`, `statutes`)
- `doc` identifies the specific document (`cfr-14`, `5-1-7`, `61-65`, `mangiamele-2009`, `8083-25c`, `c172s`)
- `location` is the position within the document (e.g. `91.103`, chapter 12 section 3, paragraph 2)
- `edition` (optional) pins to a specific version when the lesson is making a claim about a specific edition

Dots separate hierarchy levels. Hyphens are part of slugs. The identifier always reads outside-in (broad to specific).

### 1.2 Per-corpus rules

The corpus determines the identifier shape because different corpora have different native structures:

#### Regulations (`regs.*`)

```text
regs.cfr-14.91.103                 single section
regs.cfr-14.91.103.b               paragraph (b)
regs.cfr-14.91.103.b.1             sub-paragraph (b)(1)
regs.cfr-14.91.103.b.1.i           item (b)(1)(i)
regs.cfr-14.91.subpart-b           a whole subpart
regs.cfr-14.91                     a whole part (rare; usually too broad)
regs.cfr-49.830.5                  NTSB Part 830, section 5
regs.cfr-49.1552.subpart-a         TSA subpart
```

The `cfr-14` segment is fixed; variants like `cfr-49` for NTSB.

#### Statutes (`statutes.*`)

```text
statutes.usc-49.44703              49 USC 44703 (BasicMed authority)
statutes.usc-49.44703.a            paragraph (a)
```

USC has its own structure -- uses Title and Section, no Part. Identifier scheme reflects.

#### AIM (`aim.*`)

```text
aim.5-1-7                          chapter 5, section 1, paragraph 7
aim.glossary.pic                   glossary entry "PIC"
aim.appendix-1                     appendix 1
```

AIM uses a chapter-section-paragraph hyphenated convention natively. Identifier preserves.

#### Advisory Circulars (`ac.*`)

```text
ac.61-65                           current revision of AC 61-65
ac.61-65.j                         specifically revision J
ac.61-65.j.section-3               specific section within revision J
ac.61-65.j.change-2                Change 2 issued against revision J
```

#### Interpretations (`interp.*`)

```text
interp.chief-counsel.mangiamele-2009          Chief Counsel letter, dated by year
interp.chief-counsel.walker-2017
interp.ntsb.administrator-v-lobeiko           NTSB Board order by case name
interp.ntsb.administrator-v-merrell.ea-5310   with order number for disambiguation
```

#### FAA Orders (`orders.*`)

```text
orders.faa.2150.3                  FAA Order 2150.3 (whole)
orders.faa.8900.1.vol-5.ch-1       Order 8900.1, Volume 5, Chapter 1
orders.faa.8000.373                Order 8000.373 (compliance philosophy)
```

#### Handbooks (`handbooks.*`)

```text
handbooks.phak.8083-25c.12.3        PHAK 8083-25C, chapter 12, section 3
handbooks.phak.8083-25c.12.3.para-2 paragraph 2 within that section
handbooks.phak.8083-25c.fig-12-7    figure
handbooks.phak.8083-25c.tbl-12-3    table
handbooks.afh.8083-3c.5.intro       AFH 8083-3C, chapter 5, intro
```

PHAK and AFH editions are part of the doc slug (`8083-25c` is its own thing from `8083-25b`). When the FAA publishes 8083-25D, that's a new doc slug entirely.

#### POHs (`pohs.*`)

```text
pohs.c172s.skyhawk.section-2.vne   Cessna 172S Skyhawk, POH section 2 (limitations), Vne entry
pohs.pa-28-181.archer-iii.emergency.engine-fire
```

POHs vary widely in structure; the identifier is open-ended. Per-aircraft-type ingestion will populate.

### 1.3 Edition pinning

Two modes:

**A) Edition is part of the doc slug.** PHAK editions, AC revisions, AIM publication versions all encode this way:

- `handbooks.phak.8083-25c.12.3` is implicitly pinned to the C edition; if the C edition is updated, that *is* the identifier change.
- `ac.61-65.j` pins to revision J.
- `aim.5-1-7` does NOT pin -- AIM is a continuous stream.

**B) Explicit `@edition` suffix.** For corpora where editions are continuous (CFR, AIM, FAA Orders), the identifier carries an optional `@edition` tag:

```text
regs.cfr-14.91.103                 means "current" -- resolves to whatever the registry says is current
regs.cfr-14.91.103@2026            means "as of CFR 2026 publication"
regs.cfr-14.91.103@2027-04         finer pin: April 2027
aim.5-1-7@2026-09                  AIM 2026-09 publication
orders.faa.2150.3@2018-04-27       Order as of specific date
```

**Rule:** lessons SHOULD pin (`@2026`) when the lesson is making claims about specific text. Lessons MAY use unpinned identifiers when referring to "the rule" abstractly without quoting text.

**Validator behavior:** when a lesson contains pinned identifiers and the registry has a newer edition, the validator emits a `version-may-be-stale` warning that lists each affected reference and its delta from current.

### 1.4 Multi-reference

```text
regs.cfr-14.91.103                       single
regs.cfr-14.91.103,91.104                comma list
regs.cfr-14.91.103..91.107               range (inclusive)
regs.cfr-14.91.103..91.107,!91.105       range with exclusion
regs.cfr-14.91.103,91.105..91.107        list and range mixed
```

Range syntax (`..`) is inclusive on both ends. Exclusion (`!`) removes a single section from the preceding range. Order-independent within the comma list.

When pinning is needed, it applies to the whole identifier:

```text
regs.cfr-14.91.103..91.107@2026
```

The renderer normalizes any of these to the explicit list when displaying ("§91.103, §91.104, §91.106, §91.107"). Authors write whichever is most readable.

### 1.5 Validation rules

Build-time validation:

- Every identifier must resolve (the registry has an entry)
- Pinned editions must exist (registry has the version)
- Ranges must be non-empty after exclusions
- Exclusions must be members of the range
- Aliases (renumbered sections, superseded letters) emit info-level notices but resolve

## 2. Registry

The registry is a typed `libs/constants/src/sources/` module (likely `registry.ts`) that the renderer queries. Each entry minimally has:

```typescript
interface SourceEntry {
	id: SourceId;                          // dotted slug
	corpus: Corpus;                        // 'regs' | 'aim' | 'ac' | ...
	parent?: SourceId;                     // the containing entry, if any
	canonical_short: string;               // "§91.103"
	canonical_formal: string;              // "14 CFR § 91.103"
	canonical_title: string;               // "Preflight action"
	live_url?: string;                     // current eCFR URL or equivalent
	derivative_path?: string;              // path to extracted markdown if exists
	indexed_table?: string;                // DB table containing the indexed form
	editions: Edition[];                   // version history
	current_edition: EditionId;            // the latest known edition
	supersedes?: SourceId;                 // pointer to a superseded version
	superseded_by?: SourceId;              // pointer to the successor
	last_verified: Date;                   // when was this entry's metadata last audited
}

interface Edition {
	id: EditionId;                         // e.g. "2026", "2027-04", "j", "8083-25c"
	published_date: Date;
	last_amended_date: Date | null;        // for continuously-amended sources
	source_url: string;
	derivative_path?: string;
	indexed_table_partition?: string;
}
```

Registry is populated by:

- **Engineering authoring** for each new corpus (initial entries hand-written when a WP introduces a new source type)
- **Ingestion pipelines** for bulk corpora -- the CFR ingestion WP populates every section in Part 61 / Part 91 / etc. by walking the eCFR XML
- **Lesson-driven discovery** -- when a lesson references an identifier that doesn't exist, the validator fails and prompts the author to add the registry entry first

The registry is the resolver. Every identifier-shaped URL in lesson markdown is dispatched through it at render time.

## 3. Inline syntax

Standard Markdown link:

```markdown
[<link text>](<identifier>)
```

Where the link text is required and the URL is the identifier. The renderer rewrites identifier-shaped URLs to the appropriate destination.

### 3.1 Substitution tokens

The link text supports tokens that the registry substitutes at render time:

| Token | Substitutes with | Example |
| --- | --- | --- |
| `@short` | `canonical_short` field | `§91.103` |
| `@formal` | `canonical_formal` field | `14 CFR § 91.103` |
| `@title` | `canonical_title` field | `Preflight action` |
| `@cite` | `canonical_short` + `canonical_title` | `§91.103 Preflight action` |
| `@list` | normalized comma list (for multi-refs) | `§91.103, §91.104, §91.106, §91.107` |
| `@as-of` | the pinned edition (if any) | `2026` |

Tokens can mix with literal text:

```markdown
The [IFR fuel and alternate trio at @short](regs.cfr-14.91.167..91.171)
   ^                              ^
   |                              +-- substitutes "§91.167-91.171" or normalized list
   +-- author-written context

[@cite](regs.cfr-14.91.103)
   ^
   +-- becomes "§91.103 Preflight action"

The pilot must check [@cite as of @as-of](regs.cfr-14.91.103@2026)
   ^                                   ^
   +-- becomes "§91.103 Preflight action as of 2026"
```

### 3.2 Authoring posture

- **Plain identifier with no link text -> warning.** `[](regs.cfr-14.91.103)` is rejected by the validator.
- **Bare identifier outside link syntax -> warning.** Writing `regs.cfr-14.91.103` as plain text in prose generates a notice; the author should wrap.
- **Substitution-only text is encouraged for canonical citations.** `[@cite](regs.cfr-14.91.103)` is the recommended default for citing-by-name; it stays in sync if the registry's canonical_title changes.
- **Custom link text is fine for prose flow.** "The [careless or reckless catch-all](regs.cfr-14.91.13)" reads better than "The [@cite](regs.cfr-14.91.13)" in some contexts. Authors choose.
- **Lazy text (identifier echoed back)** like `[91.103](regs.cfr-14.91.103)` is allowed but lower-quality than `[@short](regs.cfr-14.91.103)` because it doesn't update if the canonical form changes.

### 3.3 Bibliography is derived

Lessons do NOT carry a frontmatter `references` list. The parser walks the body, extracts every identifier-shaped URL, and builds the bibliography. This avoids drift between body and frontmatter.

Frontmatter contains only verification metadata:

```yaml
---
title: <lesson title>
week: <N>
section_order: "NN"
last_verified: 2026-04-27
verification_due: 2027-04-27
references_pinned_to: 2026          # optional; means "all unpinned references in this lesson should be treated as @2026"
---
```

`references_pinned_to` is a lesson-level shortcut for the common case where the lesson was authored against a specific edition and every reference should default to that edition. Without it, unpinned references mean "current."

## 4. Four-tier storage model (extending ADR 018)

ADR 018 has three tiers (source / derivative / generated). This ADR introduces a fourth between derivative and generated:

| Tier | What it is | Where | Audience |
| --- | --- | --- | --- |
| **Source** | The original artifact published by an outside authority | `$AIRBOSS_HANDBOOK_CACHE/`, gitignored | Pipeline only |
| **Derivative** | Pipeline-extracted markdown, figures, tables, manifest | In repo, committed | Engineers, auditors, re-seed source |
| **Indexed** | DB rows mirroring derivatives, full-text index, embeddings | Postgres | Runtime, end users |
| **Generated** | Computed platform artifacts (mastery scores, leaderboards, recommendations) | Postgres (different tables) | Runtime |

The split between *derivative* and *indexed*:

- Derivative is the corpus's representation; it changes when the source changes.
- Indexed is the platform's representation; it changes when derivative changes *or* when the platform's indexing strategy changes.
- They have different ownership: derivative belongs to the corpus's ingestion pipeline; indexed belongs to the platform.
- They have different invalidation triggers: derivative invalidated by source change; indexed invalidated by derivative change or schema migration.

The reference identifier system targets *indexed* explicitly when a lesson is rendered live -- the renderer queries the indexed DB to resolve `regs.cfr-14.91.103` to its current text + URL + last_amended_date. The derivative tier is the authoritative content the indexed tier is built from; users rarely see derivatives directly.

## 5. Versioning workflow

The annual cadence the user described:

```text
Year N:
  1. CFR 2026 published.
  2. Ingestion pipeline runs; populates registry editions for 2026.
  3. Lessons authored cite @2026 (or unpinned, which resolves to 2026).
  4. Lessons set references_verified: 2026-MM-DD.

Year N+1:
  5. CFR 2027 published.
  6. Ingestion pipeline runs; populates registry editions for 2027.
  7. Diff job runs: for every section that has a 2026 entry and a 2027 entry, compare hashes.
     - Hash equal -> auto-update lesson references from @2026 to @2027.
     - Hash differs -> emit "needs human re-verification" report.
  8. Human walks the report. For each flagged reference:
     - Read the diff.
     - If lesson's claim still holds, advance the pin to @2027.
     - If lesson's claim no longer holds, edit the lesson.
  9. Verified lessons get references_verified: 2027-MM-DD.

Year N+2:
  10. Repeat.
```

The system mechanically handles "no change" propagation. Humans only see actual changes.

The "list of references that need human re-verification" view is a first-class platform output -- a query against the registry + lesson index that identifies stale references.

## 6. Aliases and renumbering

When the FAA renumbers paragraphs (rare, but happens), the registry tracks aliases:

```typescript
interface Edition {
	// ...
	aliases?: { from: string; to: string }[];
	// e.g. { from: "91.103.b.2", to: "91.103.c.2" } if (b)(2) became (c)(2) in this edition
}
```

A lesson written against the old numbering still resolves; the renderer notes the alias was applied and the validator emits an info notice the next time the lesson is verified.

Renumbering across sections (rule moved from 91.103 to 91.105) gets a stronger signal -- the validator emits a warning, not an info notice, because the alias crosses section boundaries and the lesson author should explicitly review whether the move changes the lesson's intent.

## 7. Cross-references between corpora

Lessons routinely cite multiple corpora at once. Example: a lesson explaining 91.103 cites:

- `regs.cfr-14.91.103` -- the regulation
- `aim.5-1-7` -- AIM procedure
- `interp.chief-counsel.walker-2017` -- the interpretation
- `ac.91-92` -- the AC describing recommended practice

These are independent identifiers; the lesson body weaves them with prose. The platform can render a "see also" cluster from the bibliography or leave them inline.

For lesson-level groupings ("the IFR fuel + alternate trio") the grouping lives in the link text:

```markdown
[The IFR fuel and alternate trio @list](regs.cfr-14.91.167,91.169,91.171)
```

No new "composite identifier" registry type. The grouping is expressive at the lesson level; the registry stays per-section.

## 8. Implementation phases

This ADR specifies the design. Implementation lands in subsequent work packages:

| Phase | Work package | Deliverable |
| --- | --- | --- |
| 0 | This ADR | Decision document, design pressure analysis |
| 1 | reference-identifier-scheme-validator | Markdown parser that recognizes identifier-shaped URLs; validator passes static-validation rules at `bun run check` time. Rejects malformed identifiers before any registry exists. |
| 2 | reference-source-registry-phase-1 | Initial registry: Part 61, Part 91, Part 67, Part 68, NTSB Part 830, the dozen frequently-cited ACs, the handful of famous Chief Counsel letters. Hand-authored. |
| 3 | reference-renderer-runtime | Renderer in `apps/study/` that resolves identifiers at render time, performs token substitution, links to live URLs (or derivatives if available). |
| 4 | reference-source-versioning-tooling | The annual-rollover diff tool. Compares editions, propagates auto-verifies, surfaces human-review reports. |
| 5 | reference-cfr-ingestion-bulk | Full eCFR ingestion populating the registry for every section in Title 14 (and 49 CFR 830, 1552). |
| 6 | reference-handbook-ingestion | PHAK and AFH ingestion. Per the source-cache pattern in ADR 018. |
| 7 | reference-aim-ingestion | AIM ingestion. |
| 8 | reference-ac-ingestion | AC ingestion (catalog only; full text where licensing permits). |

Phases 1-3 are the "we can author and render lessons that reference regulations" milestone. Phase 4 is the "we survive a CFR annual update without manual chaos" milestone. Phases 5-8 are the "lessons render with full text inline" milestone.

## 9. Out of scope

- DB schema for the indexed tier. Specified by the ingestion WPs.
- Hangar UI for non-engineer-edited registry entries.
- Migration of pre-ADR-019 lessons (Week 1 + 4 capstones currently use eCFR URLs in plain text). Done in a single mechanical PR after Phase 1 lands.
- The semantics of "current" for ACs that are continuously-revised through Change documents (handled per-corpus in registry edition entries; ACs use the change-N convention from ADR 019 §1.2).

## 10. Reviewer ask

Before this ADR goes to Approved, send to a reviewer with the following charter:

> Look for what limits us in the future. We don't know all that we want yet, but we know we don't want to have to rebuild references and resources because we didn't think something through. Specifically:
>
> - Where can the identifier scheme not represent something we'll plausibly need?
> - What corpora will the dotted-slug shape break on?
> - What mutation/renumbering/supersession cases break the alias system?
> - What rendering modes (print, audio, screen reader, voice-only, search snippet) break the substitution tokens?
> - What versioning races (lesson cites @2027 before ingestion finishes, two lessons cite different editions of the same section, edition pin in a multi-reference range where pins differ across sections) break the resolver?
> - What internationalization (ICAO Annexes, foreign reg sets, translations) breaks the corpus prefix model?
> - What automation (full-text search, mass-recompute, cross-reference graph queries, embedding-based "show me lessons relevant to this concept") breaks if the scheme stays as-is?
> - Are we painting ourselves into a corner anywhere?
