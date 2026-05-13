---
id: wx-personal-minimums
title: Personal Weather Minimums
domain: weather
cross_domains: [decision-making]

knowledge_types: [judgment]
technical_depth: working
stability: stable

minimum_cert: private
study_priority: critical
requires:
  - airspace-vfr-weather-minimums
deepens: []
applied_by:
  - wx-go-nogo-decision
  - plan-vfr-cross-country
  - plan-ifr-cross-country
taught_by: []
related:
  - proc-adm-hazardous-attitudes

modalities: [reading, reps]
estimated_time_minutes: 25
review_time_minutes: 5

references:
  - source: FAA-H-8083-2
    detail: Risk Management Handbook, Chapter 6 -- Single Pilot Resource Management
    note: Personal minimums framework, the IMSAFE / PAVE / 5P checklists.
  - source: FAA Pamphlet P-8740-25
    detail: Personal Minimums Checklist
    note: The classic FAA-published worksheet for setting personal minimums per pilot.
  - source: AIM
    detail: 7-1-3 -- Use of Aviation Weather Products
    note: Decision-framework context for weather-driven personal minimums.

assessable: true
assessment_methods: [scenario]
mastery_criteria: >
  Learner can articulate the rationale for personal minimums above
  legal minimums, set a defensible numerical floor for ceiling, vis,
  crosswind, and night-VFR currency factors based on their experience
  level, and recognize the situational pressure (passengers, schedule,
  destination commitment) that makes personal-minimums adherence
  essential rather than optional.
---

# Personal Weather Minimums

## Context

You're a 200-hour PPL flying yourself, your spouse, and your
in-laws home from a $300 hamburger 90 minutes after sunset. The
destination METAR shows 1,500 broken, 6 SM, wind 18 gusting 25 at
60 degrees off the runway. All legal. All adverse to your actual
flying experience. The decision now is not whether the weather is
legal -- it is whether the weather is within the floor you set when
you weren't being judged by your in-laws.

## Problem

Legal minimums are the floor for the regulatory environment, not the
floor for any specific pilot. The mismatch is biggest where it
matters most: at low experience, with passenger / schedule / destination
pressure pushing the decision toward "go." Personal minimums are the
pre-committed numerical floor a pilot adopts to remove the moment-of-
decision negotiation.

## Discover

Why do personal minimums exist? Three forcing functions:

1. Skill decays. The pilot who flew 14 KT crosswinds yesterday isn't
   necessarily the pilot who can fly 14 KT crosswinds today. Currency
   gates are personal, not just regulatory.
2. Stress narrows attention. With passengers, fatigue, or
   get-there-itis, your effective performance is below your peak.
   The minimums you'd accept at the peak are wrong for the moment.
3. Workload varies. A 1,500 broken, 6 SM evening flight to an unfamiliar
   destination with terrain on three sides is not the same workload
   as 1,500 broken, 6 SM in a familiar pattern.

The minimums you set should reflect not what's legal but what leaves
you margin to handle the unexpected -- a deteriorating ceiling, a
shift in wind, a missed approach -- without the day going bad.

## Reveal

The FAA's Personal Minimums Checklist (P-8740-25) suggests setting
floors for each of the operational variables and adjusting them for
risk-multiplier factors. Sample structure:

| Variable         | Solo / VFR | With passengers | Mountainous / unfamiliar |
| ---------------- | ---------- | --------------- | ------------------------ |
| Ceiling (day)    | 1500 ft    | 2500 ft         | 3500 ft                  |
| Visibility       | 5 SM       | 7 SM            | 10 SM                    |
| Crosswind        | 12 KT      | 8 KT            | 6 KT                     |
| Wind / gusts     | 20 / 25    | 15 / 20         | 12 / 18                  |
| Night ceiling    | 3000 ft    | 5000 ft         | 8000 ft                  |
| Night visibility | 7 SM       | 10 SM           | 15 SM                    |

These numbers are illustrative; your numbers depend on your hours,
your recency, your aircraft, your terrain. The discipline is in the
existence of a numerical floor, not its specific value.

The risk multiplier table:

- Add a margin for: night, mountainous terrain, unfamiliar field,
  marginal currency, fatigue, passengers, time pressure.
- Subtract margin for: very familiar field, day, recent currency in
  similar conditions, no schedule pressure, light load.

Three rules of operation:

1. The minimums are written down and set when you are not under
   decision pressure.
2. Once a flight starts trending below your minimums, it is over.
   Divert, land, wait. The minimums don't move just because you're
   in motion.
3. The minimums are recalibrated on a fixed cadence (annually,
   after every IPC, after every 100 hours) -- not after every
   borderline trip.

## Practice

Build your minimums table now, before the next flight. For each row,
write the number you'd defend to another CFI, not the number that
matches what you're capable of on a great day. Tape it inside your
flight bag's first pocket.

For the next planned cross-country, run the brief and explicitly
compare the briefed conditions against your written minimums. Does
the briefed weather meet your floor at every leg, with margin for
forecast deterioration? If yes, go. If marginal, identify the
specific concern and the trigger that would make you turn around.

### Cards (spaced repetition)

Cards mined from the body. Why-minimums-exist cards lock the rationale;
the table-shape card builds the structure; the three operating rules
are the discipline; the scenario card walks the trip-pressure case.

```yaml-cards
- front: "Personal minimums vs. legal minimums -- what's the difference and why does it matter?"
  back: |
    Legal minimums are the regulatory floor for any pilot. Personal minimums
    are the pre-committed numerical floor a specific pilot adopts to remove
    the moment-of-decision negotiation. The mismatch is biggest where it
    matters most: at low experience, with passenger / schedule / destination
    pressure pushing the call toward 'go.' Legal sets the boundary the
    aircraft can be flown across; personal sets the boundary *this* pilot
    is willing to fly across today.
  cardType: basic
  kind: recall
  tags: [weather, personal-minimums, regulation, faa-h-8083-2]
  source_ref: |
    FAA-H-8083-2 Risk Management Handbook; body Problem.
  acs_codes: [PA.I.C.R1b]
  source_authority:
    - kind: other
      cite: FAA-H-8083-2 Risk Management Handbook, Chapter 6 -- Single Pilot Resource Management
    - kind: aim
      cite: AIM 7-1-3 -- Use of Aviation Weather Products

- front: "Three forcing functions that make personal minimums necessary?"
  back: |
    1. Skill decays. The pilot who flew 14 KT crosswinds yesterday is not
       necessarily the pilot who can fly 14 KT crosswinds today. Currency
       gates are personal, not just regulatory.
    2. Stress narrows attention. With passengers, fatigue, or get-there-itis,
       effective performance is below peak; the peak-performance minimums
       are wrong for the moment.
    3. Workload varies. 1,500 broken / 6 SM at an unfamiliar destination
       with terrain on three sides is not the same workload as 1,500
       broken / 6 SM at a familiar field.
  cardType: basic
  kind: recall
  tags: [weather, personal-minimums, judgment, faa-h-8083-2]
  source_ref: |
    FAA-H-8083-2; body Discover.
  acs_codes: [PA.I.C.R1b]
  source_authority:
    - kind: other
      cite: FAA-H-8083-2 Risk Management Handbook, Chapter 6 -- Single Pilot Resource Management
    - kind: aim
      cite: AIM 7-1-3 -- Use of Aviation Weather Products

- front: "Shape of a personal-minimums table per FAA P-8740-25 -- what variables and what columns?"
  back: |
    Rows: ceiling (day), visibility, crosswind, wind/gusts, ceiling (night),
    visibility (night). Columns: Solo / VFR -> With passengers -> Mountainous
    or unfamiliar. Numbers go up (more margin) as columns move right;
    crosswind numbers go down (less tolerance). The values are illustrative
    -- yours depend on hours, recency, aircraft, terrain. The discipline is
    in the *existence* of a written floor, not its specific value.
  cardType: basic
  kind: recall
  tags: [weather, personal-minimums, table, faa-p-8740-25]
  source_ref: |
    FAA Pamphlet P-8740-25; body Reveal.
  acs_codes: [PA.I.C.R1b]
  source_authority:
    - kind: other
      cite: FAA-H-8083-2 Risk Management Handbook, Chapter 6 -- Single Pilot Resource Management
    - kind: aim
      cite: AIM 7-1-3 -- Use of Aviation Weather Products

- front: "Risk multipliers -- what factors add margin, what factors subtract?"
  back: |
    Add margin for: night, mountainous terrain, unfamiliar field, marginal
    currency, fatigue, passengers, time pressure.
    Subtract margin for: very familiar field, day, recent currency in
    similar conditions, no schedule pressure, light load.
    A flight that picks up two 'add margin' factors (night + passengers +
    unfamiliar) needs floors well above the base table.
  cardType: basic
  kind: recall
  tags: [weather, personal-minimums, risk-multipliers, faa-h-8083-2]
  source_ref: |
    FAA-H-8083-2; body Reveal.
  acs_codes: [PA.I.C.R1b]
  source_authority:
    - kind: other
      cite: FAA-H-8083-2 Risk Management Handbook, Chapter 6 -- Single Pilot Resource Management
    - kind: aim
      cite: AIM 7-1-3 -- Use of Aviation Weather Products

- front: "Three rules of operation for personal minimums."
  back: |
    1. The minimums are written down and set when you are NOT under
       decision pressure.
    2. Once a flight starts trending below your minimums, it is over.
       Divert, land, wait. Minimums don't move just because you're in
       motion.
    3. Recalibrate on a fixed cadence (annually, after every IPC, after
       every 100 hours) -- not after every borderline trip.
  cardType: basic
  kind: recall
  tags: [weather, personal-minimums, discipline, judgment]
  source_ref: |
    Body Reveal "three rules of operation."
  acs_codes: [PA.I.C.R1b]
  source_authority:
    - kind: other
      cite: FAA-H-8083-2 Risk Management Handbook, Chapter 6 -- Single Pilot Resource Management
    - kind: aim
      cite: AIM 7-1-3 -- Use of Aviation Weather Products

- front: "Why must personal minimums be written down and set when NOT under decision pressure?"
  back: |
    Set under pressure, the number you 'choose' is whatever number makes
    the pressure go away -- which is whatever number you can argue past in
    the moment. Set in advance, written down, taped inside the flight bag,
    the number is a commitment to your earlier, unpressured self. The
    pre-commitment is what makes the floor real; the writing-down is
    what makes the pre-commitment exist.
  cardType: basic
  kind: recall
  tags: [weather, personal-minimums, pre-commitment, judgment]
  source_ref: |
    Body Reveal rule 1.
  acs_codes: [PA.I.C.R1b]
  source_authority:
    - kind: other
      cite: FAA-H-8083-2 Risk Management Handbook, Chapter 6 -- Single Pilot Resource Management
    - kind: aim
      cite: AIM 7-1-3 -- Use of Aviation Weather Products

- front: "When a flight in motion starts trending below your minimums, what does the body say to do?"
  back: |
    Divert, land, wait. The minimums don't move because you're in motion.
    Rule 2 of the three operating rules: 'once a flight starts trending
    below your minimums, it is over.' The discipline is treating the
    written number as a hard ceiling that becomes more important once
    fatigue and trip-pressure are pressing on the cockpit, not less.
  cardType: basic
  kind: recall
  tags: [weather, personal-minimums, divert, in-flight, judgment]
  source_ref: |
    Body Reveal rule 2.
  acs_codes: [PA.I.C.R1b]
  source_authority:
    - kind: other
      cite: FAA-H-8083-2 Risk Management Handbook, Chapter 6 -- Single Pilot Resource Management
    - kind: aim
      cite: AIM 7-1-3 -- Use of Aviation Weather Products

- front: "200-hour PPL flying spouse and in-laws home 90 min after sunset. METAR: 1500 broken, 6 SM, wind 18G25 at 60 off the runway. All legal. What's the question to ask?"
  back: |
    The question isn't 'is it legal?' -- the brief already shows it is.
    The question is whether the weather is within the floor you set when
    you weren't being judged by your in-laws. Night ceiling, crosswind
    component, and gust factor all interact -- multiple 'add margin' factors
    (night, passengers, unfamiliar, gusts at 60 degrees) compound. The
    pre-committed number is what survives the moment when the family is
    waiting at the airplane.
  cardType: basic
  kind: recall
  tags: [weather, personal-minimums, scenario, trip-pressure]
  source_ref: |
    Body Context scenario.
  rationale: |
    Scenario card from the body's Context. Trains the reframing the body
    teaches: the question is not legality, it's adherence to the written floor.
  acs_codes: [PA.I.C.R1b]
  source_authority:
    - kind: other
      cite: FAA-H-8083-2 Risk Management Handbook, Chapter 6 -- Single Pilot Resource Management
    - kind: aim
      cite: AIM 7-1-3 -- Use of Aviation Weather Products

- front: "How do you calibrate whether your personal minimums are defensible?"
  back: |
    Show your written minimums to another instructor and ask: 'are these
    floors defensible for my experience level?' Adjust based on the answer.
    The minimums you can defend to a peer are the minimums you can defend
    to yourself in the moment. The peer-review step is what catches the
    'I'd accept that for me' rationalisation that doesn't survive an
    outsider's read of your hours and recency.
  cardType: basic
  kind: recall
  tags: [weather, personal-minimums, peer-review, calibration]
  source_ref: |
    Body Verify.
  acs_codes: [PA.I.C.R1b]
  source_authority:
    - kind: other
      cite: FAA-H-8083-2 Risk Management Handbook, Chapter 6 -- Single Pilot Resource Management
    - kind: aim
      cite: AIM 7-1-3 -- Use of Aviation Weather Products

- front: "How do personal minimums interact with the go/no-go decision?"
  back: |
    Personal minimums are the numerical floor the go/no-go framework
    measures against -- the threshold the hazard / trend inputs are
    compared to. The go/no-go framework names the hazard or trend; the
    personal-minimums table says whether that hazard's level is above or
    below your floor. Both must align: a hazard within minimums + a
    framework decision to go = defensible; a hazard outside minimums +
    a 'go' = the trip-pressure override the minimums were written to
    prevent.
  cardType: basic
  kind: recall
  tags: [weather, personal-minimums, go-nogo]
  source_ref: |
    Body Connect.
  acs_codes: [PA.I.C.R1b, PA.I.C.S3]
  source_authority:
    - kind: other
      cite: FAA-H-8083-2 Risk Management Handbook, Chapter 6 -- Single Pilot Resource Management
    - kind: aim
      cite: AIM 7-1-3 -- Use of Aviation Weather Products
```

## Connect

This node serves R1b. It feeds the go/no-go decision node directly
-- personal minimums are the numerical input to the framework that
node describes. It pairs with the hazardous-attitudes node, which
covers the cognitive failure modes (anti-authority, machismo,
invulnerability, impulsivity, resignation) that drive minimum-
override decisions.

## Verify

Show your written personal minimums to another instructor. Ask:
"are these floors defensible for my experience level?" Adjust based
on the answer. The minimums you can defend to a peer are the
minimums you can defend to yourself in the moment.
