# Changelog -- FAR navigation course

Authoring progress for [course/regulations/](README.md), kept separate from git history so the *content* trajectory is readable without `git log` archaeology. Append-only. Newest entries on top.

Each entry names what was authored, the source PR if any, and any decisions or commentary worth surfacing.

## 2026-04-29 -- Week 2 (Part 61 deep)

**Status:** Week 2 fully authored. 6 lesson files + drills + oral, matching the lesson-count and depth of Week 1.

Reconciliation: The repo had 3 lessons + drills + oral on disk (~79KB) at the start of this pass, but the overview claimed `status: skeleton` and the CHANGELOG status row said "Skeleton" (drift from real state). Audited file-by-file against Week 1's bar; the three present lessons (subpart walk, aeronautical experience, currency-vs-recency-vs-proficiency) and the drills + oral were checkride-grade. The three deep-dives the overview promised (flight review equivalents, IFR currency, medical certificates) were missing entirely. Authored those three to honor the overview contract.

Authored:

- [week-02-part-61-deep/04-flight-review-and-equivalents.md](week-02-part-61-deep/04-flight-review-and-equivalents.md) -- §61.56 deep-dive, all four equivalents (practical test / sport-pilot PC / WINGS phase / military), AC 61-98 vs. regulation, calendar-month math
- [week-02-part-61-deep/05-ifr-currency.md](week-02-part-61-deep/05-ifr-currency.md) -- §61.57(c)/(d)/(e) state machine (current / in grace / past grace), six-six-HIT mechanics, what counts as an instrument approach, §91.109(c) safety pilot rules, simulator/ATD credit, IPC content
- [week-02-part-61-deep/06-medical-certificates.md](week-02-part-61-deep/06-medical-certificates.md) -- §61.23 anchor + Part 67 standards, §61.53 always-on rule, §67.403 fraud, BasicMed (§61.23(c) + Part 68 + 49 USC 44703 + AC 68-1) two-cycle structure, aircraft and operation limits

Decisions:

- **No `airboss-ref:` migration needed.** Week 2 already used `airboss-ref:` syntax in the three pre-existing lessons (matching Week 1's `03-companion-documents.md`). New lessons follow the same pattern. Validator (`bun scripts/references.ts validate`) is clean.
- **Knowledge graph nodes deferred.** The five proposed regulatory nodes (`reg-flight-review-61-56`, `reg-passenger-currency-61-57a`, `reg-night-currency-61-57b`, `reg-ifr-currency-61-57c`, `reg-logging-61-51`) remain in `overview.md` as candidates for later authoring. The lesson content carries the substance; the nodes are atomic-fact extractions for spaced rep.
- **`status` frontmatter field is unreliable.** Week 1 still has `status: skeleton` in its overview despite being fully authored. The CHANGELOG status table is the source of truth. Week 2's overview frontmatter updated to `status: authored` for consistency, but the field shouldn't be load-bearing.

Status of week-by-week authoring:

| Week | Status |
| --- | --- |
| 1 -- Architecture | **Authored** |
| 2 -- Part 61 deep | **Authored** |
| 3 -- Part 61 CFI | Skeleton |
| 4 -- Part 91 general/flight rules | Skeleton |
| 5 -- Part 91 equipment/maintenance | Skeleton |
| 6 -- Part 91 special ops | Skeleton |
| 7 -- Parts 141/135 | Skeleton |
| 8 -- Companion documents | Skeleton |
| 9 -- Enforcement | Skeleton |
| 10 -- Capstone | Capstone orals authored 2/4 (night-ifr-passenger, gear-up-night-ifr); 2 more (friend-flight-review, ppl-applies-for-ir) deferred until ADR 019 lands |

## 2026-04-27 -- Week 1 (architecture) + 1 sibling capstone

**Status:** Week 1 fully authored. 2 capstone orals total (1 from initial bootstrap + 1 new). Two more sibling capstones (friend-flight-review, ppl-applies-for-ir) deferred until after ADR 019 lands so they can be authored with the new identifier syntax in one go.

Authored:

- [week-01-architecture/01-title-14-shape.md](week-01-architecture/01-title-14-shape.md)
- [week-01-architecture/02-how-to-read-a-citation.md](week-01-architecture/02-how-to-read-a-citation.md)
- [week-01-architecture/03-companion-documents.md](week-01-architecture/03-companion-documents.md)
- [week-01-architecture/04-the-pilot-the-flight-the-operation.md](week-01-architecture/04-the-pilot-the-flight-the-operation.md)
- [week-01-architecture/drills.md](week-01-architecture/drills.md) -- 30 navigation drills
- [week-01-architecture/oral.md](week-01-architecture/oral.md) -- "Walk me through Title 14"
- [orals/gear-up-night-ifr.md](orals/gear-up-night-ifr.md) -- capstone, post-incident regulatory obligations

Decisions:

- **No CFR text snapshotting.** Lessons quote sparingly when literal wording matters and otherwise refer to live eCFR. When the CFR ingestion WP ships, inline quotes will be swapped for links to derivatives. See ADR 018 / [STORAGE.md](../../docs/platform/STORAGE.md).
- **Common Misreadings is required.** Every lesson surfaces at least one specific trap. Per [DESIGN.md](DESIGN.md).
- **The "load-bearing" claim is honored.** Week 1 explicitly teaches the navigation map *first*; subsequent lessons assume the map is in place.
- **Identifier syntax pending.** Lessons use plain eCFR URLs and prose citations because [ADR 019 -- Reference Identifier System](../../docs/decisions/019-reference-identifier-system/decision.md) is still in review. Once ADR 019 is approved and the registry exists, a one-pass mechanical migration will convert these references to the new identifier form. The lessons themselves are correct; only the citation format is provisional.

Status of week-by-week authoring:

| Week | Status |
| --- | --- |
| 1 -- Architecture | **Authored** |
| 2 -- Part 61 deep | Skeleton |
| 3 -- Part 61 CFI | Skeleton |
| 4 -- Part 91 general/flight rules | Skeleton |
| 5 -- Part 91 equipment/maintenance | Skeleton |
| 6 -- Part 91 special ops | Skeleton |
| 7 -- Parts 141/135 | Skeleton |
| 8 -- Companion documents | Skeleton |
| 9 -- Enforcement | Skeleton |
| 10 -- Capstone | Capstone orals authored 2/4 (night-ifr-passenger, gear-up-night-ifr); 2 more (friend-flight-review, ppl-applies-for-ir) deferred until ADR 019 lands |

## 2026-04-26 -- Course bootstrap

**Status:** Course infrastructure in place. Skeleton authored for all 10 weeks. One full capstone oral as the model for the rest. Promoted out of [IDEAS.md](../../docs/platform/IDEAS.md) intake into the course directory.

Authored:

- [README.md](README.md) -- design philosophy, three pedagogical pillars
- [SYLLABUS.md](SYLLABUS.md) -- 10 weeks, "the pilot / the flight / the operation"
- [DESIGN.md](DESIGN.md) -- authoring rules, lesson template, oral template
- 10 week overviews
- [orals/night-ifr-passenger.md](orals/night-ifr-passenger.md) -- the canonical capstone, fully written
- [drills/README.md](drills/README.md) -- the navigation-skill framework
- [references/README.md](references/README.md) -- ACs, Chief Counsel, NTSB index
- [orals/README.md](orals/README.md)

Restructure landed in same PR (#235): pre-pivot FIRC content moved from `course/L0*/` to `course/firc/L0*/` to make dormancy explicit.
