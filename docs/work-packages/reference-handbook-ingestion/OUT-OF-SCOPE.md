---
title: 'Out of Scope: Reference handbook ingestion'
product: course
feature: reference-handbook-ingestion
type: out-of-scope
status: unread
---

# Out of Scope: Reference handbook ingestion

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

The source is the "Out of scope" section of [spec.md](./spec.md) (lines 73-79). Phase 6 of the ADR 019 ten-phase rollout is the WP this captures; the deferrals here are the boundaries Phase 6 drew between "register the handbook corpus" and "everything adjacent to it." Several items are explicit references to other phases of the rollout (Phase 5's diff job, the ADR 016 phase 0 ingestion pipeline that produced the derivatives Phase 6 consumes).

## Summary

| Item                                              | Status       | Trigger to revisit                                                             |
| ------------------------------------------------- | ------------ | ------------------------------------------------------------------------------ |
| Re-authoring the handbook ingestion pipeline      | Rejected     | Never -- see detail below                                                      |
| Per-paragraph registry entries                    | Rejected     | Never -- see detail below                                                      |
| Figure / table content lookups (registry entries) | Follow-on WP | When the renderer (Phase 4) binds `@text` / `@quote` to figure / table targets |
| Cross-edition aliases (handbook renumbering)      | Rejected     | Never -- see detail below                                                      |
| Full FAA handbook catalog (IFH, AIH, IPH, others) | Deferred     | When a learner / lesson author cites a handbook beyond PHAK + AFH + AvWX       |

## Re-authoring the handbook ingestion pipeline

Status: Rejected

What was rejected:
Re-implementing the FAA handbook ingestion pipeline (PDF fetcher, markdown extractor, figure / table extractor, manifest writer) inside `libs/sources/src/handbooks/`. Phase 6 consumes the existing derivatives at `handbooks/<doc>/<edition>/manifest.json` rather than producing them.

Why:
Per [spec.md](./spec.md) Out of scope: PR #242 (ADR 016 phase 0) already shipped the Python pipeline at `tools/handbook-ingest/` that fetches PDFs, extracts markdown / figures / tables, and writes the manifest. Building a second pipeline would duplicate machinery and create two sources of truth for the same derivative tree. The Phase 6 design is "thin adapter that registers a `handbooks` `CorpusResolver`, walks the existing `manifest.json` files, and populates the registry."

A re-decision would have to clear: a use case where the existing Python pipeline is structurally inadequate (e.g., a new handbook in a format the Python extractor can't handle) AND the right answer is a parallel pipeline rather than extending the Python one.

References:

- [spec.md](./spec.md) Out of scope -- "Re-authoring the handbook ingestion pipeline"
- [spec.md](./spec.md) header (Phase 6 reuses PR #242's derivative tree)
- [tools/handbook-ingest/](../../../tools/handbook-ingest/) (the existing pipeline)

## Per-paragraph registry entries

Status: Rejected

What was rejected:
A `SourceEntry` per paragraph (e.g., `airboss-ref:handbooks/phak/8083-25C/12/3/para-2`) instead of stopping at chapter / section / subsection. Paragraph identifiers parse via `parseLocator` and resolve to the containing section's entry; no per-paragraph entries exist in the registry.

Why:
Per [spec.md](./spec.md) Out of scope: same approach as Phase 3's `regs` paragraph descent. Per-paragraph entries would explode the registry size without changing what the consumer (lesson cite + renderer) needs. The renderer descends into the section's body markdown when a paragraph identifier is bound to a `@text` / `@quote` token.

A re-decision would have to clear: a use case where paragraph-level lifecycle / edition / audit-trail is meaningfully different from section-level. None has surfaced.

References:

- [spec.md](./spec.md) Out of scope -- "Per-paragraph registry entries"
- [reference-cfr-ingestion-bulk/OUT-OF-SCOPE.md](../reference-cfr-ingestion-bulk/OUT-OF-SCOPE.md) "Per-paragraph SourceEntries" (the same rejection on the `regs` corpus)

## Figure / table content lookups (registry entries)

Status: Follow-on WP

What was postponed:
Registry entries for figures (`fig-12-7`) and tables (`tbl-12-3`). The Phase 6 locator parser accepts these shapes and validates them, but no `SourceEntry` is created -- they're addressable derivative files (`figures/fig-12-7-...png`, `tables/tbl-12-3-...html`) that the renderer descends to when a token binds.

Why:
Per [spec.md](./spec.md) Out of scope: figures and tables are content-bearing artifacts whose useful operation is "render this image inline" or "render this table inline," not "show me the citation chip for figure 12-7." The registry's job is to back citations and lifecycle; figure / table content lookups are a renderer concern.

Trigger that fires the follow-on:
The renderer (Phase 4 -- `reference-renderer-runtime`) binds `@text` / `@quote` (or new `@figure` / `@table`) tokens to figure / table targets AND the binding requires registry-backed metadata that the manifest's inline figure / table records don't provide.

Implementation pattern when triggered:
The renderer reads figure / table records from `manifest.figures[]` / `manifest.tables[]` directly (the manifest already enumerates them). If a registry entry surface is needed (e.g., for cross-handbook figure indexing), add a `figures` / `tables` corpus or extend `handbooks` with a sub-kind discriminator. The Phase 6 locator parser already accepts the shapes; only the entry-emission step needs to be added.

References:

- [spec.md](./spec.md) Out of scope -- "Figure / table content lookups"
- [reference-renderer-runtime/spec.md](../reference-renderer-runtime/spec.md) (the consuming renderer)

## Cross-edition aliases (handbook renumbering)

Status: Rejected

What was rejected:
A per-section alias mechanism that maps an old chapter / section number to a new one when the FAA renumbers within a handbook edition letter (e.g., 8083-25C -> 8083-25D silently changes the structure of Chapter 12). Phase 6 does not implement aliases.

Why:
Per [spec.md](./spec.md) Out of scope: handbooks rarely renumber within an edition letter; if 8083-25D introduces structural changes, that's a new doc slug entirely (a separate ingest run produces a separate set of registry entries). No aliases needed -- both editions live in the registry; lessons pin to one or the other; new lessons cite the new edition.

A re-decision would have to clear: a case where the FAA renumbers within an edition letter (so the same edition slug means two different things over time) -- which would itself violate the FAA's own publishing convention. Effectively never.

References:

- [spec.md](./spec.md) Out of scope -- "Cross-edition aliases"
- [spec.md](./spec.md) header (handbook editions are baked into the doc slug)
- [reference-aim-ingestion/OUT-OF-SCOPE.md](../reference-aim-ingestion/OUT-OF-SCOPE.md) "Cross-edition aliases" (the AIM corpus's analogous deferral, which IS deferred because AIM has the cadence that creates the issue)

## Full FAA handbook catalog (IFH, AIH, IPH, others)

Status: Deferred

What was deferred:
Ingestion of FAA handbooks beyond PHAK + AFH + AvWX -- specifically the Instrument Flying Handbook (IFH, FAA-H-8083-15B), Aviation Instructor's Handbook (AIH, FAA-H-8083-9B), Instrument Procedures Handbook (IPH, FAA-H-8083-16B), Helicopter Flying Handbook (HFH, FAA-H-8083-21B), and other less-cited FAA handbooks.

Why:
Per [spec.md](./spec.md) Out of scope: Phase 6 ships the three handbooks already on disk (PHAK / AFH / AvWX -- the ones cited heavily in private / instrument lessons). Adding more handbooks runs the same code path (Python ingest -> derivative tree -> Phase 6 register) -- it's not new machinery, just new derivatives. With no current lesson citing IFH / AIH / IPH / HFH, ingesting them is content-load-without-consumer.

Trigger to revisit:
A learner or lesson author needs to cite a handbook beyond PHAK / AFH / AvWX. The validator surfaces this as `unknown:` / row-2 ERROR; the operator runs the Python pipeline against the new handbook PDF, then re-runs `bun run sources register handbooks --doc=<slug>`.

Implementation pattern when triggered:

1. Run the existing `tools/handbook-ingest/` Python pipeline against the new handbook PDF. It writes derivatives at `handbooks/<doc>/<edition>/`.
2. Add the new doc slug to the `DOC_EDITIONS` and `DOC_LIVE_URLS` constants in `libs/sources/src/handbooks/`.
3. Run `bun run sources register handbooks --doc=<doc> --edition=<edition>`. The Phase 6 ingest CLI handles the rest.

No code changes needed in the ingest engine itself; only the doc-slug registry and the new derivative tree.

References:

- [spec.md](./spec.md) Out of scope -- "The full FAA handbook catalog"
- [tools/handbook-ingest/](../../../tools/handbook-ingest/) (the Python pipeline that gets re-run)
- [spec.md](./spec.md) Success Criteria (the CLI the operator invokes)
