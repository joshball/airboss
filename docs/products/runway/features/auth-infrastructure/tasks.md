---
title: "Tasks: auth-infrastructure"
product: runway
feature: auth-infrastructure
type: tasks
status: done
---

# Tasks: auth-infrastructure

All tasks completed in Phase 4a.

## 1. Typed Locals + Session Resolution

- [x] Define `AuthSession` and `AuthUser` types in `@firc/auth`
- [x] Type `App.Locals` in `app.d.ts` with `session: AuthSession | null` and `user: AuthUser | null`
- [x] Implement `hooks.server.ts` -- forward `/api/auth/*` to auth handler, resolve session on all other requests
- [x] Add banned-user blocking with 403 response
- [x] Add request logging with timing and userId

## 2. Server Auth Helpers

- [x] Create `lib/server/auth.ts` -- lazy-init `createAuth()` with env secret, skip during build
- [x] Create `lib/server/cookies.ts` -- thin wrapper around `@firc/auth` `forwardAuthCookies`
- [x] Add `RUNWAY_*` route constants to `@firc/constants`

## 3. Route Groups

- [x] Create `(public)/` route group with marketing layout (nav + footer)
- [x] Create `(app)/` route group for authenticated pages

## 4. Login Page

- [x] `+page.server.ts` -- load guard (redirect if authenticated), `login` action, `magicLink` action
- [x] `+page.svelte` -- password/magic-link mode toggle, error/success alerts, dev account panel
- [x] Open redirect prevention on `redirectTo` param

## 5. Register Page

- [x] `+page.server.ts` -- load guard, default action with full validation
- [x] `+page.svelte` -- name/email/password/confirm form with loading states

## 6. Forgot Password Page

- [x] `+page.server.ts` -- load guard, default action, silent success pattern
- [x] `+page.svelte` -- email form, success state swap

## 7. Reset Password Page

- [x] `+page.server.ts` -- load guard, token extraction from URL, default action with validation
- [x] `+page.svelte` -- hidden token field, new password + confirm form

## 8. Shared UI Components

- [x] `AuthCard`, `AuthBrand`, `AuthFooterLink`, `FormStack`, `Input`, `PasswordInput`, `Button`, `Alert`, `DevLoginPanel` in `@firc/ui`
