---
id: wx-clouds-and-precipitation
title: Clouds, Temperature/Moisture, and Precipitation
domain: weather
cross_domains: [flight-planning]

knowledge_types: [conceptual, factual]
technical_depth: working
stability: stable

minimum_cert: private
study_priority: critical
requires:
  - wx-stability-and-instability
deepens: []
applied_by:
  - wx-thunderstorm-hazards
  - wx-icing-types-and-avoidance
  - wx-go-nogo-decision
taught_by: []
related:
  - wx-airmasses-and-fronts
  - wx-fog-and-visibility-obstructions

modalities: [reading, cards, visualization]
estimated_time_minutes: 35
review_time_minutes: 6

references:
  - source: AC 00-6B
    detail: Aviation Weather, chapters on moisture, clouds, and precipitation
    note: Foundational treatment of dew point spread, cloud classification, precipitation formation.
  - source: FAA-H-8083-28
    detail: Aviation Weather Handbook, Chapter 12 -- Vertical Motion and Clouds; Chapter 14 -- Precipitation
    note: Modern consolidated reference.
  - source: FAA-H-8083-25
    detail: Pilot's Handbook of Aeronautical Knowledge, Chapter 12 -- Weather Theory
    note: Pilot-pitch introduction to cloud classification and precipitation forms.

assessable: true
assessment_methods: [recall, scenario]
mastery_criteria: >
  Learner can name the four cloud families and the ten primary genera,
  estimate cloud bases from temperature / dew point spread, distinguish
  precipitation types (rain / drizzle / freezing rain / snow / hail) by
  formation mechanism, and read a METAR's sky condition + precipitation
  group as one unified picture.
---

# Clouds, Temperature/Moisture, and Precipitation

:::phase name="context"

You taxi out at 0700Z on a humid morning. The METAR reports temperature
20C, dew point 18C, sky clear. By the time you reach the runway,
a thin scattered layer has formed at 600 ft. By the time you climb
through 2,000 ft you're in solid stratus. What changed? Nothing in the
synoptic picture: the sun heated the surface 1 degree, a parcel rose,
hit the LCL, and turned into cloud. The temperature/moisture state of
the column always determined where the cloud base would be.

:::
:::phase name="problem"

Clouds are visible water -- the optical signature of the atmospheric
moisture state crossing condensation. Reading them correctly requires
understanding what produces them. Precipitation is the next step --
visible water heavy enough to fall. Both are direct consequences of
the temperature / dew point relationship and the lifting mechanism in
play.

:::
:::phase name="discover"

Start with a basic equation: a parcel of air rising adiabatically cools
at ~3C / 1,000 ft (dry rate) until it reaches saturation -- when its
temperature equals its dew point. Above that altitude (the lifting
condensation level, LCL), excess moisture condenses into cloud and
the parcel cools at the slower moist rate (~1.5-2.5C / 1,000 ft
depending on temperature).

For a quick estimate of cloud base from a surface report:

LCL_AGL ≈ (T - Td) / 4.4 in thousands of feet (T and Td in C)

Or memorably: each 4-5 degrees C of temperature/dew-point spread is
~1,000 ft to cloud base. A 20/15 spread says 1,000 ft AGL bases. A
20/10 spread says ~2,500 ft AGL bases. A 20/-2 spread says clear
skies and dry air to high altitude.

Now classify what you see. Clouds organize into four families by
altitude and morphology:

- High clouds (above 20,000 ft): cirrus, cirrostratus, cirrocumulus.
  Ice crystals; non-threatening on their own.
- Middle clouds (6,500-20,000 ft): altostratus, altocumulus.
  Mixed-phase; mild icing risk in altostratus, mostly visual indicator.
- Low clouds (below 6,500 ft): stratus, stratocumulus, nimbostratus.
  Liquid water below the freezing level; major IFR / icing source.
- Vertical-development clouds (any altitude): cumulus, towering
  cumulus, cumulonimbus. Convective; turbulence + icing + lightning +
  hail in the worst cases.

The morphology is diagnostic. Stratus says stable air; cumulus says
unstable; towering cumulus says strongly unstable; cumulonimbus says
the unstable column has reached the tropopause.

:::
:::phase name="reveal"

Precipitation type follows from cloud type and the temperature
profile under it:

- Drizzle (DZ): tiny droplets from low stratus / stratocumulus.
- Rain (RA): liquid drops, anywhere convective or stratiform.
- Freezing rain (FZRA): rain falling through a sub-freezing surface
  layer, refreezing on impact. The most dangerous icing scenario in
  GA -- a warm layer aloft, cold below, the SLD problem ATR-72
  Roselawn made permanent.
- Snow (SN): ice crystals all the way down, surface temp at or
  below freezing.
- Ice pellets (PL / IP): rain that froze before reaching the surface;
  evidence of a sub-freezing surface layer with warm aloft.
- Hail (GR / GS): convective process; hailstones cycle through the
  updraft accreting layers.

Precipitation intensity in METARs: light (-), moderate (no prefix),
heavy (+). A `+TSRA` is a heavy thunderstorm with rain -- the
operational signal for "stay clear, expect violent IMC."

Visibility responds to precipitation in regular ways. Light rain
typically drops vis to 4-6 SM; moderate rain to 2-3 SM; heavy rain
to under 1 SM. Snow drops vis faster: light snow can already be
1-2 SM, moderate snow under 1 SM, heavy snow near zero.

:::
:::phase name="practice"

For your next flight, predict cloud base from the surface
temperature/dew point spread, then check actual against METAR or
visual observation after takeoff. Build the calibration that the
formula is reliable to about 500 ft for unstable air and 1,000 ft
for stable air.

For precipitation: check forecast type (TAF), forecast intensity, and
freezing level. Any time the freezing level is within 4,000 ft of
your cruise altitude in precipitation, icing is the active question
to brief.

:::cards

- front: "Cloud base from temperature/dew point spread -- what's the rule of thumb?"
  back: |
    LCL_AGL (in thousands of feet) ≈ (T - Td) / 4.4, with T and Td in
    deg C. Memorably: each 4-5 deg C of spread is ~1,000 ft to cloud base.
    A 20/15 spread says 1,000 ft AGL bases; a 20/10 spread says ~2,500 ft;
    a 20/-2 spread says clear skies / dry column. Reliable to about 500 ft
    in unstable air, 1,000 ft in stable air.
  cardType: basic
  kind: calculation
  tags: [weather, clouds, lcl, dew-point-spread, ac-00-6]
  source_ref: |
    AC 00-6B moisture chapter; body Discover.
  acs_codes: [PA.I.C.K3c]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, chapters on moisture, clouds, and precipitation
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 12 -- Vertical Motion and Clouds; Chapter 14 -- Precipitation
    - kind: phak
      cite: FAA-H-8083-25 Pilot's Handbook of Aeronautical Knowledge, Chapter 12 -- Weather Theory

- front: "Estimate cloud base AGL. Surface temperature 20 deg C, dew point 18 deg C."
  back: |
    Spread = 20 - 18 = 2 deg C.
    LCL_AGL ≈ 2 / 4.4 = 0.45 thousand ft ≈ 450 ft AGL.
    Expect bases to form by ~500 ft on slight surface heating. The body's
    Context scenario: small spread + sun heating = stratus by climb-out.
  cardType: basic
  kind: calculation
  tags: [weather, clouds, lcl, calculation]
  source_ref: |
    Body Context scenario + Discover formula.
  acs_codes: [PA.I.C.K3c]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, chapters on moisture, clouds, and precipitation
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 12 -- Vertical Motion and Clouds; Chapter 14 -- Precipitation
    - kind: phak
      cite: FAA-H-8083-25 Pilot's Handbook of Aeronautical Knowledge, Chapter 12 -- Weather Theory

- front: "Adiabatic lapse rates: dry vs moist, and where does the transition happen?"
  back: |
    Dry adiabatic rate: ~3 deg C per 1,000 ft as a parcel rises before
    saturation. Moist adiabatic rate: ~1.5-2.5 deg C per 1,000 ft after
    saturation, depending on temperature (warmer air -> slower cooling
    because more latent heat is released). Transition happens at the
    LCL -- the altitude where parcel temperature equals dew point.
  cardType: basic
  kind: recall
  tags: [weather, clouds, lapse-rate, adiabatic, ac-00-6]
  source_ref: |
    AC 00-6B moisture/clouds; body Discover.
  acs_codes: [PA.I.C.K3c]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, chapters on moisture, clouds, and precipitation
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 12 -- Vertical Motion and Clouds; Chapter 14 -- Precipitation
    - kind: phak
      cite: FAA-H-8083-25 Pilot's Handbook of Aeronautical Knowledge, Chapter 12 -- Weather Theory

- front: "Four cloud families by altitude, with examples and pilot relevance."
  back: |
    High (above 20,000 ft): cirrus, cirrostratus, cirrocumulus -- ice
    crystals, non-threatening on their own.
    Middle (6,500-20,000 ft): altostratus, altocumulus -- mixed-phase,
    mild icing risk in altostratus, mostly visual indicator.
    Low (below 6,500 ft): stratus, stratocumulus, nimbostratus -- liquid
    water below freezing level, major IFR / icing source.
    Vertical development (any altitude): cumulus, towering cumulus,
    cumulonimbus -- convective; turbulence + icing + lightning + hail.
  cardType: basic
  kind: recall
  tags: [weather, clouds, classification, phak-12, ac-00-6]
  source_ref: |
    AC 00-6B; PHAK Ch 12; body Discover.
  acs_codes: [PA.I.C.K3f]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, chapters on moisture, clouds, and precipitation
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 12 -- Vertical Motion and Clouds; Chapter 14 -- Precipitation
    - kind: phak
      cite: FAA-H-8083-25 Pilot's Handbook of Aeronautical Knowledge, Chapter 12 -- Weather Theory

- front: "Cloud morphology as a diagnostic for atmospheric stability -- what does each form signal?"
  back: |
    Stratus = stable air (smooth, layered, no vertical development).
    Cumulus = unstable air (puffy, vertical buildup, fair-weather convection).
    Towering cumulus = strongly unstable column.
    Cumulonimbus = the unstable column has reached the tropopause; the
    full thunderstorm.
    Reading sky form gives you the parent stability state without needing
    a sounding.
  cardType: basic
  kind: recall
  tags: [weather, clouds, stability, diagnostic, ac-00-6]
  source_ref: |
    AC 00-6B; body Discover ("morphology is diagnostic").
  acs_codes: [PA.I.C.K3a, PA.I.C.K3f]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, chapters on moisture, clouds, and precipitation
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 12 -- Vertical Motion and Clouds; Chapter 14 -- Precipitation
    - kind: phak
      cite: FAA-H-8083-25 Pilot's Handbook of Aeronautical Knowledge, Chapter 12 -- Weather Theory

- front: "Why is freezing rain (FZRA) the most dangerous icing scenario in GA?"
  back: |
    FZRA is rain falling through a sub-freezing surface layer and refreezing
    on impact. A warm layer aloft (rain forms) sits over a cold layer below
    (refreezing). It produces supercooled large droplets (SLD) that hit the
    airframe in flight and freeze instantly across surfaces certification
    icing protection doesn't cover. The ATR-72 Roselawn accident made this
    the canonical "warm-aloft / cold-below" trap.
  cardType: basic
  kind: recall
  tags: [weather, precipitation, freezing-rain, icing, sld, ac-00-6]
  source_ref: |
    AC 00-6B precipitation chapter; body Reveal.
  acs_codes: [PA.I.C.K3d, PA.I.C.K3i]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, chapters on moisture, clouds, and precipitation
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 12 -- Vertical Motion and Clouds; Chapter 14 -- Precipitation
    - kind: phak
      cite: FAA-H-8083-25 Pilot's Handbook of Aeronautical Knowledge, Chapter 12 -- Weather Theory

- front: "Decode precipitation types from a METAR: DZ, RA, FZRA, SN, PL, GR."
  back: |
    DZ = drizzle (tiny droplets from low stratus / stratocumulus).
    RA = rain (liquid drops; stratiform or convective).
    FZRA = freezing rain (rain through sub-freezing surface layer; SLD risk).
    SN = snow (ice crystals all the way down; surface at or below freezing).
    PL (or IP) = ice pellets (rain that froze before reaching surface;
       evidence of sub-freezing surface with warm aloft).
    GR = hail (convective; hailstones cycle through updraft accreting layers).
  cardType: basic
  kind: recall
  tags: [weather, precipitation, metar, ac-00-45h]
  source_ref: |
    AC 00-6B; AC 00-45H weather phenomena; body Reveal.
  acs_codes: [PA.I.C.K3d]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, chapters on moisture, clouds, and precipitation
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 12 -- Vertical Motion and Clouds; Chapter 14 -- Precipitation
    - kind: phak
      cite: FAA-H-8083-25 Pilot's Handbook of Aeronautical Knowledge, Chapter 12 -- Weather Theory

- front: "Precipitation intensity prefixes in a METAR weather group?"
  back: |
    `-` = light, no prefix = moderate, `+` = heavy. So `-RA` is light rain,
    `RA` is moderate, `+RA` is heavy. A `+TSRA` is a heavy thunderstorm
    with rain -- operational signal for "stay clear, expect violent IMC."
  cardType: basic
  kind: recall
  tags: [weather, precipitation, metar, intensity, ac-00-45h]
  source_ref: |
    AC 00-45H METAR weather group; body Reveal.
  acs_codes: [PA.I.C.K3d]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, chapters on moisture, clouds, and precipitation
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 12 -- Vertical Motion and Clouds; Chapter 14 -- Precipitation
    - kind: phak
      cite: FAA-H-8083-25 Pilot's Handbook of Aeronautical Knowledge, Chapter 12 -- Weather Theory

- front: "Why does snow drop visibility faster than rain at the same nominal intensity?"
  back: |
    Light rain typically drops vis to 4-6 SM; light snow can already be
    1-2 SM. Moderate rain to 2-3 SM; moderate snow under 1 SM. Heavy rain
    under 1 SM; heavy snow near zero. Snow crystals scatter light more
    efficiently per unit precipitation rate than liquid droplets. A snow
    METAR demands a sharper visibility check than a same-intensity rain
    METAR.
  cardType: basic
  kind: recall
  tags: [weather, precipitation, visibility, snow, ac-00-6]
  source_ref: |
    AC 00-6B; body Reveal visibility table.
  acs_codes: [PA.I.C.K3d, PA.I.C.K3l]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, chapters on moisture, clouds, and precipitation
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 12 -- Vertical Motion and Clouds; Chapter 14 -- Precipitation
    - kind: phak
      cite: FAA-H-8083-25 Pilot's Handbook of Aeronautical Knowledge, Chapter 12 -- Weather Theory

- front: "A METAR shows scattered cumulus at 4,000 ft and -SHRA. What does the cloud + precipitation pair tell you about the parent stability state?"
  back: |
    Cumulus = unstable. Showery rain (SHRA) requires a convective lifting
    mechanism, which requires unstable air. The pair confirms an unstable
    layer somewhere in the column below the LCL of the cumulus. Compare to
    `BKN015 RA` (stratus + steady rain = stable stratiform lift). Reading
    the cloud + precipitation pair backward to the stability state is the
    chain-test the body recommends.
  cardType: basic
  kind: recall
  tags: [weather, clouds, precipitation, stability, metar]
  source_ref: |
    Body Verify ("METAR -> clouds -> stability is the inverse...").
  rationale: |
    Scenario card that trains the reverse-direction read: from observation
    back to atmospheric state. Tests the same understanding from the
    opposite direction.
  acs_codes: [PA.I.C.K3a, PA.I.C.K3d, PA.I.C.K3f]
  source_authority:
    - kind: ac
      cite: AC 00-6B Aviation Weather, chapters on moisture, clouds, and precipitation
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 12 -- Vertical Motion and Clouds; Chapter 14 -- Precipitation
    - kind: phak
      cite: FAA-H-8083-25 Pilot's Handbook of Aeronautical Knowledge, Chapter 12 -- Weather Theory
:::

:::
:::phase name="connect"

This node is the parent of K3i (icing -- which is "freezing
precipitation in cloud") and K3h (thunderstorms -- "convective
clouds with vertical development to the tropopause"). The stability
node feeds it; the airmasses-and-fronts node provides the lifting
mechanisms that drive cloud formation.

:::
:::phase name="verify"

Pick a METAR with sky condition and precipitation. Without seeing the
sky, describe the cloud type that produced the reported precipitation
form. Then describe the parent stability state. The chain METAR ->
clouds -> stability is the inverse of the brief-then-fly direction
and tests the same understanding.

:::