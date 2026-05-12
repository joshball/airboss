---
title: 'Out of Scope: Chapter source ingestion'
product: platform
feature: chapter-source-ingestion
type: out-of-scope
status: unread
---

# Out of Scope: Chapter source ingestion

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                                | Status       | Trigger to revisit                                                                        |
| --------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------- |
| Section-extraction contract changes                 | Follow-on WP | When the `section-extraction-contract-v2` WP runs                                         |
| 60K truncation cap removal for whole-doc handbooks  | Follow-on WP | Lands inside `section-extraction-contract-v2` for Class C handbooks                       |
| TOC strategy improvements                           | Deferred     | When the deterministic TOC parser's 668 warnings or over-flattening block ingestion       |
| Errata pipeline expansion                           | Rejected     | Never -- see detail below                                                                 |
| DB schema changes                                   | Rejected     | Never -- see detail below                                                                 |
| Inline derivative tree changes                      | Rejected     | Never -- see detail below                                                                 |
| Edition rollover automation                         | Deferred     | When the FAA cuts a new edition and operator finds the manual YAML edit painful           |
| Chapter PDFs for AC/ACS                             | Rejected     | Never -- see detail below                                                                 |
| Class C handbooks chapter splitting                 | Deferred     | When extraction quality on AVWX/IFH/AMT/seaplane demands chapter-scoped inputs            |
| Long-tail Class A handbooks (helicopter/glider/...) | Deferred     | When operator wants those handbooks ingested past the v1 PHAK + AFH + IPH set             |
| HTML HEAD-cache idempotency                         | Follow-on WP | Separate fix PR -- post-merge manual test surfaced 53 of 54 AIM files re-fetch on rerun   |
| Prompt-strategy CLI chapter-filter bug              | Follow-on WP | Separate fix PR -- `--chapter 7` errors "sidecar count (17) does not match chapter count" |

## Section-extraction contract changes

Status: Follow-on WP

What was deferred:
Edits to the contract template, prompt template, parameters file, and JSON contract schema
under `tools/handbook-ingest/ingest/prompts/`. The truncation logic inside
`_build_from_whole_doc_with_page_ranges` in `tools/handbook-ingest/ingest/chapter_plaintext.py`.

Why:
A concurrent WP (`section-extraction-contract-v2`) owns the contract surface. Splitting the work
prevents merge conflicts and keeps each WP reviewable in isolation. Boundary contract is documented
in spec §H -- this WP owns the chapter-mode early-return at the top of `chapter_plaintext.py`;
contract-v2 owns the inside of the whole-doc-path internals.

Trigger to revisit:
When the `section-extraction-contract-v2` WP runs. The two WPs coordinate by structure (early-return
vs internals), and the second-to-merge rebases against the first.

Implementation pattern when triggered:
Follow the boundary contract spelled out in spec §H. Add new narration branches by adding new strings
in `cli.py`; do not rewrite existing ones.

References:

- [spec.md §H -- Coordination](./spec.md)
- [section-extraction-contract-v2 WP](../section-extraction-contract-v2/) (concurrent)
- [section-extraction-prompt-strategy design](../section-extraction-prompt-strategy/design.md)

## 60K truncation cap removal for whole-doc handbooks

Status: Follow-on WP

What was deferred:
Raising or removing `chapter_text_max_chars: 60000` (set in
`tools/handbook-ingest/ingest/config/phak.yaml` historically; now per-handbook YAML) for
the Class C handbooks (AVWX, IFH, AMT, seaplane) that have no chapter PDFs available.

Why:
Chapter-PDF mode bypasses the cap entirely -- the chapter PDF IS the unit of input -- which is
sufficient for this WP's correctness goal (PHAK ch7 sidecar contains all expected literals).
For Class C handbooks, the cap removal is owned by the concurrent contract-v2 WP since the
truncation logic lives inside `_build_from_whole_doc_with_page_ranges` (contract-v2's territory
per the boundary contract).

Trigger to revisit:
Lands inside `section-extraction-contract-v2`. No separate trigger required from this WP.

Implementation pattern when triggered:
Internal change inside `_build_from_whole_doc_with_page_ranges`. The cap lives in YAML; raise
or remove the YAML field.

References:

- [spec.md §Out of Scope (explicit)](./spec.md)
- [spec.md §H -- Coordination](./spec.md)

## TOC strategy improvements

Status: Deferred

What was deferred:
The deterministic Python TOC parser at `tools/handbook-ingest/ingest/sections_via_toc.py`.
Known issues: over-flattening of nested sections and 668 warnings on the most recent run.

Why:
Out of scope per spec §Out of Scope. The chapter-source-ingestion WP fixes the input-data
problem (incomplete chapter plaintext via the 60K cap); the TOC parser's structural issues
are a separate failure mode.

Trigger to revisit:
When the TOC parser's warnings or over-flattening block ingestion of a new handbook or
re-extraction of an existing one. Authoring a dedicated WP for TOC parser improvements is
the natural next step.

Implementation pattern when triggered:
Mirror the WP-spec template at `docs/work-packages/chapter-source-ingestion/spec.md`. Author
spec / tasks / design / test-plan; the TOC parser already has a fixture corpus from the
broad-extraction survey.

References:

- [spec.md §Out of Scope (explicit)](./spec.md)

## Errata pipeline expansion

Status: Rejected

What was rejected:
Any expansion of errata scope -- new errata types, multi-step errata pipelines, automated
errata fetching. The existing `apply_errata.py` and ADR 020 contract are sufficient.

Why:
ADR 020 already handles errata as 1:N per handbook. The chapter-source-ingestion WP is an
additive change to cache layout; it does not touch errata. Expanding errata scope here would
muddy the WP's correctness goal (chapter-scoped inputs) with an unrelated concern.

References:

- [ADR 020 -- Handbook edition and amendment policy](../../decisions/020-handbook-edition-and-amendment-policy.md)
- [spec.md §Out of Scope (explicit)](./spec.md)

## DB schema changes

Status: Rejected

What was rejected:
Any changes to `handbook_section`, `reference`, or related DB tables. The cache layout is
invisible to the DB tier.

Why:
The cache (PDFs + HTML files on disk) is the source-of-truth for raw publisher bytes. The
DB tier consumes the inline derivative tree (`<repo>/handbooks/`, `<repo>/aim/`, ...). Cache
shape change does not propagate to DB schema. Conflating the two would break the three-tier
storage rule in ADR 018.

References:

- [ADR 018 -- Source artifact storage policy](../../decisions/018-source-artifact-storage-policy/decision.md)
- [spec.md §Out of Scope (explicit)](./spec.md)

## Inline derivative tree changes

Status: Rejected

What was rejected:
Changes to the committed `<repo>/handbooks/`, `<repo>/aim/`, etc. trees -- per-section
markdown, figure PNGs, table HTML, derivative manifests.

Why:
Per ADR 018, the inline derivative tree is the "extracted, committed" tier. Chapter-source
ingestion changes the cache tier (publisher bytes on disk); it does not change what we extract
or how we commit it. Two separate concerns; this WP holds its line.

References:

- [ADR 018 -- Source artifact storage policy](../../decisions/018-source-artifact-storage-policy/decision.md)
- [spec.md §Out of Scope (explicit)](./spec.md)

## Edition rollover automation

Status: Deferred

What was deferred:
A `bun run sources upcoming-edition <slug>` helper that detects when the FAA cuts a new
edition (e.g. PHAK 25C -> 25D) and assists with the YAML edit.

Why:
Optional nice-to-have. FAA edition cadence is years; manual YAML edits are infrequent and
low-friction. Building automation now is speculative; the verifier already surfaces 404s
when an edition rotates the URL.

Trigger to revisit:
When the FAA cuts a new edition and the operator finds the manual YAML edit painful enough
to want tooling. Frequency is the signal: one painful edit doesn't merit it; a cluster of
edition rotations across handbooks does.

Implementation pattern when triggered:
Extend `scripts/sources/verify-urls.ts` with an "upcoming edition" probe -- HEAD-check
neighboring edition slugs (`-25D`, `-3D`) against the publisher's edition convention. Surface
the proposed YAML diff to the operator.

References:

- [spec.md §Out of Scope (explicit)](./spec.md)

## Chapter PDFs for AC/ACS

Status: Rejected

What was rejected:
Chapter splits or per-chapter assets for Advisory Circulars and Airman Certification
Standards.

Why:
ACs and ACSs are short single-doc publications. No chapter splits exist or are useful at the
publisher's distribution layer. The whole-doc-only path is sufficient and correct.

References:

- [spec.md §Out of Scope (explicit)](./spec.md)
- [spec.md §Class C -- whole-doc only](./spec.md)

## Class C handbooks chapter splitting

Status: Deferred

What was deferred:
Client-side splitting of AVWX, IFH, AMT, and seaplane PDFs into chapter-scoped inputs. These
handbooks have no chapter PDFs at the publisher; we'd have to split them ourselves.

Why:
Per spec §Out of Scope: whole-doc-only per publisher; client-side splitting deferred. The
60K cap still applies to these handbooks, which is acceptable for v1.

Trigger to revisit:
When extraction quality on AVWX, IFH, AMT, or seaplane demands chapter-scoped inputs. Concrete
signal: a re-extract that produces incomplete section trees on one of these handbooks (same
failure mode as PHAK pre-WP).

Implementation pattern when triggered:
Mirror the chapter-PDF mode in `chapter_plaintext.py` but with a client-side PDF splitter
(PyMuPDF can do this). Add a `chapter_pdfs.split_from_whole_doc: true` field to YAML.

References:

- [spec.md §Out of Scope (explicit)](./spec.md)
- [spec.md §Class C -- whole-doc only](./spec.md)

## Long-tail Class A handbooks (helicopter / glider / balloon / instructors)

Status: Deferred

What was deferred:
Per-operator-run ingestion of helicopter, glider, balloon, and instructors handbooks. v1
ships infrastructure for all Class A handbooks but the operator may defer the actual
download passes until needed.

Why:
Per tasks.md Phase 10: "Operator can defer the long-tail handbooks if scope is too big;
minimum required: PHAK + AFH + IPH for v1." Tests still cover the long-tail YAML configs.

Trigger to revisit:
When the operator decides to ingest one of these handbooks. No code work required; just run
`bun run sources download <slug>`.

Implementation pattern when triggered:
The YAML config already supports each handbook (per tasks Phase 2). Run the download command;
verify the manifest is populated; run the section-extraction prompt-strategy pass.

References:

- [tasks.md §Phase 10](./tasks.md)
- [tasks.md §Punted / known follow-ups](./tasks.md)

## HTML HEAD-cache idempotency

Status: Follow-on WP

What was deferred:
`html-fetch.ts` HEAD-cache idempotency. Today, AIM HTML re-runs re-fetch all 54 files;
PDF re-runs are zero-network.

Why:
Surfaced during the post-merge manual test pass after PR #337 merged. Spec acceptance only
required PDF idempotency; HTML should follow the same pattern but was deferred to a separate
fix PR to keep the merged WP small.

Trigger to revisit:
Separate fix PR. The bug is already filed in review.md §Post-merge implementation findings.

Implementation pattern when triggered:
Mirror the PDF HEAD-cache logic in `scripts/sources/download/execute.ts`. Apply ETag +
Last-Modified comparison before re-downloading HTML bodies.

References:

- [review.md §Post-merge implementation findings](./review.md)

## Prompt-strategy CLI chapter-filter bug

Status: Follow-on WP

What was deferred:
`python -m ingest phak --strategy prompt --chapter 7` errors with "sidecar count (17) does
not match chapter count (1)". The chapter-PDF mode emits sidecars for all chapters; the
prompt-strategy CLI's `--chapter N` filter only wants one.

Why:
Surfaced during the post-merge manual test pass after PR #337 merged. Unfiltered runs work
fine; the bug is isolated to the `--chapter N` filter path. Separate fix PR to keep the
merged WP small.

Trigger to revisit:
Separate fix PR. The bug is already filed in review.md §Post-merge implementation findings.

Implementation pattern when triggered:
Filter the sidecar list in `tools/handbook-ingest/ingest/chapter_plaintext.py` (or the CLI
wrapper) before the count assertion. Sidecars match the filter, not the full chapter set.

References:

- [review.md §Post-merge implementation findings](./review.md)
