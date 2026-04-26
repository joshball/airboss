---
title: Task Board -- Tasks
product: hangar
feature: task-board
type: tasks
status: done
---

# Task Board -- Tasks

All tasks completed. This is a retroactive record of the implementation.

## Implementation

| #   | Task                                                                                                                                                                           | Status |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 1   | Schema: `board`, `board_column`, `task` tables in `platform` namespace                                                                                                         | [x]    |
| 2   | BC functions: `createBoard`, `listBoards`, `createColumn`, `listColumns`, `getTask`, `createTask`, `updateTask`, `listTasks`, `deleteTask` in `libs/bc/platform/src/manage.ts` | [x]    |
| 3   | Constants: `TASK_TYPES`, `PRODUCT_AREAS`, `DEFAULT_BOARD_COLUMNS` in `libs/constants/src/tasks.ts`                                                                             | [x]    |
| 4   | Zod schema: `createTaskSchema` in `libs/types/src/schemas.ts`                                                                                                                  | [x]    |
| 5   | Route constants: `TASKS_BOARD`, `TASK_NEW`, `TASK_EDIT` in `libs/constants/src/routes.ts`                                                                                      | [x]    |
| 6   | Board page: kanban layout at `/tasks/board` with auto-setup on first visit                                                                                                     | [x]    |
| 7   | Create task: form at `/tasks/board/new` with title, description, column, type, product area                                                                                    | [x]    |
| 8   | Edit task: form at `/tasks/board/[taskId]/edit` with pre-filled values                                                                                                         | [x]    |
| 9   | Delete task: inline form action with `confirm()` dialog on board page                                                                                                          | [x]    |
| 10  | Drag-and-drop: HTML5 drag events + fetch to `?/move` action + `invalidateAll()`                                                                                                | [x]    |
| 11  | Filter controls: type and product area dropdowns with clear button                                                                                                             | [x]    |
| 12  | Sidebar nav: "Tasks" section with "Board" link in hangar layout                                                                                                                | [x]    |

## File Inventory

| File                                                                     | Purpose                             |
| ------------------------------------------------------------------------ | ----------------------------------- |
| `libs/bc/platform/src/schema.ts`                                         | Database tables                     |
| `libs/bc/platform/src/manage.ts`                                         | CRUD operations                     |
| `libs/constants/src/tasks.ts`                                            | Type/area/column constants          |
| `libs/constants/src/routes.ts`                                           | Route constants                     |
| `libs/types/src/schemas.ts`                                              | Zod validation (`createTaskSchema`) |
| `apps/hangar/src/routes/(app)/tasks/board/+page.server.ts`               | Board load + move/delete actions    |
| `apps/hangar/src/routes/(app)/tasks/board/+page.svelte`                  | Board UI (kanban, drag, filters)    |
| `apps/hangar/src/routes/(app)/tasks/board/new/+page.server.ts`           | Create task load + action           |
| `apps/hangar/src/routes/(app)/tasks/board/new/+page.svelte`              | Create task form                    |
| `apps/hangar/src/routes/(app)/tasks/board/[taskId]/edit/+page.server.ts` | Edit task load + action             |
| `apps/hangar/src/routes/(app)/tasks/board/[taskId]/edit/+page.svelte`    | Edit task form                      |
