---
id: wx-density-altitude
title: Density Altitude
domain: weather
cross_domains: [aerodynamics, flight-planning]

knowledge_types: [conceptual, procedural]
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
  - perf-takeoff-landing-distance
  - perf-weight-and-balance
  - plan-vfr-cross-country
taught_by: []
related: []

modalities: [reading, cards, calculation]
estimated_time_minutes: 40
review_time_minutes: 8

references:
  - ref: airboss-ref:handbooks/phak/11
    chapter_title: Aircraft Performance
    redirected_from: airboss-ref:handbooks/phak/FAA-H-8083-25C/11
    note: Density altitude derivation, rules of thumb, chart lookups.
  - source: AC 61-84B
    detail: Role of Preflight Preparation
    note: Density-altitude awareness as part of the preflight go/no-go.
  - source: AIM
    detail: 7-5-6 -- Potential Flight Hazards (High Density Altitude)
    note: Operational guidance for hot / high / humid conditions.

assessable: true
assessment_methods: [calculation, recall]
mastery_criteria: >
  Learner can compute density altitude from pressure altitude and temperature
  without a chart, cite the standard rule-of-thumb (120 ft per degree C above
  ISA), and predict the effect on takeoff distance, climb rate, and true
  airspeed.
---

# Density Altitude

## Context

It's a 96 deg F afternoon at Big Bear Airport (KL35), elevation
6,752 ft, runway 4,500 ft. You've got three passengers, full fuel,
and a bag of camping gear. The altimeter reads 30.10 in the runup
area. Your Cessna 182's POH gives a sea-level standard-day takeoff
roll of 800 ft. The actual takeoff distance today is in a different
universe from the POH number, and the chart lookup that gets you to
that number is the difference between an uneventful climb-out and
an off-airport landing in the trees beyond the departure end.

The airplane doesn't care what the altimeter reads or what the
runway elevation says. It cares how many air molecules per cubic
foot are flowing over the wing, down the prop, and through the
engine intake. Density altitude collapses pressure altitude,
temperature, and (to a smaller degree) humidity into one number
that says, "today, your airplane thinks the runway is at this
elevation."

## Problem

Three failure modes dominate density-altitude accidents:

- **Performance ignorance.** Pilot uses POH sea-level numbers
  unmodified at 7,000 ft on a hot day. Takeoff roll and climb
  margin reality bears no resemblance to plan.
- **Performance denial.** Pilot computes the numbers, sees them
  trend bad, and proceeds anyway because "this airplane has done it
  before." (It hasn't, this exact way.)
- **Performance optimism.** Pilot computes the numbers correctly
  but uses them as floors instead of starting points. POH numbers
  assume new engines, smooth runways, no wind, and pilot
  technique at the demo level. Real numbers run 25-50 % longer in
  practice.

The pilot job is to make density altitude a decision input, not a
post-hoc explanation. Compute it before the flight, recompute it
on a hot or hot-and-high day before takeoff, and refuse the
takeoff if the airplane's expected performance doesn't clear the
obstacle margin you've decided to keep.

## Discover

Air at altitude has fewer molecules per cubic foot than air at
sea level. Hot air has fewer molecules per cubic foot than cold
air at the same altitude. Humid air has slightly fewer molecules
per cubic foot than dry air (water vapor displaces denser
nitrogen and oxygen). All three effects subtract from air density,
and air density is what every aerodynamic and combustion process
on the airplane depends on.

Three things stop working as advertised when density drops:

- **The wing.** Lift is proportional to air density. At lower
  density, the airplane needs higher TAS for the same lift, so
  takeoff and stall both happen at higher TAS (indicated airspeed
  reads near sea-level numbers, which is why airspeed indicators
  are calibrated to do this).
- **The propeller.** Thrust depends on the prop's bite of air.
  Less air per blade pass means less thrust per RPM.
- **The engine.** Naturally aspirated piston engines lose
  approximately 3 % of available horsepower per 1,000 ft of
  density altitude. A 200-hp engine at sea level is making 140 hp
  at 10,000 ft DA on a standard day -- and less still on a hot
  day at the same altitude.

Pressure altitude is what your altimeter reads when set to 29.92.
At 29.92 in the runup, pressure altitude equals field elevation.
At 30.10, you're below standard pressure -- pressure altitude is a
bit lower than field elevation. (Higher pressure means denser air,
which is good; lower pressure means thinner air, which is bad.)
The convention is set the altimeter to 29.92 to read pressure
altitude directly.

A standard atmosphere assumes 15 deg C at sea level (59 deg F)
and a temperature lapse of about 2 deg C per 1,000 ft. Any
temperature warmer than ISA at your altitude pushes density
altitude higher. The classic rule of thumb: density altitude
increases roughly **120 ft per deg C above ISA** at low altitudes.
At 6,000 ft on a 30 deg C day, ISA is roughly 3 deg C, so you're
27 deg C above ISA, which is 27 * 120 = 3,240 ft of density
altitude *above* the pressure altitude. Your airplane thinks the
runway is at 9,200 ft.

## Reveal

The relationship, computed:

- **Pressure altitude** = indicated altitude when altimeter is
  29.92, OR field elevation + (29.92 - altimeter setting) x 1,000.
  At altimeter 30.10 and field elevation 6,752: PA = 6,752 +
  (29.92 - 30.10) x 1,000 = 6,572 ft.
- **ISA temperature at PA** = 15 - 2 x (PA / 1,000) =
  15 - 2 x 6.572 = 15 - 13.1 = 1.9 deg C.
- **Temperature deviation** = OAT - ISA. At 96 deg F (35.5 deg C):
  35.5 - 1.9 = 33.6 deg C above ISA.
- **DA** = PA + 120 ft x deviation = 6,572 + 120 x 33.6 = 6,572 +
  4,032 = 10,604 ft.

The Cessna 182 in the Context scenario is operating at a density
altitude over 10,000 ft, on a 4,500 ft runway, at gross weight,
on a hot afternoon. The POH performance chart will tell you
exactly what that means; the answer is "this is a no-go without
significant change to the loading or the time of day."

The 120 ft / deg C rule is approximate; the exact figure varies
slightly with altitude. Below about 10,000 ft pressure altitude
the rule is within a few percent of the truth. Above 10,000 ft
the deviation grows; use the POH chart or a flight computer for
high-altitude / high-temperature combinations.

A practical heuristic: every 1,000 ft of density altitude above
sea level adds approximately **10%** to takeoff and landing
distance (so 5,000 ft DA is +50% roll), reduces climb rate
proportionally, and lowers service ceiling. The airplane's
performance charts give the exact numbers; the heuristic is for
the back-of-envelope go / no-go.

Humidity adds another 5-10% of density-altitude penalty in
extremely humid conditions; most POH performance charts ignore it
because the effect is small relative to temperature, but a high-
humidity day at high DA is worth an extra margin in the runway-
length calculation.

## Practice

For three runways you'll fly into in the next year (start with
your home airport, then the highest one you fly to, then the
shortest one), compute density altitude for the worst-case summer
afternoon: field elevation, summer max temp at the airport,
altimeter 29.80 (a typical low-pressure summer afternoon). Then
look up the POH takeoff and landing distance for the result.

If the result exceeds 60% of the runway length, you have a
density-altitude problem on hot afternoons at that airport. The
fix is one of: lighter loading, earlier or later in the day,
different runway, or different airplane.

A drill: practice computing density altitude in your head from
the runup. PA = field elevation + (29.92 - altimeter) x 1,000.
ISA at PA = 15 - 2 x PA/1000. Deviation = OAT - ISA. DA = PA +
120 x deviation. The math is fast with practice; doing it on
every takeoff makes it muscle memory.

## Connect

Density altitude lives at the intersection of weather and
aerodynamics. Atmospheric stability (s2) and surface temperatures
drive the inputs; the airplane's performance charts (perf-takeoff-
landing-distance, perf-weight-and-balance) consume the outputs.
Climb rate and service ceiling derive from the same density
relationship. High-altitude airports add density-altitude planning
to the standard pre-flight; pilots who fly only sea-level airports
are most likely to be caught off-guard by a density-altitude
problem on a vacation trip.

The classic accident pattern: pilot familiar with sea-level
airplane behavior departs a high airport on a hot afternoon at
gross, fails to clear obstacles in the climb-out. The brief
density-altitude calculation that would have prevented the
accident takes 60 seconds at the runup. The 60 seconds is the
work; the habit is to actually do it.

## Verify

For a flight you've actually flown into a high or hot airport,
reconstruct the density altitude at takeoff. Compare your actual
takeoff roll and climb performance to what the POH predicted at
that DA. Where did the airplane match the chart? Where did it
fall short? The calibration of "POH plus N%" for your typical
technique and your specific airplane is what you carry into the
next flight.
