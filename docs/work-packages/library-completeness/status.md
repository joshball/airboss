---
title: 'Library completeness status (snapshot)'
product: study
feature: library-completeness
type: status
status: unread
review_status: done
snapshot_date: 2026-05-03
---

# Library completeness status

Where each item from [spec.md §6 (Recommended sequence)](spec.md#6-recommended-sequence) stands today, plus the manifest-vs-card gap that the spec's snapshot didn't address.

## Headline

**31 references readable in-app today.** That's PHAK + AFH + AVWX + AIM + 11 CFR parts + 7 whole-doc handbooks + 9 ACs. The in-app-readable list grew by 9 ACs after WP-AC shipped (#480, 2026-05-02); the 2026-05-03 session added 12 more (WP-CFR shipped 11; rename WP touched AMT-G/P naming). The references cleanup sweep enriched 4 of the 9 readable AC cards with curated metadata + retired 2 dupe handbook rows + retired the AIM `current` orphan.

**~28 references catalogued but NOT readable.** Cards exist on `/library` (showing "external link"); no `reference_section` rows seeded.

**Manifest-vs-card gap is bigger than I described in [stage-status.md](../../ingestion-pipeline/stage-status.md).** The earlier snapshot reported "9 manifests, 17 AC cards" as if the gap was just adapter wiring. The real gap has three flavors:

- **Cards lacking manifests** (need download + extract + register, NOT just a seed adapter).
- **Manifests lacking cards** (extracted but no YAML row to wire them up).
- **Cards lacking BOTH manifests AND a corpus pipeline** (umbrella references; new corpus required).

## Per-WP status (against spec.md §6)

| # | WP | Status | What's done | What's blocking |
| - | -- | ------ | ------------ | --------------- |
| 1 | **WP-SUB** (substrate) | ✅ Shipped 2026-05-01 (#393 + #396) | `reference_section` substrate, two-shape seeder dispatch, `getReadableReferenceIds()` content-based, primary_cert column preserved | — |
| 2 | **WP-MTN** (Mountain Flying pamphlet) | ✅ Shipped 2026-05-03 | Hand-cleaned override at `scripts/sources/config/handbooks-extras-overrides/faa-mtn-tips.md` via the `body_override` mechanism (#489); seeded as whole-doc | — |
| 3 | **WP-AIM** | ✅ Shipped (pre-session) | 744 entries (10 chapters + 38 sections + 396 paragraphs + 297 glossary terms + 3 appendices) seeded as section-tree | — |
| 4 | **WP-CFR-V** (CFR seed) | ✅ Shipped 2026-05-03 (#491) | 825 sections across 11 references; `kind: 'cfr'` schema + `seedCfrManifest` adapter + dispatcher case + `kind: 'cfr'` backfilled on 3 manifests | — |
| 5 | **WP-AC-V** (AC visibility) | ✅ Shipped 2026-05-02 (#480), reconciliation followup ✅ shipped via references cleanup sweep | All 9 on-disk AC manifests seed as readable references via `kind: 'ac'` schema + `seedAcManifest` adapter + dispatcher case + `seed-mapping.ts` registry (9 entries). YAML phase now enriches all 9 (4 missing rows added in cleanup sweep: `ac-25-7`, `ac-61-65`, `ac-91-21-1`, `ac-120-71`). | The 12 cards with NO manifest still need WP-AC-FULL (download + extract). |
| 6 | **WP-ACS-V** (ACS visibility) | 🟡 Partial — gap still open | 5 of the 7 ACS cards have on-disk manifests. Schema + adapter NOT yet built. | Need `kind: 'acs'` schema (deepest tree of any corpus: publication → area → task → element), `seedAcsManifest` adapter, dispatcher case. PLUS: 2 cards lack manifests (`cfii-airplane-pts-9e`, `faa-g-acs-2-companion-guide`). PLUS: ACS slug edition mapping (gap 2 from broad survey) needs reconciliation. |
| 7 | **WP-CC** (Chief Counsel) | ❌ Not started | Has umbrella card via `course/references/other-publications.yaml` | New corpus pipeline: source/extract/register. ADR 019 already provisions the URI. |
| 8 | **WP-NTSB-ALJ** | ❌ Not started | Has umbrella card via `course/references/ntsb.yaml` | New corpus pipeline. NTSB has its own data model (accident reports, recommendations, factual reports). |
| 9 | **WP-SAFO + WP-INFO** | ❌ Not started | No cards yet | New corpus pipeline (DRS-first per spec §4.C/4.D ratification). |
| 10 | **WP-AC-FULL** | ❌ Not started | Depends on WP-AC-V landing first | Expand AC config from 17 → ~50 curated-relevance ACs. Content-only WP. |
| 11 | **WP-O8900-V5** | ❌ Deferred | — | Trigger to revisit per spec: "we ship CFI training content that benefits from Vol 5." |
| 12 | **WP-SAFETY-BRIEF** | ❌ Deferred | — | Per spec §5 ratification (low priority). |

## AC gap detail (the manifest-vs-card mismatch)

`course/references/advisory-circulars.yaml` lists 17 AC cards. `find ac -name manifest.json` returns 9 on-disk manifests. As of WP-AC (#480) the seed adapter dispatches every on-disk manifest, so all 9 ACs are readable in-app. The remaining gap is asymmetric:

### 12 cards with NO manifest (need full pipeline: download → extract → register → seed)

| Card slug | What it is | Why it's still link-only |
| --------- | ---------- | ------------------------ |
| ac-00-24 | Thunderstorms | Not in `scripts/sources/config/ac.yaml` → no download |
| ac-00-45 | Aviation Weather Services | Same |
| ac-60-22 | Aeronautical Decision Making | Same |
| ac-61-27 | Instrument Flying Handbook (legacy AC; superseded by FAA-H-8083-15B but still cited) | Same |
| ac-61-67 | Stall and Spin Awareness Training | Same |
| ac-61-84 | Role of Preflight Preparation | Same |
| ac-61-134 | General Aviation Controlled-Flight-Into-Terrain Awareness | Same |
| ac-90-100 | U.S. Terminal and En Route Area Navigation (RNAV) Operations | Same |
| ac-91-23 | Pilot's Weight and Balance Handbook | Same |
| ac-91-44 | Operational and Maintenance Practices for Emergency Locator Transmitters and Receivers | Same |
| ac-91-74 | Pilot Guide: Flight in Icing Conditions | Same |
| ac-91-75 | Attitude Indicator | Same |

These need to be added to `scripts/sources/config/ac.yaml` first, then `bun run sources download && bun run sources register ac` produces manifests, THEN the seed adapter can wire them into `reference_section`.

### 4 manifests with NO YAML row -- RESOLVED in references cleanup sweep

All four manifests now have authored YAML rows in `course/references/advisory-circulars.yaml` so the library page renders them with subjects + primary_cert:

| Manifest | DB slug / edition | YAML row added |
| -------- | ----------------- | -------------- |
| ac/120-71/b | `ac-120-71` / `AC 120-71B` | subjects: procedures, human-factors, training-ops |
| ac/25-7/d   | `ac-25-7` / `AC 25-7D`     | subjects: aerodynamics, performance (engineering doc, kept per "anything downloaded gets a card") |
| ac/61-65/j  | `ac-61-65` / `AC 61-65J`   | subjects: certification, regulations, training-ops; primary_cert: cfi |
| ac/91-21-1/d | `ac-91-21-1` / `AC 91.21-1D` | subjects: regulations, procedures, aircraft-systems |

After the cleanup sweep: 21 AC YAML rows (was 17). All 9 on-disk manifests are now enriched.

## ACS gap detail

`course/references/acs-pts.yaml` lists 7 ACS cards. `find acs -name manifest.json` returns 5 on-disk manifests.

### 2 cards with NO manifest

| Card slug | What it is | Path forward |
| --------- | ---------- | ------------ |
| cfii-airplane-pts-9e | CFI-Instrument PTS (still on PTS, not converted to ACS) | Different doc shape (PTS vs ACS); decide whether to ingest as ACS-shape or skip until FAA converts |
| faa-g-acs-2-companion-guide | ACS Companion Guide for Pilots | Add to `scripts/sources/config/acs.yaml`, fetch, extract |

### Slug edition mismatch (broad-survey gap 2)

The 5 on-disk manifest slugs are `ir-airplane-8c`, `ppl-airplane-6c`, `cfi-airplane-25`, `cpl-airplane-7b`, `atp-airplane-11a`. The 7 YAML card slugs are `ppl-airplane-acs-6c`, `ir-airplane-acs-8c`, `cpl-airplane-acs-7b`, `cfi-airplane-acs-25`, `cfii-airplane-pts-9e`, `atp-airplane-acs-11a`, `faa-g-acs-2-companion-guide`.

Pattern: YAML uses `<rating>-<aircraft-type>-acs-<edition>`, manifests use `<rating>-<aircraft-type>-<edition>` (no `-acs-` infix). Need a slug-mapping pass before any seeder can join them.

## CFR — does WP-CFR cover everything we need?

**Short answer: yes, for what's in scope today.**

The CFR YAML lists 11 cards: 14 CFR Parts 1, 14, 23, 61, 68, 71, 73, 91, 135, 141 + 49 CFR Parts 830, 1552. All 11 are seeded as of #491. Per-part section counts in [stage-status.md](../../ingestion-pipeline/stage-status.md).

**What's NOT covered:** the ~217 long-tail CFR-14 parts that exist in `regulations/cfr-14/2026-04-22/sections.json` but don't have DB cards. Per WP-CFR spec, those are out of scope ("regulator-facing rules pilots almost never cite — Part 33 engine certification, Part 27 helicopter certification, etc."). If a future content authoring pass needs to cite something like §27.143 (helicopter rotor strength), an ad-hoc card can be added in the YAML and the existing seeder picks it up.

**Edition currency:** `regulations/cfr-14/2026-04-22/manifest.json` is the current Title 14 edition (April 2026). `regulations/cfr-49/` has both `2026-04-20` and `2026-04-24` directories — same data, two snapshot dates. Not a drift bug, just two ingestion runs both kept.

## Other corpora — pipeline status

### `aim-pcg.yaml` (Pilot/Controller Glossary) -- RESOLVED in references cleanup sweep

1 card. Resolved as a citation-fallback umbrella (option (a) variant). The glossary entries already inside the AIM manifest (`kind: 'glossary'`, 297 entries seeded as part of WP-AIM) are the authoritative target. The umbrella row stays so the migrator's hardcoded `(pcg, current)` resolver routes legacy bare-PCG citations to an authored row instead of upserting a synthetic. Same pattern as `generic-acs`/`generic-pts` in `other-publications.yaml`.

Retire trigger: every legacy PCG citation re-pointed at a specific AIM glossary paragraph reference, AND the migrator's PCG resolver removed.

### `handbooks-noningested.yaml` (1 card: `afh-3B`) -- partially RESOLVED in references cleanup sweep

Was 3 cards. The two dupes (`aih`/`FAA-H-8083-9B`, `faa-h-8083-2`/`FAA-H-8083-2A`) were retired in the cleanup sweep -- the migrator's AIH and RMH patterns now point at the canonical handbooks-extras `(slug, edition)` pairs (`aviation-instructor`/`8083-9`, `risk-management`/`8083-2A`), so legacy citations resolve to the authored row instead of upserting synthetics.

**Remaining row:** `afh` at `FAA-H-8083-3B`. Prior AFH edition kept for citation resolution; retiring it requires a content audit that re-points every node's `source` string from 3B to 3C. Low priority; tracked as deferred.

### `ntsb.yaml` (1 umbrella)

Link-only umbrella. Promoting to a real corpus is WP-NTSB-ALJ (#8 in spec §6). Per-report identifiers per ADR 019 §1.2.

### `poh.yaml` (1 umbrella)

Per-aircraft, user-uploaded. Different pipeline entirely (user upload, per-account). Not a corpus pipeline candidate. Stays as umbrella.

### `other-publications.yaml` (8 cards)

Most are intentionally link-only umbrellas:

- `aopa-air-safety-institute` — external resource
- `faa-p-8740-36`, `faa-order-8260-3` — could be ingested but low priority
- `faa-approach-plates`, `jeppesen-faa-charts` — per-airport, separate workflow
- `rogers-d-f` — academic citation, not a corpus
- `generic-acs`, `generic-pts` — fallback umbrellas for citations without a specific edition tag

None block library completeness.

## Sequencing — what to do next, ordered

Per spec §6 ratified order, with current detail and per-task estimate of complexity (NOT time):

### Near-term — 3-4 PRs to "all-FAA-references-readable" land

1. **WP-ACS-V** (extract + seed the 5 already-cached ACS)
   - Tasks: add `kind: 'acs'` discriminator (section-tree, 4 levels deep) + `seedAcsManifest` adapter + dispatcher case + slug-edition mapping fix (broad-survey gap 2) + tests
   - Pattern is novel (deepest tree), reference is WP-CFR (#491) for the section-tree dispatcher pattern
   - Adds 5 readable references; remaining 2 cards stay link-only
   - Scope: bigger than AC because of the 4-level tree + slug mapping
2. **PCG decision** — ✅ shipped via references cleanup sweep (kept as citation-fallback umbrella).
3. **WP-AC-FULL** (download + extract the 12 link-only AC cards)
   - Tasks: add 12 entries to `scripts/sources/config/ac.yaml` + `bun run sources download` (operator action) + extract + register + content-only adds
   - Adds 12 readable references; total AC readable will be 21 (all from YAML, 9 already manifest-backed)
4. **AC YAML reconciliation** — ✅ shipped via references cleanup sweep (4 rows added: `ac-25-7`, `ac-61-65`, `ac-91-21-1`, `ac-120-71`).
5. **`study.reference` dupe-row sweep** — ✅ shipped via references cleanup sweep (orphan + dupes resolved; `afh`/`3B` deferred behind content audit).

After the above PRs land: roughly **40+ readable references** out of ~49 catalogued. Remaining link-only: NTSB umbrella, POH umbrella, `other-publications.yaml` umbrellas (intentional).

### Medium-term — new-corpus pipelines

5. **WP-SAFO** + **WP-INFO** (combined or sequential — pipelines are identical)
   - Tasks: source config + downloader + extractor + schema discriminator + seed adapter + content
   - Per spec §4.C/4.D ratification: DRS-first, with `canonical_url_override` field for stable URLs
   - Adds ~30-50 SAFOs and ~20-30 InFOs

6. **WP-CC** (Chief Counsel interpretations)
   - Tasks: same shape as SAFO + content (~100-200 published opinions)
   - Highest pedagogical leverage of the §4 candidates (per spec)
   - Big build because legal opinions are dense and need careful extraction

### Longer-term — major corpus builds

7. **WP-NTSB-ALJ** (NTSB administrative law judge rulings)
   - Different data model from FAA publications (accidents, factual reports, recommendations)
   - Major pedagogical value (real accidents drive scenario authoring) but not a near-term blocker

### Deferred

8. **WP-O8900-V5** — trigger: CFI content needs Vol 5
9. **WP-SAFETY-BRIEF** — low priority
10. **POH per-aircraft** — separate product feature (user upload), not a backlog WP

## What "all references done" looks like

If the goal is "every catalogued card on `/library` shows 'Read in-app' (cross-linking deferred)":

| Path                     | Refs unlocked         | Effort                   |
| ------------------------ | --------------------- | ------------------------ |
| Today (incl. WP-AC #480) | 31                    | shipped                  |
| + WP-ACS-V               | +5 (36)               | medium                   |
| + AC YAML reconciliation | +0 (already readable) | tiny (metadata only)     |
| + WP-AC-FULL             | +12 (48)              | small (download+content) |
| + PCG decision           | +/- 1                 | tiny                     |
| + dupe-row cleanup       | -3 to -4 (37-44 net)  | tiny                     |
| + WP-SAFO + WP-INFO      | +50-80 (~95-125)      | medium                   |
| + WP-CC                  | +100-200 (~195-325)   | big                      |
| + WP-NTSB-ALJ            | +N (varies on scope)  | big                      |

After WP-ACS-V + AC reconciliation + WP-AC-FULL + cleanup: **~40 references readable, covering all FAA pilot-track publications already on disk**. That's the "ship-without-new-corpus-builds" target.

## Anchors

- [spec.md](spec.md) — the canonical library-completeness spec (v3, ratified 2026-05-01)
- [stage-status.md](../../ingestion-pipeline/stage-status.md) — per-corpus pipeline-stage view (1-5)
- [ADR 019](../../decisions/019-reference-identifier-system/decision.md) — `airboss-ref:` URI scheme
- [WP-CFR](../wp-cfr/spec.md) — pattern for new section-tree adapters
- [WP library-substrate](../library-substrate/spec.md) — the substrate that made all this possible
