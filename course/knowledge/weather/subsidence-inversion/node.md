---
id: wx-subsidence-inversion
title: Subsidence Inversion
domain: weather
cross_domains: [flight-planning, decision-making]

knowledge_types: [conceptual, judgment]
technical_depth: working
stability: stable

minimum_cert: private
study_priority: standard
requires:
  - wx-stability-and-instability
deepens:
  - wx-stability-and-instability
applied_by:
  - wx-go-nogo-decision
taught_by: []
related:
  - wx-fog-and-visibility-obstructions
  - wx-clouds-and-precipitation

modalities: [reading, cards]
estimated_time_minutes: 20
review_time_minutes: 5

references:
  - source: AC 00-6B
    detail: Aviation Weather, Stability chapter -- temperature inversions and subsidence
    note: Foundational treatment of inversions, including the subsidence inversion aloft.
  - ref: airboss-ref:handbooks/avwx/13
    chapter_title: Atmospheric Stability
    redirected_from: airboss-ref:handbooks/avwx/FAA-H-8083-28/13
    note: >-
      Modern consolidated reference for inversion types and their effect on the boundary layer.
  - ref: airboss-ref:handbooks/phak/12
    chapter_title: Weather Theory
    redirected_from: airboss-ref:handbooks/phak/FAA-H-8083-25/12
    note: >-
      Pilot-pitch introduction to stable air, inversions, and stratiform cloud.

assessable: true
assessment_methods: [recall, scenario]
mastery_criteria: >
  Learner can explain how large-scale sinking air warms adiabatically
  and forms an elevated temperature inversion, recognise that inversion
  as the lid that traps moisture below it into a marine or coastal
  stratus deck, predict that the deck will be persistent and slow to
  lift because the cap suppresses the convection that would mix it out,
  and treat a strong subsidence inversion in a forecast sounding as a
  reason to expect a stubborn low ceiling rather than a clearing trend.
---

# Subsidence Inversion

:::phase name="context"

A pilot on the California coast checks the morning forecast for a
mid-day departure. The marine layer is in: 800 ft overcast, tops
reported near 2,000 ft, severe-clear above. The pilot reasons the way a
pilot from the interior would -- the sun will heat the ground, the
clouds will burn off, the ceiling will lift. Mid-day comes. The deck is
still 800 ft overcast. It was 800 ft overcast yesterday too, and it
will be 800 ft overcast tomorrow. Something is holding that ceiling
down, and it is not the ground. It is a layer of warm air sitting on
top of the cloud that the pilot never saw and never briefed.

:::
:::phase name="problem"

A pilot has to be able to tell a *transient* low ceiling from a
*persistent* one. A radiation-fog ceiling burns off; a frontal ceiling
moves through; a marine stratus deck under a subsidence inversion does
neither -- it can sit for days. Briefing it as "it will lift like the
fog did" is how a pilot ends up holding short of a runway that never
opens, or worse, scud-running under a deck that has no intention of
clearing. The feature that makes the difference is invisible on a
satellite picture and invisible from the ground. It shows up only in
the temperature profile. To brief coastal and marine weather competently
a pilot has to understand the lid: the subsidence inversion.

:::
:::phase name="discover"

Start from a fact already established in `wx-stability-and-instability`:
when air sinks, it is compressed by the higher pressure below it, and
compression warms it. A descending parcel warms at the dry adiabatic
rate even though no heat is added to it. Sinking air is warming air.

Now scale that up. Inside a large area of high pressure, the whole
column of air above is gently sinking -- this large-scale slow descent
is called **subsidence**. The air is not sinking fast, but it is sinking
over a vast area for days at a time. As it descends it warms,
adiabatically, the entire way down.

Reason through what that does to the temperature profile. Normally air
gets colder with height. But here is a thick layer of air that has
descended from high up, warming as it came. By the time it settles to
maybe 2,000 or 4,000 ft above the surface, it is *warmer than the air
beneath it*. Temperature now rises with height across that layer
instead of falling. That is the definition of a **temperature
inversion** -- and because subsidence built it, it is a **subsidence
inversion**.

Now ask the key question: what does a layer of warm air aloft do to
the cooler, moister air trapped underneath it? Picture a parcel of that
lower air trying to rise. As it climbs it cools. The moment it reaches
the inversion, it runs into air that is *warmer* than the parcel.
Warmer surrounding air means the parcel is now denser than its
surroundings -- it has no buoyancy, it stops, it sinks back. The
inversion is a lid. Nothing from below can punch through it.

Trace the consequences:

- Moisture evaporating from the surface (especially a cool ocean) is
  stirred upward by low-level turbulence but **cannot escape above the
  inversion**. It accumulates in the shallow layer beneath the lid.
- That trapped moist layer saturates and forms cloud -- a flat,
  featureless **stratus** deck whose tops sit right at the base of the
  inversion. The inversion height *is* the cloud-top height.
- The deck is **persistent**. The sun heating the ground would normally
  drive convection that mixes a cloud layer out. But the inversion caps
  that convection before it can do the job. The lid that built the
  deck also protects it.

This is the engine behind marine stratus and coastal stratus: a cool
sea surface supplying moisture, low-level turbulence stirring it, and a
subsidence inversion from the offshore high capping it all into a
stubborn shallow overcast.

:::
:::phase name="reveal"

The operational summary:

| Property            | What it means for the pilot                                         |
| ------------------- | ------------------------------------------------------------------- |
| Source              | Large-scale sinking air in a high, warming as it descends           |
| Profile signature   | Temperature rises with height across an elevated layer              |
| Effect on air below | Acts as a lid -- caps rising parcels, traps moisture beneath        |
| Cloud produced      | Flat stratus deck with tops at the inversion base                   |
| Behaviour           | Persistent -- the cap suppresses the convection that would clear it |

The diagnostic skill is reading the inversion in a forecast sounding
or a forecast-discussion. A subsidence inversion shows as a wedge in
the temperature trace where the line bends back toward warmer air with
height. The *strength* of the inversion (how many degrees of warming
across the layer) and its *height* tell the story:

- A **strong, low** inversion means a tenacious deck with a low ceiling
  that will not lift. Burnoff, if any, is limited to the immediate
  coastline where afternoon heating is strongest.
- A **weakening** inversion -- the high moving off, the subsidence
  easing -- is the real forecast signal that the marine layer will
  finally mix out and clear.

The triage rule that falls out: when a low stratus ceiling is in the
forecast, do not assume it will burn off. Ask *what is holding it
down*. If the answer is a subsidence inversion from a parked high, the
deck is persistent until the inversion itself weakens -- and the
forecast clearing time is governed by the high, not by the sun coming
up over the field.

:::
:::phase name="practice"

Next time a marine or coastal stratus ceiling is on your route, do not
stop at the reported ceiling. Look for the lid. Check the forecast
discussion or a forecast sounding for an elevated inversion and note
its strength and height. Then ask the persistence question: is this
inversion forecast to weaken during my window, or is the high parked?
If the high is parked, plan for the ceiling you see now, not the
ceiling you wish for -- the deck will still be there when you arrive.

:::cards

- front: "What is a subsidence inversion, and what physically creates it?"
  back: |
    A subsidence inversion is an elevated temperature inversion -- a
    layer aloft where temperature rises with height instead of falling.
    It is created by large-scale sinking air inside a high: as the air
    slowly descends over a vast area, it is compressed and warms
    adiabatically the whole way down. By the time that descended air
    settles a couple thousand feet above the surface, it is warmer
    than the air beneath it, producing the inversion.
  cardType: basic
  kind: recall
  tags: [weather, stability, inversion, subsidence]
  source_ref: |
    AC 00-6B Stability; AWH Ch 13; body Discover.
  acs_codes: [PA.I.C.K3a]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, Stability chapter
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 13 -- Atmospheric Stability
    - kind: phak
      cite: FAA-H-8083-25 Pilot's Handbook of Aeronautical Knowledge, Chapter 12 -- Weather Theory

- front: "Why does a subsidence inversion act as a lid on the air beneath it?"
  back: |
    A parcel of lower air trying to rise cools as it climbs. When it
    reaches the inversion it meets air that is warmer than the parcel,
    so the parcel is now denser than its surroundings -- it has no
    buoyancy, stalls, and sinks back. Nothing from below can punch
    through the warm layer, so the inversion caps all rising motion.
  cardType: basic
  kind: recall
  tags: [weather, stability, inversion, subsidence]
  source_ref: |
    AC 00-6B; body Discover.
  acs_codes: [PA.I.C.K3a]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, Stability chapter
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 13 -- Atmospheric Stability

- front: "How does a subsidence inversion produce and sustain a marine stratus deck?"
  back: |
    Moisture evaporating from a cool sea surface is stirred upward by
    low-level turbulence but cannot escape above the inversion, so it
    accumulates in the shallow capped layer, saturates, and forms a
    flat stratus deck whose tops sit at the inversion base. The deck is
    persistent because the same cap suppresses the daytime convection
    that would otherwise mix the cloud out.
  cardType: basic
  kind: recall
  tags: [weather, stability, inversion, marine-stratus, fog]
  source_ref: |
    AC 00-6B; body Discover.
  acs_codes: [PA.I.C.K3a]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, Stability chapter
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 13 -- Atmospheric Stability

- front: "In a forecast sounding, what signals that a low stratus deck will be persistent rather than burning off?"
  back: |
    A strong, low subsidence inversion -- a sharp bend in the
    temperature trace toward warmer air with height. A strong, low
    inversion means a tenacious deck with a low ceiling that will not
    lift. The deck clears only when the inversion itself weakens (the
    high moving off, subsidence easing), not when the sun comes up.
  cardType: basic
  kind: recall
  tags: [weather, stability, inversion, sounding]
  source_ref: |
    AWH Ch 13; body Reveal.
  acs_codes: [PA.I.C.K3a]
  source_authority:
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 13 -- Atmospheric Stability

- front: "A coastal field reports 800 ft overcast in the morning -- it will burn off by mid-day like fog does, true or false, and why?"
  back: |
    False, if the deck is marine stratus under a subsidence inversion.
    Radiation fog burns off because surface heating drives convection
    that mixes it out, but a subsidence inversion caps that convection
    before it can do the job -- the lid that built the deck also
    protects it. Such a deck is persistent until the inversion weakens,
    which is governed by the parked high, not by daytime heating.
  cardType: basic
  kind: recall
  tags: [weather, stability, inversion, marine-stratus, go-nogo, scenario]
  source_ref: |
    Body Context + Reveal.
  rationale: |
    Scenario card from the Context. Trains the body's pedagogical
    anchor: ask what is holding a low ceiling down before assuming it
    will lift.
  acs_codes: [PA.I.C.K3a]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, Stability chapter
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 13 -- Atmospheric Stability
:::

:::
:::phase name="connect"

The subsidence inversion deepens `wx-stability-and-instability`: it is
the most operationally important elevated inversion, and it is a direct
application of the adiabatic warming of sinking air that the stability
node establishes. It connects to `wx-fog-and-visibility-obstructions`
-- marine and coastal stratus is the low-IFR ceiling the subsidence
inversion produces, and the inversion is the reason that ceiling is
persistent rather than transient. It connects to
`wx-clouds-and-precipitation`: the stable, capped layer beneath a
subsidence inversion is exactly the environment that produces flat
stratiform cloud rather than convective cloud. For the go/no-go
decision, the inversion is the feature that turns a low ceiling from a
"wait an hour" problem into a "this is the weather for the day"
problem.

:::
:::phase name="verify"

For the next coastal or marine forecast on your route, find the
subsidence inversion in the forecast discussion or a forecast sounding,
note its strength and height, and predict whether the stratus deck will
persist or clear during your window. Then check the observations
through the day. Crossing your inversion-based prediction against what
the ceiling actually did calibrates how much weight to give the lid
when it appears in a future briefing.

:::
