---
name: Aviation Weather -- design notes
status: skeleton
parent: README.md
---

# Aviation Weather -- design notes

Pedagogical and structural decisions behind the course shape. Updated as authoring proceeds.

## Why this course exists

Pilots fail weather more than any other knowledge area in the FAA syllabus. The failure mode is consistent: training stops at decode. The pilot can name every field of a METAR, decode every TAF group, and still freeze when handed a real preflight briefing pack at 0600 with a flight to launch by 0800. The problem is not knowledge. The problem is that decode, understand, and triage are three different skills, and only the first is ever taught explicitly.

This course makes the ladder explicit and trains all three stages.

## The Three-Stage Skill Ladder applied to weather

See [DESIGN_PRINCIPLES.md §7](../../docs/platform/DESIGN_PRINCIPLES.md). The mapping for weather:

- **Decode**: name the fields. METAR `BKN015` = broken at 1500 ft AGL. Reps until automatic.
- **Understand**: read the product. What is this whole METAR / TAF / chart telling me about the world right now or in N hours?
- **Triage**: in a pack of 30+ items across multiple products, which 5 shape my decision? In what order? And what's the noise?

Mastery is per-node. The drill engine never asks a learner to triage what they can't yet decode.

## Why a synthetic engine, not real briefings

Real preflight briefings have one fatal flaw as teaching material: the instructor doesn't know the truth. They know what the briefing says. They don't know why each line of the TAF was written, what the forecaster was uncertain about, what the radar mosaic missed. The briefing is the *output* of a process the instructor can't see.

A synthetic engine inverts this. We author the truth (a 994mb low at 38N/95W, a warm front extending NE, lift along the front producing TS by 18Z). The engine derives the products from the truth. The commentary is authored from the truth. Now every line on every chart has a known reason, and the instructor (the engine) can explain *why* every reading is what it is.

This is the load-bearing pedagogical bet of the course: **truth-aware commentary is the killer feature.** The course exists to consume what the engine produces.

## Why "looks-pro" charts from the start

The chart rendering decision is decoupled from the truth model. Investing in real AWC/NWS visual conventions (front symbols, isobar style, station model layout, NWS radar color ramp) is a one-time cost on each chart type, then $0 forever.

The trade-off is recognition. A pilot looking at an obviously synthetic-looking chart will not transfer the skill to real briefings. A pilot looking at a chart that visually matches what they'll see at AWC.gov on Monday morning will. The cost of looks-pro is small; the value is direct skill transfer.

We stop short of "indistinguishable from real" -- no real terrain or coastlines yet. Simplified state-outline backdrop is enough.

## Why the canonical events corpus

Famous historical wx situations serve three purposes:

1. **Compelling content.** "Walk through the brief from the morning of the 2024 Iowa derecho" is a lesson learners will remember. Synthetic situations are useful, but a named real event has gravity.
2. **Validation harness.** When the synthetic engine generates "midwestern dryline severe-weather day in May," does the output look like a dryline day to a meteorologist? The canonical corpus is the comparison set.
3. **Bridge.** Pure-synthetic generation is fast but unanchored. Real-data replay is anchored but rigid. Canonical events sit between -- hand-tuned truth models for specific real events, with the engine producing the products.

The corpus lives in `libs/wx-canonical/` (consumed by code, not just humans) so the drill engine and validation harness can reference events programmatically.

## Mastery gating and the knowledge graph

Each code, symbol, and field type is a knowledge-graph node ([ADR 011](../../docs/decisions/011-knowledge-graph-learning-system/decision.md)). Mastery is per-node. Triage drills assemble packs *only* from the learner's mastered subset. This is not a special-case mechanism; it's the standard knowledge-graph synthesis activity applied to weather.

Practical consequence: a learner who has mastered METAR fields but not TAF fields will see triage drills with METARs only. The course unlocks complexity as the underlying nodes are mastered.

## The translate-with-time-penalty mechanic

In triage drills, the learner can click "translate this item" on any field and get the decoded form. Cost: ~15s on the clock. This captures real flight-deck reality: looking something up costs time, not safety. It also lets a learner with shaky Stage 1 mastery still attempt Stage 3 drills -- they pay in time, not in being locked out.

Same mechanic extends to Stage 2 ("explain this whole product to me") at a higher penalty.

## Open questions

These are unresolved and will need decisions before the course graduates from skeleton:

- **Course length.** 4-week intensive vs quarter-length deep dive vs both? Probably both, with the syllabus collapsible. Confirm when first weeks are authored.
- **Capstone format.** Written go/no-go writeup vs verbal walkthrough vs scored triage drill? Probably layered: scored triage as the gate, written writeup as the artifact, verbal walkthrough as a CFI-reviewed option (per the [CFI-reviewed reference study](../../docs/platform/IDEAS.md) idea).
- **PIREP filing as a CFI duty.** The course currently treats PIREPs as a read product. Should it also teach *filing* PIREPs as a CFI obligation? Likely yes, but separate week or folded into Week 7?
- **Integration with `apps/sim/`.** Once the sim ships scenario weather, do those scenarios use the same engine? Almost certainly yes, but the integration shape is undecided.
