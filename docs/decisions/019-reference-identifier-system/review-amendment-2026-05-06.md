---
title: Review of ADR 019 amendment -- optional edition + drift sentinels
date: 2026-05-06
authors: Senior Architect (amendment review)
reviewing: ./amendment-2026-05-optional-edition.md
prior_reviews:
  - ./review-2026-04-27.md
  - ./review-v2-2026-04-27.md
  - ./review-v3-2026-04-27.md
status: done
review_status: done
---

# Review of ADR 019 amendment -- optional edition + drift sentinels

> **Frame for this review.** The first question is always: *what is the right thing to do?* Do it right or do it again. Every recommendation below is filtered through that lens, not through "what's cheapest to ship."

## Verdict

**Approve, after the open questions are answered inline and three small holes are closed.** The amendment is in the right direction and the solution is solid. It correctly identifies that mandatory pinning is solving a problem only a minority of citations have, while imposing per-edition rewrite friction on the majority, and it introduces drift sentinels as the load-bearing mechanism that makes the relaxation safe. The model generalizes cleanly to every multi-edition corpus on the roadmap. No new tables, no new file conventions beyond a sidecar field, no breaking change to existing pinned citations.

The work that remains is finishing the design, not reshaping it: answer the five open questions (recorded below), close a sentinel-laundering loophole, disambiguate the optional-edition path grammar, and tighten the schema flag-day in the implementation plan.

## What is right about this

### 1. Precision determines pinning -- this is the correct invariant

The table at lines 55-62 is the heart of the proposal. Tying "must pin" to whether the locator is *edition-sensitive* (page, paragraph, quote) rather than to the citation site is the conceptually clean rule. It is also self-explaining to authors: if you cited a page number, of course you pin. If you cited "AFH chapter on slow flight," of course you don't need to know which edition you're on; the chapter exists across editions and your citation is about the concept.

This is the right separation. ADR 019 v3 chose mandatory pinning because *some* citations need it; this amendment correctly observes that the right rule is "pin when the locator's precision requires it," not "pin always."

### 2. Drift sentinels do real work

This is the part that elevates the amendment from "make a thing optional" into a coherent design. The sidecar `chapter_title: ...` field is tiny (one line of YAML, one `expected === actual` check in the resolver) and converts ADR 019 §5's "annual diff job rewrites every citation in every PR" into "build emits a NOTICE list scoped to actual change." Most years, most chapter titles don't change, and the work scales with reality, not with corpus size.

This is the load-bearing piece. Without it, optional pinning would silently drift through edition transitions and the project would discover renumbering or content changes at the worst possible moment (a learner reading a stale citation). With it, the validator catches every change at build time and routes it to author judgment.

### 3. The model generalizes correctly across the corpus roadmap

The corpus table at lines 95-104 is not decorative; it is the proof that the model is the right shape. CFR by year, AIM by cycle, ACs by revision letter, POHs by date, sectionals by 28/56-day cycle, ACS by publication ID, handbooks by edition -- every multi-edition corpus has the same mostly-stable / occasionally-edition-sensitive split. One mechanism, seven corpora. That is the correct test for an architectural decision: it earns its complexity by paying for itself in places beyond the originating example.

### 4. The supersedes chain is narrowed to its real job

Today the chain is doing two unrelated jobs: keeping older editions reachable for citations that genuinely need them (page-pinned, quote-pinned, paragraph-numbered), and propping up legacy free-text citations whose authors didn't actually need an edition string. Splitting those was overdue. After this amendment, the chain only exists for the first job. Stub registry rows that exist *only* to back-fill unpinned legacy citations evaporate once the citations are rewritten with sentinels. The 3B example makes this concrete and correct.

### 5. The cost-to-benefit story is honest

No new tables. No new file conventions beyond optional sidecar fields. No breaking change to existing pinned citations -- they keep resolving exactly as they do today. The amendment is a relaxation plus a sidecar, not a rewrite. This is the kind of change that should ship.

## What needs to be closed before this is approved

### A. Sentinel laundering is a real loophole

The amendment trusts the author to update sentinels honestly: when `chapter_title` drifts in current edition, the author either updates the sentinel (because content is equivalent and only the title changed) or pins to the previous edition (because content materially changed). That trust is correct in principle, but the mechanism does nothing to detect the failure mode where an author updates a sentinel *without* re-reading the chapter to confirm content equivalence. They have silently laundered a content change into "matches current."

The right thing: when a sentinel field is modified in the same commit as a registry edition advance for the cited slug, the validator emits a NOTICE marking those citations as "sentinel updated against new edition -- reviewer should confirm content equivalence." Cost: one git-aware check. Benefit: closes the only path by which optional pinning can silently corrupt the citation graph. Worth doing.

### B. Path grammar disambiguation

Line 38: `airboss-ref:handbooks/<slug>[/<edition>]/<chapter>...`

The bracket notation is fine for a human reader, but a parser needs a tie-breaker when `<edition>` and `<chapter>` could both syntactically match the next path segment (e.g., a chapter literally named `3C`, or a future handbook whose chapters use letter suffixes). The amendment should pin the disambiguation rule explicitly: **the segment immediately following `<slug>` is matched against the registry's known editions for that slug; if it is a known edition, treat it as the edition pin and consume it; otherwise treat it as the start of the chapter locator.** One sentence in the amendment, deterministic resolver behavior.

### C. Implementation step 8 hides a flag day

> 8. Legacy `source:` graduates from WARNING to ERROR; the field is removed from the schema.

This step is a flag day across `course/knowledge/`. It only fires correctly if step 7's review queue is fully drained. The amendment should make that explicit and require step 8 to be its own commit, so the failure mode (residual unmigrated citations) is obvious in a single revertable change rather than buried in a larger PR. The right thing is to spell out the gating: step 8 ships only after step 7's review queue closes with zero residual legacy citations, and step 8's PR description quotes that count.

## Answers to the open questions

The CLAUDE.md rule is "no undecided considerations for future work." Here are the answers, applying the *do it right* test rather than the *what's cheapest* test.

### Q1. Sentinel field naming -- flat or nested under `expect:`?

**Answer: flat, with a fixed canonical vocabulary committed in this amendment.**

Flat is more readable for hand-edit, and authors will hand-edit these constantly. But the right thing is to *also* commit the exact field names in the amendment so per-corpus resolvers don't each invent their own dialect. The canonical four for the first ship:

- `chapter_title` -- handbooks, AIM, ACs, AFH/PHAK
- `section_title` -- regs, ACs, AIM sub-sections
- `paragraph_text` -- regs paragraphs, AIM paragraphs (when sentinel is the prose itself)
- `page_heading` -- when locator is page-pinned and the page has a stable heading

New corpora propose additions in their corpus WP, not ad hoc. The validator rejects unknown sentinel field names with ERROR (typo defense).

### Q2. Migration risk for free-text legacy citations -- auto-rewrite or review queue?

**Answer: review queue. Always. Even when chapter titles match exactly.**

This is the question with the highest "do it right" stakes in the amendment. The migrator making a content-equivalence claim on the author's behalf is the same class of mistake as a stub: it looks fine for the 15 AFH citations we have today and it scales catastrophically when the next corpus has hundreds of legacy citations and the migrator silently rewrites them all. The friction of a one-time review queue is permanent safety; the friction of "auto-rewrite when titles match" is a permanent latent risk that surfaces the first time titles match across editions but content diverged.

Concrete mechanism: the migration script produces `course/knowledge/.migration-review.md` listing every legacy citation with its proposed rewrite, the matched sentinel value, and a checkbox. Author walks the list, ticks each box, commits. Migration is *not* applied until every box is ticked. For the AFH 3B set this is 15 lines and 15 ticks; for future corpora it scales with the work the author actually owes.

This is the right thing. Do it once, do it correctly, never wonder later whether a citation got auto-laundered.

### Q3. `?at=unpinned` -- deprecate, alias, or remove?

**Answer: remove outright in this amendment.**

Currently zero usages. Deprecation windows exist for things in the wild. Nothing is in the wild. The right thing is to delete the row from §1.5 in the same change that introduces optional editions, so authors learn one mechanism (omit the edition) instead of two (omit, or write `?at=unpinned`). Less surface, one fewer concept to explain in author docs, no orphan alias to grep for in 2027.

### Q4. Drift sentinels for non-handbook corpora -- ship handbooks first?

**Answer: yes, ship handbooks first, but commit the per-corpus sentinel vocabulary in this amendment.**

Implementing handbook drift sentinels first is correct (it is where the AFH 3B pressure is). But the right thing is to *not* ship handbook sentinels in a vacuum: this amendment should specify the sentinel field names for every corpus on the roadmap (per Q1's canonical list, expanded to cover regs, AIM, ACs, sectionals, ACS), even if only handbooks land working code. That pins the contract so the next corpus's WP does not relitigate naming. Implementations land per corpus WP; the design is settled here, once.

### Q5. No current edition for slug -- what does the validator do?

**Answer: ERROR, with a registry-aware hint.**

ERROR is correct (the citation cannot resolve). But "pin to a specific edition" without a hint is the kind of error message that makes authors grumble and burns time. The right thing is for the resolver to name the slug, list the most-recent superseded entries (up to 3), and tell the author the exact pin string they probably want:

```text
ERROR: airboss-ref:handbooks/some-handbook/3 has no current edition.
  All editions of `some-handbook` are superseded or retired.
  Most recent prior editions:
    - 8083-3B (superseded 2024-08-01)
    - 8083-3A (superseded 2018-04-15)
  To cite the most recent: airboss-ref:handbooks/some-handbook/8083-3B/3
```

Two extra lines in the resolver, large quality-of-life payoff, zero ongoing cost.

## Smaller items worth fixing inline

- **Implementation plan step ordering.** Steps 3 and 6 can parallelize per the amendment, but step 5 (citation renderer pulls titles from registry) depends on step 4 (frontmatter accepts the new shape). Make the dependency explicit so a parallel agent does not take 5 before 4 lands.
- **The "Why this isn't too complex" section is correct but undersold.** Add one line: "The validator already walks every `airboss-ref:` URI on every build; the marginal cost of a sentinel check is one map lookup per URI." That is the answer to the future reader who worries this scales poorly.
- **Drift NOTICE severity.** The amendment says NOTICE; confirm explicitly that NOTICE does not block the publish gate (§1.6 in v3) and is intended to surface in the build summary, not in CI failures. Otherwise an author could accidentally block a deploy on an unrelated drift.

## What this gets right that v3 didn't

ADR 019 v3 was a real rewrite and the load-bearing decisions were correct, but mandatory pinning across all precision levels was a single rule applied to two different problems. This amendment is the right kind of follow-up: it does not second-guess v3's spine (URI scheme, registry, lifecycle, supersedes chain, publish gate); it sharpens one rule that v3 over-applied. That is the discipline an ADR amendment should have.

## Recommendation

Land this amendment after:

1. Rewriting the Open Questions section to record the answers above (Q1-Q5) as decisions, not questions.
2. Adding the sentinel-laundering NOTICE rule (item A above).
3. Adding the path-grammar disambiguation sentence (item B).
4. Tightening implementation step 8 to a gated, single-commit flag day (item C).
5. Committing the per-corpus sentinel vocabulary inline (per Q1 + Q4), even though only handbooks ship working code first.

After those edits, this is approved. The architecture is right, the scope is honest, the safety property that mattered in v1 is preserved, and the friction that was hurting authoring goes away. Ship it.
