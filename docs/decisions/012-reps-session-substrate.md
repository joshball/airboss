# ADR 012: /reps/session substrate — stay ephemeral or migrate to the session/session_item_result tables?

Status: **proposal — awaits decision**.

Date: 2026-04-22.

Supersedes: none. Informs: future plan/session/rep engine work.

## Context

The study app has two session runners today:

- `/reps/session` — the legacy rep-only flow. No plan required. No `session` row. No `session_item_result` row. Progress survives refresh by URL-pinning the batch (`?s=seed&ids=csv&startedAt=iso`) and deriving "current slot = first unanswered scenario" from the `repAttempt` table. Fixed in PR #24.
- `/sessions/[id]` — the unified plan-driven session runner. Requires an active plan. Writes `session` + one `session_item_result` per slot. Runner handles cards, reps, and knowledge-node starts uniformly. Built in PR #19.

After PR #24, `/reps/session` resumes across refresh using `repAttempt` + URL-pinned batch. It behaves like a session but does not participate in the `session` substrate.

Entry points for `/reps/session` today:

- Dashboard CtaPanel fallback ("Reps" secondary CTA when plan + scheduled reps).
- Dashboard ScheduledRepsPanel primary CTA ("Start session" when scenarios exist).
- Reps index page primary CTA.
- Calibration page empty-state CTA ("Start a rep session").

None of those entry points assume the user has a plan. That's the core reason PR #24 stayed on `/reps/session` rather than redirecting to `/session/start?mode=reps`: the unified runner gates on an active plan, and adding plan-setup UX to every rep entry point was disproportionate to the bug being fixed.

## The question

Should `/reps/session` eventually move onto the `session`/`session_item_result` substrate so the app has one session audit trail, OR should we keep two runners (lightweight ephemeral reps + durable plan-driven sessions) as a deliberate design?

## Options

### Option A — Keep two runners. Accept the divergence as intentional.

**Shape**: `/reps/session` stays as-is. `repAttempt` remains the sole audit trail for rep-only sessions. `/sessions/[id]` owns plan-driven, multi-type sessions.

**Pros**:
- No migration cost. Current working code keeps working.
- No plan gating on the rep-only entry points.
- Ephemeral runner is philosophically aligned with "quick reps between more intentional study." A user who has 5 minutes can fire a rep session without a plan; the friction of "create a plan first" would push them to not practice.

**Cons**:
- Two runners to maintain. Features (keyboard shortcuts, confidence sampling, skip semantics, progress bars) have to be kept in sync or deliberately diverge.
- Audit trail is split. "What did the user attempt?" requires reading `repAttempt` for rep-only sessions AND `session_item_result` for plan-driven sessions. Reporting, analytics, and the calibration/BC aggregators carry that branching logic.
- "Rep session" and "session with mode=reps" are almost-but-not-quite the same thing. Future readers will ask which to use and why.

### Option B — Unify under `/sessions/[id]`. `/reps/session` becomes a redirect shim. Rep-only entry points gracefully gate on plan.

**Shape**:
- Add a rep-only session mode to the engine. A session with `mode=reps` allocates only rep scenarios.
- `/reps/session` and `ROUTES.REPS_SESSION` redirect to `/session/start?mode=reps` (or equivalent entry).
- If the user has no active plan when hitting a rep entry point, the flow routes through a lightweight "create a plan" step or auto-creates a minimal default plan ("Reps only; all domains; current cert goals empty").
- `session_item_result` becomes the single audit trail for every rep attempt.
- Existing `repAttempt` table either (a) stays as the per-attempt detail under a `session_item_result`, or (b) gets migrated into `session_item_result` entirely.

**Pros**:
- One session concept. One runner. One audit trail.
- Features land once. Skip-permanent, confidence sampling, keyboard shortcuts are all centralized.
- Calibration / weak-areas / activity-panel aggregators read from one source.
- Reps become first-class citizens of the plan system rather than a side-flow.

**Cons**:
- Non-trivial migration. `session_item_result` schema was designed for the plan-driven engine; adding `mode=reps` means the engine's slice allocator needs a rep-only path.
- Plan-gating UX for reps entry points needs design: "you need a plan to do reps" is worse UX than today's "just click and go." A default/auto plan can hide the gate, but then you have two concepts of "plan" (deliberate plan vs rep-bucket plan) which might be worse than two runners.
- `repAttempt` migration: the existing aggregators (dashboard, calibration, BC heuristics) read from this table today. Touching it means coordinated changes across the BC.
- Won't land in one sprint. Multi-phase work.

### Option C — Keep two runners but reduce divergence via shared helpers.

**Shape**: Stay at Option A's topology. Extract shared helpers for the common machinery (option shuffling, confidence sampling, keyboard shortcut maps, mid-session scenario archival handling) into `libs/bc/study/session-helpers.ts`. Two entry points, one shared shape.

**Pros**:
- Cheap. No substrate change.
- Reduces the "must keep in sync" surface without unifying the audit trail.
- Keeps Option B on the table for later — the shared helpers make a future unification easier.

**Cons**:
- Doesn't solve the split-audit-trail problem.
- Doesn't answer the "which runner is canonical?" question for future readers.

## Tension worth naming

The design-system principle on display in PR #22 is "the theme can drastically change layout, not just tokens" — one primitive, many shapes. Applying that logic to sessions would favor **Option B**: one runner, many modes.

The product principle on display in the rep entry points is "low-friction access" — a rep session should be one click from the dashboard with no setup. Applying that logic favors **Option A**: don't make reps pay the plan tax.

These are in genuine tension. The right answer depends on who the rep flow is for over the next 12 months:

- If reps are a quick-tap utility that a returning pilot reaches for between more deliberate study (current user zero profile), Option A is right.
- If reps become a structured practice substrate that surfaces reporting, weak-area follow-ups, and eventually ties into scenarios and knowledge nodes the way plan-sessions do (the trajectory if airboss becomes a serious training platform), Option B is right.

## Recommendation

**Defer Option B. Adopt Option C as the near-term bridge.** Rationale:

1. The user zero profile (returning CFI, quick-practice loops) is the only validated use case today. The hypothetical "reps become structured" future hasn't been committed to in any roadmap doc.
2. Option B is a multi-week rewrite that adds plan-gating UX friction to entry points that work well. Cost too high for unproven benefit.
3. Option C captures the main maintenance cost (feature drift between two runners) cheaply. If the reps flow grows into something more deliberate, Option C's shared helpers make Option B straightforward to execute later.
4. If a concrete need for unified audit trail emerges (e.g. the dashboard's Recent Activity panel becomes hard to aggregate, or calibration needs cross-runner confidence data), revisit.

Explicitly declining: adopting Option B now "because it's cleaner." Cleaner-in-the-abstract doesn't justify rewriting working UX that the user reaches for dozens of times a week.

## Questions for the user before this ADR moves to Accepted

1. Is the returning-CFI quick-practice profile the canonical rep use case, or are reps intended to become structured/plan-bound over the next 12 months?
2. Are there calibration / reporting needs that currently require reading `repAttempt` + `session_item_result` together? If yes, that's evidence for Option B; if no, Option C holds.
3. Is there an appetite for schema migration if Option B becomes right later, or is `session`/`session_item_result` already considered stable?
4. Does the product vision treat reps as a distinct surface (my read from `docs/platform/MULTI_PRODUCT_ARCHITECTURE.md`'s surface taxonomy) or as a mode of the study surface?

Once those four are answered, this ADR can be promoted to Accepted with a concrete plan. Until then, Option C is the low-risk path.

## Follow-up work (only if Option C adopted)

- Extract option-shuffle helper (both runners seed-shuffle on `sessionId:scenarioId`).
- Extract confidence-sampling helper (both use `deterministicUnit(scenarioId, date)` to decide prompt-or-not).
- Extract keyboard shortcut map (Space/Enter advance, 1–N pick, Escape skip).
- Extract mid-session archival handler (`{ kind: 'skipped' }` slot / `skipped: true` response).

None of these are critical today. Batch them when a related change is already open.
