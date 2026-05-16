---
id: wx-outflow-boundary
title: Outflow Boundary
domain: weather
cross_domains: [flight-planning, decision-making]

knowledge_types: [conceptual, judgment]
technical_depth: working
stability: stable

minimum_cert: private
study_priority: standard
requires:
  - wx-thunderstorm-hazards
deepens:
  - wx-thunderstorm-hazards
applied_by:
  - wx-go-nogo-decision
taught_by: []
related:
  - wx-airmasses-and-fronts
  - wx-turbulence-types
  - wx-wind-systems

modalities: [reading, cards]
estimated_time_minutes: 20
review_time_minutes: 5

references:
  - source: AC 00-6B
    detail: Aviation Weather, Thunderstorms chapter -- downdrafts, gust fronts, and outflow
    note: Foundational treatment of the cold-air outflow and gust front mechanism.
  - source: FAA-H-8083-28
    detail: Aviation Weather Handbook, Chapter 20 -- Thunderstorms
    note: Modern consolidated reference for the gust front / outflow boundary and microburst.
  - source: FAA-H-8083-25
    detail: Pilot's Handbook of Aeronautical Knowledge, Chapter 12 -- Weather Theory
    note: Pilot-pitch introduction to thunderstorm structure including the downdraft and gust front.
  - source: AC 00-54
    detail: Pilot Windshear Guide
    note: Operational treatment of the gust-front windshear hazard near convection.

assessable: true
assessment_methods: [recall, scenario]
mastery_criteria: >
  Learner can explain how a thunderstorm downdraft spreading at the
  surface forms an outflow boundary, predict the wind shift, gust, and
  temperature drop that mark its passage, recognise an outflow boundary
  as both a low-level windshear hazard and a lifting trigger for new
  convection, and treat an outflow boundary well ahead of a cell as a
  reason to expect the storm's reach to be larger than the radar echo.
---

# Outflow Boundary

:::phase name="context"

A pilot watches a thunderstorm on the datalink display sitting twenty
miles off the departure end of the runway, moving away. The radar echo
is not over the field and is not forecast to be. The pilot launches.
Two miles out, climbing through 600 ft, the airplane hits a wall of
gusty wind, drops a notch of airspeed, and gets shoved sideways. The
storm never touched the airport. Its **outflow** did.

:::
:::phase name="problem"

A thunderstorm is dangerous well beyond the edge of its rain. To brief
convection competently a pilot has to understand that the cell's
*reach* -- the radius over which it can produce hazardous wind -- is
larger than the *echo* on the radar. The outflow boundary is the
feature that carries the storm's punch out ahead of itself, and it is
the reason "the storm isn't over the field" is not the same as "the
field is safe."

:::
:::phase name="discover"

Start from what a mature thunderstorm does to the air inside it. Rain
and hail falling through the cell drag air down with them; evaporating
precipitation chills that air further. The result is a **downdraft** --
a column of cold, dense air sinking out of the storm.

That cold air cannot keep going down once it hits the ground, so it
spreads. A pool of cold dense air races outward in every direction
along the surface, like water poured onto a tabletop. The leading edge
of that spreading cold pool is the **outflow boundary** (also called
the gust front).

Reason through what a pilot near that leading edge experiences as it
arrives:

- A sharp **wind shift** -- the ambient wind is replaced by wind
  blowing *outward from the storm*, which can be from a completely
  different direction.
- A sudden **gust** and a jump in wind speed -- the cold pool is
  moving fast, often 20 to 40 knots or more.
- A **temperature drop** -- the air is the storm's chilled downdraft
  air; a 10 to 20 degree F drop at boundary passage is common.
- Sometimes a low **shelf cloud** or a wall of blowing dust marking
  the boundary visually.

Now the key insight: that boundary keeps moving outward even after it
leaves the rain behind. It can be ten, twenty, thirty miles from the
parent cell. An airplane at low altitude crossing an outflow boundary
gets a fast, large change in headwind/tailwind component -- the
definition of **low-level windshear**, exactly where windshear is
least survivable: in the climb or on final.

There is a second consequence. An outflow boundary is a miniature cold
front: cold dense air wedging under warmer air ahead of it. That wedge
*lifts* the warm air. If the warm air is moist and unstable, the
outflow boundary becomes a **trigger for new thunderstorms**, often
right along the boundary itself. Storms breed storms.

:::
:::phase name="reveal"

The operational summary:

| Property         | What it means for the pilot                                   |
| ---------------- | ------------------------------------------------------------- |
| Source           | Cold downdraft air spreading out along the surface            |
| Marks passage    | Wind shift + gust + temperature drop, sometimes a shelf cloud |
| Reach            | 10 to 30+ miles ahead of the parent cell's radar echo         |
| Primary hazard   | Low-level windshear in the climb and on approach              |
| Secondary effect | Lifts warm moist air -- can trigger new convection            |

The hardest version of the outflow hazard is the **microburst**: a
small, intense, localised downdraft whose outflow produces a headwind
gain followed by a headwind loss within a mile or two. An airplane
flying through it on final first sees airspeed rise (tempting a power
reduction), then sees it collapse as it crosses into the downdraft and
the tailwind -- with little altitude to recover. AC 00-54, the Pilot
Windshear Guide, is built around this scenario.

The triage rule that falls out: do not measure a thunderstorm by where
its rain is. Measure it by where its outflow can reach. A cell twenty
miles away with a vigorous downdraft owns the airspace between it and
you. Standard convective avoidance distance -- 20 nautical miles from a
cell -- exists precisely because the outflow, the hail, and the
anvil-level turbulence all extend far beyond the visible storm.

:::
:::phase name="practice"

Next time convection is anywhere near a planned departure or arrival,
do not stop at "is the echo over the field?" Ask the outflow question:
how far could a gust front from that cell have already travelled, and
is my climb or approach path inside that radius? Watch the surface
observations at and around the field -- a sudden wind shift, gust, and
temperature drop in a METAR or on the ATIS, with a storm in the area,
is an outflow boundary announcing itself. If you see it, the storm's
reach has just been measured for you.

:::cards

- front: "What is an outflow boundary, and what physically creates it?"
  back: |
    An outflow boundary (gust front) is the leading edge of a pool of
    cold, dense air spreading outward along the surface from a
    thunderstorm. It is created by the storm's downdraft: rain and hail
    drag air down, evaporation chills it, and that cold air hits the
    ground and races outward in every direction like water poured on a
    table. The boundary is the front edge of that spreading cold pool.
  cardType: basic
  kind: recall
  tags: [weather, thunderstorm, outflow-boundary, gust-front, downdraft]
  source_ref: |
    AC 00-6B Thunderstorms; PHAK Ch 12; body Discover.
  acs_codes: [PA.I.C.K3h]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, Thunderstorms chapter
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 20 -- Thunderstorms
    - kind: phak
      cite: FAA-H-8083-25 Pilot's Handbook of Aeronautical Knowledge, Chapter 12 -- Weather Theory

- front: "What three things mark the passage of an outflow boundary at the surface?"
  back: |
    A sharp wind shift (wind now blowing outward from the storm), a
    sudden gust and jump in wind speed (the cold pool moves 20-40+ kt),
    and a temperature drop (often 10-20 deg F, because it is the
    storm's chilled downdraft air). A low shelf cloud or wall of
    blowing dust may mark it visually.
  cardType: basic
  kind: recall
  tags: [weather, thunderstorm, outflow-boundary, gust-front]
  source_ref: |
    AC 00-6B; body Discover.
  acs_codes: [PA.I.C.K3h]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, Thunderstorms chapter
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 20 -- Thunderstorms
    - kind: phak
      cite: FAA-H-8083-25 Pilot's Handbook of Aeronautical Knowledge, Chapter 12 -- Weather Theory

- front: "Why is an outflow boundary a hazard even when the thunderstorm's rain is 20 miles away?"
  back: |
    The boundary keeps racing outward along the surface long after it
    leaves the rain behind -- 10 to 30+ miles from the parent cell.
    Crossing it at low altitude produces a fast, large change in
    headwind/tailwind component: low-level windshear, in the climb or
    on final where it is least survivable. The storm's reach is larger
    than its radar echo.
  cardType: basic
  kind: recall
  tags: [weather, thunderstorm, outflow-boundary, windshear]
  source_ref: |
    AC 00-54 Pilot Windshear Guide; body Discover + Reveal.
  acs_codes: [PA.I.C.K3h]
  source_authority:
    - kind: ac
      cite: AC 00-54 Pilot Windshear Guide
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 20 -- Thunderstorms

- front: "How can an outflow boundary trigger new thunderstorms?"
  back: |
    An outflow boundary is a miniature cold front: cold dense air
    wedging under warmer air ahead of it. That wedge lifts the warm
    air. If the warm air is moist and unstable, the lift can push it
    past saturation and free convection -- new storms form along the
    boundary itself. Storms breed storms.
  cardType: basic
  kind: recall
  tags: [weather, thunderstorm, outflow-boundary, convection-trigger]
  source_ref: |
    AC 00-6B; body Discover.
  acs_codes: [PA.I.C.K3h]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, Thunderstorms chapter
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 20 -- Thunderstorms

- front: "What is a microburst, and why is it the most dangerous form of the outflow hazard?"
  back: |
    A microburst is a small, intense, localised downdraft whose outflow
    produces a headwind gain followed by a headwind loss within a mile
    or two. On final an airplane first sees airspeed rise (tempting a
    power reduction), then sees it collapse as it crosses into the
    downdraft and tailwind -- with little altitude to recover. It is
    the scenario AC 00-54 is built around.
  cardType: basic
  kind: recall
  tags: [weather, thunderstorm, microburst, windshear]
  source_ref: |
    AC 00-54 Pilot Windshear Guide; body Reveal.
  acs_codes: [PA.I.C.K3h]
  source_authority:
    - kind: ac
      cite: AC 00-54 Pilot Windshear Guide
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 20 -- Thunderstorms

- front: "A thunderstorm's radar echo is 20 miles from the field and moving away, so the field is safe to depart -- true or false, and why?"
  back: |
    False. The storm's reach is larger than its echo. Its outflow
    boundary can already be at or near the field, carrying gusty
    windshear into the climb path. Convective avoidance is measured by
    where the outflow, hail, and anvil turbulence can reach -- the
    standard 20 nm avoidance distance exists for exactly this reason --
    not by where the rain is plotted.
  cardType: basic
  kind: recall
  tags: [weather, thunderstorm, outflow-boundary, go-nogo, scenario]
  source_ref: |
    Body Context + Reveal.
  rationale: |
    Scenario card from the Context. Trains the body's pedagogical
    anchor: measure a storm by where its outflow can reach, not by
    where its echo is plotted.
  acs_codes: [PA.I.C.K3h]
  source_authority:
    - kind: ac
      cite: AC 00-54 Pilot Windshear Guide
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 20 -- Thunderstorms
:::

:::
:::phase name="connect"

The outflow boundary deepens `wx-thunderstorm-hazards`: it is the
mechanism behind the gust-front windshear and the surface wind hazard
that node names. It connects to `wx-airmasses-and-fronts` -- an outflow
boundary behaves like a fast, shallow, short-lived cold front, and the
lifting it does is the same wedge mechanism a synoptic cold front uses.
It feeds `wx-turbulence-types` (low-level mechanical and convective
turbulence) and `wx-wind-systems` (a local, storm-generated wind
system). For the go/no-go decision, it is the reason convective
avoidance distance is measured generously.

:::
:::phase name="verify"

For the next convective day near your route, predict where outflow
boundaries are likely from the cells you see, then check surface
observations downwind of those cells for the wind-shift / gust /
temperature-drop signature. Crossing predicted reach against observed
boundary passages calibrates how far you should be giving convection a
berth.

:::
