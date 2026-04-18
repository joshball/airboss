---
title: "Ops PRD"
product: ops
type: prd
---

# Ops Product Requirements

## Phase 3 Features

| #   | Feature                                                  | Size   | Link                                        | Priority   |
| --- | -------------------------------------------------------- | ------ | ------------------------------------------- | ---------- |
| 1   | [Ops app shell](features/ops-shell/)                     | Large  | Auth, nav, layout, role guards              | Foundation |
| 2   | [User management](features/user-management/)             | Large  | Accounts, roles, invite, ban                | Core       |
| 3   | [Enrollment management](features/enrollment-management/) | Large  | Create, view, manage enrollments            | Core       |
| 4   | [Learner progress view](features/learner-progress/)      | Medium | Module progress, time, scores               | Core       |
| 5   | [Certificate issuance](features/certificate-issuance/)   | Large  | Graduation vs completion, PDF               | Core       |
| 6   | [FAA records](features/faa-records/)                     | Large  | 24-month retention, evidence packets, audit | Compliance |
| 7   | [Analytics dashboard](features/analytics-dashboard/)     | Medium | Completion rates, struggle points           | Insight    |

## Dependencies

```
ops-shell --> user-management --> enrollment-management
                                        |
                               +--------+--------+
                               |        |        |
                    learner-progress  certificate  faa-records
                                                      |
                                              analytics-dashboard
```

## What Ops Does NOT Do

- **No content editing.** That's hangar.
- **No training delivery.** That's sim.
- **No public registration.** That's runway.
- **No self-registration.** Ops accounts are invite-only (ADR-009).
