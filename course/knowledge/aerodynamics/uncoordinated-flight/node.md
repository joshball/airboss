---
# === Identity ===
id: aero-uncoordinated-flight
title: Uncoordinated Flight -- Slips and Skids
domain: aerodynamics
cross_domains:
  - procedures
  - safety-accident-analysis

# === Knowledge character ===
# perceptual: the ball off-center (left or right of the cage), the seat
#   pressure (sliding to one side), the audible "whoosh" of cross-controlled
#   air. Recognising uncoordinated flight is half a perception, half an
#   instrument check.
# conceptual: a slip is yawed away from the turn (extra rudder opposite
#   bank or insufficient rudder into bank), a skid is yawed into the turn
#   (excessive rudder into bank). Slips reduce stall risk; skids increase
#   it dangerously.
# procedural: the recovery is "step on the ball" -- apply rudder in the
#   direction the ball is displaced. The kill chain is the skidding turn
#   at low altitude, where stall snap-rolls into a spin entry.
knowledge_types:
  - perceptual
  - conceptual
  - procedural
technical_depth: working
stability: stable

# === Cert + study priority ===
minimum_cert: private
study_priority: critical
requires:
  - aero-coordination-rudder
  - aero-load-factor-and-bank-angle
  - aero-angle-of-attack-and-stall
deepens: []
applied_by: []
taught_by: []
related:
  - proc-stall-recovery
  - proc-traffic-pattern
  - proc-ground-reference-maneuvers

# === Content & delivery ===
modalities:
  - reading
  - cards
  - drill
estimated_time_minutes: 30
review_time_minutes: 5

# === References ===
references:
  - ref: airboss-ref:handbooks/phak
    redirected_from: airboss-ref:handbooks/phak/FAA-H-8083-25
    note: >-
      Authoritative on coordinated vs. uncoordinated turns, the inclinometer ball physics, and the difference between slip and skid.
  - ref: airboss-ref:handbooks/afh
    redirected_from: airboss-ref:handbooks/afh/FAA-H-8083-3
    note: >-
      Practical: how the airplane feels uncoordinated, how to recover, and the canonical accelerated-stall geometry that develops from a skid at low altitude.
  - source: AC 61-67C
    detail: Stall and Spin Awareness Training
    note: >-
      The advisory circular that establishes spin-awareness training and
      explicitly identifies the uncoordinated stall (especially the skidding
      turn) as the dominant mechanism for inadvertent spin entry.
  - source: AC 61-83K
    detail: Nationally Scheduled, Industry-Conducted, FAA-Approved Pilot Proficiency Programs (FIRC)
    note: >-
      Recurrent training emphasis on stall / spin awareness and the
      pattern-fatality data that anchors the urgency of coordination.

# === Assessment ===
assessable: true
assessment_methods:
  - recall
  - demonstration
  - scenario
mastery_criteria: >-
  Learner can: (1) describe what an inclinometer ball shows when the
  airplane is in a slip vs. a skid; (2) recover from each by "stepping
  on the ball"; (3) explain why a skidding turn at low altitude is the
  canonical fatal accident geometry (inside wing stalls first, snap-roll
  to spin entry); (4) name two legitimate uses of an intentional slip
  (forward slip for landing, side-slip for crosswind landing); (5) state
  the difference in stall behavior between coordinated, slipping, and
  skidding stalls.
---

# Uncoordinated Flight -- Slips and Skids

:::phase name="context"

A pilot tightens a base-to-final turn with right rudder. The wings are banked 30 degrees right; the rudder is pushed right. The ball slides to the left side of the cage. The airplane is now skidding -- yawed into the turn, wing low, nose pulled toward the runway by the rudder pressure rather than the bank.

The pilot does not notice. The ball is not what they are looking at. They are looking at the runway, trying to make the centerline.

The inside (right) wing now has a higher angle of attack than the outside wing. As the airplane decelerates on final, the right wing reaches stall AOA before the left wing. The right wing stops producing lift. The airplane snap-rolls right -- into the ground.

This is the canonical pattern fatality. NTSB statistics describe it under hundreds of accident reports per decade. The mechanism is exactly this: skidding turn, inside wing stall, no recovery altitude.

The instrument that would have caught it is one inch in diameter and called the inclinometer ball. The recovery technique is one phrase: step on the ball.

:::
:::phase name="problem"

You are flying a Cessna 172 in a 30-degree banked left turn at 65 KIAS, descending toward final. You notice the runway is to the right of where you wanted to roll out. Your instinct is to add right rudder to "swing the nose toward the runway."

What does the airplane do? What does the inclinometer show? Where does the inside wing's AOA go? What is your stall margin compared to a coordinated turn at the same airspeed? What is the recovery if a stall develops?

Write your answer before reading on.

:::
:::phase name="discover"

### Q1. What does the inclinometer ball actually show?

The inclinometer is a curved tube with a ball that moves under combined gravity and centrifugal acceleration. When the airplane is in a coordinated turn, the apparent gravity vector points straight "down" through the airplane (perpendicular to the wings); the ball stays centered.

When the airplane is uncoordinated:

- **Skid** -- the airplane is yawed into the turn (e.g., right rudder in a right turn). The horizontal component of lift is too small for the yaw rate, so the airplane is being thrown outward by centrifugal acceleration. The ball slides to the outside of the turn.
- **Slip** -- the airplane is yawed away from the turn (e.g., right rudder in a left turn, or insufficient right rudder in a right turn). The horizontal component of lift is too large for the yaw rate. The ball slides to the inside of the turn.

The recovery rule: **step on the ball**. If the ball is left, push left rudder. If the ball is right, push right rudder. The same direction the ball moved.

### Q2. What does it feel like?

In a slip, you feel pulled toward the high wing. The airflow becomes audibly turbulent (the side of the fuselage faces the slipstream). Drag increases noticeably -- which is why a forward slip is used to bleed altitude on final approach.

In a skid, you feel pushed toward the outside of the turn. The seat pressure is higher (you are being thrown out by centrifugal force). The airflow noise is also turbulent but in a different way. The airplane feels "heavy" and unresponsive.

The seat-of-the-pants feel is the early warning. The ball is the confirmation.

### Q3. What happens to AOA in each case?

In a coordinated turn, both wings produce equal lift (with a slight asymmetry from outside-wing-faster-than-inside-wing handled by the natural overbanking-tendency mechanism).

In a slip, the airplane is yawed away from the turn. The outside wing (high wing) faces more relative wind from below; its AOA is slightly higher. The inside wing (low wing) faces less; its AOA is slightly lower. If a stall develops, the outside wing stalls first -- and that wing is up, away from the ground, which means the airplane rolls away from the turn (toward wings level). Slipping stalls are recoverable.

In a skid, the airplane is yawed into the turn. The inside wing (low wing) faces more relative wind from below; its AOA is higher. The outside wing's AOA is lower. If a stall develops, the inside wing stalls first -- and that wing is down, toward the ground, so the airplane rolls into the turn, accelerating the descent. Skidding stalls roll into spins. They are not recoverable from low altitude.

This is the killer asymmetry. A slip is benign; a skid is fatal.

### Q4. What does Vs do in each case?

For coordinated flight, Vs (clean) ≈ 48 KIAS in a C172, scaling with sqrt(load factor) in a banked turn.

In a slip, the additional drag and the asymmetric lift distribution typically increase the effective stall speed slightly. A slipping stall happens at approximately the same indicated airspeed as a coordinated banked stall, sometimes slightly higher.

In a skid, the inside wing stalls at a lower indicated airspeed than the coordinated stall would predict, because the higher local AOA on the inside wing reaches critical AOA before the airplane's pitch attitude or airspeed indicates trouble. The stall happens "early" and asymmetrically.

The pilot looking at airspeed thinks they have margin. The airplane has none.

### Q5. What are legitimate uses of slips?

A **forward slip** is a deliberate large-angle slip used to lose altitude rapidly on final approach without gaining airspeed. Bank one direction; full opposite rudder. The airplane descends steeply with high drag. Use when high on final and unable to extend the approach (no flaps, gear-up emergency, terrain).

A **side-slip** is a smaller deliberate slip used to handle a crosswind on landing. The airplane is banked into the wind to counter drift while opposite rudder keeps the nose aligned with the runway centerline. Touchdown is on the upwind main first. See `perf-crosswind-component`.

Both are coordinated misuses of rudder for a deliberate purpose, with full pilot awareness of the slip condition. They are not the failure mode this node is about.

### Q6. What are illegitimate uses of skids?

There are essentially none. Some flight test work uses skids deliberately (e.g., demonstrating spin entry), but in normal flight a skid is always an error.

The most common skid scenarios:

- **Tightening a base-to-final overshoot with rudder** instead of with bank, because "I do not want to bank steeper at low altitude." The pilot trades a real (but small) accelerated-stall risk for a much larger skidding-stall risk.
- **Adding rudder in a steep turn** to maintain heading without increasing bank, when the airplane is overbanking due to instability.
- **Inadvertent rudder pressure in a climb** from torque or P-factor, where the pilot does not actively coordinate.
- **Cross-control in a stall** where the pilot, surprised by the stall, instinctively pulls back (worsening AOA) and applies opposite rudder (creating a skid in the new direction).

The fix is always the same: step on the ball, level the wings, reduce AOA.

### Q7. What does the kill chain look like?

The classic skidding-turn fatality:

1. Pilot is on base, sees they will overshoot final centerline.
2. Bank is already 20-30 degrees; pilot does not want to steepen.
3. Pilot adds rudder into the turn (right rudder in a right turn) to "tighten."
4. The ball slides to the outside (left, in a right turn).
5. The inside wing's AOA increases.
6. Pilot pulls back to maintain altitude (because the airplane wants to descend in the skid).
7. Inside wing reaches critical AOA at an airspeed well above book Vs.
8. Inside wing stalls; airplane snap-rolls into the turn (right roll in a right turn).
9. Nose drops; airplane enters a spin entry geometry (uncoordinated, AOA above critical, autorotation).
10. Pilot has 200-400 feet of altitude. No recovery.

This is not theoretical. This is the most common pattern fatality. The instrument that would have caught it is the inclinometer ball. The technique that would have prevented it is "if you are overshooting, GO AROUND -- do not tighten with rudder."

### What Discover should have led you to

- The inclinometer ball is the primary indicator of coordination. Step on the ball to recover.
- Slip = yawed away from turn = outside wing higher AOA = stalls outside first = recoverable.
- Skid = yawed into turn = inside wing higher AOA = stalls inside first = snap-rolls to spin.
- Slipping stalls are benign; skidding stalls at low altitude are fatal.
- Skidding-turn-at-low-altitude is the dominant pattern fatality mechanism.
- Forward slip and side-slip are legitimate intentional uses of cross-control.

:::
:::phase name="reveal"

### The summary rule

> Coordinated flight keeps the inclinometer ball centered. Uncoordinated flight either slips (ball to inside of turn -- yawed away from the turn -- outside wing reaches critical AOA first; benign) or skids (ball to outside of turn -- yawed into the turn -- inside wing reaches critical AOA first; snap-rolls into spin entry). Recover from either by stepping on the ball -- apply rudder in the direction the ball is displaced. The dominant pattern fatality is the skidding-turn stall on base-to-final: pilot adds rudder to tighten an overshoot, inside wing stalls early, airplane snap-rolls into the turn at 200-400 AGL with no recovery margin. The fix is to GO AROUND when overshooting; never tighten the turn with rudder at low altitude.

### Slip vs. skid summary

| Condition   | Yaw direction     | Ball position       | Inside-wing AOA | Stall outcome                                              |
| ----------- | ----------------- | ------------------- | --------------- | ---------------------------------------------------------- |
| Coordinated | Aligned with turn | Centered            | Equal           | Wings-level stall, recoverable                             |
| Slip        | Away from turn    | Inside (low side)   | Lower           | Outside wing stalls first; rolls toward level              |
| Skid        | Into turn         | Outside (high side) | Higher          | Inside wing stalls first; snap-rolls into turn; spin entry |

### The recovery rule

```text
Ball off-center to the LEFT  -> push LEFT rudder until centered
Ball off-center to the RIGHT -> push RIGHT rudder until centered
```

Mnemonic: **step on the ball**.

### The kill-chain summary

```text
Overshoot base-to-final
    |
    v
Add rudder to tighten (rather than bank)
    |
    v
Skid develops (ball to outside)
    |
    v
Inside wing AOA climbs
    |
    v
Pilot pulls back to maintain altitude
    |
    v
Inside wing reaches critical AOA at high airspeed
    |
    v
Inside wing stalls; airplane snap-rolls into turn
    |
    v
Spin entry geometry, 200-400 AGL
    |
    v
No recovery
```

The fix is to break the chain at step 2: never use rudder to tighten a low-altitude turn. If you are overshooting, GO AROUND.

### The legitimate slips

| Maneuver     | Purpose                                         | Cross-control direction              |
| ------------ | ----------------------------------------------- | ------------------------------------ |
| Forward slip | Lose altitude on final without gaining airspeed | Bank one way, opposite rudder full   |
| Side-slip    | Crosswind landing -- track centerline aligned   | Bank into wind, opposite rudder mild |

Skids have no legitimate use in normal flight.

### What is actually authoritative

In descending order:

1. **AC 61-67C** -- Stall and Spin Awareness; the canonical document on uncoordinated stall behavior.
2. **AFH "Maintaining Aircraft Control"** -- recovery procedures and the skid-stall demonstration.
3. **PHAK Aerodynamics of Flight** -- the inclinometer physics and the slip / skid distinction.
4. **POH** -- airplane-specific stall behavior and any spin-recovery procedures (often "intentional spins prohibited" for normal-category trainers).

:::
:::phase name="practice"

### Cards (spaced memory items)

- `card:uc-ball-recovery` -- "Recovery from any uncoordinated turn?" -> "Step on the ball -- apply rudder in the direction the ball is displaced."
- `card:uc-slip-def` -- "What is a slip?" -> "Airplane yawed away from the turn; ball to inside (low side) of cage."
- `card:uc-skid-def` -- "What is a skid?" -> "Airplane yawed into the turn; ball to outside (high side) of cage."
- `card:uc-skid-stall-asymm` -- "Why is a skidding stall fatal at low altitude?" -> "Inside wing reaches critical AOA first, airplane snap-rolls into the turn, spin entry geometry, no recovery margin."
- `card:uc-slip-stall-asymm` -- "Why is a slipping stall benign?" -> "Outside (high) wing stalls first, airplane rolls toward wings-level."
- `card:uc-overshoot-rule` -- "If overshooting base-to-final, what is the action?" -> "GO AROUND. Do not tighten the turn with rudder."
- `card:uc-forward-slip` -- "What is a forward slip used for?" -> "Lose altitude on final without gaining airspeed; high-drag descent."
- `card:uc-side-slip` -- "What is a side-slip used for?" -> "Crosswind landing -- bank into wind, opposite rudder, fuselage aligned with centerline."

### Reps (scenario IDs)

- `scenario:uc-skid-detection` -- pilot in a base turn notices ball off-center; identifies as skid; recovers by stepping on the ball.
- `scenario:uc-overshoot-decision` -- pilot overshooting final; decides between bank-steepen and go-around; verbalises why rudder-tighten is excluded.
- `scenario:uc-forward-slip-final` -- pilot high on final approach; demonstrates a forward slip to lose altitude; recovers to coordinated short of touchdown.
- `scenario:uc-crosswind-landing` -- pilot demonstrates side-slip in 12-knot crosswind; touches down on upwind main first with fuselage aligned.
- `scenario:uc-stall-with-skid` -- pilot inadvertently in a skid as airspeed bleeds in a steep turn; recognises the cue early and recovers by leveling and reducing AOA.

### Drills (time-pressured)

- `drill:uc-ball-call` -- CFI displaces the ball with rudder; pilot calls "ball left, step left rudder" within 2 seconds.
- `drill:uc-coord-hold` -- pilot maintains ball-center for a full 360-degree turn at 30 bank without prompting.
- `drill:uc-slip-on-call` -- CFI calls "forward slip"; pilot enters and exits a slip cleanly.
- `drill:uc-overshoot-call` -- CFI says "you are overshooting"; pilot answers "go around" reflexively, not "tighten."

:::
:::phase name="connect"

### What changes if...

- **...you are at altitude (3,000+ AGL)?** A skidding stall is still asymmetric, but the recovery altitude is enough to recover. The training value of demonstrating skidding-stall behavior at altitude is high; do it under controlled conditions with a CFI.
- **...you are at 800 AGL doing turns around a point?** A skidding stall here is unrecoverable. Coordination is non-negotiable. Watch the ball every cycle.
- **...you are doing a forward slip to landing?** This is a legitimate cross-control. Be sure the airplane is not in a configuration where the slip is prohibited (some POHs prohibit slips with full flaps -- check yours).
- **...you are in a crosswind landing?** The side-slip is the standard technique in light singles. Some pilots prefer crab-then-kick at the flare. Either is fine; the prohibition is on uncoordinated flight that the pilot does not know about.
- **...you are demonstrating to a student?** The verbal pattern is "ball, ball, ball" during turns. Force the student to look at the ball every time you talk. Build the habit before they leave the airport without you.
- **...you are flying a twin?** Engine-out asymmetric thrust requires rudder to keep the airplane straight; the ball is no longer the sole indicator of coordination. Vmc demonstrations are a dedicated training topic; see twin-specific training material.

### Links

- `aero-coordination-rudder` -- the foundational coordination concept.
- `aero-load-factor-and-bank-angle` -- the load-factor side of the steep-turn / accelerated-stall geometry.
- `aero-angle-of-attack-and-stall` -- the AOA basis for the skidding-wing stall.
- `proc-stall-recovery` -- the recovery procedure that handles uncoordinated stalls.
- `proc-traffic-pattern` -- where the kill chain develops.
- `proc-ground-reference-maneuvers` -- low-altitude maneuvering where coordination matters most.
- `perf-crosswind-component` -- the legitimate side-slip use case.

:::
:::phase name="verify"

### Novel scenario (narrative)

> You are on a left base at 800 AGL, 70 KIAS, descending toward final. As you turn final, you notice the runway is going to be off to your right -- you are going to overshoot the centerline by maybe 100 feet. The CFI is silent. You have three options: increase bank, add right rudder to "swing the nose," or go around. Which do you choose, why, and what is the consequence of each?

Scoring rubric:

- Identifies the correct choice as GO AROUND, given a 100-foot overshoot at 800 AGL on base-to-final. (2)
- Explains why "add right rudder to swing the nose" is excluded: that creates a skid, increases inside-wing AOA, the kill chain. (3)
- Acknowledges that "increase bank" is technically valid but warns against banking past 30 degrees at low altitude due to accelerated-stall margin loss; if shallow re-correction does not work, go around. (2)
- States that "I do not want to make a big deal of an overshoot" is not a valid reason to skid. The cost of a go-around is one pattern circuit; the cost of a skid-stall is the airplane. (2)
- Verbalises the broader rule: at pattern altitude, the answer to "should I skid?" is always no. (1)
- Notes that the CFI's silence is a teaching choice: the pilot must self-correct. (1)

11/11 is the bar. Below 8 is a redo.

### Teaching exercise (CFI)

> A student demonstrates clean coordinated turns at altitude but is consistently uncoordinated in pattern turns at lower altitudes. Specifically: in a left base turning to final, you see right rudder pressure on the pedals (a skid). Diagnose using the slip / skid framework and write the post-flight teaching point.

Evaluation criteria:

- Diagnosis: the student is using rudder to tighten the turn at low altitude when overshooting. The habit is invisible to them at altitude (where the cue is masked by available recovery margin) but is the canonical kill chain at pattern altitude.
- Teaching point: this is not a comfort issue. This is a "will it kill me" issue. The student adjusts their behavior or they do not pass the checkride.
- Drill: at altitude, demonstrate a skidding stall with the student. Have them feel the snap-roll. The visceral memory of the inside-wing stall is the deterrent that intellectual understanding alone does not produce.
- At pattern altitude on the next flight: any rudder pressure that is not coordinating adverse yaw triggers an immediate go-around call. Do not let the student fly the skid through to landing.
- Reframe the overshoot situation: an overshoot is information. It tells you where to start the next pattern turn. It is not a failure to be hidden by skidding; it is data to use.
- The CFII is direct: most pattern fatalities are skidding stalls. NTSB reports describe exactly the geometry the student is practicing. Fix it now or do not solo.

The pedagogical move is to convert the abstract "skidding is bad" into a felt experience (the demo at altitude) and a behavioral non-negotiable (go around at the first sign of overshoot at pattern altitude). Both are needed.

:::