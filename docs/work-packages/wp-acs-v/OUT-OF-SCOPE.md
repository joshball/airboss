---
title: 'Out of Scope: WP-ACS-V'
product: course
feature: wp-acs-v
type: out-of-scope
status: unread
---

# Out of Scope: WP-ACS-V

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

The source is the "Out of scope" section of [spec.md](./spec.md). The deeper rationale lives in [docs/work-packages/library-completeness/spec.md](../library-completeness/spec.md) (the parent sequence) and [ADR 019](../../decisions/019-reference-identifier-system/decision.md) (annual diff plumbing).

## Summary

| Item                                             | Status       | Trigger to revisit                                                  |
| ------------------------------------------------ | ------------ | ------------------------------------------------------------------- |
| `cfii-airplane-pts-9e` (Flight Instructor Inst.) | Follow-on WP | `wp-acs-link-only-pipeline` ships stage-1 stubs                     |
| `faa-g-acs-2-companion-guide` (ACS Companion)    | Follow-on WP | `wp-acs-link-only-pipeline` ships stage-1 stubs                     |
| CFI ACS element extraction                       | Deferred     | When a citation needs a specific CFI ACS element row as anchor      |
| Element bodies (markdown content per element)    | Deferred     | When cited-by panels need per-element body content                  |
| Cross-edition supersession                       | Deferred     | When the FAA publishes a real new edition of any seeded ACS         |
| Per-element metadata (knowledge node mapping)    | Follow-on WP | `cert-syllabus-and-goal-composer` owns the syllabus_node link layer |

## `cfii-airplane-pts-9e` (Flight Instructor Instrument PTS)

Status: Follow-on WP

What was postponed:
A full task / element drill-down for the CFII PTS publication. It is listed in `course/references/acs-pts.yaml` with `kind: pts` and is not an ACS document; the on-disk manifest set this WP processes does not include it.

Why:
Per [spec.md](./spec.md) Out of scope: the CFII PTS has a different shape (Practical Test Standards, pre-ACS) than the ACS publications this WP handles. Bundling a different-shaped publication into the ACS adapter would force the adapter to fork by `kind`. Per the project's "stays link-only" pattern, the CFII PTS keeps the existing `url:` field that lets citation chips deep-link to the FAA PDF.

Trigger that fires the follow-on:
The follow-on is the `wp-acs-link-only-pipeline` WP (currently `in-flight` at [docs/work-packages/wp-acs-link-only-pipeline/spec.md](../wp-acs-link-only-pipeline/spec.md)). It ships stage-1 (Sourced) stubs for the CFII PTS and the ACS Companion Guide, both of which already carry `url:` fields. If a future trigger demands full task / element rows, a separate WP would land them via either a PTS-specific adapter or a generalisation of the ACS adapter.

Implementation pattern when triggered:
For stage-1 stubs: see `wp-acs-link-only-pipeline`. For full extraction (if ever): mirror this WP's pattern -- ingest a PTS manifest into the cache, add a `kind: 'pts'` discriminator to `manifestSchema`, write a `seedPtsManifest` adapter, register it in the dispatcher.

References:

- [spec.md](./spec.md) Out of scope
- [docs/work-packages/wp-acs-link-only-pipeline/spec.md](../wp-acs-link-only-pipeline/spec.md)
- `course/references/acs-pts.yaml` (the YAML row)

## `faa-g-acs-2-companion-guide` (ACS Companion Guide for Pilots)

Status: Follow-on WP

What was postponed:
A full chapter / section drill-down for the ACS Companion Guide. Listed in `course/references/acs-pts.yaml` with `kind: other`; the FAA publishes it as a guide rather than a per-cert ACS. No on-disk manifest exists.

Why:
Per [spec.md](./spec.md) Out of scope: the Companion Guide is not a per-cert ACS; its structure does not fit the publication / area / task / element shape this WP encodes. It stays link-only.

Trigger that fires the follow-on:
The follow-on is the `wp-acs-link-only-pipeline` WP (currently `in-flight`), which ships stage-1 stubs. If a future trigger demands full content rendering, a guide-specific adapter would land it.

Implementation pattern when triggered:
For stage-1 stubs: see `wp-acs-link-only-pipeline`. For full extraction: ingest the guide PDF, choose an appropriate manifest shape (likely chapter / section / subsection like the handbook adapter), and add a `kind: 'guide'` discriminator. Mirror handbook ingestion patterns rather than this WP's ACS pattern, since the structure is closer to a handbook than an ACS.

References:

- [spec.md](./spec.md) Out of scope
- [docs/work-packages/wp-acs-link-only-pipeline/spec.md](../wp-acs-link-only-pipeline/spec.md)
- `course/references/acs-pts.yaml` (the YAML row)

## CFI ACS element extraction

Status: Deferred

What was deferred:
Per-element rows for the CFI ACS (`cfi-airplane-acs-25`). The on-disk `cfi-airplane-acs-25/manifest.json` lists 0 elements per task because the FAA's CFI ACS PDF text doesn't carry the K/R/S code prefixes the body parser keys off. The body parser at `libs/sources/src/acs/ingest.ts` works fine; the source data simply lacks the structural markers.

Why:
Per [spec.md](./spec.md) Out of scope: this is a data-quality gap, not a code gap. The seeder treats the empty `elements: []` arrays as a normal data fact. A future ingest tweak (heuristic detection of element prose) or a manual annotation pass could add elements; both are out-of-scope for the spec'd extraction.

Trigger to revisit:
A citation needs a specific CFI ACS element as its anchor (e.g., a knowledge node in the cert-syllabus syllabus tree wants to link to `CFI.II.A.K1` directly), AND the task-level row is too coarse. Until a real citation surfaces this gap, the gap stays.

Implementation pattern when triggered:
Two options: (a) extend the body parser in `libs/sources/src/acs/ingest.ts` to detect element prose without explicit code prefixes (likely a heuristic: bulleted list items inside a task body); (b) manual annotation -- author element rows directly into the manifest as an authoring overlay. Option (b) is faster for one-off citation needs; option (a) is correct if multiple citations need it.

References:

- [spec.md](./spec.md) Out of scope
- [spec.md](./spec.md) Source table (notes "0 elements" for CFI ACS)
- `libs/sources/src/acs/ingest.ts` (the body parser)

## Element bodies (markdown content per element)

Status: Deferred

What was deferred:
Per-element body markdown. ACS elements are short bullets within the task body (e.g. `PA.I.A.K1 Certification requirements, recent flight experience, and recordkeeping.`). Element rows exist as DB anchors for citation but carry no `content_md` -- the task body markdown is the read surface.

Why:
Per [spec.md](./spec.md) Out of scope: the task body already contains the element bullets inline. Splitting them into per-element `content_md` would duplicate content (the task body and the element body would both render the same prose) without adding value -- the user already reads the element when they read the task.

Trigger to revisit:
Cited-by panels (or another rendering surface) need to display per-element body content separately from the task body. Likely scenario: a knowledge node cites `PA.I.A.K1` and the renderer wants to embed only the element prose (not the whole task body) inline.

Implementation pattern when triggered:
Either (a) split the body parser to emit per-element bodies during ingest (a one-time cost, then idempotent), or (b) implement a render-time slicer that extracts the element bullet from the parent task body using the element code as anchor. Per the WP-CFR same call on CFR paragraphs, "leave them flat for now" is the stable default; revisit when the use case is concrete.

References:

- [spec.md](./spec.md) Out of scope
- WP-CFR (sibling WP that made the same "leave them flat" call on CFR paragraphs)

## Cross-edition supersession

Status: Deferred

What was deferred:
Edition chains for ACS publications. Each ACS slug maps to one publication; no `superseded_by` linkage between editions is seeded. ADR 019's annual-diff plumbing is left as future operator workflow.

Why:
Per [spec.md](./spec.md) Out of scope: with one edition seeded per publication and no real second edition having been published since this WP shipped, the supersession plumbing has no input data to test against. Adding it now is speculative.

Trigger to revisit:
The FAA publishes a real new edition of any seeded ACS publication (PPL, IR, CPL, CFI, ATP), AND citations / goal-pinning need the operator to choose between editions.

Implementation pattern when triggered:
Mirror ADR 019's annual-diff plumbing once a real edition delta exists. Per-publication: add a new `study.reference` row with the new edition designator, link the old row via `superseded_by_id`, re-ingest the new edition's manifest. Goal-pinning callers decide per-row whether they roll forward to the new edition or stay on the old.

References:

- [spec.md](./spec.md) Out of scope
- [ADR 019](../../decisions/019-reference-identifier-system/decision.md) (annual diff plumbing)
- [ADR 020](../../decisions/020-handbook-edition-and-amendment-policy.md) (edition vs errata semantics)

## Per-element metadata (knowledge node mapping)

Status: Follow-on WP

What was postponed:
The mapping layer that connects each ACS element row to the knowledge nodes that teach / assess it (e.g., `PA.V.A.K1` -> `node:steep-turn-bank-angle-relationship`). This WP ships the element rows as DB anchors; the connector layer is its own concern.

Why:
Per [spec.md](./spec.md) Out of scope: per-element metadata is the cert-syllabus WP's lane, not this one. Bundling it would conflate "the ACS publications are readable" (this WP) with "the syllabus tree links knowledge nodes to ACS leaves" (cert-syllabus).

Trigger that fires the follow-on:
The follow-on is the `cert-syllabus-and-goal-composer` WP (already shipped at [docs/work-packages/cert-syllabus-and-goal-composer/spec.md](../cert-syllabus-and-goal-composer/spec.md)). It owns the `syllabus_node` + `syllabus_node_link` layer that maps knowledge nodes to ACS leaves. The element rows this WP ships are the anchor surface those links resolve to.

Implementation pattern when triggered:
The cert-syllabus WP authors `syllabus_node` rows whose `airboss_ref` field points at the ACS element identifier (`airboss-ref:acs/<cert>/<edition>/area-<n>/task-<x>/element-<n>`). The `syllabus_node_link` rows then map each `syllabus_node` to one or more `knowledge_node` IDs.

References:

- [spec.md](./spec.md) Out of scope
- [docs/work-packages/cert-syllabus-and-goal-composer/spec.md](../cert-syllabus-and-goal-composer/spec.md)
- [ADR 019 §1.2](../../decisions/019-reference-identifier-system/decision.md) (acs corpus locator shape)
