---
title: FAA Records -- User Stories
product: ops
feature: faa-records
type: user-stories
status: done
---

# FAA Records -- User Stories

## REC-1: Search records by date range

**As** an operator,
**I want to** search all learner records within a date range,
**So that** I can respond to FAA inquiries about specific time periods.

**Acceptance:**

- [ ] Default date range: 24 months back from today
- [ ] Adjustable start and end dates
- [ ] Results show record type, learner, date, summary
- [ ] Filterable by record type (enrollment, certificate, scenario_run, time_log)
- [ ] Filterable by learner name/email
- [ ] Empty state when no records match

---

## REC-2: View complete learner record

**As** an operator,
**I want to** see everything about a specific learner in one place,
**So that** I can answer "Show me all records for learner X."

**Acceptance:**

- [ ] Page shows: enrollments, time logs, scenario runs, knowledge checks, certificates, audit trail
- [ ] Each section collapsible
- [ ] Time logs show FAA-qualified total prominently
- [ ] Scenario runs show outcome and score
- [ ] Certificates show type and status (active/revoked)

---

## REC-3: Export evidence packet

**As** an operator,
**I want to** export all records for a learner as a single file,
**So that** I can provide evidence to the FAA or attach to a compliance report.

**Acceptance:**

- [ ] "Export Evidence Packet" button on learner record page
- [ ] Export includes: enrollments, time logs, scenario runs, knowledge checks, certificates
- [ ] Export format: JSON (human-readable, machine-parseable)
- [ ] Export includes metadata: date range, exported by, exported at
- [ ] Download triggers immediately

---

## REC-4: View audit trail

**As** an operator,
**I want to** view the system audit trail,
**So that** I can investigate who did what and when.

**Acceptance:**

- [ ] Paginated list of audit log entries
- [ ] Filterable by user, action, entity type, date range
- [ ] Each entry shows: timestamp, user, action, entity type, entity ID
- [ ] Expandable details (jsonb details field)

---

## REC-5: Export filtered records

**As** an operator,
**I want to** export the current filtered record set as CSV or JSON,
**So that** I can work with records in external tools or provide to auditors.

**Acceptance:**

- [ ] "Export" button on records search page
- [ ] Exports current filter results (not all records)
- [ ] Format options: CSV, JSON
- [ ] CSV includes headers matching table columns
