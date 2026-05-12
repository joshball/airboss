---
title: 'Out of Scope: WP-IPH Section-Tree'
product: course
feature: wp-iph-section-tree
type: out-of-scope
status: unread
---

# Out of Scope: WP-IPH Section-Tree

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                         | Status       | Trigger to revisit                                               |
| -------------------------------------------- | ------------ | ---------------------------------------------------------------- |
| IPH errata flow                              | Deferred     | When the FAA publishes an errata for FAA-H-8083-16B              |
| Prompt-flow section extraction for IPH       | Rejected     | Never -- TOC strategy is sufficient given the standalone TOC PDF |
| Parallel handbooks (mtn-tips, AIH, RMH, IFH) | Follow-on WP | Each ships in its own peer WP; coordination via shared YAML      |

## IPH errata flow

Status: Deferred

What was deferred:
Wiring the IPH config (`scripts/sources/config/handbooks/iph.yaml`) with a
populated `errata` array and the corresponding `dismissed_errata` audit
trail. Today the WP ships with `errata: []` and `dismissed_errata: []`.

Why:
There is no FAA-published errata for FAA-H-8083-16B as of 2026-05-02.
Authoring an empty errata flow is busywork with no source signal to
validate against. The ingest pipeline already supports errata via the
AFH precedent, so no plumbing is missing -- just data.

Trigger to revisit:
When the FAA publishes an errata sheet for FAA-H-8083-16B (or a successor
edition). The signal is the appearance of an `Errata` PDF on the IPH
publisher index page, or an FAA-issued change notice.

Implementation pattern when triggered:
Mirror the AFH errata pattern at `scripts/sources/config/handbooks/afh.yaml`.
Add the errata entries to `iph.yaml`, re-run
`bun run sources extract handbooks iph --edition FAA-H-8083-16B`, and
the existing pipeline emits patched derivatives.

References:

- [spec.md](./spec.md) (in-scope: §"Out of scope" original bullet 1)
- [scripts/sources/config/handbooks/afh.yaml](../../../scripts/sources/config/handbooks/afh.yaml) (errata pattern)

## Prompt-flow section extraction for IPH

Status: Rejected

What was rejected:
Replacing the TOC-based section extraction strategy
(`section_strategy: toc`, pp. 12-16 of the whole-doc PDF) with the
prompt-flow strategy (paste chapter text to Claude for section detection).

Why:
The standalone `FAA-H-8083-16B_Table_of_Contents.pdf` carries full section
depth in dotted-leader format. The TOC parse fills every chapter, section,
and subsection row in `manifest.sections[]`. Prompt-flow exists to handle
handbooks where the TOC is missing, malformed, or doesn't reach subsection
depth. None of those conditions apply to IPH.

Re-decision bar:
The TOC PDF would need to disappear or become unreliable (e.g., a future
edition drops the printed TOC), OR a measurable subsection-detection
regression would need to surface (sections missing from the manifest that
exist in the body PDFs). Either is a high bar; default is "no."

References:

- [spec.md](./spec.md) §"Strategy summary" (TOC strategy rationale)
- [docs/ingestion-pipeline/section-extraction-strategies.md](../../ingestion-pipeline/section-extraction-strategies.md)
- [docs/ingestion-pipeline/section-extraction-prompt-strategy.md](../../ingestion-pipeline/section-extraction-prompt-strategy.md)

## Parallel handbooks (mtn-tips, AIH, RMH, IFH)

Status: Follow-on WP

What was deferred to follow-on WPs:
Promotion of the other whole-doc handbooks listed in handbooks-extras
(Mountain Flying Tips, Aeronautical Information Handbook, Risk Management
Handbook, Instrument Flying Handbook) to section-tree shape. These ran
in parallel to wp-iph-section-tree, each owning its own
`doc_id` in the shared `handbooks-extras.yaml` and `DOC_ID_TO_FRIENDLY`
map.

Why:
Each handbook is a separable scope: a YAML config, a TOC range, an
ancillary inventory, and a manifest-validation test. Bundling them
into one WP would slow the rebase / merge cadence and lose per-handbook
ownership. They share infrastructure (`chapter_plaintext.py`, the
ingest pipeline, the manifest schema), not implementation.

Trigger to spawn each follow-on:
Each follow-on WP is its own ship-when-needed item. Spawn when content
authoring on that handbook becomes active, or when the cited-by panel
on a citation surface needs the section-depth manifest for that handbook.

Implementation pattern when spawned:
Use this WP as the template. The shape is identical: author a YAML
config under `scripts/sources/config/handbooks/<slug>.yaml`, run
`bun run sources download` then `bun run sources extract`, remove the row
from `handbooks-extras.yaml` and the friendly maps in
`libs/sources/src/handbooks-extras/ingest.ts`, update the smoke-test
count, update REFERENCES.md.

References:

- [spec.md](./spec.md) (in-scope: §"Out of scope" original bullet 3)
- [tasks.md](./tasks.md) §"Coordination"
- [scripts/sources/config/handbooks-extras.yaml](../../../scripts/sources/config/handbooks-extras.yaml)
