---
title: Content CRUD -- Test Plan
product: hangar
feature: content-crud
type: test-plan
status: done
---

# Content CRUD -- Test Plan

Manual test plan for retroactive validation. Run with hangar dev server and seeded DB.

## Setup

1. Start DB: `bun run db up`
2. Seed DB: `bun run db seed`
3. Start hangar: `cd apps/hangar && bun run dev`
4. Open `http://localhost:5174`

## CRUD Tests per Entity

### Scenarios

| Step | Action                                                                                                                                             | Expected                                             |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1    | Go to `/scenarios`                                                                                                                                 | List page loads. Shows table or empty state          |
| 2    | Click "Create scenario"                                                                                                                            | Navigates to `/scenarios/new`                        |
| 3    | Submit empty form                                                                                                                                  | Validation errors appear (title required, etc.)      |
| 4    | Fill: title "Test Scenario", briefing "Test briefing text", difficulty 0.5, duration 10, select student model, select competency, select FAA topic | Form accepts input                                   |
| 5    | Submit                                                                                                                                             | Redirects to `/scenarios`, new scenario in list      |
| 6    | Click edit link on new scenario                                                                                                                    | Navigates to `/scenarios/[id]/edit`, form pre-filled |
| 7    | Change title to "Updated Scenario", submit                                                                                                         | Redirects to list, title updated                     |
| 8    | Click delete on scenario, confirm                                                                                                                  | Scenario removed from list                           |

### Modules

| Step | Action                               | Expected                                           |
| ---- | ------------------------------------ | -------------------------------------------------- |
| 1    | Go to `/modules`                     | Shows 6 seeded modules                             |
| 2    | Click edit on a module               | Navigates to `/modules/[id]/edit`, form pre-filled |
| 3    | Change time allocation, submit       | Redirects to list, value updated                   |
| 4    | No create or delete controls visible | Modules are seeded only                            |

### Questions

| Step | Action                                                                                                | Expected                            |
| ---- | ----------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 1    | Go to `/questions`                                                                                    | List page loads                     |
| 2    | Click create                                                                                          | Navigates to `/questions/new`       |
| 3    | Submit empty form                                                                                     | Validation errors appear            |
| 4    | Fill: text "What is RAIM?", type "multiple-choice", 4 options, correct answer, topic, optional module | Form accepts input                  |
| 5    | Submit                                                                                                | Redirects to list, question appears |
| 6    | Edit the question, change text                                                                        | Changes saved                       |
| 7    | Delete the question                                                                                   | Removed from list                   |

### Micro-lessons

| Step | Action                                                                                   | Expected                        |
| ---- | ---------------------------------------------------------------------------------------- | ------------------------------- |
| 1    | Go to `/micro-lessons`                                                                   | List page loads                 |
| 2    | Create with title "RAIM Failure", content "When RAIM fails...", optional trigger context | Redirects to list, item appears |
| 3    | Edit, change title                                                                       | Changes saved                   |
| 4    | Delete                                                                                   | Removed from list               |

### Student Models

| Step | Action                                                               | Expected                         |
| ---- | -------------------------------------------------------------------- | -------------------------------- |
| 1    | Go to `/student-models`                                              | List page loads                  |
| 2    | Create with name "Nervous Student", all 7 parameters set (0-1 range) | Redirects to list, model appears |
| 3    | Edit, change name                                                    | Changes saved                    |
| 4    | Delete                                                               | Removed from list                |

### Competencies

| Step | Action                                           | Expected                                |
| ---- | ------------------------------------------------ | --------------------------------------- |
| 1    | Go to `/competencies`                            | Shows 24 competencies grouped by domain |
| 2    | Verify 8 domains: CJ, AC, RM, AV, OD, RC, ES, PS | All present                             |
| 3    | Verify no create/edit/delete controls            | Read-only                               |

## Validation Tests

| Test                     | Route                 | Action                  | Expected                            |
| ------------------------ | --------------------- | ----------------------- | ----------------------------------- |
| Empty scenario title     | `/scenarios/new`      | Submit with empty title | "Title is required" error           |
| Difficulty out of range  | `/scenarios/new`      | Enter difficulty 1.5    | "Must be 0-1" error                 |
| Duration zero            | `/scenarios/new`      | Enter duration 0        | "Must be at least 1 minute" error   |
| Empty question text      | `/questions/new`      | Submit with empty text  | "Question text is required" error   |
| Too few options          | `/questions/new`      | Submit with 2 options   | "At least 4 options required" error |
| Empty student model name | `/student-models/new` | Submit with empty name  | "Name is required" error            |
| Parameter out of range   | `/student-models/new` | Enter skillLevel 2.0    | Validation error on parameters      |

## Navigation Tests

| Test                | Action                               | Expected                                       |
| ------------------- | ------------------------------------ | ---------------------------------------------- |
| Back from create    | Click back/cancel on any create form | Returns to entity list                         |
| Back from edit      | Click back/cancel on any edit form   | Returns to entity list                         |
| Edit link from list | Click edit icon/link on any list row | Goes to correct edit page with pre-filled form |

## Edge Cases

| Test                  | Entity       | Action                                               | Expected                                         |
| --------------------- | ------------ | ---------------------------------------------------- | ------------------------------------------------ |
| Duplicate name        | Scenario     | Create two scenarios with same title                 | Both created (titles are not unique-constrained) |
| Special characters    | Scenario     | Create with title containing `<script>`, `&`, quotes | Title stored and displayed correctly (no XSS)    |
| Special characters    | Question     | Create with options containing HTML entities         | Options stored and rendered safely               |
| Long text             | Micro-lesson | Create with very long content (1000+ chars)          | Saves and displays without truncation issues     |
| Empty optional fields | Question     | Create with no moduleId, no poolId                   | Saves with nulls                                 |
| Empty optional fields | Micro-lesson | Create with no triggerContext                        | Saves with null                                  |
