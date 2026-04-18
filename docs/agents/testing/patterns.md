# Test Patterns

Concrete patterns for writing tests in firc-boss. Read [../TESTING.md](../TESTING.md) first.

---

## Unit Tests (Pure Functions)

No DB, no SvelteKit -- just call the function and assert.

**Target:** Zod schemas, form helpers, engine functions, utility functions.

```ts
// libs/types/src/schemas.test.ts
import { describe, expect, it } from "vitest";
import { createScenarioSchema } from "./schemas";

describe("createScenarioSchema", () => {
  const valid = {
    title: "Weather Diversion",
    briefing: "You are approaching KORD...",
    difficulty: 0.7,
    duration: 45,
    studentModelId: "sm-001",
    competencies: ["ADM", "SA"],
    faaTopics: ["A.1", "A.3"],
  };

  it("accepts valid input", () => {
    expect(createScenarioSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = createScenarioSchema.safeParse({ ...valid, title: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Title is required");
  });

  it("rejects difficulty > 1", () => {
    const result = createScenarioSchema.safeParse({ ...valid, difficulty: 1.5 });
    expect(result.success).toBe(false);
  });

  it("requires at least one competency", () => {
    const result = createScenarioSchema.safeParse({ ...valid, competencies: [] });
    expect(result.success).toBe(false);
  });
});
```

---

## Integration Tests (BC Functions)

BC functions hit the real database. Use a transaction wrapper so each test rolls back.

### `withTestTx` helper

Create this once in `tests/helpers.ts`:

```ts
// tests/helpers.ts
import { db } from "@firc/db";
import { sql } from "drizzle-orm";

export async function withTestTx<T>(fn: () => Promise<T>): Promise<T> {
  await db.execute(sql`BEGIN`);
  try {
    const result = await fn();
    await db.execute(sql`ROLLBACK`);
    return result;
  } catch (e) {
    await db.execute(sql`ROLLBACK`);
    throw e;
  }
}
```

### BC CRUD test pattern

```ts
// libs/bc/course/src/manage.test.ts
import { describe, expect, it } from "vitest";
import { nanoid } from "nanoid";
import * as manage from "./manage";
import { withTestTx } from "../../../../tests/helpers";

describe("course manage", () => {
  describe("createScenario", () => {
    it("inserts a scenario and returns it", async () => {
      await withTestTx(async () => {
        const id = nanoid();
        const [row] = await manage.createScenario({
          id,
          title: "Test Scenario",
          briefing: "Test briefing",
          difficulty: "0.5",
          duration: 30,
          studentModelId: "sm-test",
          competencies: ["ADM"],
          faaTopics: ["A.1"],
          status: "draft",
        });
        expect(row.id).toBe(id);
        expect(row.title).toBe("Test Scenario");
        expect(row.status).toBe("draft");
      });
    });
  });

  describe("updateScenario", () => {
    it("updates fields and sets updatedAt", async () => {
      await withTestTx(async () => {
        const id = nanoid();
        await manage.createScenario({
          id,
          title: "Original",
          briefing: "b",
          difficulty: "0.5",
          duration: 30,
          studentModelId: "sm-test",
          competencies: ["ADM"],
          faaTopics: ["A.1"],
          status: "draft",
        });
        const [updated] = await manage.updateScenario(id, { title: "Updated" });
        expect(updated.title).toBe("Updated");
        expect(updated.updatedAt).toBeDefined();
      });
    });
  });
});
```

### `publishRelease` atomicity test

```ts
// libs/bc/course/src/publish.test.ts
import { describe, expect, it, vi } from "vitest";
import * as publish from "./publish";
import { withTestTx } from "../../../../tests/helpers";
import { db } from "@firc/db";
import { published } from "@firc/db/schema";

describe("publishRelease", () => {
  it("inserts release and all published tables in one transaction", async () => {
    await withTestTx(async () => {
      const result = await publish.publishRelease("1.0.0", "Initial release");
      expect(result.releaseId).toBeDefined();
      expect(result.counts.scenarios).toBeGreaterThanOrEqual(0);
    });
  });

  it("rolls back if any insert fails", async () => {
    // Force failure mid-transaction by passing invalid data
    await withTestTx(async () => {
      const before = await db.select().from(published.release);
      try {
        await publish.publishRelease("", ""); // invalid version
      } catch {
        // expected
      }
      const after = await db.select().from(published.release);
      expect(after.length).toBe(before.length); // no partial insert
    });
  });
});
```

---

## Auth Guard Tests

Guards are thin wrappers around `locals.user` -- test by constructing mock `RequestEvent`.

```ts
// libs/auth/src/guards.test.ts
import { describe, expect, it } from "vitest";
import { requireAuth, requireRole } from "./guards";
import { ROLES, ROUTES } from "@firc/constants";

function makeEvent(user: unknown = null): any {
  return {
    locals: { user },
    url: new URL("http://localhost/hangar/scenarios"),
  };
}

describe("requireAuth", () => {
  it("returns user when authenticated", () => {
    const user = { id: "u1", role: ROLES.AUTHOR, email: "a@b.com" };
    expect(requireAuth(makeEvent(user))).toEqual(user);
  });

  it("throws redirect when not authenticated", () => {
    expect(() => requireAuth(makeEvent(null))).toThrow();
  });
});

describe("requireRole", () => {
  it("returns user when role matches", () => {
    const user = { id: "u1", role: ROLES.AUTHOR, email: "a@b.com" };
    expect(requireRole(makeEvent(user), ROLES.AUTHOR)).toEqual(user);
  });

  it("throws redirect when role does not match", () => {
    const user = { id: "u1", role: ROLES.LEARNER, email: "a@b.com" };
    expect(() => requireRole(makeEvent(user), ROLES.AUTHOR)).toThrow();
  });

  it("accepts any of the allowed roles", () => {
    const user = { id: "u1", role: ROLES.ADMIN, email: "a@b.com" };
    expect(requireRole(makeEvent(user), ROLES.AUTHOR, ROLES.ADMIN)).toEqual(user);
  });
});
```

---

## E2E Tests (Playwright)

E2E tests exercise full user flows through the browser. Use form actions, not direct API calls.

### Auth fixture

Create a shared auth fixture so tests don't re-login:

```ts
// apps/hangar/tests/fixtures.ts
import { test as base } from "@playwright/test";

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.goto("/login");
    await page.fill("[name=email]", process.env.TEST_AUTHOR_EMAIL!);
    await page.fill("[name=password]", process.env.TEST_AUTHOR_PASSWORD!);
    await page.click("[type=submit]");
    await page.waitForURL("/");
    await use(page);
  },
});
```

### User flow pattern

```ts
// apps/hangar/tests/content-crud.spec.ts
import { expect } from "@playwright/test";
import { test } from "./fixtures";

test.describe("Scenario CRUD", () => {
  test("create a scenario", async ({ page }) => {
    await page.goto("/scenarios/new");
    await page.fill("[name=title]", "E2E Test Scenario");
    await page.fill("[name=briefing]", "Test briefing text");
    // ... fill remaining fields
    await page.click("[type=submit]");
    await expect(page).toHaveURL("/scenarios");
    await expect(page.locator("text=E2E Test Scenario")).toBeVisible();
  });

  test("shows validation errors on empty submit", async ({ page }) => {
    await page.goto("/scenarios/new");
    await page.click("[type=submit]");
    await expect(page.locator("[data-error]")).toBeVisible();
  });

  test("edit and update a scenario", async ({ page }) => {
    // create first, then edit
    // ...
  });
});
```

### Role guard E2E test

```ts
// apps/hangar/tests/auth.spec.ts
import { test, expect } from "@playwright/test";

test("LEARNER cannot access /scenarios/new", async ({ page }) => {
  // login as learner
  await page.goto("/login");
  await page.fill("[name=email]", process.env.TEST_LEARNER_EMAIL!);
  await page.fill("[name=password]", process.env.TEST_LEARNER_PASSWORD!);
  await page.click("[type=submit]");

  await page.goto("/scenarios/new");
  await expect(page).not.toHaveURL("/scenarios/new");
});
```

---

## Engine Tests (when engine is implemented)

Engine functions are pure -- no DB, no side effects.

```ts
// libs/engine/src/tick.test.ts
import { describe, expect, it } from "vitest";
import { validateCommands, buildPublicWorldState } from "./tick";

describe("buildPublicWorldState", () => {
  it("never exposes hidden risks", () => {
    const internal = {
      hiddenRisks: [{ id: "r1", description: "ice", probability: 0.8, tickToManifest: 5 }],
      cuesVisible: [],
      // ...other fields
    };
    const pub = buildPublicWorldState(internal as any);
    expect((pub as any).hiddenRisks).toBeUndefined();
  });
});

describe("determinism", () => {
  it("same seed + input produces same output", () => {
    const world1 = buildWorld({ seed: 42 });
    const world2 = buildWorld({ seed: 42 });
    expect(world1).toEqual(world2);
  });
});
```

---

## Checklist Before Committing Tests

- [ ] No `any` or non-null assertions (`!`)
- [ ] No DB mocks -- integration tests use real DB + `withTestTx`
- [ ] Test file passes `bun run check` (Biome + TypeScript)
- [ ] Each test is independent -- no shared mutable state between tests
- [ ] Test names describe behavior, not implementation: `'rejects empty title'` not `'safeParse returns false'`
