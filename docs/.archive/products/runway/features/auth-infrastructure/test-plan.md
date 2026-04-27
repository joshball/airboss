---
title: "Test Plan: auth-infrastructure"
product: runway
feature: auth-infrastructure
type: test-plan
status: done
---

# Test Plan: auth-infrastructure

## Setup

- Dev server running (`bun dev` in runway)
- Database seeded with dev accounts (`DEV_ACCOUNTS` from `@firc/constants`)
- Resend configured (or check server logs for magic link / reset URLs in dev)

---

## AUTH-001: Password login (happy path)

1. Navigate to `/login`
2. Enter valid dev account email and `DEV_PASSWORD`
3. Click "Sign In"
4. **Expected:** Redirect to `/`, session cookie set, user data in locals

## AUTH-002: Password login (bad credentials)

1. Navigate to `/login`
2. Enter valid email, wrong password
3. Click "Sign In"
4. **Expected:** Error alert "Invalid email or password", email field preserved

## AUTH-003: Magic link login

1. Navigate to `/login`, click "Or sign in with a magic link"
2. Enter valid email, click "Send Magic Link"
3. **Expected:** Success alert about checking email; no error regardless of email existence

## AUTH-004: Register (happy path)

1. Navigate to `/register`
2. Fill name, email, password, confirm password
3. Click "Create Account"
4. **Expected:** Account created, redirect to `/`, session cookie set

## AUTH-005: Register (password mismatch)

1. Navigate to `/register`
2. Enter mismatched password and confirmPassword
3. Submit
4. **Expected:** Error "Passwords do not match", name and email preserved

## AUTH-006: Register (short password)

1. Enter password shorter than `MIN_PASSWORD_LENGTH`
2. Submit
3. **Expected:** Error about minimum password length

## AUTH-007: Forgot password

1. Navigate to `/forgot-password`
2. Enter any email, submit
3. **Expected:** Success message shown regardless of whether account exists

## AUTH-008: Reset password (happy path)

1. Trigger forgot-password flow, obtain reset URL with token
2. Navigate to `/reset-password?token=<token>`
3. Enter new password + confirmation, submit
4. **Expected:** Password updated, redirect to `/`, session cookie set

## AUTH-009: Reset password (missing token)

1. Navigate to `/reset-password` with no `token` param
2. **Expected:** Redirect to `/forgot-password`

## AUTH-010: Banned user blocked

1. Ban a user in the database
2. Attempt any non-auth request while authenticated as that user
3. **Expected:** 403 "Account suspended"

## AUTH-011: Authenticated user redirects

1. Log in successfully
2. Navigate to `/login`, `/register`, `/forgot-password`
3. **Expected:** Each redirects to `/`

## AUTH-012: Open redirect prevention

1. Navigate to `/login?redirectTo=https://evil.com`
2. Log in successfully
3. **Expected:** Redirect to `/`, not to the external URL

## AUTH-013: Dev login panel

1. With `dev` mode active, navigate to `/login`
2. **Expected:** Dev account panel visible with clickable accounts that fill credentials
