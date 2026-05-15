---
id: wx-fog-and-visibility-obstructions
title: Fog, Frost, and Visibility Obstructions
domain: weather
cross_domains: [flight-planning, performance]

knowledge_types: [conceptual, factual, judgment]
technical_depth: working
stability: stable

minimum_cert: private
study_priority: critical
requires:
  - wx-clouds-and-precipitation
deepens: []
applied_by:
  - wx-go-nogo-decision
  - plan-vfr-cross-country
taught_by: []
related:
  - wx-airmasses-and-fronts

modalities: [reading, cards]
estimated_time_minutes: 30
review_time_minutes: 5

references:
  - source: AC 00-6B
    detail: Aviation Weather, Fog and Restrictions to Visibility chapter
    note: Foundational treatment of fog formation types and visibility-reducing phenomena.
  - source: FAA-H-8083-28
    detail: Aviation Weather Handbook, Chapter 18 -- Weather and Obstructions to Visibility
    note: Modern consolidated reference for fog types (§18.1.1) and other visibility obstructions (mist, haze, smoke, precipitation, blowing snow, dust storm, sandstorm, volcanic ash).
  - source: AIM
    detail: 7-5-1 -- Frost; 7-5-7 -- Volcanic Ash
    note: Operational guidance on frost removal and volcanic ash avoidance.

assessable: true
assessment_methods: [recall, scenario]
mastery_criteria: >
  Learner can name the principal fog types (radiation / advection /
  upslope / steam / precipitation-induced / ice fog), predict which
  type will form for a given temperature / dew point / wind / terrain
  combination, articulate why frost on a wing is a flight-control
  hazard and not a cosmetic one, and recognize visibility-reduction
  phenomena (haze / smoke / dust / blowing snow / volcanic ash) on
  a METAR.
---

# Fog, Frost, and Visibility Obstructions

:::phase name="context"

Sunrise on a clear, calm October morning at a Sacramento Valley
airport. Last night's METAR reported 12C / 11C, wind calm. This
morning the airport is reporting BR (mist) at 1.5 SM visibility, and
the FBO's customer is taxiing back to wait it out. Yesterday morning
under nearly the same conditions, the same airport stayed clear. Why?

:::
:::phase name="problem"

Visibility obstructions -- fog, mist, frost, and the loose family of
particulate phenomena (haze / smoke / dust / volcanic ash) -- shape
takeoff legality, approach minima, and the entire morning departure
window for many GA airports. Each forms by a different mechanism,
behaves on a different time scale, and dissipates by a different
trigger.

:::
:::phase name="discover"

Fog is cloud at the surface. The same condensation mechanism: an air
parcel cooled to (or moistened up to) saturation. The category split
is by mechanism:

- Radiation fog: clear nights radiate heat to space; surface cools
  rapidly; the lowest air layer cools to the dew point. Forms in
  calm, clear, humid conditions in low-lying terrain. Dissipates
  with morning sun (1-2 hours after sunrise typically).
- Advection fog: warm moist air flows over a colder surface (water
  -> land in summer; land -> snow in spring). The advected air
  cools in contact with the cold surface to its dew point.
  Persistent; doesn't burn off until the surface warms or the
  windflow shifts. The classic San Francisco Bay area summer fog.
- Upslope fog: moist air forced up sloping terrain cools
  adiabatically to its dew point. Persists as long as the upslope
  flow continues. Common east of the Rockies.
- Steam fog: cold air moves over warm water; rapid evaporation
  saturates the cold layer immediately. Looks like steam rising off
  the water surface (sometimes called "sea smoke"). Patchy.
- Precipitation-induced fog: warm rain falls into a cold surface
  layer, evaporates, saturates the cold layer. Forms in warm-front
  or stationary-front rain.
- Ice fog: at very cold temperatures (below -40C / -40F), water
  vapor sublimates directly to ice crystals. Polar / arctic
  phenomenon. Doesn't form in temperate climates.

The common diagnostic question: what saturates the lowest air layer
-- cooling (radiation, advection, upslope) or moistening
(precipitation-induced, steam)? Knowing that selects the dissipation
trigger.

:::
:::phase name="reveal"

Frost is condensation below freezing, depositing as ice crystals on
exposed surfaces. The aerodynamic problem is not the weight (frost is
near-massless) but the surface roughness. A 1/4-inch frost layer can
disrupt the airflow over a wing badly enough to increase stall speed
by 5-10 KT and decrease lift in the climbout regime by 30%. The 1996
King Air crash at Dryden, the 2003 Ottawa Citation X, the long
catalogue of "frost-induced" tail strikes -- the literature is
unambiguous.

AIM 7-5-1: never attempt takeoff with frost adhering to wings, props,
or control surfaces. Polish or remove. The "thin layer" exception is
gone from current guidance.

Visibility-reducing phenomena beyond fog (METAR codes):

| Code | Phenomenon      | Source                                   |
| ---- | --------------- | ---------------------------------------- |
| BR   | Mist            | Vis 5/8 to 6 SM, water droplets          |
| FG   | Fog             | Vis < 5/8 SM, water droplets             |
| HZ   | Haze            | Suspended dry particles, often pollution |
| FU   | Smoke           | Combustion source upwind                 |
| DU   | Widespread dust | Lifted dry particulates                  |
| SA   | Sand            | Airborne sand                            |
| BLSN | Blowing snow    | Wind > ~15 KT lifting fresh snow         |
| VA   | Volcanic ash    | Eruption plume                           |

Volcanic ash is special: glass particles in the airflow, abrasive on
turbine blades, capable of total engine flameout (KLM 867, BA 9). FAA
guidance is strict avoidance even for piston aircraft -- ash damages
windscreens, pitots, and oil systems too.

:::
:::phase name="practice"

For tomorrow's morning METAR + TAF, predict whether fog will form. The
diagnostic: temperature/dew point spread < 4C (or converging through
the night), wind < 6 KT, clear skies, low terrain. If three of four
hold, expect radiation fog at sunrise. The TAF will confirm or
contradict.

For frost: any time the overnight temperature was below freezing and
the airplane was outside, inspect surfaces by hand. If you can't see
or feel the underlying paint texture cleanly, polish or wait.

:::cards

- front: "Radiation fog: formation conditions and typical dissipation trigger."
  back: |
    Clear nights radiate heat to space; surface cools rapidly; the lowest
    air layer cools to its dew point. Forms in calm, clear, humid conditions
    in low-lying terrain. Dissipates with morning sun -- typically 1-2 hours
    after sunrise. Recipe: low spread (<4 C) at sunset + calm + clear + low
    terrain.
  cardType: basic
  kind: recall
  tags: [weather, fog, radiation-fog, phak-12, ac-00-6]
  source_ref: |
    AC 00-6B Fog chapter; FAA-H-8083-28 Ch 18; body Discover.
  acs_codes: [PA.I.C.K3j]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, Fog and Restrictions to Visibility chapter
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 18 -- Weather and Obstructions to Visibility
    - kind: aim
      cite: AIM 7-5-1 -- Frost; 7-5-7 -- Volcanic Ash

- front: "Advection fog: formation conditions and why does it persist?"
  back: |
    Warm moist air flows over a colder surface (water -> land in summer;
    land -> snow in spring). The advected air cools in contact with the cold
    surface to its dew point. Persists because the source mechanism is the
    *flow*, not the cooling of one night -- doesn't burn off until the
    surface warms or the windflow shifts. The classic San Francisco Bay
    summer fog.
  cardType: basic
  kind: recall
  tags: [weather, fog, advection-fog, phak-12, ac-00-6]
  source_ref: |
    AC 00-6B; FAA-H-8083-28 Ch 18; body Discover.
  acs_codes: [PA.I.C.K3j]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, Fog and Restrictions to Visibility chapter
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 18 -- Weather and Obstructions to Visibility
    - kind: aim
      cite: AIM 7-5-1 -- Frost; 7-5-7 -- Volcanic Ash

- front: "Upslope fog: where does it form and what keeps it in place?"
  back: |
    Moist air forced up sloping terrain cools adiabatically to its dew
    point. Persists as long as the upslope flow continues. Common east of
    the Rockies when easterly low-level flow meets the rising plains. The
    fog clears when the flow direction changes or the air mass dries out.
  cardType: basic
  kind: recall
  tags: [weather, fog, upslope-fog, ac-00-6]
  source_ref: |
    AC 00-6B; body Discover.
  acs_codes: [PA.I.C.K3j]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, Fog and Restrictions to Visibility chapter
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 18 -- Weather and Obstructions to Visibility
    - kind: aim
      cite: AIM 7-5-1 -- Frost; 7-5-7 -- Volcanic Ash

- front: "Steam fog ('sea smoke'): formation mechanism?"
  back: |
    Cold air moves over warm water; rapid evaporation saturates the cold
    layer immediately. Looks like steam rising off the water surface --
    sometimes called sea smoke. Patchy and low. The cold side of the
    advection problem: rather than warm-moist over cold surface, it's
    cold-dry over warm surface, with evaporation doing the saturating.
  cardType: basic
  kind: recall
  tags: [weather, fog, steam-fog, sea-smoke, ac-00-6]
  source_ref: |
    AC 00-6B; body Discover.
  acs_codes: [PA.I.C.K3j]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, Fog and Restrictions to Visibility chapter
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 18 -- Weather and Obstructions to Visibility
    - kind: aim
      cite: AIM 7-5-1 -- Frost; 7-5-7 -- Volcanic Ash

- front: "Precipitation-induced fog: when does it form and which front type produces it most often?"
  back: |
    Warm rain falls into a cold surface layer, evaporates, saturates the
    cold layer. Common in warm-front or stationary-front rain -- the warm
    air aloft is producing the rain, the cold air at the surface is being
    saturated by the evaporation. The fog often appears in the same airspace
    as low IFR ceilings, compounding the approach problem.
  cardType: basic
  kind: recall
  tags: [weather, fog, precipitation-fog, warm-front, ac-00-6]
  source_ref: |
    AC 00-6B; body Discover.
  acs_codes: [PA.I.C.K3j]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, Fog and Restrictions to Visibility chapter
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 18 -- Weather and Obstructions to Visibility
    - kind: aim
      cite: AIM 7-5-1 -- Frost; 7-5-7 -- Volcanic Ash

- front: "Ice fog: temperature threshold and where does it occur?"
  back: |
    At very cold temperatures (below approximately -40 C / -40 F), water
    vapor sublimates directly to ice crystals without passing through the
    liquid phase. Polar / arctic phenomenon. Doesn't form in temperate
    climates. The pilot signature is a visible white opacity at the
    surface during extreme cold; visibility can drop to near zero.
  cardType: basic
  kind: recall
  tags: [weather, fog, ice-fog, arctic, ac-00-6]
  source_ref: |
    AC 00-6B; body Discover.
  acs_codes: [PA.I.C.K3j]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, Fog and Restrictions to Visibility chapter
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 18 -- Weather and Obstructions to Visibility
    - kind: aim
      cite: AIM 7-5-1 -- Frost; 7-5-7 -- Volcanic Ash

- front: "Diagnostic question: what saturates the lowest air layer in a given fog -- cooling or moistening?"
  back: |
    Cooling-saturated: radiation, advection, upslope. The lowest layer is
    cooled to the dew point.
    Moistening-saturated: precipitation-induced, steam. The lowest layer
    is saturated by added water vapor (rain evaporating in / water
    evaporating into it) without cooling much.
    Knowing which selects the dissipation trigger: cooling-saturated fogs
    burn off with warming or flow change; moistening-saturated fogs persist
    until the moisture source stops.
  cardType: basic
  kind: recall
  tags: [weather, fog, diagnostic, ac-00-6]
  source_ref: |
    Body Discover ("common diagnostic question").
  acs_codes: [PA.I.C.K3j]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, Fog and Restrictions to Visibility chapter
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 18 -- Weather and Obstructions to Visibility
    - kind: aim
      cite: AIM 7-5-1 -- Frost; 7-5-7 -- Volcanic Ash

- front: "Why is frost on a wing a flight-control hazard, not just a cosmetic one?"
  back: |
    A 1/4-inch frost layer can disrupt airflow over a wing enough to
    *increase stall speed by 5-10 KT* and *decrease climb-out lift by 30%*.
    The hazard isn't the weight (frost is near-massless) -- it's surface
    roughness disrupting the boundary layer. The Dryden King Air (1989),
    the Ottawa Citation X (2003), and a long list of frost-induced tail
    strikes make the literature unambiguous.
  cardType: basic
  kind: recall
  tags: [weather, frost, aerodynamics, aim-7-5-1]
  source_ref: |
    AIM 7-5-1 Frost; body Reveal.
  acs_codes: [PA.I.C.K3k]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, Fog and Restrictions to Visibility chapter
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 18 -- Weather and Obstructions to Visibility
    - kind: aim
      cite: AIM 7-5-1 -- Frost; 7-5-7 -- Volcanic Ash

- front: "What is the current AIM 7-5-1 rule on takeoff with frost?"
  back: |
    Never attempt takeoff with frost adhering to wings, props, or control
    surfaces. Polish smooth or remove. The earlier "thin layer of polished
    frost" exception is gone from current guidance. The rule is binary
    now: surfaces are smooth, or the airplane stays.
  cardType: regulation
  kind: recall
  tags: [weather, frost, regulation, takeoff, aim-7-5-1]
  source_ref: |
    AIM 7-5-1 Frost; body Reveal.
  acs_codes: [PA.I.C.K3k]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, Fog and Restrictions to Visibility chapter
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 18 -- Weather and Obstructions to Visibility
    - kind: aim
      cite: AIM 7-5-1 -- Frost; 7-5-7 -- Volcanic Ash

- front: "Decode METAR visibility-obstruction codes: BR, FG, HZ, FU, DU, SA, BLSN, VA."
  back: |
    BR = mist (vis 5/8-6 SM, water droplets).
    FG = fog (vis < 5/8 SM, water droplets).
    HZ = haze (suspended dry particles, often pollution).
    FU = smoke (combustion source upwind).
    DU = widespread dust (lifted dry particulates).
    SA = sand (airborne sand).
    BLSN = blowing snow (wind > ~15 KT lifting fresh snow).
    VA = volcanic ash (eruption plume).
  cardType: basic
  kind: recall
  tags: [weather, metar, visibility-obstructions, ac-00-45h]
  source_ref: |
    AC 00-45H METAR weather group; body Reveal table.
  acs_codes: [PA.I.C.K3l]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, Fog and Restrictions to Visibility chapter
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 18 -- Weather and Obstructions to Visibility
    - kind: aim
      cite: AIM 7-5-1 -- Frost; 7-5-7 -- Volcanic Ash

- front: "Why is volcanic ash (VA) avoided by piston aircraft as well as turbine aircraft?"
  back: |
    Ash is glass particles suspended in the airflow. For turbines, it abrades
    blades and can cause total flameout (KLM 867, BA 9). For piston aircraft,
    it abrades windscreens, clogs pitot and static ports, and damages oil
    and induction systems. FAA guidance is strict avoidance for all aircraft
    types, not just turbine.
  cardType: basic
  kind: recall
  tags: [weather, volcanic-ash, va, aim-7-5-7]
  source_ref: |
    AIM 7-5-7 Volcanic Ash; body Reveal.
  acs_codes: [PA.I.C.K3l]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, Fog and Restrictions to Visibility chapter
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 18 -- Weather and Obstructions to Visibility
    - kind: aim
      cite: AIM 7-5-1 -- Frost; 7-5-7 -- Volcanic Ash

- front: "Tomorrow's METAR + TAF for a Sacramento Valley airport: 12 C / 11 C at sunset, wind calm, clear skies, low terrain. Will fog form?"
  back: |
    Yes -- radiation fog is the predicted outcome. The diagnostic
    four-of-four: small spread (1 C), wind calm, clear skies, low terrain.
    Expect BR / FG at sunrise; expect 1-2 hours after sunrise for the
    surface heating to dissipate it. The body's Context is exactly this
    setup; the same airport stayed clear the day before because one of the
    four conditions was different (probably wind or higher spread).
  cardType: basic
  kind: recall
  tags: [weather, fog, radiation-fog, prediction]
  source_ref: |
    Body Context + Practice diagnostic ("three of four hold").
  rationale: |
    Scenario card from the body's Context. The four-condition recipe is
    the body's operational deliverable; this card forces the learner to
    walk it.
  acs_codes: [PA.I.C.K3j]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, Fog and Restrictions to Visibility chapter
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 18 -- Weather and Obstructions to Visibility
    - kind: aim
      cite: AIM 7-5-1 -- Frost; 7-5-7 -- Volcanic Ash
:::

:::
:::phase name="connect"

This node parents K3j (fog/mist), K3k (frost), and K3l (visibility
obstructions) -- three sub-letters of K3 that all describe what
makes the airport unflyable from the visibility direction. The
clouds-and-precipitation node provides the moisture-and-cooling
framework; this node specializes it to the surface-layer cases.

:::
:::phase name="verify"

For three different mornings this month, predict before bed whether
the destination will be fogged in at sunrise. Cross-check the
morning METAR. Calibration: the prediction is reliable to within an
hour for radiation fog, less so for advection (depends on flow
shifts).

:::