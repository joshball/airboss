---
title: FAA Records -- Spec
product: ops
feature: faa-records
type: spec
status: done
---

# FAA Records -- Spec

Query and export FAA records. 24-month retention queries for all learner records. Evidence packet assembly for individual learners. Audit trail viewer.

## Routes

| Route                       | Constant                      | Purpose                     |
| --------------------------- | ----------------------------- | --------------------------- |
| `/records`                  | `OPS_RECORDS`                 | Record search + export      |
| `/records/learner/[userId]` | `OPS_RECORDS_LEARNER(userId)` | All records for one learner |
| `/records/audit`            | `OPS_RECORDS_AUDIT`           | Audit trail viewer          |

## Data Sources

| Source     | Schema       | Tables                                                                       | Access              |
| ---------- | ------------ | ---------------------------------------------------------------------------- | ------------------- |
| Enrollment | `enrollment` | `enrollment`, `module_progress`, `time_log`, `lesson_attempt`, `certificate` | `enrollment/manage` |
| Evidence   | `evidence`   | `scenario_run`, `score_dimension`, `evidence_packet`                         | `evidence/manage`   |
| Audit      | `audit`      | `action_log`, `content_version`                                              | `audit/query`       |
| Compliance | `compliance` | `traceability_entry`                                                         | `compliance/read`   |

## Page Sections

### /records -- Record Search

Primary query interface. Operators search for records by date range and optional filters.

| Filter      | Type                    | Purpose                                         |
| ----------- | ----------------------- | ----------------------------------------------- |
| Date range  | start/end date pickers  | 24-month window default, adjustable             |
| Learner     | text search or dropdown | Filter to specific learner                      |
| Record type | multi-select            | enrollment, certificate, scenario_run, time_log |
| Status      | select                  | active, completed, withdrawn                    |

Results table shows matched records with type, learner, date, summary. "Export" button generates CSV/JSON for the filtered result set.

### /records/learner/[userId] -- Learner Record

Complete record for one learner. Everything the FAA could ask for.

| Section          | Content                                                     |
| ---------------- | ----------------------------------------------------------- |
| Enrollments      | All enrollments with status, dates                          |
| Time logs        | All time entries, FAA-qualified time total, topic breakdown |
| Scenario runs    | All runs with outcome, score, evidence packets              |
| Knowledge checks | All attempts with pass/fail                                 |
| Certificates     | All issued certificates with type, date, status             |
| Audit trail      | All actions involving this learner                          |

Each section is collapsible. "Export Evidence Packet" button assembles all data into a single downloadable JSON bundle.

### /records/audit -- Audit Trail

Paginated view of `audit.action_log`. Filters:

| Filter      | Type                                 |
| ----------- | ------------------------------------ |
| User        | text search                          |
| Action      | select (from distinct action values) |
| Entity type | select                               |
| Date range  | start/end                            |

## Evidence Packet Format

JSON bundle containing all records for a learner within a date range:

```typescript
interface EvidencePacketExport {
  learnerId: string;
  learnerEmail: string;
  dateRange: { from: string; to: string };
  enrollments: EnrollmentRecord[];
  timeLogs: TimeLogRecord[];
  scenarioRuns: ScenarioRunRecord[];
  knowledgeChecks: LessonAttemptRecord[];
  certificates: CertificateRecord[];
  exportedAt: string;
  exportedBy: string;
}
```

## BC Functions

### Existing

- `audit/queryLog(filters)` -- action log queries
- `audit/getContentHistory(itemType, itemId)` -- content version history
- `evidence/manage.listRunsByUser(userId)` -- scenario runs
- `evidence/manage.getEvidencePacket(runId)` -- evidence for a run
- `evidence/manage.getScoreDimensions(runId)` -- score breakdown
- `compliance/read.getTraceabilityMatrix()` -- FAA topic traceability

### Needed

| Function                                     | BC                  | Purpose                                    |
| -------------------------------------------- | ------------------- | ------------------------------------------ |
| `listEnrollmentsByUser(userId)`              | `enrollment/manage` | All enrollments for a user                 |
| `listCertificatesByEnrollment(enrollmentId)` | `enrollment/manage` | Certs for an enrollment                    |
| `queryTimeLogs(filters)`                     | `enrollment/manage` | Time logs with date range + userId filters |
| `queryScenarioRuns(filters)`                 | `evidence/manage`   | Runs with date range + userId filters      |
| `queryAuditLog(filters)`                     | `audit/query`       | Extended filters: date range, pagination   |
| `assembleEvidencePacket(userId, dateRange)`  | new utility         | Aggregates all data into export format     |

## Retention Rules

| Requirement                          | Period    | Source      |
| ------------------------------------ | --------- | ----------- |
| FAA learner records                  | 24 months | AC 61-83K   |
| TSA flight training security records | 5 years   | 49 CFR 1552 |

Default date range on `/records` is 24 months back from today. TSA records flagged separately (future: TSA retention flag on enrollment).
