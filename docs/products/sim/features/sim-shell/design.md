---
title: "Design: Sim App Shell"
product: sim
feature: sim-shell
type: design
status: done
---

# Design: Sim App Shell

## Route Files

```text
apps/sim/src/
  hooks.server.ts                         -- session hydration (locals.user, locals.session)
  app.d.ts                                -- typed Locals (user, session)
  routes/
    (public)/
      login/
        +page.svelte                      -- login form
        +page.server.ts                   -- login/logout actions
    (app)/
      +layout.svelte                      -- ThemeControl context, AppShell, Header, nav
      +layout.server.ts                   -- requireAuth guard, pass user to layout
      +page.svelte                        -- redirect to ROUTES.SIM_COURSE
      course/
        +page.svelte                      -- course dashboard (stub -- feature 2+)
        +page.server.ts                   -- load modules from published content
      settings/
        +page.svelte                      -- theme toggle, change password form
        +page.server.ts                   -- change password action
```

Route groups keep the auth guard in one place. `(public)/` routes never see `requireAuth`. `(app)/` routes always do.

## Component Design

**Nav bar** (top, persistent):

- Left: FIRC Boss / Sim wordmark
- Center: Course | Progress | Settings
- Right: user name + logout button
- `data-app-id="sim"` already set in `app.html` -- amber accent applies automatically

Use `@firc/ui` components where available. Check UI lib before building new nav components.

**Login page:**

- Centered card layout
- Email + password fields, submit button
- Error message below form (field-level or general)
- No registration link (registration managed by ops/runway)

**Settings page:**

- Theme section: ThemeEditor component (from `@firc/ui`)
- Password section: current + new + confirm fields
- Separate submit buttons per section

## Auth Pattern

```typescript
// hooks.server.ts
import { auth } from "@firc/auth";
export const handle = auth.handler;

// (app)/+layout.server.ts
import { requireAuth } from "@firc/auth";
export const load = async (event) => {
  const user = requireAuth(event); // takes full RequestEvent
  return { user };
};

// (public)/login/+page.server.ts
export const actions = {
  login: async (event) => {
    // delegate to auth lib handler
  },
  logout: async (event) => {
    // clear session, redirect to ROUTES.LOGIN
  },
};
```

`requireAuth` takes a `RequestEvent`, not `locals` directly. See `libs/auth/src/auth.ts`.

## Theme System

> **Note (2026-04-25):** This section described a `glassCockpitTheme` / `aviationTheme` model that has been replaced. The current theme system uses three orthogonal axes (`theme` x `appearance` x `layout`) with route-resolved themes; sim resolves to `sim/glass`. See [docs/platform/theme-system/QUICK_REFERENCE.md](../../../../platform/theme-system/QUICK_REFERENCE.md) and the [shared theme picker](../../../../work-packages/theme-system-overhaul/10-theme-picker-shared-lib/spec.md).

Identical to other apps. The shared `ThemePicker` in `libs/themes/picker/` is mounted in the layout; route resolution via `libs/themes/resolve.ts` selects `sim/glass` as the default theme for sim routes. No per-app theme list needs to be authored.

## Constants Required

Add to `libs/constants/src/routes.ts`:

```typescript
// Sim routes -- SIM_ prefix to avoid collision with other apps
SIM_COURSE:          '/course',
SIM_DISCOVERY:       '/discovery',
SIM_PROGRESS:        '/progress',
SIM_SETTINGS:        '/settings',
SIM_SCENARIO_BRIEF:  (id: string) => `/scenario/${id}/brief` as const,
SIM_SCENARIO:        (id: string) => `/scenario/${id}` as const,
SIM_DEBRIEF:         (id: string) => `/debrief/${id}` as const,
```

Existing bare `COURSE`, `SCENARIO`, `DEBRIEF`, `PROGRESS` constants are app-ambiguous -- they remain for backward compatibility but new sim code uses the `SIM_` variants. Per ADR-010, `id` values for scenarios are slugs (from published content); `id` for debrief is a Tier B `run_` ULID.

## Key Decisions

**Route groups not root guard:** `requireAuth` in a root `+layout.server.ts` would block `/login` and cause an infinite redirect. Route groups are the correct SvelteKit pattern.

**Top nav vs sidebar:** Full-screen immersive scenarios need maximum vertical space. Top nav gives the player maximum room and can be hidden during active scenarios.

**Enrollment check:** `/course` checks for an enrollment record and shows a notice if none exists, but does not block access. Enrollment management is ops' domain.

**No registration in sim:** Learners are created via ops or runway. Sim is a training environment, not a public entry point.
