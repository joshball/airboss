---
title: 'Library taxonomy: by-cert primary, topic cross-cut, regulations top-level'
product: study
feature: library-by-cert
type: spec
status: building
review_status: pending
---

# Library taxonomy proposal

## Problem

`/library` currently groups every active `study.reference` row by `aviationTopic` (18 cross-cutting topics defined in `libs/constants/src/reference-tags.ts:77`). Three concrete defects fall out:

- **Books duplicate.** PHAK and AFH carry 3-4 topics each, so each card renders under every topic it tags. PHAK appears under Procedures + Aerodynamics + Aircraft Systems + Performance.
- **The cert dimension is invisible.** A PPL learner cannot see "what should I read for PPL?" without scanning every group.
- **The "in-app readable" badge is conflated with corpus presence.** `getReadableReferenceIds` (`libs/bc/study/src/handbooks.ts:501`) probes for at least one non-chapter `handbook_section` row. That probe is correct for handbook-style readers but is cosmetic, not a visibility filter; the page surfaces every active reference row regardless. The user's perception that "only PHAK + AFH show up" reflects which rows are actually seeded and tagged with topic chips, not the probe behaviour. AVWX, AIM, CFR-14, ACs, ACSes are all in the catalog (52 reference rows across 8 YAMLs in `course/references/`); they appear as cards but get scattered or buried.

The 9,800-entry broad-extraction inventory (see `docs/work-packages/library-broad-extraction-survey/findings.md`) sharpens the urgency: most queryable corpora have no first-class home in today's grouping.

## Proposed taxonomy

```text
Library
  By certificate / rating          # primary spine -- cert is how learners study
    Student
    Sport / Recreational
    Private (PPL)
    Instrument (IR)
    Commercial (CPL)
    CFI / CFII / MEI
    ATP
  By topic                         # cross-cut -- domain-of-knowledge browsing
    Weather, Navigation, Airspace, Aerodynamics, ...
  Regulations & policy             # dense, cross-cutting, separate spine
    14 CFR (browse by Part)
    49 CFR (parts 830, 1552)
    AIM (browse by Chapter)
    Advisory Circulars (by series: 00 / 60 / 61 / 90 / 91 / 120 / 150)
    NTSB reports (umbrella; per-report rows when Phase 10 lands)
    Chief Counsel interpretations    # not yet ingested -- placeholder + URL
    SAFOs / InFOs                    # not yet ingested -- placeholder + URL
    FAA Order 8260.3 (TERPS), other Orders
  Aircraft-specific                # POH / AFM umbrella + per-tail rows when seeded
```

Three top-level spines (cert, topic, regulations) plus an aircraft-specific bin. A card always has one **primary placement** in the cert spine (or in regulations if it has no cert affinity) and renders as a cross-listed entry under any topics it tags. Topic groups dedupe so PHAK appears once per topic, not once per duplicate-tag.

## Open questions to ratify

Five decisions the user must sign off on before implementation. Each carries a recommendation; ratify or override.

### Q1: How do books that span multiple certs render? (ratify)

| Option | Shape | Trade-off |
| ------ | ----- | --------- |
| A. Primary cert + carryover  | PHAK lives under PPL. CPL page shows a "carryover from PPL" sidebar that lists PHAK, AFH, FOI material. | One canonical home per book. CPL learner gets a clear "still relevant" cue. Renders once in the data; sidebar is a query. |
| B. Multi-cert membership     | PHAK appears under PPL and CPL. Card shows "shared with PPL, CPL" badge. | Easier to scan a cert page; harder to author (which cert "owns" the book?). De-dup logic gets fuzzier. |

**Recommendation: A.** Each reference has one `primary_cert` (or `null` for cross-cutting like CFR / AIM). The cert page shows its primary refs plus a "carryover from prerequisite certs" section computed from `CredentialPrereq` (ADR 016). This matches how pilots actually study (PHAK is a PPL book that you keep on the shelf for CPL) and keeps the data model boring.

### Q2: Where do non-obvious legal / policy docs live? (ratify)

The user listed: NTSB rulings, FAA Chief Counsel interpretations, federal court rulings, SAFOs, InFOs, FAA Order 8900.1.

| Option | Placement | Trade-off |
| ------ | --------- | --------- |
| A. All under "Regulations & policy"     | One spine. Sub-headings: CFR, AIM, ACs, NTSB, Chief Counsel, SAFO/InFO, Orders, Court rulings. | Stretches the label "regulations" but matches how a CFI thinks ("legal stuff"). One place to look. |
| B. Split into "Regulations" + "Legal & policy" | CFR + AIM + ACs in Regulations; Chief Counsel + court + NTSB rulings in Legal & policy. | Cleaner labels. Two top-levels for material that's structurally identical (legalese with citations). |
| C. Sidebar on each cert                  | Surface relevant legal/policy docs in a per-cert "legal context" box. | Loses the canonical browse surface. Hard to discover. Wrong for case-law that's cross-cutting. |

**Recommendation: A** with the spine renamed `Regulations & policy` (not just "Regulations"). Within that spine: visible sub-sections for CFR / AIM / ACs / NTSB / Chief Counsel / SAFOs+InFOs / FAA Orders / Court rulings. NTSB belongs here (case-law for accident investigations) even though `kind: ntsb` exists; the visual home is policy, not "miscellaneous reports."

### Q3: What happens to thinly-populated topic groups? (ratify)

`AVIATION_TOPICS` has 18 values (`reference-tags.ts:77`). With cert as primary, several topic groups fall to 1-3 references in cross-cut view (e.g. Weather contains AVWX + AC 00-6 + AC 00-24 + AC 00-45 + AC 91-74 = 5 entries; Medical contains 14 CFR 68 + nothing else; Maintenance contains a handful).

| Option | Shape | Trade-off |
| ------ | ----- | --------- |
| A. Keep all 18 topics                       | Empty/sparse groups render as collapsed sections with counts. | Completeness; predictable taxonomy. Empty sections feel unfinished. |
| B. Hide topics with < 2 members             | Sparse groups disappear until a 2nd member is seeded. | Tidier UI. Surface changes as content grows; harder to verify completeness. |
| C. Merge thin topics into closest cousin    | Medical merges into Human Factors; Maintenance into Aircraft Systems. | Cleaner browse but breaks 1:1 with `AVIATION_TOPICS` enum. |

**Recommendation: A**. Keep the full 18 because they're the source of truth for tagging across the platform (cards, scenarios, knowledge nodes). Visual rule: collapse-by-default any topic with < 4 entries; show a count badge. Don't let presentation rewrite the taxonomy.

### Q4: How does Title 14 (7,218 entries) render? (ratify)

`CFR Title 14` has 7,218 ingested rows (parts + subparts + sections) per the broad-extraction survey. Flat render is unusable.

| Option | Shape | Trade-off |
| ------ | ----- | --------- |
| A. Browse by Part, sections behind drill-in | Top level: 11 cards (Parts 14, 23, 61, 68, 71, 73, 91, 135, 141 + others). Click a Part -> Part page with subpart/section tree. | Matches how 14 CFR is studied. 11 cards fits one screen. Section detail lives on a per-Part route. |
| B. Browse by ACS Area                       | Group sections by which ACS task references them. | Powerful but requires the ACS->CFR mapping to be authored across all parts; we have it for Area V only. |
| C. Search-first, browse as fallback         | Lead with a search box ("find a CFR section"); de-emphasize browse. | Best for "I know what I want." Worst for "what's in here?" Discovery suffers. |

**Recommendation: A** for Phase 1; B as a Phase 2 enhancement once ACS coverage broadens (currently only PPL ACS Area V is wired per ADR 016 phase 4). Each Part card shows section count + which subjects it tags. The Part page is its own route; library `Regulations & policy -> 14 CFR` is the index.

### Q5: How does AIM (744 sections) render? (ratify)

| Option | Shape | Trade-off |
| ------ | ----- | --------- |
| A. Browse by Chapter | 11 chapter cards + 5 appendix cards (16 cards total). Click a chapter -> chapter page with section list. | Mirrors AIM's own structure. ~16 cards is browsable. |
| B. Flat with search   | Search-first; flat list scrolls. | Worse discovery. AIM's whole value is its chapter framing. |

**Recommendation: A**. Same render shape as 14 CFR -> Part: chapter cards in the index, drill-in for sections. AIM is already extracted with chapter tree (744 entries across 11 + 5 chapters); the route just needs to exist.

## Reference placement table

Every reference currently in `course/references/*.yaml` (52 rows) plus the broad-extraction corpora (PHAK, AFH, AVWX, AIM, CFR-14, CFR-49, ACs, ACSes). Primary placement is the proposed cert (or `Regs/policy` or `Topic` when cert-agnostic). User scans, ratifies or overrides per row.

### Handbooks

| Slug | Title | Kind | Primary placement | Carryover certs (Q1.A) | Topic chips |
| ---- | ----- | ---- | ----------------- | ---------------------- | ----------- |
| `phak` | Pilot's Handbook of Aeronautical Knowledge | handbook | Private | Sport, CPL, CFI | aerodynamics, weather, performance, weight-balance |
| `afh` (3C) | Airplane Flying Handbook | handbook | Private | Sport, CPL, CFI | procedures, aerodynamics, training-ops |
| `afh` (3B) | AFH (prior edition) | handbook | Private (legacy) | -- | (same as 3C) |
| `avwx` | Aviation Weather Handbook (FAA-H-8083-28) | handbook | Private | Instrument, CPL, CFI | weather |
| `aih` | Aviation Instructor's Handbook | handbook | CFI | -- | training-ops, human-factors |
| `ifh` | Instrument Flying Handbook | handbook | Instrument | CFII, CPL | procedures, navigation, flight-instruments |
| `iph` | Instrument Procedures Handbook | handbook | Instrument | CFII | procedures, navigation, flight-instruments |
| `faa-h-8083-2` | Risk Management Handbook | handbook | Private | CPL, CFI, all | human-factors |
| (cached, not yet seeded) Helicopter Flying Handbook | -- | handbook | (out of airboss scope until rotor cert lands; gap 5 in survey) | -- | -- |
| (cached, not yet seeded) AMT Airframe / Powerplant | -- | handbook | (out of scope; AMT cert is not in airboss today; gap 5) | -- | -- |

### CFR Title 14

| Slug | Part | Primary placement | Topic chips |
| ---- | ---- | ----------------- | ----------- |
| `14cfr14` | 14 (Equal Access) | Regs/policy -> 14 CFR | regulations |
| `14cfr23` | 23 (Airworthiness) | Regs/policy -> 14 CFR | regulations, aircraft-systems |
| `14cfr61` | 61 (Pilot certification) | Regs/policy -> 14 CFR | regulations, certification |
| `14cfr68` | 68 (BasicMed) | Regs/policy -> 14 CFR | regulations, medical |
| `14cfr71` | 71 (Class A-E airspace) | Regs/policy -> 14 CFR | regulations, airspace |
| `14cfr73` | 73 (Special use airspace) | Regs/policy -> 14 CFR | regulations, airspace |
| `14cfr91` | 91 (General ops + flight rules) | Regs/policy -> 14 CFR | regulations, procedures |
| `14cfr135` | 135 (Commuter / on-demand) | Regs/policy -> 14 CFR | regulations, procedures |
| `14cfr141` | 141 (Pilot schools) | Regs/policy -> 14 CFR | regulations, certification, training-ops |
| (broad-extraction adds ~7,200 sections under these Parts; not separately listed) | | | |

### CFR Title 49

| Slug | Part | Primary placement | Topic chips |
| ---- | ---- | ----------------- | ----------- |
| `49cfr830` | 830 (NTSB notification + reporting) | Regs/policy -> 49 CFR | regulations, emergencies |
| `49cfr1552` | 1552 (TSA Alien Flight Student Program) | Regs/policy -> 49 CFR | regulations, training-ops |

### AIM / PCG

| Slug | Title | Primary placement | Topic chips |
| ---- | ----- | ----------------- | ----------- |
| `aim` | Aeronautical Information Manual | Regs/policy -> AIM | procedures, communications, navigation |
| `pcg` | Pilot/Controller Glossary | Regs/policy -> AIM (Appendix) | communications |

### Advisory Circulars

| Slug | Edition | Primary placement | Topic chips |
| ---- | ------- | ----------------- | ----------- |
| `ac-00-6` | 00-6B Aviation Weather | Regs/policy -> ACs (00 series) | weather |
| `ac-00-24` | 00-24C Thunderstorms | Regs/policy -> ACs (00 series) | weather, emergencies |
| `ac-00-45` | 00-45H Aviation Weather Services | Regs/policy -> ACs (00 series) | weather |
| `ac-60-22` | 60-22 ADM | Regs/policy -> ACs (60 series) | human-factors |
| `ac-61-27` | 61-27C IFH (legacy) | Regs/policy -> ACs (61 series) | procedures, navigation, flight-instruments |
| `ac-61-67` | 61-67C Stall/Spin Awareness | Regs/policy -> ACs (61 series) | aerodynamics, emergencies |
| `ac-61-83` | 61-83K FIRC | Regs/policy -> ACs (61 series) | training-ops |
| `ac-61-84` | 61-84B Preflight Prep | Regs/policy -> ACs (61 series) | procedures |
| `ac-61-98` | 61-98D Flight Review / IPC | Regs/policy -> ACs (61 series) | regulations, certification |
| `ac-61-134` | 61-134 GA CFIT | Regs/policy -> ACs (61 series) | human-factors, navigation |
| `ac-90-66` | 90-66C Non-Towered Ops | Regs/policy -> ACs (90 series) | airports, communications, procedures |
| `ac-90-100` | 90-100A RNAV Ops | Regs/policy -> ACs (90 series) | navigation, procedures |
| `ac-91-23` | 91-23A Weight & Balance | Regs/policy -> ACs (91 series) | weight-balance, performance |
| `ac-91-44` | 91-44A ELT | Regs/policy -> ACs (91 series) | aircraft-systems, emergencies |
| `ac-91-74` | 91-74B Icing | Regs/policy -> ACs (91 series) | weather, emergencies |
| `ac-91-75` | 91-75 Attitude Indicator | Regs/policy -> ACs (91 series) | flight-instruments |
| `ac-91-79` | 91-79B Runway Overrun | Regs/policy -> ACs (91 series) | procedures, performance, airports |

### ACS / PTS

| Slug | Edition | Primary placement | Topic chips |
| ---- | ------- | ----------------- | ----------- |
| `ppl-airplane-acs-6c` | FAA-S-ACS-6C | Private | certification, training-ops |
| `ir-airplane-acs-8c` | FAA-S-ACS-8C | Instrument | certification, training-ops |
| `cpl-airplane-acs-7b` | FAA-S-ACS-7B | Commercial | certification, training-ops |
| `cfi-airplane-acs-25` | FAA-S-ACS-25 | CFI | certification, training-ops |
| `cfii-airplane-pts-9e` | FAA-S-8081-9E | CFII | certification, training-ops |
| `atp-airplane-acs-11a` | FAA-S-ACS-11A | ATP | certification, training-ops |
| `faa-g-acs-2-companion-guide` | FAA-G-ACS-2 | All certs (carryover) | certification, training-ops |
| `generic-acs` | umbrella | Regs/policy -> ACs (umbrella) | certification |
| `generic-pts` | umbrella | Regs/policy -> ACs (umbrella) | certification |

### Other / non-obvious

| Slug | Title | Primary placement | Topic chips |
| ---- | ----- | ----------------- | ----------- |
| `ntsb` | NTSB accident reports (archive) | Regs/policy -> NTSB | emergencies, human-factors |
| `poh-afm` | POH / AFM umbrella | Aircraft-specific | aircraft-systems, performance |
| `aopa-air-safety-institute` | AOPA ASI | Topic -> Human factors (no cert affinity) | human-factors, training-ops |
| `faa-p-8740-36` | FAA-P-8740-36 ADM | Regs/policy -> FAA Orders/policy | human-factors |
| `faa-order-8260-3` | TERPS 8260.3C | Regs/policy -> FAA Orders | procedures, navigation |
| `faa-approach-plates` | FAA Approach Plates | Topic -> Navigation (no cert affinity; cross-cutting) | procedures, navigation, airports |
| `jeppesen-faa-charts` | Jeppesen / FAA charts | Topic -> Navigation | navigation, airspace |
| `rogers-d-f` | The Possible Impossible Turn | Topic -> Emergencies | emergencies, aerodynamics |

### Newly visible after retaxonomy (gap-by-gap from broad-extraction survey)

| Survey gap | Today | After this WP |
| ---------- | ----- | ------------- |
| PHAK (gap baseline) | Visible, duplicated 4x | One card under PPL; topic chips render once in cross-cut |
| AFH (gap baseline) | Visible, duplicated 3x | One card under PPL |
| AVWX (gap baseline)  | Card exists; buried under Weather | Card under PPL with Weather topic chip; surfaces in Regs/policy if user navigates by topic |
| AIM (744 sections)   | One umbrella card, no chapter browse | Chapter-level index under Regs/policy -> AIM; per-chapter route lands users in section list |
| CFR-14 (7,218 sections) | Part umbrella cards exist, sections invisible | Browse-by-Part with section drill-in route under Regs/policy -> 14 CFR |
| CFR-49 (gap 1)        | Walker fails; no cards visible | Once gap 1 fixed, parts 830 + 1552 surface under Regs/policy -> 49 CFR |
| ACS (gap 2)           | 1/5 visible (PPL only)   | 5/5 visible under their certs once gap 2 fixed |
| AC (gap 3 + 4)        | 9 visible, 3 skipped     | 9 visible under Regs/policy -> ACs by series; gaps 3+4 deferred per survey recommendation |
| Handbooks-extras (gap 5) | 0 visible (Risk Mgmt, IFH, IPH, AIH already in `handbooks-noningested.yaml` so 4 visible; AMT-G/AMT-P/Helicopter not seeded) | Same after retaxonomy; gap 5 (whole-doc handbook pipeline) is a separate corpus-broadening WP |
| AFH duplicate-errata (gap 6) | Cosmetic; doesn't affect library | Unchanged (separate cleanup PR) |

The retaxonomy itself does not surface new corpora; it gives a sane home to the corpora already seeded plus a sane home for everything that lands when broad-extraction gaps are filled.

## Schema sketch

Two additive fields on `study.reference` (Drizzle, `libs/bc/study/src/schema.ts`):

| Field | Type | Notes |
| ----- | ---- | ----- |
| `primary_cert` | `text` (nullable) | One of `CERT_APPLICABILITIES` (`reference-tags.ts:216`) or null. Null = cert-agnostic; renders under Regs/policy or Topic spine only. |
| `cert_carryover` | `text[]` (default `'{}'`) | Other `CERT_APPLICABILITIES` values where this reference still applies. Drives the "carryover from prerequisites" sidebar (Q1.A). |

Both fields land in the YAML schema (`course/references/*.yaml`) as `primary_cert: private` and `cert_carryover: [sport, commercial, cfi]`. Validator (`libs/aviation/src/validation.ts`) enforces enum membership against `CERT_APPLICABILITY_VALUES`. Existing rows backfill from the placement table above.

`subjects: text[]` stays as-is; it remains the topic-chip source. No new topic enum.

The `Regulations & policy` spine is a render-time grouping by `kind in (cfr, ac, acs, pts, aim, pcg, ntsb, other-with-FAA-Order-publisher)`, not a stored field. Q2.A is a UI grouping; the data shape doesn't change for it.

Out of scope for this WP: actual SQL migration, route changes, page rewrite, tests. Those land in the build phase after sign-off.

## Out of scope

- Any code change. This is a proposal.
- Schema migration SQL.
- Per-Part / per-Chapter route rendering. The proposal says "drill-in to a Part page" but the Part page is a separate WP (likely under `regulations-browse`).
- Search-first surface.
- POH per-aircraft authoring (Phase 10 in ADR 016).
- ACS Area-of-Operation cross-mapping for CFR sections (Q4.B; Phase 2).
- Filling broad-extraction gaps 1-5 (separate small PRs per the survey's recommendation).

## Ratifications (2026-05-01)

The five Q1-Q5 questions above plus the schema sketch were ratified in conversation on 2026-05-01. This section is the durable record of what was decided vs proposed; future readers should trust the ratifications block over the recommendation prose above when they conflict.

### Q1-Q5 outcomes

| Question                  | Outcome | Notes                                                                                                                          |
| ------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Q1 multi-cert books       | A       | Primary cert + carryover sidebar. Carryover is **derived at render time**, not stored. See "Schema delta" below.               |
| Q2 legal/policy placement | A       | Single `Regulations & policy` spine. Render-time grouping by `kind`. No new stored field.                                      |
| Q3 sparse topic groups    | A       | Keep all 18 `AVIATION_TOPICS`. UI rule: collapse-by-default any topic with < 4 entries; show count badge. No data-shape change. |
| Q4 Title 14 render        | A       | Browse by Part with section drill-in. Index pages (per-Part) are part of Phase 1, not deferred.                                |
| Q5 AIM render             | A       | Browse by Chapter with section drill-in. Same shape as Q4. Chapter index pages part of Phase 1.                                |

### Schema delta from the original sketch

The original "Schema sketch" section above proposes two columns: `primary_cert` and `cert_carryover text[]`. **The `cert_carryover` column is dropped.** Carryover is derived at render time by walking the CredentialPrereq DAG via `getCertsCoveredBy()` (ADR 016 / `libs/bc/study/src/credentials.ts`).

Rationale: storing carryover as a column would duplicate the credential DAG. Any future change to PPL -> CPL prerequisites (e.g. adding Sport as a new node, restructuring Recreational) would have to be mirrored across every reference row's `cert_carryover[]` or rows would silently drift out of sync with the prereq graph. One source of truth wins.

Final shipped schema for Wave 1:

| Field          | Type              | Notes                                                                                                                               |
| -------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `primary_cert` | `text` (nullable) | One of `CERT_APPLICABILITY_VALUES` or NULL. NULL = cert-agnostic (renders only in topic + regulations spines). CHECK enforces enum. |

`subjects: text[]` stays as-is. The `Regulations & policy` spine is render-time grouping by `kind`, not a stored field.

### URL shape

**Option B** ratified: one canonical URL family `/library/cert/{cert}` + `/library/regulations/{kind}` + `/library/topic/{topic}` (Wave 3). The pre-existing `/library/[doc]/[chapter]/[section]` family will be **retired** in Wave 3 (replaced, not parallel-supported). Old URL doesn't survive the cutover.

### Phase 1 scope expansion

The original spec listed per-Part / per-Chapter routes as out of scope ("a separate WP, likely under regulations-browse"). **These are now in Phase 1** of this WP. Library Phase 1 ships:

- `/library` (three-spine landing)
- `/library/cert/{cert}` (per-cert page with carryover sidebar)
- `/library/regulations/{kind}` (e.g. 14 CFR index, AIM index)
- `/library/regulations/14-cfr/part-{N}` (per-Part section list with drill-in)
- `/library/regulations/aim/chapter-{N}` (per-Chapter section list with drill-in)
- `/library/topic/{topic}` (cross-cut topic page)

### Placement overrides applied during Wave 2 reseed

Two rows in the placement table get explicit overrides that diverge from a naive read:

| Slug                        | Override               | Why                                                                                                      |
| --------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------- |
| `aopa-air-safety-institute` | `primary_cert = 'cfi'` | Originally placed under "Topic -> Human factors (no cert affinity)"; CFI is the actual primary audience. |
| `faa-p-8740-36`             | `primary_cert = NULL`  | Renders in the AC 60-series group under Regulations & policy, not under any cert spine.                  |

### Wave breakdown

| Wave | Scope                                                                                                                                            |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | Ratifications + `primary_cert` schema + Drizzle migration + YAML schema + validator + smoke test (this PR).                                      |
| 2    | Reseed all 8 `course/references/*.yaml` with `primary_cert` per the placement table + 2 overrides above.                                         |
| 3    | Library route restructure (`/library/cert/...`, `/library/regulations/...`, `/library/topic/...`); retire old URL family; carryover BC function. |
| 4    | E2e tests for the new routes + manual test plan execution.                                                                                       |

- Wave 3b cleanup: retired `@deprecated` route aliases inline (no legacy left).

## Phase 2 design hooks

If the user wants to ratify and proceed, `design.md` in this directory will cover:

- Loader changes in `+page.server.ts` to compute the three-spine grouping in one query.
- Cert page shape (`/library/cert/{slug}`) + Regs page shape (`/library/regulations/{kind}`).
- The carryover-sidebar query (uses `CredentialPrereq` from ADR 016 Phase 2).
- Backfill script for `primary_cert` + `cert_carryover` columns from the placement table above.

`tasks.md` will sequence the migration, page rewrite, route additions, e2e tests.

## Ratification checklist

- Q1 Multi-cert books -> recommendation A (primary + carryover): **ratify or override**
- Q2 Legal/policy placement -> recommendation A (one "Regulations & policy" spine, sub-headings): **ratify or override**
- Q3 Sparse topic groups -> recommendation A (keep all 18, collapse < 4): **ratify or override**
- Q4 Title 14 render -> recommendation A (browse by Part, drill-in): **ratify or override**
- Q5 AIM render -> recommendation A (browse by Chapter, drill-in): **ratify or override**
- Reference placement table (all 52 rows): **ratify or override per-row**
- Schema sketch (`primary_cert` + `cert_carryover` on `reference`): **ratify or override**
