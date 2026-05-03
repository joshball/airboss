# References roadmap (sequenced WP list)

Every work package that touches references, in the order they should ship. Cross-references the canonical reference list at [REFERENCES.md](REFERENCES.md) and the per-WP status at [docs/work-packages/library-completeness/status.md](../work-packages/library-completeness/status.md).

> **This is the sequence.** When dispatching parallel agents, this is the canonical list of what's safe to run together vs what blocks what.

## Sequence

### Wave 1 — Foundation (✅ shipped)

| WP | Effect | Status |
|----|--------|--------|
| WP-SUB | `reference_section` substrate; section-tree vs whole-doc dispatcher; `getReadableReferenceIds()` content-based | ✅ #393, #396 (2026-05-01) |
| WP-AIM | AIM seeded as section-tree (744 entries) | ✅ pre-session |
| WP-CFR-V | 11 CFR parts seeded as section-tree (825 sections) | ✅ #491 (2026-05-03) |
| WP-AC-V | 9 ACs seeded as whole-doc (will be promoted) | ✅ #480 (2026-05-02) |
| WP-ACS-V | 5 ACS publications seeded as section-tree (1,910 sections) | ✅ #501 (2026-05-03) |
| WP-MTN (whole-doc) | Mountain Flying as whole-doc with body override | ✅ #489 (2026-05-03) |
| AMT-G/P removal | Remove maintenance-tech handbooks from corpus | ✅ #505 (2026-05-03) |
| References cleanup sweep | AC YAML reconciliation, dupe-row cleanup, AIM orphan delete | ✅ #518 (2026-05-03) |

### Wave 2 — Section-tree promotions (🟡 partially in flight)

All dispatched 2026-05-03 ~18:50 UTC. See [whole-doc-promotion/sequence.md](../work-packages/whole-doc-promotion/sequence.md). After all 5 land, every whole-doc handbook is section-tree; `handbooks-extras` corpus is empty.

| WP | Effect | Strategy | Status |
|----|--------|----------|--------|
| WP-IFH | Instrument Flying Handbook → section-tree | TOC-file parser (no embedded TOC) | ✅ #525 (2026-05-03) |
| WP-MTN section-tree | Mountain Flying → section-tree | parse existing override markdown | 🟡 in flight |
| WP-RMH | Risk Management Handbook → section-tree | bookmark extraction (rich embedded TOC) | 🟡 in flight |
| WP-AIH | Aviation Instructor's Handbook → section-tree | Class A2 chapter PDFs + bookmark | 🟡 in flight |
| WP-IPH | Instrument Procedures Handbook → section-tree | Class A2 chapter PDFs + sidecar TOC PDF | 🟡 in flight |

### Wave 3 — Flightbag scaffold (✅ shipped)

| WP | Effect | Status |
|----|--------|--------|
| Flightbag scaffold | `apps/flightbag/`, `libs/library/`, `ROUTES.FLIGHTBAG_*`, `urlForReference()` | ✅ #524 (2026-05-03) |

### Wave 4 — Cleanup after Wave 2

After all 5 promotion WPs land:

| WP | Effect | Spec |
|----|--------|------|
| WP-EXTRAS-RETIRE | Delete `handbooks-extras` corpus + `kind: 'whole-doc'` | [spec](../work-packages/wp-handbooks-extras-retire/spec.md) |
| WP-AC-PROMOTE | Promote the 9 existing ACs from whole-doc to section-tree | (no spec yet — author when triggered) |

### Wave 5 — Citation migration

After Wave 3 lands and Wave 4 ships:

| WP | Effect | Spec |
|----|--------|------|
| WP-CITATION-CHIPS-TO-FLIGHTBAG | Rewire study citation chips to flightbag URLs via `urlForReference()` | [spec](../work-packages/wp-citation-chips-to-flightbag/spec.md) |
| WP-HANGAR-REFS | References admin dashboard (TOC validation, force-reingest, health checks) | [spec](../work-packages/wp-hangar-references-dashboard/spec.md) |
| WP-TOC-VALIDATION-SCHEMA | Per-doc validation manifest shape | [spec](../work-packages/wp-toc-validation-schema/spec.md) |

### Wave 6 — Link-only completion

These can run in parallel; each is independent.

| WP | Effect | Spec |
|----|--------|------|
| WP-AC-LINK-ONLY | Pipeline for the 12 link-only AC cards | [spec](../work-packages/wp-ac-link-only-pipeline/spec.md) |
| WP-ACS-LINK-ONLY | Pipeline for the 2 link-only ACS / PTS cards | [spec](../work-packages/wp-acs-link-only-pipeline/spec.md) |

### Wave 7 — New corpora

Each is independent; can run in parallel. All are larger builds (new corpus pipeline = new schema + new downloader + new extractor + new seeder).

| WP | Effect | Spec |
|----|--------|------|
| WP-SAFO + WP-INFO | SAFOs + InFOs (combined; identical pipeline shape) | [spec](../work-packages/wp-safo-info/spec.md) |
| WP-CC | FAA Chief Counsel legal interpretations | [spec](../work-packages/wp-cc/spec.md) |
| WP-NTSB-ALJ | NTSB administrative law judge rulings | [spec](../work-packages/wp-ntsb-alj/spec.md) |

### Wave 8 — Future / deferred

| WP | Trigger |
|----|---------|
| WP-AC-FULL | After WP-AC-LINK-ONLY; expand AC config from 21 → ~50 |
| WP-O8900-V5 | When CFI training content needs Vol 5 |
| WP-SAFETY-BRIEF | Low priority |
| Public-facing flightbag deploy | When platform goes external |
| `study.reference` dupe-row sweep (afh-3B) | After content audit re-points knowledge nodes from 3B to 3C |

## Parallelization rules

- **Wave 2 + Wave 3** can run in parallel (different files)
- **Within Wave 2**, all 5 promotions can run in parallel (different doc_ids); minor merge conflicts on `handbooks-extras.yaml` rebase cleanly
- **Wave 4 → Wave 5** is sequential (citation migration needs flightbag scaffold)
- **Wave 6 → Wave 7** can overlap if new-corpus WPs are picked up by separate teams; they share the dispatcher file but conflicts are mechanical

## Anchors

- [REFERENCES.md](REFERENCES.md) — canonical reference list with stage badges
- [docs/work-packages/library-completeness/status.md](../work-packages/library-completeness/status.md) — per-WP status detail
- [docs/work-packages/whole-doc-promotion/sequence.md](../work-packages/whole-doc-promotion/sequence.md) — Wave 2 + 3 in-flight tracking
- [ADR 019](../decisions/019-reference-identifier-system/decision.md) — `airboss-ref:` URI scheme
