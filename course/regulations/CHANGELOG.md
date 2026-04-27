# Changelog -- FAR navigation course

Authoring progress for [course/regulations/](README.md), kept separate from git history so the *content* trajectory is readable without `git log` archaeology. Append-only. Newest entries on top.

Each entry names what was authored, the source PR if any, and any decisions or commentary worth surfacing.

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
