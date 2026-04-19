---
title: Certificate Issuance -- Design
product: ops
feature: certificate-issuance
type: design
status: done
---

# Certificate Issuance -- Design

## Page Layout

### /certificates (list)

```
[Certificates]                              [Issue Certificate]

Type: [All | Graduation | Completion]

| ID       | Learner        | Type       | Issued      | By          | Status  |
|----------|----------------|------------|-------------|-------------|---------|
| cert_01H | Jane Doe       | graduation | 2026-03-15  | admin@...   | Active  |
| cert_01G | John Smith     | completion | 2026-03-10  | admin@...   | Revoked |
```

### /certificates/issue (form)

```
Issue Certificate

Enrollment:  [Select enrollment ▾]
Type:        [Graduation | Completion]

--- Validation Results (shown after enrollment selected) ---
[✓] All modules completed
[✓] FAA-qualified time: 24h 30m (minimum: 16h)
[✓] Knowledge check passed
[✗] Module 4 not completed          <-- blocks graduation

[Issue Certificate]  [Cancel]
```

Live validation: selecting an enrollment triggers server-side `validateGraduation()`. Results display inline. Submit button disabled until validation passes (for graduation type).

### /certificates/[id] (detail)

```
Certificate cert_01H...

Type:        Graduation
Learner:     Jane Doe
Address:     123 Main St, City, ST 12345
Course:      FIRC Boss -- Flight Instructor Refresher Course
Enrolled:    2026-01-15
Completed:   2026-03-15
Test Score:  92%
Issued by:   admin@firc.example
Issued at:   2026-03-15 14:30 UTC

[Download PDF]    [Revoke]
```

## Component Breakdown

| Component               | Location                                | Purpose                                 |
| ----------------------- | --------------------------------------- | --------------------------------------- |
| Certificate list page   | `+page.svelte` at `/certificates`       | Table with filters                      |
| Issue form page         | `+page.svelte` at `/certificates/issue` | Enrollment select + validation + submit |
| Certificate detail page | `+page.svelte` at `/certificates/[id]`  | FAA fields + PDF download + revoke      |
| Validation results      | Inline in issue form                    | Shows pass/fail per criterion           |

## Data Flow

```
Issue form
  -> select enrollment
  -> fetch validateGraduation(enrollmentId) via form action
  -> display validation results
  -> if pass: submit issueCertificate()
  -> snapshot metadata (learner profile, test results, dates)
  -> generate PDF (async, link available on detail page)
  -> redirect to /certificates/[id]
```

## PDF Strategy

Server-side PDF generation. Options (TBD, decide at implementation):

1. **Puppeteer/Playwright** -- render HTML template to PDF
2. **pdf-lib** -- programmatic PDF construction (no browser dependency)

Recommendation: `pdf-lib` for simplicity and no browser runtime dependency. Certificate template is structured text, not complex layout.

## Revocation Flow

Soft delete: `revokedAt` and `revokedBy` set on the certificate row. Original record preserved. Revocation logged via `@firc/audit`. Revoked certificates remain visible in list with "Revoked" badge.
