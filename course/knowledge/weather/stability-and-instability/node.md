---
id: wx-stability-and-instability
title: Atmospheric Stability and Instability
domain: weather
cross_domains: [aerodynamics]

knowledge_types: [conceptual]
technical_depth: working
stability: stable

minimum_cert: private
study_priority: critical
requires: []
deepens: []
applied_by:
  - wx-thunderstorm-hazards
  - wx-clouds-and-precipitation
  - wx-turbulence-types
  - wx-go-nogo-decision
taught_by: []
related:
  - wx-airmasses-and-fronts

modalities: [reading, cards, visualization]
estimated_time_minutes: 35
review_time_minutes: 6

references:
  - source: AC 00-6B
    detail: Aviation Weather, Stability chapter
    note: Foundational treatment of dry vs moist adiabatic lapse and stability classes.
  - ref: airboss-ref:handbooks/avwx/13
    chapter_title: Atmospheric Stability
    redirected_from: airboss-ref:handbooks/avwx/FAA-H-8083-28/13
    note: >-
      Modern reference for absolute / conditional / neutral stability (§13.3 Stability Types).
  - ref: airboss-ref:handbooks/phak/12
    chapter_title: Weather Theory
    redirected_from: airboss-ref:handbooks/phak/FAA-H-8083-25/12
    note: >-
      Pilot-pitch introduction to stability and its operational consequences.

assessable: true
assessment_methods: [recall, scenario]
mastery_criteria: >
  Learner can define stable / unstable / conditionally unstable
  atmospheres in terms of lapse rate vs. dry and moist adiabatic
  reference rates, predict the cloud type / turbulence character /
  precipitation form for each stability class, and read a temperature
  trend on a METAR strip to infer stability without a sounding.
---

# Atmospheric Stability and Instability

:::phase name="context"

Two flights leave the same airport at the same hour. One pilot reports
a glass-smooth climb to cruise; the other, an hour later, gets pummeled
in cumulus to 8,000 ft. The difference isn't pilot technique or
airplane. The atmosphere stabilized at sunset and destabilized at
sunrise. Stability is the parameter that controls almost everything
else weather-related you'll experience aloft.

:::
:::phase name="problem"

Cloud type, precipitation pattern, turbulence character, visibility,
and the convective hazard inventory all depend on whether the air
column is stable or unstable. To brief weather competently you need to
read stability from the products available -- METARs, soundings,
graphics -- and to predict what the day is going to feel like at 5,000
ft from what the surface tells you at 1,500 ft.

:::
:::phase name="discover"

A parcel of air rising adiabatically (no heat exchanged with its
surroundings) cools at a fixed rate -- about 3 degrees C per 1,000 ft
when dry, about 1.5 degrees C per 1,000 ft when saturated. The
atmosphere's actual temperature profile (the environmental lapse rate,
ELR) determines whether a displaced parcel keeps rising or sinks back.

Three cases:

- ELR < moist adiabatic rate (~1.5C/1000 ft): a displaced parcel ends
  up cooler than its surroundings, sinks back. The atmosphere is
  absolutely stable. Air resists vertical motion.
- ELR > dry adiabatic rate (~3C/1000 ft): a displaced parcel ends up
  warmer than surroundings, keeps rising. Absolutely unstable. Air
  wants to convect.
- Moist adiabatic < ELR < dry adiabatic: the parcel's behavior depends
  on whether it's saturated. Conditionally unstable -- stable for dry
  air, unstable once moisture condenses and the slower moist rate
  takes over.

Most "interesting" weather happens in conditionally unstable air. A
small lifting trigger (heating, frontal lift, orographic forcing) can
push a parcel past saturation, after which it accelerates upward on
the difference between the moist adiabatic rate and the steeper ELR.
Cumulus, towering cumulus, cumulonimbus -- the convective cloud
sequence -- is the visible signature of conditional instability.

:::
:::phase name="reveal"

Operational table:

| Stability   | Cloud type     | Precip          | Turb           | Vis       |
| ----------- | -------------- | --------------- | -------------- | --------- |
| Stable      | Stratiform     | Continuous      | Smooth         | Reduced   |
| Unstable    | Cumuliform     | Showery         | Bumpy / strong | Excellent |
| Conditional | Mixed / sudden | Showery if lift | Building       | Variable  |

Surface signs of instability available in any METAR strip: large
diurnal temperature swings, gusty winds, scattered cumulus growing
through the day, dust devils, cumulus tops well above the haze
inversion. Surface signs of stability: stratus / fog at sunrise,
smooth winds, narrow temperature spread, thick haze layer.

Cooler weather comes after sunset because radiational cooling
re-stabilizes the surface; thunderstorms that built all afternoon often
fade after dark precisely because the stability profile shifts.

### Lapse rate

The word "lapse rate" appears three times in the Discover reasoning,
and it earns a name of its own because every stability call reduces to
comparing two of them.

A **lapse rate** is simply how fast temperature changes with height --
degrees of cooling per 1,000 ft of climb. There are three you have to
keep straight, and the whole stability question is which is larger:

- **Environmental lapse rate (ELR)** -- the *actual* temperature
  profile of the air over the airport right now, as a sounding or a
  Skew-T would draw it. It is a measured fact about today's
  atmosphere, and it varies hour to hour. There is no fixed value.
- **Dry adiabatic lapse rate** -- the *fixed* rate (~3 deg C / 1,000
  ft) at which an unsaturated parcel cools as it rises. It is a law of
  physics, not a measurement; it never changes.
- **Moist (saturated) adiabatic lapse rate** -- the *fixed* slower
  rate (~1.5 deg C / 1,000 ft) at which a saturated parcel cools,
  because condensation releases latent heat that offsets some of the
  cooling.

The reason a pilot cares: the ELR is the variable, the two adiabatic
rates are the fixed yardsticks. Lay the ELR against them and the
stability class falls out -- ELR shallower than the moist rate is
absolutely stable, ELR steeper than the dry rate is absolutely
unstable, ELR between the two is conditionally unstable. "Reading
stability" is, mechanically, reading the ELR's steepness. A steep ELR
(temperature dropping fast with height) is the fingerprint of an
unstable, convective day; a shallow ELR -- or an **inversion**, where
temperature *rises* with height -- is the fingerprint of stable air
that traps haze, moisture, and smooth flying underneath it.

:::
:::phase name="practice"

Pull a current sounding (Skew-T) for any airport from the Storm
Prediction Center site. Trace the environmental temperature curve and
the dew point curve. Find the LCL (where they converge) and the LFC
(where the parcel becomes positively buoyant against the environment).
The area between the parcel ascent and the environment curve from LFC
upward -- the CAPE -- is the energy available for convection. A CAPE
above ~1,000 J/kg is meaningful; above 2,500 J/kg is severe-storm
territory.

If reading a Skew-T isn't yet fluent, fall back to the surface signs:
on a hot afternoon with cumulus building rapidly through the morning
and reports of dust devils, the air column is unstable to whatever
height the cloud bases reach. That's enough to brief and enough to
predict the ride at altitude.

:::cards

- front: "Dry adiabatic rate vs moist adiabatic rate -- values and what makes them differ?"
  back: |
    Dry adiabatic rate: ~3 deg C per 1,000 ft. The rate at which a dry
    (unsaturated) parcel cools as it rises adiabatically.
    Moist adiabatic rate: ~1.5 deg C per 1,000 ft. The slower rate after
    saturation, because condensation releases latent heat that offsets
    some of the adiabatic cooling. The difference is what makes
    conditionally unstable air possible.
  cardType: basic
  kind: recall
  tags: [weather, stability, adiabatic-lapse, ac-00-6, phak-12]
  source_ref: |
    AC 00-6B Stability; PHAK Ch 12; body Discover.
  acs_codes: [PA.I.C.K3a]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, Stability chapter
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 13 -- Atmospheric Stability
    - kind: phak
      cite: FAA-H-8083-25 Pilot's Handbook of Aeronautical Knowledge, Chapter 12 -- Weather Theory

- front: "Absolutely stable atmosphere -- definition in terms of ELR vs adiabatic rates."
  back: |
    Environmental lapse rate (ELR) < moist adiabatic rate (~1.5 C/1000 ft).
    A displaced parcel ends up cooler than its surroundings even after
    condensation, so it sinks back. Air resists vertical motion. Clouds
    that form are stratiform; precipitation is continuous; turbulence is
    smooth.
  cardType: basic
  kind: recall
  tags: [weather, stability, absolutely-stable, ac-00-6]
  source_ref: |
    AC 00-6B; body Discover.
  acs_codes: [PA.I.C.K3a]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, Stability chapter
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 13 -- Atmospheric Stability
    - kind: phak
      cite: FAA-H-8083-25 Pilot's Handbook of Aeronautical Knowledge, Chapter 12 -- Weather Theory

- front: "Absolutely unstable atmosphere -- definition in terms of ELR vs adiabatic rates."
  back: |
    Environmental lapse rate (ELR) > dry adiabatic rate (~3 C/1000 ft).
    A displaced parcel ends up warmer than its surroundings even before
    condensation, so it keeps rising. Air wants to convect. Clouds are
    cumuliform; precipitation is showery; turbulence is bumpy / strong.
  cardType: basic
  kind: recall
  tags: [weather, stability, absolutely-unstable, ac-00-6]
  source_ref: |
    AC 00-6B; body Discover.
  acs_codes: [PA.I.C.K3a]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, Stability chapter
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 13 -- Atmospheric Stability
    - kind: phak
      cite: FAA-H-8083-25 Pilot's Handbook of Aeronautical Knowledge, Chapter 12 -- Weather Theory

- front: "Conditional instability -- definition and why is it the 'interesting weather' case?"
  back: |
    Moist adiabatic rate < ELR < dry adiabatic rate. The parcel's behaviour
    depends on whether it's saturated -- stable for dry air, unstable
    once moisture condenses and the slower moist rate takes over. Most
    'interesting' weather happens here: a small lifting trigger (heating,
    frontal lift, orographic forcing) pushes a parcel past saturation,
    after which it accelerates upward. Cumulus / TCu / CB is the visible
    signature.
  cardType: basic
  kind: recall
  tags: [weather, stability, conditional-instability, convection, ac-00-6]
  source_ref: |
    AC 00-6B; body Discover.
  acs_codes: [PA.I.C.K3a]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, Stability chapter
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 13 -- Atmospheric Stability
    - kind: phak
      cite: FAA-H-8083-25 Pilot's Handbook of Aeronautical Knowledge, Chapter 12 -- Weather Theory

- front: "Operational signature of stable air: cloud type, precipitation, turbulence, visibility?"
  back: |
    Clouds: stratiform (layered, no vertical development).
    Precipitation: continuous (steady drizzle / rain / snow rather than
    showers).
    Turbulence: smooth.
    Visibility: reduced (haze and trapped pollutants accumulate beneath
    the stable layer).
  cardType: basic
  kind: recall
  tags: [weather, stability, signatures, phak-12]
  source_ref: |
    PHAK Ch 12; body Reveal operational table.
  acs_codes: [PA.I.C.K3a]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, Stability chapter
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 13 -- Atmospheric Stability
    - kind: phak
      cite: FAA-H-8083-25 Pilot's Handbook of Aeronautical Knowledge, Chapter 12 -- Weather Theory

- front: "Operational signature of unstable air: cloud type, precipitation, turbulence, visibility?"
  back: |
    Clouds: cumuliform (vertical development).
    Precipitation: showery (convective bursts rather than continuous).
    Turbulence: bumpy / strong (convective updrafts + downdrafts).
    Visibility: excellent (vertical mixing scrubs the haze out).
  cardType: basic
  kind: recall
  tags: [weather, stability, signatures, phak-12]
  source_ref: |
    PHAK Ch 12; body Reveal operational table.
  acs_codes: [PA.I.C.K3a]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, Stability chapter
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 13 -- Atmospheric Stability
    - kind: phak
      cite: FAA-H-8083-25 Pilot's Handbook of Aeronautical Knowledge, Chapter 12 -- Weather Theory

- front: "Surface signs of instability you can read from a METAR strip alone (no sounding required)?"
  back: |
    Large diurnal temperature swings, gusty winds, scattered cumulus
    growing through the day, dust devils, cumulus tops well above the
    haze inversion. The METAR strip carries enough trend signal to call
    the stability state for the afternoon at altitudes the surface
    convection can reach.
  cardType: basic
  kind: recall
  tags: [weather, stability, metar, surface-signs]
  source_ref: |
    Body Reveal.
  acs_codes: [PA.I.C.K3a]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, Stability chapter
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 13 -- Atmospheric Stability
    - kind: phak
      cite: FAA-H-8083-25 Pilot's Handbook of Aeronautical Knowledge, Chapter 12 -- Weather Theory

- front: "Surface signs of stability you can read from a METAR strip alone?"
  back: |
    Stratus / fog at sunrise, smooth winds, narrow temperature spread,
    thick haze layer. The stable air column traps moisture and
    pollutants underneath the inversion; the absence of convective
    triggers leaves the column quiescent.
  cardType: basic
  kind: recall
  tags: [weather, stability, metar, surface-signs]
  source_ref: |
    Body Reveal.
  acs_codes: [PA.I.C.K3a]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, Stability chapter
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 13 -- Atmospheric Stability
    - kind: phak
      cite: FAA-H-8083-25 Pilot's Handbook of Aeronautical Knowledge, Chapter 12 -- Weather Theory

- front: "Why does an afternoon thunderstorm 'die' after sunset even when it built strongly all day?"
  back: |
    Radiational cooling re-stabilises the surface. The thermal updrafts
    that fed the storm during the heated afternoon stop, and the cell's
    energy source goes away. The stability profile shifts back toward
    stable through the night; the storm dissipates because its inflow
    cuts off, not because the existing energy went anywhere. By sunrise
    the column is stable again.
  cardType: basic
  kind: recall
  tags: [weather, stability, diurnal, thunderstorm]
  source_ref: |
    Body Reveal.
  acs_codes: [PA.I.C.K3a, PA.I.C.K3h]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, Stability chapter
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 13 -- Atmospheric Stability
    - kind: phak
      cite: FAA-H-8083-25 Pilot's Handbook of Aeronautical Knowledge, Chapter 12 -- Weather Theory

- front: "CAPE on a Skew-T: what does it represent, and what values are operationally meaningful?"
  back: |
    CAPE = Convective Available Potential Energy. The integrated area
    between the parcel ascent curve and the environment curve from the
    LFC (level of free convection) upward, in J/kg. It represents the
    energy available for convection if the parcel is lifted to its LFC.
    Above ~1,000 J/kg is meaningful; above 2,500 J/kg is severe-storm
    territory. The skill: identify LCL, LFC, and CAPE on the chart.
  cardType: basic
  kind: recall
  tags: [weather, stability, cape, skew-t, sounding]
  source_ref: |
    Body Practice.
  acs_codes: [PA.I.C.K3a]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, Stability chapter
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 13 -- Atmospheric Stability
    - kind: phak
      cite: FAA-H-8083-25 Pilot's Handbook of Aeronautical Knowledge, Chapter 12 -- Weather Theory

- front: "Two flights leave the same airport at the same hour, same airplane, same pilot technique. One gets a glass-smooth climb; the other (an hour later) gets pummeled in cumulus to 8,000 ft. What changed?"
  back: |
    Stability changed. The atmosphere stabilises overnight and destabilises
    in the morning as the surface heats. The first flight launched into
    a stable column with no convective triggers; the second launched
    into a destabilising column where the same heating that built the
    cumulus produced the bumpy ride. Reading stability is what predicts
    which flight you're about to take.
  cardType: basic
  kind: recall
  tags: [weather, stability, diurnal, scenario]
  source_ref: |
    Body Context scenario.
  rationale: |
    Scenario card from the Context. Trains the body's pedagogical anchor:
    'stability is the parameter that controls almost everything else
    weather-related you'll experience aloft.'
  acs_codes: [PA.I.C.K3a]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, Stability chapter
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 13 -- Atmospheric Stability
    - kind: phak
      cite: FAA-H-8083-25 Pilot's Handbook of Aeronautical Knowledge, Chapter 12 -- Weather Theory
:::

:::
:::phase name="connect"

Stability is the parent concept under almost every other K3 leaf:
clouds (K3f), precipitation (K3d), turbulence (K3g), thunderstorms
(K3h), and visibility / fog (K3j) all change behavior between stable
and unstable atmospheres. The frontal-passage node depends on
stability change across the front. Recognizing stability is the meta
skill that makes the rest of the weather phenomena interpretable.

:::
:::phase name="verify"

For three different days this week, predict cloud type and turbulence
character from the morning METAR before takeoff. Cross-check against
the actual cruise-altitude experience. Calibrate. The skill develops
fast once predicted vs actual is your own data.

:::