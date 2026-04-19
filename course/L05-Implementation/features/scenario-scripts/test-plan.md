---
status: done
review_status: done
phase: C1
type: curriculum
---

# C1 Scenario Scripts -- Test Plan

How to validate a written scenario. Three levels of validation: per-scenario, per-module, and course-wide.

## Per-Scenario Checklist

Run this for every scenario before marking it complete.

### Structure

- [ ] Every tick has a unique `id` (format: `tick_N`)
- [ ] Every tick has all 5 `consequences` entries (ask, prompt, coach, direct, take_controls)
- [ ] Every `nextTickId` references a valid tick id, `terminal_safe`, or `terminal_unsafe`
- [ ] No orphan ticks -- every tick is reachable from `tick_1`
- [ ] `safeWindow` is non-empty on every tick
- [ ] `studentState` progression is coherent (no `critical` -> `nominal` without `recovered`)
- [ ] At least one reachable `terminal_safe` outcome
- [ ] At least one reachable `terminal_unsafe` outcome (exception: reflective/debrief scenarios)

### Scoring

- [ ] `safeWindow` interventions produce positive score deltas
- [ ] Interventions outside both windows produce negative score deltas
- [ ] `take_controls` on `nominal` tick scores heavily negative
- [ ] `ask` on `critical` tick scores heavily negative
- [ ] Max achievable score across all dimensions is reachable via the "optimal" path
- [ ] No single tick awards more than +1 per dimension
- [ ] No single tick penalizes more than -3 per dimension

### Content

- [ ] Briefing is 2-4 sentences, sets scene without telegraphing answer
- [ ] Student speech is realistic and age/experience-appropriate
- [ ] Scene descriptions are vivid but concise (1-2 sentences)
- [ ] Annotations explain _why_, not just _what_
- [ ] No internal jargon in any learner-facing text
- [ ] Student model parameters match the scenario's behavioral needs

### Metadata

- [ ] Title is short and descriptive
- [ ] At least one `FAA_TOPIC` constant assigned (not a bare string)
- [ ] At least one competency code assigned
- [ ] Duration estimate matches tick count (see [design.md](design.md) duration table)
- [ ] Difficulty rating (0-1) is appropriate for the module placement

## Per-Module Checklist

Run this after all scenarios in a module are complete.

### Coverage

- [ ] All scenarios listed in [ROADMAP.md](../../ROADMAP.md) for this module are written
- [ ] FAA topics assigned to this module (per [COURSE_STRUCTURE.md](../../COURSE_STRUCTURE.md)) are all covered
- [ ] Competencies assigned to this module are all exercised
- [ ] Total scenario time fits within module time allocation

### Variety

- [ ] At least 2 different tick patterns used (Escalating Crisis, Pressure Decision, Diagnostic Puzzle, etc.)
- [ ] At least 2 different student models referenced
- [ ] `studentState` variety -- not all scenarios follow the same escalation curve
- [ ] Intervention scoring varies -- different scenarios reward different intervention styles

### Coherence

- [ ] Scenarios build in complexity within the module
- [ ] No two scenarios in the same module feel interchangeable
- [ ] Each scenario contributes something unique to the competency coverage

## Course-Wide Checklist

Run this after all 43 scenarios are complete.

### FAA Topic Time Accounting

Verify cumulative time per FAA topic meets the >= 45 min minimum.

| FAA Topic                 | Constant         | Target    | Modules Contributing | Verified |
| ------------------------- | ---------------- | --------- | -------------------- | -------- |
| Navigation / GPS / TAA    | `FAA_TOPIC.A_1`  | >= 45 min | M1                   | [ ]      |
| Special Use Airspace      | `FAA_TOPIC.A_2`  | >= 45 min | M4                   | [ ]      |
| TSA Requirements          | `FAA_TOPIC.A_3`  | >= 45 min | M4                   | [ ]      |
| Teaching & Safety Culture | `FAA_TOPIC.A_4`  | >= 45 min | M2                   | [ ]      |
| Current Safety Trends     | `FAA_TOPIC.A_5`  | >= 45 min | M2, M3               | [ ]      |
| Pilot Deviations          | `FAA_TOPIC.A_6`  | >= 45 min | M3, M4               | [ ]      |
| FAASTeam / WINGS          | `FAA_TOPIC.A_7`  | >= 45 min | M5                   | [ ]      |
| Regulatory Updates        | `FAA_TOPIC.A_8`  | >= 45 min | M1                   | [ ]      |
| Flight Review / IPC       | `FAA_TOPIC.A_9`  | >= 45 min | M5                   | [ ]      |
| Ethics / Professionalism  | `FAA_TOPIC.A_10` | >= 45 min | M2                   | [ ]      |
| LOC                       | `FAA_TOPIC.A_11` | >= 45 min | M3                   | [ ]      |
| ACS                       | `FAA_TOPIC.A_12` | >= 45 min | M1, M5               | [ ]      |
| Applications              | `FAA_TOPIC.A_13` | >= 45 min | M4                   | [ ]      |

### Competency Coverage

Verify every competency is exercised by at least 2 scenarios.

| Domain                 | Competency | Min Scenarios | Verified |
| ---------------------- | ---------- | ------------- | -------- |
| Instructional Judgment | CJ-1       | >= 2          | [ ]      |
| Instructional Judgment | CJ-2       | >= 2          | [ ]      |
| Instructional Judgment | CJ-3       | >= 2          | [ ]      |
| Aircraft Control       | AC-1       | >= 2          | [ ]      |
| Aircraft Control       | AC-2       | >= 2          | [ ]      |
| Aircraft Control       | AC-3       | >= 2          | [ ]      |
| Risk Management        | RM-1       | >= 2          | [ ]      |
| Risk Management        | RM-2       | >= 2          | [ ]      |
| Risk Management        | RM-3       | >= 2          | [ ]      |
| Automation             | AV-1       | >= 2          | [ ]      |
| Automation             | AV-2       | >= 2          | [ ]      |
| Automation             | AV-3       | >= 2          | [ ]      |
| Operational Discipline | OD-1       | >= 2          | [ ]      |
| Operational Discipline | OD-2       | >= 2          | [ ]      |
| Operational Discipline | OD-3       | >= 2          | [ ]      |
| Regulatory Compliance  | RC-1       | >= 2          | [ ]      |
| Regulatory Compliance  | RC-2       | >= 2          | [ ]      |
| Regulatory Compliance  | RC-3       | >= 2          | [ ]      |
| Regulatory Compliance  | RC-4       | >= 2          | [ ]      |
| Evaluation & Standards | ES-1       | >= 2          | [ ]      |
| Evaluation & Standards | ES-2       | >= 2          | [ ]      |
| Evaluation & Standards | ES-3       | >= 2          | [ ]      |
| Professionalism        | PS-1       | >= 2          | [ ]      |
| Professionalism        | PS-2       | >= 2          | [ ]      |

### Total Time

- [ ] Sum of all scenario durations + briefing/debrief time >= 960 min (16 hours)
- [ ] No single module exceeds its time allocation by more than 10%
- [ ] No single module falls short of its time allocation by more than 10%

### Design Principle Compliance

- [ ] **Decisions Under Pressure** -- every scenario requires real-time judgment, not just knowledge recall
- [ ] **Never a Trick** -- no scenario can be gamed by memorizing intervention patterns
- [ ] **Replay is the Product** -- student model variation creates meaningfully different experiences
- [ ] **Emotional Safety** -- annotations are coaching-toned, not punitive

## Validation Process

1. Author writes scenario using [template.md](template.md)
2. Author self-checks against Per-Scenario Checklist
3. Peer reviews against Per-Scenario Checklist (different eyes)
4. After all module scenarios complete: run Per-Module Checklist
5. After all 43 scenarios complete: run Course-Wide Checklist
6. Any failures -> fix and re-validate

## Related Docs

- [spec.md](spec.md) -- quality criteria and FAA compliance rules
- [design.md](design.md) -- tick patterns and scoring guidelines
- [TRACEABILITY_MATRIX.md](../../TRACEABILITY_MATRIX.md) -- FAA topic coverage targets
- [COMPETENCY_GRAPH.md](../../COMPETENCY_GRAPH.md) -- competency definitions
