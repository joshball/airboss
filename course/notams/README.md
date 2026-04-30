---
name: NOTAMs -- decode, understand, triage
status: skeleton (queued behind course/weather/)
authoring-started: 2026-04-30
target-audience: pilots from PPL through CFI; primary user is a returning CFI rebuilding NOTAM literacy
sources-of-truth: AIM 5-1-3, FAA Order JO 7930.2 (NOTAM), NOTAM Contractions Handbook, Aeronautical Information Services documentation
---

# NOTAMs -- decode, understand, triage

A focused course on the NOTAM system: the transition from the legacy text-based system to the modern XML/digital system, the formats a pilot encounters, and -- the part most pilots are weakest at -- triaging hundreds of NOTAMs for a single flight without missing the one that matters.

This course follows the [Three-Stage Skill Ladder](../../docs/platform/DESIGN_PRINCIPLES.md). Same shape as [course/weather/](../weather/README.md): decode → understand → triage. NOTAMs are the second member of the encoded-text family this platform teaches; weather is first.

## Status

**Skeleton. Queued behind `course/weather/`.** Build order: weather first (richer pedagogy, generator-friendly), NOTAMs second (more contained, builds on weather's drill engine and triage mechanics).

The structure is captured here so the course is ready when it pulls. Per-week content is placeholder. **Acronym verification (USNS / FNS / NMS / AIDAP / XMLQ / BHIV / FICON) is open** -- see [TASKS.md](TASKS.md). Lessons cannot be authored against unverified acronyms.

## What this course is

A short course (3-4 weeks) covering:

1. The NOTAM transition story: legacy system → modern system. Why the change happened, what it changed, what the pilot-facing differences are.
2. The format families: domestic, FDC, TFR, FICON, others.
3. Decode: what every field of every NOTAM type means.
4. Understand: what a NOTAM is *actually telling you* about a real-world condition.
5. Triage: 100+ NOTAMs for a real cross-country, which 5 matter? What's the noise (recurring bird-activity, daily lighting, pavement-painting work)?

The course pairs with a synthetic NOTAM generator (planned `libs/notam-engine/`, modeled on the [Weather Scenario Engine](../../docs/vision/products/pre-flight/weather-scenario-engine/) but smaller in scope). Same pattern: generate from truth, author commentary because the truth is known, drill against generated packs.

## The transition story (placeholder, requires acronym verification)

The course opens with the NOTAM transition because pilots reading older training material (or older instructors) will encounter both vocabularies and need to know what changed and why. The story involves:

- The legacy text-based system the FAA used for decades
- The modern digital/XML system that replaced it
- The distribution side (how NOTAMs are pushed out to operators and pilots)
- The entry side (how facilities create NOTAMs)
- Operational changes: structured fields, machine-readable formats, FICON as a standardized runway-condition reporting system

**Specific acronyms used in current draft notes** -- all unverified, must be confirmed against authoritative FAA sources before lesson authoring:

- **USNS** -- legacy text-based NOTAM system (verify exact name and dates)
- **FNS** -- Federal NOTAM System (verify -- is this distinct from NMS, or the same system under a different name?)
- **NMS** -- NOTAM Manager System (verify name; verify relationship to FNS)
- **AIDAP** -- distribution protocol (verify name and what it stands for)
- **XMLQ** -- legacy distribution format (verify)
- **BHIV** -- entry-side system, "behave" in old controller slang (verify name and current status)
- **FICON** -- runway condition reporting (verify current format and effective dates)

Tracked in [TASKS.md](TASKS.md). No lesson content lands until these are verified.

## Format families (skeleton)

The course will cover these NOTAM types, each at all three skill ladder stages:

- **Domestic NOTAMs**: `!JFK 01/234 JFK RWY 04L/22R CLSD 2401200600-2401201800`
- **Equipment / facility NOTAMs**: `!LAX 01/567 LAX PAPI RWY 25L U/S`
- **FDC NOTAMs**: regulatory, charting, special procedures
- **TFR NOTAMs**: Part 91 special security notices, sporting events, presidential movement, fire/disaster
- **FICON NOTAMs**: runway condition codes, contamination, friction
- **International/ICAO NOTAMs**: Q-code grammar, ICAO format

Triage is taught last and explicitly: given 100+ NOTAMs for a single cross-country flight, which matter? The drill engine builds packs only from format types the learner has mastered at decode + understand.

## Pedagogical pillars

Same three as [course/weather/](../weather/README.md):

1. Discovery-first pedagogy
2. The Three-Stage Skill Ladder ([DESIGN_PRINCIPLES.md §7](../../docs/platform/DESIGN_PRINCIPLES.md))
3. Synthetic generation with truth-aware commentary

The pedagogical infrastructure (drill engine, mastery gating, translate-with-time-penalty) is shared with the weather course -- those mechanics ship with weather and are reused here. NOTAMs needs only its own format catalog and generator, not new pedagogy.

## Related

- [SYLLABUS.md](SYLLABUS.md) -- week-by-week breakdown
- [TASKS.md](TASKS.md) -- open work, acronym verification queue, deferral notes
- [course/weather/](../weather/README.md) -- sibling course, ships first
- [DESIGN_PRINCIPLES.md §7](../../docs/platform/DESIGN_PRINCIPLES.md) -- the skill ladder
- [IDEAS.md -- Coded-Briefings umbrella](../../docs/platform/IDEAS.md) -- the future meta-course this and weather will eventually graduate into
