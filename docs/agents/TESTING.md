# Testing Strategy

Testing index for airboss-firc. Read this before writing any tests.

**Current state (2026-03-28):** 196 tests passing. Vitest configured with path aliases and serial execution. Playwright installed (E2E stubs written, not yet runnable).

---

## Index

| Doc                                                          | What it covers                                |
| ------------------------------------------------------------ | --------------------------------------------- |
| This file                                                    | Strategy, priorities, infrastructure setup    |
| [testing/patterns.md](testing/patterns.md)                   | How to write unit, integration, and E2E tests |
| [testing/TEST-PRIORITY-MAP.md](testing/TEST-PRIORITY-MAP.md) | What to test, by area, ordered by priority    |

---

## Layers

| Layer       | Tool       | What it covers                              | Where tests live                            |
| ----------- | ---------- | ------------------------------------------- | ------------------------------------------- |
| Unit        | Vitest     | Pure functions (engine, utils, Zod schemas) | Colocated: `libs/{lib}/src/*.test.ts`       |
| Integration | Vitest     | BC functions hitting real DB                | Colocated: `libs/bc/{domain}/src/*.test.ts` |
| E2E         | Playwright | User-visible flows in apps                  | `apps/{app}/tests/*.spec.ts`                |

**Rule:** Integration tests hit the real database -- no DB mocks. Use transaction rollback for isolation.

---

## Infrastructure Setup (do this first)

Before writing any tests, this scaffolding must exist:

### 1. `vitest.config.ts` (root)

```ts
import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@firc/constants": resolve("./libs/constants/src"),
      "@firc/types": resolve("./libs/types/src"),
      "@firc/db": resolve("./libs/db/src"),
      "@firc/auth": resolve("./libs/auth/src"),
      "@firc/audit": resolve("./libs/audit/src"),
      "@firc/bc/course": resolve("./libs/bc/course/src"),
      "@firc/bc/enrollment": resolve("./libs/bc/enrollment/src"),
      "@firc/bc/evidence": resolve("./libs/bc/evidence/src"),
      "@firc/bc/compliance": resolve("./libs/bc/compliance/src"),
      "@firc/bc/platform": resolve("./libs/bc/platform/src"),
      "@firc/engine": resolve("./libs/engine/src"),
    },
  },
});
```

### 2. `tests/setup.ts` (root)

```ts
import { afterEach } from "vitest";
import { db } from "@firc/db";
import { sql } from "drizzle-orm";

// Roll back each test's DB writes
afterEach(async () => {
  await db.execute(sql`ROLLBACK`);
  await db.execute(sql`BEGIN`);
});
```

> **Note:** Integration tests must wrap each test in a transaction. See [patterns.md](testing/patterns.md) for the `withTestTx` helper.

### 3. `playwright.config.ts` (root)

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./apps",
  testMatch: "**/tests/**/*.spec.ts",
  use: {
    baseURL: "http://localhost:7610", // hangar default
    trace: "on-first-retry",
  },
  webServer: {
    command: "bun run dev --filter sim --filter hangar",
    url: "http://localhost:7600",
    reuseExistingServer: !process.env.CI,
  },
});
```

### 4. `package.json` scripts

```json
"test": "bun scripts/test.ts"
```

`scripts/test.ts` is a dispatcher. Subcommands: `bun run test` (full run), `bun run test watch`, `bun run test coverage`. E2E (playwright) will be a separate `bun run e2e` dispatcher once added.

---

## Priorities

Start here. Do not write coverage-farming tests before the critical path is solid.

| #   | Area                            | Why first                                           | Target                                   |
| --- | ------------------------------- | --------------------------------------------------- | ---------------------------------------- |
| 1   | `publishRelease()`              | Atomic transaction, FAA audit trail, highest risk   | `libs/bc/course/src/publish.test.ts`     |
| 2   | Zod schemas                     | All form actions depend on them; pure, fast to test | `libs/types/src/schemas.test.ts`         |
| 3   | Form helpers                    | Used in every form action; edge cases matter        | `libs/ui/src/form-helpers.test.ts`       |
| 4   | Auth guards                     | `requireAuth` / `requireRole` protect everything    | `libs/auth/src/guards.test.ts`           |
| 5   | Enrollment write (user scoping) | Security requirement; isolation enforced here       | `libs/bc/enrollment/src/write.test.ts`   |
| 6   | Course BC CRUD                  | Core content authoring surface                      | `libs/bc/course/src/manage.test.ts`      |
| 7   | Evidence recording              | FAA proof of training chain                         | `libs/bc/evidence/src/write.test.ts`     |
| 8   | E2E: hangar CRUD                | Smoke test the whole stack                          | `apps/hangar/tests/content-crud.spec.ts` |
| 9   | Engine (when implemented)       | Determinism and state firewall                      | `libs/engine/src/*.test.ts`              |

---

## Key Invariants to Always Test

These are FAA compliance or security requirements -- not optional:

- **Publish is atomic** -- all-or-nothing, no partial snapshots
- **Draft never reaches sim** -- `releaseId` filter enforced in every read
- **Per-learner isolation** -- enrollment write scopes to `locals.user.id`, never URL/form
- **Engine state firewall** -- `buildPublicWorldState()` never leaks hidden risks or internal fields
- **Module progress never regresses** -- `not_started -> in_progress -> completed` only
- **Scenario runs are immutable** -- no update/delete after creation
- **Open redirect rejected** -- `?redirectTo=//evil.com` must fail

---

## Adding Tests to a Feature

When implementing a new feature, follow this order:

1. Write unit tests for any new pure functions or schemas first
2. Write integration tests for BC functions as you implement them
3. Write the E2E spec once the feature is manually testable
4. Run `bun test` before committing -- all tests must pass
