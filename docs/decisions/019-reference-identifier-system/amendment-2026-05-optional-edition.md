---
title: 'ADR 019 amendment -- optional edition + drift sentinels'
status: proposed
date: 2026-05-06
authors: Joshua Ball
amends: docs/decisions/019-reference-identifier-system/decision.md
incorporates_reviews:
  - ./review-amendment-2026-05-06.md
---

# ADR 019 amendment -- optional edition + drift sentinels

This amendment relaxes one constraint of ADR 019 (mandatory edition pinning) for a specific class of citations, and introduces a small drift-detection mechanism to make edition transitions mostly automatic across all multi-edition reference corpora.

> **Review incorporated.** [review-amendment-2026-05-06.md](./review-amendment-2026-05-06.md) reviewed the v1 of this amendment and conditionally approved. This revision incorporates all five required edits (path-grammar disambiguation; sentinel-laundering NOTICE; gated flag-day for the legacy-field removal; per-corpus sentinel vocabulary committed inline; D1-D5 recorded as decisions, not open questions) plus the smaller items (step 4->5 dependency, marginal-cost note, NOTICE-doesn't-block-publish confirmation).

## The problem

ADR 019 specifies that every citation pins an edition: `airboss-ref:handbooks/afh/8083-3C/3` rather than `airboss-ref:handbooks/afh/3`. The pin is mandatory because some citations -- page numbers, quotes, regulation paragraph numbers in years where renumbering happened -- only make sense against a specific edition.

But many citations *don't* care which edition they resolve to. A knowledge node that cites "AFH chapter 3 -- Basic Flight Maneuvers" doesn't need to lock to FAA-H-8083-3B specifically; the chapter exists in 3C with the same title and equivalent content. Forcing those citations to pin an edition has three downsides:

1. **Edition transitions become a manual rewrite job.** Every time the FAA publishes a new AFH or PHAK or AIM cycle, every citation across the entire corpus has to be re-pinned by the author or by a migration tool, even when nothing material changed. The "annual diff job" in ADR 019 §5 mechanically advances pins when text hashes match, but it still touches every file in every PR.
2. **Authors who cite at chapter or doc level have to know an edition string they don't actually need.** "Cite the AFH chapter on slow flight" becomes "look up the current AFH edition slug, copy it into your citation." That's friction with no payoff.
3. **The supersedes chain ends up propping up legacy data instead of doing real work.** When 14 of 15 free-text AFH 3B citations in `course/knowledge/` could auto-resolve to 3C without any human checking (chapter titles unchanged, content equivalent), keeping the chain wired *just* to make those resolve is using a powerful mechanism for a janitorial task. The chain should exist for citations that genuinely need an older edition kept alive (page-pinned, quote-pinned), not as a back-fill for edition strings the author didn't need to write.

The same friction applies to every multi-edition corpus the project will touch: CFR by year, AIM by publication cycle, ACs by revision letter, POHs by date, sectionals by 28/56-day cycle.

## The proposal

### 1. Edition becomes optional in the locator

Today's ADR 019 §1.2 grammar for handbooks:

```text
airboss-ref:handbooks/<slug>/<edition>/<chapter>...
```

Becomes:

```text
airboss-ref:handbooks/<slug>[/<edition>]/<chapter>...
```

The same relaxation applies to every corpus where edition is part of the locator path (handbooks, ACs, POHs). For corpora where edition is a `?at=` query parameter (regs, AIM, sectionals, plates), the relaxation is "the `?at=` parameter is optional."

#### Path grammar disambiguation

The optional-edition slot creates a parser ambiguity: when reading the segment immediately following `<slug>`, the parser cannot tell from syntax alone whether the segment is an edition pin (`8083-3C`) or the start of the chapter locator (a chapter literally named `3C`, or a future handbook with letter-suffixed chapters).

The disambiguation rule is registry-aware, not syntactic: **the segment immediately following `<slug>` is matched against the registry's known editions for that slug. If it is a known edition for that slug, treat it as the edition pin and consume it; otherwise treat it as the start of the chapter locator.** This is deterministic given a populated registry and degrades gracefully when an unknown segment appears (treated as chapter locator; resolver then errors with "chapter not found" if invalid). Per-corpus resolvers implement this lookup as a first step in `parseLocator`.

Resolution rules:

- **Edition omitted:** resolver returns the current (latest non-superseded) entry for the slug.
- **Edition specified:** resolver returns that exact `(slug, edition)` entry. If it doesn't exist in the registry -> ERROR at build time.

Validator behavior:

- An unpinned citation is no longer an ERROR (current ADR 019 §1.5 row 3) for chapter-level and doc-level locators. It's the explicit signal "I want current edition, whatever that is."
- An unpinned citation IS still an ERROR when the locator includes a page number, a quote, or any other edition-sensitive precision. The validator detects edition-sensitive locators and requires a pin for them. Specifically: any citation with `?page=`, `?paragraph=` (for regs that renumbered), or a sibling `quote:` field requires an edition pin.

This means citation precision implicitly determines whether edition is required:

| Precision               | Edition required? | Resolves to                                             |
| ----------------------- | ----------------- | ------------------------------------------------------- |
| Doc-only                | No                | Current edition's reader                                |
| Doc + chapter           | No                | Current edition's chapter (verified by drift sentinel)  |
| Doc + chapter + section | No                | Current edition's section (verified by drift sentinel)  |
| Doc + page              | Yes               | Pinned edition's page                                   |
| Doc + paragraph         | Yes (for regs)    | Pinned year's paragraph numbering                       |
| Doc + quote             | Yes               | Pinned edition's text                                   |

### 2. Drift sentinels

When a citation is doc-or-chapter-level (no edition required), the author optionally captures a sidecar field describing what they expected to find:

```yaml
references:
  - ref: airboss-ref:handbooks/afh/3
    chapter_title: Basic Flight Maneuvers
    note: Practical flight interpretation of the four forces.
```

The validator looks up the sentinel value in the resolved (current) edition and compares.

- **Match:** silent.
- **Drift (sentinel field present, current edition's value differs):** NOTICE at build time. Author opens the report, decides per citation whether to update the sentinel (content equivalent, just retitled) or pin to the previous edition (content changed and the old version is what's being cited).

Drift sentinels turn ADR 019 §5's "annual diff job" from "rewrite every citation in every PR" into "build emits a NOTICE list; author walks the list and decides." Most years, most citations are silent because most chapter titles don't change. The work scales with actual change, not with corpus size.

#### Canonical sentinel vocabulary

Sentinel field names are flat in node frontmatter (one line of YAML per sentinel, no nesting under `expect:`) and drawn from a fixed canonical vocabulary committed in this amendment. Per-corpus resolvers must use these names; new corpora propose additions in their corpus WP, not ad hoc. The validator rejects unknown sentinel field names with ERROR (typo defense).

| Sentinel field   | Used by                                  | Compared against                                       |
| ---------------- | ---------------------------------------- | ------------------------------------------------------ |
| `chapter_title`  | handbooks, AIM, ACs (where chaptered)    | Chapter title in resolved edition                      |
| `section_title`  | regs, ACs, AIM sub-sections              | Section title in resolved edition                      |
| `paragraph_text` | regs paragraphs, AIM paragraphs          | Verbatim paragraph text (when sentinel is the prose)   |
| `page_heading`   | page-pinned citations with stable headings | Page-heading in resolved edition's page index        |

Implementation lands handbook sentinels (`chapter_title`) first; regs / AIM / ACs / sectionals / ACS land per their corpus WPs. The vocabulary is settled here so the next corpus's WP does not relitigate naming.

#### Sentinel-laundering safeguard

Drift sentinels rely on author honesty: when `chapter_title` drifts in current edition, the author either updates the sentinel (because content is equivalent and only the title changed) or pins to the previous edition (because content materially changed). Trust is correct in principle, but the mechanism does nothing on its own to detect the failure mode where an author updates a sentinel *without* re-reading the chapter to confirm content equivalence -- silently laundering a content change into "matches current."

The validator closes this loophole with a git-aware NOTICE: when a sentinel field is modified in the same commit as a registry edition advance for the cited slug, every affected citation is flagged as "sentinel updated against new edition -- reviewer should confirm content equivalence." The check is one git diff lookup per modified sentinel; the NOTICE surfaces in the build summary, not in CI failure. It does not block the publish gate; it surfaces the review queue to the author and the reviewer.

### 3. The supersedes chain narrows

Today the chain is wired for every prior edition we keep around, including ones that exist *only* to back-fill legacy free-text citations. Under this amendment, the chain's load-bearing job becomes:

- **Required:** for edition-pinned citations whose pinned edition is no longer current. The chain says "yes, that older edition's reader exists; here's how to get to it."
- **Not required:** for unpinned citations. They resolve to current directly.

A YAML stub row that exists only so an unpinned citation resolves can go away once the citation is rewritten as unpinned-with-sentinel. This is exactly the AFH 3B situation: the stub exists to keep `source: AFH (FAA-H-8083-3B)` resolving, but if we rewrite those citations as `airboss-ref:handbooks/afh/3` with a chapter-title sentinel, they resolve cleanly to 3C and the stub has zero consumers.

## Why this generalizes

This isn't an AFH thing. It's the right model for every corpus on the project's roadmap.

| Corpus                | Edition cadence                | Most citations       | Edition-sensitive citations               |
| --------------------- | ------------------------------ | -------------------- | ----------------------------------------- |
| CFR (regs)            | Annual                         | Section-level        | Paragraph numbering after renumbering     |
| AIM                   | ~Quarterly publication cycle   | Chapter-section-para | Specific text passages, deprecated entries |
| Advisory Circulars    | Per-AC revision letter         | Section-level        | Specific guidance language                |
| Handbooks (PHAK/AFH)  | Multi-year edition revisions   | Chapter-level        | Page numbers, quoted procedures           |
| POHs                  | Per-aircraft, per-date         | Section-level        | Performance numbers (revision-specific)   |
| Sectionals / plates   | 28-day or 56-day cycles        | Whole-chart          | Specific obstacles, frequencies, NOTAMs   |
| ACS / PTS             | Per publication ID             | Task-element         | Specific element wording                  |

In every row, the same pattern applies: most citations don't care about edition (they describe a thing that's stable across editions), a small minority do (they pin to specific text, numbers, or layout). Optional pinning + drift sentinels handles all of them with one mechanism.

## Why this isn't too complex

Three pieces, each small:

1. The validator already parses `airboss-ref:` URIs and dispatches to per-corpus resolvers. Making edition optional in the locator grammar is a per-resolver change, not an architecture change.
2. Drift sentinels are sidecar YAML fields the validator looks up. Each corpus's resolver already has a "get current title for this locator" function (or trivially can); the drift check is `expected === actual` with a NOTICE on miss.
3. The supersedes chain stays as ADR 019 specifies it. Nothing new gets added; some prior-edition stub rows go away because they have no consumers anymore.

No new tables. No new file conventions beyond optional sidecar fields. No breaking change to existing pinned citations -- they keep resolving exactly as they do today.

The validator already walks every `airboss-ref:` URI on every build; the marginal cost of a sentinel check is one map lookup per URI. Drift NOTICEs surface in the build summary, not in CI failure -- they do not block the publish gate per ADR 019 §1.6, so an author cannot accidentally block a deploy on an unrelated drift.

## Why this isn't too simple

The alternative "just always pin every citation, and run a migration tool every edition transition" was the original ADR 019 design. It works, but it has the friction described in the problem statement: every transition touches every file, even when nothing material changed. Drift sentinels mean the system mechanically distinguishes "nothing changed, no work needed" from "this specific citation needs author judgment," and only surfaces the latter.

The alternative "make edition always optional, no drift detection" is too simple: the project would silently drift through edition transitions, and a node citing "AFH chapter 7" wouldn't notice when 3D renumbers chapter 7 to chapter 9 with different content. Drift sentinels are the load-bearing piece that makes optional pinning safe.

## Decisions

These are the questions the amendment resolved during review (per [review-amendment-2026-05-06.md](./review-amendment-2026-05-06.md)). Recorded here as decisions, not open items.

### D1. Sentinel field naming -- flat, with a fixed canonical vocabulary

Sentinel fields live flat in node frontmatter (one line of YAML each), not nested under an `expect:` block. Flat is more readable for hand-edit, and authors will hand-edit these constantly. The canonical vocabulary is specified in §2 above (`chapter_title`, `section_title`, `paragraph_text`, `page_heading`) and is enforced by the validator -- unknown sentinel field names are ERROR (typo defense). New corpora propose additions in their corpus WP, not ad hoc.

### D2. Migration of free-text legacy citations -- review queue, always

The migration script does **not** auto-rewrite legacy free-text citations, even when chapter titles match exactly between the cited edition and the current edition. Auto-rewrite-on-title-match looks fine for the 15 AFH citations we have today and scales catastrophically when the next corpus has hundreds of legacy citations: a content-equivalence claim made by the migrator on the author's behalf is the same class of mistake as a stub.

The migration script produces `course/knowledge/.migration-review.md` listing every legacy citation with its proposed rewrite, the matched sentinel value, and a checkbox. Author walks the list, ticks each box, commits. Migration is **not** applied until every box is ticked. For the AFH 3B set this is 15 lines and 15 ticks; for future corpora it scales with the work the author actually owes.

This is the do-it-right call: do the review once, do it correctly, never wonder later whether a citation got auto-laundered.

### D3. `?at=unpinned` -- removed outright in this amendment

ADR 019 §1.5 row 5 (the `?at=unpinned` escape with WARNING severity) is removed in the same change that introduces optional editions. Currently zero usages. Deprecation windows exist for things in the wild; nothing is in the wild. Authors learn one mechanism (omit the edition) instead of two. The §1.5 update is part of step 2 of the implementation plan.

### D4. Drift sentinels for non-handbook corpora -- handbooks first, vocabulary committed inline

Implementation ships handbook drift sentinels first (handbook is where the AFH 3B pressure is). Per-corpus sentinel field names for every corpus on the roadmap are committed in §2's vocabulary table here, so the next corpus's WP does not relitigate naming. Implementations land per corpus WP; the design is settled in this amendment, once.

### D5. No current edition for slug -- ERROR with registry-aware hint

When a citation omits the edition and every edition of the cited slug is `superseded` or `retired` (no current row exists), the validator emits ERROR. The error message is registry-aware: it names the slug, lists up to 3 most-recent superseded entries with their supersession dates, and quotes the exact pin string the author probably wants. Form:

```text
ERROR: airboss-ref:handbooks/some-handbook/3 has no current edition.
  All editions of `some-handbook` are superseded or retired.
  Most recent prior editions:
    - 8083-3B (superseded 2024-08-01)
    - 8083-3A (superseded 2018-04-15)
  To cite the most recent: airboss-ref:handbooks/some-handbook/8083-3B/3
```

Two extra lines in each per-corpus resolver, large quality-of-life payoff, zero ongoing cost.

## Lessons -- why we didn't get this right the first time

Full analysis: [docs/decisions/lessons/2026-05-load-bearing-vs-conservative-defaults.md](../lessons/2026-05-load-bearing-vs-conservative-defaults.md).

ADR 019 was ratified 9 days before this amendment. At ratification time, no live edition transition had been worked through, and the friction the amendment removes was invisible. ADR 019 specified mandatory edition pinning as a *conservative default* but didn't label it as such -- it appeared in the ADR text as a load-bearing requirement. This amendment is what happens when usage clarifies that a constraint was over-specified.

Three patterns the project should apply to future ADRs (now codified in [docs/decisions/README.md](../README.md) as a self-review checklist):

1. **Distinguish load-bearing constraints from conservative defaults.** The URI scheme, registry, lifecycle, and supersedes chain in ADR 019 are load-bearing -- the design fails without them. Mandatory pinning was a conservative default -- the design works fine without it; it just covers more cases safely. ADRs should label conservative defaults explicitly with a one-line note about when they might be relaxed.
2. **A mechanical sweep tool is a smell.** ADR 019 §5 describes an annual diff job that mechanically rewrites every citation when its underlying text doesn't change. That's a tell: the design is comfortable with PRs that touch every file every year. Drift sentinels eliminate that churn. When a design includes a sweep tool to absorb friction, the friction may be the design's own creation.
3. **Walk a worked example through the current state, not just the happy path.** ADR 019 §12 and §13 walked through authoring new lessons with current-edition references. Neither walked through "we have 15 free-text citations to a now-prior edition." That's the project's current reality, and modeling it at ratification time would have surfaced the optional-edition question 9 days earlier.

The point is not that ADR 019 was wrong -- it wasn't, structurally. The point is that future ADRs can avoid the 9-day amendment cycle by applying these three patterns up front.

## Implementation plan

Per the "no pomp" instruction, this ships as a single branch (or two if parallel work cleanly splits), no work package:

1. This amendment doc lands as the design contract.
2. ADR 019 §1.2 + §1.5 get a small edit pointing at this amendment for the optional-edition rule, and §1.5 row 5 (`?at=unpinned`) is removed per D3. The ADR itself stays ratified; the amendment is what changed.
3. Validator + per-corpus resolvers get: the optional-edition relaxation, the registry-aware path-grammar disambiguation, the canonical sentinel-field vocabulary check, the drift-sentinel comparison, the sentinel-laundering NOTICE, and the no-current-edition ERROR with registry-aware hint.
4. Knowledge-node frontmatter schema accepts the new `references:` shape alongside legacy `source:` (legacy = WARNING).
5. Citation renderer resolves URIs and renders titles from the registry. Same change fixes the "card shows 'Handbook' instead of 'Airplane Flying Handbook'" surface bug. **Depends on step 4** -- the renderer reads the new schema shape; ship 4 first or in the same PR.
6. Migration script converts free-text legacy citations to structured form. Per D2, the script does **not** auto-apply: it produces `course/knowledge/.migration-review.md` with one row per legacy citation, the proposed rewrite, the matched sentinel value, and a checkbox. The script applies a citation only when its checkbox is ticked.
7. Author walks the migration review list, ticks each box, commits. Re-run the script to apply ticked rows.
8. **Gated flag day, in its own commit.** Legacy `source:` graduates from WARNING to ERROR and the field is removed from the schema. This step ships only after step 7's review queue closes with zero residual legacy citations; the step's PR description quotes that count (`Legacy citations remaining: 0`). Single-commit so any failure (residual unmigrated citations) is one revert away.
9. AFH-3B-ingestion work package is updated based on what migration revealed. If zero edition-pinned citations remain after migration, the WP is cancelled (the YAML stub deleted, `course/references/handbooks-noningested.yaml` deleted).

**Parallelism:** steps 3 and 6 can parallelize (validator/resolvers vs. migration script -- different files, different review surfaces). Step 5 must follow step 4. Everything else is serial.
