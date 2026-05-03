# References roadmap

The single canonical list of every FAA reference document airboss ingests, with current state and target state. Updated on every PR that lands or moves a reference along the pipeline.

> **This is THE list.** When something disagrees with this doc, this doc wins or the doc is wrong. No other "list of references" lives anywhere else; if you find one, replace it with a link here.

## Snapshot

**Last updated:** 2026-05-03 (live snapshot — auto-update on each library PR; flightbag scaffold landed)

**Readable in-app today:** 36 references (40 with the references cleanup sweep — 4 AC YAML rows added so subjects + primary_cert render)
**Total tracked:** ~50 references across all corpora
**Target shape:** every reference is a section-tree (whole-doc retired)

## Stage definitions (short version)

1. **Sourced** — source PDF/HTML cached in `~/Documents/airboss-handbook-cache/`
2. **Extracted** — markdown body files + `manifest.json` in `<corpus>/<doc>/<edition>/` in repo
3. **Catalogued** — DB row in `study.reference`; card on `/library`
4. **Readable** — DB rows in `study.reference_section` with `content_md` populated; "Read in-app" badge on `/library`
5. **Section-tree shape** — the `manifest.json` declares chapter / section / paragraph / element hierarchy (vs whole-doc single body)

For the longer pipeline writeup see [docs/ingestion-pipeline/pipeline.md](../ingestion-pipeline/pipeline.md).

## The list

### Handbooks (chapter-aware section trees)

| FAA number | Common name | Abbrev | Stage | Target | Notes |
|------------|-------------|--------|-------|--------|-------|
| FAA-H-8083-25C | Pilot's Handbook of Aeronautical Knowledge | PHAK | ✅ readable, section-tree | (unchanged) | 17 chapters, 850 sections |
| FAA-H-8083-3C | Airplane Flying Handbook | AFH | ✅ readable, section-tree | (unchanged) | 18 chapters, 531 sections |
| FAA-H-8083-28B | Aviation Weather Handbook | AVWX | ✅ readable, section-tree | (unchanged) | 28 chapters, 480 sections |
| FAA-H-8083-9 | Aviation Instructor's Handbook | AIH | ✅ readable, section-tree | (unchanged) | 18 L1 entries (10 chapters + acks/preface + 4 appendices + glossary + index), 155 sections, 246 subsections (WP-AIH 2026-05-03) |
| FAA-H-8083-15B | Instrument Flying Handbook | IFH | ✅ readable, section-tree | -- | Promoted via WP-IFH-SECTION-TREE; toc-file-sidecar strategy parses `docs/work-packages/whole-doc-promotion/source-tocs/ifh.md`; 11 chapters / 587 sections; chapters 6 / 7 model the printed-TOC Section I (analog) / Section II (electronic flight display) split as two L1 sections per chapter; 3 FAA amendment PDFs queued for follow-up under ADR 020 errata flow |
| FAA-H-8083-16B | Instrument Procedures Handbook | IPH | ✅ readable, section-tree | (unchanged) | 7 chapters, 84 sections, 228 subsections (WP-IPH-section-tree 2026-05-03) |
| FAA-H-8083-2A | Risk Management Handbook | RMH | ✅ readable, section-tree | (unchanged) | 12 chapters (8 + 4 appendices), 100 sections (WP-RMH 2026-05) |
| FAA-P-8740-60 | Tips on Mountain Flying | MTN | ✅ readable, section-tree | (unchanged) | 12 chapters / 36 sections promoted from `body_override` markdown via the `handbooks-extras` ingest's section-tree branch (WP-MTN-section-tree, 2026-05-03) |

### Whole-doc handbooks → promote to section-tree

(empty -- all whole-doc handbooks have been promoted to section-tree as of WP-RMH (2026-05).)

**Removed from corpus 2026-05-03**: AMT-General (FAA-H-8083-30B) and AMT-Powerplant (FAA-H-8083-32B). Maintenance technician handbooks; not pilot-training relevant.

### AIM

| FAA number | Common name | Abbrev | Stage | Target | Notes |
|------------|-------------|--------|-------|--------|-------|
| FAA AIM 2026-04 | Aeronautical Information Manual | AIM | ✅ readable, section-tree | (unchanged) | 10 chapters, 38 sections, 396 paragraphs, 297 glossary terms, 3 appendices |

### Code of Federal Regulations

11 of ~226 Title 14 parts and 2 of Title 49 parts cataloged + readable. The 217 long-tail Title 14 parts (engineering rules: Part 27 helicopter cert, Part 33 engine cert, etc.) are intentionally out of scope per WP-CFR.

| Reference | Title | Stage | Sections |
|-----------|-------|-------|----------|
| 14 CFR Part 14 | Equal Access to Justice Act rules | ✅ readable, section-tree | 19 |
| 14 CFR Part 23 | Airworthiness Standards (Normal Category) | ✅ readable, section-tree | 68 |
| 14 CFR Part 61 | Pilot/Instructor Certification | ✅ readable, section-tree | 149 |
| 14 CFR Part 68 | BasicMed | ✅ readable, section-tree | 6 |
| 14 CFR Part 71 | Class A/B/C/D/E Airspace | ✅ readable, section-tree | 15 |
| 14 CFR Part 73 | Special Use Airspace | ✅ readable, section-tree | 11 |
| 14 CFR Part 91 | General Operating and Flight Rules | ✅ readable, section-tree | 286 |
| 14 CFR Part 135 | Commuter and On-Demand Operations | ✅ readable, section-tree | 200 |
| 14 CFR Part 141 | Pilot Schools | ✅ readable, section-tree | 49 |
| 49 CFR Part 830 | NTSB Accident Reporting | ✅ readable, section-tree | 6 |
| 49 CFR Part 1552 | TSA Alien Flight Student Program | ✅ readable, section-tree | 16 |

CFR is structurally section-tree (per-Part references with section rows underneath). All 11 cataloged Parts are readable.

### Advisory Circulars

9 cached and readable as whole-doc. 12 link-only cards need download. All ACs to be promoted to section-tree where the document has internal structure.

| FAA number | Common name | Stage | Target |
|------------|-------------|-------|--------|
| AC 00-6B | Aviation Weather | ⚠️ readable, whole-doc | section-tree |
| AC 25-7D | Flight Test Guide for Transport Category Airplanes | ⚠️ readable, whole-doc | section-tree (engineering doc — keep but section it) |
| AC 61-65J | Certification: Pilots and Flight/Ground Instructors | ⚠️ readable, whole-doc | section-tree |
| AC 61-83J | Industry-Conducted Flight Instructor Refresher Course | ⚠️ readable, whole-doc | section-tree |
| AC 61-98D | Flight Review and IPC Currency | ⚠️ readable, whole-doc | section-tree |
| AC 90-66C | Non-Towered Airport Flight Operations | ⚠️ readable, whole-doc | section-tree |
| AC 91-21.1D | Use of Portable Electronic Devices Aboard Aircraft | ⚠️ readable, whole-doc | section-tree |
| AC 91-79A | Mitigating Runway Overrun | ⚠️ readable, whole-doc | section-tree |
| AC 120-71B | SOPs and Pilot Monitoring Duties | ⚠️ readable, whole-doc | section-tree |
| AC 00-24 | Thunderstorms | ❌ link-only | full pipeline + section-tree |
| AC 00-45 | Aviation Weather Services | ❌ link-only | full pipeline + section-tree |
| AC 60-22 | Aeronautical Decision Making | ❌ link-only | full pipeline + section-tree |
| AC 61-27 | Instrument Flying Handbook (legacy AC, superseded by FAA-H-8083-15) | ❌ link-only | (decide: ingest or drop, since superseded) |
| AC 61-67 | Stall and Spin Awareness Training | ❌ link-only | full pipeline + section-tree |
| AC 61-84 | Role of Preflight Preparation | ❌ link-only | full pipeline + section-tree |
| AC 61-134 | GA Controlled Flight Into Terrain Awareness | ❌ link-only | full pipeline + section-tree |
| AC 90-100 | RNAV Operations | ❌ link-only | full pipeline + section-tree |
| AC 91-23 | Pilot's Weight and Balance Handbook | ❌ link-only | full pipeline + section-tree |
| AC 91-44 | ELT Maintenance Practices | ❌ link-only | full pipeline + section-tree |
| AC 91-74 | Flight in Icing Conditions | ❌ link-only | full pipeline + section-tree |
| AC 91-75 | Attitude Indicator | ❌ link-only | full pipeline + section-tree |

### Airman Certification Standards

5 cataloged and readable as section-tree (publication → area → task → element). 2 link-only.

| FAA number | Common name | Stage |
|------------|-------------|-------|
| FAA-S-ACS-6C | Private Pilot — Airplane | ✅ readable, section-tree (603 sections) |
| FAA-S-ACS-7B | Commercial Pilot — Airplane | ✅ readable, section-tree (548 sections) |
| FAA-S-ACS-8C | Instrument Rating — Airplane | ✅ readable, section-tree (174 sections) |
| FAA-S-ACS-11A | Airline Transport Pilot — Airplane | ✅ readable, section-tree (485 sections) |
| FAA-S-ACS-25 | Flight Instructor — Airplane | ⚠️ readable, but data thin — FAA didn't carry K/R/S codes (100 sections, 0 elements) |
| FAA-S-ACS-9E | Flight Instructor – Instrument Airplane PTS (CFII) | ❌ link-only — PTS not ACS, different doc shape |
| FAA-G-ACS-2 | ACS Companion Guide for Pilots | ❌ link-only — no manifest, not in download config |

### New corpora (not yet in pipeline)

These are tracked as TODO: a corpus-build WP per row.

| Corpus | Common name | Stage | Notes |
|--------|-------------|-------|-------|
| SAFO | FAA Safety Alerts For Operators | ❌ no card, no pipeline | Estimated 30-50 docs; WP-SAFO not started |
| InFO | FAA Information For Operators | ❌ no card, no pipeline | Estimated 20-30 docs; WP-INFO not started |
| Chief Counsel | FAA Office of Chief Counsel legal interpretations | ❌ no card, no pipeline | Estimated 100-200 published opinions; WP-CC not started — highest pedagogical leverage |
| NTSB ALJ | NTSB administrative law judge rulings | ❌ no card, no pipeline | WP-NTSB-ALJ not started |
| FAA Order 8900.1 Vol 5 | Flight Standards Information Management System (Airman Cert) | ❌ deferred | Trigger to revisit: CFI content needs Vol 5 |
| FAA Safety Briefing | FAA magazine archive | ❌ deferred | Low priority |
| 217 long-tail CFR-14 parts | Part 27 (helicopter), Part 33 (engine), etc. | ❌ out of scope | Engineering rules pilots don't cite |

### Umbrella references (not pipelinable)

These are intentional link-only cards for citation purposes. They will not get manifests or `reference_section` rows.

| Card slug | Why |
|-----------|-----|
| `ntsb` (umbrella) | Per-report ingestion is WP-NTSB-ALJ; the umbrella stays as fallback |
| `poh-afm` | Per-aircraft, user-uploaded; different feature |
| `aopa-air-safety-institute` | External resource |
| `faa-p-8740-36` | FAA pamphlet, low priority |
| `faa-order-8260-3` | Could be ingested, low priority |
| `faa-approach-plates` | Per-airport, separate workflow |
| `jeppesen-faa-charts` | External, separate workflow |
| `rogers-d-f` | Academic citation |
| `generic-acs` | Citation fallback for "ACS" without specific edition |
| `generic-pts` | Citation fallback for "PTS" without specific edition |

### Cleanup candidates (cruft)

Closed by the references-cleanup-sweep PR. Items remaining are the genuinely
deferred ones (need a content audit, not a mechanical fix).

| Row | Issue | Action |
|-----|-------|--------|
| `afh` (FAA-H-8083-3B) in `handbooks-noningested.yaml` | Prior AFH edition kept for citation resolution | Deferred — needs a content audit that re-points every node's `source` string from 3B to 3C |

Resolved in the cleanup sweep:

- `aim` edition `current` — migrator now pins to `AIM_CURRENT_EDITION` (`2026-04`); existing orphan rows removed via `scripts/db/cleanup-aim-current-orphan.ts`.
- `aih`/`faa-h-8083-2` dupe rows — deleted from `handbooks-noningested.yaml`; migrator's AIH/RMH patterns re-pointed at the canonical handbooks-extras `(slug, edition)` pairs (`aviation-instructor`/`8083-9`, `risk-management`/`8083-2A`).
- `pcg` umbrella card — kept and reframed as a citation-fallback umbrella (matches the `generic-acs`/`generic-pts` pattern). The migrator's hardcoded `(pcg, current)` resolver still fires for legacy bare-PCG citations; the authored row absorbs them so no synthetic rows appear.

## Roadmap (in priority order)

This is the sequenced path to "everything readable as section-tree" excluding new corpora. Each row is a separate WP.

| # | WP | Status | Effect |
|---|----|--------|--------|
| 1 | AMT-G/P removal | ✅ shipped (#505) | -2 corpus entries |
| 2 | Cleanup sweep | ✅ shipped | Reconciled 4 AC YAML rows (`ac-25-7`, `ac-61-65`, `ac-91-21-1`, `ac-120-71`); retired `aih`/`faa-h-8083-2` dupes from `handbooks-noningested.yaml` + re-pointed migrator; reframed PCG umbrella as citation-fallback; pinned AIM migrator to canonical edition + orphan cleanup script |
| 3 | RMH section-tree promotion | ❌ not started | RMH chapter-tree from `RiskMgmtHdbk-TOC.md` |
| 4 | mtn-flying section-tree promotion (from override) | ✅ shipped (WP-MTN-section-tree) | 12 chapters / 36 sections; markdown-to-manifest parser added to handbooks-extras ingest |
| 5 | AIH section-tree promotion (chapter-PDF download + extract) | ✅ shipped (WP-AIH) | 18 L1 entries / 155 sections / 246 subsections; replaces whole-doc card |
| 6 | IFH section-tree promotion | ✅ shipped (WP-IFH-SECTION-TREE) | TOC parsed via new `toc-file-sidecar` strategy; 11 chapters / 587 sections; Section I/II quirk modeled as two L1 sections per chapter |
| 7 | IPH section-tree promotion | ✅ shipped (WP-IPH-section-tree) | Class A2 chapter-aware ingest with TOC parse from whole-doc PDF pp.12-16; 7 chapters / 84 sections / 228 subsections |
| 8 | AC section-tree promotion (existing 9) | ❌ not started | Replace whole-doc seeder with section-tree; per-AC TOC parse |
| 9 | AC section-tree extraction (12 link-only) | ❌ not started | Add to download config + extract + section-tree seed |
| 10 | ACS link-only completion | ❌ not started | `cfii-airplane-pts-9e` (PTS), `faa-g-acs-2-companion-guide` |
| 11 | New corpora — WP-SAFO + WP-INFO | ❌ not started | Pipelines are nearly identical; can be combined |
| 12 | New corpora — WP-CC | ❌ not started | Highest pedagogical leverage |
| 13 | New corpora — WP-NTSB-ALJ | ❌ not started | Different data model from FAA pubs |

After 1-10: every cataloged FAA pilot-track publication is a readable section-tree. After 11-13: extended with auxiliary corpora.

## How to use this doc

- **Authoring a citation?** Find the doc in the list. If it's `✅ readable, section-tree`, you can deep-link by chapter / section / paragraph using `airboss-ref:`. If it's `⚠️ whole-doc`, you can only link to the document.
- **Adding a new reference?** Add the row in the appropriate section. If it's a known new doc, mark stage and target. If a new corpus, add to "New corpora" with a TODO. Then PR.
- **Shipping a WP that changes a reference's state?** Update the row in the same PR. The "Last updated" line at the top should match the latest reference change.
- **Confused about state?** Run `find handbooks aim ac acs -name 'manifest.json' | xargs -I{} jq -r '.kind + ":" + (.title // "?")' {}` for a live snapshot from disk. Should match this doc.

## Current architecture: `apps/flightbag/` as the canonical viewer (scaffolded 2026-05-03)

Today, the `/library/...` reader routes still live in `apps/study/` while the new `apps/flightbag/` scaffold proves the cross-surface deep-link pipe end-to-end. The migration of study's reader routes is a separate WP (see migration sequence below).

The original problem: when sim, FIRC, or a future avionics app needs to deep-link to a citation (e.g. PHAK §2.3), they either build their own reader (different URL per app for the same content) or link to study's URL (cross-app dependency). Citations need to be **shareable across surfaces**, including links a user copies from sim and pastes elsewhere.

**Decision (2026-05-03):** stand up `apps/flightbag/` as a dedicated reader app. Other apps link to flightbag URLs from their citation chips. Single canonical URL space; deep-linkable from anywhere; future-proofed for sim, FIRC, avionics, and an eventual public web surface (see ADR 019 §1 on `airboss-ref:` URI durability).

**Naming**: `flightbag` is what every pilot literally carries — handbooks, charts, regs, plates, ACs, ACS. Aviation-authentic, distinct domain, intuitive URL pattern.

**Scope split:**

| Concern | App | Notes |
|---------|-----|-------|
| Public-facing reader (deep-linkable) | `apps/flightbag/` (scaffolded) | URLs like `flightbag/handbook/phak/8083-25C/2/3`, `flightbag/cfr/14/91/103`, `flightbag/acs/ppl-airplane-6c/area/1/task/A`. No admin UI here. |
| Admin / management dashboard | `apps/hangar/admin/references/` (planned) | TOC validation, per-reference status, force-reingest, stage-status visibility. Admin-only. Reads from `@ab/sources` + `study.reference`. |
| Citation rendering primitives | `libs/library/` (scaffolded) | `<RenderedSection>`, `<CitationChip>` -- stub today, full markdown + figure resolution + adjacency in follow-on WPs. Used by flightbag (renders) + study/sim/etc. (link). |
| URI -> URL bridge | `libs/sources/src/url-for-reference.ts` (shipped) | `urlForReference(uri)` parses an `airboss-ref:` URI and dispatches to the matching `ROUTES.FLIGHTBAG_*`. |
| URL templates | `libs/constants/src/routes.ts` (`ROUTES.FLIGHTBAG_*`, shipped) | Single source of truth for every flightbag URL. |
| Data layer | `libs/sources/` (existing) | Resolvers, manifests, registry, URI scheme. Unchanged. |

**Migration sequence:**

1. ✅ Stand up `apps/flightbag/` scaffold with placeholder routes for handbook (3 depths) / aim / cfr / ac / acs. (PR #520, 2026-05-03)
2. ✅ Add flightbag URL constants in `libs/constants/src/routes.ts` under `ROUTES.FLIGHTBAG_*`. (PR #520)
3. ✅ Add `urlForReference(uri)` helper in `libs/sources/` that turns an `airboss-ref:` URI into a flightbag URL via the constants. (PR #520)
4. ✅ Add citation rendering primitives in `libs/library/` (`<RenderedSection>`, `<CitationChip>`) as stubs. (PR #520)
5. ❌ Wire flightbag's placeholder load functions to the real `@ab/sources` resolvers and render section bodies. (separate WP -- the "real reader" implementation pass)
6. ❌ Migrate study's `/library/...` routes into flightbag and retire them from study. (separate WP)
7. ❌ Rewire study's citation chips from in-app `/library/...` URLs to `urlForReference(uri)`. (`docs/work-packages/citation-chips-flightbag-migration/`)
8. ❌ Sim/FIRC/etc. citation surfaces use `urlForReference()` from day one — no per-app reader to maintain. (lands with each app's first citation surface.)

The hangar admin dashboard (TOC validation UI, per-reference stage view) stays in hangar per the management-fits-content-authoring rule. See [docs/platform/IDEAS.md](IDEAS.md) under Technical Approaches.

### Routing layer — where URL strings live

Strict rule (per [CLAUDE.md](../../CLAUDE.md) "All routes go through `ROUTES`"): no inline path strings anywhere.

| Concern | Lives in | Why |
|---------|----------|-----|
| URL string templates | `libs/constants/src/routes.ts` (`ROUTES.FLIGHTBAG_*`) | Single source of truth for every route in airboss; all apps already follow this |
| URI-to-URL bridge | `libs/sources/src/url-for-reference.ts` (`urlForReference(uri)`) | Lives next to the resolvers that own the `airboss-ref:` URI scheme; calls into `libs/constants/` for the URL template |
| Rendering primitives | `libs/library/` (scaffolded 2026-05-03) | `<RenderedSection>`, `<CitationChip>`; flightbag-specific rendering knowledge, no URL business |
| The flightbag app | `apps/flightbag/` (scaffolded 2026-05-03) | Consumes the above |

Citation surfaces in study, sim, hangar, etc. import `urlForReference` from `@ab/sources`; never construct a flightbag URL inline. CI will catch regressions via grep for the forbidden patterns (`'/handbook/'`, `'/cfr/'`, `'/ac/'`, `'/acs/'`, `'/aim/'`) in app source files.

## Anchors

- [docs/ingestion-pipeline/pipeline.md](../ingestion-pipeline/pipeline.md) — pipeline writeup
- [docs/ingestion-pipeline/stage-status.md](../ingestion-pipeline/stage-status.md) — per-corpus stage view (more granular)
- [docs/work-packages/library-completeness/](../work-packages/library-completeness/) — substrate WP that built the foundation
- [docs/decisions/019-reference-identifier-system/decision.md](../decisions/019-reference-identifier-system/decision.md) — `airboss-ref:` URI scheme
- TOC working files at repo root (will move into per-WP dirs):
  - `RiskMgmtHdbk-TOC.md`
  - `InstrumentFlyingHandbookToc.md`
  - `AviationWeatherHandbook.md` (AVWX, already section-tree)
