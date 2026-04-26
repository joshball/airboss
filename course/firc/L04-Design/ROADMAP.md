# Curriculum Roadmap

What gets written, reviewed, and entered, in what order. Parallel to the [Platform Roadmap](../../../docs/platform/ROADMAP.md) -- these tracks have specific handoff points but don't fully block each other.

## Current Work

Active phase: **C1.5 -- Module Design Docs**
Next tasks: see Phase C1.5 below
**Status:** C3 complete (scenarios + questions seeded). C4 deferred per [platform pivot](../../../docs/platform/PIVOT.md). Module 1 design docs complete; modules 2-6 need the same treatment.

## Maintenance

After completing any curriculum task:

- Check off the item in the relevant phase below
- Update session `TODO.md`

After completing a phase:

- Mark phase header `[DONE]` in this file
- Update `## Current Work` pointer above

---

## Handoff Points

The two tracks intersect here:

| Curriculum needs   | Platform dependency                           | Status                                   |
| ------------------ | --------------------------------------------- | ---------------------------------------- |
| C3 (content entry) | Platform Phase 1 -- Hangar CRUD complete      | **Done** -- scenarios + questions seeded |
| C4 (FAA package)   | C3 complete + hangar publish pipeline working | **In progress** -- validation built      |

C0, C1, and C2 are **platform-independent**. C3 is complete -- all content seeded. C4 in progress.

---

## Phase C0 -- Course Design `[DONE]`

Structural decisions. All platform-independent.

- [x] FAA requirements mapped (13 topics, 16 hours, time rules) -- [COURSE_STRUCTURE.md](COURSE_STRUCTURE.md)
- [x] Course structure defined -- 6 modules with topic coverage and time allocation -- [COURSE_STRUCTURE.md](COURSE_STRUCTURE.md)
- [x] Competency graph -- 8 domains, 22+ competencies with observable behaviors and evidence -- [COMPETENCY_GRAPH.md](../L03-Objectives/COMPETENCY_GRAPH.md)
- [x] Module-to-competency mapping -- [COURSE_STRUCTURE.md](COURSE_STRUCTURE.md)
- [x] TCO drafted -- [TCO.md](../L01-FAA/submission/TCO.md)
- [x] Traceability matrix framework -- [TRACEABILITY_MATRIX.md](../L01-FAA/submission/TRACEABILITY_MATRIX.md)
- [x] FAA submission guide -- [FAA_SUBMISSION.md](../L01-FAA/submission/FAA_SUBMISSION.md)
- [x] Content reference -- [FIRC_CONTENT_REFERENCE.md](../L03-Objectives/FIRC_CONTENT_REFERENCE.md)

---

## Phase C1 -- Scenario Scripts `[DONE]`

All 43+ scenario scripts written with complete tick scripts, student models, competency links, and FAA topic tags. Scripts live in `course/firc/L05-Implementation/scenarios/module-{1-6}/`.

- [x] Module 1 -- Instructor Foundations & Modern Cockpit (10 scenarios -- expanded from 7)
- [x] Module 2 -- Instructional Effectiveness & Safety Culture (8 scenarios)
- [x] Module 3 -- Loss of Control Lab (8 scenarios)
- [x] Module 4 -- Airspace, Security, and Compliance (9 scenarios)
- [x] Module 5 -- Meaningful Evaluations (6 scenarios)
- [x] Module 6 -- Integrated Capstone (5 scenarios)

---

## Phase C2 -- Question Bank `[DONE]`

60+ questions required per AC 61-83K SS 13.7. Randomized. No true/false.
Platform-independent -- write the question bank doc before hangar exists.

- [x] Draft 60+ questions across all 13 FAA topics -- 67+ questions in [question-bank/](../L05-Implementation/question-bank/) (restructured into per-section files)
- [x] Tag each question to FAA topic + competency
- [x] Review for true/false violations (none allowed)
- [x] Verify pool size per topic (enough for randomization)

---

## Phase C3 -- Content Entry `[DONE]`

Enter the written content into hangar. Hangar CRUD is complete -- can begin as C1/C2 content is ready.

- [x] Seed competency data (8 domains, 22 competencies) -- done in `scripts/db/seed.ts`
- [x] Seed FAA topic data (13 topics) -- done via competency `faaTopic` field
- [x] Create 6 modules with time allocations -- done in `scripts/db/seed.ts`
- [x] Enter scenarios (from C1 scripts) -- `bun run db seed-scenarios` (43 scenarios, upsert pattern)
- [x] Enter question bank (from C2) -- `bun run db seed-questions` (67 questions, upsert pattern)
- [x] Define student models (for tick engine parameters) -- extracted from scenario scripts via `seed-scenarios`

---

## Phase C1.5 -- Module Design Docs `[IN PROGRESS]`

Deep design documentation for each module: learning objectives, lesson flow, and landscape/territory analysis. This work enriches the course design before the platform pivot pauses FIRC-specific development.

Per-module deliverables (matching Module 1's pattern):

- `L03-Objectives/module-{N}-objectives.md` -- learning objectives with scenario traceability
- `L04-Design/module-{N}-lesson-flow.md` -- lesson structure, adaptive selection, FAA time accounting
- `L04-Design/module-{N}-landscape.md` -- territory map, coverage analysis, candidate scenarios

Cross-module docs:

- [x] Course design philosophy (grouping logic, sequencing, adaptive model) -- [COURSE_DESIGN.md](COURSE_DESIGN.md)

Module 1:

- [x] Objectives -- [module-1-objectives.md](../L03-Objectives/module-1-objectives.md) (21 objectives)
- [x] Lesson flow -- [module-1-lesson-flow.md](module-1-lesson-flow.md) (3 lessons, 165 min)
- [x] Landscape -- [module-1-landscape.md](module-1-landscape.md) (territory map, 13 candidate scenarios)

Module 2 (Instructional Effectiveness & Safety Culture -- A.4, A.10, A.5):

- [ ] Objectives
- [ ] Lesson flow
- [ ] Landscape

Module 3 (Loss of Control Lab -- A.11, A.6, A.4 reinforcement):

- [ ] Objectives
- [ ] Lesson flow
- [ ] Landscape

Module 4 (Airspace, Security, and Compliance -- A.2, A.3, A.13):

- [ ] Objectives
- [ ] Lesson flow
- [ ] Landscape

Module 5 (Meaningful Evaluations -- A.9, A.7):

- [ ] Objectives
- [ ] Lesson flow
- [ ] Landscape

Module 6 (Integrated Capstone -- all topics):

- [ ] Objectives
- [ ] Lesson flow
- [ ] Landscape

See [COURSE_DESIGN.md](COURSE_DESIGN.md) "Modules 2-6 Work Remaining" for module-specific notes, research pointers, and key challenges to address.

---

## Phase C4 -- FAA Package `[DEFERRED]`

Deferred per [platform pivot](../../../docs/platform/PIVOT.md) (2026-04-14). FIRC is no longer the primary product; FAA submission is paused indefinitely. The validation tooling and content remain valuable if a FIRC module is later built on the pilot performance platform.

- [x] Validate topic coverage >= 45 min each, total >= 16 hours -- `bun run faa validate`
- [x] Validate question bank >= 60, no true/false -- `bun run faa validate`
- [x] Finalize traceability matrix (topic -> scenario -> evidence mapping) -- generated by `bun run faa validate`
- [ ] TCO final review against entered content
- [ ] Assemble submission package per [FAA_SUBMISSION.md](../L01-FAA/submission/FAA_SUBMISSION.md)
