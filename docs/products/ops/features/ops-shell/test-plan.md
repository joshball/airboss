---
title: "Test Plan: Ops App Shell"
product: ops
feature: ops-shell
type: test-plan
status: done
---

# Test Plan: Ops App Shell

## Setup

```bash
bun scripts/dev.ts ops   # localhost:7620
```

Dev user (operator): `joshua@ball.dev` / `Pa33word!`

---

## AUTH-1: Unauthenticated redirect

1. Open a fresh browser (no session)
2. Navigate to `localhost:7620/`
3. **Expected:** Redirect to `/login`

## AUTH-2: Login -- valid operator credentials

1. On `/login`, enter `joshua@ball.dev` and `Pa33word!`
2. Click Sign In
3. **Expected:** Redirect to `/` (dashboard)
4. **Expected:** Sidebar shows user name and role

## AUTH-3: Login -- invalid credentials

1. On `/login`, enter `wrong@example.com` and `badpassword`
2. Click Sign In
3. **Expected:** Stay on `/login`, error message shown
4. **Expected:** No redirect

## AUTH-4: Already logged in

1. While logged in, navigate to `localhost:7620/login`
2. **Expected:** Redirect to `/` (not shown login form again)

## AUTH-5: Logout

1. While logged in, click Logout in sidebar
2. **Expected:** Redirect to `/login`
3. Navigate back to `/`
4. **Expected:** Redirected to `/login` (session cleared)

## AUTH-6: Session persistence

1. Log in
2. Close and reopen the browser tab
3. Navigate to `/`
4. **Expected:** Still logged in (no redirect to `/login`)

---

## ROLE-1: Unauthorized role -- LEARNER

1. Log in as a user with `ROLES.LEARNER` (create via seed or use sim dev account)
2. Navigate to `localhost:7620/`
3. **Expected:** 403 "Not authorized" (not a redirect to `/login`)

## ROLE-2: Unauthorized role -- AUTHOR

1. Log in as a user with `ROLES.AUTHOR`
2. Navigate to `localhost:7620/`
3. **Expected:** 403 "Not authorized"

## ROLE-3: Banned user

1. Log in, then set `banned = true` on the user in DB
2. Refresh any ops page
3. **Expected:** 403 "Account suspended"

---

## NAV-1: Sidebar navigation links

1. Log in
2. Click each sidebar item in order:
   - **Dashboard** -> expected: `/`
   - **Users** -> expected: `/users`
   - **Enrollments** -> expected: `/enrollments`
   - **Certificates** -> expected: `/certificates`
   - **Records** -> expected: `/records`
   - **Analytics** -> expected: `/analytics`
   - **Settings** -> expected: `/settings`

## NAV-2: Active link highlight

1. On `/`, Dashboard item should be highlighted/active
2. On `/settings`, Settings item should be highlighted/active
3. Navigate between pages -- active state follows correctly

## NAV-3: User display

1. Log in as `joshua@ball.dev`
2. **Expected:** Sidebar shows "Joshua" or "joshua" (name or email prefix)
3. **Expected:** Role badge shows "operator" or "admin"

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

---

## STUB-1: Stub pages render

1. Navigate to `/users`, `/enrollments`, `/certificates`, `/records`, `/analytics`
2. **Expected:** Each shows a heading and description, no errors or broken layouts
