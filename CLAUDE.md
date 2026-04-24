# airboss

Pilot performance and rehearsal platform. Post-pivot from FIRC-specific to broader aviation learning. Surface-typed monorepo: apps grouped by rendering surface (study, spatial, audio, etc.), not by content theme.

Framing: [docs/platform/PIVOT.md](docs/platform/PIVOT.md) (why) and [docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](docs/platform/MULTI_PRODUCT_ARCHITECTURE.md) (surface architecture).

> Global rules (stubs, "honest", worktree cleanup, AI attribution, commit hygiene) live in `~/.claude/CLAUDE.md`. This file is airboss-specific only.

## Session start

Quick scan, don't ritualize:

- [docs/work/NOW.md](docs/work/NOW.md) -- what's active.
- `docs/work/todos/` -- any incomplete prior-session todos.
- If working in a feature area, glance at its work package (if one exists) and the relevant ADR.

Skip the rest unless it's relevant to the current task. Don't surface reminders for their own sake.

## Required reading (once, not every session)

New contributors / fresh context:

1. [docs/platform/PIVOT.md](docs/platform/PIVOT.md) -- what airboss is and isn't
2. [docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](docs/platform/MULTI_PRODUCT_ARCHITECTURE.md) -- apps, libs, surface typology
3. [docs/platform/DESIGN_PRINCIPLES.md](docs/platform/DESIGN_PRINCIPLES.md) -- core beliefs

Pattern references (read when touching that area, not preemptively):

- SvelteKit / Svelte 5 / forms / auth / CSP / styling: [docs/agents/best-practices.md](docs/agents/best-practices.md)
- Scenario engine / tick loop / scoring / replay: [docs/agents/reference-engine-patterns.md](docs/agents/reference-engine-patterns.md)
- Constants / DB schema / scripts / monorepo setup: [docs/agents/reference-sveltekit-patterns.md](docs/agents/reference-sveltekit-patterns.md)
- Common pitfalls: [docs/agents/common-pitfalls.md](docs/agents/common-pitfalls.md)
- Naming: [docs/platform/VOCABULARY.md](docs/platform/VOCABULARY.md)

## Doc structure

```text
course/                 AVIATION KNOWLEDGE
  L01-FAA/              Regulatory foundation
  L02-Knowledge/        Per-topic aviation research (A.1-A.13)
  L03-Objectives/       Learning objectives, competency framework
  L04-Design/           Instructional design, module structure
  L05-Implementation/   Scenarios, question banks, feature specs

docs/
  platform/             Architecture, vision, principles, vocabulary
  vision/               Product vision and PRDs (53 products indexed)
  products/             Per-app docs (sim/, hangar/, ops/, runway/)
  decisions/            ADRs (numbered, immutable once approved)
  agents/               Agent instructions, pattern references
  business/             Market research, business context
  devops/               Deployment, infrastructure
  work/
    NOW.md              What's active
    todos/              Per-session todos: YYYYMMDD-NN-TODO.md
    plans/              Multi-session plans
  work-packages/        Feature work packages (large features only)
  .archive/             Superseded files (never delete, always archive)
```

Rules:

- Stay inside this structure. Ask if unsure.
- Archive, don't delete. Update references when moving files.
- Update docs as part of the work, not after.

## How we build features

**Always work in a worktree.** Default to `/ball-worktree` for any task that writes files. Clean up the worktree and branch when the PR merges (part of `/ball-worktree`'s lifecycle -- don't leave cruft).

**Use skills, don't reinvent.** Before writing code or prose, check if a skill already does it: `/ball-help` lists them. Common ones: `/ball-wp-spec`, `/ball-wp-build`, `/ball-review-full`, `/ball-review-fix` (aka `/rfix`), `/ship`, `/branch-it`, `/diagnose`, `/status`, `/handoff`, `/loose-ends`. If a skill fits the task, invoke it instead of hand-rolling the steps.

**Default: just build it.** Small/medium features do not need a work package. Plan in chat, implement, test, ship.

**Work package (`/ball-wp-spec`) only for large items:**

- Crosses 3+ libs or introduces a new BC.
- Non-trivial schema migration or data model change.
- Multi-session scope where context will be lost between sessions.
- Needs design sign-off before code (complex UX, new interaction patterns).

If it fits in one session and one reviewer can hold it in their head, skip the work package.

**Parallelize aggressively when safe:**

- Independent features/areas → parallel agents, one per file-scope.
- Multi-layer feature → small contract agent first (types + constants), then parallel layer agents against that contract.
- Sequential only when work shares files or has real dependencies.

**Slow down for:**

- Schema changes (one migration lands, verified, then next).
- Anything that touches auth, identity, or billing.
- Token/styling passes (run last, alone, never mixed with UX edits).

**Always:**

- Test by hand before shipping. User tests every feature.
- Unit tests (Vitest) for BC/lib logic. e2e (Playwright) for user flows that matter.
- Update feature docs / TASKS.md / PRD.md as part of the work.

### Tracking

| Level         | Location                              | Scope                   | Lifespan            |
| ------------- | ------------------------------------- | ----------------------- | ------------------- |
| Session todos | `docs/work/todos/YYYYMMDD-NN-TODO.md` | Now                     | One session         |
| Product tasks | `docs/products/{app}/TASKS.md`        | App backlog             | Ongoing             |
| Feature tasks | `docs/work-packages/{name}/tasks.md`  | Until feature ships     | Feature lifetime    |

### Reviews

- Review = punch list to close, not a menu. Fix all findings (critical → nit) unless told otherwise. Default action after any review: launch fixer or fix inline.
- Convergent findings (same root cause flagged by multiple reviewers) get fixed once at the root.
- After fixes: `bun run check` clean, relevant tests pass, grep for the symptom returns empty. Closed = evidence says so.
- No undecided "considerations for future work." Resolve in the same turn: do it, schedule it (work package + trigger), or drop it.

## Doc style

- No walls of text. Break long docs into index + linked sub-docs.
- Headers are the outline. Tables beat paragraphs. Link, don't inline.
- Name things first. Propose names and boundaries before writing code.

## Code rules (airboss-specific)

- **No `any`.** No magic strings/numbers. No non-null assertions (`!`).
- **Constants in `libs/constants/`.** Enums, routes, ports, config.
- **Routes through `ROUTES`** in `libs/constants/src/routes.ts`. Static = string constants. Parameterized = typed functions.
- **Cross-lib imports use `@ab/*` aliases.** Intra-lib relative imports are fine.
- **Drizzle ORM only.** No raw SQL.
- **Svelte 5 runes only.** No `$:`, `export let`, `<slot>`, Svelte 4 stores. Use `$app/state`, not `$app/stores`.
- **IDs via `@ab/utils` `createId()`.** `prefix_ULID` format. Never call `nanoid()` / `ulid()` directly.
- **Discovery-first pedagogy for knowledge nodes.** Lead with WHY, reveal regs as confirmation. See [ADR 011](docs/decisions/011-knowledge-graph-learning-system/decision.md).
- `bun run check` passes (0 errors, 0 warnings) before calling work done.

## Stack

- Runtime: **Bun** (always; never npm/yarn/pnpm)
- Framework: SvelteKit + Svelte 5 (runes)
- DB: PostgreSQL + Drizzle ORM (OrbStack local, port 5435)
- Formatting: Biome (tabs width 2, single quotes, 120 cols, trailing commas all, semicolons)
- Testing: Vitest (unit) + Playwright (e2e)

## Monorepo

```text
apps/
  study/          quiz, reps, spaced rep, calibration (active)
libs/
  auth/           Identity, sessions, permissions
  bc/study/       Spaced rep, cards, reviews, scenarios, calibration
  constants/      Enums, routes, ports, config
  db/             Shared Drizzle connection
  themes/         Design tokens
  types/          Shared types, Zod schemas
  ui/             Svelte components
  utils/          ID generators, helpers
```

Future surfaces (created when needed): `spatial/`, `audio/`, `reflect/`, `avionics/`, `firc/`, `hangar/`, `runway/`. See [MULTI_PRODUCT_ARCHITECTURE.md](docs/platform/MULTI_PRODUCT_ARCHITECTURE.md).

Path aliases: `@ab/constants`, `@ab/types`, `@ab/db`, `@ab/auth`, `@ab/themes`, `@ab/ui`, `@ab/utils`, `@ab/bc-study`, `@ab/bc-sim`, `@ab/aviation`, `@ab/activities`, `@ab/help`.

Schema namespaces: `identity`, `audit`, `study` (more added as BCs grow).

## Workflow

- Capture every request immediately in the session todo. Don't lose tasks, ideas, or asides.
- Finish current task before pivoting. Report status concisely at each unit boundary.
- Questions are not instructions. "Why does X work this way?" → answer, don't change code.
- Ideas → [docs/platform/IDEAS.md](docs/platform/IDEAS.md) (intake funnel, reviewed periodically).
- Archive, don't delete. Keep things findable.

## Relationship to airboss-firc

airboss is the primary repo (as of 2026-04-17). Planning, vision, course material, implementation all live here.

Per [MULTI_PRODUCT_ARCHITECTURE.md](docs/platform/MULTI_PRODUCT_ARCHITECTURE.md), FIRC will migrate into airboss as `apps/firc/` after study MVP is proven. Brings `libs/engine/`, `libs/audit/`, FIRC BCs (`course`, `enrollment`, `evidence`, `compliance`), `apps/sim/` → `apps/firc/`, and `apps/hangar/`. airboss-firc archives after migration.

The FIRC question bank, scenarios, and aviation research in `course/` are reference material and knowledge-graph candidates ([ADR 011](docs/decisions/011-knowledge-graph-learning-system/decision.md)).
