---
status: deferred
trigger: before public/non-allowlisted signups are enabled, OR if observed brute-force traffic
source: 2026-04-27 security review
---

# Application-level rate limit on auth surfaces

## Problem

`@ab/auth/createAuth(...)` does not pass a `rateLimit` config. Better-auth's memory-backed default resets per process and is bypassable behind a multi-instance deploy. The `/login` SvelteKit form action constructs a synthetic Request with `localhost` origin/IP, which would bucket every real user into one rate-limit slot. No per-account lockout for repeated bad-password attempts. No rate limit on magic-link or password-reset triggers either.

## Scope

1. Pass `auth.api.signInEmail({ body, headers: request.headers })` instead of constructing a synthetic Request -- preserves the real client IP for better-auth's own rate limiter.
2. Configure `rateLimit: { enabled: true, storage: 'database', window: 60, max: 30 }` (or equivalent) in `createAuth` so the limit is shared across instances and persisted.
3. Add an account-level lockout policy on signInEmail: track consecutive failures per (hashed email) and 429 after N.
4. Mirror the rate limit on magic-link and password-reset endpoints.

## Trigger

- Before opening signups beyond the current invite/dev-seed circle.
- OR observed: brute-force traffic on the login surface.

## References

- 2026-04-22 review flagged the synthetic-Request issue; this WP supersedes that finding with the broader rate-limit story.
