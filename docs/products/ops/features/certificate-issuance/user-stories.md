---
title: Certificate Issuance -- User Stories
product: ops
feature: certificate-issuance
type: user-stories
status: done
---

# Certificate Issuance -- User Stories

## CERT-1: List issued certificates

**As** an operator,
**I want to** see all issued certificates in a table,
**So that** I can track what's been issued and find specific certificates.

**Acceptance:**

- [ ] Table shows: certificate ID, learner name, type (graduation/completion), issued date, issued by, status
- [ ] Filterable by type (graduation, completion)
- [ ] Sortable by issued date
- [ ] Empty state: "No certificates issued yet"

---

## CERT-2: Issue a graduation certificate

**As** an operator,
**I want to** issue a graduation certificate to a learner who has completed the course,
**So that** they have an official FAA record of completion.

**Acceptance:**

- [ ] Form: select enrollment (dropdown of completed enrollments)
- [ ] Before submit: system validates all graduation criteria (modules, time, knowledge check)
- [ ] If validation fails: show which criteria are unmet with specific reasons
- [ ] If validation passes: certificate created, redirects to certificate detail page
- [ ] Certificate metadata snapshot captured at issuance (name, address, test results, dates)

---

## CERT-3: Issue a completion certificate

**As** an operator,
**I want to** issue a completion certificate for partial/time-based completion,
**So that** learners who met time requirements have documentation.

**Acceptance:**

- [ ] Form: select enrollment (dropdown of active or completed enrollments)
- [ ] Validation: minimum FAA-qualified time met
- [ ] If time threshold not met: show current time vs required
- [ ] Certificate created with type "completion"

---

## CERT-4: View and download certificate

**As** an operator,
**I want to** view a certificate's details and download the PDF,
**So that** I can print or email it to the learner.

**Acceptance:**

- [ ] Detail page shows all FAA-required fields
- [ ] "Download PDF" button generates/downloads the PDF
- [ ] PDF contains: attendee name, address, course title, graduation/denial, test results, dates, certificate ID

---

## CERT-5: Revoke a certificate

**As** an operator,
**I want to** revoke a certificate if issued in error,
**So that** the record is corrected without deleting history.

**Acceptance:**

- [ ] "Revoke" button on certificate detail page
- [ ] Confirmation dialog with reason field
- [ ] Certificate marked as revoked (revokedAt, revokedBy set)
- [ ] Revoked certificates show "Revoked" badge in list
- [ ] Revocation logged in audit trail
