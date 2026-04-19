# Instrument Scan Exercise Scenarios

Scenario catalog for the instrument scan activity type. Each scenario defines instruments, student behavior, task, and gorilla. See [spec.md](spec.md) for the engine, UI, and interaction model.

**Naming:** ISE-{module}.{number} (Instrument Scan Exercise)

---

## Module 1 Scenarios (A.1: Automation & Modern Cockpit)

These exercises demonstrate that even experienced CFIs miss critical instrument changes when task-loaded. They set up the entire module's argument about automation, attention, and the limits of human scan.

### ISE-1.1: The Classic (Airspeed Decay)

**The gorilla:** Airspeed decays from 110 to 84 knots over 90 seconds.
**The task:** Evaluate student's instrument scan pattern. Identify skipped instruments.
**Student scan skips:** Airspeed and VSI (correct answer to the task).

| Parameter | Value |
| --- | --- |
| Duration | 90s |
| Difficulty | 0.5 (medium) |
| Phase of flight | VFR cruise, 4,500 ft |
| Gorilla parameter | Airspeed |
| Decay rate | ~0.3 kts/s |
| Critical threshold | 85 kts (Vs1 + 5) |
| Student verbal cues | None |
| Student responsiveness | 0.6 |

**Why this is the first exercise in the course:** It establishes the interaction model (note keys, intervention ladder, activity log) while delivering a genuine cognitive demonstration. The learner thinks they're learning how the UI works. They're actually learning about their own attention limits.

**Irony factor:** The student's scan skip (airspeed) is the correct answer to the task AND the gorilla. The learner correctly diagnoses "the student isn't watching airspeed" while also not watching airspeed.

---

### ISE-1.2: The Heading Drift

**The gorilla:** Heading drifts from 270 to 248 over 90 seconds.
**The task:** Monitor your student's altitude maintenance during a VFR cruise. Note any altitude deviations.
**Student scan pattern:** Normal (covers all instruments but lingers on attitude).

| Parameter | Value |
| --- | --- |
| Duration | 90s |
| Difficulty | 0.5 |
| Phase of flight | VFR cruise, 5,500 ft |
| Gorilla parameter | Heading |
| Drift rate | ~0.25 deg/s |
| Critical threshold | 250 (20+ degrees off course) |
| Student verbal cues | None |
| Student responsiveness | 0.7 |
| Altitude behavior | Stable with minor fluctuation (+/- 30 ft) |

**Why this works:** The task (monitor altitude) focuses attention on the altimeter and VSI. Altitude is actually fine. Heading is drifting. The student's scan covers the heading indicator, but neither the student nor the CFI notices the trend because the task primes altitude awareness.

**Teaching point:** Fixation on the expected problem (altitude) blinds you to the actual problem (heading). This is exactly what happens to students fixated on the GPS track line.

---

### ISE-1.3: The Subtle Pitch-Up

**The gorilla:** Pitch increases from 2 to 8 degrees nose-up over 120 seconds. Airspeed decays as a consequence (110 -> 92). Altitude initially climbs slightly then levels as speed bleeds.
**The task:** Your student is practicing radio communications. Evaluate whether their scan degrades during radio calls. Note scan changes during each radio exchange.
**Student scan pattern:** Normal between calls, degraded during calls (fixates on nothing / freezes).

| Parameter | Value |
| --- | --- |
| Duration | 120s |
| Difficulty | 0.6 |
| Phase of flight | VFR cruise, 4,500 ft, practice area |
| Gorilla parameter | Attitude (pitch) |
| Change rate | ~0.05 deg/s |
| Critical threshold | 7 degrees nose-up |
| Student verbal cues | Asks "does that sound right?" after radio calls |
| Student responsiveness | 0.8 (responsive to guidance) |
| Radio calls | 3 calls during exercise (ATC position reports) |

**Why this is harder:** Two distractors (evaluating scan + radio content). The pitch change is very slow. The airspeed decay is a secondary effect of the pitch, so the learner might catch airspeed but miss the root cause (attitude). Multi-causal chain mirrors real accident sequences.

**Teaching point:** Radio communication is one of the highest-workload phases for students. The CFI's attention goes to the radios too. Meanwhile, the airplane is still flying.

---

### ISE-1.4: The Glass Cockpit Attention Trap (G1000 variant)

**The gorilla:** Engine oil temperature creeping into yellow arc on MFD engine page (visible in the corner of the display).
**The task:** Your student is setting up a GPS approach. Verify they load the correct approach, transition, and activate it properly. Note each step.
**Student behavior:** Mostly correct but makes one fixable error in the sequence.

| Parameter | Value |
| --- | --- |
| Duration | 120s |
| Difficulty | 0.7 |
| Phase of flight | IFR, 20 miles from destination, approach setup |
| Panel type | G1000 (PFD + MFD) |
| Gorilla parameter | Oil temp (MFD engine page) |
| Critical threshold | Top of yellow arc |
| Student verbal cues | None (focused on approach loading) |
| Student responsiveness | 0.6 |

**Note:** This is a future variant. Requires G1000 renderer. Included here for completeness and to show the exercise type extends to glass cockpits.

**Teaching point:** In a glass cockpit, the approach setup procedure is so absorbing that both student and instructor fixate on the MFD. The engine display is right there -- same screen -- but attention is elsewhere. This is the A.1 argument in its purest form.

---

## Module 3 Scenarios (A.11: Loss of Control)

These exercises shift from "did you notice?" to "did you notice in time to prevent an accident?" The gorilla is now a developing LOC situation.

### ISE-3.1: Base-to-Final Bank Angle

**The gorilla:** Bank angle increases from 20 to 45 degrees during a turn from base to final. Airspeed decays. Load factor increases. Stall speed increases with bank.
**The task:** Your student is practicing radio calls in the pattern. Evaluate their radio technique (callout timing, content, frequency management). Note each call quality.
**Student scan pattern:** Alternates between looking outside (no instruments highlighted) and brief instrument checks. During the turn, scan stops entirely (looking for runway).

| Parameter | Value |
| --- | --- |
| Duration | 60s |
| Difficulty | 0.7 |
| Phase of flight | Traffic pattern, turning base to final, 1,000 ft AGL |
| Gorilla parameter | Bank angle (attitude indicator) |
| Change rate | 0.5 deg/s during turn (starts at 20s mark) |
| Critical threshold | 40 degrees bank (load factor > 1.3g, Vs1 increases ~15%) |
| Airspeed | 95 -> 82 during turn (follows bank increase) |
| Student verbal cues | "I see the runway" at 30s |
| Student responsiveness | 0.5 (target fixation on runway) |

**Why this matters:** The base-to-final stall-spin is the #1 fatal GA maneuver accident. The bank angle creeps up because the student is fixated on the runway. The CFI is evaluating radio work. This is exactly the scenario chain that kills people.

**Connection to tick engine:** SCN 3.1 (base-to-final) in Module 3 is a tick-engine scenario covering the same accident chain. ISE-3.1 demonstrates it from the "how did it start?" angle. The tick scenario picks up where this one ends.

---

### ISE-3.2: Departure Stall Setup

**The gorilla:** After takeoff, pitch attitude is too high (student over-rotated). Airspeed builds slowly instead of normally. The climb looks fine on the altimeter (still climbing) but the energy state is deteriorating.
**The task:** Your student just took off. Monitor their departure procedure: flap retraction timing, altitude callouts, and heading. Note each step.

| Parameter | Value |
| --- | --- |
| Duration | 75s |
| Difficulty | 0.6 |
| Phase of flight | Departure, 200-800 ft AGL |
| Gorilla parameter | Airspeed (not building) + attitude (too high pitch) |
| Airspeed | 75 -> 80 (should be 75 -> 100 by 800 ft) |
| Attitude | 12 degrees nose-up (normal is 8) |
| Altitude | Climbing normally for first 40s, rate decreasing after |
| Student verbal cues | "Positive rate!" (correct), then silence |
| Student responsiveness | 0.4 (fixated on climbing, not monitoring) |

**Teaching point:** The altimeter says you're climbing. The VSI says positive rate. But the airspeed isn't building. The student is trading airspeed for altitude -- the classic departure stall setup. The CFI was watching for procedure compliance and missed the energy state.

---

### ISE-3.3: The Stabilized Approach That Isn't

**The gorilla:** On final approach, airspeed oscillates between 75 and 65 knots (Vref is 70). The oscillation increases in amplitude. Student is chasing airspeed with pitch instead of power.
**The task:** Evaluate your student's radio communication with tower. They're practicing short final calls and sequencing. Note call quality and timing.

| Parameter | Value |
| --- | --- |
| Duration | 60s |
| Difficulty | 0.5 |
| Phase of flight | Short final, 500-200 ft AGL |
| Gorilla parameter | Airspeed oscillation amplitude |
| Airspeed | 70 +/- 5 initially, growing to 70 +/- 10 by end |
| Attitude | Oscillating (pitch chasing airspeed) |
| Altitude | Normal descent |
| VSI | Oscillating (consequence of pitch chasing) |
| Student verbal cues | None |
| Student responsiveness | 0.6 |

**Teaching point:** The airspeed is averaging correctly. It's the oscillation that's dangerous -- the student is behind the airplane. Each correction overcorrects. This is the unstable approach that looks stable if you only glance at the needle. It requires watching the TREND, not the VALUE.

---

## Module 5 Scenarios (A.9: Flight Reviews & IPCs)

These exercises are diagnostic -- the CFI is conducting an evaluation and must notice competency gaps while managing the assessment.

### ISE-5.1: The Rusty IFR Scan

**The gorilla:** During an IPC approach, the pilot's scan rate decreases over time (highlights slow down). They're getting fatigued or overwhelmed but not saying anything. Meanwhile, their actual flying is still within standards -- barely.
**The task:** You're conducting an IPC. Grade this approach: is the pilot maintaining altitude, heading, and airspeed within ACS standards? Note deviations.

| Parameter | Value |
| --- | --- |
| Duration | 120s |
| Difficulty | 0.6 |
| Phase of flight | ILS approach, 2,000 ft to DA |
| Gorilla parameter | Student scan rate (not an instrument -- the scan itself) |
| Scan rate | 4 instruments/10s initially, decaying to 1.5/10s |
| Instrument values | Within ACS standards but trending toward limits |
| Student verbal cues | "Maintaining..." (becoming less frequent) |
| Student responsiveness | 0.7 |

**Teaching point:** The instruments say "passing." The scan says "struggling." If you only grade the numbers, you miss the pilot who is about to fall behind the airplane. This is what makes an IPC meaningful vs a checkbox -- evaluating the PROCESS, not just the PRODUCT.

**Connection to Module 5 curriculum:** This directly feeds ES-1 (tailor a flight review) and ES-2 (tailor an IPC meaningfully). The tick-engine scenarios in Module 5 address the decision-making; this exercise demonstrates the observation skill.

---

## Replay Variants

Every scan exercise supports replay with variation. On replay:

- Student behavior model changes (more or less responsive)
- Gorilla parameter may change (airspeed on first play, heading on replay)
- Task may change (evaluate scan on first play, monitor altitude on replay)
- Difficulty increases slightly

The learner is told: "Same flight, different day. Things may develop differently."

This prevents memorization ("I know to watch the airspeed in this one") and reinforces the actual skill (continuous scan, multi-parameter awareness). Per Design Principle 5 (Replay is the Product).

---

## Difficulty Progression Across the Course

| When | Exercise | Difficulty | Gorilla | Detection Window |
| --- | --- | --- | --- | --- |
| Module 1, first activity | ISE-1.1 | 0.5 | Airspeed decay (obvious trend) | 30-90s |
| Module 1, Lesson 1A | ISE-1.2 | 0.5 | Heading drift (unrelated to task) | 30-90s |
| Module 1, Lesson 1C | ISE-1.3 | 0.6 | Pitch-up + airspeed (multi-causal) | 40-120s |
| Module 3, LOC block | ISE-3.1 | 0.7 | Base-to-final bank (time-critical) | 20-60s (shorter!) |
| Module 3, LOC block | ISE-3.2 | 0.6 | Departure stall setup (energy state) | 20-75s |
| Module 3, LOC block | ISE-3.3 | 0.5 | Unstable approach (oscillation pattern) | 15-60s |
| Module 5, IPC block | ISE-5.1 | 0.6 | Scan degradation (meta-observation) | 30-120s |

Notice: Module 3 exercises have shorter detection windows. In LOC situations, the time to intervene is compressed. This mirrors reality -- you have 60 seconds in the pattern, not 90 seconds in cruise.

---

## Authoring New Scenarios

To write a new instrument scan exercise:

1. Pick the **phase of flight** (this determines baseline instrument values and what's "normal")
2. Pick the **gorilla** (one parameter that degrades, or a meta-property like scan rate)
3. Pick the **task** (something cognitively demanding that's NOT related to the gorilla)
4. Define the **student scan pattern** (what they look at, what they skip)
5. Define the **student behavior** (responsiveness, verbal cues, compliance)
6. Set **difficulty** by tuning: decay rate, verbal cues, task complexity, distractors
7. Write the **student responses** for each intervention type at each threshold

The script format (YAML) is in [spec.md](spec.md). All keyframes are linear-interpolated with noise. The engine handles interpolation; the author defines the shape of the curve.

**The acid test:** Can a CFI who is paying attention catch it? If the decay is too fast, it's obvious. If it's too slow, the exercise ends before anything happens. The sweet spot: visible to a scanning eye, invisible to a task-loaded one. Play-test every scenario with 3-5 people before shipping.
