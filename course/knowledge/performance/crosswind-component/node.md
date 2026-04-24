---
# === Identity ===
id: perf-crosswind-component
title: Crosswind Component
domain: performance
cross_domains: [aerodynamics, planning]

# === Knowledge character ===
knowledge_types: [procedural, conceptual, perceptual]
technical_depth: working
stability: stable

# === Cert relevance (multi-dimensional) ===
relevance:
  - cert: private
    bloom: apply
    priority: core
  - cert: private
    bloom: understand
    priority: core
  - cert: instrument
    bloom: apply
    priority: supporting
  - cert: commercial
    bloom: apply
    priority: core
  - cert: cfi
    bloom: evaluate
    priority: core

# === Graph edges ===
requires:
  - math-trig-sin-cos-refresher
  - wx-wind-direction-and-magnetic-variation
deepens: []
applied_by:
  - plan-vfr-cross-country
  - plan-ifr-cross-country
  - perf-takeoff-landing-distance
  - proc-crosswind-landing-technique
  - proc-go-around
taught_by:
  - teach-common-student-errors-landings
related:
  - perf-weight-and-balance
  - plan-vfr-cross-country
  - wx-reading-metars-tafs

# === Content & delivery ===
modalities: [reading, cards, calculation, visualization]
estimated_time_minutes: 35
review_time_minutes: 5

# === References ===
references:
  - source: PHAK
    detail: Chapter 14 (Airport Operations), crosswind discussion
    note: Foundational explanation of crosswind, runway alignment, and pattern considerations.
  - source: AFH
    detail: Chapter 8 (Approaches and Landings), crosswind approach and landing
    note: Technique reference -- crab, sideslip, and the transition. Correct place to send a pilot who understands the math but needs the skill.
  - source: AC 00-6B
    detail: Aviation Weather -- wind direction conventions
    note: Reminder that reported surface wind in METARs is magnetic at the station, while winds aloft are true. Runway headings are magnetic. Consistent frame matters for the angle calculation.
  - source: 14 CFR 23.233
    detail: 'Directional stability and control (certification basis for small airplanes)'
    note: Certification rule behind "max demonstrated crosswind" -- requires demonstration to at least 0.2 Vso. Explains why the POH number is demonstrated, not a legal limit unless the type certificate or AFM limitations section says so.
  - source: POH
    detail: Section 2 (Limitations) and Section 4 (Normal Procedures)
    note: Where the aircraft-specific max demonstrated crosswind value lives. Check Section 2 first -- if listed as a limitation, it IS a legal limit; if only in Section 4 or the performance notes, it is demonstrated only.
  - source: AIM
    detail: 'Chapter 7, Section 2 (Altimeter Setting and Wind Reporting)'
    note: Wind reporting conventions in ATIS/AWOS/ASOS. Gust reporting rules (10 kt+ spread between peak and lull).

# === Assessment ===
assessable: true
assessment_methods: [calculation, recall, teaching]
mastery_criteria: >-
  Given a reported surface wind and a runway heading, can compute the crosswind component to
  within 1 kt in under 30 seconds without a calculator, using either the formula
  crosswind = wind_speed * sin(angle) or the clock method. Can explain why the formula is
  sin(angle) * speed from a geometric decomposition argument. Can recall approximate sine
  values for 15, 30, 45, 60, and 75 degrees. Can state what max demonstrated crosswind
  means and when it is (and is not) a legal limit. As a CFI candidate, can correct the
  common student misconception that max demonstrated crosswind is "the maximum legal".
---

# Crosswind Component

## Context

Every landing uses this. Every single one. The wind is almost never exactly down the runway, so every approach you have ever flown involved -- implicitly or explicitly -- a crosswind component calculation. On a calm day it is trivial. On a gusting day, on a short runway, in an unfamiliar airplane, it is the number that decides whether you continue the approach or go somewhere else.

Picture short final, Runway 27, gusting from 310. The tower calls the wind. You have maybe ten seconds to decide: is this within the airplane, is it within me, do I continue? The pilot who has to stop and do trigonometry in their head at 300 feet AGL has already lost. The pilot who has internalized the clock method and the sine table has a number before the tower finishes reading the ATIS.

This node is about building that number into your bones. It is also about what the POH number actually means -- because "max demonstrated crosswind" is one of the most persistently misunderstood values in light aircraft operation, and if you teach, you will face this misconception.

## Problem

Concrete scenario:

- Runway 01 (010 magnetic).
- Tower reports wind 030 at 20 gust 28.

Questions:

- What is the crosswind component right now?
- What is the headwind component right now?
- If the wind were still 20 kt but the angle were 45 degrees instead of 20, what would the crosswind be?
- If the wind were 20 kt directly across the runway (090 degrees to the runway), what would the crosswind be?
- If the POH says "max demonstrated crosswind: 17 kt" -- are you legal to land? Are you smart to land? Are these the same question?

You should be able to answer all five in under a minute, in your head. If you cannot yet, that is what this node is for.

## Discover

Do not read ahead. Work through these questions with a pencil first.

1. **Decompose the wind.** Draw a runway as a horizontal line pointing east. Now draw an arrow representing a wind blowing across the runway from the upper-left, hitting the runway at some angle. The wind is a vector -- it has a magnitude (speed) and a direction. Decompose it into two perpendicular components: one **along** the runway (headwind or tailwind) and one **across** the runway (crosswind). Geometrically, those two components form two sides of a right triangle whose hypotenuse is the wind vector. What trig function gives you the side **opposite** the angle? What gives you the side **adjacent** to the angle?

2. **Edge cases first.** What fraction of the wind speed is crosswind when the wind is exactly 90 degrees to the runway? (Hint: at 90 degrees the wind is entirely perpendicular.) What fraction when the wind is 0 degrees to the runway -- wind straight down the runway? These two answers anchor the whole function: the crosswind fraction goes from 0 at 0 degrees to 1 at 90 degrees. What kind of curve does that, smoothly?

3. **The 30-60-90 triangle.** You have seen this in geometry: a right triangle with angles 30, 60, and 90 degrees has sides in ratio 1 : sqrt(3) : 2. The side opposite the 30 degree angle is exactly half the hypotenuse. So if wind is 20 kt at 30 degrees off the runway, what is the crosswind component, just from that geometry? Write it down before looking it up.

4. **The 45-45-90 triangle.** Two equal sides, equal angles. Both non-hypotenuse sides have length hypotenuse / sqrt(2), which is about 0.707. So at 45 degrees to the runway, what fraction of the wind is crosswind? What fraction is headwind? Do you notice that at 45 they are equal? Why does that have to be true, geometrically, before you do any math?

5. **Reach for an approximation.** You will not be drawing triangles on short final. Pilots use a **clock method**: the angle between wind and runway, expressed in minutes on a clock face (15 deg ~ 15 min, 30 deg ~ 30 min, etc.), gives an approximate crosswind fraction. Try to fill this table yourself from what you have just derived:

   | Angle | Exact sin | Clock fraction | Why this rounding is reasonable |
   | ----- | --------- | -------------- | ------------------------------- |
   |    15 |    ?      |     ?          |                                 |
   |    30 |    ?      |     ?          |                                 |
   |    45 |    ?      |     ?          |                                 |
   |    60 |    ?      |     ?          |                                 |
   |    75 |    ?      |     ?          |                                 |
   |    90 |    ?      |     ?          |                                 |

   Only after you have filled it in should you compare with the Reveal.

## Reveal

### The formulas

```text
crosswind = wind_speed * sin(angle_between_wind_and_runway)
headwind  = wind_speed * cos(angle_between_wind_and_runway)
```

The angle is the acute angle (0 to 90 degrees) between the wind direction and the runway heading. If the wind is behind you (angle greater than 90 degrees), you have a tailwind -- the cosine term goes negative, which is the math reminding you to pick a different runway.

Wind direction and runway heading must be in the same frame of reference. Tower-reported surface wind is magnetic; runway numbers are magnetic; those agree. Winds-aloft forecasts are true -- do not mix them with a magnetic runway heading without correcting for variation.

### Sine / cosine table (rounded values to carry in your head)

| Angle (deg) | sin (crosswind fraction) | cos (headwind fraction) |
| ----------- | ------------------------ | ----------------------- |
|          0  |                     0.00 |                    1.00 |
|         15  |                     0.26 |                    0.97 |
|         30  |                     0.50 |                    0.87 |
|         45  |                     0.71 |                    0.71 |
|         60  |                     0.87 |                    0.50 |
|         75  |                     0.97 |                    0.26 |
|         90  |                     1.00 |                    0.00 |

### The clock method (the one you actually use in flight)

Convert the angle between wind and runway into a fraction-of-wind-speed using clock minutes:

| Angle (deg) | Clock fraction | Crosswind % of wind speed |
| ----------- | -------------- | ------------------------- |
|         15  |            1/4 |                      25%  |
|         30  |            1/2 |                      50%  |
|         45  |            2/3 |                      67%  |
|         60  |            7/8 |                      87%  |
|      75-90  |            all |                    ~100%  |

This is a rounding of the sine table to fractions your brain can do at 500 AGL. It is exact at 30 and close at 45 (67 vs 71, slightly conservative) and 60 (87 vs 87, exact). For decision-making the small errors are on the conservative side and do not matter.

### Worked example from the Problem

Runway 01 (010). Wind 030 at 20 gust 28.

- Angle: 030 - 010 = 20 degrees.
- Crosswind (sustained): 20 * sin(20 deg) ~ 20 * 0.34 = **~7 kt**.
- Crosswind (gust): 28 * sin(20 deg) ~ 28 * 0.34 = **~10 kt**.
- Headwind (sustained): 20 * cos(20 deg) ~ 20 * 0.94 = **~19 kt**.
- Clock method check: 20 degrees is between 15 (1/4) and 30 (1/2) -- call it ~1/3. 20 * 1/3 ~ 7. Agrees.

You use the **gust value** for the crosswind decision, not the sustained. If you are close to a personal or POH limit at the sustained and the gust pushes you over, you are over.

### Max demonstrated crosswind -- what it actually means

From 14 CFR 23.233, a small airplane must be **demonstrated** during certification to handle a 90-degree crosswind component of at least 0.2 * Vso. That demonstration produces the number the POH publishes as "maximum demonstrated crosswind velocity".

What the number is:

- A value the manufacturer's test pilot actually landed the airplane in during certification.
- A useful planning reference.
- A ceiling on what the manufacturer is claiming the airplane has been **shown** to handle.

What the number is **not**, in general:

- A legal limit -- *unless* the POH Section 2 (Limitations) or the Type Certificate Data Sheet explicitly lists it as a limitation. Most light trainers (Cessna 172, Piper Cherokee, etc.) do not. Some turbine and transport-category airplanes do.
- A guarantee the airplane is safe at that value in your hands on this runway today.
- A measurement of what the airframe can handle -- a well-flown airplane can usually land in more; a poorly-flown airplane may not be safe in less.

### Location skill

- **Aircraft-specific max demonstrated crosswind:** POH Section 2 (Limitations) first -- if it is listed there, it is a legal limit. Then Section 4 (Normal Procedures) or the performance notes -- if only there, it is demonstrated, not a limit. The TCDS is the ultimate authority on whether it is a certification limitation.
- **Crosswind technique:** AFH Chapter 8 (Approaches and Landings), crosswind approach and landing.
- **Wind reporting conventions:** AIM Chapter 7 Section 2; reminder that ATIS/METAR surface wind is magnetic at controlled/reporting airports but sometimes true in DUATS/winds-aloft products. Always sanity-check.

## Practice

### Calculation prompts

1. **Easy.** Runway 18 (180). Wind 210 at 10. Crosswind? Headwind? (Target: 30-degree angle, so 10 * 0.5 = 5 kt crosswind, 10 * 0.87 ~ 9 kt headwind. Clock method: 1/2 of 10 is 5.)

2. **Medium.** Runway 27 (270). Wind 310 at 15 gust 22. Crosswind (sustained and gust)? Headwind? Is this a problem if max demonstrated crosswind is 15 kt? (Target: 40-degree angle; sin(40) ~ 0.64, so 15 * 0.64 ~ 10 kt sustained crosswind, 22 * 0.64 ~ 14 kt gust crosswind. Clock method: 40 is between 1/2 and 2/3, call it ~0.6. Decision: under demonstrated even on the gust, but 14 kt is firm airplane-flying.)

3. **Harder.** Runway 14 (140). Wind 200 at 12 gust 18, variable 180 to 230. What is the worst-case crosswind you could actually see, using the most adverse wind-direction end and the gust? (Target: worst direction is 230 -- angle 90 degrees to 140. sin(90) = 1. Worst-case crosswind = 18 kt straight across. This is the trap in variable-wind reporting: the reported mean is not the worst case.)

4. **CFI-level.** Student pilot, Cessna 172 (max demonstrated crosswind 15 kt per POH Section 4). Runway 09, wind 140 at 14 gust 20. Student is solo. What is the right call? Show the calculation. Then describe your brief to the student before they depart. (Target: 50-degree angle; clock ~0.75; 20 * 0.75 = 15 kt gust crosswind, right at demonstrated. Sustained 14 * 0.75 ~ 10.5 kt. For a solo student pilot: not appropriate; your endorsement should include a crosswind limit well below demonstrated, and the student should divert or wait.)

### Cards

- `card:perf-crosswind-formula` -- state the crosswind formula (recall).
- `card:perf-crosswind-clock-15` through `card:perf-crosswind-clock-75` -- clock-method fractions (recall, 5 cards).
- `card:perf-crosswind-max-demonstrated-meaning` -- what max demonstrated crosswind means and does not mean (recall + discrimination).
- `card:perf-crosswind-gust-vs-sustained` -- which value to use for the decision (judgment recall).

### Reps

- `rep:perf-crosswind-runway-selection` -- given two runways and a wind, pick the better one and justify.
- `rep:perf-crosswind-go-nogo` -- given a wind report and an airplane/pilot context, continue or divert.

### Drills

- `drill:perf-crosswind-mental-math-10` -- 10 random wind/runway combos, 30 seconds each, head math only.

### Interactive visualization

- `activity:crosswind-component` -- drag the wind around a compass rose relative to a fixed runway heading; live-update the crosswind and headwind components with visual decomposition. See `libs/activities/crosswind-component/`.

## Connect

### What changes if...

- **...the wind is gusty?** Use the gust value for the decision, not the sustained. Better to carry a little extra on final for nothing than to be caught a few knots short. Link: `proc-gust-factor-on-final`.
- **...the runway is contaminated (wet, slush, standing water)?** Directional control authority drops, especially on rollout. The effective crosswind limit falls well below demonstrated. Link: `perf-runway-contamination`, `perf-takeoff-landing-distance`.
- **...the airplane is at light weight?** Less mass means the crosswind has more effect on the airplane's drift, but also less tire friction for directional control on rollout. For most light aircraft, very light CG-forward landings are actually harder in crosswinds than mid-weight. Link: `perf-weight-and-balance`.
- **...you are a student pilot or low-time pilot?** Your personal minimum should be significantly below max demonstrated. A common starting point is 50 percent of demonstrated, raised gradually as proficiency is demonstrated with an instructor. Link: `proc-adm-personal-minimums`.
- **...you are landing a taildragger?** Crosswind margin drops drastically after the tail comes down -- the airplane is directionally unstable on the ground and a crosswind that was fine in a trike is a groundloop risk here. Link: `proc-tailwheel-landing-technique`.
- **...the wind is reported as "variable"?** The worst-case crosswind you could encounter is at the most-adverse end of the variation, not the mean. Link: `wx-variable-wind-reporting`.

### Links

- `plan-vfr-cross-country` -- runway selection as part of destination planning.
- `perf-takeoff-landing-distance` -- crosswind interacts with distance through reduced headwind.
- `proc-crosswind-landing-technique` -- crab, sideslip, and the transition.
- `proc-go-around` -- the decision to abandon the approach when the math changes on short final.

## Verify

### Novel calculation scenario

You are flying a Cessna 172 (max demonstrated crosswind 15 kt, POH Section 4 -- not a Section 2 limitation). You are approaching your home airport. Runway 27 is in use. ATIS reports:

> Wind 310 at 15 gust 22, variable 280 to 340. Altimeter 29.98.

1. Compute the crosswind and headwind components for the sustained wind.
2. Compute the crosswind component for the reported gust at the reported wind direction.
3. Compute the worst-case crosswind if the wind shifts to the most-adverse end of the reported variation, at the gust value.
4. Describe the decision process. Do you continue? What is your personal minimum here, and where does it come from?
5. The other runway at your airport is 09. What is the crosswind there? Is that a better choice? (Answer-building hints: runway 09 makes the wind from 310 a tailwind-plus-crosswind, so no.)

### Teaching exercise (CFI)

A student pilot tells you, with confidence, "I can't legally land if the crosswind is over 15 knots -- that's the max demonstrated crosswind in the POH for this airplane."

1. Is the statement true? Partially true? Where does the misconception come from?
2. What do you need to know about *this specific airplane* to give a definitive answer? (Hint: Section 2 vs Section 4, TCDS.)
3. Design a five-minute ground lesson that corrects this misconception without undermining the student's instinct toward conservative personal minimums. Your lesson should distinguish "demonstrated", "limitation", and "personal minimum" as three separate concepts, and should leave the student with a better -- not worse -- safety posture.
4. Write the endorsement or operational briefing you would use to set a solo student's crosswind limit below the POH demonstrated value. What number would you use for an early-solo student pilot, and why?

<!-- TODO(verify): confirm specific C172 POH locates "15 kt max demonstrated crosswind" in Section 4, not Section 2. Several C172 model years vary and the precise section number should be checked against the specific serial/year POH the learner is using. -->
<!-- TODO(verify): confirm the 0.2*Vso certification minimum under 14 CFR 23.233 is stated as a demonstration requirement in the current revision; this has been the historical rule but the Part 23 rewrite (amendment 23-64) restructured Part 23 and the current citation may be in the consensus standards (ASTM F3173 family). Citation may need updating to point to the current Part 23 section or the incorporated consensus standard. -->
