---
title: "Drift Fixes 2026-03-30"
type: "cross-app-bugfix"
status: "done"
date: "2026-03-30"
source: "docs/work/reviews/20260330-drift-report.md"
apps: ["sim", "ops"]
libs: ["utils"]
---

# Drift Fixes 2026-03-30

Cross-app bug fix batch from the first full drift scan. 7 code fixes across sim, ops, and libs/utils. All were cases where spec was correct but code had drifted.

Source: [drift report](../../work/reviews/20260330-drift-report.md) | [fix plan](../../work/plans/20260330-drift-fixes.md)

## Fixes

| #   | Severity | App  | Fix                                                                                                                                    | Files changed                                                                       |
| --- | -------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | Major    | sim  | Evidence packets now populate `topicsCovered` and `competenciesExercised` from published scenario data instead of writing empty arrays | `scenario/[id]/+page.server.ts`                                                     |
| 2   | Major    | sim  | Debrief page shows disabled Replay button with "coming soon" label                                                                     | `debrief/[runId]/+page.svelte`                                                      |
| 3   | Major    | ops  | FAA record exports moved from form actions (which can't return raw `Response`) to `+server.ts` GET endpoints                           | `records/+server.ts` (new), `records/+page.server.ts`, `records/+page.svelte`       |
| 4   | Major    | ops  | Certificate revocation requires a reason -- textarea in confirm dialog, server validates non-empty, reason logged to audit trail       | `certificates/[id]/+page.server.ts`, `certificates/[id]/+page.svelte`               |
| 5   | Minor    | libs | Certificate ID prefix changed from `crt_` to `cert_` for consistency with naming conventions                                           | `libs/utils/src/ids.ts`                                                             |
| 6   | Minor    | ops  | Learner record evidence packet export accepts date range from form inputs (was hardcoded 24-month window)                              | `records/learner/[userId]/+page.server.ts`, `records/learner/[userId]/+page.svelte` |
| 7   | Minor    | ops  | FAA records export buttons changed from form POST to `<a>` links hitting GET endpoints                                                 | `records/+page.svelte`                                                              |

## Details

### 1. Evidence packet data (sim)

The `complete` action in scenario-player was writing `topicsCovered: []` and `competenciesExercised: []`. Now reads `scenario.faaTopics` and `scenario.competencies` from published content and passes them through to `recordCompleteRun`. Fixes downstream: debrief tags, progress competency coverage, FAA evidence completeness.

### 2. Replay button (sim)

Debrief page was missing the disabled Replay button described in the spec. Added `<Button disabled>Replay (coming soon)</Button>` to the actions row alongside Try Again and Continue.

### 3. FAA record export architecture (ops)

SvelteKit form actions cannot return raw `Response` objects for file downloads. Created new `+server.ts` with a `GET` handler that accepts `format`, `from`, `to` query params. Removed dead export actions from `+page.server.ts` (comment documents the move). Page template changed export buttons from `<form method="POST">` to `<Button href="...">` links.

### 4. Certificate revoke reason (ops)

Revoke dialog now contains a `<Textarea>` for the reason. The hidden `reason` input syncs with the textarea value. Server-side `revoke` action validates that reason is non-empty (returns 400 otherwise). Reason is included in the audit log `details.reason` field.

### 5. Certificate ID prefix (libs)

`generateCertId()` changed from `crt_` to `cert_` prefix. Consistent with the 3-4 letter prefix convention used by other generators (`enr_`, `att_`, `prf_`).

### 6. Learner record date range (ops)

Evidence packet export form on the learner record page now has `from` and `to` date inputs. Server parses these from form data with fallback to the 24-month FAA default window. Previously the date range was hardcoded.
