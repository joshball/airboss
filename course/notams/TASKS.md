---
name: NOTAMs course tasks
status: open
parent: README.md
---

# NOTAMs course tasks

Open work for the NOTAMs course. Course is **queued behind [course/weather/](../weather/README.md)**; nothing here is active build work. Listed so the work is visible when the course pulls.

## Blockers (must resolve before lesson authoring)

### Acronym verification

The transition story uses acronyms that are noted from informal session discussion and are **not verified** against authoritative FAA sources. No lesson content can be authored until each is confirmed.

- **USNS** -- claimed: legacy text-based NOTAM system. Verify: exact name (United States NOTAM System?), dates of operation, what it was officially replaced by.
- **FNS** -- claimed: Federal NOTAM System. Verify: exact name, whether it is distinct from NMS or the same system under a different label, current status.
- **NMS** -- claimed: NOTAM Manager System. Verify: exact name, relationship to FNS, current status.
- **AIDAP** -- claimed: distribution protocol. Verify: full name, what it stands for, what it actually does, current status.
- **XMLQ** -- claimed: legacy distribution format. Verify: name, role, when it was retired or how it relates to current formats.
- **BHIV** -- claimed: entry-side system, "behave" in old controller slang. Verify: official name (NOTAM Entry System?), current status, whether the slang is real or apocryphal.
- **FICON** -- claimed: runway condition reporting. Verify: current format spec, effective dates, FAA Order reference, RwyCC scale.

Sources to check first: FAA Order JO 7930.2 (NOTAM), AIM 5-1-3, faa.gov NOTAM Search documentation, Aeronautical Information Services (AIS) public-facing pages, the FAA Notices to Airmen Publication.

When verification produces conflicts or "this changed in YYYY," capture the timeline -- the course will use it to teach the transition story honestly.

## Queued behind weather course

These cannot start until [course/weather/](../weather/README.md) and the [Weather Scenario Engine](../../docs/vision/products/pre-flight/weather-scenario-engine/) ship enough infrastructure to fork:

- Week-by-week lesson authoring (see [SYLLABUS.md](SYLLABUS.md))
- `libs/notam-engine/` -- synthetic NOTAM generator modeled on `libs/wx-engine/`
- `libs/notam-canonical/` -- curated real NOTAMs as fixtures and validation harness
- Drill engine integration (mechanics reused from weather)
- Capstone authoring

## Notes from the original session

The triage scenario the user explicitly called out: "Here are 5-10 NOTAMs for this airport, which are the most critical?" -- with the constraint that the drill engine only assembles packs from format types the learner has already mastered at decode + understand. The translate-with-time-penalty mechanic is enabled. Self-assessment after each rep ("Did you decode each? Understand each? Struggle with any?") is part of the drill structure.

This is not a separate mechanic for NOTAMs -- it is the standard [Three-Stage Skill Ladder](../../docs/platform/DESIGN_PRINCIPLES.md) Stage 3 drill applied to NOTAMs. Reuse, don't reinvent.
