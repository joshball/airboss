# Hangar Tasks

Phases 1-3 complete. Next: Phase 4 (Content Lifecycle) or Phase 5 (Reference Library) -- see [hangar ROADMAP](ROADMAP.md).

## Completed (Phase 1)

### Content CRUD

All business logic in `libs/bc/course/manage`. Hangar routes are thin -- form actions call BC functions.

- [x] Scenario list view + create/edit form
- [x] Student model list + create
- [x] Module list + edit (with scenario assignment)
- [x] Competency registry view (browse by domain)
- [x] Question bank list + create/edit
- [x] Micro-lesson list + create
- [x] Edit views for student models, micro-lessons (create-only so far)

### Task Board UI

Schema + manage in `libs/bc/platform/manage`. Route: `/tasks/board`.

- [x] Task board view (kanban columns)
- [x] Task create/edit
- [x] Drag between columns (HTML5 drag + fetch + invalidateAll)
- [x] Filter by type, product area

### Content Publishing (basic)

Publish pipeline per [ADR 005](../../decisions/005-PUBLISHED_CONTENT.md). Route: `/publish`.

- [x] Publish action: atomic transaction copying all 8 content types from `course.*` to `published.*`
- [x] Release creation (version, changelog, confirmation dialog)
- [x] Published content viewer (read-only view of what sim will see) -- see [feature spec](features/published-viewer/)
- [x] Fix: `getLatestRelease` orderBy ascending instead of DESC
- [x] Fix: Add auth guard to publish endpoint

### Platform Phase 0

- [x] All libs restructured to match ADR 002 (bc/, auth, audit, ui, themes, constants, db, types, engine)
- [x] TS path aliases for all libs + BCs in root tsconfig
- [x] DB schema: all 8 namespaces in Drizzle (course, published, enrollment, evidence, compliance, identity, audit, platform)
- [x] Auth lib: better-auth + Drizzle, `requireAuth()` + `requireRole()` guards
- [x] Audit lib: `logAction()`, `getContentHistory()`, schema
- [x] Design system: aviation + glass-cockpit themes (light/dark, `--t-*` tokens)
- [x] UI lib: 30 components (AppShell, Sidebar, DataTable, forms, auth, etc.)

### Hangar App Shell

- [x] Navigation layout (AppShell + Sidebar from `libs/ui`)
- [x] Route structure: scenarios, modules, questions, micro-lessons, student-models, competencies, publish, settings
- [x] Auth integration (`requireAuth` guard in `(app)/+layout.server.ts`)
- [x] SSR disabled (`export const ssr = false` in root `+layout.ts`)
- [x] Appearance settings panel (theme, mode, base size) -- full ThemeEditor + ThemeSelector in `libs/ui`

### Schema & Data Model

All tables use PostgreSQL schema namespaces per [ADR 004](../../decisions/004-DATABASE_NAMESPACES.md).

- [x] `course.scenario`, `course.module`, `course.competency`, `course.student_model`, `course.question`, `course.micro_lesson`
- [x] `platform.board` (tasks)
- [x] `audit.content_version`, `audit.action_log`
- [x] `enrollment.enrollment`
- [x] `evidence.scenario_run`
- [x] `compliance.traceability_entry`
- [x] Seed competency data (8 domains, 22 competencies) -- `scripts/db/seed.ts`
- [x] Seed FAA topic data (13 core topics via competency `faaTopic` field, no separate table)
- [x] Seed module data (6 modules) -- `scripts/db/seed.ts`

## Completed (Phase 2 -- Compliance Core)

- [x] Content validation engine (10 rules, declarative config, publish gate)
- [x] Traceability matrix editor (13-row, auto-populate, structured assessment methods)
- [x] Compliance dashboard (overall status, stat cards, per-check detail)
- [x] TCO editor (structured form with module outlines)
- [x] Question purpose field (`faa` vs `lesson`)
- [x] FAA topic registry (13 topics from AC 61-83K with 4-layer data)

## Completed (Phase 3 -- FAA Package & Submission)

- [x] FAA package generator (validation + traceability + TCO + time + assessment)
- [x] Submission tracker (6-state workflow, contact info, expiration tracking)
- [x] Content versioning (5-state workflow, version history, rollback)

## Backlog (Phase 4+)

See [hangar ROADMAP](ROADMAP.md) for full phase descriptions.

- Content workflow enforcement (approval gates, review assignments)
- Release management (semver, FAA approval tracking, mid-course upgrade rules)
- Reference document store
- Regulatory change monitor (90-day check)
- Coverage dashboard
- Scenario inventory
- Question bank stats
- Time projection
- Questions form: support variable option count (currently hardcodes exactly 4)
- Competency CRUD (currently read-only from seed data)
- Module create action (currently list + edit only, no create)
