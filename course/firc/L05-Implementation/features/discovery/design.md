---
title: "Design: Discovery"
product: sim
feature: discovery
type: design
status: done
---

# Design: Discovery

## Route Files

```text
apps/sim/src/routes/(app)/
  discovery/
    +page.svelte          -- multi-step wizard UI (client-side step state)
    +page.server.ts       -- load (check if profile exists), action (submit all steps)
```

Lives inside `(app)/` route group -- auth guard inherited from `(app)/+layout.server.ts`.

## Schema Change

**New table in `enrollment` namespace:**

```typescript
// libs/bc/enrollment/src/schema.ts (add to existing file)
export const learnerProfile = enrollmentSchema.table("learner_profile", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  backgroundData: jsonb("background_data").notNull().$type<LearnerBackground>(),
  selfAssessment: jsonb("self_assessment").notNull().$type<SelfAssessment>(),
  goals: jsonb("goals").$type<string[]>(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});
```

Run `bun scripts/db.ts push` after adding the table.

## New BC Module: `enrollment/read.ts`

Create `libs/bc/enrollment/src/read.ts` -- learner-scoped reads. Also move the existing
`getOwnEnrollment` and `getOwnModuleProgress` out of `write.ts` into this file.

```typescript
// libs/bc/enrollment/src/read.ts
export async function getLearnerProfile(userId: string) {
  const [profile] = await db
    .select()
    .from(learnerProfile)
    .where(eq(learnerProfile.userId, userId));
  return profile ?? null;
}

export async function getOwnEnrollment(userId: string) { ... }      // moved from write.ts
export async function getOwnModuleProgress(enrollmentId: string) { ... }  // moved from write.ts
```

Export from `libs/bc/enrollment/src/index.ts` as `read`.

## Write BC Change

`write.ts` retains only mutations. `createLearnerProfile` uses upsert (conflict on `userId`):

```typescript
// libs/bc/enrollment/src/write.ts
export async function createLearnerProfile(data: typeof learnerProfile.$inferInsert) {
  return db
    .insert(learnerProfile)
    .values(data)
    .onConflictDoUpdate({
      target: learnerProfile.userId,
      set: {
        backgroundData: data.backgroundData,
        selfAssessment: data.selfAssessment,
        goals: data.goals,
        completedAt: data.completedAt,
      },
    })
    .returning();
}
```

Upsert handles: retry after failed redirect, future "edit your profile" feature, re-enrollment.

## New Types

**`libs/types/src/schemas/discovery.ts` (new file):**

```typescript
export const learnerBackgroundSchema = z.object({
  yearsCfi: z.enum(["0-1", "1-3", "3-10", "10+"]),
  aircraftTypes: z.array(z.enum(["sel", "mel", "helicopter", "taa", "turboprop"])).min(1),
  ifrCurrent: z.boolean(),
  taaExperience: z.enum(["none", "some", "extensive"]),
});

export const selfAssessmentSchema = z.object({
  CJ: z.number().int().min(0).max(5),
  AC: z.number().int().min(0).max(5),
  RM: z.number().int().min(0).max(5),
  AV: z.number().int().min(0).max(5),
  OD: z.number().int().min(0).max(5),
  RC: z.number().int().min(0).max(5),
  ES: z.number().int().min(0).max(5),
  PS: z.number().int().min(0).max(5),
});

export type LearnerBackground = z.infer<typeof learnerBackgroundSchema>;
export type SelfAssessment = z.infer<typeof selfAssessmentSchema>;

// DB-backed discovery intake record (not to be confused with StudentModel in libs/engine)
export interface LearnerDiscoveryProfile {
  id: string;
  userId: string;
  backgroundData: LearnerBackground;
  selfAssessment: SelfAssessment;
  goals: string[] | null;
  completedAt: Date | null;
}
```

Self-assessment keys use uppercase domain abbreviations (`CJ`, `AC`, etc.) matching
`COMPETENCY_DOMAIN_LABELS` from `@firc/constants`. Export from `libs/types/src/index.ts`.

## Page Component Design

**Multi-step with client-side state only.** No server round-trips between steps. Single submit on step 3.

```svelte
<!-- +page.svelte -->
<script lang="ts">
  import { browser } from '$app/environment';

  // Restore from localStorage synchronously before first render
  const stored = browser
    ? JSON.parse(localStorage.getItem('discovery_draft') ?? 'null')
    : null;

  let step = $state<1 | 2 | 3>(stored?.step ?? 1);
  let background = $state<Partial<LearnerBackground>>(stored?.background ?? {});
  let assessment = $state<Partial<SelfAssessment>>(stored?.assessment ?? {});
  let goals = $state<string[]>(stored?.goals ?? []);

  // Persist on every change
  $effect(() => {
    if (!browser) return;
    localStorage.setItem('discovery_draft', JSON.stringify({ step, background, assessment, goals }));
  });
</script>

{#if step === 1}
  <!-- Background form -- no server submit, just advance step -->
{:else if step === 2}
  <!-- Self-assessment sliders -- domain labels from COMPETENCY_DOMAIN_LABELS -->
{:else if step === 3}
  <!-- Goals + final submit form (POST /discovery) -->
{/if}
```

**Form submission:** Only step 3 submits to the server (hidden fields carry steps 1 + 2 data as JSON).
On successful submit: clear `discovery_draft` from localStorage before redirect.

## Load Function

```typescript
// +page.server.ts
export const load = async (event) => {
  const user = requireAuth(event);
  const profile = await enrollmentRead.getLearnerProfile(user.id);
  if (profile?.completedAt) {
    redirect(303, ROUTES.SIM_COURSE);
  }
  return { hasProfile: !!profile };
};
```

## Action

```typescript
export const actions = {
  default: async (event) => {
    const user = requireAuth(event);
    const data = await event.request.formData();

    const background = learnerBackgroundSchema.safeParse(JSON.parse(data.get("background") as string));
    const selfAssessment = selfAssessmentSchema.safeParse(JSON.parse(data.get("selfAssessment") as string));
    const rawGoals = data.get("goals") as string | null;
    const goals = goalsSchema.safeParse(JSON.parse(rawGoals ?? "[]"));

    if (!background.success || !selfAssessment.success || !goals.success) {
      return fail(400, { error: "Invalid submission" });
    }

    await enrollmentWrite.createLearnerProfile({
      id: generateProfileId(), // from libs/utils/src/ids.ts -- Tier B ULID
      userId: user.id,
      backgroundData: background.data,
      selfAssessment: selfAssessment.data,
      goals: goals.data,
      completedAt: new Date(),
    });

    redirect(303, ROUTES.SIM_COURSE);
  },
};
```

`goalsSchema` validates `goals` as `z.array(z.string().max(200)).max(10)`.

## Key Decisions

**Why single submit on step 3:** Avoids partial state in DB (incomplete profile complicates engine
initialization). localStorage handles browser-close resilience for in-progress drafts.

**Why upsert not insert:** Resilient to retry after failed redirect. Also enables future
"edit your profile" without a separate code path.

**Why enrollment/read.ts not write.ts:** Reads belong in a read module. This also fixes the existing
pattern drift where `getOwnEnrollment` and `getOwnModuleProgress` were placed in write.ts.

**Why jsonb for background/assessment:** Avoids migration burden as the discovery schema evolves.
The Zod schema provides the type contract.

**Domain labels:** Use `COMPETENCY_DOMAIN_LABELS` from `@firc/constants` to render domain names.
