---
title: FAA Records -- Tasks
product: ops
feature: faa-records
type: tasks
status: done
---

# FAA Records -- Tasks

## Implementation

| #   | Task                                                                                                                   | Status                        |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 1   | Route constants: `OPS_RECORDS`, `OPS_RECORDS_LEARNER`, `OPS_RECORDS_AUDIT` in `libs/constants/src/routes.ts`           | [x]                           |
| 2   | Type: `EvidencePacketExport` interface in `libs/types/`                                                                | [x]                           |
| 3   | BC: `listEnrollmentsByUser(userId)` in `libs/bc/enrollment/src/manage.ts`                                              | [x]                           |
| 4   | BC: `listCertificatesByEnrollment(enrollmentId)` in `libs/bc/enrollment/src/manage.ts`                                 | [x]                           |
| 5   | BC: `queryTimeLogs(filters)` in `libs/bc/enrollment/src/manage.ts` -- date range + userId                              | [x]                           |
| 6   | BC: `queryScenarioRuns(filters)` in `libs/bc/evidence/src/manage.ts` -- date range + userId                            | [x]                           |
| 7   | BC: extend `queryLog` in `libs/audit/src/query.ts` -- add date range filter + pagination (offset/limit)                | [x]                           |
| 8   | Utility: `assembleEvidencePacket(userId, dateRange, exportedBy)` -- aggregates all BC data into `EvidencePacketExport` | [x] (inline in server action) |
| 9   | Records search page: server load + form actions + `+page.svelte` at `/records`                                         | [x]                           |
| 10  | Records search: pagination (server-side, offset-based, page size 50)                                                   | [x]                           |
| 11  | Records search: CSV export action                                                                                      | [x]                           |
| 12  | Records search: JSON export action                                                                                     | [x]                           |
| 13  | Learner record page: server load + `+page.svelte` at `/records/learner/[userId]`                                       | [x]                           |
| 14  | Learner record: collapsible sections (enrollments, time, runs, checks, certs, audit)                                   | [x]                           |
| 15  | Learner record: "Export Evidence Packet" form action -> JSON download                                                  | [x]                           |
| 16  | Audit trail page: server load + `+page.svelte` at `/records/audit`                                                     | [x]                           |
| 17  | Audit trail: filters (user, action, entity type, date range) + pagination                                              | [x]                           |
| 18  | Sidebar nav: "Records" section with "Search", "Audit Trail" links                                                      | [x]                           |
| 19  | `bun run check` passes                                                                                                 | [x]                           |

## File Inventory

| File                                                                 | Purpose                                     |
| -------------------------------------------------------------------- | ------------------------------------------- |
| `libs/constants/src/routes.ts`                                       | Route constants                             |
| `libs/types/src/evidence-packet.ts`                                  | `EvidencePacketExport` type                 |
| `libs/bc/enrollment/src/manage.ts`                                   | Query functions                             |
| `libs/bc/evidence/src/manage.ts`                                     | Query functions                             |
| `libs/audit/src/query.ts`                                            | Extended query with date range + pagination |
| `apps/ops/src/routes/(app)/records/+page.server.ts`                  | Search load + export actions                |
| `apps/ops/src/routes/(app)/records/+page.svelte`                     | Search UI                                   |
| `apps/ops/src/routes/(app)/records/learner/[userId]/+page.server.ts` | Learner record load + export action         |
| `apps/ops/src/routes/(app)/records/learner/[userId]/+page.svelte`    | Learner record UI                           |
| `apps/ops/src/routes/(app)/records/audit/+page.server.ts`            | Audit trail load                            |
| `apps/ops/src/routes/(app)/records/audit/+page.svelte`               | Audit trail UI                              |
