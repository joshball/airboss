# Reference: SvelteKit + Monorepo Patterns

Implementation patterns for constants, database, auth, scripts, testing, and monorepo organization.
Originally extracted from legion-overwatch (2026-03-24). Adapted for airboss-firc (PostgreSQL, 4 SvelteKit apps).

---

## 1. Monorepo Structure

```
libs/
  auth/          better-auth config
  constants/     enums, routes, config
  bc/            Bounded contexts (course, enrollment, evidence, compliance, platform)
  design-tokens/ CSS tokens, theme system
  testing/       test runner framework
  themes/        theme definitions
  types/         shared types, Zod schemas
  ui/            Svelte components
apps/
  overwatch-app/ SvelteKit (thin shell)
products/
  sdk/           HTTP adapter, OpenAPI tracking
  TAL/           Org-specific test implementations
scripts/         CLI commands (commander-based)
docs/
  agents/        best-practices.md (hard-won rules)
tests/
  e2e/           Playwright browser tests
  integration/   API tests (Playwright, no browser)
  helpers/       fixtures, auth, seed data
```

**Key principles:**

- Libs are plain TS directories, not NPM packages. No package.json inside libs/.
- All dependencies in a single package.json.
- Path aliases: `@overwatch/*` -> `libs/*/src`.
- Business logic in libs. Apps are thin SvelteKit shells.
- One `node_modules` root (symlink).

**For airboss-firc:** Same structure. `@firc/*` aliases. Shared `libs/ui/` for components used across sim/hangar/ops.

---

## 2. Constants Organization

### File structure (`libs/constants/src/`)

| File               | Purpose                                 |
| ------------------ | --------------------------------------- |
| `routes.ts`        | All URL paths + dynamic route functions |
| `ports.ts`         | Dev/test port numbers                   |
| `tables.ts`        | Prefixed table names (`bauth_`, `app_`) |
| `roles.ts`         | Auth roles hierarchy                    |
| `entities.ts`      | Domain enums (80+ constants)            |
| `config.ts`        | App config (max lengths, limits)        |
| `features.ts`      | Feature flags                           |
| `system-config.ts` | Runtime-configurable settings           |
| `guards.ts`        | Type guards for config/feature keys     |
| `cookies.ts`       | Cookie names                            |
| `security.ts`      | CSP, security header values             |
| `index.ts`         | Barrel export                           |

### Routes pattern

```typescript
export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  ORG_HOME: (orgSlug: string) => `/${orgSlug}`,
  WS_HOME: (orgSlug: string, wsSlug: string) => `/${orgSlug}/${wsSlug}`,
  API_AUTH: "/api/auth",
} as const;
```

- Never hardcode path strings. Always `ROUTES.LOGIN`, not `'/login'`.
- Dynamic routes: `ROUTES.ORG_HOME(slug)` not template literals.
- Tests import via relative path: `import { ROUTES } from '../../libs/constants/src/routes'`.

**For airboss-firc:** Create matching files:

- `routes.ts` -- sim: `/course/`, `/scenario/`; hangar: `/dashboard/`; ops: `/admin/`
- `ports.ts` -- one port per app + test ports
- `tables.ts` -- table names within PostgreSQL schema namespaces (`course`, `published`, `enrollment`, `evidence`, `compliance`, `identity`, `audit`, `platform`)
- `entities.ts` -- competency enums, scenario types, scoring enums, course statuses
- `roles.ts` -- instructor, student, admin, auditor

---

## 3. Database Patterns

### Schema organization

Schema split by domain across files (legion uses `libs/database/src/schema/`; airboss-firc uses `libs/bc/*/` with PostgreSQL schema namespaces):

- `control.ts` -- auth tables, system tables (sequences)
- `org.ts` -- orgs, members, workspaces
- `test-management.ts` -- suites, definitions
- `test-monitoring.ts` -- endpoints, findings, rollups
- `test-results.ts` -- runs, calls, logs

### Connection pattern

```typescript
export function getDb(): AppDb {
  if (db) return db;
  const path = DATA_DIR.getDbPath();
  rawDb = new Database(path);
  rawDb.exec("PRAGMA journal_mode = WAL;");
  rawDb.exec("PRAGMA foreign_keys = ON;");
  db = drizzle(rawDb, { schema: allSchema });
  return db;
}
```

**For airboss-firc (PostgreSQL):** Use `drizzle-orm/postgres-js` with connection pooling. Same lazy singleton pattern.

### ID generation (Sqids)

```typescript
export function generateId(domain: string): string {
  const db = getDb();
  const row = db.transaction((tx) => {
    tx.insert(appSequences)
      .values({ name: domain, value: 1 })
      .onConflictDoUpdate({
        target: appSequences.name,
        set: { value: sql`${appSequences.value} + 1` },
      })
      .run();
    return tx.select({ value: appSequences.value }).from(appSequences).where(eq(appSequences.name, domain)).get();
  });
  return sqids.encode([row.value]);
}
```

Short, unique, domain-scoped IDs. Transaction-wrapped to prevent duplicates.

**For airboss-firc:** Two-tier ID system per [ADR 010](../../decisions/010-ID_STRATEGY.md). Tier A: `prefix-NNN` catalog IDs (Postgres SEQUENCE, deferred). Tier B: `prefix_ULID` event IDs via `@firc/utils`. Never call `nanoid()` directly -- always use typed generators from `libs/utils/src/ids.ts`.

### Table prefixing

```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { TABLES } from "@overwatch/constants";

export const appOrgs = sqliteTable(TABLES.APP_ORGS, {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  isDeleted: integer("is_deleted").default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
```

Table names come from constants, never hardcoded.

### Soft vs hard delete

- **Soft delete:** orgs, services, findings (set `isDeleted` flag)
- **Hard delete:** workspaces, junctions, memberships (remove row)
- **No CASCADE DELETE.** Cleanup in application logic.

---

## 4. Auth Guards

### Pattern

```typescript
// $lib/server/auth-guards.ts

export function requireAuth(locals: App.Locals): App.Locals['user'] & {} {
  if (!locals.user || !locals.session) {
    error(401, { message: 'Authentication required' });
  }
  return locals.user;
}

export function requireRootAdmin(locals: App.Locals): void {
  const user = requireAuth(locals);
  const isAdmin = locals.isRootAdmin ?? db_isRootAdmin(user.id);
  if (!isAdmin) error(403, { message: 'Root admin required' });
}

export function requireOrgMember(locals: App.Locals, orgId: string): void {
  const user = requireAuth(locals);
  if (locals.isRootAdmin) return;
  const membership = db.select(...).where(...).get();
  if (!membership) error(403, { message: 'Org membership required' });
}
```

**Usage in form actions:**

```typescript
const user = requireAuth(locals); // Captures user, ensures logged in
requireOrgAdmin(locals, orgId); // Ensures org admin role
// Use user.id, never locals.user!.id
```

**Key:** Call `requireAuth()` first to capture the non-null user. Never use `locals.user!.id`.

**For airboss-firc:**

- `requireAuth(locals)` -- verify logged in
- `requireInstructor(locals)` -- CFI check
- `requireHangarAccess(locals)` -- content authoring permission
- `requireSimAccess(locals, courseId)` -- enrollment check
- Cache role checks in hooks (set `locals.isAdmin` once, not per action)

---

## 5. Form Actions Pattern

### Server-side validation with field-level errors

```typescript
// +page.server.ts
export const actions: Actions = {
  default: async ({ request, locals }) => {
    const user = requireAuth(locals);
    const data = await request.formData();
    const input = {
      name: data.get("name") as string,
      email: data.get("email") as string,
    };

    const result = createAccountSchema.safeParse(input);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      return fail(400, { fieldErrors, ...input });
    }

    try {
      db.insert(table).values(result.data).run();
    } catch (err) {
      return fail(500, { error: "Operation failed" });
    }

    auditLog({ action: "entity.create", actorId: user.id });
    redirect(303, ROUTES.HOME);
  },
};
```

### Form component

```svelte
<script>
  let { form } = $props();
</script>

<form method="POST" use:enhance>
  <Input name="name" label="Name" value={form?.name} error={form?.fieldErrors?.name} required />
  <button>Submit</button>
</form>
```

### Error handling rules

- **Field errors on the field** (inline), **system errors as toasts**.
- Always add `required` to mandatory fields (native HTML validation).
- Return submitted values on failure for form re-population.
- In `use:enhance` handlers, let `update()` re-render -- `form` prop contains `fieldErrors`.
- Use the `Select` component, not raw `<select>`.

---

## 6. Hooks.server.ts Pattern

```typescript
export const handle: Handle = async ({ event, resolve }) => {
  // 1. Rate limiting (auth endpoints)
  if (event.url.pathname.startsWith(ROUTES.API_AUTH)) {
    const limited = checkRateLimit(ip, path);
    if (limited) return new Response("Too many requests", { status: 429 });
  }

  // 2. Auth handler delegation
  if (event.url.pathname.startsWith(ROUTES.API_AUTH)) {
    return await auth.handler(event.request);
  }

  // 3. Feature gate checks
  if (path === ROUTES.REGISTER && !getFeatureFlag(FEATURES.USER_REGISTRATION)) {
    redirect(302, ROUTES.LOGIN);
  }

  // 4. Resolve session
  const session = await auth.api.getSession({ headers: event.request.headers });
  event.locals.session = session?.session ?? null;
  event.locals.user = session?.user ?? null;

  // 5. Cache auth state
  if (session?.user) {
    event.locals.isRootAdmin = db_isRootAdmin(session.user.id);
  }

  // 6. Theme from cookie
  const response = await resolve(event, {
    transformPageChunk: ({ html }) => html.replace(/data-mode="..."/, `data-mode="${themeMode}"`),
  });

  // 7. Security headers
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Strict-Transport-Security", "max-age=31536000");

  return response;
};
```

**For airboss-firc:** Same flow per app. Each app (sim, hangar, ops) has its own hooks with appropriate auth checks.

---

## 7. Layout Hierarchy

```
routes/
  (public)/              -- login, public pages (no auth)
    +layout.server.ts
  (app)/                 -- all protected routes
    +layout.server.ts    -- requireAuth, redirect to login
    [orgSlug]/           -- org context, verify membership
      +layout.server.ts
      [wsSlug]/          -- workspace context
        +layout.server.ts
```

- `(app)/+layout.server.ts` checks session, fetches memberships.
- Nested layouts verify org/workspace access and pass context down.
- Group routes by auth requirement using SvelteKit route groups `(public)` vs `(app)`.

**For airboss-firc sim app:**

```
routes/
  (public)/         -- marketing, login
  (course)/         -- enrolled learner routes
    [courseId]/
      scenario/[scenarioId]/
```

---

## 8. Logging

### Factory pattern

```typescript
// libs/types/src/logger.ts
export function createLogger(context: string) {
  return {
    debug: (msg: string, data?: unknown) => write({ level: "debug", context, msg, data }),
    info: (msg: string, data?: unknown) => write({ level: "info", context, msg, data }),
    warn: (msg: string, data?: unknown) => write({ level: "warn", context, msg, data }),
    error: (msg: string, data?: unknown) => write({ level: "error", context, msg, data }),
  };
}

// Usage
const log = createLogger("auth");
log.info("User logged in", { userId });
```

- Never `console.log()` directly.
- Context identifies subsystem: `'auth'`, `'database'`, `'engine'`, `'scenario'`.
- Swap implementation for production (Sentry, Axiom) without changing call sites.
- Biome ignores console calls in the write function.

---

## 9. Zod Validation

### Pattern

```typescript
// libs/types/src/schemas/account.ts
import { APP_CONFIG } from "@overwatch/constants";
import { z } from "zod";

export const createAccountSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
  persona: z.enum(["dev", "pm"]).optional(),
});

export type CreateAccount = z.infer<typeof createAccountSchema>;
```

- Schema in dedicated file per domain.
- Enum values from constants, never hardcoded.
- Export both schema and inferred type.
- Use `.safeParse()` in form actions, `.flatten()` for field errors.

**For airboss-firc:** Create schemas for course, scenario, learner, enrollment, scoring.

---

## 10. Design Tokens

### Token categories

```typescript
colors: {
  text, textSubtle, textInverse,
  surface, surfaceHover,
  border, borderSubtle,
  primary, primaryHover, primaryText,
  danger, success, warning, info,
}
spacing: { xs, sm, md, lg, xl, '2xl' }
typography: {
  fontDisplay, fontHeading, fontBody, fontNav, fontControl, fontLabel, fontMono,
  fontSizeXxs, fontSizeSm, fontSizeMd, fontSizeLg, fontSizeXl,
  lineHeight, letterSpacing,
}
layout: { borderRadius, borderWidth, maxWidth }
effects: { transition, boxShadow, focusRing }
```

### CSS usage

```css
.button {
  background: var(--ds-color-primary);
  padding: var(--ds-spacing-md);
  border-radius: var(--ds-layout-border-radius);
  transition: background var(--ds-effects-transition-fast);
}
```

### Theme switching

```html
<html data-mode="dark"></html>
```

Themes set CSS custom properties on `:root` scoped by `[data-mode="dark"]` / `[data-mode="light"]`. Theme mode read from cookie in hooks, applied via `transformPageChunk`.

**For airboss-firc:** Same approach. Token prefix `--t-*` (decided in ADR 003). Shared across all 4 apps.

---

## 11. Scripts & CLI

### Structure (commander.js)

```typescript
#!/usr/bin/env bun
import { Command } from 'commander';
import { PORTS } from '@overwatch/constants';

const program = new Command()
  .name('dev')
  .description('Dev server management');

program
  .command('start')
  .option('--bg', 'Run in background')
  .action(async (options) => { ... });

program
  .command('status')
  .action(async () => { ... });

program.parse();
```

### Script inventory

| Script     | Purpose                                           |
| ---------- | ------------------------------------------------- |
| `dev.ts`   | Dev server lifecycle (start, kill, clean, docker) |
| `build.ts` | Production build + preview                        |
| `check.ts` | Lint + type check                                 |
| `test.ts`  | Unit + e2e test runner                            |
| `db.ts`    | Database operations (seed, reset, backup)         |
| `setup.ts` | Install deps, create symlinks                     |

### Package.json

```json
{
  "scripts": {
    "dev": "bun run scripts/dev.ts",
    "build": "bun run scripts/build.ts",
    "check": "bun run scripts/check.ts",
    "test": "bun run scripts/test.ts",
    "db": "bun run scripts/db.ts",
    "setup": "bun run scripts/setup.ts"
  }
}
```

**For airboss-firc:** Adapt for multi-app:

```bash
bun dev sim          # Start sim app
bun dev hangar       # Start hangar app
bun dev all          # Start all apps
bun check            # Types + lint across all
bun test             # Unit + e2e
bun db seed          # Populate dev database
bun db reset         # Reset and re-seed
bun scenario test    # Run scenario engine tests
```

---

## 12. Testing (Playwright)

### Fixture pattern

```typescript
// tests/helpers/fixtures.ts
import { test as base } from "@playwright/test";

export const test = base.extend<PageFixtures, WorkerApiFixtures>({
  // Page fixture: fresh browser page per test
  rootAdminPage: async ({ page }, use) => {
    await loginAsRootAdmin(page);
    await use(page);
  },

  // API fixture: shared session across worker (avoids rate limiting)
  rootAdminApi: [
    async ({ playwright }, use) => {
      const context = await playwright.request.newContext({ baseURL });
      await authenticateAsRootAdmin(context);
      await use(context);
      await context.dispose();
    },
    { scope: "worker" },
  ],
});
```

### Config

```typescript
export default defineConfig({
  projects: [
    { name: "e2e", testDir: "./tests/e2e", use: { channel: "chromium" } },
    { name: "integration", testDir: "./tests/integration" },
  ],
  webServer: {
    command: "bun run dev",
    url: `http://localhost:${PORTS.UI}`,
    reuseExistingServer: !process.env.CI,
  },
});
```

**For airboss-firc:** Fixtures for `instructorPage`, `studentPage`, `authorPage`, `opsPage`. Separate webServer entries per app if testing multiple apps.

---

## 13. Audit Logging

```typescript
export const appAuditLog = sqliteTable(TABLES.APP_AUDIT_LOG, {
  id: integer("id").primaryKey({ autoIncrement: true }),
  action: text("action").notNull(), // 'org.member.add', 'product.delete'
  actorId: text("actor_id").notNull(),
  targetType: text("target_type"), // 'org', 'workspace'
  targetId: text("target_id"),
  detail: text("detail"), // JSON
  createdAt: integer("created_at").notNull(),
});

// Usage in form actions
auditLog({
  action: "workspace.create",
  actorId: user.id,
  targetType: "workspace",
  targetId: workspace.id,
  detail: JSON.stringify({ name: workspace.name }),
});
```

**For airboss-firc:** Essential for FAA compliance. Audit actions: `course.create`, `scenario.update`, `learner.enroll`, `scenario.complete`, `content.publish`, `content.version`.

---

## 14. SvelteKit Config

```javascript
const config = {
  kit: {
    adapter: adapter(),
    // CSP only in production (Vite dev needs eval for HMR)
    ...(!isDev && {
      csp: {
        directives: {
          "default-src": ["self"],
          "style-src": ["self", "unsafe-inline", "https://fonts.googleapis.com"],
          "script-src": ["self", "nonce"],
          "img-src": ["self", "data:"],
          "connect-src": ["self"],
        },
      },
    }),
    alias: {
      "@overwatch/constants": "../../libs/constants/src/index.ts",
      // ... more aliases
    },
    env: { dir: "../../" },
  },
};
```

**Key:** CSP in config (with nonces), not in hooks. Aliases point to `libs/*/src`. Env dir points to repo root for shared `.env`.

---

## 15. Biome Config

```json
{
  "formatter": {
    "indentStyle": "tab",
    "indentWidth": 2,
    "lineWidth": 120
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "all",
      "semicolons": "always"
    }
  },
  "linter": {
    "rules": {
      "suspicious": { "noConsole": "warn", "noExplicitAny": "error" },
      "style": { "noNonNullAssertion": "warn", "useConst": "error" }
    }
  },
  "assist": {
    "actions": {
      "source": {
        "organizeImports": {
          "options": {
            "groups": [
              ":BUN:",
              ":NODE:",
              ":PACKAGE:",
              ["@overwatch/**", ":ALIAS:"],
              ["$app/**", "$lib/**", "$env/**"],
              ":PATH:"
            ]
          }
        }
      }
    }
  }
}
```

**For airboss-firc:** Copy and adjust aliases to `@firc/**`.

---

## 16. Key Differences: legion-overwatch vs airboss-firc

| Aspect        | Legion-Overwatch                    | airboss-firc                                                   |
| ------------- | ----------------------------------- | ----------------------------------------------------------- |
| Database      | SQLite (single file, no migrations) | PostgreSQL (migrations)                                     |
| Apps          | 1 (`overwatch-app`)                 | 4 (sim, hangar, ops, runway)                                |
| Auth          | better-auth (email/password)        | Shared session cookie (ADR 007), email/password initially   |
| Table prefix  | `bauth_`, `app_`                    | PostgreSQL schema namespaces (`course`, `enrollment`, etc.) |
| ID generation | Sqids (atomic counter)              | ULID two-tier (ADR-010)                                     |
| Domain        | Test management, Azure DevOps       | FIRC courses, scenarios, FAA compliance                     |
| Multi-tenancy | Yes (org-scoped)                    | Likely single-tenant or course-scoped                       |
| Core lib      | `libs/testing/` (test runner)       | `libs/engine/` (tick engine)                                |
