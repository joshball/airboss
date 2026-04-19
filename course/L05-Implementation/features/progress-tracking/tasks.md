---
title: "Tasks: Progress Tracking"
product: sim
feature: progress-tracking
type: tasks
status: done
---

# Tasks: Progress Tracking

## Pre-flight

- [x] Read `docs/agents/best-practices.md` -- Svelte 5, form patterns
- [x] Review `libs/bc/enrollment/src/schema.ts` -- enrollment, module_progress, time_log, certificate tables
- [x] Review `libs/bc/enrollment/src/write.ts` -- existing read functions
- [x] Review `libs/constants/src/course.ts` -- FAA_TOPICS list

## Implementation

### 1. New BC read functions

- [x] Add `getOwnTimeLog(enrollmentId)` to `libs/bc/enrollment/src/write.ts`
- [x] Add `getOwnCertificate(enrollmentId)` to `libs/bc/enrollment/src/write.ts`
- [x] Run `bun run check` -- 0 errors, commit

### 2. Route

- [x] Add `ROUTES.SIM_PROGRESS` to `libs/constants/src/routes.ts` if not already added
- [x] Create `apps/sim/src/routes/progress/+page.server.ts`:
  - Load enrollment for current user
  - If no enrollment: return `{ enrolled: false }`
  - Load module progress, time log, certificate
  - Load published modules (for titles)
  - Compute: total FAA time, per-topic time, module statuses
- [x] Run `bun run check` -- 0 errors, commit

### 3. Progress page

- [x] Create `apps/sim/src/routes/progress/+page.svelte`:
  - [x] Enrollment status card (not enrolled / enrolled / completed)
  - [x] Module list: 6 rows with title, status chip, progress bar
  - [x] FAA topic table: 13 topics, time logged, covered/in-progress/not-started
  - [x] Total time summary: FAA-qualified HH:MM, progress bar vs 16:00, exploratory time
  - [x] Completion checklist (16h, all topics, all modules, assessments -- last one deferred)
  - [x] Certificate section (if exists -- deferred to Phase 3, show placeholder)
  - [x] "Not enrolled" empty state
- [x] Run `bun run check` -- 0 errors, commit

### 4. FAA topic time computation

- [x] Verify `FAA_TOPICS` constant exists and has all 13 topic codes
- [x] Time computation: sum `time_log.durationSeconds` where `topic` matches FAA topic code
- [x] Covered threshold: >= 2700 seconds (45 minutes)
- [x] Run `bun run check` -- 0 errors, commit

## Post-implementation

- [ ] Full manual test per `test-plan.md`
- [ ] Request implementation review
- [x] Update TASKS.md (mark progress-tracking complete)
- [x] Commit docs updates
