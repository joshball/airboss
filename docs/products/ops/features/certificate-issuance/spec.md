---
title: Certificate Issuance -- Spec
product: ops
feature: certificate-issuance
type: spec
status: done
---

# Certificate Issuance -- Spec

Issue certificates to learners who complete their enrollment. Two types: graduation (full completion) and completion (partial/time-based). PDF generation for printing/download.

## Routes

| Route                 | Constant                | Purpose                            |
| --------------------- | ----------------------- | ---------------------------------- |
| `/certificates`       | `OPS_CERTIFICATES`      | List all issued certificates       |
| `/certificates/issue` | `OPS_CERTIFICATE_ISSUE` | Issue a new certificate (form)     |
| `/certificates/[id]`  | `OPS_CERTIFICATE(id)`   | View/download a single certificate |

## Data Model

Uses existing `enrollment.certificate` table:

| Column         | Type        | Notes                              |
| -------------- | ----------- | ---------------------------------- |
| `id`           | text PK     | Tier B ID (`cert_ULID`)            |
| `enrollmentId` | text FK     | References `enrollment.enrollment` |
| `type`         | text        | `graduation` or `completion`       |
| `issuedAt`     | timestamptz | Auto-set on creation               |
| `issuedBy`     | text        | Operator userId who issued         |

### Schema Additions Needed

The existing `certificate` table lacks fields required for FAA compliance and PDF generation:

| Column      | Type                   | Purpose                                                           |
| ----------- | ---------------------- | ----------------------------------------------------------------- |
| `pdfUrl`    | text (nullable)        | Path to generated PDF                                             |
| `metadata`  | jsonb (nullable)       | FAA-required fields snapshot (name, address, test results, dates) |
| `revokedAt` | timestamptz (nullable) | If certificate was revoked                                        |
| `revokedBy` | text (nullable)        | Who revoked it                                                    |

## Certificate Types

| Type           | Criteria                                                          | When                                        |
| -------------- | ----------------------------------------------------------------- | ------------------------------------------- |
| **Graduation** | All modules completed + minimum time met + knowledge check passed | Learner fully completed FIRC                |
| **Completion** | Partial completion with time threshold met                        | Time-based completion, not all modules done |

## Validation Rules

Before issuing a graduation certificate:

1. Enrollment status must be `completed`
2. All `module_progress` records must have status `completed`
3. Total FAA-qualified time must meet minimum threshold (from constants)
4. Knowledge check must be passed (derived from lesson attempts)
5. No existing graduation certificate for this enrollment

Before issuing a completion certificate:

1. Enrollment status must be `active` or `completed`
2. Minimum FAA-qualified time threshold met
3. No existing certificate of same type for this enrollment

## PDF Generation

Generated server-side. Contains FAA-required fields per AC 61-83K:

- Attendee name and address
- Course title and provider
- Graduation or denial status
- Test results summary
- Enrollment and completion dates
- Certificate ID for verification
- Issuing operator name

PDF stored locally or in object storage (TBD -- initially local file).

## BC Functions

### Existing

- `enrollment/manage.issueCertificate(data)` -- insert certificate row

### Needed

| Function                           | BC                  | Purpose                                                      |
| ---------------------------------- | ------------------- | ------------------------------------------------------------ |
| `listCertificates(filters?)`       | `enrollment/manage` | List certs with optional enrollmentId/type filter            |
| `getCertificate(id)`               | `enrollment/manage` | Single cert by ID                                            |
| `revokeCertificate(id, revokedBy)` | `enrollment/manage` | Soft-revoke a certificate                                    |
| `validateGraduation(enrollmentId)` | `enrollment/manage` | Check all graduation criteria, return pass/fail with reasons |
| `generateCertificatePdf(certId)`   | utility (new)       | Generate PDF from certificate data                           |

## FAA Relevance

Certificate is the official FAA record of course completion. Per AC 61-83K, must include: attendee name, address, graduation/denial status, test results, dates. Records retained 24+ months.
