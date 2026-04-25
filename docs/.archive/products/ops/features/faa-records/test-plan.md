---
title: FAA Records -- Test Plan
product: ops
feature: faa-records
type: test-plan
status: done
---

# FAA Records -- Test Plan

Manual test plan. Run with ops dev server (`bun run dev` in `apps/ops`).

## Prerequisites

- PostgreSQL running (OrbStack)
- Database migrated with all schemas (enrollment, evidence, audit, compliance)
- Seed data: multiple learners with enrollments, time logs, scenario runs, certificates, audit entries
- Ops app running locally, logged in as operator

## Tests

### 1. Records Search

| Step | Action                                       | Expected                                            |
| ---- | -------------------------------------------- | --------------------------------------------------- |
| 1.1  | Navigate to `/records`                       | Default date range: 24 months back to today         |
| 1.2  | Click Search with default filters            | All records from last 24 months displayed           |
| 1.3  | Set date range to last 7 days                | Only recent records shown                           |
| 1.4  | Filter by learner name                       | Only that learner's records shown                   |
| 1.5  | Filter by type "certificate"                 | Only certificate records shown                      |
| 1.6  | Combine filters: learner + type + date range | Intersection of all filters                         |
| 1.7  | Search with no matching records              | Empty state message                                 |
| 1.8  | Verify pagination                            | Page 1 shows 50 records, "Next" navigates to page 2 |

### 2. Learner Record

| Step | Action                                  | Expected                                                      |
| ---- | --------------------------------------- | ------------------------------------------------------------- |
| 2.1  | Navigate to `/records/learner/[userId]` | All sections visible, collapsed by default except enrollments |
| 2.2  | Expand "Time Logs" section              | Total time, FAA-qualified time, topic breakdown               |
| 2.3  | Expand "Scenario Runs" section          | All runs with outcome, score, date                            |
| 2.4  | Expand "Certificates" section           | Certificates with type, status                                |
| 2.5  | Expand "Audit Trail" section            | Actions involving this learner                                |
| 2.6  | Navigate with non-existent userId       | 404 error page                                                |

### 3. Evidence Packet Export

| Step | Action                                           | Expected                                                                    |
| ---- | ------------------------------------------------ | --------------------------------------------------------------------------- |
| 3.1  | Click "Export Evidence Packet" on learner record | JSON file downloads                                                         |
| 3.2  | Open JSON file                                   | Contains enrollments, timeLogs, scenarioRuns, knowledgeChecks, certificates |
| 3.3  | Verify metadata                                  | `exportedAt`, `exportedBy`, `dateRange` present                             |
| 3.4  | Learner with no records                          | Export contains empty arrays, no errors                                     |

### 4. Records Export (CSV/JSON)

| Step | Action                            | Expected                                                     |
| ---- | --------------------------------- | ------------------------------------------------------------ |
| 4.1  | Apply filters, click "Export CSV" | CSV file downloads with filtered results                     |
| 4.2  | Open CSV                          | Headers match table columns, data matches filtered view      |
| 4.3  | Click "Export JSON"               | JSON file downloads with filtered results                    |
| 4.4  | Export with no results            | File downloads with headers only (CSV) or empty array (JSON) |

### 5. Audit Trail

| Step | Action                       | Expected                                       |
| ---- | ---------------------------- | ---------------------------------------------- |
| 5.1  | Navigate to `/records/audit` | Paginated audit log entries, most recent first |
| 5.2  | Filter by user               | Only that user's actions shown                 |
| 5.3  | Filter by action type        | Only matching actions shown                    |
| 5.4  | Filter by entity type        | Only matching entities shown                   |
| 5.5  | Set date range               | Only entries within range shown                |
| 5.6  | Click on entry to expand     | Details (jsonb) displayed                      |
| 5.7  | Pagination                   | Page navigation works, consistent results      |

### 6. Edge Cases

| Step | Action                                  | Expected                                          |
| ---- | --------------------------------------- | ------------------------------------------------- |
| 6.1  | Learner with 500+ time log entries      | Page loads, no timeout, pagination works          |
| 6.2  | Date range spanning > 24 months         | All records in range returned (no artificial cap) |
| 6.3  | Export large result set (1000+ records) | Download completes without timeout                |
| 6.4  | Audit log with no entries               | Empty state message                               |
