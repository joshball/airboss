---
title: 'Out of Scope: WP-ACS-LINK-ONLY -- link-only stubs for the 2 link-only ACS / PTS cards'
product: course
feature: wp-acs-link-only-pipeline
type: out-of-scope
status: unread
---

# Out of Scope: WP-ACS-LINK-ONLY -- link-only stubs for the 2 link-only ACS / PTS cards

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

The source is the "Out of scope" section of [spec.md](./spec.md), plus the Wave 6 framing at the top of the spec that promotes Wave 6 to "stage-1 (Sourced) stubs only" and parks the original full-pipeline ambition for a later WP.

## Summary

| Item                                    | Status       | Trigger to revisit                                                                                                                  |
| --------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Body extraction + section-tree pipeline | Follow-on WP | When CFII training content needs the PTS body in app, or when FAA promotes CFII from PTS to ACS (covered by the future WP-ACS-FULL) |
| Adding more PTS docs beyond CFII        | Rejected     | Never -- see detail below                                                                                                           |
| Restructuring the ACS schema for PTS    | Rejected     | Never -- see detail below                                                                                                           |

## Body extraction + section-tree pipeline (WP-ACS-FULL)

Status: Follow-on WP

What was postponed:
The full download -> extract -> register -> seed pipeline for `cfii-airplane-pts-9e` (FAA-S-8081-9E, CFII PTS) and `faa-g-acs-2-companion-guide` (FAA-G-ACS-2, ACS Companion Guide). Wave 6 closes WP-ACS-LINK-ONLY by promoting status from "link-only" to "link-only stub (Sourced)" via the `url:` fields already present in `course/references/acs-pts.yaml`. The original spec body (Phases 1-5) targeted `scripts/sources/config/acs.yaml` (CFII PTS) and either `acs.yaml` or `handbooks/` (Companion Guide), with extraction, manifest writes, register, seed, and tests. None of that lands in this WP.

Why:
Per [spec.md](./spec.md) Wave 6 framing: stage-1 (Sourced) stubs are sufficient because both publications already deep-link via `url:` from citation chips and library cards, so user-facing reading still flows through the FAA PDFs. Body extraction adds material work (PTS-vs-ACS schema reconciliation, Companion Guide handbook-shape ingestion, per-doc seed adapter wiring) that has no current consumer in app. The CFII PTS and Companion Guide bodies are not referenced by any in-flight study or course content; promoting them to in-app section-tree readability would be speculative work.

Trigger that fires the follow-on:
Either (a) CFII training content lands in app and needs the PTS body deep-readable rather than redirecting to faa.gov, or (b) FAA promotes CFII from PTS to the ACS shape (the spec notes the slug `cfii-airplane-pts-9e` is intentionally chosen so a future revision renames cleanly to `cfii-airplane-acs-...` without a schema change).

Implementation pattern when triggered:
Mirror the WP-ACS-V pipeline ([PR #501](https://github.com/joshball/airboss/pull/501)). Phase shape:

- Phase 1: add (or reshape) entries in `scripts/sources/config/acs.yaml` for CFII; add a `handbooks/` entry for the Companion Guide per the user's "no more whole-docs" direction.
- Phase 2: `bun run sources download --only acs` and `bun run sources download --only handbooks`.
- Phase 3: extract via the existing ACS pipeline (CFII degrades to empty `elements: []`) and the handbook section-tree pipeline (Companion Guide).
- Phase 4: `bun run sources register acs` (and `handbooks` if Companion Guide moves there); reseed; verify both flip readable on `/library`.
- Phase 5: manifest validation tests + REFERENCES.md flips both rows to readable.

The seed adapter for ACS already handles the empty-elements case (the CFI ACS row carries empty `elements: []` because FAA didn't carry K/R/S codes). PTS reuses that path. The Companion Guide reuses the handbook section-tree adapter -- no new schema member.

References:

- [spec.md](./spec.md) -- Wave 6 framing block at the top + the original Phases 1-5 (preserved as the design target for WP-ACS-FULL)
- `course/references/acs-pts.yaml` -- the `url:` fields that satisfy stage-1
- [PR #501](https://github.com/joshball/airboss/pull/501) -- WP-ACS-V pattern for the full pipeline
- [docs/platform/REFERENCES.md](../../platform/REFERENCES.md) -- ACS table (the rows stay link-only stubs until the follow-on WP lands)

## Adding more PTS docs beyond CFII

Status: Rejected

What was rejected:
Bringing other Practical Test Standards into the pipeline. The spec scope is the 2 link-only cards (`cfii-airplane-pts-9e` and `faa-g-acs-2-companion-guide`); no other PTS slugs were considered.

Why:
Per [spec.md](./spec.md) Out of scope line 1: "no others in YAML." The FAA has migrated nearly every airman certification path to ACS; CFII is the only PTS-shape doc that still survives in `course/references/acs-pts.yaml`. There is no list of "other PTS docs" to ingest. Adding speculative PTS slugs would invent artifacts that don't exist in the source-of-truth YAML.

Trigger to revisit:
Never. If FAA reverts an ACS path to PTS (vanishingly unlikely), or if a new niche PTS publication appears that we want surfaced, that's a new ingestion decision and gets its own WP. Don't extend this WP's scope retroactively to absorb hypothetical future PTS docs.

References:

- [spec.md](./spec.md) -- "In scope" table (exactly 2 cards) + Out of scope line 1
- `course/references/acs-pts.yaml` -- the source-of-truth YAML for ACS / PTS rows

## Restructuring the ACS schema for PTS

Status: Rejected

What was rejected:
Adding a new `kind: 'pts'` discriminator to `manifest-validation.ts`, with a separate schema and a separate seeder, to model the older PTS shape (Areas of Operation -> Tasks -> Objective / Knowledge / Risk Management / Skills) explicitly. The spec's Decision section labels this option (a) and rejects it.

Why:
Per [spec.md](./spec.md) Decision "CFII is PTS not ACS -- different doc shape": option (a) was rejected in favor of option (b) -- stretch the existing `kind: 'acs'` schema by degrading PTS to "ACS with empty `elements: []`". The existing CFI ACS row already exhibits this shape because FAA didn't publish K/R/S codes for it; PTS fits the same mold. The slug carries the PTS marker (`cfii-airplane-pts-9e`) for human readability, but dispatches via the same seeder.

If the FAA promotes CFII to ACS in a future revision, the slug renames and the manifest gets richer K/R/S codes -- no schema change required. This is a design property worth preserving: schema stability across FAA publication churn.

Trigger to revisit:
Never. A re-decision would require the PTS shape to diverge from ACS in ways the empty-elements degradation can't model (e.g. PTS introducing a wholly new outline level not present in ACS). That hasn't happened in 30+ years of PTS publications and won't, since FAA is migrating off PTS, not enriching it.

References:

- [spec.md](./spec.md) -- Decision "CFII is PTS not ACS -- different doc shape" (Recommendation: (b)) + Out of scope line 2
- `libs/bc/study/src/manifest-validation.ts` -- the `acs` schema that absorbs PTS via the empty-elements degradation
- The CFI ACS row -- prior precedent for `elements: []` parsing cleanly through the ACS schema
