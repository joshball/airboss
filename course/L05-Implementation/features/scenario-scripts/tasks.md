---
status: done
review_status: done
phase: C1
type: curriculum
---

# C1 Scenario Scripts -- Tasks

All 43 scenarios organized by module with dependency order. Write in module order -- each module builds on prior competencies.

## Dependency Order

Modules are sequenced by competency prerequisites (see [COMPETENCY_GRAPH.md](../../COMPETENCY_GRAPH.md)):

1. **Module 3** first -- the flagship LOC scenarios establish the tick engine pattern and the core intervention ladder. The reference implementation (Base-to-Final Overshoot) lives here.
2. **Module 2** -- instructional judgment and pressure decisions. Builds on the intervention ladder from M3.
3. **Module 1** -- automation/avionics scenarios. Requires familiarity with the tick format from M3.
4. **Module 4** -- administrative/compliance scenarios. Different pattern (multi-beat procedural) but same tick structure.
5. **Module 5** -- evaluation scenarios. Diagnostic puzzle pattern. Depends on having seen the full intervention ladder.
6. **Module 6** last -- capstone integrates all patterns and topics.

Within each module, write the simplest scenario first as the module's "template setter."

---

## Module 3 -- Loss of Control Lab (8 scenarios, ~195 min)

Write first. Establishes core tick engine patterns.

| #   | Scenario                                     | FAA Topics                        | Competencies                 | Pattern           | Est. Duration | Dep              |
| --- | -------------------------------------------- | --------------------------------- | ---------------------------- | ----------------- | ------------- | ---------------- |
| 3.1 | Base-to-final overshoot and stall-spin setup | `FAA_TOPIC.A_11`                  | CJ-1, CJ-2, AC-1, AC-2, RM-2 | Escalating Crisis | 10 min        | DONE (reference) |
| 3.2 | Engine failure after takeoff                 | `FAA_TOPIC.A_11`, `FAA_TOPIC.A_5` | AC-2, RM-2, CJ-2             | Escalating Crisis | 10 min        | 3.1              |
| 3.3 | Departure stall                              | `FAA_TOPIC.A_11`                  | AC-1, AC-2, CJ-1             | Escalating Crisis | 8 min         | 3.1              |
| 3.4 | Inadvertent IMC with overloaded pilot        | `FAA_TOPIC.A_11`, `FAA_TOPIC.A_5` | AC-2, RM-2, CJ-1, CJ-2       | Escalating Crisis | 12 min        | 3.2              |
| 3.5 | Complex airport taxi at night                | `FAA_TOPIC.A_6`                   | OD-1, CJ-2                   | Pressure Decision | 10 min        | 3.1              |
| 3.6 | Readback misunderstanding                    | `FAA_TOPIC.A_6`                   | OD-1, OD-2, CJ-1             | Escalating Crisis | 8 min         | 3.5              |
| 3.7 | Runway crossing confusion                    | `FAA_TOPIC.A_6`                   | OD-1, CJ-2                   | Escalating Crisis | 8 min         | 3.5              |
| 3.8 | Gusty crosswind final                        | `FAA_TOPIC.A_11`, `FAA_TOPIC.A_5` | AC-1, RM-2                   | Escalating Crisis | 10 min        | 3.1              |

**Module 3 subtotal:** ~76 min scenario time + briefing/debrief = ~195 min module time

---

## Module 2 -- Instructional Effectiveness & Safety Culture (8 scenarios, ~180 min)

Pressure decisions and instructional judgment. Different rhythm than M3 -- dialogue-heavy, less physical danger.

| #   | Scenario                                   | FAA Topics                        | Competencies     | Pattern           | Est. Duration | Dep     |
| --- | ------------------------------------------ | --------------------------------- | ---------------- | ----------------- | ------------- | ------- |
| 2.1 | Overconfident student                      | `FAA_TOPIC.A_4`                   | CJ-1, CJ-2, PS-2 | Diagnostic Puzzle | 12 min        | M3 done |
| 2.2 | Timid student                              | `FAA_TOPIC.A_4`                   | CJ-1, CJ-2, PS-2 | Diagnostic Puzzle | 12 min        | 2.1     |
| 2.3 | Student who parrots but doesn't understand | `FAA_TOPIC.A_4`                   | CJ-1, CJ-3       | Diagnostic Puzzle | 10 min        | 2.1     |
| 2.4 | Rushed checkout with external pressure     | `FAA_TOPIC.A_4`, `FAA_TOPIC.A_10` | PS-1, RM-3, CJ-2 | Pressure Decision | 10 min        | 2.1     |
| 2.5 | Owner pressures signoff                    | `FAA_TOPIC.A_10`                  | PS-1, RM-3       | Pressure Decision | 8 min         | 2.4     |
| 2.6 | Friend wants shortcut flight review        | `FAA_TOPIC.A_10`, `FAA_TOPIC.A_9` | PS-1, RM-3, ES-1 | Pressure Decision | 8 min         | 2.4     |
| 2.7 | Hot / high departure risk                  | `FAA_TOPIC.A_5`                   | RM-1, RM-2, CJ-2 | Escalating Crisis | 10 min        | M3 done |
| 2.8 | Weather + fatigue + get-there pressure     | `FAA_TOPIC.A_5`, `FAA_TOPIC.A_10` | RM-1, RM-2, RM-3 | Pressure Decision | 10 min        | 2.7     |

**Module 2 subtotal:** ~80 min scenario time + briefing/debrief = ~180 min module time

---

## Module 1 -- Instructor Foundations & Modern Cockpit (7 scenarios, ~165 min)

Automation and avionics scenarios. Requires comfortable tick-writing from M3.

| #   | Scenario                               | FAA Topics                        | Competencies     | Pattern           | Est. Duration | Dep     |
| --- | -------------------------------------- | --------------------------------- | ---------------- | ----------------- | ------------- | ------- |
| 1.1 | GPS database out of date               | `FAA_TOPIC.A_1`                   | AV-3, RC-4       | Escalating Crisis | 10 min        | M3 done |
| 1.2 | Autopilot mode confusion               | `FAA_TOPIC.A_1`                   | AV-2, CJ-1       | Escalating Crisis | 12 min        | 1.1     |
| 1.3 | RAIM / integrity issue                 | `FAA_TOPIC.A_1`                   | AV-3, AV-1       | Escalating Crisis | 10 min        | 1.1     |
| 1.4 | Glass cockpit fixation in busy pattern | `FAA_TOPIC.A_1`, `FAA_TOPIC.A_5`  | AV-1, AC-1, CJ-1 | Escalating Crisis | 12 min        | 1.2     |
| 1.5 | ADS-B / weather delay misunderstanding | `FAA_TOPIC.A_1`                   | AV-3, RM-1       | Diagnostic Puzzle | 8 min         | 1.1     |
| 1.6 | TAA transition briefing                | `FAA_TOPIC.A_1`, `FAA_TOPIC.A_12` | AV-1, ES-3       | Diagnostic Puzzle | 10 min        | 1.1     |
| 1.7 | Old lesson plan vs current requirement | `FAA_TOPIC.A_8`, `FAA_TOPIC.A_12` | RC-4, ES-3       | Pressure Decision | 8 min         | 1.1     |

**Module 1 subtotal:** ~70 min scenario time + briefing/debrief = ~165 min module time

---

## Module 4 -- Airspace, Security, and Compliance (9 scenarios, ~120 min)

Administrative/procedural scenarios. Multi-beat pattern dominates.

| #   | Scenario                                   | FAA Topics                       | Competencies     | Pattern           | Est. Duration | Dep     |
| --- | ------------------------------------------ | -------------------------------- | ---------------- | ----------------- | ------------- | ------- |
| 4.1 | Cross-country route with moving TFR        | `FAA_TOPIC.A_2`                  | OD-3, RM-2       | Escalating Crisis | 10 min        | M3 done |
| 4.2 | Student busts protected airspace           | `FAA_TOPIC.A_2`, `FAA_TOPIC.A_6` | OD-2, OD-3, CJ-2 | Escalating Crisis | 10 min        | 4.1     |
| 4.3 | Intercept recognition drill                | `FAA_TOPIC.A_2`                  | OD-3             | Escalating Crisis | 8 min         | 4.1     |
| 4.4 | Non-US prospective student walk-in         | `FAA_TOPIC.A_3`                  | RC-1, RC-2       | Multi-Beat Admin  | 10 min        | none    |
| 4.5 | "Other school already checked me" transfer | `FAA_TOPIC.A_3`                  | RC-1, RC-2       | Multi-Beat Admin  | 8 min         | 4.4     |
| 4.6 | Missing citizenship documentation          | `FAA_TOPIC.A_3`                  | RC-1, RC-2       | Multi-Beat Admin  | 8 min         | 4.4     |
| 4.7 | TSA eligibility change mid-training        | `FAA_TOPIC.A_3`                  | RC-1, RC-2       | Multi-Beat Admin  | 10 min        | 4.4     |
| 4.8 | Incomplete student pilot application       | `FAA_TOPIC.A_13`                 | RC-3             | Multi-Beat Admin  | 8 min         | none    |
| 4.9 | Remote pilot applicant with issue          | `FAA_TOPIC.A_13`                 | RC-3             | Multi-Beat Admin  | 8 min         | 4.8     |

**Module 4 subtotal:** ~80 min scenario time + briefing/debrief = ~120 min module time

---

## Module 5 -- Meaningful Evaluations (6 scenarios, ~150 min)

Diagnostic puzzle pattern. The CFI must uncover hidden weaknesses and build tailored plans.

| #   | Scenario                                        | FAA Topics                        | Competencies     | Pattern           | Est. Duration | Dep     |
| --- | ----------------------------------------------- | --------------------------------- | ---------------- | ----------------- | ------------- | ------- |
| 5.1 | Rusty pilot who sounds polished                 | `FAA_TOPIC.A_9`                   | ES-1, CJ-1       | Diagnostic Puzzle | 15 min        | M2 done |
| 5.2 | Active pilot with hidden weak ADM               | `FAA_TOPIC.A_9`, `FAA_TOPIC.A_5`  | ES-1, CJ-1, RM-1 | Diagnostic Puzzle | 15 min        | 5.1     |
| 5.3 | Sharp pilot with hidden weak area               | `FAA_TOPIC.A_9`                   | ES-1, ES-2, CJ-1 | Diagnostic Puzzle | 12 min        | 5.1     |
| 5.4 | Automation-heavy IFR pilot weak in fundamentals | `FAA_TOPIC.A_9`, `FAA_TOPIC.A_1`  | ES-2, AV-1, CJ-1 | Diagnostic Puzzle | 15 min        | 5.1     |
| 5.5 | Friend asks for "quick signoff"                 | `FAA_TOPIC.A_9`, `FAA_TOPIC.A_10` | ES-1, PS-1, RM-3 | Pressure Decision | 10 min        | 5.1     |
| 5.6 | Post-checkride proficiency plan building        | `FAA_TOPIC.A_7`, `FAA_TOPIC.A_9`  | ES-1, PS-2       | Diagnostic Puzzle | 12 min        | 5.1     |

**Module 5 subtotal:** ~79 min scenario time + briefing/debrief = ~150 min module time

---

## Module 6 -- Integrated Capstone (5 scenarios, ~150 min)

Write last. Integrates all prior patterns and topics.

| #   | Scenario                                   | FAA Topics                        | Competencies                       | Pattern             | Est. Duration | Dep        |
| --- | ------------------------------------------ | --------------------------------- | ---------------------------------- | ------------------- | ------------- | ---------- |
| 6.1 | Mixed campaign scenario                    | All applicable                    | All domains                        | Integrated Capstone | 25 min        | M1-M5 done |
| 6.2 | Branching "day-in-the-life" CFI simulation | All applicable                    | CJ-1, CJ-2, RM-1, PS-1, OD-1, RC-1 | Integrated Capstone | 25 min        | 6.1        |
| 6.3 | Incident chain recognition                 | `FAA_TOPIC.A_5`, `FAA_TOPIC.A_11` | RM-1, RM-2, AC-1, CJ-3             | Escalating Crisis   | 15 min        | M3 done    |
| 6.4 | End-of-course reflective debrief           | All applicable                    | CJ-3, PS-2                         | Diagnostic Puzzle   | 15 min        | 6.1        |
| 6.5 | Final "checkride" scenario                 | All applicable                    | All domains                        | Integrated Capstone | 25 min        | 6.1        |

**Module 6 subtotal:** ~105 min scenario time + briefing/debrief = ~150 min module time

---

## Time Budget Summary

| Module    | Scenarios | Scenario Time | With Briefing/Debrief  | Target            |
| --------- | --------- | ------------- | ---------------------- | ----------------- |
| M1        | 7         | ~70 min       | ~165 min               | 165 min (2.75 hr) |
| M2        | 8         | ~80 min       | ~180 min               | 180 min (3.0 hr)  |
| M3        | 8         | ~76 min       | ~195 min               | 195 min (3.25 hr) |
| M4        | 9         | ~80 min       | ~120 min               | 120 min (2.0 hr)  |
| M5        | 6         | ~79 min       | ~150 min               | 150 min (2.5 hr)  |
| M6        | 5         | ~105 min      | ~150 min               | 150 min (2.5 hr)  |
| **Total** | **43**    | **~490 min**  | **~960 min (16.0 hr)** | **960 min**       |

## Writing Order Checklist

- [ ] **Phase 1: M3 LOC scenarios** (3.1 is done -- write 3.2 through 3.8)
- [ ] **Phase 2: M2 instruction scenarios** (2.1 through 2.8)
- [ ] **Phase 3: M1 automation scenarios** (1.1 through 1.7)
- [ ] **Phase 4: M4 compliance scenarios** (4.1 through 4.9)
- [ ] **Phase 5: M5 evaluation scenarios** (5.1 through 5.6)
- [ ] **Phase 6: M6 capstone scenarios** (6.1 through 6.5)

After each phase: run coverage check against [TRACEABILITY_MATRIX.md](../../TRACEABILITY_MATRIX.md) to verify FAA topic accumulation.
