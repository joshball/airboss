# Stage status

Per-corpus pipeline status across the five ingestion stages. Snapshot date: 2026-05-03.

For *what* each stage means, see [pipeline.md](pipeline.md). For the per-asset cache inventory, see [inventory.md](inventory.md).

## The five stages

| Stage | What it means | Where it lives | Verifiable by |
| ----- | ------------- | -------------- | ------------- |
| 1. Sourced | Source PDF/HTML cached locally | `~/Documents/airboss-handbook-cache/` | `bun run sources download` produces bytes |
| 2. Extracted | Inline derivative produced (markdown body files + `manifest.json` declaring shape) | `<corpus>/<doc>/<edition>/` | `bun run sources register <corpus>` produces files |
| 3. Catalogued | A `study.reference` row exists; card renders on `/library` (link-only OK) | `study.reference` | YAML in `course/references/` (non-handbook) OR section-tree seed (handbook) |
| 4. Seeded | `study.reference_section` rows exist with `content_md` populated; in-app body renders | `study.reference_section` | `getReadableReferenceIds()` returns the ID; `/library` shows "Read in-app" badge |
| 5. Cross-linked | Citations from other content (knowledge nodes, scenario explanations) resolve to specific sections | `airboss-ref:<corpus>/<doc>/<edition>/<code>` URI scheme | Citation chips in study UI deep-link to the right section |

The line between stages 3 and 4 is what makes a reference go from "useful link" to "actually readable in app." The substrate work (WP-SUB → WP-EXTRAS-* → WP-AIM → WP-CFR) has been pushing references through that boundary.

## Per-corpus stage status

| Corpus | Sourced | Extracted | Catalogued | Seeded | Cross-linked |
| ------ | ------- | --------- | ---------- | ------ | ------------ |
| Handbooks (PHAK / AFH / AVWX) | ✅ | ✅ | ✅ | ✅ section-tree | partial |
| Handbooks-extras (RMH / AIH / IFH / IPH / mtn-tips, plus deferred AMT-G/P) | ✅ | ✅ | ✅ | ✅ whole-doc | minimal |
| AIM | ✅ | ✅ | ✅ | ✅ section-tree | not yet |
| **CFR (14 + 49)** | ✅ | ✅ (3 manifests, 11 cards) | ✅ | **✅ section-tree NEW (#491)** | not yet |
| AC | ✅ | partial (9 manifests, 17 cards) | ✅ | ❌ | not yet |
| ACS | ✅ | partial (5 manifests, 6 cards) | ✅ | ❌ | not yet |
| NTSB / SAFO / InFO / Chief Counsel | ❌ | ❌ | ✅ link-only umbrella | ❌ | n/a |
| POH | per-aircraft, user-uploaded; separate workflow | | | | |
| Other (TERPS / AOPA / plates) | manual link-only references; not pipeline candidates | | | | |

### What "(N manifests, M cards)" means

`N manifests` is stage 2 (Extracted) — the count of `manifest.json` files we have on disk. `M cards` is stage 3 (Catalogued) — the count of `study.reference` rows showing on `/library`. The two numbers diverge when extracted derivatives don't yet cover every catalogued card: some cards are link-only umbrellas that will never have on-disk derivatives, and some cards are queued for extraction.

For example, AC has 9 on-disk manifests covering specific advisory circulars (61-65J, 91-21-1D, etc.) but 17 DB cards: 9 with derivatives plus 8 link-only umbrellas (AC 60-22, AC 61-67, AC 90-100, etc.) that show as "link to FAA" until ingested.

## Readable reference count

**22 readable references on `/library`** as of 2026-05-03:

### Section-tree readable (15)

| Reference | Edition | Sections | Notes |
| --------- | ------- | -------- | ----- |
| PHAK | FAA-H-8083-25C | 850 | Section-tree handbook |
| AFH | FAA-H-8083-3C | 531 | Section-tree handbook |
| AVWX | FAA-H-8083-28B | 480 | Section-tree handbook |
| AIM | 2026-04 | 744 | Section-tree (WP-AIM) |
| 14 CFR Part 1 | 2026-04 | 3 | Section-tree (WP-CFR) |
| 14 CFR Part 14 | 2026-04 | 19 | Section-tree (WP-CFR) |
| 14 CFR Part 23 | 2026-04 | 68 | Section-tree (WP-CFR) |
| 14 CFR Part 61 | 2026-04 | 149 | Section-tree (WP-CFR) |
| 14 CFR Part 68 | 2026-04 | 6 | Section-tree (WP-CFR) |
| 14 CFR Part 71 | 2026-04 | 15 | Section-tree (WP-CFR) |
| 14 CFR Part 73 | 2026-04 | 11 | Section-tree (WP-CFR) |
| 14 CFR Part 91 | 2026-04 | 286 | Section-tree (WP-CFR) |
| 14 CFR Part 135 | 2026-04 | 200 | Section-tree (WP-CFR) |
| 14 CFR Part 141 | 2026-04 | 49 | Section-tree (WP-CFR) |
| 49 CFR Part 830 | 2026-04 | 6 | Section-tree (WP-CFR) |
| 49 CFR Part 1552 | 2026-04 | 16 | Section-tree (WP-CFR) |

### Whole-doc readable (7)

| Reference | Edition | Notes |
| --------- | ------- | ----- |
| Risk Management | 8083-2A | Whole-doc |
| Aviation Instructor | 8083-9 | Whole-doc |
| IFH | 8083-15B | Whole-doc |
| IPH | 8083-16B | Whole-doc |
| AMT-General | 8083-30B | Whole-doc (ingestion deferred per `handbooks-extras.yaml`; bytes still present and seeded) |
| AMT-Powerplant | 8083-32B | Whole-doc (same deferral) |
| Tips on Mountain Flying | mtn-2003 | Whole-doc, hand-curated body via `body_override` (#489) |

## Near-term gaps

Biggest remaining gaps for stage 4 (Seeded):

1. **AC**: 17 cards link-only despite 9 manifests on disk. Needs `kind: 'ac'` schema discriminator + seed adapter. Pattern is whole-doc per AC, similar to handbooks-extras.
2. **ACS**: 6 cards link-only with 5 manifests on disk. Needs `kind: 'acs'` schema + seed adapter. Section-tree pattern (publication → area → task → element).
3. **NTSB / SAFO / InFO / Chief Counsel**: link-only umbrellas; no extraction pipeline yet.

Cross-linking (stage 5) starts paying off once enough corpora are seeded that knowledge-node citations have real targets to deep-link to. Worth deferring until 4-5 corpora are at stage 4. AC and ACS are the next two; once they land, the cross-linking pass becomes worthwhile.

## Known dupe / orphan rows in `study.reference`

Four rows that look like leftover dupes (cleanup candidates, not yet a WP):

| Row | Issue |
| --- | ----- |
| `aim` edition `current` | Orphan placeholder; separate from the real `2026-04` row |
| `afh` edition `FAA-H-8083-3B` | Superseded prior edition still in DB (might be intentional supersede chain) |
| `aih` edition `FAA-H-8083-9B` | Duplicates `aviation-instructor 8083-9` (different slug, same handbook) |
| `faa-h-8083-2` edition `FAA-H-8083-2A` | Duplicates `risk-management 8083-2A` (different slug, same handbook) |

The two duplicate-slug bugs (`aih` / `faa-h-8083-2`) match the pattern fixed by PR #461. Worth a follow-up sweep WP. Captured in [IDEAS.md](../platform/IDEAS.md) under "Technical Approaches" if not already.

## Anchors

- [pipeline.md](pipeline.md): the five-step ETL walkthrough
- [tooling.md](tooling.md): tools at each stage
- [inventory.md](inventory.md): per-asset cached source listing (auto-generated)
- [ADR 019](../decisions/019-reference-identifier-system/decision.md): `airboss-ref:` URI scheme
- [WP library-substrate](../work-packages/library-substrate/spec.md): the substrate that made section-tree vs whole-doc dispatchable
- [WP library-completeness status](../work-packages/library-completeness/status.md): per-WP status against the spec's recommended sequence, full manifest-vs-card gap detail
