# airboss

Pilot performance and rehearsal platform. Post-pivot from FIRC-specific to broader aviation learning. Surface-typed monorepo: apps grouped by rendering surface (study, spatial, audio, etc.), not by content theme.

See [docs/platform/PIVOT.md](docs/platform/PIVOT.md) for why we're here. See [docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](docs/platform/MULTI_PRODUCT_ARCHITECTURE.md) for the Option 7 surface architecture.

## PRIME DIRECTIVE

**Do the right thing. Always.**

- Never propose stubs, hardcoded values, or "MVP shortcuts" when a real implementation exists -- especially in the `airboss-firc` sibling repo, which has years of battle-tested auth, schema, engine, and BC code.
- "For now" and "as a stub" are red flags. If you're tempted to say either, stop. Check whether porting the real thing is within reach. It usually is.
- Longer scope to do it right is always acceptable. Quality shortcuts are not.
- When porting from airboss-firc: take the code, schema, and patterns. Do **not** take the UI/UX -- that's being redesigned here.
- Zero tolerance for known issues. A stub is a known issue. Fix it before moving on.

## SESSION START

**Do this at the start of every conversation, before any work:**

1. Check [docs/work/NOW.md](docs/work/NOW.md) -- what's active? This is the single source of "what's next."
2. Check [docs/platform/IDEAS.md](docs/platform/IDEAS.md) -- any ideas pending review? If the last review was >2 weeks ago, remind the user.
3. Check `docs/work/todos/` -- any incomplete todos from prior sessions? Surface them.
4. Check [docs/platform/DESIGN_PRINCIPLES.md](docs/platform/DESIGN_PRINCIPLES.md) -- if the current task involves a feature, remind the user which principles apply.
5. Check [docs/platform/VOCABULARY.md](docs/platform/VOCABULARY.md) -- if naming anything, reference the terminology bank.

**Periodic reminders (surface when relevant, at most once per session):**

- **Ideas review** -- "IDEAS.md hasn't been reviewed since [date]. Want to do a quick scan?"
- **TEMP_FIXES.md** -- if it exists and has open items, remind the user.
- **Stale docs** -- if working in an area, check that the relevant ADR/doc still matches reality.

Don't block work for reminders. Surface them briefly at the start, then move on.

## REQUIRED READING

**Before writing any code, read these in order:**

1. [docs/platform/PIVOT.md](docs/platform/PIVOT.md) -- what airboss is and isn't
2. [docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](docs/platform/MULTI_PRODUCT_ARCHITECTURE.md) -- apps, libs, surface typology
3. [docs/platform/DESIGN_PRINCIPLES.md](docs/platform/DESIGN_PRINCIPLES.md) -- core beliefs
4. The relevant pattern doc for your area (see "Before You Build" below)
5. The feature spec for what you're implementing (if it exists)

## Doc Structure

```text
course/                 AVIATION KNOWLEDGE (organized by information architecture layers)
  L01-FAA/              Regulatory foundation (AC 61-83K, CFRs, TCO, submission)
  L02-Knowledge/        Per-topic aviation research (A.1-A.13)
  L03-Objectives/       Learning objectives, competency framework
  L04-Design/           Instructional design, module structure
  L05-Implementation/   Scenarios, question banks, feature specs

docs/                   PLATFORM
  platform/             Architecture, vision, design principles, info architecture
    PIVOT.md            Post-pivot framing (FIRC -> broader platform)
    MULTI_PRODUCT_ARCHITECTURE.md   Option 7 surface-typed apps
    PRODUCT_BRAINSTORM.md           53 product ideas across 9 categories
    DESIGN_PRINCIPLES.md            Core beliefs
    IDEAS.md            Idea intake funnel
    VOCABULARY.md       Naming standards
  vision/               Product vision and PRDs
    INDEX.md            All 53 products indexed
    learning/           Learning domain taxonomy
    products/           Per-product PRDs (audio/, community/, event-prep/,
                        experimental/, in-flight/, pre-flight/, proficiency/,
                        reflection/, specialty/)
  products/             Per-app docs (sim/, hangar/, ops/, runway/ from pre-pivot)
    {app}/
      VISION.md
      PRD.md
      ROADMAP.md
      TASKS.md
      features/         App-specific feature specs
  decisions/            ADRs (numbered, immutable once approved)
    NNN-topic.md        Single-file ADR (simple decisions)
    NNN-topic/          Directory ADR (complex decisions with context)
      context.md        Conversation evolution, feedback rounds
      decision.md       Final plan
  agents/               Agent instructions, pattern references
  business/             Market research, business context
  devops/               Deployment, infrastructure
  work/                 Session-scoped (todos, plans, reviews)
    NOW.md              What's active, what's next
    todos/              Per-session todos: YYYYMMDD-NN-TODO.md
    plans/              Multi-session plans
  work-packages/        Feature work packages (from /ball-wp-spec)
    {feature}/
      spec.md
      tasks.md
      test-plan.md
      design.md         (medium+ features)
      user-stories.md   (large features)
  .archive/             Superseded files (never delete, always archive)
```

**Rules:**

- Never create files outside this structure. Ask if unsure.
- Archive superseded docs, never delete. Preserve directory structure in `.archive/`.
- Never leave orphaned files. When moving or renaming, grep for references and update them.
- PRDs link to feature specs. Feature details live in feature dirs, not inline.
- Session todos committed with work. One per session: `docs/work/todos/YYYYMMDD-NN-TODO.md`.
- Update docs as part of the work, not as a separate task.

## Before You Build

Read the relevant pattern doc before writing code in that area:

- **SvelteKit / Svelte 5 / forms / auth / CSP / styling:** [docs/agents/best-practices.md](docs/agents/best-practices.md)
- **Scenario engine / tick loop / scoring / replay:** [docs/agents/reference-engine-patterns.md](docs/agents/reference-engine-patterns.md)
- **Constants / DB schema / scripts / monorepo setup:** [docs/agents/reference-sveltekit-patterns.md](docs/agents/reference-sveltekit-patterns.md)
- **New feature? Author work package:** `/ball-wp-spec`
- **Ready to build? Phased implementation:** `/ball-wp-build`
- **Code review (10 parallel spec-aware reviewers):** `/ball-review-full`
- **Naming features or UI elements:** [docs/platform/VOCABULARY.md](docs/platform/VOCABULARY.md)
- **Design philosophy / product shaping principles:** [docs/platform/DESIGN_PRINCIPLES.md](docs/platform/DESIGN_PRINCIPLES.md)

## Feature Work Rules

Feature lifecycle is driven by shared skills:

- **New feature?** Run `/ball-wp-spec` -- generates work package docs (spec, tasks, test-plan, design, user-stories)
- **Ready to build?** Run `/ball-wp-build` -- phased implementation from signed-off work package, with per-phase reviews
- **Need a review?** Run `/ball-review-full` -- 10 parallel spec-aware reviewers + fixer
- **Periodic:** `/ball-wp-drift` to check spec/code divergence, `/ball-wp-coverage` for undocumented features

**Project rules:**

- **Go slowly.** One feature at a time. Test it. Then move on. No parallel features.
- **Nothing merges without a manual test plan.** User tests every feature by hand before it ships.
- **Feature dirs** hold spec, user stories, design, tasks, test-plan, review notes. Co-located at `docs/work-packages/{feature}/`.
- **Update docs with the work.** Feature spec, TASKS.md, PRD.md, ROADMAP.md -- all updated as part of shipping, not after.
- **Automated tests** alongside implementation: unit (Vitest) for BC/lib logic, e2e (Playwright) for user flows.
- **Review docs have two status fields.** `status` (unread/reading/done) is controlled by the user. `review_status` (pending/done) is controlled by the agent. A feature can't be "done" until both are satisfied.

### Tracking: three levels

| Level         | Location                              | Scope                                 | Lifespan            |
| ------------- | ------------------------------------- | ------------------------------------- | ------------------- |
| Session todos | `docs/work/todos/YYYYMMDD-NN-TODO.md` | What I'm doing right now              | One session         |
| Product tasks | `docs/products/{app}/TASKS.md`        | What needs building next for this app | Ongoing backlog     |
| Feature tasks | `docs/work-packages/{name}/tasks.md`  | What's left to finish this feature    | Until feature ships |

## Doc Style

- **No walls of text.** Max 2-3 screens per file. Break into index + linked sub-docs.
- **Start with the map.** Every doc opens with overview/index, then links to details.
- **Headers are the outline.** A reader should understand the doc from headers alone.
- **Tables over paragraphs.** Lists with attributes become tables.
- **Link, don't inline.** Reference other docs, don't copy content between files.
- **Name things first.** Propose names and boundaries before writing code.

## Critical Rules

- **No `any`.** No magic strings. No implicit types.
- **All literal values in `libs/constants/`.** Enums, routes, ports, config.
- **All routes go through `ROUTES` in `libs/constants/src/routes.ts`.** Never write a path string inline. Static routes are string constants. Routes with parameters are typed functions.
- **Cross-lib imports use `@ab/*` aliases, never relative paths.** See Import rules below.
- **Drizzle ORM only.** No raw SQL.
- **Svelte 5 runes only.** No `$:`, no `export let`, no `<slot>`, no Svelte 4 stores (`writable`, `readable`, `$app/stores`). Use `$app/state`.
- **Discovery-first pedagogy for knowledge nodes.** Lead with WHY. Let the learner derive the answer. Reveal regulations as confirmation of reasoning, not as arbitrary rules. See [ADR 011](docs/decisions/011-knowledge-graph-learning-system/decision.md).

## Stack

- Runtime: Bun (always `bun`, never npm/yarn/pnpm)
- Framework: SvelteKit + Svelte 5 (runes only)
- DB: PostgreSQL + Drizzle ORM (OrbStack for local dev, port 5435)
- Formatting: Biome
- Testing: Vitest (unit) + Playwright (e2e)

## Monorepo

```text
apps/
  study/          SvelteKit -- quiz, reps, spaced rep, calibration (active)
libs/
  auth/           Identity, sessions, permissions
  bc/
    study/        Spaced rep, cards, reviews, scenarios, calibration
  constants/      Enums, routes, ports, config
  db/             Shared Drizzle connection (PostgreSQL)
  themes/         Design tokens, theme definitions
  types/          Shared types, Zod schemas
  ui/             Svelte components
  utils/          ID generators, helpers
```

**Future surface apps** (created when needed, not before):

- `spatial/` -- route, airport, airspace, map-based products
- `audio/` -- narrative, drills, TTS
- `reflect/` -- journals, heatmaps, tracking
- `avionics/` -- glass cockpit trainer
- `firc/` -- FIRC course (migrated from airboss-firc after study MVP proven)
- `hangar/` -- content authoring + admin
- `runway/` -- public site

See [docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](docs/platform/MULTI_PRODUCT_ARCHITECTURE.md) for the full surface taxonomy and build order.

## Import Rules

- **Always use `@ab/*` path aliases for cross-lib imports.** Never relative paths across lib boundaries.
- **Intra-lib relative imports are fine.**
- Path aliases: `@ab/constants`, `@ab/types`, `@ab/db`, `@ab/auth`, `@ab/themes`, `@ab/ui`, `@ab/utils`, `@ab/bc/study`.

## Svelte 5

- Runes: `$state`, `$derived`, `$effect`, `$props`, `$bindable`. No legacy.
- Snippets: `{#snippet}` + `{@render}`. No `<slot>`.
- `$app/state` not `$app/stores`.
- `.svelte.ts` for rune files outside components.

## Database

- Drizzle ORM only. No raw SQL.
- PostgreSQL via OrbStack, port 5435.
- Schema namespaces: `identity`, `audit`, `study` (more added as BCs grow).
- IDs: `prefix_ULID` format via `@ab/utils` `createId()`. Never call `nanoid()` or `ulid()` directly.

## Workflow

- Never interrupt current work. New requests go to END of todo list.
- **Capture every request immediately.** Tasks, ideas, suggestions -- add to todo the second they're mentioned. Don't act on them now, don't forget them later.
- Track everything in `docs/work/todos/YYYYMMDD-NN-TODO.md`.
- Finish current task before starting next.
- Report status after each completed task: what completed, what remains, what's next.
- **Never lose information.** Archive, don't delete. If something might be useful later, keep it findable.
- **Do the right thing, not the easy thing.** Never take shortcuts. Choose what makes the project better, simpler, more correct, less buggy, more professional. If it takes longer, it takes longer.
- **Questions are not instructions.** When asked "why does X work this way?" -- answer. Don't start changing things.
- **Capture ideas immediately.** New ideas, approaches, insights -- add to [docs/platform/IDEAS.md](docs/platform/IDEAS.md) the moment they come up. Don't evaluate yet. Ideas are reviewed every 2 weeks.

## Code Quality

- `bun run check` must pass with 0 errors, 0 warnings before completing changes.
- No `any`. Prefer proper types, generics, `unknown` with guards.
- No non-null assertions (`!`). Use explicit guards.
- No magic strings/numbers. Use `libs/constants/`.
- Never delete commented-out code without asking.
- Format before commit: `bunx biome format --write` on staged files.
- Fix all bugs directly. Never dismiss, deflect, or suggest restarts.

## Biome

- Indent: tabs (width 2)
- Quotes: single quotes
- Line width: 120
- Trailing commas: all
- Semicolons: always

## Git

- Stage individual files by name. Never `git add -A` or `git add .`.
- No AI attribution anywhere. No "Generated by Claude", no Co-Authored-By.
- Commit messages: what and why, not how.
- Commit after each unit of work.
- Review staged files before committing (`git status` after staging).
- Never stage files you didn't edit.
- Never commit directly to main. Always work on feature branches.

## Relationship to airboss-firc

This repo was originally created from patterns in the FIRC course platform (previously `firc-boss`, now `airboss-firc` at `/Users/joshua/src/_me/aviation/airboss-firc`). **As of 2026-04-17, airboss is the primary repo for all ongoing work** -- planning docs, vision, course material, and implementation have migrated here.

Per [MULTI_PRODUCT_ARCHITECTURE.md](docs/platform/MULTI_PRODUCT_ARCHITECTURE.md), **FIRC will migrate into airboss as `apps/firc/`** after the study app MVP is proven. The migration brings:

- `libs/engine/`, `libs/audit/`, and the FIRC bounded contexts (`course`, `enrollment`, `evidence`, `compliance`) from airboss-firc
- `apps/sim/` -> `apps/firc/` (renamed -- it's the FIRC course surface)
- `apps/hangar/` -- content authoring for all products

Once migration is complete, airboss-firc becomes archived. Nothing stays there long-term.

The FIRC question bank, scenario library, and aviation knowledge research already copied into `course/` serve two purposes: reference material for current work, and candidate content for the knowledge graph (see [ADR 011](docs/decisions/011-knowledge-graph-learning-system/decision.md)).
