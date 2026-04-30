---
title: 'User Stories: Engine Goal Cutover'
product: study
feature: engine-goal-cutover
type: user-stories
status: unread
review_status: pending
---

# User Stories: Engine Goal Cutover

## What I want my goal to actually do

- As a learner, when I set a primary goal of "PPL refresh + IR add-on", I want my next session's items to come from those certs so my goal isn't bookkeeping.
- As a learner, when I switch my primary goal from "PPL push" to "BFR currency," I want the next session to reflect the new target without me also editing my study plan.
- As a learner, when I add a syllabus to my goal, I want the engine to start picking from it on my next preview, not after I edit something else.
- As a learner, when I remove a syllabus from my goal, I want the engine to stop pulling from it on my next preview.

## What I want to keep working when I haven't moved to goals yet

- As a legacy learner with only a `study_plan` and no goals, I want my sessions to continue picking the same items as before so the cutover isn't a regression.
- As a legacy learner, I want my plan's `cert_goals` to keep working until I've had a chance to set a primary goal.
- As a legacy learner, I want my existing focus_domains and skip_domains to be preserved so I don't lose my ergonomic preferences.

## What I expect when I edit my plan vs my goal

- As a learner with a primary goal AND a study_plan whose cert_goals disagree, I want the goal to win because that's the surface I edit consciously.
- As a learner, I want the plan-edit page to either stop surfacing cert chooser entirely (if redirect chosen) or to write through to my goal silently (if write-through chosen) -- I don't want two surfaces that look like they do the same thing.
- As a learner editing my plan, I want session length, depth preference, and mode to keep living on the plan because those are session-shape settings, not learner-intent.

## What I expect when I haven't set a goal yet

- As a brand-new learner with no plan and no goal, I want my first session to work without crashing.
- As a brand-new learner, I want guidance pointing me to set up a goal so the engine knows what to target.
- As a brand-new learner, the empty-targeting fallback should pull from any cert (consistent with today's behavior for `cert_goals=[]`) and not lock me out.

## What I expect when I have multiple active goals

- As a learner with two active goals, I want exactly one marked primary so the engine has an unambiguous target.
- As a learner, the secondary actives should not influence engine targeting until I make one of them primary.
- As a learner, switching primary goals is a one-click action; I shouldn't have to archive one to promote another.

## What I expect from the migration

- As an existing learner with a populated `study_plan`, I want my targeting to carry forward to a primary goal automatically so I don't have to re-curate.
- As an existing learner, I want my `focus_domains` and `skip_domains` to be on my new primary goal post-cutover so my preferences aren't lost.
- As an existing learner, I want a clean record of which path the engine took (goal vs plan) on each session so I (or Joshua) can verify the cutover took.

## What I expect for observability

- As Joshua-as-operator, I want a structured log line per `previewSession` recording which path was read so I can verify the trigger condition without instrumentation work.
- As Joshua-as-operator, I want a drift-checker script that surfaces any users whose plan and goal disagree on certs so I can investigate before the column drops.
- As Joshua-as-operator, I want a backfill-checker script that confirms every active plan has a paired primary goal so no user falls into the legacy fallback path on day one.

## What I expect from the column drop

- As Joshua-as-operator, I want the trigger to be evidence-driven (zero legacy reads in N consecutive days) rather than calendar-driven so a stale user reactivating doesn't cause a strange session post-drop.
- As Joshua-as-operator, I want the drop migration to ship with this WP so the only post-trigger work is applying it.
- As Joshua-as-operator, I want the rollback to be a single `git revert` so a misbehaving cutover doesn't require a database restore.

## What we are not building (so users don't ask)

- As a learner, I do **not** expect multi-goal weighted targeting in this WP. Only the primary goal influences the engine; secondary actives are visible but inert.
- As a learner, I do **not** expect a UI surface for the new goal targeting columns (focus_domains / skip_domains / skip_nodes). The data layer ships here; the goal composer's UI pickup is a follow-on.
- As a learner, I do **not** expect per-leaf evidence-kind gating in this WP. That's [`evidence-kind-gating`](../evidence-kind-gating/spec.md), shipping in parallel.
- As a learner, I do **not** expect `study_plan` to disappear. Only `cert_goals` is retired; session length, mode, depth_preference, and the local skip lists stay.
- As a learner, I do **not** expect the engine to merge goal and plan targeting. Goal wins; merge would be a third semantic with no value.

## For Joshua-as-user-zero

- As Joshua, I want my returning-CFI rebuild goal to drive every session immediately after this WP merges so my study queue reflects the goal composer I already use.
- As Joshua, I want the dual-read window to be visible in logs so I can verify the cutover is taking before authorizing the column drop.
- As Joshua, I want the drift script to be easy to run locally (`bun run db check plan-goal-drift`) so I can spot-check before merge without spinning up tooling.
- As Joshua, I want a single-PR revert path so I'm not afraid to ship the cutover.
- As Joshua, I want the column-drop migration sitting unapplied in the repo so when the trigger fires, the work is already done.
