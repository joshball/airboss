---
title: "User Stories: Auth"
product: hangar
feature: auth
type: user-stories
status: done
---

# User Stories: Auth

Feature: Authentication and access control for hangar.
Status: **Partially implemented** (2026-03-25). AUTH-1 superseded by ADR-009 (invite-only).

## Stories

### AUTH-1: ~~Register a new author account~~ -- SUPERSEDED

Self-registration for hangar is **disabled** per [ADR-009](../../../../../decisions/009-ROLE_MODEL.md). Author accounts are provisioned by an admin. See AUTH-5.

---

### AUTH-2: Log in with existing credentials

**As** a provisioned author,
**I want to** log in with my email and password,
**So that** I can access the hangar authoring tools.

**Acceptance:**

- [ ] Login form accepts email and password
- [ ] Wrong credentials show error, preserves email
- [ ] Successful login redirects to dashboard (or to original URL if redirected from auth guard)
- [ ] Session cookie is set

**Test:**

1. Log out if logged in (POST to `/logout`)
2. Go to `/login`
3. Enter provisioned author credentials
4. Submit
5. Verify: redirected to dashboard, sidebar shows name

---

### AUTH-3: Auth guard protects all content routes

**As** the system,
**I want to** redirect unauthenticated users to login,
**So that** only authenticated users can reach the app shell.

**Acceptance:**

- [ ] Unauthenticated request to any `(app)` route redirects to `/login`
- [ ] `redirectTo` query param preserves the original URL
- [ ] After login, user is sent back to the original URL
- [ ] Login page is accessible without auth

**Test:**

1. Open incognito window
2. Go to `http://localhost:7610/scenarios`
3. Verify: redirected to `/login?redirectTo=%2Fscenarios`
4. Log in
5. Verify: redirected to `/scenarios`, not `/`

---

### AUTH-4: Log out

**As** a logged-in author,
**I want to** log out,
**So that** my session is ended.

**Acceptance:**

- [ ] Logout clears session cookie
- [ ] After logout, redirected to `/login`
- [ ] Subsequent requests to protected routes redirect to login

**Test:**

1. While logged in, POST to `/logout` (or click logout button when available)
2. Verify: redirected to `/login`
3. Go to `/scenarios`
4. Verify: redirected to `/login`

---

### AUTH-5: Admin provisions a new author account

**As** an admin,
**I want to** create an author account for a new team member,
**So that** they can access hangar without self-registration being open.

**Note:** Implementation path TBD -- options are (a) direct DB insert via ops app, (b) better-auth admin API, (c) invite link flow. Spec this when ops app auth management is designed.

---

### AUTH-6: Role guard prevents non-author from accessing hangar

**As** the system,
**I want to** reject users whose role is not `AUTHOR`, `OPERATOR`, or `ADMIN`,
**So that** learners and public users cannot access authoring tools.

**Acceptance:**

- [ ] Authenticated `LEARNER` user navigating to any hangar route receives "not authorized" response, not a login redirect
- [ ] `AUTHOR` user accesses hangar normally
- [ ] Guard runs at root `(app)/+layout.server.ts`, not per-action

**Test:**

1. Create a `LEARNER` account in DB directly
2. Log in with that account
3. Navigate to `http://localhost:7610/scenarios`
4. Verify: 403 or "not authorized" page, not redirected to login
5. Log in as an `AUTHOR` account
6. Navigate to `/scenarios`
7. Verify: access granted
