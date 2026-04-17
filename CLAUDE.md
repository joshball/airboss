# airboss

Pilot performance and rehearsal platform. Surface-typed monorepo: apps are grouped by rendering surface (study, spatial, audio, etc.), not by content theme.

## Stack

- Runtime: Bun (always `bun`, never npm/yarn/pnpm)
- Framework: SvelteKit + Svelte 5 (runes only)
- DB: PostgreSQL + Drizzle ORM (OrbStack for local dev)
- Formatting: Biome
- Testing: Vitest (unit) + Playwright (e2e)

## Monorepo

```text
apps/
  study/          SvelteKit -- quiz, reps, spaced rep, calibration
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
- `hangar/` -- content authoring + admin
- `runway/` -- public site

## Import Rules

- **Always use `@ab/*` path aliases for cross-lib imports.** Never relative paths across lib boundaries.
- **Intra-lib relative imports are fine.**
- Path aliases: `@ab/constants`, `@ab/types`, `@ab/db`, `@ab/auth`, `@ab/themes`, `@ab/ui`, `@ab/utils`, `@ab/bc/study`.

## Critical Rules

- **No `any`.** No magic strings. No implicit types.
- **All literal values in `libs/constants/`.** Enums, routes, ports, config.
- **All routes go through `ROUTES` in `libs/constants/src/routes.ts`.** Never write a path string inline.
- **Drizzle ORM only.** No raw SQL.
- **Svelte 5 runes only.** No `$:`, no `export let`, no `<slot>`, no Svelte 4 stores.

## Code Quality

- `bun run check` must pass with 0 errors, 0 warnings before completing changes.
- No non-null assertions (`!`). Use explicit guards.
- Format before commit: `bunx biome format --write` on staged files.

## Biome

- Indent: tabs (width 2)
- Quotes: single quotes
- Line width: 120
- Trailing commas: all
- Semicolons: always

## Git

- Stage individual files by name. Never `git add -A` or `git add .`.
- No AI attribution anywhere.
- Commit after each unit of work.
- Never commit directly to main. Always work on feature branches.

## Database

- Drizzle ORM only. No raw SQL.
- PostgreSQL via OrbStack. Port 5435.
- Schema namespaces: `identity`, `audit`, `study` (more added as BCs grow).
- IDs: `prefix_ULID` format via `@ab/utils`.

## Relationship to firc-boss

This repo was created from patterns in `firc-boss` (the FIRC course platform). FIRC content, compliance, enrollment, and course infrastructure remain in firc-boss. Shared patterns were copied, not linked -- there are no cross-repo dependencies. Eventually FIRC will migrate into this repo as a surface app.
