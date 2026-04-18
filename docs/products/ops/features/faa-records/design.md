---
title: FAA Records -- Design
product: ops
feature: faa-records
type: design
status: done
---

# FAA Records -- Design

## Page Layout

### /records (search)

```
[FAA Records]

Date range: [2024-03-28] to [2026-03-28]    [Search]
Learner:    [_______________]
Type:       [All | Enrollment | Certificate | Scenario Run | Time Log]
Status:     [All | Active | Completed | Withdrawn]

                                                          [Export CSV] [Export JSON]

| Type       | Learner        | Date        | Summary                    |
|------------|----------------|-------------|----------------------------|
| enrollment | Jane Doe       | 2026-01-15  | Active, Release v1.2       |
| time_log   | Jane Doe       | 2026-03-10  | 45min, Topic: A.11, FAA ✓  |
| scenario   | John Smith     | 2026-03-12  | Base-to-Final, safe, 0.85  |
| certificate| Jane Doe       | 2026-03-15  | Graduation, Active         |

[< Prev]  Page 1 of 5  [Next >]
```

### /records/learner/[userId] (learner record)

```
[Learner Record: Jane Doe (jane@example.com)]

[Export Evidence Packet]

▼ Enrollments (2)
| Release | Status    | Enrolled    | Completed   |
|---------|-----------|-------------|-------------|
| v1.2    | completed | 2026-01-15  | 2026-03-15  |
| v1.0    | withdrawn | 2025-06-01  | --          |

▼ Time Logs -- Total: 24h 30m (FAA-qualified: 22h 15m)
| Date       | Topic  | Duration | FAA ✓ |
|------------|--------|----------|-------|
| 2026-03-10 | A.11   | 45:00    | Yes   |
| 2026-03-09 | A.5    | 30:00    | Yes   |

▶ Scenario Runs (8)
▶ Knowledge Checks (3)
▶ Certificates (1)
▶ Audit Trail (15)
```

### /records/audit (audit trail)

```
[Audit Trail]

User:    [_______________]
Action:  [All | create | update | delete | issue | revoke]
Entity:  [All | enrollment | certificate | scenario_run]
Date:    [________] to [________]

| Timestamp           | User       | Action | Entity       | ID        |
|---------------------|------------|--------|--------------|-----------|
| 2026-03-15 14:30:22 | admin@...  | issue  | certificate  | cert_01H  |
| 2026-03-15 14:28:10 | admin@...  | update | enrollment   | enr_01G   |

[< Prev]  Page 1 of 12  [Next >]
```

## Component Breakdown

| Component              | Location                                 | Purpose                                  |
| ---------------------- | ---------------------------------------- | ---------------------------------------- |
| Records search page    | `/records/+page.svelte`                  | Filters + results table + export         |
| Learner record page    | `/records/learner/[userId]/+page.svelte` | Collapsible sections for all data        |
| Audit trail page       | `/records/audit/+page.svelte`            | Paginated audit log viewer               |
| Evidence packet export | Server action                            | Assembles JSON bundle, triggers download |

## Data Flow

```
/records search
  -> form submit with filters
  -> server load queries across BCs (enrollment, evidence, audit)
  -> union results into typed record list
  -> render table with pagination

/records/learner/[userId]
  -> server load fetches all sections in parallel
  -> each section loaded independently
  -> "Export Evidence Packet" -> server action -> JSON download

/records/audit
  -> server load with filter params
  -> paginated queryAuditLog()
  -> render table
```

## Pagination

Server-side pagination for all three pages. Page size: 50 records. Offset-based (`?page=2`). Total count displayed.

## Export Strategy

- **CSV:** Server generates CSV string, sets `Content-Type: text/csv`, triggers download
- **JSON:** Server serializes filtered results, sets `Content-Type: application/json`, triggers download
- **Evidence Packet:** Assembled from all BCs, single JSON file with `EvidencePacketExport` type
