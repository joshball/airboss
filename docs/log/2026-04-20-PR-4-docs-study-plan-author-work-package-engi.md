---
pr: 4
date: 2026-04-20
title: "docs(study-plan): author work package -- engine, plans, sessions"
wp_id: knowledge-graph
bugs_fixed: []
summary: |
  Authors the complete work package for study plans + session engine (spec, design, tasks, test-plan) Two aggregates: study_plan (mutable) + session / session_item_result (append-only event log) Engine is a pure function (runEngine) with injected pool-query callbacks -- no DB access inside the engine Rule-based weighted slices (MODE_WEIGHTS), largest-remainder slot allocation, deterministic slice tiebreaker (strengthen > continue > expand > diversify) One-active-plan invariant via Postgres partial UNIQUE index (DB-enforced, not app-enforced) Streak computed on demand in user tz (default...
---
