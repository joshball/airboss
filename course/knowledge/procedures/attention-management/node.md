---
# === Identity ===
id: proc-attention-management
title: Attention Management and Situational Awareness
domain: adm-human-factors
cross_domains:
  - procedures
  - safety-accident-analysis

# === Knowledge character ===
# perceptual: SA is built from a continuous scan -- aircraft state, ground
#   track, traffic, fuel, time, weather. The pilot who lets one channel
#   drown out the others loses the picture.
# judgment: task prioritization in flight is "aviate, navigate, communicate."
#   Distractions push everything one slot down the priority list. Knowing
#   when to drop the radio (or the GPS, or the passenger conversation) to
#   keep aviating is the survival skill.
# procedural: there are scan disciplines (the PHAK / AFH SRM model, the
#   3P model) that turn attention management from a trait into a trained habit.
knowledge_types:
  - perceptual
  - judgment
  - procedural
technical_depth: working
stability: stable

# === Cert + study priority ===
minimum_cert: private
study_priority: critical
requires:
  - aero-four-forces
deepens: []
applied_by: []
taught_by: []
related:
  - proc-adm-hazardous-attitudes
  - proc-spatial-disorientation
  - proc-traffic-pattern

# === Content & delivery ===
modalities:
  - reading
  - cards
  - reps
estimated_time_minutes: 35
review_time_minutes: 6

# === References ===
references:
  - ref: airboss-ref:handbooks/risk-management
    redirected_from: airboss-ref:handbooks/risk-management/FAA-H-8083-2
    note: >-
      The SRM model (situational awareness, automation management, task management, aeronautical decision-making, controlled flight into terrain awareness, risk management). Task management is the chapter most directly relevant to division-of-attention failures during maneuvering.
  - ref: airboss-ref:handbooks/phak
    redirected_from: airboss-ref:handbooks/phak/FAA-H-8083-25
    note: >-
      Defines SA as the accurate perception of the operational and environmental factors that affect the aircraft, the pilot, and passengers during a specified period of time.
  - ref: airboss-ref:handbooks/afh
    redirected_from: airboss-ref:handbooks/afh/FAA-H-8083-3
    note: >-
      Practical: the AFH chapters on steep turns and ground reference maneuvers explicitly call out division of attention as the checkride-grading concept the maneuver is designed to test.
  - source: AC 60-22
    detail: Aeronautical Decision Making
    note: >-
      The DECIDE model and the broader ADM framework that names
      task-saturation and channelized attention as the precursors to
      most maneuvering accidents.

# === Assessment ===
assessable: true
assessment_methods:
  - scenario
  - recall
mastery_criteria: >-
  Learner can: (1) state the aviate-navigate-communicate priority and
  apply it to a distraction scenario; (2) define situational awareness
  in operational terms (what + where + when + so what); (3) name three
  loss-of-SA cues (fixation on one instrument, missing a checklist item,
  losing track of altitude or heading during a maneuver); (4) describe
  the scan discipline they use to maintain SA during steep turns and
  ground reference maneuvers; (5) recognise when task saturation is
  building and name one concrete reduction action (slow down, climb,
  exit the maneuver, ask ATC to stand by).
---

# Attention Management and Situational Awareness

:::phase name="context"

A private pilot enters a 45-degree banked steep turn at 3,500 MSL, 100 KIAS. Sixty degrees through the turn, the CFI asks "what's our heading now?" The pilot looks at the heading indicator, then realises they have rolled out to 30 degrees of bank, lost 200 feet, and have no idea where the practice area boundary is.

Nothing about the airplane has failed. The wing is producing lift. The engine is running. The GPS knows exactly where the airplane is. The pilot lost the picture because their attention collapsed onto one cue -- the bank-angle indicator, or the airspeed needle, or the ground rushing past the wingtip -- and the rest of the picture went dark.

This is the failure mode the ACS Area V is designed to expose. Steep turns and ground reference maneuvers are not interesting because they are aerodynamically novel. They are interesting because they force the pilot to keep four or five channels open at once: bank angle, altitude, airspeed, ground track, and traffic. A pilot who can only run one channel at a time will fail Area V no matter how clean their stick-and-rudder skills are.

:::
:::phase name="problem"

You are practising turns around a point at 800 feet AGL with a 15-knot wind from the west. You have rolled in to a 30-degree bank on the upwind side. The CFI tells you, mid-maneuver, that there is a glider tow plane departing the field 1.5 NM north of your position. Their position relative to your turn changes throughout your 360.

What channels are you running right now? Which one is most likely to drop first? What is your concrete plan if you lose two of them at once?

Write your answer before reading on. Then ask: how does your scan change between the upwind side of the turn (where groundspeed is lowest and bank shallowest) and the downwind side (where groundspeed is highest and bank steepest)?

:::
:::phase name="discover"

### Q1. What does "division of attention" actually mean?

It does not mean "thinking about two things at once." Human cognition is largely serial. What pilots actually do is rapidly switch attention between channels, building a composite mental picture from samples taken a few seconds apart.

The skill is the speed and discipline of the switch, not parallel processing. A pilot with good attention management samples bank, altitude, airspeed, and outside-the-window every two to three seconds, and updates the mental picture continuously. A pilot with poor attention management gets stuck on one channel (usually the one that just surprised them) and stops sampling the rest.

### Q2. What does "situational awareness" mean operationally?

PHAK defines SA as the accurate perception of operational and environmental factors. In the cockpit, that's a four-part question you should be able to answer at any moment:

- **What** is the airplane doing right now? (attitude, airspeed, altitude, configuration)
- **Where** is it? (ground position, airspace, terrain, traffic)
- **When** does the next thing happen? (waypoint, descent point, fuel reserve, tower handoff)
- **So what** does this mean? (am I on plan, ahead of plan, behind plan? do I need to act?)

If you cannot answer all four, you have lost SA. The recovery is to slow the airplane down (literally or by climbing), regain each channel one at a time, and only then resume the maneuver.

### Q3. What is the priority order when attention fragments?

The classical FAA priority is **aviate, navigate, communicate**.

- Aviate: keep the airplane right-side-up at a safe airspeed and altitude.
- Navigate: know where you are and where you are going.
- Communicate: talk to ATC or report your position.

When something demands attention you did not budget for (a passenger question, a radio call, an unexpected traffic call), everything below "aviate" drops one slot. Communicate drops first. If the load grows, navigate drops next. Aviate is the last thing you give up, and you give it up only when the airplane has been parked.

The graveyard rule: pilots who flew into terrain while talking to ATC inverted this priority. They moved "communicate" above "aviate" because the radio was loud and the airplane was quiet. The airplane was always going to win that argument.

### Q4. What does loss of SA feel like?

There is a recognisable sensation. Pilots who have experienced it describe it the same way:

- A sudden quiet, where one channel (often the radio or the GPS) drowns out the others.
- The realisation, two or three seconds late, that you do not know your altitude or heading.
- An unfamiliar view out the window (you flew through your turn point, you are off course).
- A "where am I?" pause before any action.

The earliest cue is usually that you stopped scanning. Your eyes are fixed on one instrument (or one ground feature, or one piece of paper). The fix is to look up, look out, and reset the scan.

### Q5. What does task saturation look like?

Task saturation is the state where new tasks arrive faster than you can complete them. The queue grows. Items get dropped silently. The pilot has no spare capacity to notice which items got dropped.

Symptoms:

- Slowed speech (you are hesitating before each radio call).
- Missed radio calls or "say again" requests.
- Letting the airplane drift outside tolerances without noticing.
- Tunnel vision -- only looking at one instrument.
- Irritation at requests ("can you stand by, I'm busy").
- Rising heart rate, dry mouth, the awareness that you are gripping the yoke harder than you need to.

The fix is to shed tasks. The order is the priority order in reverse: shed communicate, shed navigate (lean on the autopilot or hold a heading), keep aviating. If you cannot shed tasks fast enough, exit the maneuver -- climb, stop the turn, declare what you need ("Cessna 12345 needs a few minutes, holding present position").

### Q6. What scan discipline does Area V demand?

In a steep turn, the scan is roughly:

```text
bank -> altitude -> airspeed -> outside-for-traffic -> back to bank

(every 2-3 seconds, continuously, for the full 360)
```

The "outside-for-traffic" sample is non-negotiable. The maneuver area is shared with other pilots practising the same maneuver. A 360-degree turn covers a lot of sky; the airplane next to you is moving through your future flight path.

In ground reference maneuvers, add ground track to the scan and reduce the inside-the-cockpit time:

```text
ground-track -> bank -> altitude -> outside-for-traffic -> ground-track

(more outside time than steep turn; the maneuver is FOR the outside picture)
```

A pilot who fixes on the airspeed indicator during turns around a point will lose the ground track first. A pilot who fixes on the ground track will lose altitude. Neither failure is acceptable. The discipline is the rotation, not the dwell.

### Q7. What do the early-warning internal cues sound like?

Self-talk clues that you are about to lose the picture:

- "I'll get the altitude back in a minute" (you have already lost the picture).
- "Just one more glance at the GPS" (you are about to fly through the turn point).
- "Did I roll out on heading?" (you stopped scanning bank).
- "Wait, where's the road?" (you lost the ground reference).
- "What was the wind direction again?" (you stopped reading the picture).

Each of these is a flag. The action is to roll wings level, climb if low, exit the maneuver, breathe, restart with a clean scan.

### What Discover should have led you to

- Division of attention is rotation, not parallel processing. Speed and discipline of the switch is the skill.
- SA answers four questions: what, where, when, so what. If any goes blank, you have lost it.
- Aviate, navigate, communicate is the priority. Drop from the bottom.
- Task saturation is the failure mode where the queue overflows silently.
- The scan in a steep turn is bank-altitude-airspeed-outside, every 2-3 seconds.
- The scan in a ground reference maneuver weights the outside picture more heavily.
- The internal voice clue is the early warning. Listen for it.

:::
:::phase name="reveal"

### The summary rule

> Attention management is rotating your scan fast enough to keep the operational picture (what / where / when / so what) intact while still flying the maneuver. The priority when load exceeds capacity is aviate-navigate-communicate -- you shed from the bottom. The earliest warning of trouble is your scan slowing or fixating; the corrective action is to look up, look out, and reset. In Area V, the scan tempo is roughly two-to-three seconds per channel, with traffic-out-the-window non-negotiable on every cycle. When task saturation builds, exit the maneuver before the airplane fixes the problem for you.

### The four SA questions

Memorise these. They are your in-flight self-test:

1. **What** is the airplane doing? (pitch, bank, airspeed, altitude, configuration)
2. **Where** is it? (ground position, airspace boundary, traffic around me, terrain)
3. **When** does the next thing happen? (next waypoint, fuel update, descent, frequency change)
4. **So what** does it mean? (am I on plan, behind, ahead? do I need to act?)

Cannot answer one? Pause the maneuver and rebuild.

### The priority order

```text
1. AVIATE     -- keep the airplane right-side-up, in tolerances
2. NAVIGATE   -- know where you are, where you are going
3. COMMUNICATE -- talk on the radio, listen for traffic
```

Drop bottom-up. Never top-down.

### Scan tempo for Area V

| Maneuver              | Channels                                          | Tempo per channel |
| --------------------- | ------------------------------------------------- | ----------------- |
| Steep turn            | bank, altitude, airspeed, outside-for-traffic     | 2-3 seconds       |
| Rectangular course    | ground-track, bank, altitude, outside-for-traffic | 2-3 seconds       |
| Turns around a point  | ground-track (radius), bank, altitude, outside    | 2-3 seconds       |
| S-turns across a road | ground-track (line), bank, altitude, outside      | 2-3 seconds       |

The "outside-for-traffic" channel is on every cycle, no exceptions. See `proc-collision-avoidance`.

### Task-saturation triage

When you feel saturation building, in order:

1. **Recognise** -- name it out loud. "I am getting saturated."
2. **Aviate first** -- wings level, established altitude, established airspeed.
3. **Shed comms** -- "Cessna 12345 standby" or "unable" on the next request.
4. **Shed nav load** -- hold a heading, simplify the route, climb if low.
5. **Exit the maneuver** if you cannot reduce load fast enough.
6. **Rebuild SA** -- answer the four questions one at a time.
7. **Resume** when you have all four.

### What is actually authoritative

In descending order:

1. **FAA-H-8083-2 (Risk Management Handbook)** -- SRM, task management, distraction handling.
2. **FAA-H-8083-25 (PHAK)** -- ADM and SA chapters.
3. **AC 60-22** -- the canonical ADM advisory circular.
4. **AC 90-66C** -- non-towered operations (incorporates much of the practical SA guidance for pattern flying).

:::
:::phase name="practice"

### Cards (spaced memory items)

- `card:atn-priority` -- "What is the in-flight priority order?" -> "Aviate, navigate, communicate."
- `card:atn-sa-four` -- "What four questions define SA?" -> "What, where, when, so what."
- `card:atn-shed-order` -- "Which task drops first when you saturate?" -> "Communicate. Then navigate. Aviate is last."
- `card:atn-scan-tempo` -- "Scan tempo per channel during a steep turn?" -> "2-3 seconds, including outside-for-traffic on every cycle."
- `card:atn-saturation-cue` -- "Three cues that you are task-saturated?" -> "Slowed speech, missed radio calls, tunnel vision on one instrument."
- `card:atn-fixation-fix` -- "If you notice you have stopped scanning, what is the recovery?" -> "Look up, look out, reset the rotation."

### Reps (scenario IDs)

- `scenario:atn-steep-turn-distraction` -- mid-maneuver, CFI asks for a frequency change. Pilot must aviate while shedding the comm load.
- `scenario:atn-grm-traffic-call` -- during turns around a point, ATC reports traffic 12 o'clock 1 mile. Pilot must integrate the call without dropping ground track or altitude.
- `scenario:atn-saturation-pattern` -- pattern entry with two radio calls, gear/flap config, and a wind shift. Pilot recognises saturation and shed-communicates.
- `scenario:atn-loss-of-sa-recovery` -- pilot rolls out of a steep turn 90 degrees off heading and 200 feet low. Diagnose what they stopped sampling.

### Drills (time-pressured)

- `drill:atn-four-questions` -- CFI says "freeze." Pilot must answer the four SA questions in 5 seconds.
- `drill:atn-priority-call` -- CFI fires three simultaneous demands. Pilot must verbalise the priority order they will execute in.
- `drill:atn-scan-call` -- during a steep turn, CFI watches the pilot's eyes. Pilot must demonstrate the rotation continuously for the full 360.

:::
:::phase name="connect"

### What changes if...

- **...you are flying solo without a CFI prompting you?** The internal voice replaces the prompt. You must self-prompt the four SA questions every 30-60 seconds in cruise, every 5-10 seconds in maneuvering. Self-talk is not silly; it is the discipline.
- **...you are in IFR / IMC?** SA collapses faster because the outside picture is gone. Add the instrument cross-check (`proc-instrument-cross-check`) on top of the four SA questions. Spatial disorientation (`proc-spatial-disorientation`) becomes a primary failure mode.
- **...you are in the pattern?** The scan adds traffic, runway, sequencing. The aviate-navigate-communicate priority gets tested every approach because the radio gets busy at exactly the moment the airplane needs the most attention.
- **...you have a passenger who is talking?** Passenger management is part of single-pilot resource management. Brief them pre-flight: "If I am quiet, do not talk to me. I will tell you when I am free." A good passenger is silent when the pilot is silent.
- **...you are using autopilot?** Autopilot reduces aviate workload, frees attention for navigate and communicate. But it can also produce automation complacency: pilot stops monitoring the panel because "the autopilot is flying it." See FAA SRM chapter on automation management.
- **...you are teaching?** Watch the student's eyes more than the panel. Where they fix is what they are losing. A student who stares at the heading indicator during a steep turn will not see the bank angle drift. The teaching point is the rotation itself, not the values they hit.

### Links

- `proc-spatial-disorientation` -- the perceptual failure mode that compounds attention failure in IMC.
- `proc-adm-hazardous-attitudes` -- five attitudes (anti-authority, impulsivity, invulnerability, macho, resignation) that bias attention away from threats.
- `proc-collision-avoidance` -- the outside-for-traffic channel that must remain in every scan cycle.
- `proc-traffic-pattern` -- where attention discipline is tested under real traffic load.
- `proc-instrument-cross-check` -- the IFR analog of the VFR scan rotation.
- `aero-load-factor-and-bank-angle` -- the maneuver that fragments attention is the same maneuver that punishes attention failure aerodynamically.

:::
:::phase name="verify"

### Novel scenario (narrative)

> You are doing turns around a point at 900 AGL over a road intersection in a Cessna 172. The wind is 280 at 15 knots. You are 270 degrees into your second turn when the unicom call breaks: "Citation 5JK, 5 mile final, full stop." You are inside the airport's class-G area and the Citation is on a base leg toward the same field. Diagnose the load on your attention right now and your action plan.

Scoring rubric:

- Identifies the channels currently active: ground track (turn radius), bank, altitude, airspeed, outside-for-traffic, radio. (3)
- Names the new demand from the unicom: spatial picture of the Citation relative to your position; possible conflict resolution. (2)
- States the priority order: aviate first (hold the turn or roll out wings-level if you need to think), then navigate (find the Citation visually or on traffic), then communicate (radio call if needed). (3)
- Recognises that task load just spiked and offers a shed action: roll out wings-level, climb to pattern altitude, announce position on CTAF, look for the Citation. (2)
- Notes that exiting the maneuver is acceptable; the maneuver does not have to be completed when traffic intervenes. (2)
- Resets SA after the conflict is resolved: re-establishes the four SA questions before re-entering the turn (or skips re-entry if comfort is gone). (1)

13/13 is the bar. Below 9 is a redo.

### Teaching exercise (CFI)

> A student demonstrates good steep turns at altitude when the cockpit is quiet. The moment you key the mic to ask a question, they lose 100 feet, drift 10 degrees off bank, and stare at the altimeter trying to recover. Diagnose the failure mode and write the post-flight teaching point.

Evaluation criteria:

- Diagnosis: the student is single-channel. They can run the maneuver scan when undisturbed but cannot integrate a new task.
- The teaching point is not "fly steeper turns." It is "build the habit of treating the comm channel as additive, not substitutive."
- Drill: have the student call out their bank angle and altitude every 5 seconds during the turn while you ask non-flight questions ("what's your favorite movie?"). The verbalisation forces the rotation to keep running.
- Progression: once they can do that, add real cockpit tasks (changing frequencies, looking up airport info) during the turn.
- The CFI is patient but firm: this is the difference between flying the airplane and flying the airplane in the real world. The checkride examiner will deliberately distract them.

The pedagogical move is to make distraction the practice, not the obstacle. The student who only practices in silence will never be ready for the cockpit they actually fly in.

:::