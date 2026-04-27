---
title: "Spec: Discovery"
product: sim
feature: discovery
type: spec
status: done
---

# Spec: Discovery

Multi-step onboarding flow. Collects CFI background and self-assessment of confidence per competency domain. Seeds the engine's initial learner parameters.

## What It Does

Before a learner enters the course, they complete a short intake:

1. **Background** -- years as CFI, aircraft experience, instrument currency, TAA familiarity
2. **Self-assessment** -- confidence rating (1-5) per competency domain
3. **Goals** (optional) -- which areas they most want to work on

The result is a `learner_profile` record that the adaptive engine uses to weight scenario selection and starting difficulty. A learner can skip discovery -- the engine uses default parameters.

## Data Model

**New table: `enrollment.learner_profile`**

| Column            | Type          | Notes                                   |
| ----------------- | ------------- | --------------------------------------- |
| `id`              | text (nanoid) | PK                                      |
| `user_id`         | text          | FK to identity.bauth_user.id, unique    |
| `background_data` | jsonb         | `LearnerBackground` type                |
| `self_assessment` | jsonb         | `SelfAssessment` type (domain -> score) |
| `goals`           | jsonb         | `string[]` -- selected domain IDs       |
| `completed_at`    | timestamp     | null until step 3 submitted             |

**New types in `@firc/types`:**

```typescript
interface LearnerBackground {
  yearsCfi: "0-1" | "1-3" | "3-10" | "10+";
  aircraftTypes: Array<"sel" | "mel" | "helicopter" | "taa" | "turboprop">;
  ifrCurrent: boolean;
  taaExperience: "none" | "some" | "extensive";
}

interface SelfAssessment {
  cj: number; // Instructional Judgment (1-5, 0 = not sure)
  ac: number; // Aircraft Control and Safety Intervention
  rm: number; // Risk Management and ADM
  av: number; // Automation and Modern Avionics
  od: number; // Airspace, Deviations, and Operational Discipline
  rc: number; // Regulatory and Administrative Compliance
  es: number; // Evaluation and Standards
  ps: number; // Professionalism and Safety Culture
}
```

**New BC functions in `enrollment/write.ts`:**

- `createLearnerProfile(data)` -- inserts or upserts learner profile
- `getLearnerProfile(userId)` -- reads own profile

## Behavior

### Entry conditions

- If `learner_profile` exists and `completed_at` is set: redirect to `/course` on `/discovery` visit
- If profile exists but incomplete: resume at last step (step stored in localStorage)
- If no profile: start step 1

### Steps

**Step 1 -- Background**

- Years as CFI: radio group (0-1, 1-3, 3-10, 10+)
- Aircraft types: checkboxes (SEL, MEL, Helicopter, TAA/Glass, Turboprop/Jet)
- IFR current: toggle (yes/no)
- TAA experience level: radio group (none/some/extensive)

**Step 2 -- Self-assessment**

- 8 domain confidence sliders, one per competency domain
- Scale: 1 (Weak), 2, 3 (Solid), 4, 5 (Expert) + "Not sure / Skip" option
- Domain names and short descriptions shown (no jargon)

**Step 3 -- Goals (optional)**

- Prompt: "What do you most want to work on?"
- Checkboxes: the 8 domain names (select any)
- Optional free-text: "Anything specific? (optional)"
- Can click "Skip" to proceed without selecting goals

**Final submit:**

- Saves all three steps in one form action
- Sets `completed_at`
- Redirects to `/course`

### Skip

- "Skip for now" link visible on step 1
- Skipping creates no profile record (engine uses defaults)
- Learner can return to `/discovery` later to complete it
- `/settings` shows "Complete your profile" prompt if skipped

## Validation

| Field           | Rule                                            |
| --------------- | ----------------------------------------------- |
| yearsCfi        | Required (one of the four options)              |
| aircraftTypes   | At least one required                           |
| ifrCurrent      | Required (yes/no)                               |
| taaExperience   | Required                                        |
| Self-assessment | All 8 domains must have a value (or "Not sure") |
| Goals           | Optional, no minimum                            |

## Edge Cases

- Partial completion (closed browser mid-step): step state in localStorage, data only saved on final submit
- Redo after completion: `/settings` link "Redo profile intake" -- deletes existing profile, starts over
- Multi-device: if profile saved on one device, other device picks it up (server-side)
- Unknown user (no auth): redirect to `/login` before showing discovery
