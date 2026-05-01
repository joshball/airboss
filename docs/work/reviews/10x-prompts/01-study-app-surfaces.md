# Chunk 1 -- Study app surfaces and routes

Paste the block below as the first message in a fresh Claude Code session.

---

```text
/ball-review-10x

Scope is locked. Do NOT re-negotiate it -- review exactly what is listed below.

## What to review
The user-facing study product: the SvelteKit app at `apps/study/`. Specifically:

- `apps/study/src/routes/` -- all route files (+page.svelte, +page.server.ts, +layout.*, +error.svelte, form actions, API endpoints under `apps/study/src/routes/api/`)
- `apps/study/src/lib/` -- app-local components, helpers, stores, and server utilities
- `apps/study/src/hooks.*.ts` and `apps/study/src/app.html` if present
- `apps/study/svelte.config.js`, `apps/study/vite.config.ts` -- config surface

Route groups in scope: `(app)/{dashboard,library,knowledge,plans,reps,sessions,session,calibration,lens,goals,glossary,handbooks,credentials,memory,references,help}`, `(app)/login`, `(app)/logout`, plus top-level `api/`, `appearance/`, `cards/`, `handbook-asset/`, `theme/`, `(dev)/`.

## What is NOT in scope
- `libs/bc/study/` -- domain logic. Reviewed separately as chunk 2.
- `libs/ui/`, `libs/themes/`, `libs/activities/`, `libs/help/` -- shared components. Reviewed separately as chunk 5.
- `libs/sources/`, `libs/aviation/` -- content pipeline. Reviewed separately as chunk 4.
- `libs/auth/` -- reviewed separately as chunk 3.

If a route uses a BC, lib, or UI component, you may READ those files for context but do NOT raise findings against them -- those go in their own chunks.

## Project context the reviewers must respect
- Read `CLAUDE.md` at repo root for project rules. Hard rules: Svelte 5 runes only (no `$:`, no `export let`, no `<slot>`, no Svelte 4 stores), `$app/state` not `$app/stores`, Drizzle ORM only, all routes through `ROUTES` in `libs/constants/src/routes.ts`, `@ab/*` aliases for cross-lib imports, no `any`, no magic strings, IDs via `createId()` from `@ab/utils`.
- This is a SvelteKit + Svelte 5 + Drizzle + PostgreSQL + Bun project. Stack-detect should pick up SvelteKit and Svelte 5.

## Reviewers to launch (floor -- detect stack and add more if appropriate)
Core: correctness, security, perf, architecture, a11y, patterns, testing, dx.
SvelteKit-specific: ux, svelte, backend.
Skip: schema (BC layer), tauri/rust/dotnet/maui (wrong stack).

## Spec context
Check `docs/work-packages/library-completeness/spec.md` and any other work packages under `docs/work-packages/` whose names match a route in scope (e.g., `library-substrate`, `cert-progress`, `lens`, `plans`, `reps`, `knowledge-graph`). If a work package matches a route group, pass its `spec.md` content to the relevant agents so they can check the implementation against intended behavior.

## Output
Each agent writes one review file to `docs/work/reviews/{YYYY-MM-DD}-study-app-surfaces-{category}.md`. After all agents complete, build the summary table and report findings. Do NOT auto-fix -- present the punch list and await my call on `/ball-review-fix`.
```
