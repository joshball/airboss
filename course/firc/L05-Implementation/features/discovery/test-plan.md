---
title: "Test Plan: Discovery"
product: sim
feature: discovery
type: test-plan
status: done
---

# Test Plan: Discovery

## Setup

Dev user (`joshua@ball.dev`) must have no existing `learner_profile` record. Delete if needed:

```sql
DELETE FROM enrollment.learner_profile WHERE user_id = '<dev-user-id>';
```

---

## DISC-1: First login redirect to discovery

1. Log in as dev user (no profile)
2. **Expected:** Redirect to `/discovery` after login (or prompt on `/course`)

## DISC-2: Step 1 -- Background form

1. On `/discovery`, verify Step 1 is shown
2. Complete all fields: select a year range, check at least one aircraft type, toggle IFR, select TAA experience
3. Click "Next"
4. **Expected:** Step 2 shown, step indicator advances

## DISC-3: Step 1 -- validation

1. On Step 1, clear all aircraft type checkboxes
2. Click "Next"
3. **Expected:** Error shown ("Select at least one aircraft type"), stay on Step 1

## DISC-4: Step 2 -- Self-assessment

1. On Step 2, rate all 8 domains
2. Set at least one to "Not sure" (0)
3. Click "Next"
4. **Expected:** Step 3 shown

## DISC-5: Step 3 -- Goals optional

1. On Step 3, click "Continue" without selecting any goals
2. **Expected:** Form submits successfully, redirect to `/course`
3. Verify profile saved: `SELECT * FROM enrollment.learner_profile WHERE user_id = '...'`
4. **Expected:** `completed_at` is set, `goals` is `null` or `[]`

## DISC-6: Step 3 -- Goals selected

1. Delete profile, restart discovery
2. On Step 3, select 2-3 domains and enter optional text
3. Submit
4. **Expected:** Redirect to `/course`, goals saved in profile

## DISC-7: Skip discovery

1. Delete profile, restart discovery
2. On Step 1, click "Skip for now"
3. **Expected:** Redirect to `/course`, no `learner_profile` record created

## DISC-8: Revisit after completion

1. Complete discovery (profile with `completed_at`)
2. Navigate to `localhost:7600/discovery`
3. **Expected:** Redirect to `/course` (not shown intake again)

## DISC-9: Redo profile from settings

1. Complete discovery
2. Go to `/settings`, click "Redo profile intake"
3. **Expected:** Profile deleted, redirect to `/discovery`, step 1 shown

## DISC-10: Browser close mid-step (localStorage restore)

1. Start discovery, complete step 1, click "Next" to step 2
2. Close the tab
3. Reopen and navigate to `/discovery`
4. **Expected:** Resumes at Step 2 with Step 1 data intact (or starts over -- acceptable for Phase 2 if localStorage restore is not implemented)
