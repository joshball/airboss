---
title: Certificate Issuance -- Test Plan
product: ops
feature: certificate-issuance
type: test-plan
status: done
---

# Certificate Issuance -- Test Plan

Manual test plan. Run with ops dev server (`bun run dev` in `apps/ops`).

## Prerequisites

- PostgreSQL running (OrbStack)
- Database migrated with enrollment schema (including certificate additions)
- At least one completed enrollment with all modules done, time met, knowledge check passed
- At least one active enrollment with partial progress
- Ops app running locally, logged in as operator

## Tests

### 1. Certificate List

| Step | Action                                           | Expected                                                          |
| ---- | ------------------------------------------------ | ----------------------------------------------------------------- |
| 1.1  | Navigate to `/certificates` with no certificates | Empty state: "No certificates issued yet" with link to issue page |
| 1.2  | After issuing certificates: view list            | Table shows ID, learner, type, date, issued by, status            |
| 1.3  | Filter by type "graduation"                      | Only graduation certificates shown                                |
| 1.4  | Filter by type "completion"                      | Only completion certificates shown                                |

### 2. Issue Graduation Certificate

| Step | Action                                                  | Expected                                                     |
| ---- | ------------------------------------------------------- | ------------------------------------------------------------ |
| 2.1  | Navigate to `/certificates/issue`                       | Form with enrollment dropdown and type selector              |
| 2.2  | Select a completed enrollment, type "graduation"        | Validation results appear: all criteria checked              |
| 2.3  | All criteria pass                                       | Submit button enabled, all checks green                      |
| 2.4  | Submit                                                  | Certificate created, redirect to `/certificates/[id]`        |
| 2.5  | Select enrollment missing a completed module            | Validation shows which module is incomplete, submit disabled |
| 2.6  | Select enrollment with insufficient time                | Validation shows current vs required time, submit disabled   |
| 2.7  | Try to issue second graduation cert for same enrollment | Validation error: "Graduation certificate already exists"    |

### 3. Issue Completion Certificate

| Step | Action                                      | Expected                                        |
| ---- | ------------------------------------------- | ----------------------------------------------- |
| 3.1  | Select active enrollment, type "completion" | Time validation only                            |
| 3.2  | Time threshold met                          | Submit enabled, certificate created             |
| 3.3  | Time threshold not met                      | Shows current time vs required, submit disabled |

### 4. Certificate Detail

| Step | Action                           | Expected                                                             |
| ---- | -------------------------------- | -------------------------------------------------------------------- |
| 4.1  | Navigate to `/certificates/[id]` | All FAA fields displayed: name, address, course, dates, test results |
| 4.2  | Click "Download PDF"             | PDF downloads with all required FAA fields                           |
| 4.3  | Open PDF                         | Readable, contains certificate ID, attendee info, dates, results     |
| 4.4  | Navigate with non-existent ID    | 404 error page                                                       |

### 5. Revoke Certificate

| Step | Action                        | Expected                                                   |
| ---- | ----------------------------- | ---------------------------------------------------------- |
| 5.1  | Click "Revoke" on detail page | Confirmation dialog appears                                |
| 5.2  | Cancel revocation             | No changes, certificate still active                       |
| 5.3  | Confirm revocation            | Certificate shows "Revoked" badge, revokedAt/revokedBy set |
| 5.4  | View revoked cert in list     | "Revoked" badge visible in status column                   |
| 5.5  | Check audit log               | Revocation action logged with operator ID                  |

### 6. Edge Cases

| Step | Action                                         | Expected                                           |
| ---- | ---------------------------------------------- | -------------------------------------------------- |
| 6.1  | Issue cert for withdrawn enrollment            | Graduation blocked, completion allowed if time met |
| 6.2  | PDF generation with special characters in name | PDF renders correctly                              |
| 6.3  | Two operators issue certs simultaneously       | Each creates successfully, no conflicts            |
