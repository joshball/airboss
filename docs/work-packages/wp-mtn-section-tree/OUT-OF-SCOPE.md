---
title: 'Out of Scope: WP-MTN -- promote Tips on Mountain Flying to section-tree'
product: course
feature: wp-mtn-section-tree
type: out-of-scope
status: unread
---

# Out of Scope: WP-MTN -- promote Tips on Mountain Flying to section-tree

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                                    | Status       | Trigger to revisit                                                                        |
| ------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------- |
| Other whole-doc handbooks (RMH, AIH, IFH, IPH)          | Follow-on WP | Each handbook ships its own WP per `whole-doc-promotion/research.md` sequencing           |
| Retire the `handbooks-extras` corpus                    | Deferred     | After all five whole-doc handbooks (RMH, AIH, IFH, IPH, mtn-tips) promote to section-tree |
| `handbooks-extras` `--whole-doc` ingest path            | Deferred     | When the four remaining whole-doc rows (RMH, AIH, IFH, IPH) each ship their promotion WP  |
| Citation-resolution changes                             | Rejected     | Never -- see detail below                                                                 |
| New hangar admin UI / new study reader UI               | Rejected     | Never -- see detail below                                                                 |
| New schema field / new manifest discriminator           | Rejected     | Never -- see detail below                                                                 |
| Python work in the ingest pipeline                      | Rejected     | Never -- see detail below                                                                 |
| PDF re-extraction of `faa-mtn-tips.pdf`                 | Rejected     | Never -- see detail below                                                                 |
| New YAML config or migration to `handbooks/<slug>.yaml` | Rejected     | Never -- see detail below                                                                 |

## Other whole-doc handbooks (RMH, AIH, IFH, IPH)

Status: Follow-on WP

What was deferred:
Promotion of the four other whole-doc handbooks (RMH, AIH, IFH, IPH) from flat
single-body cards to section-tree manifests. This WP touches only the mtn-tips
entry and only the TS ingest path.

Why:
Sequencing decision from
[`docs/.archive/work-packages/2026-05/whole-doc-promotion/research.md`](../../.archive/work-packages/2026-05/whole-doc-promotion/research.md).
mtn-tips is sequence position 1 -- the smallest of the five whole-doc handbooks,
chosen to validate the override-driven section-tree pattern before tackling the
larger handbooks. The four remaining handbooks each warrant their own WP because
they have their own quirks (PDF OCR quality, page-number availability, source
material structure) that need per-handbook scoping.

Trigger to revisit:
RMH ships first per the research doc; AIH, IFH, IPH follow in the order set by
the same research doc. Each gets its own WP author cycle.

Implementation pattern when triggered:
Mirror this WP. The reusable building blocks already shipped:

- `parseOverrideToSectionTree` parser in `libs/sources/src/handbooks-extras/section-tree-parser.ts`
- Section-tree branch in `libs/sources/src/handbooks-extras/ingest.ts`
- Existing `sectionTreeManifestSchema` from `libs/bc/study/src/manifest-validation.ts`

For PDF-driven handbooks (where OCR works), the AVWX YAML-driven Python ingest
path at `tools/handbook-ingest/` is the precedent instead of the
`handbooks-extras` override path.

References:

- [whole-doc-promotion/research.md](../../.archive/work-packages/2026-05/whole-doc-promotion/research.md) -- parent research doc with the sequencing
- [spec.md D2](./spec.md) -- decision keeping mtn-tips in `handbooks-extras` corpus
- [AVWX YAML](../../../scripts/sources/config/handbooks/avwx.yaml) -- Class C section-tree precedent (PDF-driven)

## Retire the `handbooks-extras` corpus

Status: Deferred

What was deferred:
Retirement of the `handbooks-extras` corpus entirely (rip-and-replace into the
per-handbook `handbooks/<slug>.yaml` configs that drive the Python ingest).

Why:
The research doc raised this as a cross-cutting finding, but the decision is
premature. The handbooks-extras path has four other consumers (RMH, AIH, IFH,
IPH) still on the whole-doc shape. Retiring the corpus would either require
extending the Python pipeline to honour `body_override` (a feature with one
consumer, mtn-tips) or leaving the four other rows stranded. The right time to
revisit is after all five whole-doc handbooks ship their promotion WPs, when
there's concrete data on whether the override-driven section-tree path is
reusable for any future scanned-pamphlet handbook or whether it remains a
single-consumer pattern.

Trigger to revisit:
After all four remaining whole-doc handbook promotion WPs (RMH, AIH, IFH, IPH)
land. At that point, the corpus either has zero whole-doc rows left (clear
retirement candidate) or some remain (corpus stays, retire on per-row basis).

Implementation pattern when triggered:
Open a platform-level WP (not a per-handbook WP) titled
`wp-handbooks-extras-retirement` once the trigger fires. The WP would:

- Audit remaining `handbooks-extras` rows.
- Decide per-row: migrate to `handbooks/<slug>.yaml` (Python pipeline) or drop entirely.
- Update `libs/sources/src/handbooks-extras/ingest.ts` consumers.

References:

- [spec.md D2](./spec.md) -- decision deferring the retirement question
- [whole-doc-promotion/research.md](../../.archive/work-packages/2026-05/whole-doc-promotion/research.md) -- "Cross-cutting findings" raised this
- [handbooks-extras ingest](../../../libs/sources/src/handbooks-extras/ingest.ts)

## `handbooks-extras` `--whole-doc` ingest path

Status: Deferred

What was deferred:
Removal of the existing whole-doc ingest branch in
`libs/sources/src/handbooks-extras/ingest.ts`. The branch stays alongside the
new section-tree branch added by this WP.

Why:
Four other handbooks-extras rows (RMH, AIH, IFH, IPH) still depend on the
whole-doc path. Rip-and-replace would strand them. Removal is the natural
consequence of each row's promotion WP, not a separate task.

Trigger to revisit:
When the last of the four remaining whole-doc rows (RMH, AIH, IFH, IPH) ships
its promotion WP and no consumer of the whole-doc branch remains.

Implementation pattern when triggered:
Delete the whole-doc branch in `libs/sources/src/handbooks-extras/ingest.ts`;
the section-tree branch becomes the only path. Update unit tests in
`libs/sources/src/handbooks-extras/ingest.test.ts` to drop whole-doc fixtures.
The cleanup is a small follow-on commit on whichever WP retires the last
whole-doc row.

References:

- [spec.md "Out of scope" bullet 3](./spec.md) -- decision deferring removal
- [handbooks-extras ingest](../../../libs/sources/src/handbooks-extras/ingest.ts)

## Citation-resolution changes

Status: Rejected

What was rejected:
Any modification to the citation resolver
(`libs/sources/src/handbooks/resolver.ts`) to support the promoted mtn-tips
section-tree.

Why:
The `handbooks` resolver already handles both shapes without modification. It
short-circuits to `manifest.body_path` for whole-doc references and falls back
to `manifestSectionForLocator` for sectioned references. The mtn-tips
reference id (`airboss-ref:handbooks/tips-mountain-flying/mtn-2003`) keeps
resolving as the chapter overview after promotion, and the new ids
(`.../mtn-2003/3`, `.../mtn-2003/3/2`) resolve via the existing fallback. No
code change is needed. Building one would be net-negative -- it would add a
branch for a case the resolver already handles.

References:

- [spec.md "Out of scope" bullet 4](./spec.md)
- [handbooks resolver](../../../libs/sources/src/handbooks/resolver.ts)

## New hangar admin UI / new study reader UI

Status: Rejected

What was rejected:
Any new hangar admin UI for managing the promoted mtn-tips manifest, or any new
study reader UI for the chapter drill-down.

Why:
The existing `/library/handbook/{slug}/{edition}/{chapter}/...` route already
renders any section-tree handbook (PHAK, AFH, AVWX all use it). mtn-tips lands
on the same route after promotion with no UI change. Hangar admin doesn't need
to know about manifest shape -- the seeder is idempotent and runs on
`db reset --force && db seed`. Building bespoke UI for this single WP would
duplicate functionality that already exists.

References:

- [spec.md "Out of scope" bullet 5](./spec.md)
- Existing route shape -- `/library/handbook/{slug}/{edition}/{chapter}/...`

## New schema field / new manifest discriminator

Status: Rejected

What was rejected:
Introduction of a new schema field, or a new "section-tree-from-override"
manifest discriminator distinct from the existing `kind: 'handbook'`.

Why:
Decision D1 in the spec. mtn-tips becomes a Class C section-tree handbook in
the same shape as AVWX. The existing depth-3 schema
(`chapter` / `section` / `subsection`) is reused unchanged; mtn-tips only
populates depth 1 and 2. The existing `sectionTreeManifestSchema` from
`libs/bc/study/src/manifest-validation.ts` validates the new manifest
verbatim. Differentiating buys nothing and creates a parallel-schema
maintenance burden.

References:

- [spec.md D1](./spec.md) -- "Manifest shape: existing `kind: 'handbook'` (section-tree)"
- [manifest-validation](../../../libs/bc/study/src/manifest-validation.ts)

## Python work in the ingest pipeline

Status: Rejected

What was rejected:
Extending the Python ingest pipeline (`tools/handbook-ingest/`) to honour
`body_override`, or moving mtn-tips's ingest into the Python path.

Why:
Decision D2 in the spec. The Python pipeline exists to extract markdown from
PDFs. mtn-tips bypasses the PDF entirely (OCR on the 1999 pamphlet is
unusable, hence the override). Adding `body_override` honouring to the Python
pipeline would be a feature with one consumer. The existing TS ingest at
`libs/sources/src/handbooks-extras/ingest.ts` already reads `body_override`;
extending it (one TS module + tests, no Python) is the smaller and clearer
path.

References:

- [spec.md D2](./spec.md) -- "Stay in `handbooks-extras` corpus, do NOT migrate"
- [tools/handbook-ingest/](../../../tools/handbook-ingest/) -- the Python pipeline this WP intentionally avoids

## PDF re-extraction of `faa-mtn-tips.pdf`

Status: Rejected

What was rejected:
Re-running OCR / PDF extraction on
`~/Documents/airboss-handbook-cache/handbooks/faa-mtn-tips/faa-mtn-tips.pdf`
to produce the chapter / section structure programmatically.

Why:
The override exists in the first place because the PDF's OCR is unusable
(noted in the spec under "Source"). The 1999 pamphlet's scan quality does not
support reliable extraction. The hand-curated override is the authoritative
text; the WP's promotion path is markdown-to-manifest, not PDF-to-manifest.

References:

- [spec.md "Source"](./spec.md) -- "OCR unusable -- the override exists because of this"
- Cache PDF -- `~/Documents/airboss-handbook-cache/handbooks/faa-mtn-tips/faa-mtn-tips.pdf`

## New YAML config or migration to `handbooks/<slug>.yaml`

Status: Rejected

What was rejected:
Moving the mtn-tips YAML row out of `scripts/sources/config/handbooks-extras.yaml`
into a new `scripts/sources/config/handbooks/faa-mtn-tips.yaml` (alongside
avwx.yaml / phak.yaml / afh.yaml).

Why:
Decision D2 in the spec. The `handbooks/<slug>.yaml` configs drive the Python
ingest pipeline. Moving mtn-tips there would require either extending Python to
honour `body_override` (rejected above) or leaving mtn-tips as a "config row
exists but Python pipeline does nothing" stub. Keeping the row in
`handbooks-extras.yaml` with the existing TS ingest path is the cleanest
solution.

References:

- [spec.md D2](./spec.md) -- "Stay in `handbooks-extras` corpus"
- [handbooks-extras.yaml](../../../scripts/sources/config/handbooks-extras.yaml)
