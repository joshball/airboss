---
title: 'Out of Scope: WP-AIH -- Aviation Instructor''s Handbook section-tree promotion'
product: course
feature: wp-aih-section-tree
type: out-of-scope
status: unread
---

# Out of Scope: WP-AIH -- Aviation Instructor's Handbook section-tree promotion

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

The source is the "Out of scope" section of [spec.md](./spec.md), plus the "Decisions (taken at WP author time)" block that documents the L4/L5 flatten and bookmark-strategy choices.

## Summary

| Item                                                     | Status       | Trigger to revisit                                                                    |
| -------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------- |
| Errata application                                       | Deferred     | When FAA publishes an errata sheet for FAA-H-8083-9 (none as of 2026-05-03)           |
| Figure / table extraction beyond the default pipeline    | Rejected     | Never -- see detail below                                                             |
| Backfilling `handbooks-noningested.yaml` AIH placeholder | Follow-on WP | When the noningested-yaml retire WP runs (also requires FAA to publish FAA-H-8083-9B) |

## Errata application

Status: Deferred

What was deferred:
Wiring an errata application step into the AIH ingest. The YAML at `scripts/sources/config/handbooks/aviation-instructor.yaml` carries an empty `errata: []` placeholder, and the extraction pipeline does not currently consume it for this handbook because there are no errata to apply.

Why:
Per [spec.md](./spec.md) Out of scope line 1: "AIH has no published errata as of 2026-05-03; the `errata: []` placeholder in the YAML covers future amendments." Building errata application logic with no input data would be speculative; the placeholder reserves the shape so a future amendment slots in without a YAML reshape.

Trigger to revisit:
When FAA publishes an errata sheet for FAA-H-8083-9. Concretely, the FAA index page at <https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/aviation_instructors_handbook> gains an "Errata" link or the per-chapter PDFs are reissued with corrections.

Implementation pattern when triggered:
Mirror the errata handling already wired for the other chapter-aware handbooks (AFH, RMH, MTN-TIPS) -- populate `errata: [...]` in `scripts/sources/config/handbooks/aviation-instructor.yaml`, re-run `bun run sources extract handbooks aviation-instructor --edition FAA-H-8083-9`, the section bodies regenerate with the corrections folded in. The plugin at `tools/handbook-ingest/ingest/handbooks/aviation_instructor.py` already declares the addendum/errata patterns (per the WP touch list), so no plugin-side change is required for the first errata.

References:

- [spec.md](./spec.md) -- Out of scope line 1 + Touch list entry for the YAML
- `scripts/sources/config/handbooks/aviation-instructor.yaml` -- the `errata: []` placeholder
- `tools/handbook-ingest/ingest/handbooks/aviation_instructor.py` -- declared addendum / errata patterns

## Figure / table extraction beyond the default pipeline

Status: Rejected

What was rejected:
Custom figure / table extraction for AIH beyond what the shared `extract handbooks` pipeline already produces. The existing pipeline emits whatever figures and tables the section-tree extractor identifies; this WP does not extend it for AIH-specific shapes.

Why:
Per [spec.md](./spec.md) Out of scope line 2: figure / table extraction beyond the default is out of scope. AIH's content is text-dominant (instructional theory, learning psychology, lesson planning); figures are decorative diagrams rather than data-bearing tables. The default pipeline's coverage is sufficient for the use case (chapter / section drill-down on `/library`, citation deep-link to a section). Custom AIH-specific figure handling would add maintenance surface for marginal reading benefit.

Trigger to revisit:
Never. If a future content effort needs a specific AIH figure rendered with custom logic, that's a per-figure decision and a one-off extension of the shared pipeline, not a per-handbook fork. Don't extend this WP retroactively to absorb that work.

References:

- [spec.md](./spec.md) -- Out of scope line 2
- The shared `extract handbooks` pipeline (governs figure / table behavior across AFH, RMH, MTN-TIPS, and AIH uniformly)

## Backfilling `handbooks-noningested.yaml` AIH placeholder

Status: Follow-on WP

What was postponed:
Removing or updating the `aih + FAA-H-8083-9B` placeholder row in `course/references/handbooks-noningested.yaml`. That row points at a hypothetical revised edition (FAA-H-8083-9B) that FAA has not published. WP-AIH ships FAA-H-8083-9 (no revision letter) and leaves the noningested placeholder untouched.

Why:
Per [spec.md](./spec.md) Out of scope line 3: the placeholder targets a hypothetical revised edition. Removing it now would obscure the "we know this edition might come, here's its slot" signal for the noningested-yaml retire WP, which sweeps placeholder rows as a batch with consistent rules. Touching only the AIH row in this WP would fragment that sweep.

Trigger that fires the follow-on:
When the noningested-yaml retire WP runs. That WP is the place where the global rules for placeholder-row resolution get applied (drop, update, or leave with a sharper trigger). Concretely also: FAA publishing FAA-H-8083-9B reactivates the row -- it stops being a placeholder and becomes an ingest target on its own, separate from the retire sweep.

Implementation pattern when triggered:
For the FAA-publication path: spawn a small WP-AIH-9B that mirrors the WP-AIH phase shape (new edition entry in `scripts/sources/config/handbooks/aviation-instructor.yaml`, download, extract, register, seed, REFERENCES.md row update, drop the placeholder from `handbooks-noningested.yaml`). For the retire-WP path: follow whatever rules that WP establishes for placeholder rows that point at unpublished editions.

References:

- [spec.md](./spec.md) -- Out of scope line 3
- `course/references/handbooks-noningested.yaml` -- the placeholder row
- (future) the noningested-yaml retire WP -- not yet authored
