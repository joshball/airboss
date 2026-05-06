---
title: 'AFH 3B section-tree ingestion'
product: study
feature: afh-3b-ingestion
type: spec
status: deferred
review_status: pending
priority: low
related:
  - docs/decisions/018-source-artifact-storage-policy/decision.md
  - docs/decisions/019-reference-identifier-system/decision.md
  - docs/ingestion-pipeline/section-extraction-prompt-strategy.md
---

# AFH 3B section-tree ingestion

Bring the prior edition of the Airplane Flying Handbook (FAA-H-8083-3B) into the canonical section-tree pipeline so it lives alongside 3C, with chapters, sections, figures, tables, and a real reader page. Today 3B exists only as a single citation-target row seeded from `course/references/handbooks-noningested.yaml`; the supersedes chain hides it from primary cert library surfaces but it has no readable content.

## Why this matters

15 knowledge nodes (as of 2026-05-05) cite `FAA-H-8083-3B` directly in their `source` strings (stall-recovery, EFATO, traffic pattern, four-forces, slow-flight, and others -- run `grep -rn "8083-3B" course/knowledge/` for the live list). Those citations resolve to a stub today: the row exists so the reference name maps to *something*, but following the citation lands on "no link available." Proper ingestion gives those citations a real reader page and lets us deep-link to specific chapters and sections of 3B the same way we already can for 3C.

It also lets us drop `course/references/handbooks-noningested.yaml` entirely, removing the parallel non-manifest seed path that caused the original "two AFH editions on /library/cert/private" bug.

## Why deferred

Section extraction is a multi-session, human-paced task. Per [docs/ingestion-pipeline/section-extraction-prompt-strategy.md](../../ingestion-pipeline/section-extraction-prompt-strategy.md), extraction runs paste-to-Claude chapter by chapter, not as a sub-agent dispatch. 3C took ~18 chapters and several hundred figures; 3B will be similar. Until the citing nodes themselves become a higher pain point (a learner complaint, a rewrite of those nodes for 3C, or a renderer that highlights "no reader page" gaps), the supersedes-chain stub is good enough.

## Scope

1. **Source acquisition.** Locate the FAA-hosted 3B PDF (FAA archives the prior edition somewhere; the FAA Airplane Handbook landing page links the current edition only). Fetch into `$AIRBOSS_HANDBOOK_CACHE/afh/FAA-H-8083-3B/` per ADR 018.
2. **Manifest scaffolding.** Mirror the 3C layout: `handbooks/afh/FAA-H-8083-3B/manifest.json` + per-chapter directories. Use the 3C manifest as a structural template; chapter ordering and titles will differ (AFH reorganized between editions -- this is the load-bearing reason 3B citations can't be mechanically repointed to 3C).
3. **Section extraction.** Run `tools/handbook-ingest/` discover/fetch/normalize phases, then chapter-by-chapter section extraction via the prompt strategy in `tools/handbook-ingest/ingest/prompts/section-extraction/`. Pace is human-driven; there is no automated equivalent.
4. **Figure + table extraction.** Same pipeline as 3C.
5. **Reseed and verify.**
    - The manifest seeder's chain logic (`scripts/db/seed-references-from-manifest.ts:191-197`) auto-wires `supersededById: 3B -> 3C` once both editions are in the same manifest tree.
    - Drop the `afh` row from `course/references/handbooks-noningested.yaml`.
    - Drop the AFH-specific tail logic in `scripts/db/seed-references.ts` (the `slugsTouched` chain pass) once the YAML row is gone, *if* no other slug needs it.
6. **Citation hardening.** With both editions ingested, the 15 nodes citing 3B keep resolving correctly; optionally run a content audit to repoint any node whose claim is unchanged in 3C to the current edition. Out of scope here.

## Non-goals

- Not changing the library cert/topic/regulations/handbook UI. The substrate already handles two editions of one slug; this WP just populates the second one.
- Not auditing or rewriting the 15 citing nodes. They keep working as-is.
- Not deprecating 3B at the corpus level. Keeping it readable is the whole point.

## Acceptance

- `handbooks/afh/FAA-H-8083-3B/manifest.json` exists with the same shape as 3C.
- `seed-references-from-manifest` reports `supersededLinks >= 1` for the AFH slug after seeding both editions.
- `course/references/handbooks-noningested.yaml` no longer contains an `afh` row (and the file may be deleted entirely if it's the last entry).
- `/library/cert/private` shows one AFH row (3C as the current edition).
- Following a 3B citation from any of the 15 citing knowledge nodes lands on a real 3B reader page, not "no link available."

## Out of scope -- captured for future work

- Repointing knowledge-node citations from 3B to 3C where the chapter content is unchanged. Defer until either (a) those nodes are being edited for an unrelated reason, or (b) a renderer pass flags them. Triggered: NEVER autonomously; only on explicit content-audit request.
