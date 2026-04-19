---
title: "Ops Tasks"
product: ops
type: tasks
---

# Ops Tasks

Product backlog for ops. Phase 3 complete.

## Completed (Phase 3)

| #   | Feature               | Size   | Link                                                               | Status |
| --- | --------------------- | ------ | ------------------------------------------------------------------ | ------ |
| 1   | Ops app shell         | Large  | [features/ops-shell/](features/ops-shell/)                         | Done   |
| 2   | User management       | Large  | [features/user-management/](features/user-management/)             | Done   |
| 3   | Enrollment management | Large  | [features/enrollment-management/](features/enrollment-management/) | Done   |
| 4   | Learner progress view | Medium | [features/learner-progress/](features/learner-progress/)           | Done   |
| 5   | Certificate issuance  | Large  | [features/certificate-issuance/](features/certificate-issuance/)   | Done   |
| 6   | FAA records           | Large  | [features/faa-records/](features/faa-records/)                     | Done   |
| 7   | Analytics dashboard   | Medium | [features/analytics-dashboard/](features/analytics-dashboard/)     | Done   |

## Up Next (Phase 4)

- Compliance dashboard (traceability matrix viewer, FAA submission workflow)
- Bulk enrollment operations
- Report generation
- TSA record management (5-year retention)

## Notes

- Ops consumes data written by sim (evidence, enrollment progress) and hangar (published content).
- All ops mutations are audited via `@firc/audit`.
- Role guard: OPERATOR and ADMIN only (ADR-009).
