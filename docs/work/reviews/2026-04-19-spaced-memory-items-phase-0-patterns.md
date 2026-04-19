---
title: 'Phase 0 Patterns Review: spaced-memory-items'
date: 2026-04-19
phase: 0
category: patterns
branch: build/spaced-memory-items
commit: 99c4c3b
reviewer: patterns
---

# Phase 0 Patterns Review

Scope: HEAD (`99c4c3b`) vs HEAD~1 (`cd43a21`). The commit ports auth, db, and logging
infrastructure from airboss-firc -- libs/{auth,constants,db,utils}, apps/study wiring,
docker-compose, drizzle.config, seed script, and env example.

This review checks Phase 0 against the explicit rules in `/CLAUDE.md` (No `any`,
no non-null assertions, constants for literals, routes through `ROUTES`, cross-lib
imports via `@ab/*`, Drizzle-only, Svelte 5 runes only, no AI attribution, bun-only,
PRIME DIRECTIVE on stubs, text formatting, biome compliance).

## Summary

| Severity | Count |
| -------- | ----- |
| Critical | 0     |
| Major    | 3     |
| Minor    | 6     |
| Nit      | 3     |

The big picture: Phase 0 is substantially rule-compliant. No `any`, no non-null
assertions, no npm/yarn/pnpm, no AI attribution, no raw SQL, no Svelte 4 patterns,
no em-dashes, no forbidden "honest" language, no TODO/FIXME debt, no stub language.
`bun run check` passes with 0 errors, 0 warnings. The findings are concentrated in
three areas:

1. Inline route paths in `(app)/+layout.svelte` (the only inline-route violation).
2. A handful of magic strings that should live in `libs/constants/` (better-auth
   endpoint paths, better-auth cookie names, default From address, provider strings,
   DB connection-string fallback).
3. Minor inconsistencies in the seed and drizzle configs (relative imports to
   `../../libs/`, schema-filter strings hand-typed instead of pulled from `SCHEMAS`).

## Findings

### [Major] Inline route paths in (app)/+layout.svelte nav

**File:** `apps/study/src/routes/(app)/+layout.svelte:6-8`
**Rule violated:** "All routes go through `ROUTES` in `libs/constants/src/routes.ts`. Never write a path string inline." (CLAUDE.md, Critical Rules)
**Issue:** The nav hrefs are hardcoded:

```html
<a href="/memory">Memory</a>
<a href="/reps">Reps</a>
<a href="/calibration">Calibration</a>
```

All three already exist in `ROUTES` (`ROUTES.MEMORY`, `ROUTES.REPS`, `ROUTES.CALIBRATION`).
This is the only source of inline route strings in the new code -- every other
redirect/href in the commit does go through `ROUTES` (login, logout, API_AUTH,
HOME), which makes the gap here more glaring.
**Fix:** Import `ROUTES` and bind:

```svelte
<script lang="ts">
	import { ROUTES } from '@ab/constants';
	let { children } = $props();
</script>

<nav>
	<a href={ROUTES.MEMORY}>Memory</a>
	<a href={ROUTES.REPS}>Reps</a>
	<a href={ROUTES.CALIBRATION}>Calibration</a>
</nav>
```

While editing, also add `lang="ts"` to the `<script>` tag for consistency with
`login/+page.svelte`.

### [Major] Better-auth endpoint paths are magic strings

**File:** `apps/study/src/routes/login/+page.server.ts:25`, `apps/study/src/routes/(app)/logout/+page.server.ts:13`
**Rule violated:** "No magic strings." / "All literal values in `libs/constants/`." (CLAUDE.md, Critical Rules and Code Quality)
**Issue:** `/sign-in/email` and `/sign-out` are typed inline as suffixes to `ROUTES.API_AUTH`. These are better-auth's well-known handler paths, and they're going to appear anywhere the app forwards sign-in, sign-up, verification, reset, or magic-link requests. They're exactly the kind of repeated literal the constants rule exists to catch.
**Fix:** Add a `BETTER_AUTH_ENDPOINTS` const to `libs/constants/src/` (or extend `ROUTES` with an `AUTH_` block) and reference it:

```ts
// libs/constants/src/routes.ts (or a new better-auth.ts)
export const BETTER_AUTH_ENDPOINTS = {
	SIGN_IN_EMAIL: '/sign-in/email',
	SIGN_OUT: '/sign-out',
	SIGN_UP_EMAIL: '/sign-up/email',
	MAGIC_LINK: '/sign-in/magic-link',
	VERIFY_EMAIL: '/verify-email',
} as const;
```

Then: `` `${AUTH_INTERNAL_ORIGIN}${ROUTES.API_AUTH}${BETTER_AUTH_ENDPOINTS.SIGN_IN_EMAIL}` ``.

### [Major] Better-auth session cookie names are magic strings

**File:** `libs/auth/src/logout.ts:12`
**Rule violated:** "No magic strings." (CLAUDE.md, Critical Rules)
**Issue:** `SESSION_COOKIE_NAMES = ['better-auth.session_token', 'better-auth.session_data']` is hardcoded in the logout module. These are cross-cutting identifiers: they appear in the browser, they're the thing being forwarded, and they may get referenced again (e.g., from middleware, tests, or admin tooling).
**Fix:** Move to `libs/constants/src/identity.ts` (or a dedicated `auth.ts`):

```ts
export const BETTER_AUTH_COOKIES = {
	SESSION_TOKEN: 'better-auth.session_token',
	SESSION_DATA: 'better-auth.session_data',
} as const;
```

Logout imports that array. Future code that inspects/forwards the cookies uses the
same names.

### [Minor] DB connection-string fallback duplicated across drizzle.config.ts and seed-dev-users.ts

**File:** `drizzle.config.ts:10`, `scripts/db/seed-dev-users.ts:17`
**Rule violated:** "No magic strings." / "All literal values in `libs/constants/`." (CLAUDE.md)
**Issue:** Both files construct the same fallback DSN:

```ts
process.env.DATABASE_URL ?? `postgresql://airboss:airboss@localhost:${PORTS.DB}/airboss`
```

The user/password/dbname (`airboss/airboss/airboss`) are repeated, and the same
triple is also in `docker-compose.yml` and `.env.example`. If any changes (e.g.,
a security review insists on different dev creds), three files drift.
**Fix:** Add to `libs/constants/src/` (or `dev.ts`):

```ts
export const DEV_DB = {
	USER: 'airboss',
	PASSWORD: 'airboss',
	NAME: 'airboss',
} as const;

export const DEV_DB_URL = `postgresql://${DEV_DB.USER}:${DEV_DB.PASSWORD}@localhost:${PORTS.DB}/${DEV_DB.NAME}`;
```

And have both files import it. `.env.example` can keep the concrete string, since
it can't import TS.

### [Minor] `drizzle.config.ts` schemaFilter bypasses SCHEMAS constant

**File:** `drizzle.config.ts:7`
**Rule violated:** "No magic strings." (CLAUDE.md)
**Issue:** `schemaFilter: ['public', 'identity', 'audit', 'study']` hand-types the same names that live in `SCHEMAS` (`libs/constants/src/schemas.ts`). `'public'` is the Postgres default so it's not in `SCHEMAS`, but `'identity'`, `'audit'`, `'study'` all are.
**Fix:**

```ts
import { SCHEMAS } from './libs/constants/src/schemas';
// ...
schemaFilter: ['public', SCHEMAS.IDENTITY, SCHEMAS.AUDIT, SCHEMAS.STUDY],
```

(`'public'` stays inline -- it's a Postgres concept, not an airboss schema. If
preferred, add `SCHEMAS.PUBLIC = 'public'`.)

### [Minor] `'credential'` provider string in seed script

**File:** `scripts/db/seed-dev-users.ts:54`
**Rule violated:** "No magic strings." (CLAUDE.md)
**Issue:** `providerId: 'credential'` is a better-auth-defined literal used when
seeding password accounts. It will appear again any time the app inspects accounts
(multi-provider, account linking, admin views). Hardcoded one-off today, sprawl
tomorrow.
**Fix:** Add to the same better-auth constants file suggested above:

```ts
export const BETTER_AUTH_PROVIDERS = {
	CREDENTIAL: 'credential',
} as const;
```

`providerId: BETTER_AUTH_PROVIDERS.CREDENTIAL`.

### [Minor] `'pg'` provider string in `createAuth`

**File:** `libs/auth/src/server.ts:31`
**Rule violated:** "No magic strings." (CLAUDE.md)
**Issue:** `drizzleAdapter(db, { provider: 'pg', schema: authSchema })` encodes the database dialect inline. Drizzle supports `'pg' | 'mysql' | 'sqlite'`; this is a small but meaningful choice that belongs in constants next to the existing dialect config (drizzle.config.ts uses `dialect: 'postgresql'`).
**Fix:** Add a shared constant:

```ts
// libs/constants/src/deployment.ts (or a new db.ts)
export const DB_ADAPTER_PROVIDER = 'pg' as const;
```

### [Minor] Default From address uses inline domain instead of constant

**File:** `libs/auth/src/email/transport.ts:5`
**Rule violated:** "No magic strings." (CLAUDE.md)
**Issue:** `const DEFAULT_FROM = 'airboss <noreply@air-boss.org>'` hardcodes the production mail domain inline, while the same domain is already in `COOKIE_DOMAIN_PROD = '.air-boss.org'` (`libs/constants/src/hosts.ts`). A rename in one place silently skips the other.
**Fix:** Derive From from a shared constant:

```ts
// libs/constants/src/hosts.ts
export const MAIL_DOMAIN_PROD = 'air-boss.org' as const;
export const MAIL_FROM_NOREPLY = `airboss <noreply@${MAIL_DOMAIN_PROD}>` as const;
```

(Or, if From should vary by env, parameterize via env var with this as fallback.)

### [Minor] `process.env.LOG_LEVEL` / `NODE_ENV` strings inline in logger

**File:** `libs/utils/src/logger.ts:32,38`
**Rule violated:** "No magic strings." (CLAUDE.md)
**Issue:** `process.env.LOG_LEVEL` and `process.env.NODE_ENV === 'production'` use raw env-var names. `libs/constants/src/env.ts` already provides `getEnv`/`getEnvInt`; the env-var names themselves should be constants too so renames are safe.
**Fix:** Add to `libs/constants/src/env.ts`:

```ts
export const ENV_VARS = {
	LOG_LEVEL: 'LOG_LEVEL',
	NODE_ENV: 'NODE_ENV',
	DATABASE_URL: 'DATABASE_URL',
	DB_POOL_SIZE: 'DB_POOL_SIZE',
	BETTER_AUTH_SECRET: 'BETTER_AUTH_SECRET',
	RESEND_API_KEY: 'RESEND_API_KEY',
} as const;
```

Use `getEnv(ENV_VARS.LOG_LEVEL, 'info')` in logger, `requireEnv(ENV_VARS.DATABASE_URL)`
in connection.ts, etc. Keeps the whole list auditable in one place.

### [Nit] `60 * 60 * 24 * 7` magic calculation for session max age

**File:** `libs/auth/src/cookies.ts:12`
**Rule violated:** "No magic numbers." (CLAUDE.md)
**Issue:** `const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;` is file-local and
inferred. Session lifetime is a deployment-level value; it belongs in
`libs/constants/src/deployment.ts` alongside `DB_POOL_SIZE`, `SHUTDOWN_TIMEOUT_MS`,
etc.
**Fix:** Move to `libs/constants/src/deployment.ts` and import. While there, pick a
name that matches the existing `_MS` convention or explicitly calls out the unit
(`SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60` -- days-first reads cleaner).

### [Nit] `apps/study/src/lib/server/auth.ts` duplicates `baseURL` default

**File:** `apps/study/src/lib/server/auth.ts:11`
**Rule violated:** DRY / "Link, don't inline." (CLAUDE.md, Doc Style -- spirit)
**Issue:** The app wrapper passes `baseURL: \`http://localhost:${PORTS.STUDY}\`` even
though `createAuth` already defaults `baseURL` to the same value (`libs/auth/src/server.ts:32`).
This works but duplicates the default and guarantees future drift.
**Fix:** Drop the `baseURL` from the app call so the lib default is the source of
truth, or add a `getDefaultAuthBaseURL()` helper exported from `@ab/auth` if the
app legitimately needs to read it for other purposes.

### [Nit] `<script>` missing `lang="ts"` in root and (app) layouts

**File:** `apps/study/src/routes/+layout.svelte:1`, `apps/study/src/routes/(app)/+layout.svelte:1`
**Rule violated:** Project convention -- `login/+page.svelte` uses `<script lang="ts">`, these don't.
**Issue:** Minor inconsistency. Both files declare `let { children } = $props();` which
is fine in untyped Svelte but means TS features (e.g., `Snippet` typing) aren't
available if the file grows. Every other Svelte file you write will likely be
`lang="ts"`.
**Fix:** Add `lang="ts"` and (optionally) type children:

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children }: { children: Snippet } = $props();
</script>
```

## Clean

The following rules are cleanly satisfied across Phase 0 and are called out explicitly so the next phase doesn't relitigate them:

- **No `any`** -- zero `any`/`<any>`/`as any` in new .ts files. `hooks.server.ts` uses `Record<string, unknown>` with narrowing casts instead, which is correct per CLAUDE.md ("Prefer proper types, generics, `unknown` with guards").
- **No non-null assertions (`!`)** -- none in new files.
- **No raw SQL / `sql` template backticks** -- everything goes through Drizzle. `escapeLikePattern` is plain regex on a string, not SQL.
- **Svelte 5 runes only** -- `$props()`, `$state()`, `$effect()` used correctly in `login/+page.svelte`. No `$:`, no `export let`, no `<slot>`, no `$app/stores` (login page uses `$app/environment` and `$app/forms`, both current).
- **`@ab/*` cross-lib imports** -- every lib-to-lib and app-to-lib import in new code uses `@ab/*`. The two files with relative `../../libs/...` imports (`scripts/db/seed-dev-users.ts`, `drizzle.config.ts`) sit outside the SvelteKit alias scope (root-level config + bun script). Architecture review already covers this tradeoff; patterns-wise it's acceptable.
- **Prefixed ULID IDs via `@ab/utils`** -- `generateAuthId`, `generateCardId`, `generateReviewId` all live in `libs/utils/src/ids.ts`; `createId(prefix)` is the single ULID source; `generateAuthId`'s unprefixed output is justified in-code ("better-auth manages its own tables").
- **No direct `nanoid()` / `ulid()` calls outside the ID factory.**
- **No npm/yarn/pnpm/npx** -- `package.json` scripts use `bun` / `bunx`, `scripts/check.ts` uses `bun`/`bunx`. `README` / deployment docs not modified in this commit.
- **No AI attribution** in commit message (`git log -1`), code comments, or docs.
- **No `// for now`, `// stub`, `// TODO later`** in any new file. PRIME DIRECTIVE honored: the port brings the real libs from airboss-firc with only the `@firc/` -> `@ab/` rename.
- **No TODO/FIXME/XXX/HACK** comments in new code. The sole deferred comment (`requireEmailVerification: false, // Enable later when email is fully tested`) is a feature flag, not a stub, and ties to a real env decision.
- **Biome clean** -- `bun run check` passes with 0 errors, 0 warnings; `bunx biome check .` clean across 48 files. Tabs, single quotes, trailing commas, semicolons all consistent.
- **Text formatting** -- no em-dash/en-dash, no unicode arrows, no "honest" variants. Email subjects use `--` correctly (`Verify your email -- airboss`).
- **Session todo** -- `docs/work/todos/20260418-01-TODO.md` exists and documents this session (kick off spaced-memory-items build, phased reviews).
- **Svelte 5 rune files** -- `apps/study/src/lib/server/auth.ts` and `cookies.ts` are plain `.ts` (no runes needed); no rune code outside `.svelte` / `.svelte.ts`.
- **No deleted commented-out code** -- diff is additive. The two pre-existing layouts lost only their tab-indent inside `<script>`, not any code.

## Recommended fix order for Phase 0.1 polish

1. `(app)/+layout.svelte` nav -> `ROUTES` (Major, 3-line edit).
2. Better-auth endpoints + cookies + provider -> shared constants module (Major, one new file).
3. Default From + env-var names + session-max-age + `'pg'` provider -> constants (Minor, same constants module).
4. `schemaFilter` uses `SCHEMAS` (Minor, import swap).
5. Drop duplicate `baseURL` in app wrapper (Nit) and add `lang="ts"` to layout scripts (Nit).

All fixes are additive and inside files that Phase 1 will not otherwise touch, so
they can land as a single "patterns polish" commit before the Spaced Memory Items
BC work begins.
