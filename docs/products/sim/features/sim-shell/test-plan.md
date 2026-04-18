---
title: "Test Plan: Sim App Shell"
product: sim
feature: sim-shell
type: test-plan
status: done
---

# Test Plan: Sim App Shell

## Setup

```bash
bun scripts/dev.ts sim   # localhost:7600
```

Dev user: `joshua@ball.dev` / `Pa33word!`

---

## AUTH-1: Unauthenticated redirect

1. Open a fresh browser (no session)
2. Navigate to `localhost:7600/course`
3. **Expected:** Redirect to `/login`

## AUTH-2: Login -- valid credentials

1. On `/login`, enter `joshua@ball.dev` and `Pa33word!`
2. Click Sign In
3. **Expected:** Redirect to `/course`
4. **Expected:** Nav shows user name (or email)

## AUTH-3: Login -- invalid credentials

1. On `/login`, enter `wrong@example.com` and `badpassword`
2. Click Sign In
3. **Expected:** Stay on `/login`, error message shown
4. **Expected:** No redirect

## AUTH-4: Already logged in

1. While logged in, navigate to `localhost:7600/login`
2. **Expected:** Redirect to `/course` (not shown login form again)

## AUTH-5: Logout

1. While logged in, click Logout in nav
2. **Expected:** Redirect to `/login`
3. Navigate back to `/course`
4. **Expected:** Redirected to `/login` (session cleared)

## AUTH-6: Session persistence

1. Log in
2. Close and reopen the browser tab
3. Navigate to `/course`
4. **Expected:** Still logged in (no redirect to `/login`)

---

## NAV-1: Navigation links

1. Log in
2. Click **Course** in nav -> expected: `/course`
3. Click **Progress** in nav -> expected: `/progress`
4. Click **Settings** in nav -> expected: `/settings`

## NAV-2: Active link highlight

1. On `/course`, nav Course item should be highlighted/active
2. On `/settings`, nav Settings item should be highlighted/active

## NAV-3: User display

1. Log in as `joshua@ball.dev`
2. **Expected:** Nav shows "Joshua" or "joshua" (name or email prefix, not raw ID)

---

## THEME-1: Dark mode toggle

1. On `/settings`, toggle to Dark mode
2. **Expected:** Page switches to dark theme immediately
3. Refresh the page
4. **Expected:** Dark mode still active

## THEME-2: Light mode toggle

1. From dark mode, toggle to Light mode
2. **Expected:** Page switches to light theme
3. Refresh
4. **Expected:** Light mode still active

---

## SETTINGS-1: Change password -- wrong current password

1. On `/settings`, enter wrong current password, a new password, confirm it
2. Submit
3. **Expected:** Error shown, password not changed

## SETTINGS-2: Change password -- mismatch

1. On `/settings`, enter correct current password, new password, and a different confirm
2. Submit
3. **Expected:** Error "Passwords do not match"

## SETTINGS-3: Change password -- success

1. On `/settings`, enter correct current password and matching new/confirm
2. Submit
3. Log out
4. Log in with new password
5. **Expected:** Login succeeds
