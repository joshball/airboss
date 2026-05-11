---
title: 'Out of Scope: WP-AIM -- AIM seeded as section-tree reference'
product: course
feature: wp-aim
type: out-of-scope
status: unread
---

# Out of Scope: WP-AIM -- AIM seeded as section-tree reference

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

The source is the "Out of scope" sections of [spec.md](./spec.md) and [test-plan.md](./test-plan.md), plus the "Pre-existing risk" note that documents the AIM resolver boundary this WP refused to cross.

## Summary

| Item                                            | Status       | Trigger to revisit                                                                                             |
| ----------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------- |
| AIM search UI                                   | Deferred     | When 745 entries stops browsing fine -- e.g. learner reports of "I can't find X in the AIM"                    |
| AIM figures / tables extraction beyond manifest | Rejected     | Never -- see detail below                                                                                      |
| Cross-references between AIM and CFR            | Follow-on WP | When WP-CFR ships                                                                                              |
| Cross-edition migration / mid-edition refresh   | Follow-on WP | When the next AIM 28-day cycle (2026-05 or later) needs to land alongside 2026-04 without a destructive reseed |

## AIM search UI

Status: Deferred

What was deferred:
A search input over the AIM corpus on `/library`. The WP ships AIM as a browsable card with chapter / section / paragraph drill-down only. The user navigates by clicking through the tree; there is no full-text or code-prefix search box.

Why:
Per [spec.md](./spec.md) Out of scope line 1 + [library-completeness](../library-completeness/spec.md) §3: the AIM is browsable because its 745 entries fit comfortably in a tree. CFR is search-first only because its 7,218 sections defeat browse. The cost / benefit doesn't favor a search UI for AIM at this scale.

Trigger to revisit:
When 745 entries stops browsing fine. Concrete signals: learner reports of "I can't find X in the AIM", a knowledge node that needs to land a citation chip into the AIM and the author can't reliably surface the right paragraph by browse, or a future AIM revision that crosses ~2,000 entries.

Implementation pattern when triggered:
Mirror the CFR search pattern (whatever WP-CFR ships). The AIM resolver, locator, and URL helpers at `libs/sources/src/aim/` already exist; the search UI plugs into the same `reference_section` rows the seed adapter writes. Likely a `/library/aim?q=...` route + a server load that runs the search and renders matching paragraphs with their parent-chain breadcrumb.

References:

- [spec.md](./spec.md) -- Out of scope line 1
- [library-completeness](../library-completeness/spec.md) §3 -- the browse-vs-search-first decision rule
- [test-plan.md](./test-plan.md) -- "Out of scope: Search UI (deferred per spec)"

## AIM figures / tables extraction beyond manifest

Status: Rejected

What was rejected:
Adding a custom figure / table extraction pass for AIM beyond what the existing extracted markdown in `aim/2026-04/` carries. The WP's seeder consumes the manifest and per-paragraph body files as-is.

Why:
Per [spec.md](./spec.md) Out of scope line 2: the existing extracted markdown is the source of truth. The AIM is text-dominant; figures embedded in the source PDFs are decorative or cross-referential rather than data-bearing. The current ingest captures what's needed for chapter / section / paragraph reading on `/library`.

Trigger to revisit:
Never. If a knowledge node or course step needs a specific AIM figure rendered with custom logic, that's a per-figure decision and a one-off extension to the existing AIM ingest at `libs/sources/src/aim/`, not a per-WP scope expansion. Don't extend WP-AIM retroactively to absorb that work.

References:

- [spec.md](./spec.md) -- Out of scope line 2
- `aim/2026-04/` -- the extracted markdown corpus that this WP treats as source of truth
- `libs/sources/src/aim/` -- the existing AIM source-side code (resolver / locator / citation / ingest) that owns any future figure-handling extension

## Cross-references between AIM and CFR

Status: Follow-on WP

What was postponed:
Bidirectional citation / deep-link wiring between AIM paragraphs and 14 CFR sections (e.g. AIM 5-1-3 referencing 91.103, or 91.103's "preflight action" landing a chip back into AIM). The WP ships AIM as a self-contained section tree; cross-corpus interop with CFR waits.

Why:
Per [spec.md](./spec.md) Out of scope line 3 + [test-plan.md](./test-plan.md) "Citation deep-link interop with WP-CFR (lands when CFR ships)": the AIM and CFR cite each other heavily, but CFR is not yet seeded as a section tree -- there are no `reference_section` rows on the CFR side to link into. The interop is gated on WP-CFR landing first.

Trigger that fires the follow-on:
When WP-CFR ships and writes `reference_section` rows for 14 CFR. Once both sides have section rows, the citation BC's `aim` and `cfr` resolvers can be extended to surface bidirectional chips.

Implementation pattern when triggered:
Extend the `aim` and `cfr` resolvers (under `libs/sources/src/aim/` and `libs/sources/src/cfr/` respectively, or wherever WP-CFR lands the resolver). The pattern mirrors the existing handbook-to-reg cross-reference shape (FAR / handbook locator resolution). A small shared helper reads citation chip targets from one corpus and looks up the matching section row in the other; the rendered chip carries both the source label (e.g. "AIM 5-1-3") and the target deep-link.

References:

- [spec.md](./spec.md) -- Out of scope line 3
- [test-plan.md](./test-plan.md) -- "Citation deep-link interop with WP-CFR"
- (future) WP-CFR -- the prerequisite that lands the CFR section rows
- `libs/sources/src/aim/` -- the AIM source-side code (resolver / locator / citation already exist; ready to extend)

## Cross-edition migration / mid-edition refresh

Status: Follow-on WP

What was postponed:
Wiring a mid-edition refresh path so a new AIM edition (every 28 days) can land alongside the current `2026-04` edition without requiring a destructive `db reset --force`. The WP ships only the `2026-04` edition; subsequent editions would currently land via reseed.

Why:
Per [spec.md](./spec.md) Out of scope line 4 + [test-plan.md](./test-plan.md) "Cross-edition refresh": the AIM publishes every 28 days, which is the highest churn frequency of any of the corpora WP-AIM touches. A clean cross-edition story (parallel rows for `2026-04` and `2026-05`, deep-link cutover, citation re-resolution against the newer edition where appropriate) is its own design problem worth a dedicated WP rather than being inlined here.

Trigger that fires the follow-on:
When the next AIM 28-day cycle (2026-05 or later) needs to land alongside `2026-04` without a destructive reseed. Concrete signal: the user requests a new AIM edition and the answer "you have to wipe and reseed" becomes unacceptable (e.g. citations to `2026-04` need to keep resolving while authors transition to `2026-05`).

Implementation pattern when triggered:
Spawn a WP-AIM-MULTI-EDITION (or similar) that defines the multi-edition story across the AIM. Touch points likely include: a `current_edition` flag on `study.reference`, edition-aware routing on `/library/aim/...`, citation resolver behavior for legacy editions, and the seeder's idempotency story across editions. Mirror whatever cross-edition pattern WP-CFR or WP-AC-PROMOTE establishes (CFR amends every 6 months and may face the same problem first).

References:

- [spec.md](./spec.md) -- Out of scope line 4
- [test-plan.md](./test-plan.md) -- "Cross-edition refresh"
- `aim/2026-04/manifest.json` -- the per-edition layout the seeder consumes today (single-edition assumption baked into `CORPUS_DIRS` walk)
