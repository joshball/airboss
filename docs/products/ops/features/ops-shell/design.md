---
title: "Design: Ops App Shell"
product: ops
feature: ops-shell
type: design
status: done
---

# Design: Ops App Shell

## Route Files

```text
apps/ops/src/
  hooks.server.ts                         -- session hydration + ban check
  app.d.ts                                -- typed Locals (user, session)
  lib/server/auth.ts                      -- createAuth() wrapper
  routes/
    +layout.server.ts                     -- public vs app route split
    (public)/
      login/
        +page.svelte                      -- login form (no registration)
        +page.server.ts                   -- login action
    (app)/
      +layout.svelte                      -- ThemeControl context, sidebar nav, AppShell
      +layout.server.ts                   -- requireRole(OPERATOR, ADMIN)
      +page.svelte                        -- dashboard (summary stub)
      users/
        +page.svelte                      -- stub ("User management -- coming soon")
      enrollments/
        +page.svelte                      -- stub
      certificates/
        +page.svelte                      -- stub
      records/
        +page.svelte                      -- stub
      analytics/
        +page.svelte                      -- stub
      settings/
        +page.svelte                      -- theme toggle, change password
        +page.server.ts                   -- change password action
      logout/
        +page.server.ts                   -- POST logout, redirect to /login
```

Route groups keep the role guard in one place. `(public)/` routes skip role checks. `(app)/` routes always enforce OPERATOR or ADMIN.

## Auth Pattern

Identical to hangar. Copy these files, change only the role list and branding.

```typescript
// lib/server/auth.ts -- identical to hangar
import { createAuth } from "@firc/auth";
import { building, dev } from "$app/environment";
// ... same lazy init pattern as hangar

// hooks.server.ts -- identical to hangar
// Session hydration + ban check, same shape

// (app)/+layout.server.ts -- role change only
import { requireRole } from "@firc/auth";
import { ROLES, type Role } from "@firc/constants";

const ALLOWED_ROLES: Role[] = [ROLES.OPERATOR, ROLES.ADMIN];

export const load: LayoutServerLoad = async (event) => {
  const user = requireRole(event, ...ALLOWED_ROLES);
  return { user };
};
```

## Component Design

**Sidebar nav** (vertical, persistent):

- Top: FIRC Boss / Ops wordmark
- Nav items (icons + labels): Dashboard, Users, Enrollments, Certificates, Records, Analytics, Settings
- Bottom: user name + role badge, logout button
- `data-app-id="ops"` on `app.html` -- ops accent color applies automatically

Sidebar approach: ops has 7 nav items (growing to more as features land). Top bar would overflow. Sidebar is the standard pattern for admin/ops dashboards.

**Login page:**

- Centered card layout (reuse `AuthCard`, `AuthBrand` from `@firc/ui`)
- `AuthBrand mark="O" name="Ops" sub="FIRC Boss"`
- Email + password fields, submit button
- No registration link. Footer: "Contact your administrator for access."
- Dev login panel in dev mode

**Settings page:**

- Theme section: `ThemeEditor` component (from `@firc/ui`)
- Password section: current + new + confirm fields
- Separate submit buttons per section

**Stub pages:**

- Each stub page: `<h1>` title + short description of what the feature will do
- No fake data or placeholder tables -- just a clear label

## Theme System

Identical to hangar. Copy `(app)/+layout.svelte` theme init pattern. `ThemeControl` context set here; `ThemeEditor` in settings consumes it.

## Constants Required

Add to `libs/constants/src/routes.ts`:

```typescript
// Ops routes -- OPS_ prefix
OPS_DASHBOARD:    '/',
OPS_USERS:        '/users',
OPS_ENROLLMENTS:  '/enrollments',
OPS_CERTIFICATES: '/certificates',
OPS_RECORDS:      '/records',
OPS_ANALYTICS:    '/analytics',
OPS_SETTINGS:     '/settings',
```

All nav links use these constants, never inline path strings.

## Key Decisions

**Sidebar nav vs top bar:** Ops has 7+ nav items. Top bar would require overflow handling or truncation. Sidebar is the standard admin dashboard pattern and scales to more items without layout changes.

**Route groups, not root guard:** Same reasoning as sim/hangar. `requireRole` in root layout would block `/login` and cause an infinite redirect.

**No registration:** Per ADR-009, ops is invite-only. Login page shows "Contact your administrator for access" instead of a registration link.

**Stub pages over empty routes:** Nav items link to real pages with descriptive text, not broken links or redirects. This makes the app feel complete and testable even before features are implemented.

**403 for wrong role, not redirect:** Per ADR-009, a LEARNER accessing ops gets "Not authorized" (403), not a login page. They're authenticated but not permitted.
