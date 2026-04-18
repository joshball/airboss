# Runway -- Product Requirements

## Overview

Public-facing site: marketing, course catalog, signup, payment, enrollment. SSR-enabled for SEO.

## Features

| Feature                                           | Status |
| ------------------------------------------------- | ------ |
| App Shell + Auth (hooks, sessions, route groups)  | Done   |
| Login (password + magic link)                     | Done   |
| Registration (self-service, learner role)         | Done   |
| Email verification (Resend, sends on signup)      | Done   |
| Password reset (forgot + reset flow)              | Done   |
| Marketing pages (landing, about, pricing)         | Done   |
| Course catalog (scenarios, modules, detail pages) | Done   |
| Checkout + payment stub (12 mock scenarios)       | Done   |
| Enrollment creation (post-payment)                | Done   |

## User Flows

### Visitor -> Learner

1. Visitor lands on home page (SEO, marketing)
2. Browses catalog (scenarios, modules, detail pages)
3. Views pricing
4. Clicks "Get Started" -> register (with redirect to checkout)
5. Creates account (email/password, learner role)
6. Receives verification email (Resend)
7. Proceeds to checkout
8. Completes payment (stubbed)
9. Enrollment created
10. Redirect to sim

### Returning Learner

1. Visits runway
2. Clicks "Log In" (password or magic link)
3. Authenticates
4. Redirect to sim (if enrolled) or checkout

### Forgot Password

1. Clicks "Forgot your password?" on login page
2. Enters email
3. Receives reset link via Resend
4. Sets new password
5. Auto-signed in, redirected to home

## Dependencies

- Published content from hangar (Phase 1)
- Auth lib with Resend (Phase 0 + Phase 4a)
- UI lib (Phase 0)
- Glass cockpit theme (Phase 0)
