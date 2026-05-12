---
title: 'Out of Scope: Library substrate (WP-SUB)'
product: study
feature: library-substrate
type: out-of-scope
status: unread
---

# Out of Scope: Library substrate (WP-SUB)

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

Sources: the "Non-goals" and "Out of scope (deliberately deferred)" sections of [spec.md](./spec.md), the "Out of scope" block in [tasks.md](./tasks.md) (specifically the smell #1 / smell #5 deferrals carried by [spec.md](./spec.md)), and the parent ratified plan at [library-completeness/spec.md](../library-completeness/spec.md) §6.

## Summary

| Item                                                             | Status       | Trigger to revisit                                                                               |
| ---------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------ |
| Smell #1: retire handbooks-noningested.yaml                      | Deferred     | After the 6 whole-doc handbooks seed cleanly post-WP-SUB; then audit + delete                    |
| Smell #2: corpus-module registration boilerplate consolidation   | Deferred     | When >= 3 corpus resolvers exist and the boilerplate is duplicated past tolerance                |
| Smell #3: phase-numbered reviewer IDs -> per-corpus reviewer IDs | Deferred     | When the next reviewer fixture is authored and the phase-numbered name jars                      |
| Smell #5: /library card-state indicator                          | Follow-on WP | When a user reports confusion between "ingested + readable" and "umbrella-only"                  |
| Any new corpus seed (AIM / CFR / AC / ACS / mountain-flying)     | Follow-on WP | Each corpus is its own WP per [library-completeness/spec.md](../library-completeness/spec.md) §6 |
| Library page UI changes                                          | Rejected     | Never -- see detail below                                                                        |
| New validation surfaces beyond the manifest Zod schemas          | Rejected     | Never -- see detail below                                                                        |
| ADR 019 URI scheme or @ab/sources citation-contract changes      | Rejected     | Never -- see detail below                                                                        |

## Smell #1: retire handbooks-noningested.yaml

Status: Deferred

What was deferred:
Deletion of `course/references/handbooks-noningested.yaml`. The file was kept in place by WP-SUB; acceptance criterion #10 in [spec.md](./spec.md) makes that explicit. The `afh@FAA-H-8083-3B` row inside it specifically stays until a content audit.

Why:
Per [spec.md](./spec.md) "Out of scope (deliberately deferred)" -> "Smell #1 cleanup": once the substrate rename ships and the 6 extras seed cleanly through the new whole-doc path, the YAML rows that previously stood in as the "noningested" placeholder become redundant. But retiring the YAML before the substrate proves out would conflate two changes and make rollback awkward. The deferral is sequencing, not refusal.

Trigger to revisit:
After WP-SUB merges AND the acceptance criteria run green (`bun run db reset && bun run db seed` produces the expected counts; the 6 whole-doc handbooks show as readable on `/library/cert/...` and `/library/topic/...`). Then audit the file row-by-row: every row whose `document_slug` + `edition` now seeds through a manifest gets deleted; rows that don't have a manifest stay until the audit explains why.

Implementation pattern when triggered:
Read the YAML, cross-reference each row against `handbooks/<slug>/<edition>/manifest.json`. For each row with a matching manifest: delete the YAML row. For each row without one: leave it and note the reason inline. Update `scripts/db/seed-references.ts` to drop the file from its read list if the file is fully empty. One PR; no functional change beyond the substrate already in place.

References:

- [spec.md](./spec.md) "Out of scope (deliberately deferred)" -> Smell #1
- [spec.md](./spec.md) Acceptance criterion #10
- [tasks.md](./tasks.md) Phase G follow-up note
- Parent spec: [library-completeness/spec.md](../library-completeness/spec.md) §6

## Smell #2: corpus-module registration boilerplate consolidation

Status: Deferred

What was deferred:
A single registration helper that wraps the per-corpus resolver + seeder + Zod manifest schema into one declaration. Today each corpus adds a resolver in `libs/sources/src/<corpus>/resolver.ts`, a seeder in `libs/bc/study/src/seeders/<corpus>.ts`, and a schema in `libs/bc/study/src/manifest-validation.ts`, with the dispatch wiring repeated in `scripts/db/seed-references-from-manifest.ts` and the `corpus-resolver` registry.

Why:
Per [spec.md](./spec.md) "Out of scope (deliberately deferred)" -> Smell #2: with only handbook-section-tree + handbook-whole-doc resolvers in flight at the time of WP-SUB, there isn't enough duplication to design the consolidation against. Premature abstraction would freeze the wrong shape.

Trigger to revisit:
When >= 3 corpus resolvers are wired (e.g., handbooks + AIM + CFR), AND the per-corpus registration boilerplate has been hand-copied for the third time. Both signals together -- a real surface area AND a confirmed copy-paste pattern.

Implementation pattern when triggered:
Define a `CorpusModule<Manifest>` interface in `libs/sources/src/registry/corpus-module.ts` that bundles the resolver, the seeder, and the manifest schema. The dispatcher in `scripts/db/seed-references-from-manifest.ts` reads a registry of `CorpusModule` instances and picks one by manifest `kind`. Existing corpora migrate one at a time; no big-bang refactor.

References:

- [spec.md](./spec.md) "Out of scope (deliberately deferred)" -> Smell #2
- Parent spec: [library-completeness/spec.md](../library-completeness/spec.md) (smell catalog in the parent review)

## Smell #3: phase-numbered reviewer IDs -> per-corpus reviewer IDs

Status: Deferred

What was deferred:
A renaming pass on reviewer-fixture IDs that today encode the WP-SUB phase letter (A / B / C / ...). The phase numbering is internal to one WP's task list and does not generalize once additional corpora are seeded.

Why:
Per [spec.md](./spec.md) "Out of scope (deliberately deferred)" -> Smell #3: the rename is cosmetic and the phase-numbered names work today. Doing the rename inside WP-SUB widens the diff and the review burden without changing behavior.

Trigger to revisit:
When the next reviewer fixture is authored for a corpus other than handbooks (AIM / CFR / AC / ACS), AND the phase-numbered name is jarring against a per-corpus name in the same review. Authoring the new fixture against the old naming is the surface that should prompt the rename.

Implementation pattern when triggered:
Rename reviewer fixtures from `phase-{letter}-...` to `{corpus}-...` (e.g., `handbooks-section-tree-substrate-equivalence`). Update any inline references. Keep the directory layout under `libs/bc/study/src/seeders/`; only the IDs change. No functional change.

References:

- [spec.md](./spec.md) "Out of scope (deliberately deferred)" -> Smell #3

## Smell #5: /library card-state indicator

Status: Follow-on WP

What was postponed:
A UI affordance on `/library` cards that distinguishes three states: "ingested + readable" (in-app reader works), "umbrella + link-only" (we link to an external source), and "deep link to FAA only" (no derivative content stored). The substrate makes all three states expressible in data; the UI surface that renders them is a separate UX WP.

Why:
Per [spec.md](./spec.md) "Non-goals" #5 and "Out of scope (deliberately deferred)" -> Smell #5: WP-SUB is a substrate rename. UX language for the three card states is a different surface (design tokens, copy, hover/focus behavior) that belongs in its own WP.

Trigger that fires the follow-on:
A user reports confusion between "ingested + readable" and "umbrella-only" cards (e.g., "I clicked AIM and got a link instead of a reader" or "PHAK opens but AIM doesn't, why?"), OR the next corpus seed (AIM / CFR) lands and the existing card UI shows the wrong affordance for the new corpus.

References:

- [spec.md](./spec.md) "Non-goals" #5
- [spec.md](./spec.md) "Out of scope (deliberately deferred)" -> Smell #5

## Any new corpus seed (AIM / CFR / AC / ACS / mountain-flying)

Status: Follow-on WP

What was postponed:
Seeding AIM, 14 CFR, 49 CFR, Advisory Circulars, ACSes, mountain-flying, or any other corpus that the substrate now supports. WP-SUB makes the substrate corpus-agnostic; it does not author any new corpus seed.

Why:
Per [spec.md](./spec.md) "Non-goals" #1 and "Out of scope (deliberately deferred)" -> "Any new corpus seed": each corpus has its own manifest design, ingestion validation, content audit, and review surface. Bundling them into WP-SUB would have prevented the substrate from shipping cleanly.

Trigger that fires the follow-on:
Each corpus is its own follow-on WP per [library-completeness/spec.md](../library-completeness/spec.md) §6. Concrete in-flight examples already authored: [wp-mtn-mountain-flying](../wp-mtn-mountain-flying/), [wp-aih-section-tree](../wp-aih-section-tree/), [wp-cc](../wp-cc/), [wp-acs-link-only-pipeline](../wp-acs-link-only-pipeline/). Trigger for any specific corpus: user wants it visible in `/library` OR a downstream feature (cert-dashboard, scenario gating, etc.) depends on it being in the DB.

Implementation pattern when triggered:
Mirror `libs/bc/study/src/seeders/handbooks-whole-doc.ts` (whole-doc) or `libs/bc/study/src/seeders/handbooks-section-tree.ts` (section-tree). Add the corpus's Zod manifest schema to `libs/bc/study/src/manifest-validation.ts` in the discriminated union. The seeder dispatcher in `scripts/db/seed-references-from-manifest.ts` picks it up automatically.

References:

- [spec.md](./spec.md) "Non-goals" #1
- [spec.md](./spec.md) "Out of scope (deliberately deferred)" -> "Any new corpus seed"
- Parent spec: [library-completeness/spec.md](../library-completeness/spec.md) §6 sequence
- In-flight corpus WPs in `docs/work-packages/wp-*`

## Library page UI changes

Status: Rejected

What was rejected:
Any change to the cert / topic / regulations / handbook routes' UI. WP-SUB preserves the route family byte-identically; the loader names of imported tables / functions change, but the rendered HTML does not.

Why:
Per [spec.md](./spec.md) "Non-goals" #2: WP-SUB is a substrate rename, not a UX change. Wave 3b (PR #391) already shipped the new route family; touching the UI inside WP-SUB would introduce visual diffs into a rename-only review and break the "passes by construction" property of the Wave 4 e2e suite.

A re-decision would have to clear: a UI change that cannot be expressed as a follow-on WP after WP-SUB ships, AND that genuinely cannot wait. None has surfaced.

References:

- [spec.md](./spec.md) "Non-goals" #2
- [spec.md](./spec.md) Anchors: Wave 3b (PR #391), Wave 4 (PR #392)

## New validation surfaces beyond the manifest Zod schemas

Status: Rejected

What was rejected:
DB-level CHECK constraints or trigger-based validations beyond what the per-kind ingest-time Zod schemas already enforce. Specifically: the dropped `reference.kind` CHECK, the dropped `reference_section.level` / `code` / `parent_level` CHECKs are not replaced by DB-level alternatives.

Why:
Per [spec.md](./spec.md) "Non-goals" #3 and ratification SUB.1 in the parent plan: Zod-at-ingest is the single source of truth. Adding a corpus shouldn't require a schema change; that's the whole point of the rename. DB-level CHECKs would re-introduce per-corpus schema coupling.

A re-decision would have to clear: a class of invariant that genuinely cannot be enforced at ingest (e.g., a cross-row invariant the seeder can't see), AND that is worth the per-corpus schema-change cost. None has surfaced.

References:

- [spec.md](./spec.md) "Non-goals" #3
- [spec.md](./spec.md) "What changes" -> "2. Constraints removed" + Zod-at-ingest rationale

## ADR 019 URI scheme or @ab/sources citation-contract changes

Status: Rejected

What was rejected:
Any change to the `airboss-ref:<corpus>/<slug>/...?at=<edition>` URI scheme or to the `CorpusResolver` citation-contract signatures. Citation resolvers continue to key off `(document_slug, edition)`; the rename of the underlying tables is invisible to them.

Why:
Per [spec.md](./spec.md) "Non-goals" #4 and "What stays the same": ADR 019 is a stable contract used by every citation surface across the platform (knowledge nodes, scenarios, lens routes, decks). Substrate rename must not ripple into it. If a future corpus needs a new URI shape, that's a new ADR, not a quiet change inside a substrate WP.

References:

- [spec.md](./spec.md) "Non-goals" #4
- [spec.md](./spec.md) "What stays the same"
- [ADR 019](../../decisions/019-reference-identifier-system/decision.md) (URI scheme contract)
