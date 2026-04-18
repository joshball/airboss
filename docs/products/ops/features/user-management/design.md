---
title: User Management -- Design
product: ops
feature: user-management
type: design
status: done
---

# User Management -- Design

Technical design for user management in ops. No new DB tables. Uses better-auth admin plugin APIs via `@firc/auth` client, Drizzle queries for listing, and `@firc/audit` for logging and activity display.

## Architecture Decision

User queries (list, detail) go through Drizzle on `bauth_user` directly -- better-auth's admin `listUsers` API has limited filtering. Mutations (invite, role change, ban/unban) go through better-auth's admin plugin to ensure session/auth side effects are handled correctly.

## Routes

Add to `@firc/constants/routes.ts`:

```ts
// Ops users
OPS_USERS: '/users',
OPS_USER_DETAIL: (id: string) => `/users/${id}` as const,
OPS_USER_INVITE: '/users/invite',
```

### SvelteKit Route Structure

```
apps/ops/src/routes/
  users/
    +page.server.ts      -- load: list users with filters
    +page.svelte          -- user list table with search/filter
    invite/
      +page.server.ts    -- load: form data; actions: invite
      +page.svelte        -- invite form
    [id]/
      +page.server.ts    -- load: user detail + activity; actions: setRole, ban, unban
      +page.svelte        -- user detail view with action forms
```

## Server-Side Data Loading

### User List (`/users/+page.server.ts`)

```ts
// Query bauth_user with Drizzle (not better-auth API -- need filtering)
import { bauthUser } from "@firc/auth";
import { db } from "@firc/db";
import { and, asc, count, eq, ilike, or } from "drizzle-orm";

// Filters from URL search params: ?role=admin&status=banned&q=smith&page=2
// Build WHERE clause from filters, paginate with LIMIT/OFFSET
// Return: { users, total, page, perPage, filters }
```

Role guard: `requireRole(event, ROLES.ADMIN, ROLES.OPERATOR)`.

### User Detail (`/users/[id]/+page.server.ts`)

```ts
// Load user by ID from bauth_user
// Load activity from queryLog({ entityId: id, limit: 50 })
// Return: { user, activity }
```

## Form Actions

All mutations use SvelteKit form actions (progressive enhancement). All require `ROLES.ADMIN`.

### Invite (`/users/invite/+page.server.ts`)

```ts
actions: {
  default: async (event) => {
    // 1. Validate email + role with Zod schema
    // 2. Check email not already registered (query bauth_user)
    // 3. Call authClient.admin.createUser({ email, role, ... })
    // 4. logAction({ action: 'user.invite', entityType: 'user', ... })
    // 5. Redirect to /users
  }
}
```

### Set Role (`/users/[id]/+page.server.ts`)

```ts
actions: {
  setRole: async (event) => {
    // 1. Validate: new role is valid, not changing own role
    // 2. Get current user for before/after logging
    // 3. Call authClient.admin.setRole({ userId, role })
    // 4. logAction({ action: 'user.role.change', details: { previousRole, newRole } })
    // 5. Return success
  };
}
```

### Ban / Unban (`/users/[id]/+page.server.ts`)

```ts
actions: {
  ban: async (event) => {
    // 1. Validate: reason required (min 10 chars), not banning self
    // 2. Call authClient.admin.banUser({ userId, banReason, banExpires? })
    // 3. logAction({ action: 'user.ban', details: { reason, expires } })
  },
  unban: async (event) => {
    // 1. Call authClient.admin.unbanUser({ userId })
    // 2. logAction({ action: 'user.unban', details: { previousBanReason } })
  }
}
```

## Component Breakdown

### Pages (in `apps/ops/src/routes/`)

| Component        | Source                      |
| ---------------- | --------------------------- |
| User list page   | `users/+page.svelte`        |
| Invite page      | `users/invite/+page.svelte` |
| User detail page | `users/[id]/+page.svelte`   |

### Shared UI (from `@firc/ui`)

| Component     | Usage                                 |
| ------------- | ------------------------------------- |
| DataTable     | User list table (reuse from hangar)   |
| ConfirmDialog | Role change, ban, unban confirmations |
| FormField     | All form inputs                       |
| Badge         | Role badge, status badge              |
| Pagination    | User list pagination                  |

### New Components (in `apps/ops/src/lib/`)

| Component          | Purpose                         |
| ------------------ | ------------------------------- |
| UserFilters.svelte | Search + role/status filter bar |
| ActivityLog.svelte | Audit log table for user detail |
| BanForm.svelte     | Ban reason + expiration form    |
| RoleSelect.svelte  | Role dropdown with confirm      |

## Validation Schemas

Add to `@firc/types/src/schemas.ts`:

```ts
export const inviteUserSchema = z.object({
  email: z.string().email(),
  role: z.enum([ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN]),
});

export const banUserSchema = z.object({
  reason: z.string().min(10, "Ban reason must be at least 10 characters"),
  expires: z.string().datetime().optional(),
});

export const setRoleSchema = z.object({
  role: z.enum([ROLES.LEARNER, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN]),
});
```

## Key Decisions

1. **Drizzle for reads, better-auth for writes.** better-auth admin API lacks filtering/pagination. Drizzle gives full query control over `bauth_user`. Writes go through better-auth to handle session invalidation on ban.

2. **No new BC lib.** User management is thin enough to live in route handlers. If it grows, extract to `libs/bc/identity/` later.

3. **Invite creates account directly.** No separate "invitation" table. better-auth's `createUser` creates the account; the user sets their password via the email flow.

4. **Activity log is read-only in ops.** All apps write to `audit.action_log` via `logAction()`. Ops reads via `queryLog()`. No new audit infrastructure needed.
