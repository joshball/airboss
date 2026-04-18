---
title: Task Board -- Spec
product: hangar
feature: task-board
type: spec
status: done
---

# Task Board -- Spec

Kanban task board for tracking product work in hangar. Located at `/tasks/board`.

## Data Model

| Table          | Schema     | Key Fields                                                                                                                                           |
| -------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `board`        | `platform` | `id`, `name`, `createdAt`                                                                                                                            |
| `board_column` | `platform` | `id`, `boardId` (FK -> board), `name`, `sortOrder`                                                                                                   |
| `task`         | `platform` | `id`, `boardId`, `columnId` (FK -> board_column), `title`, `description`, `type`, `productArea`, `assigneeId`, `sortOrder`, `createdAt`, `updatedAt` |

Relationships: `board` 1->N `board_column` 1->N `task`.

## Auto-Setup

On first visit to `/tasks/board`, if no board exists, the server load function creates:

- One board named "Hangar Board"
- Four columns from `DEFAULT_BOARD_COLUMNS`: Backlog, In Progress, Review, Done

No manual setup required.

## Task Fields

| Field         | Required | Values                                              |
| ------------- | -------- | --------------------------------------------------- |
| `title`       | Yes      | String, max 200 chars                               |
| `description` | No       | Free text                                           |
| `columnId`    | Yes      | Must reference an existing column                   |
| `type`        | No       | `TASK_TYPES`: feature, bug, chore, research         |
| `productArea` | No       | `PRODUCT_AREAS`: hangar, sim, ops, runway, platform |

Validation via `createTaskSchema` (Zod) in `libs/types/src/schemas.ts`.

## Drag-and-Drop

- HTML5 drag events (`dragstart`, `dragover`, `dragleave`, `drop`) on task cards and columns.
- On drop: `fetch('?/move', ...)` posts `taskId` + `columnId` to the `move` form action.
- `invalidateAll()` reloads data after move.
- Visual feedback: `drag-over` class on target column during hover.
- No-op if dropped on the same column the task already belongs to.

## Filtering

Two client-side select dropdowns filter the displayed tasks:

- **Type filter** -- filters by `TASK_TYPES` values.
- **Product area filter** -- filters by `PRODUCT_AREAS` values.
- "Clear filters" button appears when either filter is active.
- Filtering is client-side via `$derived` -- no server round-trip.

## Routes

| Route                        | Purpose             |
| ---------------------------- | ------------------- |
| `/tasks/board`               | Board view (kanban) |
| `/tasks/board/new`           | Create task form    |
| `/tasks/board/[taskId]/edit` | Edit task form      |

Delete is handled inline via a form action on the board page with a `confirm()` dialog.

## Sidebar Nav

Tasks section in the hangar sidebar with a single item: "Board" linking to `/tasks/board`.
