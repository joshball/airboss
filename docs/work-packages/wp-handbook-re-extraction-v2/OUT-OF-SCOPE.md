---
title: 'Out of Scope: WP-HANDBOOK-RE-EXTRACTION-V2'
product: hangar
feature: wp-handbook-re-extraction-v2
type: out-of-scope
status: unread
---

# Out of Scope: WP-HANDBOOK-RE-EXTRACTION-V2

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                                       | Status       | Trigger to revisit                                                        |
| ---------------------------------------------------------- | ------------ | ------------------------------------------------------------------------- |
| OCR re-pass on original PDFs                               | Rejected     | Never -- see detail below                                                 |
| 12 link-only ACs full ingestion                            | Follow-on WP | When WP-AC-FULL is scheduled                                              |
| Bucket C reader UX work (prev/next, breadcrumbs, progress) | Follow-on WP | When the reader-UX backlog reaches Bucket C                               |
| Adding new corpora                                         | Rejected     | Never -- see detail below                                                 |
| Errata application                                         | Follow-on WP | Tracked in apply-errata-and-afh-mosaic; coordinated as pipelines converge |
| Full v2 emitter port for ACs                               | Follow-on WP | When AC content review demands v2 substrate parity                        |
| tips-mountain-flying re-extraction                         | Follow-on WP | When body_override pipeline is ported to chapter-aware (WP-EXTRAS-RETIRE) |
| Re-extracting prompt-strategy handbooks                    | Deferred     | When a handbook using `section_strategy: prompt` needs re-extraction      |
| PHAK 668 `toc-verify` warnings                             | Deferred     | When a future WP revisits parser-instrumentation triage                   |

## OCR re-pass on original PDFs

Status: Rejected

What was rejected:

A full re-OCR of the source PDFs in the developer cache (per ADR 018) to
replace the extractor's existing text output.

Why:

The user reports (front matter missing, raw HTML tables, OCR letter-shape
leakage, empty sections, opaque warning counts) all root in the structural
and table-conversion layers above the OCR text -- not in the OCR text
itself. Re-OCR would multiply cost without addressing any of the six
concrete bugs that motivated this WP. The extractor's existing text output
is sufficient input; the fixes belong at the structure/table/figure-pairing
layers.

References:

- [spec.md](./spec.md) -- "Out of Scope (explicit)" item 1
- [ADR 018 -- Source artifact storage policy](../../decisions/018-source-artifact-storage-policy/decision.md)

## 12 link-only ACs full ingestion

Status: Follow-on WP

What was deferred:

Full content ingestion (manifest, sections, figures, warnings) for the 12
Advisory Circulars currently catalogued as link-only after Wave 6. These
ACs have catalogue rows in `study.reference` but no `reference_section`
rows and no on-disk derivative tree.

Why:

The link-only ACs were intentionally left link-only at Wave 6 to bound
that wave's scope. Their full ingestion is its own work package
(WP-AC-FULL), not a substrate problem this WP can solve. Mixing AC full
ingestion into the v2 substrate run would make Phase 2 PR review
intractable.

Trigger to revisit (Follow-on WP):

When WP-AC-FULL is scheduled. The trigger is product demand: a flightbag
reader use case or a study card citation that needs section-level
addressability into one of the 12 link-only ACs.

Implementation pattern when triggered:

Mirror the 9 promoted ACs that already ingest through `libs/sources/src/ac/ingest.ts`. Author WP-AC-FULL as its own spec; this WP's v2
emitter port for ACs (separately scoped as WP-AC-V2) is the natural
predecessor if substrate parity is required first.

References:

- [spec.md](./spec.md) -- "Out of Scope (explicit)" item 2 and "AC carve-out" in Phase 3
- Wave 6 AC promotion was the prior decision point that left these 12 link-only.

## Bucket C reader UX work (prev/next, breadcrumbs, reading-progress UI)

Status: Follow-on WP

What was deferred:

Reader-side navigation affordances on the flightbag app: prev/next chapter
arrows, breadcrumb chains, reading-progress indicators. These improve how a
reader moves through a handbook once the substrate is correct.

Why:

The reader-UX backlog has been split into buckets. Bucket A (the
already-shipping `fix/flightbag-reader-round-2` work) papers over the
substrate gaps this WP fixes. Bucket C is a distinct reader-UX surface and
ships on its own cadence. Bundling Bucket C into this WP would mix
substrate-data work with UI work and stretch review scope.

Trigger to revisit (Follow-on WP):

When the reader-UX backlog reaches Bucket C in its own scheduling. The
flightbag reader UX work in flight (e.g. wp-flightbag-reader-ux,
wp-flightbag-rich-reader) is the natural home.

Implementation pattern when triggered:

Author a Bucket C WP in `docs/work-packages/` parallel to
`wp-flightbag-reader-ux/`. The substrate this WP ships is sufficient input.

References:

- [spec.md](./spec.md) -- "Out of Scope (explicit)" item 3
- Active reader-UX work: [wp-flightbag-reader-ux/](../wp-flightbag-reader-ux/), [wp-flightbag-rich-reader/](../wp-flightbag-rich-reader/)

## Adding new corpora

Status: Rejected

What was rejected:

Ingesting additional corpora beyond what's already in the tree (e.g. new
FAA series, third-party manuals, or other regulatory bodies).

Why:

Wave 7 already shipped SAFO/InFO/CC/NTSB-ALJ. This WP's contract is "fix
what's already ingested," not "ingest more." Mixing new-corpus work in
would change the WP's shape from substrate-quality to corpus-coverage and
the success criteria would no longer apply. New corpora go through their
own ingestion work packages.

References:

- [spec.md](./spec.md) -- "Out of Scope (explicit)" item 4

## Errata application

Status: Follow-on WP

What was deferred:

Applying FAA-published errata to ingested handbook content (corrections to
known errors in the source PDFs that the FAA issues separately).

Why:

WP-APPLY-ERRATA is a separate, related work package that overlaps the
chapter-aware path. Both touch section bodies but at different lifecycle
points (re-extraction vs. correction overlay). Bundling them would
entangle two review surfaces.

Trigger to revisit (Follow-on WP):

When the errata pipeline (already authored as
`apply-errata-and-afh-mosaic`) needs to coordinate with the v2 substrate.
Pipeline conflicts will be resolved as they arise; neither blocks the
other.

Implementation pattern when triggered:

Follow [apply-errata-and-afh-mosaic/](../apply-errata-and-afh-mosaic/) for
the errata-side patterns. Use the same per-doc YAML registry in
`scripts/sources/config/handbooks/<slug>.yaml` for any errata-aware
configuration so the two pipelines share configuration locality.

References:

- [spec.md](./spec.md) -- "Out of Scope (explicit)" item 5 and "Risks"
- [apply-errata-and-afh-mosaic/](../apply-errata-and-afh-mosaic/)

## Full v2 emitter port for ACs

Status: Follow-on WP

What was deferred:

Porting figure-pairing, table conversion, OCR-leak detection,
empty-section policy, and front-matter capture into the AC ingest
pipeline at `libs/sources/src/ac/ingest.ts`. Phase 3 ships an AC
conformance shim only (`acManifestSchema` carries `warnings: []`, the AC
ingest writer writes a sibling empty `warnings.json`, the BC reader's
corpus dispatch handles AC references uniformly).

Why:

AC ingest is a separate TypeScript pipeline (not the Python handbook
extractor). The 9 promoted ACs already ship via that pipeline. Doing the
full v2 emitter port for ACs in this WP would double the surface, mix two
languages and two pipelines, and stretch Phase 1B / 1C reviews. The shim
preserves the data contract so the dashboard works uniformly; the v2
substrate parity is a follow-on.

Trigger to revisit (Follow-on WP):

When AC content review demands v2 substrate parity (e.g. an AC needs
markdown tables, front matter, or OCR-leak detection equivalent to the
handbook-side fixes), or when the 9 promoted ACs accumulate triage demand
in the WP-HANGAR-REFS dashboard.

Implementation pattern when triggered:

Author WP-AC-V2 as its own spec. Mirror the Python emitter changes from
Phase 1B and 1C of this WP, ported to TypeScript in
`libs/sources/src/ac/ingest.ts`. Re-use the shared schemas in
`libs/bc/study/src/manifest-validation.ts` (`HANDBOOK_MANIFEST_WARNING_CODES`,
`WP_FIXABLE_WARNING_CODES`) so the data contract stays single-sourced.

References:

- [spec.md](./spec.md) -- "Out of Scope (explicit)" item 6 and Phase 3 AC conformance shim
- `libs/sources/src/ac/ingest.ts`
- `libs/bc/study/src/manifest-validation.ts`

## tips-mountain-flying re-extraction

Status: Follow-on WP

What was deferred:

Re-extracting the `tips-mountain-flying` handbook against the v2
substrate. It currently lives in the `handbooks-extras` `body_override`
pipeline, not the chapter-aware registry.

Why:

The v2 substrate's per-doc YAML keys (`front_matter_page_range`,
`empty_section_policy`, etc.) live in the chapter-aware
`scripts/sources/config/handbooks/<slug>.yaml` registry. The
`body_override` pipeline doesn't consume those keys, so re-extracting
`tips-mountain-flying` through v2 would require porting it onto the
chapter-aware pipeline first.

Trigger to revisit (Follow-on WP):

When `wp-handbooks-extras-retire` ports the `body_override` pipeline onto
the chapter-aware pipeline. At that point `tips-mountain-flying` re-runs
through the v2 substrate like the other 7 handbooks.

Implementation pattern when triggered:

Follow [wp-handbooks-extras-retire/](../wp-handbooks-extras-retire/) for
the retirement path. After port, add a `tips-mountain-flying.yaml` entry
to `scripts/sources/config/handbooks/` with the per-doc keys this WP
introduced, then re-run the Phase 2 extractor.

References:

- [spec.md](./spec.md) -- "Strategy carve-out" in Phase 1 #7
- [wp-handbooks-extras-retire/](../wp-handbooks-extras-retire/)

## Re-extracting prompt-strategy handbooks

Status: Deferred

What was deferred:

Re-extracting any future handbook that uses `section_strategy: prompt`
(the paste-to-Claude flow per
[section-extraction-prompt-strategy.md](../../ingestion-pipeline/section-extraction-prompt-strategy.md)).

Why:

The `prompt` strategy is human-interactive: each section extraction
involves pasting into a fresh Claude session and reviewing the output. The
memory rule "run-llm-comparison.md is human-interactive, not a sub-agent
target" applies here. This WP's headless re-run shape (one PR per doc, no
human-in-the-loop per section) doesn't fit. No currently-ingested handbook
uses `prompt`, so this is a forward-looking carve-out.

Trigger to revisit (Deferred):

When a handbook using `section_strategy: prompt` is added to the registry
and needs re-extraction against the v2 substrate.

Implementation pattern when triggered:

Author a separate WP for the prompt-strategy re-extraction. Follow the
paste-to-Claude flow in
[section-extraction-prompt-strategy.md](../../ingestion-pipeline/section-extraction-prompt-strategy.md).
Use the same v2 emitter changes from Phase 1A/1B/1C, but plan the work
section-by-section with human review rather than as a single headless
re-run.

References:

- [spec.md](./spec.md) -- "Strategy carve-out" in Phase 1 #7
- [docs/ingestion-pipeline/section-extraction-prompt-strategy.md](../../ingestion-pipeline/section-extraction-prompt-strategy.md)

## PHAK 668 `toc-verify` warnings

Status: Deferred

What was deferred:

Fixing the 668 `toc-verify` warnings on PHAK (the TOC parser disagreed
with the body heading-fingerprint matcher).

Why:

`toc-verify` is classified as parser-instrumentation, not as a fixable v2
warning code (see Phase 1A and `WP_FIXABLE_WARNING_CODES` in
`libs/bc/study/src/manifest-validation.ts`). The signal is real but
doesn't fit any of the six v2 substrate improvements (front matter,
markdown tables, figure pairing, empty sections, OCR leak, warning
taxonomy). Including it in this WP's success criteria would conflate
substrate quality with TOC-parser quality, which are different concerns.
The warnings stay surfaced via the hangar dashboard for review.

Trigger to revisit (Deferred):

When a future WP revisits parser-instrumentation triage. The likely
trigger is either (a) the WP-HANGAR-REFS dashboard surfacing
`toc-verify` cardinality as a problem for human reviewers, or (b) a
content-correctness regression traceable to TOC/body fingerprint
disagreement.

Implementation pattern when triggered:

Author a separate WP scoped to the TOC parser and heading-fingerprint
matcher (likely in `tools/handbook-ingest/`). Re-use the warning-id
contract from Phase 1A so triage state persists across runs.

References:

- [spec.md](./spec.md) -- "Risks" and "Success criteria" (the parser-instrumentation carve-out)
- `WP_FIXABLE_WARNING_CODES` in `libs/bc/study/src/manifest-validation.ts`
