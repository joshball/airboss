---
id: wx-icing-types-and-avoidance
title: Icing Types and Avoidance
domain: weather
cross_domains: [aerodynamics, safety-accident-analysis]

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
  - plan-ifr-cross-country
taught_by: []
related:
  - wx-thunderstorm-hazards

modalities: [reading, cards]
estimated_time_minutes: 45
review_time_minutes: 8

references:
  - source: AC 91-74B
    detail: Pilot Guide, Flight in Icing Conditions
    note: FAA guide to recognition, avoidance, and escape from icing.
  - source: AIM
    detail: 7-1-21 -- Icing
    note: Operational procedures, AIRMET ZULU, pilot-report guidance.
  - ref: airboss-ref:handbooks/phak/12
    chapter_title: Weather Theory
    redirected_from: airboss-ref:handbooks/phak/FAA-H-8083-25C/12
    note: Clear, rime, and mixed icing formation mechanisms.

assessable: true
assessment_methods: [recall, scenario]
mastery_criteria: >
  Learner can distinguish clear, rime, and mixed icing by formation and
  shape, state the temperature band where structural icing is most likely,
  and describe escape actions (altitude change, heading change, precipitation
  avoidance) in order of preference.
---

# Icing Types and Avoidance

## Context

You're at 7,000 feet IFR, in cloud, OAT showing -3 C. The
windscreen is dry. Five minutes later there's a translucent film
on the leading edge of the wing where you can see it. Ten minutes
after that the airplane is settling 200 fpm at cruise power and
you don't remember telling it to. Indicated airspeed is bleeding
off slowly. The horizon is gone above and below.

The decision window for icing isn't generous. Once the airframe is
loaded with ice, you're a different airplane: stall speed up,
control authority down, drag up, available thrust down. Every
parameter that mattered for staying in controlled flight has moved
in the wrong direction simultaneously, and pilot skill doesn't get
any of them back. The avoidance habit is built before the flight,
not in cloud at -3 C with the autopilot trimming down.

## Problem

Icing kills airplanes by changing the wing into something it isn't.
A wing is an aerodynamic shape designed to produce lift at a
specific angle of attack and a specific airspeed. Ice changes both:
the shape no longer matches the design, the airframe weight has
gone up, and the AoA at which the airplane stalls is now lower
than the indicator suggests.

Three operational facts make icing a probability problem rather
than a piloting problem:

- It accumulates while the pilot watches. The most dangerous
  icing flights start "let's just take a look."
- It accumulates faster than most pilots predict. Clear ice in
  freezing rain or a warm-cumulus environment can re-shape the
  wing in single-digit minutes.
- It only releases on the ground or above-freezing air. There is
  no in-flight self-shedding mechanism for non-deiced airframes.

The pilot job is to stay out of icing-prone air, recognize the
setup before commit, and have an *out* (a layer above, a layer
below, a heading that returns to clear) before entering the
icing-prone region. No-out becomes no-go.

## Discover

Icing requires two ingredients in the same air: liquid water (or
supercooled droplets) and a temperature at or below freezing. The
combination produces three forms, each with a distinct flight
signature:

- **Rime ice** -- forms when small supercooled droplets freeze on
  contact, trapping air between droplets. Granular, white, opaque.
  Accumulates slowly in stratus and stratocumulus. Spoils airflow
  but doesn't dramatically change the wing shape. Easier to shed
  with deicing than clear ice. Encountered in the -10 C to -20 C
  band most often.

- **Clear ice** -- forms when large supercooled droplets (or
  freezing rain) flow back along the wing surface before freezing.
  Glassy, transparent, hard to see, and it forms a horn or ridge
  that radically changes the wing's lift characteristics. The most
  dangerous in-flight icing form. Encountered in cumulus, freezing
  rain, and the warmer end of the icing band (around 0 C to -10 C).

- **Mixed ice** -- both at once. Carries the worst of each:
  hard-to-see (clear) on top of granular (rime), often with
  surface roughness that disrupts boundary-layer flow well beyond
  the visible accumulation.

A specific high-danger setup is **freezing rain** -- a warm layer
aloft over a cold layer below. Liquid rain falls into below-
freezing air and supercools. An aircraft flying in this layer
encounters the most aggressive clear-ice formation on the
airframe. The atmospheric setup that produces it is also the
setup that traps the pilot: descending out of the cold layer
into the warm layer means descending toward terrain.

The temperature band for structural icing is roughly **+2 C to
-20 C**, with peak severity around -2 C to -10 C. Above +2 C,
warmer air prevents accumulation. Below about -20 C, water in
clouds is mostly already ice crystals and won't freeze further on
contact. The band moves with conditions; the rule is approximate.

The avoidance hierarchy:

1. **Stay out** -- if AIRMET ZULU or a known icing setup overlaps
   the route at altitude, the question shifts to "do I have an
   out?"
2. **Have an out** -- a layer above, a layer below, or a heading
   that returns to clear air. The out must be reachable in the
   airframe's actual climb / descent capability and within the
   below-freezing-level / above-cloud-tops constraint.
3. **Recognize the setup early** -- temperature/dew-point spread,
   visible moisture, freezing-level position from the FB or
   freezing-level chart, PIREPs along the route.
4. **Escape immediately** if you encounter ice without an out --
   180 degree turn into the air you came from is the surest
   reversal because you know that air was clear five minutes ago.

## Reveal

Equipment caveats:

- **Anti-ice equipment** (heated leading edges, hot props) prevents
  ice from forming on protected surfaces. Adequate for the
  conditions it was certified for; inadequate for severe icing.
- **Deice equipment** (pneumatic boots) breaks accumulated ice off.
  Effective for rime; less effective for clear, especially when
  ice has bridged the boot.
- **Known-icing certification** means the airframe has been
  flight-tested and certified for flight in icing. It does **not**
  mean the airframe is invulnerable; it means the airframe is
  approved for *some* icing for *some* duration.
- **No anti-ice / deice** means the airframe is not certified for
  flight in icing. The avoidance rule moves from "manage the icing"
  to "do not enter icing conditions at all."

PIREPs are the canonical truth-up for any forecast icing picture.
A forecast says "moderate icing FL040-FL080"; a PIREP says "trace
rime FL060 KMRY area, light moderate FL080 KSAC area." The PIREP
is what the airframe actually felt; treat the PIREP as ground
truth and the forecast as the hypothesis it confirms or denies.

A condensed escape decision tree:

| Situation                                  | First action                                              |
| ------------------------------------------ | --------------------------------------------------------- |
| Trace ice, freezing level above terrain    | Descend below freezing level                              |
| Trace ice, above-cloud layer reachable     | Climb above tops                                          |
| Light ice, neither out reliable            | 180 immediately                                           |
| Moderate ice, declared emergency authority | Whatever altitude / heading clears the airframe           |
| Severe ice                                 | 180 + descent + declare; this is a known accident pattern |

## Practice

For a winter cross-country in the planning phase: pull the FB,
freezing-level chart, AIRMET ZULU, GFA icing layer, and recent
PIREPs. Identify the freezing level along the route. Identify the
forecast icing band. Identify whether you have a reliable out at
each segment of the route. Write down the out for each leg. If any
leg has no out, the no-go decision lives there.

For an in-flight icing encounter drill: practice the 180-degree
return procedure mentally. The decision needs to happen within 60
seconds of recognition; rehearsing the steps in the cockpit
without ice present makes the timing real. Most icing fatalities
are pilots who delayed the 180 because the situation was
"developing."

:::cards

- front: "Three icing types -- name them by formation droplet size and flight signature."
  back: |
    Rime ice: small supercooled droplets freeze on contact, trapping air.
    Granular, white, opaque. Slow accumulation in stratus / stratocumulus.
    Easier to shed. Most common in the -10 C to -20 C band.
    Clear ice: large supercooled droplets (or freezing rain) flow back
    along the surface before freezing. Glassy, transparent, forms a horn
    or ridge that radically changes wing shape. Most dangerous. Encountered
    in cumulus, freezing rain, and the warmer end (0 C to -10 C).
    Mixed ice: both at once. Worst of each -- hard to see + boundary-layer
    disruption beyond the visible accumulation.
  cardType: basic
  kind: recall
  tags: [weather, icing, types, phak-12, ac-91-74b]
  source_ref: |
    AC 91-74B Flight in Icing; PHAK Ch 12; body Discover.
  acs_codes: [PA.I.C.K3i]
  source_authority:
    - kind: ac
      cite: AC 91-74B Pilot Guide, Flight in Icing Conditions
    - kind: aim
      cite: AIM 7-1-21 -- Icing

- front: "Structural icing temperature band -- where is it widest and where is severity peak?"
  back: |
    Band: roughly +2 C to -20 C.
    Peak severity: -2 C to -10 C.
    Above +2 C, warmer air prevents accumulation. Below about -20 C, water
    in clouds is mostly already ice crystals and won't freeze further on
    contact. The band is approximate -- a SLD (supercooled large droplet)
    encounter can extend severe icing colder than the standard band.
  cardType: basic
  kind: recall
  tags: [weather, icing, temperature-band, ac-91-74b]
  source_ref: |
    AC 91-74B; body Discover.
  acs_codes: [PA.I.C.K3i]
  source_authority:
    - kind: ac
      cite: AC 91-74B Pilot Guide, Flight in Icing Conditions
    - kind: aim
      cite: AIM 7-1-21 -- Icing

- front: "Why is freezing rain a 'trap' setup -- what's the atmospheric structure that produces it and why is escape constrained?"
  back: |
    Freezing rain forms when a warm layer aloft (rain forms) sits over a
    cold layer below (rain supercools as it falls). Pilot in the cold layer
    encounters aggressive clear-ice formation. The escape problem: descending
    out of the cold layer into the warm layer means descending toward
    terrain. The atmospheric setup is also the setup that traps the pilot.
  cardType: basic
  kind: recall
  tags: [weather, icing, freezing-rain, clear-ice, ac-91-74b]
  source_ref: |
    AC 91-74B; body Discover.
  acs_codes: [PA.I.C.K3i]
  source_authority:
    - kind: ac
      cite: AC 91-74B Pilot Guide, Flight in Icing Conditions
    - kind: aim
      cite: AIM 7-1-21 -- Icing

- front: "Avoidance hierarchy for icing -- the four steps in order."
  back: |
    1. Stay out -- if AIRMET ZULU or known icing setup overlaps the route
       at altitude, the question shifts to 'do I have an out?'
    2. Have an out -- a layer above, a layer below, or a heading back to
       clear air. The out must be reachable within climb/descent capability,
       and within below-freezing-level / above-cloud-tops constraints.
    3. Recognize the setup early -- temperature/dew-point spread, visible
       moisture, freezing-level position, PIREPs.
    4. Escape immediately when ice encountered without an out -- 180 turn
       into the air you came from (you know that air was clear five
       minutes ago).
  cardType: basic
  kind: recall
  tags: [weather, icing, avoidance, escape, ac-91-74b]
  source_ref: |
    AC 91-74B; AIM 7-1-21; body Discover.
  acs_codes: [PA.I.C.K3i]
  source_authority:
    - kind: ac
      cite: AC 91-74B Pilot Guide, Flight in Icing Conditions
    - kind: aim
      cite: AIM 7-1-21 -- Icing

- front: "Anti-ice vs deice vs known-icing certified -- what's the practical difference?"
  back: |
    Anti-ice equipment (heated leading edges, hot props) prevents ice from
    forming on protected surfaces. Adequate for certified conditions only.
    Deice equipment (pneumatic boots) breaks accumulated ice off. Effective
    for rime; less effective for clear (especially when ice bridges the boot).
    Known-icing certified means the airframe has been flight-tested and
    approved for *some* icing for *some* duration. It does NOT mean
    invulnerable.
    No anti-ice / deice = airframe not certified for flight in icing; the
    rule moves from 'manage' to 'do not enter.'
  cardType: basic
  kind: recall
  tags: [weather, icing, equipment, anti-ice, deice, ac-91-74b]
  source_ref: |
    AC 91-74B; body Reveal "Equipment caveats."
  acs_codes: [PA.I.C.K3i]
  source_authority:
    - kind: ac
      cite: AC 91-74B Pilot Guide, Flight in Icing Conditions
    - kind: aim
      cite: AIM 7-1-21 -- Icing

- front: "Why is a PIREP the canonical truth-up for an icing forecast?"
  back: |
    A PIREP is what an airframe actually felt; the forecast is the
    hypothesis. A forecast says 'moderate icing FL040-FL080'; a PIREP says
    'trace rime FL060 KMRY, light moderate FL080 KSAC.' The PIREP is
    ground truth and the forecast is confirmed or denied against it.
    Absence of PIREPs does not refute the forecast -- pilots may not be
    flying at that altitude or reporting -- but a confirming PIREP makes
    the forecast operationally real.
  cardType: basic
  kind: recall
  tags: [weather, icing, pirep, airmet-zulu, aim-7-1-21]
  source_ref: |
    AIM 7-1-21 Icing; body Reveal.
  acs_codes: [PA.I.C.K3i]
  source_authority:
    - kind: ac
      cite: AC 91-74B Pilot Guide, Flight in Icing Conditions
    - kind: aim
      cite: AIM 7-1-21 -- Icing

- front: "Escape decision tree for icing -- what's the first action for trace ice with freezing level above terrain vs. trace ice with above-cloud layer reachable?"
  back: |
    Trace ice, freezing level above terrain -> descend below freezing level.
    Trace ice, above-cloud layer reachable -> climb above tops.
    Light ice, neither out reliable -> 180 immediately.
    Moderate ice -> declare emergency authority, whatever altitude / heading
    clears the airframe.
    Severe ice -> 180 + descent + declare. Severe ice is a known accident
    pattern; treat it as an emergency from recognition.
  cardType: basic
  kind: recall
  tags: [weather, icing, escape, emergency, ac-91-74b]
  source_ref: |
    AC 91-74B; body Reveal escape decision table.
  acs_codes: [PA.I.C.K3i]
  source_authority:
    - kind: ac
      cite: AC 91-74B Pilot Guide, Flight in Icing Conditions
    - kind: aim
      cite: AIM 7-1-21 -- Icing

- front: "Why do most icing fatalities involve pilots who delayed the 180?"
  back: |
    The icing situation feels 'developing' rather than catastrophic. The
    airplane settles slowly, IAS bleeds off gradually, autopilot trims down
    silently. The decision window for icing is short: 60 seconds from
    recognition to commit. Pilots who wait for 'definitive' icing have
    already loaded the wing past clean-flight performance. The 180 has to
    happen on first signal, not on confirmation.
  cardType: basic
  kind: recall
  tags: [weather, icing, escape, judgment, ac-91-74b]
  source_ref: |
    AC 91-74B; body Practice ("decision needs to happen within 60 seconds").
  acs_codes: [PA.I.C.K3i]
  source_authority:
    - kind: ac
      cite: AC 91-74B Pilot Guide, Flight in Icing Conditions
    - kind: aim
      cite: AIM 7-1-21 -- Icing

- front: "7,000 ft IFR in cloud, OAT -3 C. Five minutes later a translucent film on the leading edge; 10 minutes later airplane settles 200 fpm at cruise power, IAS bleeding off. What's happening and what's the action?"
  back: |
    Clear ice accumulation (translucent film in the warmer end of the
    icing band, droplets flowing back before freezing). The wing has lost
    lift efficiency; stall speed up, drag up, available thrust down. Action
    on first signal: 180 turn into the air you came from -- known clear
    five minutes ago. Do not wait to confirm severity; the airplane is
    already a different airplane. If terrain/airspace prevents the 180,
    declare and request descent below freezing level.
  cardType: basic
  kind: recall
  tags: [weather, icing, escape, clear-ice, scenario]
  source_ref: |
    Body Context scenario.
  rationale: |
    Scenario card from the body's Context. Trains the on-first-signal
    180-turn habit the body emphasises is the survival action.
  acs_codes: [PA.I.C.K3i]
  source_authority:
    - kind: ac
      cite: AC 91-74B Pilot Guide, Flight in Icing Conditions
    - kind: aim
      cite: AIM 7-1-21 -- Icing

- front: "Why does ice not 'release' from a non-deiced airframe in flight?"
  back: |
    There is no in-flight self-shedding mechanism for non-deiced airframes.
    Ice releases only when the airframe reaches the ground or enters
    above-freezing air. This is why 'wait for ice to come off' is not a
    plan -- the airplane will not shed it under any maneuver short of
    descending to warmer air. Plan the escape accordingly.
  cardType: basic
  kind: recall
  tags: [weather, icing, shedding, ac-91-74b]
  source_ref: |
    AC 91-74B; body Problem.
  acs_codes: [PA.I.C.K3i]
  source_authority:
    - kind: ac
      cite: AC 91-74B Pilot Guide, Flight in Icing Conditions
    - kind: aim
      cite: AIM 7-1-21 -- Icing
:::

## Connect

This node is one input to the go/no-go decision. It depends on
freezing-level reading (wx-freezing-level), winds aloft for
temperature-aloft cross-checks (wx-product-winds-aloft), and the
AIRMET / SIGMET cluster for forecast hazard polygons. Onboard
deicing equipment limitations connect to the equipment-and-data-
limitations node.

The encoded-text-family connection: AIRMET ZULU and the icing
PIREPs use the same decode / understand / triage ladder as METAR /
TAF. A pilot who reads "ZULU MOD ICE FRZLVL SFC" without the
underlying icing physics has a fragment, not a brief.

## Verify

For a recent winter day in your area, find a known icing accident
or near-accident. Walk the day's icing forecast, AIRMETs, PIREPs,
and FB. Could the conditions have been recognized in advance? Was
there an out the pilot didn't take? When the answer is "yes, the
brief showed it," that's the calibration to bring to your next
brief.
