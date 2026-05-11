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

## Context

Sunrise on a clear, calm October morning at a Sacramento Valley
airport. Last night's METAR reported 12C / 11C, wind calm. This
morning the airport is reporting BR (mist) at 1.5 SM visibility, and
the FBO's customer is taxiing back to wait it out. Yesterday morning
under nearly the same conditions, the same airport stayed clear. Why?

## Problem

Visibility obstructions -- fog, mist, frost, and the loose family of
particulate phenomena (haze / smoke / dust / volcanic ash) -- shape
takeoff legality, approach minima, and the entire morning departure
window for many GA airports. Each forms by a different mechanism,
behaves on a different time scale, and dissipates by a different
trigger.

## Discover

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

## Reveal

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

## Practice

For tomorrow's morning METAR + TAF, predict whether fog will form. The
diagnostic: temperature/dew point spread < 4C (or converging through
the night), wind < 6 KT, clear skies, low terrain. If three of four
hold, expect radiation fog at sunrise. The TAF will confirm or
contradict.

For frost: any time the overnight temperature was below freezing and
the airplane was outside, inspect surfaces by hand. If you can't see
or feel the underlying paint texture cleanly, polish or wait.

## Connect

This node parents K3j (fog/mist), K3k (frost), and K3l (visibility
obstructions) -- three sub-letters of K3 that all describe what
makes the airport unflyable from the visibility direction. The
clouds-and-precipitation node provides the moisture-and-cooling
framework; this node specializes it to the surface-layer cases.

## Verify

For three different mornings this month, predict before bed whether
the destination will be fogged in at sunrise. Cross-check the
morning METAR. Calibration: the prediction is reliable to within an
hour for radiation fog, less so for advection (depends on flow
shifts).
