---
title: User Management -- Tasks
product: ops
feature: user-management
type: tasks
status: done
---

# User Management -- Tasks

Feature: User management in ops (list, detail, invite, role, ban/unban, activity log).
Status: **Complete**
Depends on: ops-shell (feature #1)

## Phase 1: Foundation

- [x] Add ops user routes to `@firc/constants/routes.ts` (OPS_USERS, OPS_USER_DETAIL, OPS_USER_INVITE)
- [x] Add Zod schemas to `@firc/types/src/schemas.ts` (inviteUserSchema, banUserSchema, setRoleSchema)
- [x] Add audit action constants to `@firc/constants` (USER_ACTIONS)

## Phase 2: User List

- [x] `users/+page.server.ts` -- load users with Drizzle query, filters from URL params, pagination
- [x] `users/+page.svelte` -- DataTable with name, email, role badge, status badge, created date
- [x] Search input + role/status filter (inline in page, GET form submission)
- [x] Wire filters to URL search params (form GET submission)
- [x] Role guard: require ADMIN or OPERATOR

## Phase 3: User Detail

- [x] `users/[id]/+page.server.ts` -- load user by ID, load activity log via `queryLog`
- [x] `users/[id]/+page.svelte` -- profile section, status section, action buttons (admin-only)
- [x] Activity log table (timestamp, action, details) inline in detail page
- [x] Role guard: require ADMIN or OPERATOR

## Phase 4: Invite

- [x] `users/invite/+page.server.ts` -- form action: validate, check duplicate, create via better-auth admin, audit log
- [x] `users/invite/+page.svelte` -- name + email + role form with validation errors
- [x] Role guard: require ADMIN only

## Phase 5: Role Change

- [x] `users/[id]/+page.server.ts` -- `setRole` action: validate, prevent self-change, call better-auth, audit log
- [x] Role select dropdown + confirm dialog in detail page
- [x] Admin-only visibility on user detail page

## Phase 6: Ban / Unban

- [x] `users/[id]/+page.server.ts` -- `ban` action: validate reason, call better-auth, audit log
- [x] `users/[id]/+page.server.ts` -- `unban` action: call better-auth, audit log
- [x] Ban form with reason textarea + optional expiration date in detail page
- [x] Unban confirm dialog showing original ban reason
- [x] Prevent self-ban
- [x] Admin-only visibility on user detail page

## Phase 7: Polish and Integration

- [x] Users nav item already present in ops shell sidebar
- [x] Empty state for user list (no users matching filters)
- [x] Error handling: better-auth API failures, duplicate invite email
- [x] Ban enforcement in `hooks.server.ts` already exists and blocks banned users
- [x] `bun run check` passes with 0 errors, 0 warnings

## Notes

- Kept components inline in pages rather than extracting separate UserFilters, ActivityLog, BanForm, RoleSelect components -- the pages are small enough. Can extract later if reuse emerges.
- Automated tests deferred -- requires running database for integration tests, and E2E tests need the full ops app running.
