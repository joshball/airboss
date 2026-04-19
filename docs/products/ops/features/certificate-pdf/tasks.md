---
title: Certificate PDF - Tasks
status: done
date: 2026-03-31
---

# Certificate PDF Tasks

## Part 1: Address Prerequisite

- [ ] Add `address` JSONB column to `bauth_user` in `libs/auth/src/schema.ts`
- [ ] Add `UserAddress` type + `userAddressSchema` Zod validator to `libs/types/src/schemas.ts`
- [ ] Update `inviteUserSchema` to accept optional address
- [ ] Add address fields to ops invite form (collapsible "Address (optional)" section)
- [ ] Wire address into invite user creation (Drizzle UPDATE after better-auth user create)
- [ ] Regenerate initial migration + `bun db push`

## Part 2: PDF Generation

- [ ] `bun add pdf-lib`
- [ ] Create `generateCertificatePdf(data: CertificatePdfData): Promise<Uint8Array>` in `libs/bc/enrollment/src/pdf.ts`
- [ ] Add `GET` handler at `apps/ops/src/routes/(app)/certificates/[id]/pdf/+server.ts`
- [ ] Add "Download PDF" button to `apps/ops/src/routes/(app)/certificates/[id]/+page.svelte` (hidden when revoked)
- [ ] Update `docs/products/ops/features/certificate-issuance/tasks.md` (mark task 9 done)
- [ ] `bun run check` passes
