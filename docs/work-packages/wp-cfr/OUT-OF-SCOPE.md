---
title: 'Out of Scope: WP-CFR -- 14 CFR + 49 CFR seeded with section drill-down'
product: course
feature: wp-cfr
type: out-of-scope
status: unread
---

# Out of Scope: WP-CFR -- 14 CFR + 49 CFR seeded with section drill-down

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

The sources are the "Out of scope" sections of [spec.md](./spec.md) and [test-plan.md](./test-plan.md). WP-CFR shipped 11 CFR Part references (Title 14 + 49 Parts 830/1552) with 825 section rows total; the items below are everything the WP explicitly excluded.

## Summary

| Item                                             | Status   | Trigger to revisit                                                                                 |
| ------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------- |
| Search UI inside CFR drill-down                  | Deferred | When the flightbag search surface lands and can absorb a per-corpus search lens                    |
| Long-tail CFR-14 parts (~217 without YAML)       | Deferred | When citations or course content hit a part outside the launch set more than a handful of times    |
| Subpart / paragraph / subparagraph / clause rows | Deferred | When cited-by panels need finer granularity than `§part.section`                                   |
| Cross-corpus citation interop                    | Deferred | When reverse-citation panels expand to non-handbook corpora (e.g. AIM ¶1-1-3 cites §91.103)        |
| Annual eCFR diff job + edition supersession      | Deferred | When the second annual edition lands and the rolling-edition approximation is no longer sufficient |
| Cross-edition supersession test (test-plan)      | Deferred | When the annual eCFR diff job lands and a multi-edition seed needs regression coverage             |
| Citation deep-link interop test (test-plan)      | Deferred | When the cross-corpus citation interop ships and needs test coverage                               |

## Search UI inside CFR drill-down

Status: Deferred

What was deferred:
A search-first reader UX inside the CFR drill-down (e.g. `/library/cfr/14/91?q=preflight`). The launch read path is the flat per-Part section list with click-through to a section body; there's no query input, no full-text index, no result ranking.

Why:
Per [spec.md](./spec.md) "No search UI" decision and the "Out of scope" line: "library-completeness §3.B ratified 'search-first inside CFR drill-down', but search is a separate concern. This WP just gets the rows + bodies into the DB. The flat section list per Part is the read path; a future WP layers search on top." Author-time the row + body landing is independent of any search surface; bundling search would inflate the WP.

Trigger to revisit:
When the flightbag search surface lands and can absorb a per-corpus search lens. Concretely: when the cross-corpus search component supports a `corpus: cfr` scope, extend it then rather than build a CFR-specific search page.

Implementation pattern when triggered:
Follow whatever per-corpus search pattern flightbag standardises on. The 825 `reference_section` rows already carry `content_md` and `code` / `title` fields; a full-text index over them is the data side. If the trigger fires before flightbag lands the cross-corpus pattern, do not build a CFR-specific page -- revisit the prerequisite first.

References:

- [spec.md](./spec.md) -- "Out of scope" line 1 and the "No search UI" decision
- `library-completeness §3.B` -- the original ratification of "search-first inside CFR drill-down"
- `apps/flightbag/` -- the planned home for cross-corpus search (per CLAUDE.md "Monorepo")

## Long-tail CFR-14 parts (~217 without YAML)

Status: Deferred

What was deferred:
Auto-creating `study.reference` rows for the ~217 CFR-14 parts that have no row in `course/references/cfr-titles.yaml` (Parts 33, 27, etc.). The seeder skips these silently per the spec's "skip rule for missing DB rows."

Why:
Per [spec.md](./spec.md) "Skip rule for missing DB rows" decision and the "Out of scope" line: "Auto-creating reference rows for the long-tail (Parts 33, 27, etc.) is explicitly out of scope -- those are regulator-facing rules pilots almost never cite." The launch set (Parts 1/14/23/61/68/71/73/91/135/141 + 49/830 + 49/1552) covers the major pilot-facing surface; the long tail is mostly manufacturer / certification / equipment rules.

Trigger to revisit:
When citations or course content reference a part outside the launch set more than a handful of times. Concretely: when a knowledge node or course step writes `cite('cfr', '14', '33', ...)` (or similar long-tail part), surface the unindexed-part log line for a decision rather than silently skipping.

Implementation pattern when triggered:
Add the needed long-tail Parts to `course/references/cfr-titles.yaml` one by one (or as a small batch) following the slug shape `<title>cfr<part>`. The seeder already handles the new rows -- no adapter change needed. Body files for the new Parts must be produced by `bun run sources register cfr` for the relevant edition before reseeding.

References:

- [spec.md](./spec.md) -- "Out of scope" line 2; the "Skip rule for missing DB rows" decision; `library-completeness §3.A`
- `course/references/cfr-titles.yaml` -- where new rows land
- `libs/bc/study/src/seeders/cfr.ts` -- the seeder that already handles new YAML rows

## Subpart / paragraph / subparagraph / clause rows

Status: Deferred

What was deferred:
`reference_section` rows below the section level. The spec's `section_schema` declares six levels (`part / subpart / section / paragraph / subparagraph / clause`) but the seeder writes only the `section` level (depth 0, parent_id null). Subpart rows are skipped as grouping constructs; paragraph and finer rows are deferred entirely.

Why:
Per [spec.md](./spec.md) "Row laydown" decision and the "Out of scope" line: "Section is the citable unit for now; finer granularity lands in a follow-up if cited-by panels demand it." Paragraphs are addressed inline within the section body via `(b)(1)(i)` notation -- splitting them into separate rows only earns its cost when the citation BC needs to deep-link locator-level (e.g. `§91.103(b)(1)`).

Trigger to revisit:
When cited-by panels need finer granularity than `§part.section`. Concretely: when a citation chip writes `cite('cfr', '14', '91', '103', 'b', '1')` and the renderer needs paragraph rows to resolve it; or when the cited-by panel on `§91.103` needs to show which knowledge nodes / course steps cite specific paragraphs.

Implementation pattern when triggered:
The `section_schema` already declares the six levels with `strict_sequence: false`. Extend the seeder (`libs/bc/study/src/seeders/cfr.ts`) to parse paragraph structure out of the section body markdown (the `(a)(1)(i)` headings are deterministic) and lay down child `reference_section` rows at level `'paragraph'` etc., with `parent_id` set to the section row. Mirror the handbook section-tree depth handling for the recursive insert.

References:

- [spec.md](./spec.md) -- "Out of scope" line 3; the "Row laydown" decision
- `libs/bc/study/src/seeders/cfr.ts` -- the seeder that owns this expansion
- The handbook section-tree depth handling (closest shipped multi-depth pattern)

## Cross-corpus citation interop

Status: Deferred

What was deferred:
Reverse-citation panels that surface non-handbook corpora references on a CFR section page (e.g. on `§91.103`, surface "AIM ¶1-1-3 cites this section"). The launch ships handbook-to-CFR reverse-citation; corpus pairs like AIM-to-CFR or AC-to-CFR are out of scope.

Why:
Per [spec.md](./spec.md) "Out of scope" line 4: "Lands when reverse-citation panels expand to non-handbook corpora." The reverse-citation panel infrastructure currently handles the handbook -> CFR pair; expanding it to AIM / AC / CC and other corpora is a citation-BC concern that doesn't share scope with the seed adapter work.

Trigger to revisit:
When reverse-citation panels expand to non-handbook corpora. Concretely: when the same panel component that surfaces "AC X interprets this section" or "AIM ¶Y cites this section" lands, the CFR side is data-side ready (the section rows exist).

Implementation pattern when triggered:
Follow the existing handbook reverse-citation panel pattern. The CFR `reference_section` rows already exist with `code` / `title` / `content_md` populated; the citation BC just needs `cfr` added to its reverse-resolver set. No CFR-side adapter change needed.

References:

- [spec.md](./spec.md) -- "Out of scope" line 4
- The handbook reverse-citation panel (closest shipped pattern)
- [test-plan.md](./test-plan.md) -- "Out of scope" line 3 (citation deep-link interop), the test-side mirror of this item

## Annual eCFR diff job + edition supersession

Status: Deferred

What was deferred:
The annual eCFR diff job described in ADR 019, plus edition-supersession plumbing for CFR. WP-CFR ships a single rolling edition (`current`); when the 2027 edition lands, there's no automated diff workflow to compute what changed, and no mechanism to mark the 2026 edition as superseded while preserving deep-links into it.

Why:
Per [spec.md](./spec.md) "Out of scope" line 5: "The existing single-edition seed is enough for launch; ADR 019's annual-diff plumbing is a future operator workflow." Annual edition turnover is an operator workflow; the launch set is a snapshot. The complexity of supporting multiple editions side-by-side (route shape, slug resolution, reader UI) only earns its cost when the second edition lands.

Trigger to revisit:
When the second annual edition lands and the rolling-edition approximation (`edition: 'current'`) is no longer sufficient -- i.e. when the FAA publishes the 2027 eCFR and learners need to read either edition by deep-link.

Implementation pattern when triggered:
Follow ADR 019's annual-diff plumbing. The existing seed adapter at `libs/bc/study/src/seeders/cfr.ts` is edition-aware via the manifest's `editionSlug` / `editionDate` fields; the operator workflow scripts under `scripts/sources/` need a diff command, and the route shape `/library/cfr/<title>/<part>` needs to accept an explicit edition param for non-current editions.

References:

- [spec.md](./spec.md) -- "Out of scope" line 5
- [ADR 019](../../decisions/019-airboss-ref-uri-scheme/decision.md) -- the annual-diff plumbing plan
- [test-plan.md](./test-plan.md) -- "Out of scope" line 2 (cross-edition supersession test), the test-side mirror of this item
