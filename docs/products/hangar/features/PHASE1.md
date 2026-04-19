# Hangar Phase 1: Foundation

All features implemented. Manual testing required before marking Phase 1 complete.

## Setup

```bash
bun scripts/db.ts push        # push schema to local DB
bun scripts/db/seed.ts         # seed competencies (22), modules (6), dev user
bun scripts/dev.ts hangar      # start hangar at localhost:7610
```

Sign in with `joshua@ball.dev` / `Pa33word!` (seeded dev user).

## Features

| #   | Feature                                       | Work package                    | Status      | Test plan                                     | Tested |
| --- | --------------------------------------------- | ------------------------------- | ----------- | --------------------------------------------- | ------ |
| 1   | [Auth](auth/user-stories.md)                  | user-stories                    | Implemented | In stories                                    | [ ]    |
| 2   | [Content CRUD](content-crud/)                 | spec, tasks, test-plan, stories | Implemented | [test-plan.md](content-crud/test-plan.md)     | [ ]    |
| 3   | [Task Board](task-board/)                     | spec, tasks, test-plan          | Implemented | [test-plan.md](task-board/test-plan.md)       | [ ]    |
| 4   | [Theme Editor](theme-editor/)                 | spec, tasks, test-plan          | Implemented | [test-plan.md](theme-editor/test-plan.md)     | [ ]    |
| 5   | [Content Publishing](publish/user-stories.md) | user-stories                    | Implemented | In stories (PUB-1, PUB-3)                     | [ ]    |
| 6   | [Published Viewer](published-viewer/)         | spec, tasks, test-plan          | Implemented | [test-plan.md](published-viewer/test-plan.md) | [ ]    |

## Test Order

Test in this order -- later features depend on earlier ones having data.

1. **Auth** -- sign in, sign out, session persistence, register. Everything else requires auth.
2. **Content CRUD** -- create one of each entity type (scenario, module, question, micro-lesson, student model). Verify list, edit, delete. Competencies should already be seeded (read-only).
3. **Theme Editor** -- switch themes, toggle light/dark, adjust scale. Verify persistence across refresh.
4. **Task Board** -- navigate to Tasks > Board. Auto-creates columns on first visit. Create tasks, drag between columns, filter by type/area.
5. **Content Publishing** -- from `/publish`, enter version "1.0.0" and publish. Verify success message with counts.
6. **Published Viewer** -- click "View release" link. Verify all 6 content sections show data matching what you created. Verify `correctAnswer` is not shown on questions.

## Test Notes

- **Content CRUD depends on seed data.** Competencies are seeded and read-only. Modules are seeded but editable. Scenarios require a student model to exist first (foreign key).
- **Publishing requires content.** Create at least one scenario, question, and micro-lesson before publishing.
- **Published viewer requires a publish.** The "View release" link only appears after at least one publish.
- **Theme changes are localStorage only.** Clearing browser data resets to defaults.
- **Task board auto-seeds on first visit.** No manual setup needed -- 4 default columns are created automatically.

## Exit Criteria

- [ ] All 6 features pass their manual test plans
- [ ] Can create a scenario, assign to module, link competencies, create questions
- [ ] Can publish content to `published` schema
- [ ] Published content viewable by release (all 6 content types)
- [ ] Seed data loaded and visible (22 competencies, 6 modules)
- [ ] `bun run check` passes with 0 errors

## Deferred

- Unit/E2E automated tests for published viewer (requires running DB + dev server)
- Backfill automated tests for content CRUD and task board BC functions
