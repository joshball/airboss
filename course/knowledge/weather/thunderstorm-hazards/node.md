---
id: wx-thunderstorm-hazards
title: Thunderstorm Hazards
domain: weather
cross_domains: [safety-accident-analysis]

knowledge_types: [conceptual, judgment]
technical_depth: working
stability: stable

# === Cert + study priority ===
# minimum_cert: lowest cert that requires this topic. Higher certs inherit.
minimum_cert: private
# study_priority: critical (safety/checkride hot) | standard (default) | stretch (adjacent).
study_priority: critical
requires: []
deepens: []
applied_by:
  - wx-go-nogo-decision
  - plan-vfr-cross-country
  - plan-ifr-cross-country
taught_by: []
related:
  - wx-icing-types-and-avoidance

modalities: [reading, cards]
estimated_time_minutes: 45
review_time_minutes: 8

references:
  - source: AC 00-24C
    detail: Thunderstorms
    note: FAA advisory circular on thunderstorm avoidance and operational guidance.
  - source: AIM
    detail: 7-1-27 -- Thunderstorms
    note: Operational procedures for avoiding convective activity.
  - ref: airboss-ref:handbooks/phak/12
    chapter_title: Weather Theory
    redirected_from: airboss-ref:handbooks/phak/FAA-H-8083-25C/12
    note: Life cycle of a thunderstorm, embedded vs. airmass vs. squall line.

assessable: true
assessment_methods: [recall, scenario]
mastery_criteria: >
  Learner can describe the three stages of a thunderstorm cell, name the six
  hazards (turbulence, hail, icing, lightning, downbursts, tornadoes), state
  the 20 nm avoidance rule, and justify why penetrating a line is never safe.
---

# Thunderstorm Hazards

## Context

It's late afternoon in summer along the Gulf Coast. The TAF for your
destination shows VCTS (vicinity thunderstorm) through your ETA. The
GFA shows isolated TS with bases at 4,000 and tops to FL400. The
Convective SIGMET flags an area of severe thunderstorms 60 NM south
of your direct route. You're VFR, three hours out from departure,
considering whether to go.

The decision isn't "is there a thunderstorm in the way?" Almost
every summer afternoon in the southeast has one within an hour of
the route. The decision is: can I maintain 20 NM separation from
every active and developing cell along the route, allowing for cell
movement, growth, and embedded turbulence? If the answer is yes
with margin, you fly with continuous monitoring. If the answer is
"yes, barely," you don't.

## Problem

A thunderstorm is the single weather phenomenon for which the FAA
publishes a numeric clearance distance, because every
hand-eye-judgment rule of thumb has eventually killed pilots. The
20 NM number is operational shorthand for a multi-hazard
exclusion zone -- updrafts, downdrafts, hail throw, gust front,
lightning, embedded turbulence, microburst footprint -- each of
which has independently produced fatal accidents at distances
from a cell that the cell itself didn't visibly extend to.

The pilot job is to internalize *why* 20 NM, *what* the cell does
during your transit, and *how* the avoidance decision degrades from
"plenty of room" to "trapped" faster than most pilots expect.

## Discover

A thunderstorm cell isn't a static feature; it's a 30-90 minute
weather system with its own life cycle. Three stages, each with a
different signature:

- **Cumulus stage** (10-30 min): unstable air rises through a
  conditionally unstable layer. The cloud builds vertically. All
  air motion within the cloud is upward. From the outside it looks
  like a vigorous towering cumulus with a flat or slightly bulging
  top. Visible warning sign: rapid vertical growth in still surface
  air.

- **Mature stage** (15-30 min): the cloud has reached the tropopause
  and begun to spread horizontally into an anvil. Updrafts and
  downdrafts coexist. Precipitation falls; lightning starts; hail,
  if any, forms in the upper portion and may be thrown miles
  laterally. This is the dangerous stage and where most aviation
  hazards live.

- **Dissipating stage** (30-60 min): downdrafts dominate. The cloud
  loses its sharp edges and rains itself out. Lightning continues
  for some time after the visible cell appears spent. A "dying"
  cell can still produce a microburst on its way down.

Cells rarely operate alone. Three formations:

- **Air-mass thunderstorms** -- isolated cells in unstable summer
  air, predictable by time-of-day, generally avoidable with VFR
  visual deviation.
- **Squall line** -- linear arrangement, often along a cold front
  or pre-frontal trough. May extend hundreds of miles. Often
  embedded with multiple cells in different life-cycle stages
  simultaneously.
- **Mesoscale convective complex** -- a cluster of cells that
  organizes overnight, persists for hours, and produces sustained
  hazards over a regional footprint.

The six classical hazards, in order of how they expand the
exclusion zone:

1. **Turbulence** -- updraft / downdraft differential of 6,000
   feet per minute at altitudes where airframes are not designed
   for sustained vertical loading. Light aircraft can be torn
   apart structurally; transports load up to limits.
2. **Hail** -- thrown miles laterally and well above the visible
   cell. Hail damage to leading edges, windscreen, prop, and
   antennas can occur in clear air outside an obvious cell.
3. **Lightning** -- avionics damage, blinding flash, fuel ignition
   risk in unsealed tanks. Strikes can occur in clear air several
   miles from the visible cell.
4. **Icing** -- supercooled liquid water at altitudes well above
   the freezing level inside a cell. Encountered briefly, fast,
   and severely.
5. **Downbursts / microbursts** -- concentrated downdrafts at the
   surface that produce 60+ KT wind shear over a few hundred feet
   of altitude. The cause of multiple GA fatal accidents on
   approach and landing.
6. **Tornadoes** -- the most violent vertical motion the
   atmosphere produces, occasionally embedded in supercell
   thunderstorms.

The 20 NM rule combines all six. Hail throw alone has been
documented at 5-20 NM from a cell. Lightning at 5-10 NM. Microburst
gust front at 10-15 NM. Embedded turbulence at 5-10 NM. The 20 NM
margin is the envelope that contains all of them with operational
buffer.

## Reveal

The standard pilot rules, distilled:

- **20 NM lateral separation** from any cell with a visible top
  above the freezing level. (AC 00-24C is the canonical reference.)
- **No flight under** an overhanging anvil -- hail can fall from
  the anvil into clear air below.
- **No penetration of a squall line.** Lines are not solid; the
  gap is a trap. Cells fill it as you fly.
- **Land and wait** if the chosen route closes. A 30-minute hold
  on the ramp is operationally cheap; a wing failure is not.
- **Onboard radar** detects precipitation, not turbulence. A green
  echo can hide a yellow cell at altitude (composite reflectivity
  averages the column). Radar tilts and gains have to be actively
  managed.
- **Datalink NEXRAD** can be 5-15 minutes old. A cell that wasn't
  there at briefing might be there now. Use NEXRAD strategically,
  not tactically.

A line is never safe to penetrate, even if it looks gappy on
radar. Embedded cells can move into the gap during your transit.
The cells generate their own outflow and inflow that bend nearby
cells toward the line, closing the gap. And lightning crosses the
gap whether or not radar shows precipitation.

## Practice

For the next severe-weather day in your area, watch a developing
cell on radar from cumulus through dissipating stage. Time the
stages. Track lateral hail throw if you can find a hail report.
Note when the gust front becomes visible on the surface station
network (sudden wind shift, pressure jump).

For a planned summer cross-country with isolated convection
forecast: pre-plan a divert airport every 30 NM along the route.
A pilot who didn't pre-plan diverts loses time finding one in
flight; a pilot who did pre-plan turns toward one immediately when
a cell builds.

### Cards (spaced repetition)

Cards mined from the body. Three-cell-stages and six-hazards are
the recall floor; the 20 NM rule and "never penetrate a line" are
the operational rules; scenario cards train the decision habit.

```yaml-cards
- front: "What are the three stages of a thunderstorm cell, and what dominates each one?"
  back: |
    Cumulus (10-30 min): all upward motion, vertical buildup, conditionally
    unstable layer. No precipitation yet.
    Mature (15-30 min): updrafts and downdrafts coexist; precipitation falls;
    lightning starts; hail forms in the upper portion. Anvil spreads. This is
    the dangerous stage.
    Dissipating (30-60 min): downdrafts dominate; cloud loses sharp edges and
    rains itself out. A "dying" cell can still produce a microburst on the
    way down; lightning continues after the cell appears spent.
  cardType: basic
  kind: recall
  tags: [weather, thunderstorm, cell-stages, phak-12, ac-00-24c]
  source_ref: |
    AC 00-24C Thunderstorms; PHAK Ch 12 Weather Theory; body Discover.
  acs_codes: [PA.I.C.K3h]
  source_authority:
    - kind: ac
      cite: AC 00-24C Thunderstorms
    - kind: aim
      cite: AIM 7-1-27 -- Thunderstorms

- front: "Cumulus stage of a thunderstorm: dominant air motion and visible signature?"
  back: |
    All air motion within the cloud is upward. The cloud builds vertically.
    Outside it looks like a vigorous towering cumulus with a flat or slightly
    bulging top. Visible warning sign: rapid vertical growth in still surface
    air. No precipitation has reached the ground.
  cardType: basic
  kind: recall
  tags: [weather, thunderstorm, cell-stages, phak-12, ac-00-24c]
  source_ref: |
    PHAK Ch 12; body Discover.
  acs_codes: [PA.I.C.K3h]
  source_authority:
    - kind: ac
      cite: AC 00-24C Thunderstorms
    - kind: aim
      cite: AIM 7-1-27 -- Thunderstorms

- front: "Mature stage of a thunderstorm: what makes this the most dangerous stage?"
  back: |
    Updrafts and downdrafts coexist in the same cloud (the differential is
    where airframe-loading turbulence lives). Precipitation falls; lightning
    starts; hail (if any) forms in the upper portion and may be thrown miles
    laterally. The cloud has reached the tropopause and spread into an anvil.
    Most of the six aviation hazards are present simultaneously here.
  cardType: basic
  kind: recall
  tags: [weather, thunderstorm, cell-stages, hazards, phak-12, ac-00-24c]
  source_ref: |
    PHAK Ch 12; body Discover (mature stage).
  acs_codes: [PA.I.C.K3h]
  source_authority:
    - kind: ac
      cite: AC 00-24C Thunderstorms
    - kind: aim
      cite: AIM 7-1-27 -- Thunderstorms

- front: "Why is a 'dissipating' thunderstorm cell still dangerous?"
  back: |
    Downdrafts dominate the dissipating stage. A dying cell can still produce
    a microburst on its way down -- 60+ KT wind shear over a few hundred feet
    of altitude. Lightning continues for some time after the cell visually
    appears spent. "Dissipating" is not "safe"; the surface-level hazard
    profile shifts toward microburst risk on approach.
  cardType: basic
  kind: recall
  tags: [weather, thunderstorm, cell-stages, microburst, phak-12, ac-00-24c]
  source_ref: |
    PHAK Ch 12; body Discover (dissipating stage).
  acs_codes: [PA.I.C.K3h]
  source_authority:
    - kind: ac
      cite: AC 00-24C Thunderstorms
    - kind: aim
      cite: AIM 7-1-27 -- Thunderstorms

- front: "Name the six classical thunderstorm hazards."
  back: |
    1. Turbulence (updraft/downdraft differential, 6,000 fpm at altitudes
       airframes are not designed for sustained vertical loading).
    2. Hail (thrown miles laterally and well above the visible cell).
    3. Lightning (avionics damage, blinding flash, fuel ignition risk;
       strikes possible in clear air several miles from the visible cell).
    4. Icing (supercooled liquid water above the freezing level inside a cell).
    5. Downbursts / microbursts (60+ KT wind shear over a few hundred feet,
       cause of multiple GA fatal accidents on approach and landing).
    6. Tornadoes (most violent vertical motion the atmosphere produces;
       embedded in supercell thunderstorms).
  cardType: basic
  kind: recall
  tags: [weather, thunderstorm, hazards, ac-00-24c, aim-7-1-27]
  source_ref: |
    AC 00-24C Thunderstorms; AIM 7-1-27.
  acs_codes: [PA.I.C.K3h]
  source_authority:
    - kind: ac
      cite: AC 00-24C Thunderstorms
    - kind: aim
      cite: AIM 7-1-27 -- Thunderstorms

- front: "What is the standard pilot rule for lateral separation from a thunderstorm cell, and what does the number cover?"
  back: |
    20 nautical miles lateral separation from any cell with a visible top
    above the freezing level (AC 00-24C). The 20 NM number is the envelope
    that contains all six hazards with operational buffer: hail throw 5-20
    NM, lightning 5-10 NM, microburst gust front 10-15 NM, embedded
    turbulence 5-10 NM. It is operational shorthand for a multi-hazard
    exclusion zone -- not a "pretty close" guideline.
  cardType: regulation
  kind: recall
  question_tier: both
  source_authority:
    - kind: ac
      cite: AC 00-24C
    - kind: aim
      cite: AIM 7-1-27
  acs_codes: [PA.I.C.K3h]
  tags: [weather, thunderstorm, avoidance, 20nm]
  source_ref: |
    AC 00-24C Thunderstorms; body Reveal + Discover hazard-distance breakdown.
  rationale: |
    The body emphasises this is the *only* weather phenomenon for which the
    FAA publishes a numeric clearance. This card encodes both the rule and
    its decomposition into per-hazard distances. Tier=both: the FAA written
    tests the 20 NM rule directly; CFIs care about the per-hazard breakdown
    that justifies the number.

- front: "Why is penetrating a squall line never safe, even if it looks gappy on radar?"
  back: |
    Three reasons stack: (1) embedded cells can move into the gap during your
    transit; (2) cells generate their own outflow / inflow that bend nearby
    cells toward the line, closing the gap; (3) lightning crosses the gap
    whether or not radar shows precipitation. The rule is "land and wait" if
    the chosen route closes -- a 30-minute hold on the ramp is operationally
    cheap; a wing failure is not.
  cardType: basic
  kind: recall
  tags: [weather, thunderstorm, squall-line, avoidance, ac-00-24c, aim-7-1-27]
  source_ref: |
    AC 00-24C; body Reveal "A line is never safe to penetrate" paragraph.
  acs_codes: [PA.I.C.K3h]
  source_authority:
    - kind: ac
      cite: AC 00-24C Thunderstorms
    - kind: aim
      cite: AIM 7-1-27 -- Thunderstorms

- front: "Three thunderstorm formations and how they differ in pilot consequence: {{c1::air-mass}} thunderstorms (isolated cells, predictable by time-of-day, generally avoidable VFR), {{c2::squall line}} (linear, often pre-frontal, may extend hundreds of miles, often embedded), {{c3::mesoscale convective complex}} (cluster organising overnight, persisting hours over a regional footprint)."
  back: |
    Air-mass cells let you visually deviate. Squall lines force a stop or a
    full re-route -- you cannot penetrate. Mesoscale convective complexes
    deny a regional area for hours; the planning answer is delay or
    cancellation, not deviation.
  cardType: cloze
  kind: recall
  tags: [weather, thunderstorm, formations, squall-line, mcc, phak-12, ac-00-24c]
  source_ref: |
    PHAK Ch 12; AC 00-24C; body Discover (three formations).
  acs_codes: [PA.I.C.K3h]
  source_authority:
    - kind: ac
      cite: AC 00-24C Thunderstorms
    - kind: aim
      cite: AIM 7-1-27 -- Thunderstorms

- front: "Why does onboard weather radar show 'green' echoes that can hide a yellow cell at altitude, and what does that mean for tactical use?"
  back: |
    Composite reflectivity averages the column -- a strong return aloft
    (yellow / red) blended with weak return at low altitudes can show as
    green on the display. Radar tilts and gains have to be actively managed
    to interrogate altitude bands. Onboard radar detects precipitation, not
    turbulence; the dangerous shear and updraft can sit in a "green" cell.
  cardType: basic
  kind: recall
  tags: [weather, thunderstorm, radar, equipment-limits, ac-00-24c, aim-7-1-27]
  source_ref: |
    AC 00-24C; AIM 7-1-27; body Reveal "Onboard radar" bullet.
  acs_codes: [PA.I.C.K3h]
  source_authority:
    - kind: ac
      cite: AC 00-24C Thunderstorms
    - kind: aim
      cite: AIM 7-1-27 -- Thunderstorms

- front: "Why is datalink NEXRAD a strategic tool, not a tactical one?"
  back: |
    Datalink NEXRAD imagery can be 5-15 minutes old by the time it reaches
    the cockpit. A cell that wasn't there at briefing might be there now;
    a cell shown on the screen might already have moved or grown beyond
    the depicted footprint. Use NEXRAD for the synoptic picture and the
    next-hour route planning, not for "thread the gap right now" decisions.
  cardType: basic
  kind: recall
  tags: [weather, thunderstorm, nexrad, datalink, equipment-limits, aim-7-1-27]
  source_ref: |
    AIM 7-1-27; body Reveal "Datalink NEXRAD" bullet.
  acs_codes: [PA.I.C.K3h]
  source_authority:
    - kind: ac
      cite: AC 00-24C Thunderstorms
    - kind: aim
      cite: AIM 7-1-27 -- Thunderstorms

- front: "TAF for your destination shows VCTS through your ETA. GFA shows isolated TS bases 4,000 ft tops FL400. Convective SIGMET flags severe TS 60 NM south of route. You're VFR, three hours out. What's the decision frame?"
  back: |
    The decision is not "is there a thunderstorm in the way?" -- almost every
    summer afternoon in the southeast has one within an hour of the route.
    The decision is: can I maintain 20 NM separation from every active and
    developing cell along the route, allowing for cell movement, growth, and
    embedded turbulence?
    - Yes with margin -> fly with continuous monitoring (datalink + onboard +
      eyes out).
    - "Yes, barely" -> don't go. Margin you cannot articulate is margin you
      do not have.
    Pre-plan a divert airport every 30 NM along the route. Body Practice rule.
  cardType: basic
  kind: recall
  tags: [weather, thunderstorm, go-nogo, divert, ac-00-24c, aim-7-1-27]
  source_ref: |
    AC 00-24C; body Context scenario + Practice divert-planning rule.
  rationale: |
    Scenario card built from the body's Context. Trains the reframing the body
    teaches: the question is the *separation* you can maintain, not the
    presence of a cell.
  acs_codes: [PA.I.C.K3h]
  source_authority:
    - kind: ac
      cite: AC 00-24C Thunderstorms
    - kind: aim
      cite: AIM 7-1-27 -- Thunderstorms

- front: "Why is no flight permitted under an overhanging anvil, even far from the visible cell core?"
  back: |
    Hail forms in the upper portion of a mature cell and can be thrown miles
    laterally; it then falls from the anvil into clear air below. A pilot
    flying under the anvil is in the hail-fall zone with no visible cell
    above the cockpit to warn them. The rule is operational: no flight under
    an overhanging anvil, period.
  cardType: regulation
  kind: recall
  question_tier: cfi-essential
  source_authority:
    - kind: ac
      cite: AC 00-24C
    - kind: aim
      cite: AIM 7-1-27
  acs_codes: [PA.I.C.K3h]
  tags: [weather, thunderstorm, hail, anvil, avoidance]
  source_ref: |
    AC 00-24C; body Reveal "No flight under an overhanging anvil" rule.
  rationale: |
    Tier=cfi-essential: the FAA written rarely tests the anvil-specific rule
    explicitly (it folds into "thunderstorm avoidance"); CFIs reinforce it
    because the visual cue ("no cell directly overhead, must be safe")
    misleads pilots into the hail-fall zone.
```

## Connect

This node feeds the go/no-go decision (a Convective SIGMET on the
route is the primary "stop" trigger) and the convective-outlook
node (the strategic time-horizon picture). Icing and turbulence
hazards inside cells are direct cross-references; AIRMETs / SIGMETs
flag the surrounding hazard footprint.

The encoded-text family connection: the Convective SIGMET text
("line of embedded thunderstorms 100 NM wide, tops to FL420") is
unreadable without the cell taxonomy in this node. A pilot decoding
"squall line + embedded + tops FL420" without this physics gets a
list of words; a pilot with this physics gets an immediate stop
signal.

## Verify

For a current Convective SIGMET, decode the cell formation it
describes (line / scattered / area / isolated), and articulate
which of the six hazards above are most likely along the polygon
boundary, at the polygon center, and below the indicated tops. If
you can name the dominant hazard at each location, you can
articulate the exclusion zone the SIGMET is asking you to honor.
