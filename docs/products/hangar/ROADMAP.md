# Hangar Roadmap

Phases 1-3 complete. Next: Phase 4 (Content Lifecycle) or Phase 5 (Reference Library).

## Phase 1 -- Foundation `[DONE]`

Get the data model right and basic editing working.

- Database schema for scenarios, modules, competencies, student models, questions, micro-lessons
- Basic CRUD views for all content types
- Scenario editor (form-based, no tick preview yet)
- Module editor with scenario assignment
- Competency registry (read from seed data, editable)
- Task board (kanban) with basic task CRUD
- Navigation and layout shell

**Exit criteria:** Can create a scenario, assign it to a module, link competencies, create questions. Can create and move tasks on a board.

## Phase 2 -- Compliance Core `[DONE]`

The traceability matrix and validation engine.

- Traceability matrix editor (interactive table, linked to content)
- Content validation engine (all automated checks from PRD A9)
- Compliance dashboard (pass/fail per check, real-time)
- TCO editor (structured form)
- Question bank validation (60+ questions, 5+ per module, no true/false)

**Exit criteria:** Matrix is live and auto-validates. Compliance dashboard shows current state. Can edit TCO fields.

## Phase 3 -- FAA Package & Submission `[DONE]`

Generate what the FAA needs to see.

- FAA package generator (one-button, all 5 documents)
- Submission tracker (status, revision history, dates)
- Content version tagging ("submitted as v1.2 on 2026-07-01")
- Package archive with timestamps

**Exit criteria:** Can generate a complete, formatted FAA submission package. Can track submission status.

## Phase 4 -- Content Lifecycle `[NOT STARTED]`

Full draft-to-publish workflow and versioning.

- Content workflow states (draft -> review -> validated -> approved -> published -> archived)
- Content versioning with diff view and rollback
- Review assignments and approval gates
- Publish/archive controls
- Activity history on every content item
- Version linkage to learner completion records

**Exit criteria:** Content goes through full lifecycle. Every edit is versioned. Can roll back. Can answer "which version did user X complete?"

## Phase 5 -- Reference Library & Regulatory Monitoring `[NOT STARTED]`

External document management and change detection.

- Reference document store (upload, categorize, tag)
- Reference linking (docs <-> scenarios, modules, competencies)
- Regulatory change monitor (90-day check workflow, task auto-creation)
- Exam rotation tracking
- Approval period countdown and renewal alerts

**Exit criteria:** FAA documents stored and linked to content. 90-day check workflow runs. Regulatory changes create tasks automatically.

## Phase 6 -- Analytics `[NOT STARTED]`

Dashboards to see the state of content.

- Coverage dashboard (topic x module heat map, competency gaps)
- Scenario inventory (counts, difficulty distribution, time estimates)
- Question bank stats (pool depth, topic distribution)
- Time projection (estimated learner time per topic vs minimums)

**Exit criteria:** Can see at a glance where content is strong, where it's thin, and whether we'll meet FAA time requirements.
