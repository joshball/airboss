---
title: 'Out of Scope: Library by-cert taxonomy'
product: study
feature: library-by-cert
type: out-of-scope
status: unread
---

# Out of Scope: Library by-cert taxonomy

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

The source is the "Out of scope" section of [spec.md](./spec.md) read alongside the "Ratifications (2026-05-01)" block, which moved per-Part / per-Chapter route rendering from out-of-scope into Phase 1. Anything pulled into scope by that ratification is excluded from this file.

## Summary

| Item                                        | Status       | Trigger to revisit                                                          |
| ------------------------------------------- | ------------ | --------------------------------------------------------------------------- |
| Search-first library surface                | Rejected     | Never -- see detail below                                                   |
| POH per-aircraft authoring                  | Deferred     | When the Phase 10 (POH / per-tail) work in ADR 016 lands                    |
| ACS Area-of-Operation cross-mapping for CFR | Deferred     | When ACS coverage broadens past PPL Area V to other certs / other areas     |
| Filling broad-extraction gaps 1-5           | Follow-on WP | Each gap is its own small PR per the broad-extraction-survey recommendation |

## Search-first library surface

Status: Rejected

What was rejected:
A library landing where the primary surface is a search box ("find a CFR section / handbook / AC") with browse trees demoted to fallback. Concretely: Q4 option C and Q5 option B in [spec.md](./spec.md).

Why:
Per the ratification of Q4 and Q5 in [spec.md](./spec.md) (both A, with B as a future enhancement only for Q4 once ACS coverage broadens): browse-by-Part for 14 CFR (11 Part cards) and browse-by-Chapter for AIM (16 cards) match how the materials are studied. Search-first wins for "I know what I want" but loses badly for "what's in here?" Discovery is the primary job of the library page; a search-first surface inverts that.

References:

- [spec.md](./spec.md) Q4 options table and recommendation
- [spec.md](./spec.md) Q5 options table and recommendation
- [spec.md](./spec.md) "Ratifications (2026-05-01)" Q4 / Q5 rows

## POH per-aircraft authoring

Status: Deferred

What was deferred:
The authoring surface and seed pipeline for per-tail / per-aircraft POH / AFM rows under the `Aircraft-specific` library spine. The `poh-afm` umbrella row exists, but no per-aircraft children seed under it. The spec calls this "POH per-aircraft authoring (Phase 10 in ADR 016)."

Why:
Per the [spec.md](./spec.md) "Out of scope" bullet citing ADR 016 Phase 10. Per-aircraft POH/AFM is a separate ingestion pipeline (one POH per tail, not one document per fleet), with different metadata (tail-number, year, model variant) and different render needs (the user owns the document; the library only references it). The library taxonomy WP gave it a home (Aircraft-specific spine + umbrella row); it explicitly does not author the per-tail rows.

Trigger to revisit:
When ADR 016 Phase 10 (POH / per-tail) is scheduled or in flight, AND the user has a concrete POH they want to seed and surface (i.e., not speculative).

Implementation pattern when triggered:
Mirror the umbrella-then-children pattern already used for the ACS umbrella row + per-cert ACS / PTS children. The umbrella `poh-afm` row already exists with `primary_cert = NULL` (renders under Aircraft-specific spine only); per-tail rows attach via a parent FK or via a `tail_number` metadata field on a new `study.reference` row per aircraft. Pipeline: hangar-side authoring tool, not a static YAML seed.

References:

- [spec.md](./spec.md) "Out of scope" -> "POH per-aircraft authoring (Phase 10 in ADR 016)"
- [ADR 016](../../decisions/016-cert-syllabus-goal-model/decision.md) Phase 10 reference

## ACS Area-of-Operation cross-mapping for CFR

Status: Deferred

What was deferred:
The "browse 14 CFR by ACS Area" surface (Q4 option B). A render that lets a learner pivot from an ACS Area-of-Operation -> the set of 14 CFR sections it references, instead of from Part -> sections. Today the library exposes only Part-first browse (Q4 option A); Area-first browse requires ACS coverage that does not yet exist outside PPL Area V.

Why:
Per [spec.md](./spec.md) Q4 recommendation and the "Ratifications (2026-05-01)" Q4 row: option A for Phase 1, option B as a Phase 2 enhancement once ACS coverage broadens. ADR 016 Phase 4 only wires PPL ACS Area V; building Area-first browse against a single Area would surface mostly blank pages and look like the feature is broken.

Trigger to revisit:
When ACS coverage broadens past PPL ACS Area V to at least one additional Area on PPL or one additional cert (Instrument, Commercial, CFI). The "broaden ACS coverage" event is itself defined in ADR 016's later phases.

Implementation pattern when triggered:
The ACS task tables already track which CFR sections each task references (see the ACS seed schema). Build a derived view `acs_task_cfr_xref` that joins `acs_task` -> `cfr_section`, then a per-Area landing route `/library/regulations/14-cfr/area/{acs-area-slug}` that lists the sections grouped by task. Carryover from the existing Part-first surface: same section detail pages, just a different group-by.

References:

- [spec.md](./spec.md) Q4 options table, option B
- [spec.md](./spec.md) Q4 recommendation: "A for Phase 1; B as a Phase 2 enhancement once ACS coverage broadens"
- [spec.md](./spec.md) "Ratifications (2026-05-01)" Q4 row
- [ADR 016](../../decisions/016-cert-syllabus-goal-model/decision.md) Phase 4 ACS wiring

## Filling broad-extraction gaps 1-5

Status: Follow-on WP

What was postponed:
Six gaps surfaced by [library-broad-extraction-survey/findings.md](../library-broad-extraction-survey/findings.md):

- Gap 1: 49 CFR walker fails; parts 830 + 1552 not visible.
- Gap 2: only 1 / 5 ACS editions visible.
- Gap 3: 3 ACs skipped by ingestion.
- Gap 4: AC ingestion regression.
- Gap 5: handbook-extras (Risk Mgmt / IFH / IPH / AIH / AMT-G / AMT-P / Helicopter) not seeded into the substrate.

The library taxonomy WP placed each corpus in the new spine; it does not fill the gap.

Why:
Per [spec.md](./spec.md) "Out of scope" -> "Filling broad-extraction gaps 1-5 (separate small PRs per the survey's recommendation)." Each gap has its own walker / ingest fix and its own validation surface; bundling them into the taxonomy WP would have widened scope past the ratification of the cert + topic + regs spines.

Trigger that fires the follow-on:
Each gap is its own follow-on WP / PR per the broad-extraction survey's "recommended remediation" column. Trigger to launch any one of them: user wants the corpus visible in the new library surface, OR a downstream WP (e.g., a cert-dashboard query) depends on the corpus being seeded.

References:

- [spec.md](./spec.md) "Out of scope" -> "Filling broad-extraction gaps 1-5"
- [library-broad-extraction-survey/findings.md](../library-broad-extraction-survey/findings.md)
- [library-substrate/spec.md](../library-substrate/spec.md) (the substrate rename that unblocks gap 5 and any future corpus seed)

## Note on items pulled INTO scope by the 2026-05-01 ratifications

Two items that the original "Out of scope" list named are no longer deferred:

- "Any code change" -- shipped across Waves 1-4 (PRs #386, #389, #390, #391, #392).
- "Schema migration SQL" -- shipped in Wave 1 (`reference.primary_cert` column, PR #386).
- "Per-Part / per-Chapter route rendering" -- explicitly pulled into Phase 1 by the "Ratifications (2026-05-01)" -> "Phase 1 scope expansion" block. The per-Part / per-Chapter routes shipped in Wave 3b (PR #391).

These are recorded here only so a future reader does not mistake the stale bullet for an outstanding deferral.
