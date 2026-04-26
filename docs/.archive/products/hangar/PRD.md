# Hangar PRD

## A. Course Content Management

### A1. Scenario Editor

Create and edit tick-based instructional scenarios.

**Data:**

- Scenario ID, title, description
- FAA topics covered (one-to-many)
- Competencies exercised (one-to-many)
- Environment slots (airport, weather, time of day, traffic)
- Student model ID (links to student behavior preset)
- Briefing package (pre-brief content: aircraft, speeds, W&B, student profile)
- Tick script (sequence of world state changes, trigger conditions, branch points)
- Intervention options per tick (ask/prompt/coach/direct/take-controls)
- Outcome branches (safe, near-miss, incident, accident)
- Debrief template (what to show after each outcome)
- Estimated duration (in minutes)
- Difficulty level
- Status (draft, review, approved, published, archived)

**Behavior:**

- Form-based editing for scenario metadata
- Structured editor for tick scripts (not free-form code -- fields for aircraft state, student state, cues, risks per tick)
- Preview mode (step through ticks without scoring)
- Duplicate scenario to create variants
- Validation: must link to at least one FAA topic and one competency

### A2. Student Model Editor

Define student behavior presets used by scenarios.

**Data:**

- Model ID, name, description
- Skill level, compliance tendency, communication quality
- Freeze tendency, overconfidence tendency
- Instrument interpretation accuracy
- Startle delay, fatigue modifier
- Behavioral notes (free text)

**Behavior:**

- CRUD for student models
- Used as a reference by scenarios (one model, many scenarios)
- Preset library: "nervous beginner", "overconfident intermediate", "competent but fatigued"

### A3. Module Editor

Edit the 6 course modules (or adjust structure as needed).

**Data:**

- Module ID, title, description
- FAA topics covered
- Competencies targeted
- Assigned scenarios (ordered)
- Learning objectives (list of statements)
- Time allocation (hours)
- Assessment requirements

**Behavior:**

- Drag-and-drop scenario ordering within a module
- Time calculator: sum of scenario durations vs allocated time
- Validation: all assigned FAA topics must have >= 45 min coverage across scenarios

### A4. Competency Registry

View and manage the 22 competencies across 8 domains.

**Data:**

- Competency ID (CJ-1, AC-2, etc.), domain, skill name
- Observable behaviors (list)
- Evidence types (list)
- FAA topic mapping
- Prerequisite competencies
- Linked scenarios (computed from scenario -> competency links)

**Behavior:**

- Browse by domain
- Click through to see all scenarios that exercise a competency
- Gap detection: competencies with no scenarios, or no assessment evidence

### A5. Knowledge Check Editor

Create and manage assessment questions.

**Data:**

- Question ID, text, type (multiple-choice, scenario-based, essay)
- Answer options (for MC), correct answer, explanation
- FAA topic, competency, module
- Difficulty level
- Randomization pool (which questions can substitute for each other)
- Status (draft, approved, active, retired)

**Behavior:**

- Question bank with filtering by topic, competency, module, difficulty
- Pool management: group interchangeable questions for randomization
- Validation: >= 60 total active questions, >= 5 per module, no true/false (AC 61-83K SS 13)
- Exam preview: generate a sample exam with randomization
- Rotation tracking: questions must change every 2-year renewal

### A6. Micro-Lesson Editor

Create just-in-time knowledge content shown during scenarios.

**Data:**

- Lesson ID, title, content (rich text, short)
- Trigger context (when shown: on cue, on failure, on request)
- FAA topic, competency
- Duration estimate (10-30 seconds)
- Linked scenarios

**Behavior:**

- Short-form content editor
- Link to specific ticks/cues within a scenario

### A7. Content Workflow

Lifecycle for all content items (scenarios, questions, modules, micro-lessons).

**States:** draft -> review -> validated -> approved -> published -> archived

**Behavior:**

- Status transitions with required fields (reviewer, approval notes)
- Review assignments
- Validation gate: automated checks must pass before approval
- Publish: makes content available to learners in sim
- Archive: removes from active use, retains for audit
- Activity history on every item (who changed what, when, why)

### A8. Content Versioning

Every content item is versioned.

**Behavior:**

- Automatic version increment on save
- Diff view between versions
- Rollback to any previous version
- "Which version did user X complete?" -- link learner completion records to content version
- Version tagging for FAA submissions ("this is the version we submitted on 2026-05-01")

### A9. Content Validation Engine

Automated compliance checks that run continuously.

**Checks:**

- All 13 FAA core topics have at least one published scenario
- Each core topic has >= 45 min estimated coverage (sum of scenario durations)
- Total course time >= 16 hours
- > = 60 active questions in the question bank
- > = 5 active questions per module
- No true/false questions in active pool
- Every published scenario links to at least one competency
- Every competency has at least one published scenario
- Traceability matrix has no empty cells

**Behavior:**

- Dashboard showing pass/fail per check
- Warnings for items approaching threshold (e.g., 48 min coverage on a 45 min minimum)
- Blocks publish of content that would break compliance
- Run on-demand or automatically on content changes

---

## B. FAA Compliance & Document Management

### B1. Traceability Matrix Editor

The most important FAA-facing artifact. Editable, live-validated.

**Data (per row):**

- FAA core topic (A.1 through A.13)
- Modules where covered
- Competencies addressed
- Scenario IDs
- Assessment/evidence methods
- Estimated time
- Status (complete, partial, missing)

**Behavior:**

- Matrix view: rows = FAA topics, columns = coverage dimensions
- Cell editing with dropdowns (link scenarios, competencies)
- Auto-population from scenario and module data where possible
- Live validation: highlight gaps (missing scenarios, insufficient time)
- Export as formatted document (for FAA package)

### B2. TCO Editor

Edit the Training Course Outline -- the formal FAA submission document.

**Data:**

- Course overview (purpose, audience, delivery method, duration)
- Module list with objectives, time, methods, assessment per module
- Assessment strategy
- Time & engagement model
- Records & reporting description
- System description summary

**Behavior:**

- Structured form editing (not free-text document editing)
- Auto-populated fields where data exists (module times, topic coverage)
- Preview as formatted document
- Version controlled with the content versioning system

### B3. FAA Package Generator

One-button generation of the complete submission package.

**Outputs:**

1. TCO document (from B2 data)
2. Traceability matrix (from B1 data)
3. Time allocation report (computed from scenario/module data)
4. Assessment plan (from question bank and scoring system)
5. System description (templated, high-level)

**Behavior:**

- Generate all 5 documents as downloadable package
- Validate before generation (all compliance checks must pass)
- Tag content versions included in the package
- Archive generated package with timestamp

### B4. Submission Tracker

Track the FAA approval process.

**Data:**

- Submission date, package version
- Status (preparing, submitted, under review, revision requested, approved, denied)
- Revision history (each round of changes)
- FAA contact info
- Notes per interaction
- Next action required, due date

**Behavior:**

- Timeline view of submission history
- Link to generated packages
- Reminders for follow-up actions
- Track approval period (24 months from approval, then renewal needed)

### B5. Regulatory Change Monitor

Detect and respond to FAA regulatory changes.

**Behavior:**

- Manual check-in workflow (prompted every 90 days per AC 61-83K)
- Checklist: visited FAA FIRC page, reviewed AC updates, checked CFR changes
- Log each check with date and findings
- Auto-create tasks when changes are found
- Link affected content items to the change
- Track resolution: content updated, revalidated, resubmitted if needed

### B6. Compliance Dashboard

Single view: are we compliant right now?

**Displays:**

- Content validation results (from A9)
- Traceability matrix completeness
- Last regulatory check date (and countdown to next)
- Exam rotation status (have questions changed since last renewal?)
- Approval period status (months remaining, renewal due date)
- Outstanding compliance tasks

---

## C. Reference Document Library

### C1. Document Store

Organize external reference documents.

**Data:**

- Document ID, title, type (AC, CFR, handbook, NTSB report, other)
- Source (FAA, NTSB, TSA, other)
- Version/date
- File (PDF, or link)
- Tags
- Notes

**Behavior:**

- Upload and categorize documents
- Search by title, type, tag
- Link documents to scenarios, modules, competencies, questions
- Track which version we're building against vs latest available

### C2. Reference Links

Connect reference documents to course content.

**Behavior:**

- From any content item, link to relevant reference docs
- From any reference doc, see all content that cites it
- When a reference doc is updated, flag all linked content for review

---

## D. Product & Task Management

### D1. Task Board

Kanban board for tracking work.

**Columns:** Backlog, Todo, In Progress, Review, Done

**Data per task:**

- Title, description
- Type: feature, bug, content, compliance, research
- Product area: sim, hangar, ops, engine, content
- Priority: critical, high, medium, low
- Assignee
- Due date (optional)
- Linked content items (optional -- for content/compliance tasks)
- Status

**Behavior:**

- Drag between columns
- Filter by type, product area, assignee, priority
- Quick-add from any view
- Content tasks auto-link: "Write scenario SCN-LOC-01" links to that scenario

### D2. Backlog

Prioritized list view of all tasks not yet on the board.

**Behavior:**

- Drag to reorder priority
- Bulk move to board
- Filter by product area, type

### D3. Activity Log

Who did what, when.

**Scope:** All hangar actions -- content edits, task changes, compliance checks, package generation, document uploads.

**Behavior:**

- Filterable timeline
- Link from log entry to the affected item
- Exportable for audit purposes

### D4. Auto-Generated Tasks

System creates tasks automatically for:

- Regulatory change detection (from B5)
- Content validation failures (from A9)
- Exam rotation due dates (from B6)
- Approval renewal approaching (from B4)
- Reference document updates (from C2)

---

## E. Content Analytics

### E1. Coverage Dashboard

Visual overview of content across FAA topics and competencies.

**Displays:**

- Heat map: FAA topics (rows) x modules (columns), colored by coverage depth
- Competency coverage: which competencies have scenarios, which don't
- Gap list: topics/competencies below threshold

### E2. Scenario Inventory

**Displays:**

- Total scenarios by status (draft, published, archived)
- Scenarios per FAA topic
- Scenarios per competency
- Difficulty distribution
- Estimated play time per topic

### E3. Question Bank Stats

**Displays:**

- Total questions by status
- Questions per topic, per module
- Randomization pool depth (are there enough variants?)
- Questions approaching retirement (age tracking)

### E4. Time Projection

**Displays:**

- Estimated learner time per FAA topic given current scenarios
- Comparison to 45-min minimum per topic
- Total estimated course time vs 16-hour minimum
- Alerts for topics trending under threshold
