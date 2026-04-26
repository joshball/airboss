---
# === Identity ===
id: proc-pitot-static-failures
title: Pitot-Static Failures
domain: emergency-procedures
cross_domains:
  - aircraft-systems
  - ifr-procedures
  - weather

# === Knowledge character ===
# factual: the pitot-static system has specific components (pitot tube, static
#   port, alternate static, drain holes) that fail in specific ways.
# procedural: there is a default response sequence (pitot heat on, alternate
#   static if available, switch power source if applicable, fly attitude +
#   power to maintain control while diagnosing).
# perceptual: recognising the failure pattern from instrument behavior
#   (airspeed climbing in a steady cruise, altimeter frozen, VSI lagging
#   abnormally) before it leads to a control input based on lying numbers.
knowledge_types:
  - factual
  - procedural
  - perceptual
technical_depth: working
stability: stable

# === Cert + study priority ===
minimum_cert: instrument
study_priority: critical
requires:
  - proc-instrument-cross-check
deepens: []
applied_by: []
taught_by: []
related:
  - proc-alternate-static-source
  - nav-partial-panel
  - proc-overspeed-recovery

# === Content & delivery ===
modalities:
  - reading
  - cards
  - reps
  - drill
estimated_time_minutes: 60
review_time_minutes: 10

# === References ===
references:
  - source: PHAK (FAA-H-8083-25C)
    detail: Chapter 8 -- Flight Instruments
    note: >-
      Authoritative for the physics: pitot pressure, static pressure, and
      how each pressure source feeds the airspeed indicator, altimeter,
      and VSI. Includes the specific failure modes and indications.
  - source: Instrument Flying Handbook (FAA-H-8083-15B)
    detail: Chapter on instrument systems and emergencies
    note: >-
      How the failures present in flight, the indications, and the
      recommended diagnostic flow.
  - source: POH / AFM
    detail: Section 3 emergency procedures -- pitot heat, alternate static source, instrument failure
    note: >-
      Aircraft-specific. Some airplanes have heated pitot AND heated
      static (rare in light singles); some have alternate static valve;
      some have neither and rely on cabin pressure ingress.
  - source: NTSB Birgenair Flight 301 / AeroPeru Flight 603 reports
    detail: Catastrophic accidents caused by blocked pitot tubes (insect / tape)
    note: >-
      Real-world demonstrations of how a pilot's mistrust of attitude in
      the face of lying airspeed indications leads to loss of control. The
      lesson generalises down to part-91 GA: trust attitude, diagnose by
      physics, do not chase the airspeed.
  - source: AIM
    detail: Pitot-static system maintenance and inspection requirements
    note: >-
      Two-year IFR pitot-static check requirement (91.411). Why those
      checks exist; what gets validated.

# === Assessment ===
assessable: true
assessment_methods:
  - recall
  - scenario
  - demonstration
mastery_criteria: >-
  Learner can: (1) describe how each instrument (ASI, altimeter, VSI)
  derives its indication from pitot or static pressure or both; (2)
  predict the indication on each instrument for a pitot block (drain
  open vs. closed), a static block, and a combined block, in level
  cruise, climb, and descent; (3) execute the response sequence for a
  pitot block in IMC (pitot heat, attitude + power flying, ATC notify);
  (4) execute the response for a static block including alternate
  static if equipped; (5) recognise three real-world causes (icing, dirt
  daubers, masking tape from preflight) and brief the preflight check
  that catches them.
---

# Pitot-Static Failures

## Context

You depart on an IFR flight in light icing conditions. Pitot heat is on. Twenty minutes into cruise, you notice your airspeed has climbed from a steady 130 KIAS to 145 KIAS over the past minute, despite no change in power and a stable altimeter. The VSI is steady at zero. You scan the AI -- still showing level. You add a hint of forward elevator to slow down; airspeed continues to climb. You retract throttle; airspeed keeps climbing. The airplane is now flying a constant pitch attitude with falling power, and the airspeed is going up.

Your airspeed indicator is lying. The pitot ram-air tube is blocked, but the pitot drain hole is also blocked, so the pitot system is now a sealed pressure chamber. As you climb (or as outside static pressure changes), the trapped pressure in the airspeed indicator no longer corresponds to dynamic pressure -- it acts like an altimeter, reading the difference between trapped pressure and current outside static. Your indicated airspeed is purely a function of altitude.

Pitot-static failures kill in two ways. The minor way is the pilot makes a control input based on a lying instrument and degrades the flight envelope (slows toward stall, speeds toward Vne, descends below assigned altitude). The major way is the pilot trusts a lying airspeed indicator more than a working AI, follows the airspeed back to "normal," and stalls or overspeeds the airplane. Birgenair 301 and AeroPeru 603 are the textbook accident reviews; both crews followed lying airspeed indications into control loss with the AI still working.

This node is about understanding the physics so the failure is diagnosable in real time, executing the right response, and never trusting an airspeed reading that disagrees with attitude and power.

## Problem

You are in IMC at 6,000 in a Cessna 172. Outside air temp is -2 C. You have been in cloud for 15 minutes; pitot heat is on, alternate static is closed. You notice your airspeed indicator suddenly drop from 100 KIAS to 60 KIAS over about 3 seconds, with no change in attitude or power. The altimeter and VSI are steady; AI shows wings level and slight nose-up.

What has just happened? What do you do in the next 10 seconds? After diagnosis, what do you tell ATC?

Write your answer before reading on. Then ask: what would your indications be if it were a static block instead of a pitot block? What if the pitot drain were also blocked?

## Discover

The system has three failure axes (pitot, static, and the redundancy of alternate static). The instruments have predictable behavior under each. Work through it.

### Q1. What does each instrument actually measure?

```text
ASI    = pitot pressure - static pressure  (dynamic pressure)
ALT    = static pressure  (referenced to 29.92 inHg, then corrected by Kollsman)
VSI    = rate of change of static pressure (capacitor-style mechanical)
```

So:

- **Airspeed** depends on both pitot and static. Block pitot, the ram-air number freezes (if drain is open) or behaves like an altimeter (if drain blocked too). Block static, both terms are corrupted; airspeed reads erroneously.
- **Altimeter** depends only on static. Block static, the altimeter freezes at the value it had when the block formed.
- **VSI** depends on rate of static change. Block static, VSI freezes at zero (no rate of change once trapped).

### Q2. What does a pitot block look like in flight?

Three sub-cases:

**Pitot ram-air blocked, drain open.**

The drain bleeds the trapped pitot pressure to ambient. After a few seconds, pitot pressure equals static pressure. ASI = pitot - static = 0. Airspeed reads zero.

In flight: airspeed slowly bleeds toward zero over 2-30 seconds depending on drain size and altitude. AI, altimeter, VSI unaffected.

**Pitot ram-air blocked, drain blocked too (sealed).**

Pitot pressure trapped at whatever it was when the block formed. As altitude changes, static pressure changes but trapped pitot pressure does not. So ASI = trapped - current static. The number now follows altitude, not airspeed.

In flight: in level cruise, airspeed reading is roughly stable but offset. In a climb, airspeed rises (static drops faster than trapped pitot). In a descent, airspeed falls. The instrument acts like a backwards altimeter.

This is the Birgenair / AeroPeru failure mode (well, AeroPeru was static, but the principle generalises). The pilot misinterprets rising airspeed in a climb as actual overspeed, retards throttle, and pitches up to slow down -- which actually slows the airplane while the lying ASI still rises. Result: stall.

**Pitot ram-air blocked, drain open (intermittent / partial).**

Mixed. Often the most diagnostically annoying because the ASI behavior is unstable.

### Q3. What does a static block look like?

**Static port blocked.**

Altimeter: freezes at value when block formed. As you climb or descend, altimeter does not change.

VSI: freezes at zero.

ASI: pitot continues to track ram-air pressure (good), but static reference is frozen. So ASI = pitot - frozen_static. In a climb, pitot pressure rises slightly (more dynamic pressure due to airspeed adjustment), static is held -- ASI reads roughly right but slowly drifts. In a descent, ASI reads slowly low.

The instrument behavior is mostly stable until the airplane climbs or descends; then it lies.

**Static port blocked, alternate static available.**

Pilot opens alternate static valve. Cabin static is now the static reference. Cabin static at altitude is generally lower than outside static (cabin is partly sealed; it lags), so:

- Altimeter reads higher than actual.
- ASI reads higher than actual.

POH publishes a correction. Common values: altitude offset 50-100 feet, IAS offset 4-8 KIAS at typical cruise altitudes. Pilots fly the airplane with the offset and request real altitudes from ATC if necessary.

### Q4. What does a combined pitot AND static block look like?

The airplane is essentially flying without a working pressure system. Airspeed unreliable. Altimeter frozen. VSI frozen.

Diagnosis: the pilot must fly attitude + power. Known pitch attitude + known power setting = known airspeed. ATC altitude calls (and GPS altitude as a sanity check) replace the altimeter. Land at the nearest airport.

This is rare but not unheard of -- a single icing event in cloud can pack ice on both ports if heating is inadequate.

### Q5. How do you tell which failure mode you have?

Cross-check is the diagnostic tool:

| Failure                | ASI                               | Altimeter | VSI       |
| ---------------------- | --------------------------------- | --------- | --------- |
| Pitot block, drain open| Reads zero                        | Normal    | Normal    |
| Pitot block, sealed    | Reads like backwards altimeter    | Normal    | Normal    |
| Static block           | Reads near-normal at level, drifts in climb/descent | Frozen | Frozen |
| Combined block         | Erratic                           | Frozen    | Frozen    |

Plus the AI is working in all of these (assuming separate vacuum). So the cross-check signature is: AI says you are level, the pressure instruments disagree.

### Q6. What is your in-flight response?

```text
1. Trust attitude. Fly pitch + power to a known cruise condition.
2. Identify the failure (cross-check; what disagrees with what?).
3. Apply the procedural fix:
   - Pitot block: pitot heat ON, accept slow airspeed loss to zero (drain
     open) or constant pitch + power flying (drain blocked).
   - Static block: alternate static ON; apply POH correction; fly altitude
     by ATC + GPS, accept ASI offset.
   - Combined: fly attitude + power; declare emergency; vector to nearest.
4. Notify ATC. "Pitot-static problem" or "unreliable airspeed."
5. Land at the nearest suitable airport.
```

### Q7. What are the real-world causes?

- **Icing.** Pitot tube heater inadequate or off; static port unheated. Most common cause in IMC. Pitot heat on is the standard preflight discipline; check it ground-tested.
- **Insects.** Mud daubers and other wasps love pitot tubes. Pitot covers exist for this reason. Preflight the pitot tube physically.
- **Tape.** Pre-flight cleaning crews and well-meaning friends place tape over pitot tubes. The tape gets forgotten. This is the AeroPeru failure mode (tape covered the static ports). Preflight the airplane with eyes on every port.
- **Water in the system.** Heavy rain or post-wash water trapped; freezes on climb. Drain holes exist for this reason.
- **Plumbing failure.** Lines crack, fittings leak. The 24-month IFR pitot-static check (91.411) catches most of these.

### What Discover should have led you to

- Each instrument has a specific physical relationship to pitot and static pressure. Failures follow the physics.
- Pitot block (drain open) is benign; drain blocked is dangerous because the ASI lies in a pattern that fools control inputs.
- Static block freezes altimeter and VSI; alternate static introduces a known offset.
- Cross-check identifies the failure; AI working is the safety anchor.
- Preflight (pitot cover, ports clear, pitot heat ground-test) prevents most cases. The accident database is overwhelmingly preventable causes.

## Reveal

### The summary rule

> Trust attitude. Fly pitch + power. Diagnose pitot-static failures from cross-check signature: ASI behavior pattern + altimeter/VSI status + AI agreement. Pitot block: heat on, drain-open is benign, drain-sealed is dangerous (ASI tracks altitude). Static block: alternate static if equipped, apply POH correction. Notify ATC; land at the nearest suitable airport. Never follow a lying airspeed indication into a control input that disagrees with attitude and power.

### Failure signature table

| Failure                       | ASI behavior                                            | Altimeter | VSI       | First action                                   |
| ----------------------------- | ------------------------------------------------------- | --------- | --------- | ---------------------------------------------- |
| Pitot ram blocked, drain open | Bleeds to zero over seconds                             | Normal    | Normal    | Pitot heat ON; fly pitch+power                 |
| Pitot ram blocked, drain blocked | Tracks altitude (rises in climb, falls in descent) | Normal    | Normal    | Pitot heat ON; fly pitch+power; ignore ASI     |
| Static blocked                | Roughly normal level; drifts in climb/descent           | Frozen    | Frozen    | Alternate static ON; apply POH correction      |
| Combined pitot + static blocked | Erratic                                              | Frozen    | Frozen    | Pitch+power flying; declare; nearest airport   |

### The Birgenair / AeroPeru pattern

In both accidents, the airplane was flying with a frozen / blocked pitot or static reference. The crew responded to the bogus airspeed reading. In both cases, the AI was working and clearly indicated unusual attitude during the spiral / stall, but the crew chased the lying numbers. Both airplanes were lost with all aboard.

The lesson, codified in airline training and applicable to GA: if airspeed disagrees with attitude and power, attitude and power win. Power-attitude flying is not a backup; it is the truth-source when the pressure system lies.

### Pitot heat -- when and how

- Always on for IFR flight in visible moisture below freezing.
- Always on for night flight in any visible moisture (you cannot see ice forming).
- Always on for any approach in IMC (last thing you need at minimums is an ASI failure).
- Ground-test before takeoff: pitot tube briefly warm to careful touch, ammeter or annunciator shows load.
- Off in long cruise without moisture (battery / element life).

The POH may prescribe different rules; follow them.

### Alternate static source -- typical light single procedure

1. Open the alternate static valve (usually a knob on the lower instrument panel labeled "ALT STATIC" or "STATIC SOURCE - ALTERNATE").
2. The cabin air now feeds the static system.
3. Apply POH correction. Typical values:
   - Altimeter: indicates HIGHER than actual by 50-100 feet at cruise altitudes.
   - Airspeed: indicates HIGHER than actual by 4-8 KIAS.
4. Cross-check with ATC altitude call; GPS altitude as sanity check.
5. Land at nearest suitable airport.

If no alternate static is fitted, breaking the VSI face glass is an emergency improvisation in some POHs (the VSI then bleeds to cabin static, restoring static reference for ASI and altimeter at the cost of the VSI). This is a memory item in some training airplanes; not all.

### What is actually authoritative

In descending order:

1. **POH Section 3** for your airplane's emergency procedures, alternate static guidance, pitot heat usage, and any aircraft-specific caveats.
2. **PHAK Chapter 8** for the underlying physics.
3. **IFH** for the flight technique.
4. **POH Section 5** for the alternate-static correction values.

### location_skill

- POH Section 3 -- emergency procedures; pitot heat; alternate static.
- POH Section 5 -- alternate-static correction tables.
- POH Section 7 -- description of the pitot-static system: where the pitot is, where the static ports are, what is heated, what is not.
- AFM supplement for any aftermarket avionics or AI installation that may add backup data.

## Practice

### Cards (spaced memory items)

- `card:ps-asi-formula` -- "What does the airspeed indicator measure?" -> "Pitot pressure minus static pressure (dynamic pressure)."
- `card:ps-altimeter-formula` -- "What does the altimeter measure?" -> "Static pressure (referenced to 29.92, then corrected by Kollsman)."
- `card:ps-vsi-formula` -- "What does the VSI measure?" -> "Rate of change of static pressure."
- `card:ps-pitot-block-drain-open" -- "Pitot ram-air blocked, drain open: ASI behavior?" -> "Bleeds to zero over seconds."
- `card:ps-pitot-block-drain-sealed" -- "Pitot ram-air blocked, drain blocked: ASI behavior?" -> "Acts like an altimeter -- rises in climb, falls in descent."
- `card:ps-static-block` -- "Static port blocked: altimeter and VSI behavior?" -> "Both freeze at value when block formed."
- `card:ps-alt-static-asi-offset` -- "ASI offset on alternate static (typical light single)?" -> "Reads HIGHER than actual by 4-8 KIAS at cruise altitudes (POH-specific)."
- `card:ps-alt-static-altitude-offset" -- "Altitude offset on alternate static?" -> "Reads HIGHER than actual by 50-100 feet at cruise altitudes (POH-specific)."
- `card:ps-pitot-heat-when` -- "When is pitot heat mandatory?" -> "IFR in visible moisture below freezing; night flight in moisture; IMC approaches."
- `card:ps-attitude-and-power" -- "Truth source when pitot or static lies?" -> "Attitude indicator + known power setting -> known airspeed; trust attitude over ASI."

### Reps (scenario IDs)

- `scenario:ps-pitot-block-imc-cruise` -- the opening problem; ASI drops, altimeter steady, AI normal. Diagnose, respond.
- `scenario:ps-pitot-sealed-climb` -- ASI rising as you climb in IMC; pilot must reject the airspeed reading and fly pitch + power.
- `scenario:ps-static-block-icing` -- altimeter freezes as you climb through cloud; alternate static management.
- `scenario:ps-combined-block-emergency` -- both pitot and static frozen; declare and divert.
- `scenario:ps-tape-on-static-preflight-miss` -- tape from a wash crew left over a static port; airplane returns to runway after takeoff with frozen altimeter.
- `scenario:ps-alternate-static-cruise-correction` -- pilot is flying with alternate static open; ATC asks for level off at 5,000; pilot computes corrected target.

### Drills (time-pressured)

- `drill:ps-failure-signature-recognition` -- learner is shown ASI/altimeter/VSI snapshots in sequence; identifies which failure mode within 5 seconds.
- `drill:ps-correction-math` -- given alternate-static offsets, learner computes target indicated values for an assigned actual altitude / airspeed.
- `drill:ps-pitch-power-cruise-recall` -- learner names the pitch attitude + power setting for level cruise at three altitudes in their airplane.

### Back-of-envelope calculations

**Calculation 1: pitot-block-sealed climb behavior.**

If the block forms at cruise (level, 100 KIAS, 6,000 MSL, static = 815 hPa, pitot = 815 + dynamic = ~825 hPa) and you climb to 8,000 MSL where ambient static is ~755 hPa:

- Trapped pitot pressure: 825 hPa (frozen).
- Static at new altitude: 755 hPa.
- ASI sees pitot - static = 825 - 755 = 70 hPa.
- 70 hPa converts to roughly 168 KIAS at standard density.

The ASI now reads 168 KIAS in level cruise at 8,000, despite no actual change in airspeed. A pilot who pulls back to "slow down" actually slows the airplane while the ASI may continue to climb (the climb itself widens the offset).

**Calculation 2: alternate-static correction in cruise.**

POH-typical correction (C172, alternate static, 6,000 MSL):

- Altimeter offset: +75 feet (reads 6,075 when actually at 6,000).
- Airspeed offset: +6 KIAS (reads 106 when actually at 100).

If ATC clears you to maintain 6,000:

- Target indicated altitude on alternate static: 6,000 + 75 = 6,075 (you fly to 6,075 indicated).
- Target indicated airspeed for 100 KIAS true: 106 KIAS indicated.

POH numbers vary by airplane; these are illustrative.

## Connect

### What changes if...

- **...you are flying glass cockpit?** ADAHRS air-data computers detect some pitot-static failures and annunciate (red X on ASI, "AIRSPEED FAIL" message). Some installations have heated static ports as well as heated pitot. Check your specific installation. The diagnostic logic is the same; the alerts help.
- **...you are in icing conditions and pitot heat is on but inadequate?** Pitot can still ice over with extended exposure to severe icing. Get out of icing immediately; declare; descend or climb to non-icing layer.
- **...you are flying glider with no pitot?** Different aircraft, different problem. Some gliders have static-only systems and a Pitot-tube-fed mechanical airspeed.
- **...you have a TAS computer that uses GPS?** GPS groundspeed is not airspeed. They differ by wind component. Useful for sanity check (in zero wind, GS ~ TAS), not as a primary backup.
- **...the airplane has heated static ports (rare in light singles)?** Static-block icing risk is much lower. Most single-engine pistons do not.
- **...you fly the airplane regularly with the alternate static valve cracked open?** That is not a fix; it changes your pressure source and the airplane is now flying offset numbers at all times. Close it after a leg with alt-static use.
- **...you are at minimums on an ILS when this happens?** Go missed. Do not try to fly an instrument approach with unreliable airspeed indications. The missed approach geometry is forgiving; the approach is not.

### Links

- `proc-alternate-static-source` -- the procedural fix for static block.
- `proc-instrument-cross-check` -- the diagnostic cross-check that catches the failure.
- `nav-partial-panel` -- the broader degraded-instrument flight discipline.
- `proc-overspeed-recovery` -- if the lying ASI fooled you into a high-speed dive, the recovery is its own procedure.
- `proc-stall-recovery` -- if the lying ASI fooled you into a slow-flight stall.
- `wx-icing-types-and-avoidance` -- the most common cause in IFR flight.

## Verify

### Novel scenario (narrative)

> You are in IMC at 7,000 in a Cessna 172 in light icing. Pitot heat is on. ATC clears you to climb to 9,000. As you initiate the climb, the airspeed indicator slowly rises from a normal 95 KIAS climb speed to 130 KIAS, then to 145 KIAS. The altimeter is climbing through 7,800 normally. The VSI shows a normal 500 fpm climb. AI shows a normal climb attitude. Power is unchanged.
>
> Diagnose the failure and walk through your sequence in the next 30 seconds.

Scoring rubric:

- Identifies the failure as pitot ram blocked with drain blocked (sealed); ASI tracking altitude. (3)
- Distinguishes from a static block (altimeter and VSI are working normally). (1)
- Continues climbing to 9,000 by attitude and power; rejects the high-airspeed reading. (3)
- Pitot heat verified on; cycles it off-on if equipped to confirm switch is not the problem. (1)
- Notifies ATC: "Center, Cessna 12345, pitot system failure, unreliable airspeed, request lower / nearest VFR / vectors to nearest suitable airport." (2)
- Selects nearest suitable airport with VFR conditions or a non-precision approach in better-than-minimums weather. (2)
- Plans the approach with attitude + power flying; uses POH-known approach pitch / power for the airplane (C172: ~80 KIAS at low cruise power, full flaps last). (2)
- Briefs the landing: knows that the ASI may behave erratically as the airplane descends through the altitude where the block formed; ignores the indication, lands by attitude and groundspeed sanity check from GPS. (2)

16/16 is the bar. Below 12 is a redo.

### Teaching exercise (CFI)

> A part-91 IFR pilot returns from a flight reporting "the airspeed indicator was acting weird; it climbed to 145 in cruise but the airplane felt fine. I just kept flying the same pitch and power and it eventually came back as I descended. Wasn't really a problem." They did not notify ATC, did not declare, did not divert. They are asking whether they should put the airplane in maintenance.
>
> Write the first three sentences of your response. Address: the airplane (yes, maintenance), the in-flight response (no, what they did was lucky), and the next training exposure.

Evaluation criteria:

- Does not lecture; the pilot survived and is asking for guidance.
- Names what they did right: trusting attitude and power, not chasing the ASI.
- Names what they did wrong: not declaring or diverting; pitot-static failure is an emergency in IMC and the pilot was in IMC.
- Mandates maintenance write-up; pitot-static system needs inspection; flight should not have been continued.
- Schedules a hood lesson covering pitot-static failure diagnosis and partial-panel flight as soon as practical.
- Avoids dramatising; the failure mode is well-known, the recovery is well-defined, and the pilot is teachable.

The pedagogical move is to convert a near-miss into a teachable moment without either glamorising "I just kept flying" or overcorrecting into "you should have done X immediately." The pilot's first action (don't chase the ASI) was correct; the second action (continue without notifying or diverting) was not.
