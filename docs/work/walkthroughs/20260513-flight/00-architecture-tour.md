# Architecture Tour

A long-form re-orientation to the airboss monorepo. Written for a 10-hour offline flight on 2026-05-13. Read this first, then walk through the six feature docs in this directory.

## How to read this

You wrote every line in this repo. This tour is not teaching you anything new -- it's reseating the mental model so the six feature walkthroughs that follow drop into place without context-switching. Each section ends with a "look at" pointer to a file you can open in your editor while you read.

If you skim, read sections 1, 3, 5, 7, and 12. Those are the load-bearing ones.

## 1. The monorepo at a glance

The workspaces are declared in [package.json](../../../../package.json):

```json
"workspaces": ["apps/*", "libs/*", "libs/bc/*"]
```

Three levels. The shape:

| Tier      | Path        | What lives here                                                                   |
| --------- | ----------- | --------------------------------------------------------------------------------- |
| Surfaces  | `apps/*`    | Five SvelteKit apps. One per rendering surface.                                   |
| Libraries | `libs/*`    | Cross-cutting helpers, UI, constants, types, themes. Most are browser-bundleable. |
| BCs       | `libs/bc/*` | Bounded contexts. Domain logic. Two-barrel pattern (browser vs server).           |

Apps:

| App                                           | Surface category     | Status     | Hosts                                                              |
| --------------------------------------------- | -------------------- | ---------- | ------------------------------------------------------------------ |
| [apps/study](../../../../apps/study/)         | Study / spaced rep   | Active     | Cards, reps, calibration, knowledge graph, library, program, quals |
| [apps/sim](../../../../apps/sim/)             | Simulation           | Scaffolded | Decision reps + future flight sim                                  |
| [apps/hangar](../../../../apps/hangar/)       | Authoring / admin    | Scaffolded | Content authoring, source ingest, admin                            |
| [apps/flightbag](../../../../apps/flightbag/) | FAA reference reader | In flight  | Canonical reader for handbooks/AIM/CFR/AC                          |
| [apps/avionics](../../../../apps/avionics/)   | Avionics trainer     | Scaffolded | Glass cockpit trainer                                              |

Libs that are not BCs but matter most:

- [libs/constants](../../../../libs/constants/) -- routes, ports, engine scoring, enums. **No magic strings rule lives here.**
- [libs/db](../../../../libs/db/) -- single Drizzle connection. Server-only.
- [libs/auth](../../../../libs/auth/) -- better-auth wrappers.
- [libs/ui](../../../../libs/ui/) -- Svelte 5 components. Runes only.
- [libs/themes](../../../../libs/themes/) -- design tokens, pre-hydration script.
- [libs/sources](../../../../libs/sources/) -- handbook/regs/AIM resolver pipeline. `urlForReference()` helper.
- [libs/help](../../../../libs/help/) -- help drawer + command palette + page-help registry.
- [libs/library](../../../../libs/library/) -- reference rendering primitives (RenderedSection, CitationChip).
- [libs/aviation](../../../../libs/aviation/) -- aviation reference registry + glossary.
- [libs/wx-engine](../../../../libs/wx-engine/) + [libs/wx-charts](../../../../libs/wx-charts/) -- synthetic weather.
- [libs/autocomplete](../../../../libs/autocomplete/) -- generic autocomplete primitive used by the palette.

BCs:

- [libs/bc/study](../../../../libs/bc/study/) -- the big one. Cards, reviews, scenarios, calibration, citations, KG, plans, goals, credentials, syllabi, courses, reader, dashboards.
- [libs/bc/sim](../../../../libs/bc/sim/) -- physics, scenarios, replay, grading.
- [libs/bc/hangar](../../../../libs/bc/hangar/) -- authoring, publishing, ingest workflows.
- [libs/bc/ingest-review](../../../../libs/bc/ingest-review/) -- source-ingestion review surface.
- [libs/bc/avionics](../../../../libs/bc/avionics/) -- avionics trainer domain.

Look at: [package.json](../../../../package.json) and the directory listing at the repo root.

## 2. The five surface apps

The full taxonomy lives in [docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](../../../platform/MULTI_PRODUCT_ARCHITECTURE.md). The short version, for re-orientation:

### apps/study (active)

Top-level routes under [apps/study/src/routes](../../../../apps/study/src/routes/):

```text
(app)/                      authenticated layout
  +page.server.ts           redirects to ROUTES.STUDY
  dashboard/                stats / power-user view
  insights/                 performance insights + lenses
    lens/                   /insights/lens/handbook and /insights/lens/weakness
  study/                    canonical spaced-rep page (/study/learn)
  memory/                   card browse, review, inbox
  library/                  reference reader (handbooks, regs, AIM)
  program/                  cert/goal/plan/syllabus surface
    quals/                  cert dashboard
    goals/                  goal composer
    plans/                  study plans
  courses/                  course tree renderer (N-deep)
  knowledge/                knowledge-node learn pages
(auth)/                     unauthenticated layout
  login/
dev/                        internal dev routes
api/
  client-error/             centralized error logging
  scenarios/[slug]/         wx-engine bundle endpoint
  charts/                   wx-charts SVG endpoint
```

The shell pieces worth knowing:

- [apps/study/src/app.html](../../../../apps/study/src/app.html) -- pre-hydration theme script (prevents light-mode flash). Data attributes carry app id, theme, appearance, layout.
- [apps/study/src/hooks.server.ts](../../../../apps/study/src/hooks.server.ts) -- request correlation, better-auth session mapping, theme/appearance cookies, errata scan, sources registry hydration, cookie-domain rewriting for cross-app auth (ADR 024), CSP headers, structured error handler.
- [apps/study/src/hooks.client.ts](../../../../apps/study/src/hooks.client.ts) -- hydration error capture, posts to `/api/client-error`, dedupes `window.onerror` re-reports.

### apps/sim, hangar, avionics (scaffolded)

App shells exist; BCs ready. No production surface yet beyond placeholders.

### apps/flightbag (in flight, launched 2026-05-03)

Canonical FAA reference reader. Other apps deep-link into it via `urlForReference()` from `@ab/sources`. Powered by `@ab/library` rendering primitives.

Look at: [apps/study/src/routes/(app)/+layout.server.ts](../../../../apps/study/src/routes/(app)/+layout.server.ts) for how auth + theme flow through the layout chain.

## 3. The bounded-context pattern

Every BC ships **two** public entry points. This is the most important architectural rule in airboss after "no magic strings."

### The two-barrel split

For [libs/bc/study](../../../../libs/bc/study/src/):

| Barrel                | Path                                                     | Audience                                   | What it exports                                                                                                                                 |
| --------------------- | -------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `@ab/bc-study`        | [src/index.ts](../../../../libs/bc/study/src/index.ts)   | `.svelte` files, any browser-eligible code | Pure helpers (deck-spec, FSRS, formatters, engine), Drizzle table objects + row types, Zod schemas, **type-only** re-exports of server modules. |
| `@ab/bc-study/server` | [src/server.ts](../../../../libs/bc/study/src/server.ts) | `+page.server.ts`, `+server.ts`, scripts   | Every value that touches `@ab/db/connection`. DB queries, write helpers, projections.                                                           |
| `@ab/bc-study/build`  | [src/build.ts](../../../../libs/bc/study/src/build.ts)   | Seed scripts, manifest validators          | Build-only helpers (bypass per-user actor scoping).                                                                                             |

### Why it exists

PR #664 (the `/memory` crash): the BC barrel re-exported all server modules as values. Vite's deps optimizer pulled `@ab/bc-study` into the client. The postgres driver's `bytes.js` references Node's `Buffer` at module-eval time -> `ReferenceError: Buffer is not defined` at hydration in Firefox/Safari. Passed vitest (happy-dom polyfills `Buffer`) and server tests. Failed in real browsers.

Fix: split into two barrels. Runtime barrel stays browser-safe. `type`-only re-exports bridge to server modules so `.svelte` files can `import type { X } from '@ab/bc-study'` without dragging the postgres driver into the bundle.

The full playbook is in [docs/agents/debug-playbooks/browser-hydration.md](../../../agents/debug-playbooks/browser-hydration.md). The enforcement script is [scripts/check-browser-globals.ts](../../../../scripts/check-browser-globals.ts).

### Anatomy of a BC file

Typical organization in `libs/bc/{name}/src/`:

| File                                                                  | Browser-safe? | What it holds                                                        |
| --------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------- |
| `schema.ts`                                                           | Yes           | Drizzle table objects, row types. Exported from both barrels.        |
| `validation.ts` / `*.validation.ts`                                   | Yes           | Zod schemas. Value-exported from runtime barrel.                     |
| `srs.ts`, `deck-spec.ts`, `engine.ts`, `lenses*.ts`, `formatters.ts`  | Yes           | Pure helpers. No DB imports. Runtime barrel.                         |
| `cards.ts`, `reviews.ts`, `sessions.ts`, `goals.ts`, `credentials.ts` | No            | DB-touching modules. `type`-only from runtime; value from `/server`. |
| `errors.ts`                                                           | Yes           | Cross-file error classes.                                            |

Look at: [libs/bc/study/src/index.ts](../../../../libs/bc/study/src/index.ts) -- read the whole file. Note the strict separation of value re-exports vs `export type { ... }` re-exports.

## 4. The constants discipline

[libs/constants/src/](../../../../libs/constants/src/) is where every literal lives.

Key files:

| File                     | What                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `routes.ts`              | `ROUTES.*` constants and parameterized route fns. Plus `QUERY_PARAMS` enum.                                                                  |
| `engine.ts`              | `ENGINE_SCORING` -- all scoring/tuning dials (ADR 014). No bare numerics in engine code.                                                     |
| `ports.ts`               | Per-app dev ports (study 9600, sim 9601, hangar 9602, flightbag 9603, avionics 9604).                                                        |
| `hosts.ts`               | Host/domain config for dev vs prod.                                                                                                          |
| `study.ts`               | Study enums: KnowledgePhase, LibraryRegulationsKind, domain values, card kinds, etc.                                                         |
| `credentials.ts`         | Credential/syllabus/goal/lens enums (ADR 016). `CREDENTIAL_KINDS`, `LENS_KINDS`, `GOAL_STATUSES`, `COURSE_STEP_LEVELS`, `WEAKNESS_SEVERITY`. |
| `wx-engine.ts`           | `WX_SCENARIOS` closed enum, `AIRMET_FAMILIES`.                                                                                               |
| `markdown-directives.ts` | Allowed `:::directive` names.                                                                                                                |
| `reference-tags.ts`      | Aviation topic + cert applicability tags.                                                                                                    |
| `client-errors.ts`       | Client error kind enum.                                                                                                                      |

The rule: route through a constant. Never inline `'/study/learn'` or `0.42`. If you find yourself typing a string or number twice, it belongs here.

Look at: [libs/constants/src/routes.ts](../../../../libs/constants/src/routes.ts) and [libs/constants/src/engine.ts](../../../../libs/constants/src/engine.ts).

## 5. A canonical request flow

Walk through a card review end-to-end. This is the request pattern every page in study follows.

### Browser -> page

1. Browser hits `GET /study/learn?domain=procedural&cert=ppl`.
2. SvelteKit picks up [apps/study/src/routes/(app)/study/learn/+page.server.ts](../../../../apps/study/src/routes/(app)/study/learn/+page.server.ts).
3. The `load` function reads `locals.user` (from the `(app)` layout's auth gate), parses filter params from `url.searchParams` using `QUERY_PARAMS` constants, and calls into the BC server barrel:

   ```typescript
   import { getCardsFaceted } from '@ab/bc-study/server';
   const cards = await getCardsFaceted(user.id, filters);
   ```

4. The BC implementation in [libs/bc/study/src/cards.ts](../../../../libs/bc/study/src/cards.ts) does the Drizzle query:

   ```typescript
   return db.select({ ... }).from(card).leftJoin(cardState, ...).where(...);
   ```

5. Drizzle generates `SELECT ... FROM "study"."card" LEFT JOIN ...` and sends it to PostgreSQL via the pool in [libs/db/src/connection.ts](../../../../libs/db/src/connection.ts).
6. Load returns `{ cards, filters }` to the page.
7. `+page.svelte` receives `data` via `$props()` and renders with Svelte 5 runes (`$state`, `$derived`, `$effect`).

### Page -> mutation

1. User clicks "Start Review". A `<form method="POST" action="?/startSession">` posts to the same page.
2. The page's `actions.startSession` runs in [+page.server.ts](../../../../apps/study/src/routes/(app)/study/learn/+page.server.ts).
3. It calls `startReviewSession(user.id, { cardIds, mode })` from `@ab/bc-study/server`.
4. The BC writes a `study.session` row, returns the session id, then `redirect(302, ROUTES.MEMORY_REVIEW(deckSpec))`.
5. The deck spec is a base64url-encoded JSON of card ids (the "Layer (b) Redo" pattern from the `review-sessions-url` WP). The decoder is a pure helper from the runtime barrel, so the review page can decode it client-side if it ever needs to.

The two patterns to remember:

- **Reads**: `+page.server.ts` `load` -> BC `/server` -> Drizzle -> page `data`.
- **Writes**: form action -> BC `/server` -> Drizzle -> redirect or returned form result.

Look at: any `+page.server.ts` under `apps/study/src/routes/(app)/program/quals/` for a clean read pattern.

## 6. The data layer

[libs/db/src/connection.ts](../../../../libs/db/src/connection.ts) holds the pool. The driver is `postgres-js`, dialect Drizzle ORM. Local dev runs against OrbStack PostgreSQL on `localhost:5435`.

Schema namespaces (PostgreSQL schemas):

| Namespace          | What                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| public             | better-auth tables (`bauth_user`, `bauth_session`, etc.)                                          |
| `study`            | Cards, reviews, sessions, KG, credentials, syllabi, goals, plans, courses, references, citations. |
| `hangar`           | Authoring, publishing, ingest jobs.                                                               |
| `sim`              | Sim evidence, replay state.                                                                       |
| `audit`            | Action logging, content version history.                                                          |
| `sources_registry` | Source document registry.                                                                         |

### ID strategy (ADR 010)

Two tiers:

- **Tier A** (catalog items): `{prefix}-{zero-padded-decimal}`. Example: `scn-001`, `mod-042`. Generated by a Postgres SEQUENCE.
- **Tier B** (runtime events): `{prefix}_{ulid-lowercase}`. Example: `card_01jvxyz4...`, `goal_01k...`. Generated by `createId(prefix)` from [@ab/utils](../../../../libs/utils/src/).

Never call `nanoid()` or `ulid()` directly. Always go through `createId()`.

### Schema migrations

There are none. The schema is greenfield -- a single [drizzle/0000_initial.sql](../../../../drizzle/0000_initial.sql) regenerates from every `schema.ts` whenever schema changes. To change schema:

1. Edit the BC's `schema.ts` (e.g., [libs/bc/study/src/schema.ts](../../../../libs/bc/study/src/schema.ts)).
2. Run `bun run db regen`.
3. `bun run db reset` to drop and recreate locally.
4. Reseed.

Do not plan phased migrations, deprecation windows, or "drop column in commit N" sequences. One step, no phases.

## 7. Browser-bundling rules (load-bearing)

The browser-bundled libs are:

```text
libs/{constants,utils,types,themes,ui,help,aviation,audit,sources,activities,autocomplete}/**
libs/bc/{study,sim}/**
```

Three rules enforced by [scripts/check-browser-globals.ts](../../../../scripts/check-browser-globals.ts):

1. **No static `node:*` imports.** Biome's `noNodejsModules` catches this at lint time.
2. **No bare Node globals.** Direct `Buffer.from(...)` or `process.env.X` is a build error. The walker also chases value re-exports through every runtime barrel.
3. **No runtime imports of server-only packages** from any client-eligible file: `@ab/db/connection`, `@ab/bc-study/server`, `@ab/bc-study/build`, `postgres`, `node:*`.

### Escape hatches

- Type-only imports are always allowed: `import type { Foo } from '@ab/bc-study/server'`. Types erase at compile time.
- Server-only files inside a browser-bundled lib can declare `// @browser-globals: server-only -- never imported by client .svelte` in their first eight lines. The check honors this.
- Genuine Node use inside a browser-bundled lib uses the lazy-load pattern from [libs/constants/src/source-cache.ts](../../../../libs/constants/src/source-cache.ts):

  ```typescript
  if (typeof process !== 'undefined') {
    const fs = process.getBuiltinModule('node:fs');
    // ...
  }
  ```

### Why this matters more than it sounds

`bun test` and `bun run check` pass when a Node global slips through. happy-dom polyfills `Buffer`. Vitest polyfills `process`. The smoke at [tests/e2e/browser-hydration-smoke.spec.ts](../../../../tests/e2e/browser-hydration-smoke.spec.ts) only covers known surfaces. Five PRs (#656, #659, #661, #663, #664) shipped wrong fixes before the right one landed. The Phase 3 command-palette `node:fs` regression (PRs #857, #921) repeated the pattern in 2026-05-12.

For a browser-only error, the diagnostic path starts in the browser, not in grep. Open the page, open devtools, compare a working page's import graph against the broken one's. [scripts/walk-browser-barrel.ts](../../../../scripts/walk-browser-barrel.ts) curls Vite's served module and follows every value-import edge -- if grep disagrees with the served chain, the served chain wins.

## 8. ADRs that matter

The full index is at [docs/decisions/](../../../decisions/). The six a returning developer must know on sight:

| ADR                                                                      | Title                             | Why it's load-bearing                                                                                |
| ------------------------------------------------------------------------ | --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [002](../../../decisions/002-LIB_STRUCTURE.md)                           | Lib structure + BC pattern        | The `/server` barrel split. Every BC touch depends on this.                                          |
| [010](../../../decisions/010-ID_STRATEGY.md)                             | ID strategy                       | Tier A vs Tier B prefixes. Every insert uses this.                                                   |
| [014](../../../decisions/014-engine-scoring-coefficients.md)             | Engine scoring coefficients       | `ENGINE_SCORING` constant. Spaced-rep tuning lives here.                                             |
| [016](../../../decisions/016-cert-syllabus-goal-model/decision.md)       | Cert/syllabus/goal/lens model     | The data model behind cert-dashboard, lens-ui, goal-composer. Spans three of the six features below. |
| [018](../../../decisions/018-source-artifact-storage-policy/decision.md) | Source artifact storage policy    | Cache lives at `~/Documents/airboss-handbook-cache/`. Source bytes never in git.                     |
| [025](../../../decisions/025-wp-frontmatter-contract/decision.md)        | Work package frontmatter contract | `human_review_status` is user-only. `status: shipped` requires signed-off. Lint enforces.            |

Also worth scanning during the flight:

- [011](../../../decisions/011-knowledge-graph-learning-system/decision.md) -- knowledge graph discovery-first pedagogy.
- [019](../../../decisions/019-reference-identifier-system/decision.md) -- reference identifier system.
- [020](../../../decisions/020-handbook-edition-and-amendment-policy.md) -- handbook editions + errata.
- [024](../../../decisions/024-cross-app-auth-identity-roles-entitlements.md) -- cross-app auth.
- [026](../../../decisions/026-edition-coherence/decision.md) -- edition coherence (latest).

## 9. The scripts directory

Top-level CLI dispatchers, all invoked via `bun run <noun>`:

| Script           | Purpose                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------- |
| `dev.ts`         | Dev server launcher. `bun run dev study`.                                                |
| `check.ts`       | Lint/types/test gate. Profiles: `dirty` (default), `branch`, `quick`, `types`, `all`.    |
| `test.ts`        | Vitest runner.                                                                           |
| `db.ts`          | DB utilities. `reset`, `seed`, `regen`, `shell`, `status`.                               |
| `sources.ts`     | Source document sync. `pull`, `push`, `sync`, `list`, `status`.                          |
| `references.ts`  | Reference resolver/linker. `resolve`, `validate`, `audit`, `lint`.                       |
| `charts.ts`      | Weather chart build pipeline.                                                            |
| `wx-scenario.ts` | Weather scenario synthesis (wx-engine). `list`, `build`, `validate`, `check-round-trip`. |
| `airboss-ref.ts` | Knowledge-graph reference validator.                                                     |
| `wp.ts`          | Work package CLI. `list`, `show`, `set`, `next`, `blocked`.                              |
| `bug.ts`         | Bug tracker. `list`, `show`, `new`, `set`, `index`.                                      |
| `track.ts`       | Workflow umbrella. `status`, `next`, `ship`, `generate`, `format`, `archive`, `log`.     |
| `setup.ts`       | One-time env/DB/cache bootstrap.                                                         |
| `smoke.ts`       | Playwright smoke runner.                                                                 |
| `themes.ts`      | Theme tokens. `emit`, `lint`, `codemod`, `tokens`.                                       |
| `lint.ts`        | Biome / markdownlint / typo check.                                                       |
| `codemod.ts`     | Automated refactoring.                                                                   |
| `schedule.ts`    | Scheduled job runner.                                                                    |
| `dep-audit.ts`   | Dependency auditing.                                                                     |

The dispatcher pattern: each `scripts/<noun>.ts` reads `process.argv.slice(2)`, switches on the first arg, and prints help when called with no args. No colon-namespaced npm scripts. Subcommands are dispatched by the TS file. Pattern reference: [scripts/wp.ts](../../../../scripts/wp.ts), [scripts/bug.ts](../../../../scripts/bug.ts), [scripts/track.ts](../../../../scripts/track.ts).

## 10. The work-package system

Long-form: [docs/platform/TRACKING.md](../../../platform/TRACKING.md). Frontmatter contract: [ADR 025](../../../decisions/025-wp-frontmatter-contract/decision.md).

Three levels of tracking:

| Level        | Location                              | Lifespan        |
| ------------ | ------------------------------------- | --------------- |
| Session todo | `docs/work/todos/YYYYMMDD-NN-TODO.md` | One session     |
| Product task | `docs/products/{app}/TASKS.md`        | Ongoing backlog |
| Feature WP   | `docs/work-packages/{slug}/spec.md`   | Until shipped   |

The frontmatter shape that the lint checks:

```yaml
---
id: feature-slug
title: Human-readable title
product: study | hangar | sim | flightbag | avionics | platform | course | none
category: product | feature | content | docs | platform
status: draft | signed-off | in-flight | shipped | abandoned | superseded
agent_review_status: pending | done
human_review_status: pending | walked | signed-off
created: YYYY-MM-DD
shipped_date: YYYY-MM-DD       # required when status: shipped
shipped_prs: [n, n]
depends_on: [slug]
unblocks: [slug]
owner: agent | user
tags: [free-form]
---
```

Two hard rules:

- `human_review_status` is user-only. Agent commits that touch it are blocked.
- `status: shipped` requires `human_review_status: signed-off`. Lint enforces.

Use `bun run track status` to see the dashboard, `bun run track next` to see what's ready to walk, `bun run track ship` for the interactive walk-and-ship loop.

## 11. The doc structure

The full tree is in [CLAUDE.md](../../../../CLAUDE.md) under "Doc Structure." The shape that matters for this flight:

```text
docs/
  decisions/                ADRs
  platform/                 Architecture, vision, principles (PIVOT.md, MULTI_PRODUCT_ARCHITECTURE.md, DESIGN_PRINCIPLES.md, IDEAS.md, VOCABULARY.md)
  products/{app}/           Per-app docs (VISION, PRD, ROADMAP, TASKS, features/)
  agents/                   Agent instructions + pattern references
  work/
    NOW.md                  Single source of "what's active"
    todos/                  Per-session todos
    handoffs/               Session-end notes (60-day rolling archive)
    reviews/                Code/design review reports (60-day rolling archive)
    walkthroughs/           THIS DIRECTORY
    build-reports/          Build artifacts (60-day rolling archive)
  work-packages/{slug}/     Feature specs (spec, tasks, test-plan, design, user-stories, OUT-OF-SCOPE)
  bugs/                     Bug tracker (frontmatter-driven)
  log/                      Per-PR log entries
  .archive/                 Superseded files. Never delete; always archive.
```

## 12. "What's where" cheat sheet

For the reader returning cold:

| Question                                | Answer                                                                                                                                                     |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where do routes live?                   | [libs/constants/src/routes.ts](../../../../libs/constants/src/routes.ts).                                                                                  |
| Where do scoring dials live?            | [libs/constants/src/engine.ts](../../../../libs/constants/src/engine.ts) (`ENGINE_SCORING`).                                                               |
| How do I add a DB table?                | Edit BC's `schema.ts`, run `bun run db regen`, then `bun run db reset`, then reseed.                                                                       |
| How do I run a raw SQL query?           | You don't. Drizzle ORM only.                                                                                                                               |
| How do I import a BC value client-side? | You don't. Use `import type { X }` from the runtime barrel; values from `+page.server.ts` via `/server`.                                                   |
| How do I add a new card type?           | Add to `study.ts` constants, add column in `libs/bc/study/src/schema.ts`, regen schema.                                                                    |
| How do I add a page route?              | Add to [libs/constants/src/routes.ts](../../../../libs/constants/src/routes.ts), create `+page.server.ts` + `+page.svelte` under `apps/{app}/src/routes/`. |
| How do I add an API route?              | `apps/{app}/src/routes/api/{path}/+server.ts`.                                                                                                             |
| How do I find auth code?                | [libs/auth/](../../../../libs/auth/) + `apps/{app}/src/lib/server/auth.ts`.                                                                                |
| Where are UI components?                | [libs/ui/src/](../../../../libs/ui/src/). Svelte 5 runes only.                                                                                             |
| Where are design tokens?                | [libs/themes/src/](../../../../libs/themes/src/) (source) + `libs/themes/generated/tokens.css` (emitted).                                                  |
| Where are help topics?                  | [libs/help/](../../../../libs/help/). Page-help registry per route.                                                                                        |
| Where is the knowledge graph?           | [course/knowledge/](../../../../course/knowledge/) + [libs/bc/study/src/knowledge-*.ts](../../../../libs/bc/study/src/).                                   |
| Where is the lens framework?            | [libs/bc/study/src/lenses.ts](../../../../libs/bc/study/src/lenses.ts) + `lenses-course.ts` + `lens-tree-walk.ts`.                                         |
| Where do scenarios live?                | [libs/wx-engine/src/truth/scenarios/](../../../../libs/wx-engine/src/truth/scenarios/) + [data/wx-scenarios/](../../../../data/wx-scenarios/).             |
| How do I cite a reference in a card?    | `createCitation()` from `@ab/bc-study/server`. Auto-links via section id.                                                                                  |
| How do I test a feature?                | Unit in `libs/**/*.test.ts` (vitest). E2E in [tests/e2e/](../../../../tests/e2e/) (Playwright).                                                            |
| How do I check browser-safety?          | `bun run check` runs [check-browser-globals.ts](../../../../scripts/check-browser-globals.ts).                                                             |
| How do I see what shipped?              | [docs/log/](../../../log/) + `bun run track generate`.                                                                                                     |
| How do I see what's blocked?            | `bun run wp blocked`.                                                                                                                                      |
| Where's the canonical SQL?              | [drizzle/0000_initial.sql](../../../../drizzle/0000_initial.sql). Regenerated; never hand-edited.                                                          |
| Where's the per-PR log?                 | [docs/log/](../../../log/). Auto-emitted by `scripts/log-pr.ts`.                                                                                           |
| Where's `NOW.md`?                       | [docs/work/NOW.md](../../NOW.md).                                                                                                                          |

## 13. The reading order for the next docs in this directory

1. [01 -- cert-dashboard](01-cert-dashboard.md) -- read first. It's the most self-contained and grounds the cert/syllabus/goal/lens vocabulary.
2. [02 -- lens-ui](02-lens-ui.md) -- the lens framework in production. Reads cleanly after cert-dashboard.
3. [03 -- goal-composer](03-goal-composer.md) -- the third leg of the cert/syllabus/goal/lens stool. Sits on top of cert-dashboard data + lens framework.
4. [04 -- course-tree-arbitrary-depth](04-course-tree-arbitrary-depth.md) -- the N-deep schema refactor. Touches the BC + lens + renderer.
5. [05 -- wx-engine](05-wx-engine.md) -- the most architecturally interesting. Truth-aware generators, 4 layers × 3 anchoring stages.
6. [06 -- command-palette](06-command-palette.md) -- the biggest UI feature. Intent classifier + composite ranker + per-app registries.

A roll-up: [READING-ORDER.md](READING-ORDER.md) sequences these against a 10-hour flight.
