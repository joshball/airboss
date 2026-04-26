---
title: Task Board -- Test Plan
product: hangar
feature: task-board
type: test-plan
status: done
---

# Task Board -- Test Plan

Manual test plan. Run with hangar dev server (`bun run dev` in `apps/hangar`).

## Prerequisites

- PostgreSQL running (OrbStack)
- Database migrated with platform schema
- Hangar app running locally

## Tests

### 1. First Visit -- Auto-Setup

| Step | Action                                         | Expected                                                                 |
| ---- | ---------------------------------------------- | ------------------------------------------------------------------------ |
| 1.1  | Navigate to `/tasks/board` with empty database | Board auto-creates with name "Hangar Board"                              |
| 1.2  | Verify columns                                 | Four columns visible: Backlog, In Progress, Review, Done (in that order) |
| 1.3  | Verify empty state                             | Each column shows "No tasks" and a count badge of 0                      |

### 2. Create Task

| Step | Action                                                                 | Expected                                          |
| ---- | ---------------------------------------------------------------------- | ------------------------------------------------- |
| 2.1  | Click "Add task" button on board page                                  | Navigates to `/tasks/board/new`                   |
| 2.2  | Submit form with empty title                                           | Validation error: "Title is required"             |
| 2.3  | Fill title "Test task", select column "Backlog", leave type/area blank | Form submits, redirects to board                  |
| 2.4  | Verify card in Backlog column                                          | Card shows title "Test task", no type/area badges |
| 2.5  | Create another task with type "bug" and area "sim"                     | Card shows title, "bug" badge, "sim" badge        |

### 3. Edit Task

| Step | Action                                                  | Expected                                                    |
| ---- | ------------------------------------------------------- | ----------------------------------------------------------- |
| 3.1  | Click "Edit" on a task card                             | Navigates to edit page, form pre-filled with current values |
| 3.2  | Change title to "Updated task"                          | Saves, redirects to board, card shows new title             |
| 3.3  | Change column from Backlog to In Progress via edit form | Task appears in In Progress column after save               |
| 3.4  | Set type and product area on a task that had none       | Badges now appear on the card                               |

### 4. Delete Task

| Step | Action                         | Expected                                         |
| ---- | ------------------------------ | ------------------------------------------------ |
| 4.1  | Click "Delete" on a task card  | Browser `confirm()` dialog appears               |
| 4.2  | Click Cancel on the dialog     | Task remains, no changes                         |
| 4.3  | Click "Delete" again, click OK | Task removed from column, count badge decrements |

### 5. Drag-and-Drop

| Step | Action                                        | Expected                                            |
| ---- | --------------------------------------------- | --------------------------------------------------- |
| 5.1  | Drag a task card from Backlog to Review       | Card moves to Review column, count badges update    |
| 5.2  | Refresh the page                              | Task still in Review column (persisted server-side) |
| 5.3  | Drag a task to the column it already occupies | No-op, no visual glitch                             |
| 5.4  | Drag task from Done back to Backlog           | Card moves to Backlog                               |

### 6. Filters

| Step | Action                                                  | Expected                                                   |
| ---- | ------------------------------------------------------- | ---------------------------------------------------------- |
| 6.1  | Set type filter to "bug"                                | Only tasks with type "bug" visible across all columns      |
| 6.2  | Set area filter to "sim"                                | Only tasks matching both "bug" type AND "sim" area visible |
| 6.3  | Clear type filter (set to "All types")                  | Tasks matching "sim" area shown regardless of type         |
| 6.4  | Click "Clear filters" button                            | All tasks visible again, button disappears                 |
| 6.5  | Verify "Clear filters" not shown when no filters active | Button hidden when both selects are at default             |

### 7. Edge Cases

| Step | Action                                                  | Expected                                        |
| ---- | ------------------------------------------------------- | ----------------------------------------------- |
| 7.1  | Create task with only title + column (no type, no area) | Task created successfully, no badges shown      |
| 7.2  | Create task with title at max length (200 chars)        | Accepted and displayed correctly                |
| 7.3  | Create task with title > 200 chars                      | Validation rejects                              |
| 7.4  | Navigate to edit page for non-existent task ID          | 404 error page                                  |
| 7.5  | Revisit `/tasks/board` after board already exists       | Loads existing board, does not create duplicate |
