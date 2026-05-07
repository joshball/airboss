---
id: bug-worker-test-flake
title: hangar-jobs worker.test.ts flakes ~1 in 4 full-suite runs
product: hangar
severity: minor
status: open
discovered_pr: null
discovered_date: 2026-05-04
fix_pr: null
fix_wp: null
repro: |
  Run `bun test` on a full suite multiple times. The
  "serialises two same-targetId jobs" case in
  libs/hangar-jobs/src/worker.test.ts fails roughly 1 in 4 even with
  the 30s timeout bump.
tags: [hangar, jobs, flake, tests]
---

# hangar-jobs worker.test.ts flakes ~1 in 4 full-suite runs

The "serialises two same-targetId jobs" case in
`libs/hangar-jobs/src/worker.test.ts` flakes ~1 in 4 full-suite runs even
with the 30s timeout bump.

## Investigation notes

- Surfaced in the multi-agent cleanup aggregate (2026-05-04) at
  `docs/work/handoffs/20260504-multi-agent-cleanup-aggregate.md` section 4.
- Root cause is DB contention on the claim-loop. A mitigation has shipped
  but the real fix needs its own design pass (probably a retry harness
  around the claim race, or a fixture that holds the row exclusively
  during the race window).
- Promoting this to a WP is the obvious next step if it bites in CI.

## Cross-references

- The hangar-jobs worker is also exercised by the e2e suite in `tests/`,
  which has not exhibited the same flake.
