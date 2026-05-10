---
title: 'Out of Scope: Reference AIM ingestion'
product: course
feature: reference-aim-ingestion
type: out-of-scope
status: unread
---

# Out of Scope: Reference AIM ingestion

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

The source is the "Out of scope" section of [spec.md](./spec.md). This WP shipped via PR #252 (per the WP git log). The deferrals captured here remain live: each is a real boundary the WP drew at ship time, and any future "should AIM do X?" conversation reopens these items.

## Summary

| Item                                                          | Status       | Trigger to revisit                                                                                  |
| ------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------- |
| Live AIM source-document ingestion (PDF/HTML -> markdown)     | Follow-on WP | When the source-ingestion pipeline (follow-up to ADR 016 phase 0) is in flight                      |
| Per-glossary-term structured content lookup beyond the title  | Deferred     | When a renderer surface needs structured glossary fields (definition, see-also) for AIM PCG entries |
| Cross-edition aliases (renumbered AIM paragraphs)             | Deferred     | When the FAA renumbers an AIM paragraph between editions (rare; per-occurrence hand-add)            |
| Sub-paragraph identifiers (5-1-7-a-1)                         | Deferred     | When a learner / lesson author needs to deep-link to a lettered sub-paragraph                       |
| Full AIM catalog walk (real-tree ingestion, not just fixture) | Follow-on WP | When the source-ingestion pipeline lands AND an operator runs it against a real AIM derivative tree |

## Live AIM source-document ingestion (PDF / HTML -> markdown derivatives)

Status: Follow-on WP

What was postponed:
The operator pipeline that fetches the FAA's published AIM (PDF or HTML), extracts paragraph-level markdown, writes per-edition `manifest.json` + body files into `aim/<YYYY-MM>/`. This WP consumes those derivatives but does not produce them. Today the only content the WP exercises is the hand-authored fixture under `tests/fixtures/aim/aim-fixture/aim/2026-09/`.

Why:
Per [spec.md](./spec.md) Out of scope: "That's a separate operator pipeline -- a follow-up to ADR 016 phase 0 -- and not Phase 7's concern. Phase 7 consumes whatever derivatives the operator wrote." Bundling source ingestion into Phase 7 would conflate "register AIM in the corpus registry" with "build the AIM extraction pipeline." The two have different review criteria (registry shape vs PDF-extraction quality) and different cadences (registry is per-WP; extraction is per-FAA-publication).

Trigger that fires the follow-on:
The source-ingestion pipeline (follow-up to ADR 016 phase 0) is in flight. AIM's continuous-revision model (year-month editions; per-paragraph change pages) needs its own extraction pattern, distinct from the per-edition handbook pipeline. The trigger is either (a) the user authors a WP for the AIM extractor, or (b) a generalized source-ingestion pipeline lands and AIM is one of its first targets.

Implementation pattern when triggered:
Mirror the [handbook-ingestion-and-reader](../handbook-ingestion-and-reader/spec.md) Python pipeline shape: fetch the FAA AIM PDF / HTML, extract paragraph text via PyMuPDF or HTML-aware parsing, emit per-paragraph markdown + frontmatter into `aim/<YYYY-MM>/`. The WP this WP follows already wires the `bun run sources register aim --edition=<YYYY-MM>` call that consumes the resulting derivatives.

References:

- [spec.md](./spec.md) Out of scope -- "Live AIM source-document ingestion"
- [docs/decisions/016-cert-syllabus-goal-model/decision.md](../../decisions/016-cert-syllabus-goal-model/decision.md) phase 0 (handbook ingestion as the precedent)
- [handbook-ingestion-and-reader/spec.md](../handbook-ingestion-and-reader/spec.md) (the structural template)

## Per-glossary-term structured content lookup beyond the title

Status: Deferred

What was deferred:
A structured glossary surface for AIM Pilot/Controller Glossary entries that exposes more than `title + body markdown`. Specifically: a `definition` field separate from prose body, a `see-also` references list, a "category" tag (procedural / equipment / regulatory), and any other structured glossary metadata the renderer might want.

Why:
Per [spec.md](./spec.md) Out of scope: "Glossary entries get a `SourceEntry` (title + body markdown), but the renderer's structured glossary surface (definition, see-also references, etc.) is a follow-up." With no renderer surface that consumes structured glossary fields today, the storage shape is theoretical -- we don't know whether `see-also` is one column or a join table, whether `category` is an enum or freeform, or whether the renderer wants to filter by category.

Trigger to revisit:
A renderer surface (study-app glossary detail page, PCG-aware citation chip, AIM glossary index) explicitly needs structured fields beyond title + body. Concrete signal: a node citing `airboss-ref:aim/glossary/pilot-in-command` would render usefully if the page showed the definition and the cross-references separately, and the current title+body shape is visibly insufficient.

Implementation pattern when triggered:
Extend the `aim` resolver's `getIndexedContent(id, edition)` return shape to include the structured fields. Update the per-entry `manifestEntryForLocator` parsing to pull the new fields from the manifest. The manifest format itself extends additively -- new optional fields don't break the existing fixture or any consumer that reads only title + body.

References:

- [spec.md](./spec.md) Out of scope -- "Per-glossary-term content lookup beyond the title"

## Cross-edition aliases (renumbered AIM paragraphs)

Status: Deferred

What was deferred:
A per-paragraph alias mechanism that maps an old paragraph number to a new one when the FAA renumbers AIM paragraphs across editions. AIM revises paragraphs without renumbering routinely; if 2026-09 -> 2027-04 silently changes the text of 5-1-7, [spec.md](./spec.md) Phase 5's diff job catches it. If 2027-04 actually renumbers (rare; the FAA tries hard not to), an alias entry is added by hand at that time.

Why:
Per [spec.md](./spec.md) Out of scope: AIM renumbering is rare enough that a generalized alias system is over-investment. A per-occurrence hand-add to a small `aim/aliases.json` (or equivalent) is sufficient when the FAA actually does it.

Trigger to revisit:
The FAA renumbers an AIM paragraph between editions. The operator running the source-ingestion pipeline notices the renumbering (the diff job surfaces a paragraph that disappeared from one edition + a new paragraph that appeared in the next with similar content). At that point a hand-curated alias entry is added; the resolver picks it up.

Implementation pattern when triggered:
Add an optional `aim/aliases.json` (or extend the per-edition `manifest.json` with an `aliases` field) that maps `{ "old": "5-1-7", "new": "5-1-8", "edition_break": "2027-04" }`. The resolver checks aliases when a locator doesn't resolve in the requested edition; if an alias exists for `?at=<edition_break_or_later>`, the locator follows the alias chain. Unit tests exercise the alias resolution in both directions (citing the old number with `?at=` after the break should resolve to the new content).

References:

- [spec.md](./spec.md) Out of scope -- "Cross-edition aliases"
- [spec.md](./spec.md) Phase 5 diff job (the upstream signal that surfaces silent edits)

## Sub-paragraph identifiers (5-1-7-a-1)

Status: Deferred

What was deferred:
Locator support for lettered sub-paragraphs within an AIM paragraph (e.g., `aim/5-1-7-a-1` or `aim/5-1-7?sub=a.1`). The ADR 019 §1.2 "AIM" spec stops at paragraph granularity. AIM paragraphs occasionally use lettered sub-paragraphs internally; lessons that need to deep-link to one quote the paragraph and reference by content.

Why:
Per [spec.md](./spec.md) Out of scope: paragraph granularity is sufficient for the citation patterns observed today. Sub-paragraph identifiers add a level of granularity that requires a parser change, a citation-formatter change, a URL change, and a renderer change -- all to support a use case (deep-linking to "5-1-7(a)(1)") that hasn't surfaced. ADR 019 deliberately stops at paragraph for AIM.

Trigger to revisit:
A learner or lesson author needs to deep-link to a sub-paragraph AND quoting the paragraph text is not sufficient. Concrete signal: a lesson author writes a citation that requires the sub-paragraph specificity (e.g., a regulatory reference where the cited rule lives in a lettered sub-paragraph, not the paragraph as a whole) AND there's no cleaner alternative (such as citing the sub-paragraph by content excerpt).

Implementation pattern when triggered:
Extend `parseAimLocator` to accept the sub-paragraph suffix (consider `aim/<chapter>-<section>-<paragraph>(<letter>)(<digit>)` to mirror the FAA's own notation). Update `formatAimCitation` to render the sub-paragraph in canonical short / formal forms. Update `getAimLiveUrl` -- since the FAA does not deep-link individual paragraphs, the sub-paragraph still resolves to the doc-level URL today; this part may not need changes. Update the manifest schema to optionally enumerate sub-paragraphs per paragraph.

References:

- [spec.md](./spec.md) Out of scope -- "Sub-paragraph identifiers"
- [docs/decisions/019-reference-identifier-system/decision.md](../../decisions/019-reference-identifier-system/decision.md) §1.2 AIM (the ADR boundary at paragraph granularity)

## Full AIM catalog walk (real-tree ingestion, not just fixture)

Status: Follow-on WP

What was postponed:
A real ingest run against an actual AIM derivative tree (~1500 paragraphs across 11 chapters + glossary + appendices). This WP ships the resolver + ingest CLI + fixture-driven tests; the real-tree run is gated on the source-ingestion pipeline producing `aim/<YYYY-MM>/manifest.json` + body files.

Why:
Per [spec.md](./spec.md) Out of scope: "Phase 7 ships the resolver + fixture-driven tests. Real-tree ingestion happens once the source-ingestion pipeline lands and an operator runs it." Bundling the real-tree run into this WP would block Phase 7 on the source-ingestion pipeline (which is itself a separate WP -- see "Live AIM source-document ingestion" above).

Trigger that fires the follow-on:
The source-ingestion pipeline lands AND an operator (Joshua, today) runs it against the FAA AIM source. Output: `aim/<YYYY-MM>/manifest.json` + per-paragraph markdown body files. Then `bun run sources register aim --edition=<YYYY-MM>` registers them.

Implementation pattern when triggered:
The CLI is already wired (`bun run sources register aim [--edition=2026-09]`). Run it against the real derivative tree. Verify the registry populates with ~1500 entries. Spot-check a handful of citations (`airboss-ref:aim/5-1-7?at=2026-09`, `airboss-ref:aim/glossary/pilot-in-command?at=2026-09`) resolve correctly via the validator.

References:

- [spec.md](./spec.md) Out of scope -- "The full AIM catalog walk"
- [spec.md](./spec.md) Success Criteria (the CLI surface this real-tree run exercises)
