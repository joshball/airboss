---
id: wx-mixing-height
title: Mixing Height
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

modalities: [reading, cards]
estimated_time_minutes: 20
review_time_minutes: 5

references:
  - source: AC 00-6B
    detail: Aviation Weather, Stability chapter -- the mixed layer and inversions
    note: Foundational treatment of low-level mixing and the inversion that caps it.
  - ref: airboss-ref:handbooks/avwx/13
    chapter_title: Atmospheric Stability
    redirected_from: airboss-ref:handbooks/avwx/FAA-H-8083-28/13
    note: >-
      Modern consolidated reference for the boundary layer and surface-based mixing.
  - ref: airboss-ref:handbooks/phak/12
    chapter_title: Weather Theory
    redirected_from: airboss-ref:handbooks/phak/FAA-H-8083-25/12
    note: Pilot-pitch introduction to surface heating, mixing, and haze layers.

assessable: true
assessment_methods: [recall, scenario]
mastery_criteria: >
  Learner can explain mixing height as the top of the convectively and
  mechanically mixed boundary layer, recognise it as the altitude below
  which surface-origin moisture, haze, and pollutants are stirred and
  trapped, predict that a haze top or smoke layer marks the mixing
  height visually, connect a rising mixing height through the morning
  to radiation-fog burnoff, and treat a low mixing height as a reason
  to expect poor slant visibility and a defined haze layer to climb
  through.
---

# Mixing Height

:::phase name="context"

A pilot climbs out on a calm summer morning. From the runway the
visibility looked decent -- the tower reported six miles. But at 500 ft
the pilot looks down the runway and can barely make out the far end
through a grey-brown murk, while looking up the sky is crisp blue. At
4,500 ft the airplane breaks out of the murk as if surfacing from
water: above is unlimited visibility, below is a flat-topped sea of
haze with the ground dim beneath it. The pilot just flew through the
top of the **mixed layer**. The altitude where the murk stopped was
not random. It was the mixing height, and it explains both the lousy
slant visibility on climb-out and the fog that was sitting on the field
an hour earlier.

:::
:::phase name="problem"

A pilot has to be able to predict two things that look unrelated but
share one cause: how bad the low-level haze and slant visibility will
be, and when -- or whether -- this morning's radiation fog will lift.
Both are governed by how deep the atmosphere is stirring near the
ground. Brief them separately and a pilot misses that they move
together. The single concept that ties them is the mixing height: the
top of the layer where surface-origin air gets churned. Understand the
mixing height and the haze layer, the slant-visibility problem, and the
fog-burnoff timing all become one forecast.

:::
:::phase name="discover"

Start from the bottom of the atmosphere on a clear day. The sun heats
the ground; the ground heats the air touching it; that warm surface
air becomes buoyant and rises in thermals. Wind blowing across terrain
and obstacles adds mechanical churning. Together this stirs a layer of
air near the surface -- the **mixed layer** or boundary layer -- where
everything gets thoroughly blended.

Now ask: how high does that stirring reach? It does not go up forever.
As established in `wx-stability-and-instability`, a rising parcel
climbs only until it meets air no colder than itself. The mixed layer
grows upward until the convection runs into a stable layer or an
inversion it cannot punch through. The altitude where the mixing stops
is the **mixing height** -- the top of the mixed layer.

Reason through what gets trapped below that ceiling. Anything injected
into the air from the surface -- water vapour evaporating from the
ground, haze, dust, smoke, pollutants -- is stirred *upward* by the
mixing, but it **cannot rise past the mixing height**. It accumulates
in the mixed layer and spreads evenly through it. So the mixed layer
becomes a defined slab of murky air with a sharp top.

That sharp top is visible. The flat-topped haze layer a pilot climbs
out of, the layer where smoke from a distant fire suddenly stops, the
brown lid over a city on a still day -- all of them mark the mixing
height. You can see the concept from the cockpit.

Now connect it to two operational facts:

- **Slant visibility.** Reported visibility is measured horizontally at
  the surface. But on climb-out a pilot looks *down through* the full
  depth of the haze slab. The deeper and dirtier the mixed layer, the
  worse the slant range -- which is why the runway can fade out at
  500 ft even with a "six miles" surface report.
- **Radiation-fog burnoff.** Overnight, with no sun and light wind, the
  mixed layer is shallow and the mixing height is low -- moisture pools
  near the surface and radiation fog forms. After sunrise the ground
  heats, convection restarts, and the mixing height **climbs**. As it
  rises it stirs the shallow saturated fog layer together with drier
  air from above, diluting it. The fog lifts into a thin stratus deck
  and then scatters. The fog "burns off" because the mixing height rose
  through it.

The mixing height is one feature with one mechanism, and it drives both
the haze problem and the fog-clearing problem.

:::
:::phase name="reveal"

The operational summary:

| Property          | What it means for the pilot                                                |
| ----------------- | -------------------------------------------------------------------------- |
| Definition        | Top of the convectively / mechanically mixed boundary layer                |
| What sets it      | Convection grows the mixed layer until it hits a stable layer or inversion |
| What it traps     | Surface-origin moisture, haze, dust, smoke, pollutants                     |
| Visible signature | Flat-topped haze layer; the altitude where smoke abruptly stops            |
| Daily behaviour   | Low at night, climbs through the morning with surface heating              |

Two diagnostic uses fall out:

- **Expect a haze layer to climb through.** When the mixing height is
  low and the air below it is moist or dirty, plan for poor slant
  visibility on departure and arrival and for a defined murk layer to
  transit. Above the mixing height the air is usually crisp -- the
  good news is the climb improves sharply once you break out.
- **Read fog-burnoff timing off the mixing-height trend.** A morning
  forecast of strong surface heating and a rising mixing height is a
  forecast of fog clearing. A forecast of weak heating -- thick
  overcast above, light winds, a low-sun-angle season -- means the
  mixing height stays low, the fog stays, and the burnoff a pilot is
  waiting for may never come.

The triage rule: when you brief radiation fog or low-level haze, do not
ask only "what is the visibility now." Ask "how deep is the air going
to mix today." A rising mixing height clears fog and thins haze; a
mixing height that stays pinned low keeps both.

:::
:::phase name="practice"

Next time you brief a hazy morning or a radiation-fog field, find the
mixing height -- the forecast discussion, a forecast sounding, or just
the depth between the surface and the lowest inversion will give it to
you. Predict the slant visibility on climb-out from how deep and dirty
that layer is, and predict the fog-clearing time from whether the
mixing height is forecast to rise. Then on climb-out, watch for the
flat top of the murk and note the altitude. You will have measured the
mixing height for yourself.

:::cards

- front: "What is the mixing height?"
  back: |
    The mixing height is the top of the convectively and mechanically
    mixed boundary layer -- the altitude up to which surface heating
    and wind churn the near-surface air. Convection grows the mixed
    layer upward until it meets a stable layer or inversion it cannot
    rise through; that ceiling is the mixing height.
  cardType: basic
  kind: recall
  tags: [weather, stability, boundary-layer, mixing-height]
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

- front: "Why is surface-origin haze, moisture, and smoke trapped below the mixing height?"
  back: |
    Mixing stirs everything injected from the surface upward, but a
    parcel can only rise as far as the mixing height -- past that it
    meets stable air it cannot penetrate. So moisture, haze, dust, and
    smoke accumulate within the mixed layer and spread evenly through
    it, producing a defined murky slab with a sharp top.
  cardType: basic
  kind: recall
  tags: [weather, stability, boundary-layer, mixing-height, haze]
  source_ref: |
    AC 00-6B; body Discover.
  acs_codes: [PA.I.C.K3a]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, Stability chapter
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 13 -- Atmospheric Stability

- front: "Why can slant visibility on climb-out be far worse than the reported surface visibility?"
  back: |
    Reported visibility is measured horizontally at the surface, but on
    climb-out a pilot looks down through the full depth of the haze
    slab trapped in the mixed layer. The deeper and dirtier that layer,
    the worse the slant range -- the runway can fade out at 500 ft even
    with a "six miles" surface report. Above the mixing height the air
    is usually crisp.
  cardType: basic
  kind: recall
  tags: [weather, visibility, mixing-height, haze]
  source_ref: |
    Body Discover + Reveal.
  acs_codes: [PA.I.C.K3a]
  source_authority:
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 13 -- Atmospheric Stability

- front: "How does a rising mixing height cause radiation fog to burn off?"
  back: |
    Overnight the mixed layer is shallow and the mixing height is low,
    so moisture pools near the surface and radiation fog forms. After
    sunrise the ground heats, convection restarts, and the mixing
    height climbs. As it rises it stirs the shallow saturated fog
    layer together with drier air from above, diluting it -- the fog
    lifts into thin stratus and then scatters. The fog "burns off"
    because the mixing height rose through it.
  cardType: basic
  kind: recall
  tags: [weather, stability, mixing-height, fog]
  source_ref: |
    Body Discover.
  acs_codes: [PA.I.C.K3a]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, Stability chapter
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 13 -- Atmospheric Stability

- front: "A radiation-fog field is forecast weak surface heating under a thick overcast -- will the fog burn off, and why?"
  back: |
    Probably not. Burnoff depends on the mixing height rising, which
    depends on surface heating driving convection. Thick overcast and
    light winds keep the heating weak, so the mixing height stays
    pinned low, the shallow saturated layer is never stirred out, and
    the fog persists. A rising mixing height clears fog; a mixing
    height held low keeps it.
  cardType: basic
  kind: recall
  tags: [weather, stability, mixing-height, fog, go-nogo, scenario]
  source_ref: |
    Body Context + Reveal.
  rationale: |
    Scenario card from the Reveal triage rule. Trains the body's
    pedagogical anchor: read fog-burnoff timing off the mixing-height
    trend, not off the clock.
  acs_codes: [PA.I.C.K3a]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, Stability chapter
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 13 -- Atmospheric Stability
:::

:::
:::phase name="connect"

Mixing height deepens `wx-stability-and-instability`: it is a direct
application of the parcel-rises-until-it-meets-no-colder-air principle,
applied to the depth of the surface-stirred layer. It connects to
`wx-fog-and-visibility-obstructions` on two fronts -- it is the
mechanism behind radiation-fog burnoff (a rising mixing height stirs
the fog out) and behind the haze layer and the slant-visibility
problem that node names. For the go/no-go decision, the mixing-height
trend is what converts a hazy or foggy morning forecast into a concrete
expectation: clearing if it rises, staying if it does not.

:::
:::phase name="verify"

For the next hazy or fog-prone morning on your route, predict the
mixing height and its trend through the day from the forecast, then
predict the slant visibility on departure and the fog-clearing time
from it. On climb-out, note the altitude where the murk tops out and
compare it against what you forecast. Crossing prediction against the
layer you actually fly through calibrates how to read the mixing height
from a future briefing.

:::
