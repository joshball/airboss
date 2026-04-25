---
title: "Phase 3: Ops Foundation"
product: ops
type: phase-index
---

# Phase 3: Ops Foundation

7 features. Foundation for operations and FAA compliance.

## Dependency Graph

```
ops-shell (1)
    |
user-management (2)
    |
enrollment-management (3)
    |
    +-- learner-progress (4)
    +-- certificate-issuance (5)
    +-- faa-records (6)
            |
        analytics-dashboard (7)
```

## Features

| #   | Feature                                         | Size   | Depends On | Parallel Lane |
| --- | ----------------------------------------------- | ------ | ---------- | ------------- |
| 1   | [Ops app shell](ops-shell/)                     | Large  | None       | A             |
| 2   | [User management](user-management/)             | Large  | 1          | A             |
| 3   | [Enrollment management](enrollment-management/) | Large  | 2          | A             |
| 4   | [Learner progress view](learner-progress/)      | Medium | 3          | B             |
| 5   | [Certificate issuance](certificate-issuance/)   | Large  | 3          | B             |
| 6   | [FAA records](faa-records/)                     | Large  | 3          | C             |
| 7   | [Analytics dashboard](analytics-dashboard/)     | Medium | 6          | C             |

## Parallel Lanes

- **Lane A (sequential):** shell -> user-management -> enrollment-management
- **Lane B (after enrollment):** learner-progress, certificate-issuance (can run in parallel)
- **Lane C (after enrollment):** faa-records -> analytics-dashboard

Features 4 and 5 can run in parallel with feature 6, once feature 3 is complete.

## Exit Criteria

- [x] An operator can manage users (invite, role assign, ban)
- [x] An operator can create and manage enrollments
- [x] An operator can view learner progress (modules, time, scores)
- [x] An operator can issue certificates (graduation vs completion)
- [x] An operator can pull FAA records (24-month retention, evidence packets)
- [x] Analytics dashboard shows completion rates and struggle points
- [x] `bun run check` passes with 0 errors, 0 warnings
- [x] `bun run test` passes
- [x] No regressions in hangar or sim
- [x] All tracking docs updated (TASKS.md, ROADMAP.md, NOW.md)
