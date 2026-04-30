---
name: Aviation Weather drills
status: skeleton
parent: ../README.md
---

# Aviation Weather drills

Drill structure for the weather course. Three drill types run concurrently throughout the course, mapped to the three stages of [DESIGN_PRINCIPLES.md §7](../../../docs/platform/DESIGN_PRINCIPLES.md).

## Decode drills (Stage 1)

Spaced repetition over individual codes and symbols. One field per card. Atomic.

Examples:

- "What does `BKN015` mean in a METAR?"
- "Decode `FM1800 27015G25KT P6SM SCT025`"
- "What does this front symbol mean?" (with image)

Source: knowledge-graph nodes per code/symbol. Each course week emits a set of decode nodes; the spaced rep system schedules them across the learner's other rep work.

## Understand drills (Stage 2)

Read a single product, summarize the picture. Open-ended response checked against truth-model-authored expectations.

Examples:

- "Read this METAR. In one sentence, what's happening at the airfield?"
- "Read this TAF. What's the forecaster most worried about, and why?"
- "Read this surface analysis. Where is the weather coming from over the next 6 hours?"

Source: Weather Scenario Engine generates a single product, attaches an authored "what this snapshot means" expectation. Learner response is matched (initially keyword/concept-based, later LLM-graded against the truth) against the expectation.

## Triage drills (Stage 3)

The full preflight pack. Make a call under time pressure.

Drill shape:

1. Engine generates a briefing pack from a flight plan + scenario narrative
2. Pack is filtered to items the learner has mastered at Stage 1+2
3. Learner sees the pack with a clock running
4. Tasks: rank items by relevance, identify the load-bearing 5, make a go/no-go call
5. Translate-on-demand available at a 15s penalty per click
6. Debrief: what the learner ranked vs what mattered, what they missed, why

Source: Weather Scenario Engine + the learner's mastery state. The drill engine never asks the learner to triage what they can't decode.

## Translate-with-time-penalty

Per [DESIGN_PRINCIPLES.md §7](../../../docs/platform/DESIGN_PRINCIPLES.md). On any field in any product, the learner can click "translate" and see the decoded form. Cost: ~15s on the clock.

Penalty values, item types, and penalty escalation (translate the whole product = bigger penalty) will be tuned as drills land.

## Drill scheduling

Decode drills run on the standard spaced rep schedule -- they're regular knowledge-graph nodes. Understand drills schedule on a slower cadence, weighted toward products the learner has recently studied. Triage drills are gated by mastery and unlock automatically when the underlying nodes reach the threshold.

## Status

Skeleton. Drill mechanics will be implemented in `apps/study/` against the Weather Scenario Engine output. Implementation is downstream of the engine landing.
