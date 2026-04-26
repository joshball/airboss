---
title: "Design: auth-infrastructure"
product: runway
feature: auth-infrastructure
type: design
status: done
---

# Design: auth-infrastructure

## Better Auth via Internal Requests

Auth actions (login, register, reset) don't call Better Auth's JS API directly. Instead, each form action constructs a `new Request()` to the auth handler's HTTP endpoints (e.g., `sign-in/email`, `sign-up/email`) using `AUTH_INTERNAL_ORIGIN`. This keeps the auth layer decoupled -- the same HTTP contract used externally works identically from server-side form actions.

## API Surface

| Route              | Type                                    | Purpose                                                   |
| ------------------ | --------------------------------------- | --------------------------------------------------------- |
| `/api/auth/*`      | Handler passthrough                     | Better Auth endpoints (hooks.server.ts forwards directly) |
| `/login`           | Page + 2 actions (`login`, `magicLink`) | Password and magic link sign-in                           |
| `/register`        | Page + default action                   | Self-registration with password                           |
| `/forgot-password` | Page + default action                   | Request password reset email                              |
| `/reset-password`  | Page + default action                   | Set new password via token                                |

## Session Resolution

```text
Request -> hooks.server.ts
  |
  +--> /api/auth/* ? -> auth.handler(request) -> Response
  |
  +--> auth.api.getSession(headers)
       -> populate locals.session, locals.user
       -> banned check (403 if banned)
       -> resolve(event)
       -> log timing
```

`App.Locals` uses `AuthSession | null` and `AuthUser | null` from `@firc/auth`. The user object carries `role` (cast to `Role`), `banned`, `emailVerified`, and standard identity fields.

## Lazy Auth Initialization

`lib/server/auth.ts` uses a lazy pattern: `building ? undefined : getAuth()`. This prevents Better Auth from initializing during SvelteKit's build analysis phase, which would fail because environment variables aren't available at build time.

## Cookie Forwarding

Better Auth sets cookies on its `Response` object. Since form actions return data (not responses), `forwardAuthCookies()` extracts `set-cookie` headers from the auth response and applies them to SvelteKit's `Cookies` API. The `dev` flag controls the `Secure` attribute.

## Key Decisions

### Internal HTTP requests vs. direct API calls

- **Options:** Call `auth.api.signInEmail()` directly vs. construct HTTP requests to auth handler
- **Chosen:** HTTP requests via `new Request()`
- **Rationale:** Uniform contract. The auth handler is the single entry point for all auth operations, whether from client-side JS or server-side form actions. Avoids coupling to Better Auth's internal JS API surface.

### Email enumeration prevention

- **Chosen:** Magic link and forgot-password always return success
- **Rationale:** Standard security practice. Login errors use generic "Invalid email or password" (doesn't reveal which is wrong).

### Route groups: (public) vs (app)

- **Chosen:** SvelteKit route groups to separate marketing/auth pages from authenticated app pages
- **Rationale:** Different layouts (marketing nav+footer vs. app shell), different auth requirements. The group boundary makes layout inheritance clean without layout resets.
