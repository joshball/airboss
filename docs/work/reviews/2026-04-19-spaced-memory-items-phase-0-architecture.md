---
title: 'Phase 0 Architecture Review: spaced-memory-items'
date: 2026-04-19
phase: 0
category: architecture
branch: build/spaced-memory-items
commit: 99c4c3b
reviewer: architecture
---

# Phase 0 Architecture Review

Foundation port of auth, DB, logging, and error handling from airboss-firc into airboss,
pre-`spaced-memory-items`. Scope: libs/{auth,constants,db,utils}, apps/study thin wrappers,
docker-compose, drizzle.config, seed script.

## Summary

| Severity | Count |
| -------- | ----- |
| Critical | 0     |
| Major    | 3     |
| Minor    | 7     |
| Nit      | 4     |

Overall: the port is a faithful mirror of airboss-firc's tested foundation. Dependency
direction is clean (utils <- db <- auth; constants is a leaf), cross-lib imports use
`@ab/*` aliases in every lib and app file, and app vs lib split is appropriate. The
findings below are mostly about small inconsistencies (package-name vs path-alias, a
subpath-style import, seed script conventions) and a handful of architectural questions
that are fine to defer but worth naming now so Phase 1+ doesn't widen them.

## Findings

### [MAJOR] Package name `@ab/bc-study` does not match the path alias `@ab/bc/study`

**File/area:** `libs/bc/study/package.json` vs `tsconfig.json`, `apps/study/svelte.config.js`, CLAUDE.md.
**Issue:** The workspace package is named `@ab/bc-study` (hyphenated), but the TS path alias, the Svelte alias, the CLAUDE.md "Import Rules" section, and the work-package design doc all use `@ab/bc/study` (slash). npm/workspace resolution goes through the hyphen name; TS/Vite resolution goes through the slash alias. Today nothing actually imports this module yet, so the mismatch is invisible -- Phase 1 will be the first to hit it.
**Impact:** The two namespaces diverge silently. When something imports `@ab/bc/study` TS resolves it via `paths`, but `bun install` / workspace linking keys off `@ab/bc-study`, so dev-time hover tools or any code path that bypasses the alias (e.g. a CJS script) sees a different identifier. It's also a naming inconsistency that will propagate to `@ab/bc/course`, `@ab/bc/evidence` etc. when FIRC migrates.
**Fix:** Pick one convention and apply it uniformly. Either:
- Rename the package to `@ab/bc-study` everywhere (tsconfig path `@ab/bc-study`, svelte alias `@ab/bc-study`, CLAUDE.md, design doc), OR
- Keep `@ab/bc/study` slash alias and set `"name": "@ab/bc/study"` in the package.json (valid scoped-name form `@scope/name`... note: actually npm disallows a second `/` in package names, which is why airboss-firc and many monorepos settle on `@ab/bc-course`). Given npm's naming rules, **renaming alias + tsconfig paths to `@ab/bc-study` is the correct resolution.**

### [MAJOR] `@ab/constants/env` subpath import in `libs/db/src/connection.ts` is the lone subpath-style import in the codebase

**File/area:** `libs/db/src/connection.ts:8`.
**Issue:** `import { getEnvInt, requireEnv } from '@ab/constants/env';` uses a subpath import. Everything else in the repo imports from the bare alias `@ab/constants`, and both `getEnvInt` and `requireEnv` are already re-exported from `libs/constants/src/index.ts`. This single subpath hit is the only one in the new code.
**Impact:** Bifurcates the public surface of `@ab/constants` -- consumers don't know whether to use the barrel or the subpath, and each new subpath import invites cherry-picking internals. The tsconfig and svelte alias both support `@ab/constants/*`, so this is not a bug, but it's an inconsistency with every other import site in Phase 0.
**Fix:** Change to `import { getEnvInt, requireEnv } from '@ab/constants';`. If you want to preserve intentional sub-barrels in the future (common pattern: `@ab/constants/env`, `@ab/constants/deployment`), add a policy note in CLAUDE.md's Import Rules section and adopt it everywhere, not just for this one file.

### [MAJOR] `drizzle.config.ts` lists a single schema file; every BC added in Phase 1+ must edit this file

**File/area:** `drizzle.config.ts`.
**Issue:** The `schema` array is a hardcoded list: `['./libs/auth/src/schema.ts']`. Phase 1 (spaced memory items) will add `libs/bc/study/src/schema.ts` and must amend this file; future BCs (audit, identity per `SCHEMAS` constant, and eventually the migrated FIRC BCs) each require a line. This is the same pattern airboss-firc ended up with (7 schema paths) and it worked there, but it is a brittle, non-architectural registry.
**Impact:** Every new BC causes a drizzle.config edit that is easy to forget. Forgetting it silently drops the BC from `db:push`, which shows up only when migrations diverge from code.
**Fix:** Phase-0-acceptable as-is, but capture the direction now: either (a) adopt a glob-based schema discovery (`import.meta.glob`-style or a tiny script that enumerates `libs/{auth,bc/*}/src/schema.ts` and re-exports them from a `drizzle-schemas.ts` barrel), or (b) document in CLAUDE.md / best-practices.md that adding a BC includes "update drizzle.config.ts" as a mandatory checklist item. My recommendation: (a), because (b) relies on humans.

### [MINOR] `bauth_*` tables in `public` schema while `SCHEMAS` constant defines `identity`

**File/area:** `libs/auth/src/schema.ts`, `libs/constants/src/schemas.ts`.
**Issue:** `SCHEMAS.IDENTITY = 'identity'` is exported from constants and is in the drizzle `schemaFilter` whitelist, yet `bauthUser/Session/Account/Verification` are all defined as `pgTable('bauth_user', {...})` in the default `public` schema. The comment in `schema.ts` explains "better-auth does not support PostgreSQL schema namespaces," which is the correct technical reason, but it means the `SCHEMAS.IDENTITY` namespace is architected and reserved but empty. A future non-better-auth table (e.g. `identity.user_preferences`) would live in `identity` while the user record itself lives in `public` -- join across schemas.
**Impact:** Low today. Medium if/when "identity-related" tables start being added: the repo will have a split where the user's authoritative row is `public.bauth_user` and satellite data lives in `identity.*`. That's a defensible pattern (better-auth owns its tables, the app owns the rest) but it is not what the current `SCHEMAS` constant communicates.
**Fix:** Either (a) drop `SCHEMAS.IDENTITY` until we actually have identity tables outside better-auth and add it then (leanest), or (b) add a comment on `SCHEMAS.IDENTITY` that says "reserved for non-better-auth identity tables; better-auth's `bauth_*` tables live in `public` by framework constraint." Option (b) now, option (a) if `identity.*` never gets used. Either way, the `schemaFilter: ['public', 'identity', 'audit', 'study']` entry for `identity` in drizzle.config is aspirational and fine.

### [MINOR] Missing `libs/auth/src/auth.test.ts` -- present in airboss-firc, dropped in the port

**File/area:** `libs/auth/src/` (no `auth.test.ts`).
**Issue:** airboss-firc has `libs/auth/src/auth.test.ts` covering `requireAuth` / `requireRole` (makeUser/makeEvent helpers + authenticated/unauthenticated/role-match cases). The port brought `auth.ts` but not its companion test. The TEST-PRIORITY-MAP referenced in `docs/agents/TESTING.md` explicitly lists `libs/auth/src/guards.test.ts` as a priority 4 test.
**Impact:** The two guard functions are the single most load-bearing piece of the whole auth lib -- every protected route calls one of them. Shipping them without their (already-written in the reference repo) tests is a testing regression, not an architecture regression, but it is the kind of thing Phase 0 explicitly exists to bring in.
**Fix:** Port the test file from airboss-firc. Trivial adaptation (@firc -> @ab, update the user shape to include the new firstName/lastName/banned fields that airboss's `AuthUser` carries).

### [MINOR] `apps/study/src/lib/server/auth.ts` wrapper is meaningful but under-documented; `cookies.ts` wrapper is thin but justified

**File/area:** `apps/study/src/lib/server/auth.ts`, `apps/study/src/lib/server/cookies.ts`.
**Issue:** The `$lib/server/auth.ts` wrapper does three real jobs: (1) reads `BETTER_AUTH_SECRET` from env with a clear error, (2) passes the study-specific `baseURL` built from `PORTS.STUDY`, (3) lazy-skips init during `building`. That's legitimately app-specific. But when future surface apps (`spatial/`, `audio/`, `firc/`) are stamped out, each will need the same three-job wrapper, and this is exactly where divergence creeps in (ref the `sim-shell` review in docs where sim got the baseURL wrong and shipped with hangar's port). `$lib/server/cookies.ts` just injects `dev` from `$app/environment` into `forwardAuthCookies` / `clearSessionCookies`. Also valid because only the app knows `dev`, but two functions that each do one line of shimming is borderline.
**Impact:** App-specific for now, future-risk for proliferation. Every surface app creates two near-identical server wrappers, and one day one of them will diverge by mistake (wrong port, wrong `isDev` resolution).
**Fix:** Phase-0-acceptable. But capture a pattern note in `docs/agents/reference-sveltekit-patterns.md` (or best-practices.md) that says: "every surface app has these three files in `$lib/server/`: `auth.ts` (createAuth factory with app port), `cookies.ts` (isDev injection), `db.ts` if app-specific queries). Keep them identical-shape across apps." Consider factoring the shared scaffolding into a `createAppAuth({ port, dev })` helper in `@ab/auth` if it's truly identical across surfaces -- but only after 2-3 apps exist and the shape is proven, not speculatively.

### [MINOR] `scripts/db/seed-dev-users.ts` uses deep relative paths, not `@ab/*` aliases

**File/area:** `scripts/db/seed-dev-users.ts:13-15`.
**Issue:** Imports read:

```typescript
import { bauthAccount, bauthUser } from '../../libs/auth/src/schema';
import { DEV_ACCOUNTS, DEV_PASSWORD, PORTS } from '../../libs/constants/src/index';
import { generateAuthId } from '../../libs/utils/src/ids';
```

CLAUDE.md mandates `@ab/*` for cross-lib imports. Scripts are in `tsconfig.json`'s `include` and the path aliases are set at the root tsconfig, so bun + tsconfig paths would resolve `@ab/auth` etc. The script also recreates a `db` client locally rather than importing `@ab/db`'s `db` + `client` -- arguably reasonable so the script controls its own shutdown, but it duplicates connection wiring.
**Impact:** Minor -- scripts work fine. But they set a precedent. Every future seed/migration/admin script will copy this pattern and bypass the alias system, fragmenting the import convention.
**Fix:** Change imports to `@ab/auth`, `@ab/constants`, `@ab/utils`. For the client, either (a) use `@ab/db`'s exported `client` and call `client.end()` at the end (the connection module already wires SIGTERM shutdown, but explicit `await client.end()` at script exit is fine), or (b) keep the local client but justify it in a comment ("standalone seed avoids importing the shared pool's SIGTERM handlers"). Add a one-line rule to CLAUDE.md: "scripts use `@ab/*` aliases too."

### [MINOR] `@ab/*` package names are inconsistent in `@ab/bc-study` (hyphen) and `@ab/study` (app)

**File/area:** `apps/study/package.json`, `libs/bc/study/package.json`.
**Issue:** `apps/study` is `@ab/study`. `libs/bc/study` is `@ab/bc-study`. In airboss-firc the apps were `@firc/sim`, `@firc/hangar` etc. with no BC-level clash. Here we now have an `@ab/study` app and an `@ab/bc-study` lib that represent the same bounded context at different layers. Users will confuse the two when reading imports.
**Impact:** Naming friction; not an architectural bug. Also tangles with finding [MAJOR] above.
**Fix:** When resolving the bc package-name-vs-alias mismatch, also decide the disambiguation: options are `@ab/bc-study` (keep -- the app is the consumer, the lib is the producer, names rhyme on purpose) or rename the app to `@ab/study-app`. Recommend keeping both as-is and just documenting the convention: apps are `@ab/<surface>`, BC libs are `@ab/bc-<bc>`.

### [MINOR] `libs/auth/src/client.ts` imports from `better-auth/svelte` -- Svelte-specific code in the "infrastructure" auth lib

**File/area:** `libs/auth/src/client.ts`.
**Issue:** The file creates a Svelte-specific auth client (`createAuthClient` from `better-auth/svelte`). `libs/auth` is framework-agnostic elsewhere (`auth.ts` uses SvelteKit's `RequestEvent` type but that's a server-side SvelteKit concept, not Svelte the framework). The client here is explicitly Svelte-runes-compatible. If a future surface app uses a different client tech (e.g. a Tauri shell, an embedded WebView, an RN wrapper of the same backend), this file is not reusable.
**Impact:** Low until a non-Svelte consumer exists. Then `libs/auth` stops being a pure infrastructure lib and needs to be split.
**Fix:** No change needed in Phase 0. Flag for future: if we ever ship a non-Svelte surface, factor `client.ts` into `libs/auth/src/svelte/client.ts` (or a separate `@ab/auth-svelte` lib), and leave `@ab/auth` as backend-only. Document the expectation in the lib's index comment.

### [MINOR] `libs/auth/src/index.ts` re-exports `bauthAccount/Session/User/Verification` schemas on the public surface

**File/area:** `libs/auth/src/index.ts:15`.
**Issue:** The barrel exposes all four Drizzle table objects. This is consistent with airboss-firc's surface, and the seed script does need one of them. But the comment in `schema.ts` says "READ-ONLY -- for querying only" and the Phase 1 work package (`spaced-memory-items`) will want to read `bauthUser` to join with `card_state`. So the export is intentional. Caveat: exposing the table objects means any consumer can also write to them (Drizzle doesn't enforce read-only at the type level), and there's no guard against accidental `db.insert(bauthUser)` calls outside better-auth.
**Impact:** Today's seed script (`scripts/db/seed-dev-users.ts`) is the one legitimate writer that bypasses better-auth; every other writer would be a bug. The risk is low but real.
**Fix:** Phase-0-acceptable. Consider adding a lint rule or a typed wrapper (e.g. expose `bauthUser` as a type-narrowed `readonly` handle in the barrel, with a separate non-exported `_bauthUserWrite` for the seed script to import via `@ab/auth/schema` deep import). Not worth doing now -- flag for when the team grows.

### [MINOR] `libs/*/package.json` declare no dependencies; all deps hoisted to root

**File/area:** every `libs/*/package.json` (auth, constants, db, utils, themes, types, ui, bc/study).
**Issue:** All eight lib package.jsons list only `name`, `private`, `type`. Dependencies like `better-auth`, `drizzle-orm`, `postgres`, `ulidx`, `resend` are declared only in the root. This matches airboss-firc exactly, and it works because bun workspaces hoist. But it means no lib can be extracted, no lib has an isolated lockfile, and reading any lib's package.json does not tell you what it depends on.
**Impact:** Minor today. Future-risk if a lib ever needs to be published, or if a lib is imported into a non-bun runtime. Also conceals bad dependency direction: it is impossible from package.json alone to tell whether `libs/utils` depends on `resend` (it does not) or `libs/auth` depends on `drizzle-orm` (it does).
**Fix:** Phase-0-acceptable. Document the hoist policy in CLAUDE.md "Stack" section. If isolation ever matters, declare deps per-lib and run `bun install` -- workspaces still hoist but each lib's surface is documented.

### [NIT] `authCookieOptions` private helper inside `cookies.ts` vs inline options

**File/area:** `libs/auth/src/cookies.ts:15`.
**Issue:** `authCookieOptions` is a private helper only called once (from `forwardAuthCookies`). Inlining would be fine but the helper is readable. No action.

### [NIT] `LOG_LEVEL_ORDER: Record<LogLevel, number>` vs the `LOG_LEVELS` const assertion pattern elsewhere

**File/area:** `libs/constants/src/deployment.ts`.
**Issue:** `LOG_LEVELS` uses the `as const` + derived-type pattern (good, idiomatic). `LOG_LEVEL_ORDER` is a `Record<LogLevel, number>` -- also fine, but it is a runtime object whose shape must stay in sync with `LOG_LEVELS`. Missing a level in one but not the other is a silent bug.
**Fix:** Optional: derive `LOG_LEVEL_ORDER` from `LOG_LEVELS` values (e.g. `Object.values(LOG_LEVELS).reduce((a, v, i) => ({ ...a, [v]: i }), {})`) with a type assertion so order is authoritative from one place. Current code is fine.

### [NIT] `libs/auth/src/email/` sub-barrel vs flat layout

**File/area:** `libs/auth/src/email/`.
**Issue:** `email/` has its own `index.ts` re-exporting from `transport.ts` and `templates.ts`. Small scope; a flat `libs/auth/src/email-templates.ts` + `email-transport.ts` would be equivalent. The nested barrel is fine and matches airboss-firc.

### [NIT] `docker-compose.yml` at repo root is correct, but its mailpit service isn't referenced in `.env.example`

**File/area:** `docker-compose.yml` + `.env.example`.
**Issue:** Mailpit runs on port 1027/8027. The email transport (`libs/auth/src/email/transport.ts`) uses Resend if `RESEND_API_KEY` is set, else logs to console. It does not talk to mailpit at all. The mailpit service is therefore currently unused -- it'll eventually be wired up as an SMTP fallback for dev email, but today it's dead infrastructure.
**Fix:** Either (a) wire email transport to try mailpit first in dev before falling back to console, or (b) drop the mailpit service until it's actually needed. Current state is harmless; flag for Phase 1 or 2.

## Clean

- **Dependency direction.** `constants` (leaf) <- `utils` <- `db` <- `auth`. No cycles. Apps depend on libs only. No lib imports from another app or from an upward direction.
- **Cross-lib imports use `@ab/*` aliases.** Every file in `libs/` and `apps/` that crosses a lib boundary uses the alias. The one exception (`@ab/constants/env` subpath) is called out above.
- **App vs lib split is sound.** `$lib/server/auth.ts` and `$lib/server/cookies.ts` own the app-specific concerns (env read, port binding, `dev` flag injection). `@ab/auth` owns the reusable factory, guards, and forwarding logic. No business logic leaks into libs; no platform logic is trapped in the app.
- **Path alias scheme matches monorepo intent.** `@ab/constants`, `@ab/db`, `@ab/auth`, `@ab/utils`, `@ab/themes`, `@ab/ui`, `@ab/types` all consistent. The bc package-name mismatch is the one ripple (Major finding).
- **Logger coupling is one-way.** `logger.ts` imports only `@ab/constants`. `db/connection.ts`, `email/transport.ts` import the logger. No reverse edges. Safe.
- **Guard API is correct.** `requireAuth(event)` takes the full `RequestEvent` (matches the documented best-practice pattern -- and fixes the exact bug called out in the sim-shell review). Returns the non-null user so callers never touch `locals.user!`. `requireRole(event, ...roles)` composes cleanly on top.
- **Better-auth configuration is centralized in `createAuth`.** Cross-subdomain cookies, plugins, email adapters, modelName prefixes, and the custom `generateAuthId` all live in one factory function. No app can accidentally miswire any of them.
- **ID generation goes through `@ab/utils/ids.ts`.** `generateAuthId` for better-auth (unprefixed per framework requirement), `generateCardId` / `generateReviewId` for the upcoming BC schema, `createId(prefix)` as the generic escape hatch. Consistent with CLAUDE.md's rule about never calling `ulid()` directly.
- **Error handler is framework-agnostic then wired in `hooks.server.ts`.** `createErrorHandler({ logger })` in `@ab/utils` is a pure factory; the SvelteKit `handleError` wrapper lives in the app. Reusable for future surfaces.
- **`app.d.ts` pulls `AuthSession` / `AuthUser` types from `@ab/auth`** -- no duplicated type definitions. Good.
- **`.env.example` is complete for Phase 0** -- DATABASE_URL, BETTER_AUTH_SECRET, RESEND_API_KEY (commented/optional), LOG_LEVEL, DB_POOL_SIZE all present. Matches what `libs/db/connection.ts` and `libs/auth/server.ts` actually read.
- **`docker-compose.yml` placement at repo root is correct** -- it provisions shared infra (postgres on 5435, mailpit) that all apps share; per-app compose files would fragment the story.
- **`schemaFilter` in `drizzle.config.ts` is already forward-looking** -- includes `public`, `identity`, `audit`, `study`. When Phase 1 adds `study.card_state`, the filter is ready.
- **No magic strings in the port.** Cookie domains, ports, routes, roles, log levels, schema names all come from `@ab/constants`. No inlined path strings.
