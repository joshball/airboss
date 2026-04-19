---
title: Certificate PDF Generation
status: done
date: 2026-03-31
source: docs/work/plans/20260328-PDF-GENERATION.md
feature: certificate-issuance (deferred task 9)
user-story: CERT-4 ("Download PDF" button on detail page)
---

# Certificate PDF Generation

Generate downloadable PDF certificates with all FAA-required fields, including attendee address.

## Source Plan

[20260328-PDF-GENERATION.md](../../../../work/plans/20260328-PDF-GENERATION.md)

## Context

Certificate issuance is feature-complete except PDF generation. The detail page shows all FAA-required fields as HTML. The `pdf_url` column exists in the schema but is never populated. This adds on-demand PDF generation.

## Two Parts

### Part 1: Address Prerequisite

FAA requires attendee address on certificates (AC 61-83K). No field captures address today.

- Add `address` JSONB column to `bauth_user` Drizzle schema (nullable)
- Add `UserAddress` type + Zod validator to `libs/types/`
- Add address fields to ops invite form (optional, collapsible)
- Wire address into user creation (Drizzle UPDATE after better-auth creates user)
- Regenerate initial migration + push schema

Address shape:

| Field   | Required | Notes            |
| ------- | -------- | ---------------- |
| street  | Yes      |                  |
| street2 | No       |                  |
| city    | Yes      |                  |
| state   | Yes      |                  |
| zip     | Yes      |                  |
| country | No       | Defaults to 'US' |

### Part 2: PDF Generation

- Install `pdf-lib` (no browser runtime, small footprint)
- Create `generateCertificatePdf()` in `libs/bc/enrollment/src/pdf.ts`
- Add `GET /certificates/[id]/pdf/+server.ts` endpoint in ops
- Add "Download PDF" button to certificate detail page (hidden when revoked)

PDF layout (single page, Helvetica, structured text):

1. Header -- "FIRC Boss -- Flight Instructor Refresher Course"
2. Subtitle -- "Certificate of [Graduation/Completion]"
3. Field block -- name, address (if present), course version, dates, status, FAA time, certificate ID
4. Footer -- issuer, date, certificate ID for verification

## Not in Scope

- Storing generated PDFs (generate on demand)
- Populating `pdf_url` in database
- Custom fonts or logos
- Batch generation
- Sim self-registration address capture (future)
- User profile address editing (future settings page)
