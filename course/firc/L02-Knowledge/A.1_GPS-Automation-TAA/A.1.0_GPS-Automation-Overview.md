# A.1.0 -- GPS, Automation & TAA (Main Section)

Research doc for lesson development. What to teach, where to find it, and what the FAA is trying to prevent.

## What the FAA Wants Taught

AC 61-83K Appendix A, Section A.1 treats GPS and cockpit automation as both a major capability increase and a source of new risk. The core teaching burden for a FIRC provider is to make sure CFIs can teach modern avionics without producing automation-dependent pilots.

The non-negotiable points in the AC are:

- **Know what the system can and cannot do.** Instructors should be well versed in hazards such as excessive heads-down time, automation fixation, automation dependency, database currency, and system limits.
- **Teach limits and procedures, not just features.** The AC explicitly says pilots should learn airplane limitations, system limitations, and manufacturer-recommended procedures before relying on the equipment.
- **Recognize and correct automation-based risky behavior in students.**
- **Prevent overdependence on automation.** Students must not lose pilotage, dead reckoning, or VOR skills.
- **Preserve manual aircraft-control proficiency.** The FAA strongly recommends maintaining proficiency in every aspect of the aircraft flown, especially manual control.
- **Teach appropriate automation-level selection.** No one level of automation is appropriate for all flight situations.
- **Prepare pilots for partial or complete automation failure.**
- **Teach transition risk honestly.** Pilots transitioning to TAA or any unfamiliar aircraft should receive specialized transition training from an instructor experienced in the specific make, model, and equipment.

The section also requires three supporting subtopics:

- regulatory definition of TAA (`A.1.1`)
- overview of ADS-B (`A.1.2`)
- overview of NextGen (`A.1.3`)

## Working Interpretation for Lesson Design

The main A.1 lesson should answer this question:

> How do we teach pilots to use modern navigation and automation tools well, while still being able to fly and navigate safely when those tools mislead, degrade, or fail?

If the lesson drifts into pure avionics familiarization, it misses the FAA's real concern.

## Key Concepts to Cover

### 1. System Capability, System Limits, and Procedures

This is easy to underemphasize, but it is one of the AC's clearest points.

Students should learn:

- the aircraft's limitations;
- the avionics system's limitations;
- what the manufacturer says about setup, operation, and abnormal use;
- that current NOTAMs and current procedures may supersede what a database display appears to show;
- that the pilot is still responsible for verifying what the automation is doing.

### 2. Automation Hazards

The AC names the broad hazard family. These are the most useful teaching distinctions to make when expanding it:

- **Heads-down time** -- time spent managing displays instead of aviate / navigate / look outside.
- **Automation fixation** -- attention captured by the display or automation task.
- **Automation dependency** -- inability to function well when the automation is unavailable.
- **Automation complacency** -- assuming the automation is handling more than it actually is.
- **Mode confusion** -- not understanding which mode is active, armed, or about to capture.
- **Database currency and limits** -- using stale data or overtrusting what the box depicts.

### 3. Traditional Navigation and Manual Proficiency

The FAA is explicit that students must not become overdependent on GPS and automation to the exclusion of:

- pilotage;
- dead reckoning;
- VOR navigation;
- manual aircraft control.

For teaching design, that means the lesson should reinforce:

- planned hand-flying periods;
- deliberate use of non-GPS navigation references;
- recovery from automation loss;
- cross-check habits that do not depend on one display.

### 4. Levels of Automation

The AC does not provide a formal automation taxonomy, but it clearly requires the idea that no single level works everywhere.

Useful instructional buckets:

- hand-flying with no automation;
- basic lateral or attitude support;
- heading / altitude hold;
- coupled en route or approach modes;
- highly managed GPS / FMS-guided operation.

The teaching point is not to memorize categories. The teaching point is to ask:

- What level of automation is appropriate right now?
- Is the pilot ahead of it?
- Would hand-flying reduce risk in this phase?

### 5. Failure and Reversion

The AC explicitly requires the pilot to possess the knowledge and skill to respond if automation fails in whole or in part.

That means the lesson should cover:

- immediate aviate-first response;
- how to recognize a failure versus a mode-selection error;
- reverting to basic navigation or manual control;
- continued flight planning after degradation;
- when to simplify, disconnect, or ask ATC for help.

### 6. Transition Training

Use the AC's wording carefully here. Pilots transitioning to TAA or unfamiliar aircraft **should receive** specialized transition training.

The transition-training emphasis should include:

- specific avionics suite and autopilot modes;
- system limitations and abnormal / reversionary behavior;
- manufacturer-recommended procedures;
- scan adaptation from legacy to glass;
- when to hand-fly and when to automate;
- maintaining manual proficiency in the new cockpit.

## Supporting GPS Knowledge

These items are not the main point of A.1, but they are useful supporting knowledge for teaching the main point well:

- database cycles do not replace preflight review of NOTAMs and current procedures;
- RAIM / integrity concepts matter when teaching older GPS IFR use;
- signal availability can be degraded by interference, jamming, terrain, or other external causes;
- GPS-derived altitude is not a substitute for the approved barometric altitude reference used for procedure compliance;
- GPS guidance does not create blanket obstacle clearance outside approved and published procedure contexts.

Use current FAA handbook, AIM, and manufacturer guidance when turning these into detailed lesson content.

## Reference Sources

### Primary

- `AC 61-83K`, Appendix A, Section A.1
- `docs/faa-docs/part-61.md` for the TAA regulatory anchor cited by the AC
- manufacturer POH / AFM and avionics pilot guides for limitation and procedure language

### FAA Publications to Use for Detail

- current `Pilot's Handbook of Aeronautical Knowledge`
- current `Instrument Flying Handbook`
- current `Advanced Avionics Handbook`
- current `AIM` GPS and ADS-B sections

### Internal References

- `OVERVIEW.md` in this directory for verbatim AC text
- question bank in `docs/firc/question-bank/a-1/`
- Module 1 scenarios in `docs/firc/scenarios/module-1/`

## Teaching Ideas

### Scenario Concepts

- **Cover the GPS** -- force pilotage / dead reckoning / VOR cross-check after a GPS loss or screen cover
- **Mode confusion walkthrough** -- show a case where the autopilot did exactly what it was told, not what the pilot expected
- **Expired or stale-data trap** -- compare a loaded procedure with a current NOTAM or revised chart
- **Automation-level selection drill** -- ask which level of automation is appropriate for the pattern, busy terminal work, a long cruise segment, and an approach

### Discussion Prompts

- "What automation error do your students make most often: fixation, dependency, or mode confusion?"
- "If the automation fails right now, what skills does the student still have?"
- "How do you know whether the automation is helping workload or quietly increasing it?"
- "What should a pilot verify before trusting what the box is depicting?"

### Common Misconceptions to Address

- "If it is on the screen, it must be current."
- "Using more automation is always safer."
- "If the autopilot surprises me, it must have malfunctioned."
- "A student who can manage the avionics is automatically proficient."
- "Traditional navigation skills only matter for checkrides."

## Our Existing Content

### Questions

- `Q-A1-01` through `Q-A1-16`
- Strongest current question coverage:
  - database currency and NOTAM mismatch
  - mode confusion
  - automation dependency
  - manual proficiency
  - automation failure response
  - glass-cockpit scan integration

### Scenarios

- `SCN 1.1` -- GPS database expired
- `SCN 1.2` -- autopilot mode confusion
- `SCN 1.3` -- RAIM integrity issue
- `SCN 1.4` -- glass-cockpit fixation / traffic-display limitation
- `SCN 1.5` -- ADS-B weather delay

These scenarios already carry the heart of the A.1 lesson well.

## Highest-Priority Gaps

- No dedicated scenario where the instructor must teach **automation-level selection** for a changing flight context
- No direct scenario where a student must revert to **VOR / pilotage / dead reckoning** after GPS loss
- Transition-training ideas are strong in the question bank but not as explicit in standalone scenario form

If only one new scenario gets added, make it an **automation-level selection** problem. That is one of the AC's clearest teaching points and the least directly exercised by the current scenario set.
