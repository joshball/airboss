---
# === Identity ===
id: proc-alternate-static-source
title: Alternate Static Source
domain: emergency-procedures
cross_domains:
  - aircraft-systems
  - ifr-procedures

# === Knowledge character ===
# procedural: a single switch / valve action plus an applied correction.
# factual: the offsets are POH-published numbers that you commit to memory or
#   keep accessible.
# judgment: when you select alternate static (and how aggressively you bias
#   altitude / airspeed for the offset) is a workload decision under failure.
knowledge_types:
  - procedural
  - factual
  - judgment
technical_depth: working
stability: stable

# === Cert + study priority ===
minimum_cert: instrument
study_priority: critical
requires:
  - proc-pitot-static-failures
deepens: []
applied_by: []
taught_by: []
related:
  - nav-partial-panel
  - proc-instrument-cross-check

# === Content & delivery ===
modalities:
  - reading
  - cards
  - drill
estimated_time_minutes: 30
review_time_minutes: 6

# === References ===
references:
  - source: PHAK (FAA-H-8083-25C)
    detail: Chapter 8 -- Flight Instruments; pitot-static system
    note: >-
      Authoritative on why the alternate static source is offset (cabin
      pressure differs from outside static pressure due to airframe leak
      paths, vent geometry, and Bernoulli effects around vent openings).
  - source: POH / AFM Section 5
    detail: Performance / Airspeed Calibration -- alternate static source correction tables
    note: >-
      The numbers. Each airplane has its own correction. C172, PA28, and
      most light singles publish a small table of offsets at typical cruise
      configurations.
  - source: POH / AFM Section 3
    detail: Emergency procedures -- selecting alternate static
    note: >-
      Procedure: open the valve, apply correction, fly the airplane, land.
      Some airplanes specify a different procedure (e.g., breaking the VSI
      face glass) when no alternate static valve is fitted.
  - source: AC 91-44A
    detail: Operational and Maintenance Practices for Emergency Locator Transmitters and pitot-static systems
    note: >-
      Background. AC 91-44A is mostly about ELTs but the pitot-static
      maintenance discussion is relevant context for why the system can
      fail and how it is checked.

# === Assessment ===
assessable: true
assessment_methods:
  - recall
  - demonstration
mastery_criteria: >-
  Learner can: (1) state the location and operation of the alternate
  static source valve in their training airplane; (2) explain why
  cabin static pressure differs from outside static pressure (cabin
  is somewhat sealed; pressure leakage and venturi effects from cabin
  ventilation make cabin static lower than outside static at altitude);
  (3) recite the typical altitude and airspeed offset directions
  (BOTH read HIGHER than actual when alternate static is on) and the
  POH offset values for their airplane; (4) execute the procedure in
  flight (verify static block, open the valve, apply corrections,
  notify ATC, land at nearest suitable airport); (5) describe the
  improvisation if no valve is fitted (some POHs specify breaking
  the VSI face glass to admit cabin static).
---

# Alternate Static Source

## Context

The static port is a small hole on the side of the fuselage that lets the airplane's instruments sample atmospheric pressure at altitude. It is also a target. Water gets in. Ice forms over it. A protective cover gets left on. A wash crew puts tape over it and forgets to remove it. When that happens, the airplane is flying with a static reference frozen at the value when the block formed, and the altimeter, VSI, and (less obviously) the airspeed indicator are all lying.

The alternate static source is the engineered answer. It is a valve, usually on or below the lower instrument panel, that switches the static feed from the external port to a tap in the cockpit. Cabin static pressure is not the same as outside static pressure -- the cabin is partially sealed, ventilated, and shaped in a way that produces small but predictable pressure differences. The POH tells you exactly how big those differences are at typical cruise configurations.

This node is the procedural mate of `proc-pitot-static-failures`. The diagnosis happens in that node. This is what you do once diagnosis says "static is blocked."

The procedure is short. The discipline is not. Pilots who reach for the alternate static valve under high workload sometimes forget to apply the correction, fly the airplane to the indicated altitude (which is now offset), and find themselves at an actual altitude that is wrong. ATC catches it. Sometimes terrain catches it.

## Problem

You are at 5,000 in IMC, hand-flying, when you notice the altimeter has been showing 5,000 for the last three minutes. The VSI is showing zero. You are climbing toward 7,000 per ATC clearance. You verify by checking your GPS-derived altitude on the iPad: actual altitude is 6,400 and rising at 500 fpm. The airspeed indicator is showing what looks like a slightly low cruise number for the power setting.

Static is blocked. You decide to open the alternate static valve. What do you do, in order, in the next 30 seconds, and what do you tell ATC?

Write your answer before reading on. Then ask: at the moment you open the valve, what happens to the altimeter reading? What target indicated altitude do you fly to maintain ATC's 7,000?

## Discover

The procedure decomposes into four questions: when, what happens when you open it, what offsets to apply, and how to fly the airplane afterward.

### Q1. When do you select alternate static?

You select it when you have evidence of static block. Evidence includes:

- Altimeter not changing despite a known climb or descent.
- VSI showing zero or near-zero despite known vertical motion.
- ASI behavior that suggests static lying (drifting away from expected at constant pitch + power).
- A known cause (visible icing on a static port; preflight tape miss).

Do not select alternate static "just in case." It introduces a known offset; the offset is acceptable when the alternative is no static reference at all, but unnecessary if the airplane is flying right.

### Q2. What happens at the moment you open the valve?

The static system is now drawing from cabin air instead of the outside port. Cabin air pressure at cruise is generally LOWER than outside static (the cabin leaks somewhat to the outside, and venturi effects around cabin vents reduce cabin static further). The mathematical effect:

- Lower cabin static -> instruments think they are higher than they are.
- Altimeter jumps UP.
- ASI jumps UP (because pitot - lower-static = larger dynamic pressure indication).
- VSI may briefly indicate a climb.

So the moment you open the valve, your altimeter reads MORE than your actual altitude. ASI also reads MORE.

If you do not apply correction, you will fly the airplane down to bring the altimeter back to the assigned altitude, and you will end up below the assigned altitude.

### Q3. What is the offset?

POH-specific. Typical light single (C172, PA28) at cruise altitudes:

| Item       | Direction | Typical magnitude  |
| ---------- | --------- | ------------------ |
| Altitude   | Reads HIGH | 50-100 feet        |
| Airspeed   | Reads HIGH | 4-8 KIAS           |
| VSI        | Reads briefly elevated, settles | Few hundred fpm transient |

So if ATC asks you to maintain 5,000 and the actual offset is +75 feet, you fly to an indicated altitude of 5,075. If your target IAS is 100 and the offset is +6, you fly to 106 indicated.

These numbers vary with altitude, configuration, and airplane. The POH publishes a table; some airplanes give a single typical offset, others publish offsets at multiple flight conditions.

### Q4. How do you cross-check?

GPS altitude (on a tablet, on a panel-mounted GPS, on a backup) is a sanity check. GPS altitude is referenced to the WGS-84 ellipsoid, not MSL, so it differs from baro altitude by a few hundred feet depending on location. But the rate is correct, and the agreement-or-disagreement with the corrected altimeter is informative.

ATC altitude calls are a similar check. If ATC tells you your Mode C altitude reads 5,275 (because Mode C is fed from the static system), then you know exactly what your transponder is reporting, and you can compare to your indicated altitude post-correction.

Cross-check confirms the correction. Numbers that match within a few hundred feet are fine; numbers that disagree by a thousand feet need a re-think.

### Q5. What if the airplane has no alternate static valve?

Some lighter / older airplanes do not have one. The POH may specify an emergency improvisation:

- Breaking the VSI face glass admits cabin static via the broken VSI line. The VSI is destroyed; the static system now reads cabin pressure (same offset as a true alternate static valve). Memory item in some training airplanes; surprisingly common in older C150s and PA28s without the alternate-static option.
- Some airplanes specify operating with the cabin window cracked or the cabin heat / vent set in a specific way to produce a known cabin pressure for the static reference.

If the POH does not specify, you do not improvise. You fly attitude + power, accept the static failure, declare, and divert.

### Q6. What is the cleanup?

After you have selected alternate static, you fly the airplane on offsets to a landing. Once on the ground, you tell maintenance that the static system needs inspection. The 24-month IFR pitot-static check (91.411) is also affected; an unscheduled inspection may be required. Do not just close the valve and re-fly; the system has had a known failure.

### What Discover should have led you to

- Selecting alternate static introduces a known POH-published offset. Both altitude and airspeed read HIGH.
- You apply correction by flying to a different indicated value than the assigned actual value.
- GPS altitude and ATC altitude calls cross-check the correction.
- Without an alternate static valve, the POH-specified improvisation (breaking the VSI face glass) is the option in some airplanes; in others, you fly attitude + power.
- After landing, the airplane goes to maintenance; the failure is not "fixed" by closing the valve.

## Reveal

### The summary rule

> Selecting alternate static admits cabin pressure (lower than outside static at altitude) into the static system. Altimeter and ASI both read HIGHER than actual; apply POH-published offsets and fly indicated values that produce the assigned actual values. Notify ATC, cross-check with GPS / Mode C altitude calls, and land at the nearest suitable airport. If no alternate static valve is fitted, the POH may specify breaking the VSI face glass; otherwise, fly attitude + power.

### The procedure (typical light single)

```text
1. Verify static block via cross-check (altimeter frozen, VSI zero,
   AI working).
2. Open alternate static valve (knob or lever, panel-located, labeled
   "ALT STATIC" or "STATIC SOURCE - ALTERNATE").
3. Note the new indicated altitude. It will jump up from frozen value.
4. Compute target indicated altitude:
     target_indicated = assigned_actual + altitude_offset
5. Fly to target indicated; cross-check with GPS / Mode C.
6. Compute target indicated airspeed:
     target_indicated = target_actual + airspeed_offset
7. Fly to target indicated; cross-check by attitude + power feel.
8. Notify ATC: "Center, Cessna 12345, static system failure, on
   alternate static, altitude offset plus 75, request lower / nearest
   suitable airport."
9. Land. Document. Maintenance.
```

### Example offsets (illustrative, from typical POHs)

C172N at 5,000 MSL, cruise:

```text
indicated altitude  -- actual + 60 to 80 feet
indicated airspeed  -- actual + 4 to 6 KIAS
```

PA28-181 at 5,000 MSL, cruise:

```text
indicated altitude  -- actual + 50 to 70 feet
indicated airspeed  -- actual + 5 to 8 KIAS
```

Glass cockpit airplanes with separate static taps may have similar or different offsets; consult AFM supplement.

These are illustrative. Your POH always wins.

### What is actually authoritative

In descending order:

1. **Your POH Section 3** for the procedure.
2. **Your POH Section 5** for the offset values.
3. **AFM supplements** for any avionics installation that may affect static behavior.
4. **PHAK Chapter 8** for the underlying physics if the POH is silent on the why.

### location_skill

- POH Section 3 -- "Alternate Static Source" or "Static Source Failure" subheading.
- POH Section 5 -- "Airspeed Calibration" or "Altimeter / Airspeed Correction" -- the offset table.
- The valve itself -- find it in the airplane on the ground, before you need it. It may be hidden under the radio stack, behind the yoke, or on the lower instrument panel.

## Practice

### Cards (spaced memory items)

- `card:as-when-select` -- "When do you select alternate static?" -> "When the static port is blocked: altimeter frozen, VSI zero despite vertical motion."
- `card:as-altimeter-direction" -- "Altimeter behavior on alternate static?" -> "Reads HIGHER than actual; cabin static is lower than outside static at altitude."
- `card:as-airspeed-direction" -- "ASI behavior on alternate static?" -> "Reads HIGHER than actual."
- `card:as-target-altitude-formula" -- "Formula for target indicated altitude on alternate static?" -> "target_indicated = assigned_actual + altitude_offset."
- `card:as-target-airspeed-formula" -- "Formula for target indicated airspeed on alternate static?" -> "target_indicated = target_actual + airspeed_offset."
- `card:as-no-valve-fix" -- "POH-typical fix when no alternate static valve is fitted?" -> "Break the VSI face glass; admit cabin static through the VSI line."
- `card:as-cross-check-tools" -- "Cross-checks for the corrected altitude on alternate static?" -> "GPS altitude (sanity check) and ATC Mode C altitude calls."
- `card:as-postflight" -- "After landing with alternate static used in flight?" -> "Maintenance write-up; static system inspection; do not re-fly without inspection."
- `card:as-c172-typical-offset" -- "Typical C172 altitude offset on alternate static?" -> "+60 to +80 feet at cruise altitudes (POH-specific)."

### Reps (scenario IDs)

- `scenario:as-static-block-cruise-correction` -- altimeter frozen at 5,000 in a 7,000 climb; pilot opens valve and applies correction.
- `scenario:as-static-block-approach` -- static block detected on initial approach; pilot opens valve, computes corrected DA, flies the approach.
- `scenario:as-no-valve-fitted-emergency` -- airplane has no valve; pilot must execute the VSI-glass procedure or fly attitude + power.
- `scenario:as-correction-error-busted-altitude` -- pilot opens valve, forgets correction, flies indicated to assigned -- now actually 75 feet low; ATC catches it.

### Drills (time-pressured)

- `drill:as-target-from-assigned` -- given assigned altitude and offset, learner computes target indicated altitude in 5 seconds.
- `drill:as-procedure-recall` -- learner recites the alt-static procedure in order, naming each step's purpose.
- `drill:as-locate-valve-cockpit` -- learner is shown a panel photo and points to the alternate static valve location for that airplane.

### Back-of-envelope calculations

**Calculation 1: assigned altitude on alternate static.**

ATC clearance: maintain 6,000.
POH offset at cruise altitudes: altimeter reads +75 feet on alternate static.

```text
target_indicated = 6,000 + 75 = 6,075
```

You fly to 6,075 indicated. Mode C reports 6,075 (because the transponder is on the same static system). ATC may call you with "your Mode C is showing 6,075"; explain the alternate static, confirm actual altitude is 6,000.

**Calculation 2: target IAS on alternate static.**

Target actual airspeed: 100 KIAS.
POH offset: ASI reads +6 KIAS on alternate static.

```text
target_indicated = 100 + 6 = 106
```

You fly to 106 KIAS indicated.

**Calculation 3: combined check on cross-reference.**

ATC call: "Cessna 12345, your altitude reads 6,075 on Mode C; verify level at six-thousand."

You: "Cessna 12345, on alternate static, altitude offset plus 75, level at six-thousand actual, six-thousand-seventy-five indicated."

That is the right radio call. ATC understands; they will continue handling you with the offset known.

## Connect

### What changes if...

- **...the airplane has heated static ports?** Static block from icing is much rarer. Alternate static is still relevant for blockage from other causes (wash tape, insects, mechanical failure) but the in-flight icing failure mode is reduced.
- **...you are flying with the cabin door cracked open?** Cabin pressure may differ from the POH-published cabin static reference. The offset becomes uncertain. Close the door before relying on alt-static numbers.
- **...you are flying glass cockpit?** ADAHRS may detect the static failure and annunciate. Some installations have separate static ports for primary and backup ADAHRS. Procedure may differ; consult AFM supplement.
- **...both pitot and static are blocked?** Alternate static helps the altimeter and VSI; ASI is still suspect because pitot is blocked. Fly pitch + power; ignore ASI; declare.
- **...you are at minimums on an instrument approach when this happens?** Go missed. Do not try to fly to DA / MDA on offset altimeter readings without time to stabilise the correction. Cleaner to vector to a non-precision approach in better weather.
- **...the offset varies wildly with maneuvering?** Cabin pressure can change with cabin heat, slipping, turbulence, vent position. A noisy correction is normal; trust ranges, not single numbers. Fly conservative altitudes (slightly higher than required).

### Links

- `proc-pitot-static-failures` -- the parent failure family. Diagnose there; respond here.
- `proc-instrument-cross-check` -- the cross-check that both detected the failure and now confirms the correction.
- `nav-partial-panel` -- alternate static is one element of degraded-instrument flight discipline.

## Verify

### Novel scenario (narrative)

> You are at 4,000 in IMC, ATC has cleared you to 6,000. You initiate the climb. After 90 seconds, the altimeter still reads 4,000; VSI shows 0; airspeed is 90 KIAS at climb power, lower than your normal 95 KIAS Vy. AI shows a normal climb attitude. GPS-derived altitude on your iPad shows 5,300 and rising.
>
> Walk through your sequence: diagnosis, alternate-static action, ATC call, target indicated altitude for the assigned 6,000 (use a +75 ft offset), and what you watch as you climb.

Scoring rubric:

- Diagnoses static block (altimeter and VSI frozen; AI working; GPS shows climb). (2)
- Opens alternate static valve. (1)
- Notes new altimeter reading and computes target: 6,000 + 75 = 6,075 indicated. (2)
- Computes target IAS: target Vy 95 + 6 offset = 101 KIAS indicated for the climb (illustrative; actual offset varies). (1)
- Calls ATC: "Center, Cessna 12345, static system failure, on alternate static, plus 75 altitude, plus 6 airspeed, requesting nearest VFR or lowest available altitude." (2)
- Crosschecks GPS altitude during climb -- expects ~6,000 GPS at 6,075 indicated. (2)
- Plans the descent into the destination with offsets applied at every assigned altitude. (2)
- Briefs that on the ground, the airplane goes to maintenance; static system requires inspection before next IFR flight. (2)

14/14 is the bar. Below 10 is a redo.

### Teaching exercise (CFI)

> An instrument-rating candidate, in their POH walk-through, can locate the alternate static valve in the C172 they are training in but cannot recite the offset values. Their answer when pressed is "I'd just look it up in the POH if I needed to."
>
> Write the in-lesson response. The candidate is right that the POH is authoritative; they are also wrong that "look it up" is a sufficient plan in IMC under stress.

Evaluation criteria:

- Acknowledges the POH is the authoritative source.
- Names the failure mode the candidate is implicitly accepting: in IMC, head-down with the POH while flying offset altimeter is exactly the workload they cannot afford.
- Resolves the contradiction: memorise the typical offset; commit a flashcard; have the POH page bookmarked or photographed for verification, but fly the offset from memory.
- Assigns the immediate exercise: candidate writes the C172 alternate-static offsets on a small card, tapes it to the bottom of their kneeboard, and recites them at the start of every instrument lesson for the next two weeks.
- Frames the broader lesson: emergency procedures with numbers (offsets, V-speeds, glide ratios, fuel planning) are memorise-the-numbers problems, not look-up problems. The POH is the source of truth; your memory is the access path under workload.

The pedagogical move is to treat the candidate's confidence in "I'd look it up" as a workload misunderstanding, not a knowledge gap. Fix it by changing the access path, not by drilling more.
