---
title: "Spec: auth-infrastructure"
product: runway
feature: auth-infrastructure
type: spec
status: done
---

# Spec: auth-infrastructure

Server-side session resolution via Better Auth, typed `App.Locals`, and a complete set of public auth pages (login, register, forgot-password, reset-password) with magic link support.

## Data Model

No data model changes. Auth tables are owned by `@firc/auth` (Better Auth). Runway consumes the auth API and stores session/user in `App.Locals`.

## Behavior

### Session Resolution (hooks.server.ts)

- Every request passes through the handle hook
- Requests to `/api/auth/*` are forwarded directly to `auth.handler()`
- All other requests resolve the session via `auth.api.getSession()` and populate `event.locals.session` and `event.locals.user`
- Banned users receive a `403` response for all non-auth routes
- Request timing is logged with userId

### Login

- Two modes: password and magic link, toggled in the UI
- Password mode: validates email + password, calls Better Auth `sign-in/email`, forwards auth cookies, redirects to `redirectTo` param or `HOME`
- Magic link mode: calls Better Auth `sign-in/magic-link`, always returns success (prevents email enumeration)
- Authenticated users are redirected to `HOME`

### Register

- Collects name, email, password, confirmPassword
- Validates all fields present, passwords match, password meets `MIN_PASSWORD_LENGTH`
- Calls Better Auth `sign-up/email`, forwards cookies, redirects
- Authenticated users are redirected to `HOME`

### Forgot Password

- Collects email, calls Better Auth `forget-password` with `redirectTo: RESET_PASSWORD`
- Always shows success message (prevents email enumeration)

### Reset Password

- Reads `token` from URL query param; redirects to forgot-password if missing
- Validates new password + confirmation match and meet length requirement
- Calls Better Auth `reset-password` with token, forwards cookies, redirects to `HOME`

## Validation

| Field           | Rule                                                        |
| --------------- | ----------------------------------------------------------- |
| email           | Required, must be string                                    |
| password        | Required, `>= MIN_PASSWORD_LENGTH` characters               |
| confirmPassword | Must match password                                         |
| name (register) | Required, must be string                                    |
| token (reset)   | Required from URL, forwarded to auth API                    |
| redirectTo      | Must start with `/` and not `//` (open redirect prevention) |

## Edge Cases

- Banned user hits any non-auth route -- 403 response, logged as warning
- Invalid `redirectTo` param (absolute URL, protocol-relative) -- falls back to `HOME`
- Missing reset token in URL -- redirect to forgot-password page
- Expired reset token -- auth API returns error, displayed to user
- Magic link / forgot-password for nonexistent email -- silent success (no enumeration)

## Out of Scope

- Email verification enforcement (flag exists but not flipped)
- Social auth (Google)
- Rate limiting
- CAPTCHA
