---
name: Aviation Weather -- decode, understand, triage
status: skeleton
authoring-started: 2026-04-30
target-audience: pilots from PPL through CFI; primary user is a returning CFI rebuilding weather literacy
sources-of-truth: AC 00-6 (Aviation Weather), AC 00-45 (Aviation Weather Services), AIM Chapter 7, FAA Weather Handbook, AWC product documentation
---

# Aviation Weather -- decode, understand, triage

A mastery-oriented course on aviation weather products. The goal is not "know what the codes mean" -- it's **read a full preflight briefing fast and make the right call.** Weather is the format pilots fail at most often, and almost always for the same reason: training stops at decode and never reaches triage.

This course walks the [Three-Stage Skill Ladder](../../docs/platform/DESIGN_PRINCIPLES.md) explicitly. Every product is taught at all three stages: decode the fields, understand the snapshot, triage the pack.

## Status

Skeleton. The structure (this README, the [SYLLABUS](SYLLABUS.md), the [DESIGN](DESIGN.md)) is captured first. Per-week lesson content is placeholder. The course will graduate from skeleton when the [Weather Scenario Engine](../../docs/vision/products/pre-flight/weather-scenario-engine/) ships its first usable cut -- the engine produces the lessons, the canonical events, and the drill packs.

## What this course is

A multi-week course (mappable to a 4-week intensive or a quarter-length deep dive) that walks the full briefing-pack family of products end-to-end. Each product gets the same treatment: decode → understand → triage → integrate.

The integration weeks are the point. A METAR alone is trivia; a METAR + TAF + AIRMET + winds aloft + radar mosaic + PIREPs interpreted together is the actual skill of preflight planning.

## The three pedagogical pillars

### 1. Discovery-first pedagogy

Lead with WHY. Let the learner derive the answer. Reveal the product as confirmation of reasoning, not as an arbitrary code. See [ADR 011](../../docs/decisions/011-knowledge-graph-learning-system/decision.md).

> Why do you think the TAF reports forecast in 6-hour chunks rather than continuously?
>
> -> learner reasons: "Forecasters can't promise minute-by-minute; they can promise the dominant condition over a window"
>
> -> reveal: TAF FM/TEMPO/PROB groups are the formal expression of "dominant condition vs probability of variation"

### 2. The Three-Stage Skill Ladder

[DESIGN_PRINCIPLES.md §7](../../docs/platform/DESIGN_PRINCIPLES.md). For every product:

- **Decode**: name the fields. METAR `BKN015` = broken at 1500 ft AGL.
- **Understand**: read the snapshot. What is this whole METAR telling you about the airfield?
- **Triage**: in a pack of 12 METARs across your route, which 3 matter? In what order?

Stage 3 only unlocks once Stages 1+2 are mastered for the codes in play. The drill engine reads from the learner's mastery state and never asks them to triage what they can't yet decode.

### 3. Synthetic briefings with truth-aware commentary

The course is consumed alongside the [Weather Scenario Engine](../../docs/vision/products/pre-flight/weather-scenario-engine/). The engine generates briefing packs from a narrative ("clear and smooth," "embedded TS mid-route") and authors Socratic commentary because it knows the truth.

This unlocks pedagogy no real-world briefing tool can offer:

- "Notice these isobars on chart 1. Same chart 6 hours later: notice this new line and watch this pressure reading drop. What's coming?"
- "The TAF at KZ shows TEMPO BKN015 between 18-21Z. Why is that load-bearing for your arrival?"
- "There's no SIGMET, but the PIREP at 1620Z reports moderate ice at 7000. Why doesn't the absence of a SIGMET let you off the hook?"

## Course shape (placeholder)

The week-by-week structure will be authored against the synthetic engine's product catalog. Sketch:

- Surface observations (METAR, SPECI, station model)
- Terminal forecasts (TAF, FM/TEMPO/PROB groups)
- Area products (Area Forecast, GFA)
- Hazards (AIRMET Sierra/Tango/Zulu, G-AIRMET, SIGMET, Convective SIGMET, CWA)
- Winds and temps aloft (FB)
- PIREPs (UA / UUA)
- Surface analysis and prog charts
- Radar and satellite
- Icing (FIP, CIP) and turbulence (GTG)
- Integration: full preflight briefing for a real cross-country
- Capstone: triage drill -- 4-hour XC, generated brief, decisions under time pressure

## Canonical events corpus

Hand-curated famous wx situations live in `libs/wx-canonical/` and are referenced from this course as set-piece lessons. Examples (planned, not yet authored): a textbook radiation fog morning, a classic dryline severe-weather day, a named hurricane approach, a derecho event.

These serve three purposes: (1) compelling teaching content, (2) validation harness for the synthetic engine ("does the generator's output for 'midwestern dryline May day' look like a dryline day to a meteorologist?"), (3) bridge between pure-synthetic and real-data anchoring.

## Related

- [SYLLABUS.md](SYLLABUS.md) -- week-by-week breakdown
- [DESIGN.md](DESIGN.md) -- pedagogical design notes
- [drills/README.md](drills/README.md) -- drill structure (decode reps, understand reps, triage drills)
- [references/README.md](references/README.md) -- source documents and external references
- [canonical-events/README.md](canonical-events/README.md) -- curated historical wx situations
- [Weather Scenario Engine vision](../../docs/vision/products/pre-flight/weather-scenario-engine/) -- the generator that powers the course
- [DESIGN_PRINCIPLES.md §7](../../docs/platform/DESIGN_PRINCIPLES.md) -- the skill ladder this course is built on
