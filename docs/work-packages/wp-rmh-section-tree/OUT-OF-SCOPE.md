---
title: 'Out of Scope: WP-RMH -- Risk Management Handbook section-tree promotion'
product: course
feature: wp-rmh-section-tree
type: out-of-scope
status: unread
---

# Out of Scope: WP-RMH -- Risk Management Handbook section-tree promotion

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

The source is the "Out of scope" section of [spec.md](./spec.md). WP-RMH shipped 2026-05-03 (commit 76df6154, PR #537) promoting Risk Management Handbook (FAA-H-8083-2A) from whole-doc to section-tree (12 chapters: Ch.1-8 + Appendix A-D, 54 sections, 46 subsections). The items below are everything the WP explicitly left out.

## Summary

| Item                                                 | Status       | Trigger to revisit                                                            |
| ---------------------------------------------------- | ------------ | ----------------------------------------------------------------------------- |
| AIH, IFH, IPH, mtn-tips section-tree promotions      | Follow-on WP | Each promotion runs as its own WP (AIH and IFH have since shipped)            |
| `_override_edition` outdated `HandbookConfig` subset | Deferred     | When `_override_edition` is exercised against a field the carry-forward drops |
| Errata application for RMH                           | Deferred     | When FAA publishes an errata sheet for FAA-H-8083-2A (none as of 2026-05-03)  |

## AIH, IFH, IPH, mtn-tips section-tree promotions

Status: Follow-on WP

What was postponed:
Promoting the other four whole-doc handbooks (Aviation Instructor's Handbook, Instrument Flying Handbook, Instrument Procedures Handbook, Tips on Mountain Flying) from the `handbooks-extras` whole-doc pipeline to section-tree extraction. Each handbook ships its own authored structure and earns its own WP.

Why:
Per [spec.md](./spec.md) Out of scope line 1: each promotion is a separate WP. WP-RMH establishes the chapter-aware Python pipeline pattern (bookmark outline + `bookmark_chapter_filter` + `primary_cert` round-trip) that the follow-on promotions reuse. Bundling them into one WP would have hidden per-handbook quirks (RMH's L1 front-matter intermix, the L4-cap drop) inside a larger surface and slowed the first promotion. The sequence is laid out in [docs/.archive/work-packages/2026-05/whole-doc-promotion/sequence.md](../../.archive/work-packages/2026-05/whole-doc-promotion/sequence.md).

Trigger that fires each follow-on:
Each handbook earns a dedicated WP when its turn comes in the promotion sequence. As of 2026-05-11: AIH shipped as [wp-aih-section-tree](../wp-aih-section-tree/) and IFH shipped as [wp-ifh-section-tree](../wp-ifh-section-tree/). IPH and mtn-tips remain unpromoted in `scripts/sources/config/handbooks-extras.yaml`.

Implementation pattern when triggered:
Mirror the WP-RMH shape end-to-end. For each remaining handbook:

- Author `scripts/sources/config/handbooks/<slug>.yaml` modeled on `risk-management.yaml` (or `avwx.yaml` if no front-matter filter needed).
- Apply `outline_strategy: bookmark` + `bookmark_chapter_filter` if the bookmark tree intermixes front-matter / back-matter L1 entries.
- Set `primary_cert` + `subjects[]` from the FAA handbook page.
- Run `bun run sources extract handbooks <slug>` then `bun run sources register`.
- Remove the slug from `handbooks-extras.yaml`, drop the doc_id from `DOC_ID_TO_FRIENDLY` and `FRIENDLY_DISPLAY` in `libs/sources/src/handbooks-extras/ingest.ts`, update the live-cache count in `ingest.test.ts`.
- Update `docs/platform/REFERENCES.md` row whole-doc -> section-tree.

References:

- [spec.md](./spec.md) -- Out of scope line 1
- [docs/.archive/work-packages/2026-05/whole-doc-promotion/sequence.md](../../.archive/work-packages/2026-05/whole-doc-promotion/sequence.md) -- planned promotion order
- [docs/.archive/work-packages/2026-05/whole-doc-promotion/research.md](../../.archive/work-packages/2026-05/whole-doc-promotion/research.md) -- per-handbook structure analysis (RMH section)
- [wp-aih-section-tree](../wp-aih-section-tree/) -- AIH follow-on (shipped)
- [wp-ifh-section-tree](../wp-ifh-section-tree/) -- IFH follow-on (shipped)
- `scripts/sources/config/handbooks-extras.yaml` -- remaining whole-doc entries (IPH, mtn-tips)

## `_override_edition` outdated `HandbookConfig` subset

Status: Deferred

What was deferred:
Auditing and refreshing the `_override_edition` carry-forward in `tools/handbook-ingest/ingest/cli.py`. It rebuilds a fresh `HandbookConfig` for an edition override (`--edition <X>`) by copying a hand-maintained subset of fields from the loaded config. That subset has drifted from the live `HandbookConfig` shape: when a new field gets added to `HandbookConfig`, `_override_edition` silently drops it on edition-override runs.

Why:
Per [spec.md](./spec.md) Out of scope line 2: this is pre-existing tech debt, "not introduced or worsened by this WP." WP-RMH adds `bookmark_chapter_filter` and `primary_cert` to `HandbookConfig`, and threads both through `_override_edition` (per [tasks.md](./tasks.md) Phase 1 "Wire it through `_override_edition` carry-forward"). The full audit of every field is a separate cleanup pass, not in scope for the RMH promotion.

Trigger to revisit:
When `_override_edition` is exercised against a field its carry-forward silently drops. Concretely: an edition-override run produces a manifest that's missing a configured field (subjects, errata, page_offset, etc.) that was set on the base config. The symptom surfaces as a re-ingest erasing data the previous run wrote (the same shape as the original `primary_cert` regression in #390).

Implementation pattern when triggered:
Refactor `_override_edition` from a hand-maintained field list to a structured rebuild: clone the loaded `HandbookConfig` via `dataclasses.replace(config, edition=edition, ...)` so every field flows through automatically, and any future `HandbookConfig` addition stays in carry-forward by default. The minimal alternative is auditing every `HandbookConfig` field against the current carry-forward and adding the missing ones, but the dataclass-replace approach is more durable.

References:

- [spec.md](./spec.md) -- Out of scope line 2
- `tools/handbook-ingest/ingest/cli.py` -- `_override_edition` definition
- `tools/handbook-ingest/ingest/config_loader.py` -- `HandbookConfig` dataclass
- PR #390 -- the original `primary_cert` carry-forward gap (same failure shape)

## Errata application for RMH

Status: Deferred

What was deferred:
Wiring an errata application step into the RMH ingest. The YAML at `scripts/sources/config/handbooks/risk-management.yaml` carries an empty `errata: []` placeholder, and the extraction pipeline does not currently consume it for this handbook because there are no errata to apply.

Why:
Per [spec.md](./spec.md) Out of scope line 3: "Errata application for RMH (none published)." FAA has not published an errata sheet for FAA-H-8083-2A as of 2026-05-03. Building errata application logic for RMH with no input data would be speculative; the `errata: []` placeholder reserves the shape so a future amendment slots in without a YAML reshape. The errata-application flow itself is governed by [ADR 020](../../decisions/020-handbook-edition-and-amendment-policy.md), which is exercised through the other handbooks first.

Trigger to revisit:
When FAA publishes an errata sheet for FAA-H-8083-2A. Concretely, the FAA index page at <https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/risk_management_handbook> gains an "Errata" link or the bound PDF gets reissued with a `-errata-<date>.pdf` companion per ADR 020 §"Errata sheet shape."

Implementation pattern when triggered:
Mirror the errata handling once it's exercised on another handbook (the IFH follow-on `wp-ifh-errata` is the likely first instance per [wp-ifh-section-tree/OUT-OF-SCOPE.md](../wp-ifh-section-tree/OUT-OF-SCOPE.md)). Populate `errata: [...]` in `scripts/sources/config/handbooks/risk-management.yaml`, re-run `bun run sources extract handbooks risk-management --edition FAA-H-8083-2A`, and the section bodies regenerate with the corrections folded in.

References:

- [spec.md](./spec.md) -- Out of scope line 3
- `scripts/sources/config/handbooks/risk-management.yaml` -- the `errata: []` placeholder
- [ADR 020](../../decisions/020-handbook-edition-and-amendment-policy.md) -- handbook edition + amendment policy (errata sheet shape, application flow)
- [wp-ifh-section-tree/OUT-OF-SCOPE.md](../wp-ifh-section-tree/OUT-OF-SCOPE.md) -- IFH errata is queued as the first ADR-020 instance
