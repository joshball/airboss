---
name: NOTAMs syllabus
status: skeleton
parent: README.md
---

# NOTAMs -- syllabus

Week-by-week structure. Tentative 3-4 weeks. Authoring deferred until [course/weather/](../weather/README.md) ships and the [Weather Scenario Engine](../../docs/vision/products/pre-flight/weather-scenario-engine/) infrastructure is ready to be adapted for `libs/notam-engine/`.

## Week 1 -- The NOTAM system and its transition

- What a NOTAM actually is (a notice, not a regulation; how it relates to actual operational impact)
- The transition story: legacy text system → modern digital/XML system (acronyms pending verification -- see [TASKS.md](TASKS.md))
- Distribution vs entry: how NOTAMs are created, who creates them, how they get to pilots
- Why pilots historically miss critical NOTAMs (the noise problem, format fatigue, recurring entries)
- First exposure: a generated set of NOTAMs for a fictional airport, with commentary

## Week 2 -- Domestic NOTAM formats

- The `!ICAO NN/NNN` header format
- Field grammar: subject, condition, location, time window, free text
- Common subject codes (RWY, TWY, APRON, OBST, NAV, COM, SVC, AD, AIRSPACE)
- Common condition codes (CLSD, U/S, OUT, CLOSED EXC, AVAIL, etc.)
- Stage 1 + 2 reps on real-format NOTAMs

## Week 3 -- FDC, TFR, FICON

- FDC NOTAM structure: regulatory, charting, special procedures
- TFR formats: Part 91 special security notices, location/radius/altitude/time, presidential, sporting, fire/disaster
- FICON: runway condition codes, contamination types, RwyCC values, the friction reporting model
- ICAO/Q-code format as a literacy item (not a primary skill for US-domestic pilots, but mandatory exposure)
- Stage 1 + 2 reps on each type

## Week 4 -- Triage and integration

- The triage problem: a real airport pack can be 100+ items, most of them not load-bearing
- Patterns that are noise: daily lighting outages, recurring bird-activity in the area, pavement-painting work, recurring obstructions, recurring TFRs at the same time daily
- Patterns that matter: runway closures during your operation, approach equipment outages affecting your IFR plan, TFRs intersecting your route, FICON contamination affecting your aircraft category
- Generated triage drill: full NOTAM pack for a generated cross-country, 90-second decision window
- Translate-with-time-penalty enabled
- Decision and debrief

## Drill cadence

Same three drill types as [course/weather/](../weather/drills/README.md):

- Decode reps on subject/condition codes (knowledge graph nodes)
- Understand reps on whole NOTAMs ("what is this NOTAM telling you?")
- Triage drills on full airport packs from `libs/notam-engine/`

Mechanics, scheduling, and mastery gating are reused from the weather course.

## Capstone

A 100-NOTAM triage drill against a generated pack for a real-feeling cross-country. Learner ranks, picks the load-bearing 5, makes a go/no-go call. Debrief shows the truth-authored "what mattered and why" walkthrough.
