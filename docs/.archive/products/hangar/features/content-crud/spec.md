---
title: Content CRUD -- Spec
product: hangar
feature: content-crud
type: spec
status: done
---

# Content CRUD -- Spec

Feature: Full CRUD for 6 course content types in hangar.
Status: **Implemented**

## Overview

Content authors use hangar to create and manage all course content. Business logic lives in `libs/bc/course/src/manage.ts`. Routes are thin SvelteKit shells with form actions. Validation via Zod schemas in `libs/types/src/schemas.ts`.

## Entities

| Entity        | Table                  | Operations                         | Routes                                                                |
| ------------- | ---------------------- | ---------------------------------- | --------------------------------------------------------------------- |
| Scenario      | `course.scenario`      | Create, Read, Update, Delete, List | `/scenarios`, `/scenarios/new`, `/scenarios/[id]/edit`                |
| Module        | `course.module`        | Read, Update, List                 | `/modules`, `/modules/[id]/edit`                                      |
| Question      | `course.question`      | Create, Read, Update, Delete, List | `/questions`, `/questions/new`, `/questions/[id]/edit`                |
| Micro-lesson  | `course.micro_lesson`  | Create, Read, Update, Delete, List | `/micro-lessons`, `/micro-lessons/new`, `/micro-lessons/[id]/edit`    |
| Student model | `course.student_model` | Create, Read, Update, Delete, List | `/student-models`, `/student-models/new`, `/student-models/[id]/edit` |
| Competency    | `course.competency`    | List (read-only)                   | `/competencies`                                                       |

## Entity Fields

### Scenario

| Field          | Type           | Validation                  |
| -------------- | -------------- | --------------------------- |
| title          | text           | Required, max 200           |
| briefing       | text           | Required                    |
| difficulty     | real (0-1)     | Required, 0-1 range         |
| duration       | integer        | Required, >= 1 minute       |
| studentModelId | text (FK)      | Required                    |
| competencies   | jsonb string[] | At least one required       |
| faaTopics      | jsonb string[] | At least one required       |
| tickScript     | jsonb          | Defaults to `{"ticks": []}` |
| status         | text           | Defaults to "draft"         |

### Module

| Field          | Type           | Validation            |
| -------------- | -------------- | --------------------- |
| title          | text           | Required, max 200     |
| timeAllocation | integer        | Required, >= 1 minute |
| sortOrder      | integer        | Required, >= 0        |
| scenarioIds    | jsonb string[] | Array of scenario IDs |

Modules are seeded (6 from COURSE_STRUCTURE.md). No create/delete in current implementation.

### Question

| Field         | Type           | Validation                                                     |
| ------------- | -------------- | -------------------------------------------------------------- |
| text          | text           | Required                                                       |
| type          | text           | "multiple-choice" or "multiple-select" (no true/false per FAA) |
| options       | jsonb string[] | At least 4 required                                            |
| correctAnswer | text           | Required                                                       |
| topic         | text           | Required (FAA topic)                                           |
| moduleId      | text           | Optional                                                       |
| poolId        | text           | Optional                                                       |
| status        | text           | Defaults to "draft"                                            |

### Micro-lesson

| Field          | Type | Validation          |
| -------------- | ---- | ------------------- |
| title          | text | Required            |
| content        | text | Required            |
| triggerContext | text | Optional            |
| status         | text | Defaults to "draft" |

### Student Model

| Field      | Type  | Validation                                                                                                                               |
| ---------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| name       | text  | Required                                                                                                                                 |
| parameters | jsonb | Object with 7 float fields (0-1 each): skillLevel, compliance, freezeTendency, overconfidence, instrumentAccuracy, startleDelay, fatigue |

### Competency

| Field     | Type           | Notes                          |
| --------- | -------------- | ------------------------------ |
| id        | text           | e.g. "CJ-1"                    |
| domain    | text           | CJ, AC, RM, AV, OD, RC, ES, PS |
| faaTopic  | text           | FAA topic reference            |
| skill     | text           | Skill description              |
| behaviors | jsonb string[] | Observable behaviors           |
| required  | boolean        | Defaults to true               |

Read-only. Seeded from `COMPETENCY_GRAPH.md`. 24 competencies across 8 domains.
