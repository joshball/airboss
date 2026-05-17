---
title: 'Build plan: hangar-invite-flow'
type: plan
status: in-progress
created: 2026-05-02
---

Phased execution of [hangar-invite-flow tasks.md](../../work-packages/hangar-invite-flow/tasks.md). Each phase ends with `bun run check` clean.

## Phase 1 -- Constants + types

Add audit target, op subkinds, expiry and token-byte constants, route entries, action ids. Files: `libs/constants/src/audit.ts`, `libs/constants/src/identity.ts` (or new), `libs/constants/src/routes.ts`, `libs/constants/src/index.ts`.

## Phase 2 -- Drizzle schema + migration

Add `hangar.invitation` table to `libs/bc/hangar/src/schema.ts` with unique partial index + role CHECK. Generate migration. The audit `target_type` CHECK is auto-derived from `AUDIT_TARGET_VALUES` so it widens automatically.

## Phase 3 -- Zod schemas

`libs/bc/hangar/src/invitation-schemas.ts` (new): create / revoke / resend / accept input schemas.

## Phase 4 -- BC reads + writes + tests

`libs/bc/hangar/src/invitations.ts` (new) + `invitations.test.ts`. Token gen via `crypto.getRandomValues`. Transactional create/resend (rolls back on email-send failure). Direct `bauth_user` + `bauth_account` insert on accept (mirrors seed pattern; better-auth's admin createUser requires admin headers which we don't have on the public accept route).

## Phase 5 -- Email template

`inviteEmail()` in `libs/auth/src/email/templates.ts` mirroring magicLinkEmail.

## Phase 6 -- Hangar UI (list + detail + create modal)

`apps/hangar/src/routes/(app)/users/invitations/+page.{server.ts,svelte}` and `[id]/+page.{server.ts,svelte}`. Wire link from `/users` to `/users/invitations`.

## Phase 7 -- Study accept route

`apps/study/src/routes/invite/[token]/+page.{server.ts,svelte}`. Public (lives outside `(app)/` so the layout-level auth gate doesn't apply). Sign-in via `auth.handler` with synthetic POST.

## Phase 8 -- Help pages

`apps/hangar/src/lib/help/content/invitations.ts` (admin help) + `apps/study/src/lib/help/content/invite-accept.ts` (recipient help). Wire into respective `pages.ts`.

## Phase 9 -- Final check, doc updates, PR

`bun run check` clean. Vitest BC tests pass. Update hangar PRD, platform ROADMAP, WP frontmatter. Final review pass. Commit + open PR.

## Reviews

Per-phase review uses 2-3 reviewers. Final pass: 10 parallel.

| Phase | Reviewers                      |
| ----- | ------------------------------ |
| 1-2   | schema, patterns, correctness  |
| 3-4   | backend, security, correctness |
| 5-7   | svelte, ux, a11y, security     |
| 8-9   | patterns, ux                   |

Final: full 10x pass.
