---
title: Certificate Issuance -- Tasks
product: ops
feature: certificate-issuance
type: tasks
status: done
---

# Certificate Issuance -- Tasks

## Implementation

| #   | Task                                                                                                                 | Status |
| --- | -------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | Route constants: `OPS_CERTIFICATES`, `OPS_CERTIFICATE_ISSUE`, `OPS_CERTIFICATE` in `libs/constants/src/routes.ts`    | [x]    |
| 2   | Schema update: add `pdfUrl`, `metadata`, `revokedAt`, `revokedBy` to `enrollment.certificate` table                  | [x]    |
| 3   | Constants: `CERTIFICATE_TYPES` enum (`graduation`, `completion`) in `libs/constants/`                                | [x]    |
| 4   | BC: `listCertificates(filters?)` in `libs/bc/enrollment/src/manage.ts`                                               | [x]    |
| 5   | BC: `getCertificate(id)` in `libs/bc/enrollment/src/manage.ts`                                                       | [x]    |
| 6   | BC: `revokeCertificate(id, revokedBy)` in `libs/bc/enrollment/src/manage.ts`                                         | [x]    |
| 7   | BC: `validateGraduation(enrollmentId)` in `libs/bc/enrollment/src/manage.ts` -- check modules, time, knowledge check | [x]    |
| 8   | Zod schema: `issueCertificateSchema` in `libs/types/src/schemas.ts`                                                  | [x]    |
| 9   | PDF utility: `generateCertificatePdf(certData)` -- `libs/bc/enrollment/src/pdf.ts` using pdf-lib                     | [x]    |
| 10  | List page: server load + `+page.svelte` at `/certificates`                                                           | [x]    |
| 11  | Issue page: server load + form action + `+page.svelte` at `/certificates/issue`                                      | [x]    |
| 12  | Detail page: server load + `+page.svelte` at `/certificates/[id]` with PDF download                                  | [x]    |
| 13  | Revoke action: form action on detail page, confirmation dialog, audit log                                            | [x]    |
| 14  | Sidebar nav: "Certificates" link in ops layout                                                                       | [x]    |
| 15  | Regenerate initial migration (schema changes)                                                                        | [x]    |
| 16  | `bun run check` passes                                                                                               | [x]    |

## File Inventory

| File                                                           | Purpose                     |
| -------------------------------------------------------------- | --------------------------- |
| `libs/constants/src/routes.ts`                                 | Route constants             |
| `libs/constants/src/enrollment.ts`                             | `CERTIFICATE_TYPES`         |
| `libs/bc/enrollment/src/schema.ts`                             | Schema additions            |
| `libs/bc/enrollment/src/manage.ts`                             | BC functions                |
| `libs/bc/enrollment/src/pdf.ts`                                | PDF generation              |
| `libs/types/src/schemas.ts`                                    | Zod validation              |
| `apps/ops/src/routes/(app)/certificates/+page.server.ts`       | List load                   |
| `apps/ops/src/routes/(app)/certificates/+page.svelte`          | List UI                     |
| `apps/ops/src/routes/(app)/certificates/issue/+page.server.ts` | Issue load + action         |
| `apps/ops/src/routes/(app)/certificates/issue/+page.svelte`    | Issue form UI               |
| `apps/ops/src/routes/(app)/certificates/[id]/+page.server.ts`  | Detail load + revoke action |
| `apps/ops/src/routes/(app)/certificates/[id]/+page.svelte`     | Detail UI                   |
