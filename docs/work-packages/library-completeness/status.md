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

**31 references readable in-app today.** That's PHAK + AFH + AVWX + AIM + 11 CFR parts + 7 whole-doc handbooks + 9 ACs. The in-app-readable list grew by 9 ACs after WP-AC shipped (#480, 2026-05-02); the 2026-05-03 session added 12 more (WP-CFR shipped 11; rename WP touched AMT-G/P naming).

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
| 5 | **WP-AC-V** (AC visibility) | ✅ Shipped 2026-05-02 (#480) | All 9 on-disk AC manifests seed as readable references via `kind: 'ac'` schema + `seedAcManifest` adapter + dispatcher case + `seed-mapping.ts` registry (9 entries). Manifest phase upserts the reference rows for all 9 manifests; the YAML phase enriches the 5 that match an existing YAML row. | The 4 manifests with no YAML row (`25-7`, `61-65`, `91-21-1`, `120-71`) seed as readable cards but with empty subjects + null primary_cert until YAML reconciliation lands. The 12 cards with NO manifest still need WP-AC-FULL (download + extract). |
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

### 4 manifests with NO YAML row (seeded readable, but missing curated metadata)

These all seed as readable references via the manifest phase (`seedAcManifest` upserts on `(document_slug, edition)`), but the YAML phase has no row to enrich them with subjects + `primary_cert`. They appear on `/library` with empty subjects.

| Manifest | DB slug / edition | Status |
| -------- | ----------------- | ------ |
| ac/120-71/b | `ac-120-71` / `AC 120-71B` | SOPs and Pilot Monitoring Duties. Pilot-relevant; missing from YAML, should be added. |
| ac/25-7/d   | `ac-25-7` / `AC 25-7D`     | Flight Test Guide for Certification of Transport Category Airplanes. NOT pilot-facing (engineering doc); probably should NOT have a card. |
| ac/61-65/j  | `ac-61-65` / `AC 61-65J`   | Certification: Pilots and Flight and Ground Instructors. Major pilot-facing AC; missing from YAML, MUST be added. |
| ac/91-21-1/d | `ac-91-21-1` / `AC 91.21-1D` | Use of Portable Electronic Devices Aboard Aircraft. Pilot-relevant; missing from YAML, should be added. |

Of these four, three should get YAML cards (`120-71`, `61-65`, `91-21-1`); one should either get a non-pilot-facing card or be removed from cache (`25-7` is a Part 25 transport-category cert doc, not pilot-facing). Tracked as the AC YAML reconciliation in the "Sequencing" section below.

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

### `aim-pcg.yaml` (Pilot/Controller Glossary)

1 card. The glossary entries are already inside the AIM manifest (`kind: 'glossary'`, 297 entries seeded as part of WP-AIM). The PCG umbrella card is currently a redundant link-only row. Decision needed:

- (a) Delete the PCG card from YAML; let AIM glossary entries be the authoritative target.
- (b) Make PCG its own corpus per ADR 019 §1.2 (it has a separate URL and TOC structure).

Spec §6 lists this implicitly under WP-AIM (which is shipped). Worth resolving as cleanup.

### `handbooks-noningested.yaml` (3 cards: `aih`, `faa-h-8083-2`, `afh-3B`)

Per spec §6 "Smells worth fixing along the way" #1: this YAML is mostly redundant after WP-SUB. Three of its rows have handbooks-extras equivalents at different `(slug, edition)` pairs (the dupe-row bugs captured in IDEAS.md). The fourth (`afh` at `FAA-H-8083-3B`) is the prior AFH edition kept for citation resolution.

**Resolution path** (deferred per spec): retire `migrate-references-to-structured.ts` bridge → delete redundant YAML rows → cross-update knowledge nodes' `source` strings.

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
2. **PCG decision** — delete YAML row OR promote to its own corpus. Small.
3. **WP-AC-FULL** (download + extract the 12 link-only AC cards)
   - Tasks: add 12 entries to `scripts/sources/config/ac.yaml` + `bun run sources download` (operator action) + extract + register + content-only adds
   - Adds 12 readable references; total AC readable will be 21 (17 YAML + 4 manifest-only)
4. **AC YAML reconciliation** (orthogonal to WP-AC-FULL):
   - Add `ac-120-71`, `ac-61-65`, and `ac-91-21-1` cards to YAML (manifests already shipped via #480)
   - Decide on `ac-25-7` (Part 25 cert doc, probably remove from cache or tag as engineering-only)
5. **`study.reference` dupe-row sweep** (per IDEAS.md entry):
   - Delete `aim`/`current` orphan, `aih`/`9B` dupe, `faa-h-8083-2`/`2A` dupe
   - Decide on `afh`/`3B` (intentional supersede chain, or delete)
   - Pattern matches PR #461

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
