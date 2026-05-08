---
title: "Drift Fixes 2026-03-30 - Test Plan"
status: "done"
---

# Test Plan

Manual test scenarios for each fix. All tests use dev server (`bun dev`).

## 1. Evidence packet data

| Step | Action                                                | Expected                                                           |
| ---- | ----------------------------------------------------- | ------------------------------------------------------------------ |
| 1    | Start sim, complete a scenario                        | Redirect to debrief page                                           |
| 2    | Check "Topics & Competencies" panel on debrief        | Shows topic badges and competency badges (not empty)               |
| 3    | Check DB: `evidence.evidence_packets` row for the run | `topics_covered` and `competencies_exercised` arrays are populated |

## 2. Replay button

| Step | Action                               | Expected                                                                |
| ---- | ------------------------------------ | ----------------------------------------------------------------------- |
| 1    | Complete a scenario, land on debrief | Actions row shows three buttons: Replay (disabled), Try Again, Continue |
| 2    | Click Replay button                  | Nothing happens (button is disabled)                                    |
| 3    | Click Try Again                      | Navigates to scenario brief                                             |
| 4    | Click Continue                       | Navigates to course page                                                |

## 3. FAA record export

| Step | Action                     | Expected                                                                      |
| ---- | -------------------------- | ----------------------------------------------------------------------------- |
| 1    | Navigate to ops `/records` | Export JSON and Export CSV buttons visible in export row                      |
| 2    | Click Export JSON          | Browser downloads `.json` file with record array                              |
| 3    | Click Export CSV           | Browser downloads `.csv` file with header + data rows                         |
| 4    | Verify downloaded files    | JSON has valid structure; CSV has Type, Learner, Email, Date, Summary columns |

## 4. Certificate revoke reason

| Step | Action                                   | Expected                                                                 |
| ---- | ---------------------------------------- | ------------------------------------------------------------------------ |
| 1    | Navigate to an active certificate in ops | Revoke certificate button visible                                        |
| 2    | Click Revoke certificate                 | Confirm dialog opens with reason textarea                                |
| 3    | Click Revoke with empty reason           | Form resubmits, 400 error: "A reason for revocation is required"         |
| 4    | Enter reason, click Revoke               | Certificate revoked, page refreshes showing revoked state                |
| 5    | Check audit log for the certificate      | Entry shows `action: revoke`, `details.reason` contains the entered text |

## 5. Certificate ID prefix

| Step | Action                              | Expected                                        |
| ---- | ----------------------------------- | ----------------------------------------------- |
| 1    | Issue a new certificate through ops | Certificate ID starts with `cert_` (not `crt_`) |

## 6. Learner record date range

| Step | Action                                          | Expected                                                                 |
| ---- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| 1    | Navigate to a learner record in ops             | Export form shows From and To date inputs, defaulting to 24-month window |
| 2    | Adjust date range, click Export Evidence Packet | Downloaded JSON `dateRange.from`/`dateRange.to` match the inputs         |
| 3    | Leave dates at defaults, export                 | Date range spans 24 months back from today                               |
