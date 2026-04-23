---
title: 'Test Plan: Study Page Migration'
feature: study-page-migration
type: test-plan
---

# Test Plan

## Per sub-PR

- Manual flow test: for the sub-PR's folder, exercise the happy path end-to-end.
  - 7.1 memory: create, browse, review one card, edit, delete.
  - 7.2 plans: create plan, edit, start session.
  - 7.3 reps: create rep, browse, run through attempts.
  - 7.4 calibration: view; verify charts + tables render.
  - 7.5 knowledge: navigate to a knowledge node, run through learn flow.
  - 7.6 sessions: start session, complete, view summary.
  - 7.7 dashboard: every panel renders with correct data.
- Visual regression (pixel diff): significant diffs expected where primitives replaced bespoke styling. Review each diff for user-visible regressions.
- A11y scan: axe on the folder's routes — no violations.
- Keyboard nav: each interactive control reachable via Tab; ESC closes dialogs.

## End of migration

- Lint ignore file is empty and removed.
- `bun run lint:theme` reports 0 violations across study.
- Theme swap: change body class to `data-theme="study/flightdeck"` and confirm every route restyles (dense mono) without broken pages.
- UX review: `/ball-review-ux` from the overhaul's README should report "no major findings from the pre-migration review remain."
