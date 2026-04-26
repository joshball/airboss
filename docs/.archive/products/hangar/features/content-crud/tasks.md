---
title: Content CRUD -- Tasks
product: hangar
feature: content-crud
type: tasks
status: done
---

# Content CRUD -- Tasks

Feature: Full CRUD for 6 course content types in hangar.
Status: **All tasks complete**

## BC Manage Functions

`libs/bc/course/src/manage.ts`

- [x] Scenario: createScenario, updateScenario, deleteScenario, getScenario, listScenarios
- [x] Module: createModule, updateModule, getModule, listModules
- [x] Question: createQuestion, updateQuestion, deleteQuestion, getQuestion, listQuestions
- [x] Micro-lesson: createMicroLesson, updateMicroLesson, deleteMicroLesson, getMicroLesson, listMicroLessons
- [x] Student model: createStudentModel, updateStudentModel, deleteStudentModel, getStudentModel, listStudentModels
- [x] Competency: listCompetencies

## Zod Validation Schemas

`libs/types/src/schemas.ts`

- [x] createScenarioSchema (title, briefing, difficulty, duration, studentModelId, competencies, faaTopics)
- [x] updateModuleSchema (title, timeAllocation, sortOrder, scenarioIds)
- [x] createQuestionSchema (text, type, options, correctAnswer, topic, moduleId, poolId)
- [x] createMicroLessonSchema (title, content, triggerContext)
- [x] createStudentModelSchema (name, parameters with 7 float fields)

## Routes -- List Views

| Entity         | Route             | Server + Page | Delete Action | Edit Links |
| -------------- | ----------------- | :-----------: | :-----------: | :--------: |
| Scenarios      | `/scenarios`      |      [x]      |      [x]      |    [x]     |
| Modules        | `/modules`        |      [x]      |      n/a      |    [x]     |
| Questions      | `/questions`      |      [x]      |      [x]      |    [x]     |
| Micro-lessons  | `/micro-lessons`  |      [x]      |      [x]      |    [x]     |
| Student models | `/student-models` |      [x]      |      [x]      |    [x]     |
| Competencies   | `/competencies`   |      [x]      |      n/a      |    n/a     |

## Routes -- Create Views

| Entity         | Route                 | Server + Page |
| -------------- | --------------------- | :-----------: |
| Scenarios      | `/scenarios/new`      |      [x]      |
| Questions      | `/questions/new`      |      [x]      |
| Micro-lessons  | `/micro-lessons/new`  |      [x]      |
| Student models | `/student-models/new` |      [x]      |

## Routes -- Edit Views

| Entity         | Route                       | Server + Page |
| -------------- | --------------------------- | :-----------: |
| Scenarios      | `/scenarios/[id]/edit`      |      [x]      |
| Modules        | `/modules/[id]/edit`        |      [x]      |
| Questions      | `/questions/[id]/edit`      |      [x]      |
| Micro-lessons  | `/micro-lessons/[id]/edit`  |      [x]      |
| Student models | `/student-models/[id]/edit` |      [x]      |
