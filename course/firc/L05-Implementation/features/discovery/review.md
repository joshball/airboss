---
title: "Design Review: Discovery"
product: sim
feature: discovery
type: review
status: done
review_status: done
---

# Design Review: Discovery

**Reviewer:** Design Review Agent
**Date:** 2026-03-27
**Status:** Changes required

## Summary

The discovery feature is well-scoped and the single-submit architecture is the right call. The localStorage-only intermediate state, the `requireAuth`-first load function, and the jsonb columns with Zod contracts are all sound. However, there are several issues that would produce broken or type-unsafe code if implemented as written: a domain key case mismatch that breaks the competency type contract, a referenced utility function that does not exist, a naming collision with an existing exported type, and route constant references that point at non-existent keys. These must be resolved before implementation begins.

---

## Findings

### CRITICAL -- `SelfAssessment` domain keys conflict with `CompetencyDomain`

**Files:** `docs/products/sim/features/discovery/spec.md`, `docs/products/sim/features/discovery/design.md`, `libs/types/src/competency.ts`, `libs/constants/src/competency.ts`

The spec and design define `SelfAssessment` with lowercase keys (`cj`, `ac`, `rm`, `av`, `od`, `rc`, `es`, `ps`). The canonical `CompetencyDomain` type in `@firc/types` uses uppercase (`'CJ' | 'AC' | 'RM' | ...`). `COMPETENCY_DOMAIN_LABELS` is `Record<CompetencyDomain, string>` -- keyed uppercase.

If the page iterates `COMPETENCY_DOMAIN_ORDERS` to render sliders and reads scores from `selfAssessment['CJ']`, the lookup will always be `undefined` because the stored keys are `'cj'`. The type-checker will also not catch the mismatch because the Zod schema accepts any object shape it declares, independent of `CompetencyDomain`.

**Fix:** Change `SelfAssessment` to use `CompetencyDomain` as the key type. The Zod schema should be `z.record(competencyDomainSchema, z.number().int().min(0).max(5))` where `competencyDomainSchema` is derived from the canonical domain union. This keeps the types aligned across the entire system.

---

### HIGH -- `generateId('profile')` does not exist

**File:** `docs/products/sim/features/discovery/design.md` (action snippet)

The design calls `generateId('profile')` to create the profile ID. This function does not exist anywhere in the codebase. The actual pattern used in `libs/bc/course/src/publish.ts` and `libs/auth/src/server.ts` is `nanoid()` directly.

**Fix:** Either use `nanoid()` directly (as all other BCs do today) or, before implementing discovery, create a shared `generateId` utility in `libs/constants/` or `libs/types/` and document it. If the intent is a domain-prefixed ID (e.g. `prof_abc123`), that helper needs to be built first and added to the pre-flight tasks. Do not reference a utility that doesn't exist in task steps.

---

### HIGH -- `LearnerProfile` name collision with existing type

**Files:** `docs/products/sim/features/discovery/design.md`, `libs/types/src/learner.ts`, `libs/types/src/index.ts`

`libs/types/src/learner.ts` already exports a `LearnerProfile` interface with a completely different shape: `certificates`, `ratings`, `aircraftFlown`, `discoveryResponses`, `selfReportedConfidence`. This is already re-exported from `libs/types/src/index.ts`.

The design proposes adding `LearnerBackground` and `SelfAssessment` to a new `libs/types/src/schemas/discovery.ts`. It does not address what to do with the existing `LearnerProfile` in `learner.ts`, which has overlapping conceptual purpose but incompatible structure.

**Fix:** Before adding new types, resolve the conflict. Options:

1. Replace the existing `LearnerProfile` in `learner.ts` with the new DB-backed shape from the spec (and update all callsites).
2. Rename the existing type (e.g. `LearnerProfileLegacy` or move to engine-internal types) and use the new `LearnerProfile` for the DB-backed record.
3. Keep both with clearly distinct names and document the distinction.

Do not add a second `LearnerProfile`-shaped type that contradicts the existing one.

---

### MEDIUM -- `getLearnerProfile` belongs in a read module, not write

**File:** `docs/products/sim/features/discovery/design.md`

The spec says "New BC functions in `enrollment/write.ts`" for both `createLearnerProfile` and `getLearnerProfile`. However, `getLearnerProfile` is a read operation. The BC layering convention is that read operations belong in a `read.ts` module (or equivalent). `write.ts` is for mutations only -- the existing write module is consistent with this: `createLessonAttempt`, `updateModuleProgress`, `logTime`. `getOwnEnrollment` and `getOwnModuleProgress` are also in `write.ts` today, which is itself a pattern inconsistency, but adding another read function to `write.ts` compounds the drift.

**Fix:** Add `getLearnerProfile` to a `read.ts` module (creating one if it doesn't exist for enrollment). At minimum, open a task to address the existing `getOwn*` functions being misplaced.

---

### MEDIUM -- `ROUTES.SIM_COURSE` and `ROUTES.SIM_DISCOVERY` do not exist

**Files:** `docs/products/sim/features/discovery/design.md`, `libs/constants/src/routes.ts`

The design's load function redirects to `ROUTES.SIM_COURSE` and the action redirects to `ROUTES.SIM_COURSE`. The actual key in `libs/constants/src/routes.ts` is `ROUTES.COURSE` (no `SIM_` prefix). `ROUTES.SIM_DISCOVERY` does not exist at all.

**Fix:**

- Update the design to use `ROUTES.COURSE` for the post-completion redirect.
- Add `ROUTES.DISCOVERY` (or `ROUTES.SIM_DISCOVERY` if app-prefixed keys are desired, but the current file uses unprefixed names) to `libs/constants/src/routes.ts` before implementing the route guard in task step 4.
- The tasks.md already calls this out ("Add `ROUTES.SIM_DISCOVERY` to `libs/constants/src/routes.ts` if not already added") but uses the wrong name. Fix the task to match the existing naming convention.

---

### MEDIUM -- `createLearnerProfile` is insert-only but spec says upsert

**File:** `docs/products/sim/features/discovery/design.md`

The spec description says "inserts or upserts learner profile" but the design code uses `db.insert(...).values(data)` with no conflict handling. With a `UNIQUE` constraint on `user_id`, a second submission (e.g., if the user submits the form twice in rapid succession, or after a partial redo) will throw a database constraint error that the action does not catch.

**Fix:** Either use `.onConflictDoUpdate()` for a true upsert, or add a try/catch in the action to handle the unique constraint violation with a user-facing error. If the intent is always-insert (only called when no profile exists), remove "or upserts" from the spec to avoid confusion.

---

### MEDIUM -- No `deleteProfile` BC function for the redo flow

**Files:** `docs/products/sim/features/discovery/spec.md` (Edge Cases), `docs/products/sim/features/discovery/tasks.md`

The spec describes a "Redo profile intake" flow that "deletes existing profile, starts over." No delete function is designed in `design.md` or tasked in `tasks.md`. Task step 6 mentions adding the redo link to settings but does not mention implementing the delete operation.

**Fix:** Add `deleteOwnLearnerProfile(userId: string)` to the BC write module (or manage module -- confirm which access level settings runs under). Add it to `design.md` and the task list explicitly. The hard-delete is appropriate here per the best-practices rule (soft delete for core entities, hard delete for user preferences/junction data).

---

### MEDIUM -- localStorage restore may be overwritten before it is read

**File:** `docs/products/sim/features/discovery/design.md` (page component snippet)

The design uses a single `$effect` to persist state to localStorage on every change. In Svelte 5, effects run after the component mounts. The component does not show code for restoring saved state from localStorage before the effect fires. If the restore code runs in `onMount` (or an initializing effect), the sequence is safe. But if the initial `$state()` values are set to `{}` and the `$effect` fires before the restore runs, the saved data would be overwritten with empty objects.

**Fix:** In the page component, load localStorage state synchronously during `$state` initialization (using a function call):

```typescript
function loadSaved(): SavedDiscovery | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem("discovery_step") ?? "null");
  } catch {
    return null;
  }
}

const saved = loadSaved();
let step = $state(saved?.step ?? 1);
let background = $state(saved?.background ?? {});
```

This must be called at `$state()` initialization time, not in a lifecycle hook. The `$effect` then persists updates correctly. Document this initialization pattern in design.md.

---

### MEDIUM -- `goals` field accepts any `string[]` with no validation

**File:** `docs/products/sim/features/discovery/design.md` (action snippet)

The action parses goals with `JSON.parse(data.get('goals') as string ?? '[]') as string[]` -- a raw cast with no validation. The goals field is meant to hold domain IDs (values from `CompetencyDomain`). An attacker or malformed form submission could inject arbitrary strings into the jsonb column.

**Fix:** Add a Zod schema for goals validation: `z.array(competencyDomainSchema)` where `competencyDomainSchema` is the canonical domain enum. Run `.safeParse()` on goals in the action and return `fail(400, ...)` on invalid input.

---

### LOW -- `data.get('background') as string` cast is unsafe

**File:** `docs/products/sim/features/discovery/design.md` (action snippet)

`data.get('background')` returns `FormDataEntryValue | null`. Casting directly to `string` without a null check means `JSON.parse(null as string)` will throw at runtime if the field is missing from the form. The `safeParse` call will not catch a thrown exception.

**Fix:** Use a null-safe extraction before parsing:

```typescript
const rawBackground = data.get("background");
if (typeof rawBackground !== "string") {
  return fail(400, { error: "Missing background data" });
}
const background = learnerBackgroundSchema.safeParse(JSON.parse(rawBackground));
```

Apply the same pattern to `selfAssessment`.

---

### LOW -- `SelfAssessment` description says "1-5" but schema allows 0

**Files:** `docs/products/sim/features/discovery/spec.md`, `docs/products/sim/features/discovery/design.md`

The spec describes the scale as "1 (Weak), 2, 3 (Solid), 4, 5 (Expert) + 'Not sure / Skip' option." The Zod schema correctly allows `0` for "Not sure." The `SelfAssessment` interface comment says `// 1-5, 0 = not sure` only for `cj`. The other 7 fields have no comment.

**Fix:** Update the interface comment to consistently document that 0 means "not sure" for all fields. Consider defining a `SelfAssessmentScore` type alias (`0 | 1 | 2 | 3 | 4 | 5`) to make this explicit and reusable. This is minor but prevents future confusion about whether 0 is valid.

---

## Approved Items

- **Single-submit architecture.** Collecting all steps client-side and submitting in one form action is the correct pattern. It avoids partial DB state, simplifies the action, and matches how `best-practices.md` describes form actions.
- **jsonb columns for background and self-assessment.** Appropriate for evolving schema. The Zod contract at the application boundary is the right safeguard.
- **`requireAuth(locals)` first in load and action.** Correct guard order per best-practices.
- **`enrollmentSchema` namespace.** `learner_profile` in the `enrollment` PostgreSQL schema namespace is correct per ADR 004.
- **`userId` unique constraint.** One profile per user is correct -- profiles are not per-enrollment (they're learner-global).
- **`completed_at` null until final submit.** Clean separation between in-progress and completed state. Works correctly with the entry condition redirect logic.
- **Skip creates no DB record.** Engine uses defaults. No orphaned partial records. Simple and correct.
- **Domain labels via `COMPETENCY_DOMAIN_LABELS`.** Design explicitly calls this out. Correct.
- **`ROUTES` constant for redirect in load and action.** Correct approach (the specific key names just need fixing per the finding above).
- **`getLearnerProfile` uses `user.id` from `locals`, not from request.** The design shows `user.id` passed from `requireAuth(locals)`, consistent with the security requirement documented in `write.ts`.

---

## Decision

**Changes required before implementation.**

The CRITICAL and HIGH findings must be resolved first -- they will produce broken code or type-system violations if not fixed. The MEDIUM findings should also be resolved before implementation begins; several of them (missing delete function, upsert vs. insert, route constants) will be discovered as gaps mid-implementation and cause rework. Addressing them in the design now is lower cost.

Required changes before proceeding:

1. Align `SelfAssessment` keys to uppercase `CompetencyDomain` values.
2. Resolve the `LearnerProfile` naming collision with the existing type in `learner.ts`.
3. Replace `generateId('profile')` with `nanoid()` or define the utility first.
4. Fix route constant references (`ROUTES.COURSE` not `ROUTES.SIM_COURSE`; add `ROUTES.DISCOVERY`).
5. Add `deleteOwnLearnerProfile` to the design and task list.
6. Decide: insert-only or upsert -- update spec and code to match.
7. Add localStorage initialization pattern to the design.
8. Add goals Zod validation (domain enum, not raw string array).
