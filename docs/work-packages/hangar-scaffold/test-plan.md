---
title: 'Test plan: Hangar scaffold'
product: hangar
feature: hangar-scaffold
type: test-plan
status: unread
review_status: pending
---

# Test plan: Hangar scaffold

Manual-only. The scaffold has no product features to exercise; the point is to prove the plumbing works so later WPs can land real features on top.

## Prerequisites

- `/etc/hosts` entry: `127.0.0.1 hangar.airboss.test` (run `bun run setup` to surface the missing line if unsure)
- DB running: `bun run db up`
- Dev users seeded: `bun run setup` (idempotent)

## Happy path

1. `bun run dev hangar` -- vite boots on port 9620, prints `https://hangar.airboss.test`
2. Visit `https://hangar.airboss.test/` -- redirect to `/login?redirectTo=%2F`
3. Sign in with the `author@` dev account (the dev-account button pre-fills the form)
4. Expect: redirect to `/` and the Hangar home page renders with your name/role in the top-right
5. Click **Record a test audit event**
6. Expect: success banner appears; the page's audit table does NOT yet show the row (the form action returns without invalidating the load)
7. Reload the page
8. Expect: a new row in the audit table with your user id in the Actor column, `action` op, `hangar.ping` target, timestamp within the last few seconds

## Auth paths

| Scenario                                 | Expected                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------ |
| Visit `/` while signed out               | 302 to `/login?redirectTo=%2F`                                                       |
| Sign in from `/login?redirectTo=%2F`     | 303 back to `/`                                                                      |
| Sign in with bad password                | Stay on `/login`, red banner "Invalid email or password", form preserves email       |
| Sign in as the `learner@` dev account    | Login succeeds; `/` returns 403 "Forbidden" (role gate rejects LEARNER)              |
| POST to `/logout`                        | Session cleared; 303 to `/login`                                                     |
| GET to `/logout` while signed in         | 302 to `/login`                                                                      |
| GET `/login` while signed in             | 302 to `/`                                                                           |

## Multi-spawn smoke

1. `bun run dev` (no app argument)
2. Expect: study, sim, and hangar all boot; their three `https://...airboss.test` URLs print at startup
3. Visit each host in a fresh tab -- all three render their home pages
4. Sign in on study; expect hangar shows you as signed in too (cross-subdomain cookie on `.airboss.test`)

## Non-happy paths

| Scenario                                                | Expected                                                 |
| ------------------------------------------------------- | -------------------------------------------------------- |
| Stop the DB container, reload `/`                       | `load` fails; handleError logs it; error page renders   |
| Tamper with the `redirectTo` query (`//evil.com`)        | Login ignores it and lands on `/` instead                |
| Submit form with an empty email                         | 400 "Email and password are required", form re-renders   |

## Automated checks

- `bun run check` -- must be green before any fix is considered landed
- `bunx biome check .` -- no formatting or lint errors

## Definition of done

- [x] `bun run check` clean for my changes (svelte-check, biome)
- [ ] User tests the happy path manually
- [ ] User tests at least one of each auth path
- [ ] User confirms multi-spawn works with all three apps
