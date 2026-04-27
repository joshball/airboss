---
title: "User Stories: Content CRUD"
product: hangar
feature: content-crud
type: user-stories
status: done
---

# User Stories: Content CRUD

Feature: Create, read, update, delete content items in hangar.
Status: **Not started**

Covers: scenarios, modules, questions, micro-lessons, student models, competencies.

## Scenario Stories

### CRUD-1: List all scenarios

**As** a content author,
**I want to** see all scenarios in a table,
**So that** I can find and manage them.

**Acceptance:**

- [ ] Table shows: title, difficulty, duration, competencies count, status, updated date
- [ ] Empty state shows "No scenarios yet" with a create button
- [ ] Table is sortable by column headers
- [ ] Pagination when > 20 items

**Test:**

1. Go to `/scenarios`
2. With no scenarios: verify empty state message + "Create scenario" button
3. After creating scenarios: verify table columns, sort by title, sort by difficulty

---

### CRUD-2: Create a new scenario

**As** a content author,
**I want to** create a scenario with metadata,
**So that** I can start building course content.

**Acceptance:**

- [ ] Form fields: title, briefing (textarea), difficulty (number 0-1), duration (minutes), student model (dropdown), competencies (multi-select), FAA topics (multi-select)
- [ ] All fields validate (title required, difficulty 0-1, duration > 0)
- [ ] Validation errors show inline next to fields
- [ ] Successful create redirects to scenario list
- [ ] New scenario appears in list with status "draft"
- [ ] tick_script defaults to `{"ticks": []}`

**Test:**

1. Go to `/scenarios`, click "Create scenario"
2. Leave title empty, submit -- verify title error appears
3. Fill in: title "Base-to-Final Stall", briefing "Student overshoots base to final...", difficulty 0.6, duration 15, select student model, select CJ-1 + AC-1 competencies, select A.11 topic
4. Submit
5. Verify: redirected to list, new scenario in table with status "draft"
6. Verify DB: `docker exec firc-db psql -U firc -c "SELECT title, status, difficulty FROM course.scenario;"`

---

### CRUD-3: Edit an existing scenario

**As** a content author,
**I want to** edit a scenario's metadata,
**So that** I can refine content as I develop it.

**Acceptance:**

- [ ] Edit form pre-fills all current values
- [ ] Changes save and redirect to list
- [ ] Updated date changes

**Test:**

1. From scenario list, click edit on a scenario
2. Change title, change difficulty
3. Submit
4. Verify: list shows updated title and difficulty

---

### CRUD-4: Delete a scenario

**As** a content author,
**I want to** delete a draft scenario,
**So that** I can clean up unused content.

**Acceptance:**

- [ ] Delete button shows confirmation dialog
- [ ] Confirming deletes the scenario
- [ ] Scenario disappears from list
- [ ] Cannot delete published scenarios (future: for now all are draft)

**Test:**

1. From scenario list, click delete on a scenario
2. Confirm in dialog
3. Verify: scenario removed from list and DB

---

## Module Stories

### CRUD-5: List all modules

**As** a content author,
**I want to** see all modules with their scenario counts and time allocations,
**So that** I can plan the course structure.

**Acceptance:**

- [ ] Table shows: title, scenario count, time allocation (minutes), sort order
- [ ] Seeded modules appear (6 modules from COURSE_STRUCTURE.md)

**Test:**

1. Go to `/modules`
2. Verify: 6 seeded modules visible with correct time allocations

---

### CRUD-6: Edit a module

**As** a content author,
**I want to** edit a module's title, time allocation, and scenario assignments,
**So that** I can structure the course.

**Acceptance:**

- [ ] Edit form shows current values
- [ ] Can change title, time allocation
- [ ] Can assign/remove scenarios (from existing scenarios)
- [ ] Save updates the module

**Test:**

1. Click edit on Module 1
2. Change time allocation from 165 to 180
3. Assign a scenario (if one exists)
4. Save
5. Verify: updated values in list

---

## Question Stories

### CRUD-7: List all questions

**As** a content author,
**I want to** see all questions with topic, type, and module assignment,
**So that** I can manage the question bank.

**Acceptance:**

- [ ] Table shows: text (truncated), type, topic, module, status
- [ ] Empty state with create button

---

### CRUD-8: Create a question

**As** a content author,
**I want to** create a multiple-choice question,
**So that** I can build the 60+ question bank required by FAA.

**Acceptance:**

- [ ] Fields: question text (textarea), type (dropdown: multiple-choice, multiple-select), options (4+ text fields), correct answer, topic (dropdown of FAA topics), module (dropdown), pool ID
- [ ] No true/false type available (per FAA rules)
- [ ] At least 4 options required for multiple-choice
- [ ] Correct answer must match one of the options

**Test:**

1. Go to `/questions`, click create
2. Enter question text, select multiple-choice, add 4 options, select correct answer, assign topic A.11, assign to Module 3
3. Submit
4. Verify: question in list with correct topic and module

---

## Micro-Lesson Stories

### CRUD-9: Create and list micro-lessons

**As** a content author,
**I want to** create just-in-time micro-lessons,
**So that** learners see definitions/regulations when they need them in scenarios.

**Acceptance:**

- [ ] Fields: title, content (rich text or textarea), trigger context
- [ ] List shows title, trigger context, status

**Test:**

1. Go to `/micro-lessons`, click create
2. Enter title "RAIM Failure Procedures", content (paragraph), trigger "RAIM failure detected"
3. Submit, verify in list

---

## Student Model Stories

### CRUD-10: Create and list student models

**As** a content author,
**I want to** define student behavior models,
**So that** scenarios have varied, realistic student responses.

**Acceptance:**

- [ ] Fields: name, parameters (JSON or structured form: skill_level, compliance, freeze_tendency, overconfidence, instrument_accuracy, startle_delay, fatigue)
- [ ] List shows name and key parameter summary

**Test:**

1. Go to `/student-models`, click create
2. Enter name "Nervous Student", set high freeze_tendency, low skill_level
3. Submit, verify in list

---

## Competency Stories

### CRUD-11: Browse competencies

**As** a content author,
**I want to** browse the competency registry by domain,
**So that** I can assign competencies to scenarios.

**Acceptance:**

- [ ] Read-only view (competencies are seeded, not authored in Phase 1)
- [ ] Grouped by domain (CJ, AC, RM, AV, OD, RC, ES, PS)
- [ ] Each shows: ID, skill description, FAA topic, behaviors list
- [ ] 24 competencies total

**Test:**

1. Go to `/competencies`
2. Verify: 8 domain groups, 24 competencies
3. Expand CJ domain, verify CJ-1, CJ-2, CJ-3 with correct skills
