---
title: User Management -- User Stories
product: ops
feature: user-management
type: user-stories
status: done
---

# User Management -- User Stories

## UM-1: List all users

**As** an operator,
**I want to** see all platform users in a searchable, filterable table,
**So that** I can quickly find specific accounts.

**Acceptance:**

- Table columns: name, email, role, status (active/banned), created date
- Search by name or email (substring match)
- Filter by role (multi-select: learner, author, operator, admin)
- Filter by status (active, banned, all)
- Paginated (25 per page)
- Clicking a row navigates to `/users/[id]`

---

## UM-2: View user detail

**As** an operator,
**I want to** see a user's full profile, status, and recent activity,
**So that** I can investigate issues or verify account state.

**Acceptance:**

- Profile: name, email, role badge, created date, email verified status
- Status: active or banned (with reason and expiration if banned)
- Activity log: last 50 audit entries for this user (from `audit.action_log`)
- Activity entries show: action, who performed it, timestamp, details
- Back link to user list

---

## UM-3: Invite a new user

**As** an admin,
**I want to** invite a user by email with a pre-assigned role,
**So that** operators and authors get accounts without self-registering.

**Acceptance:**

- Form fields: email, role (dropdown: author, operator, admin -- not learner, learners self-register)
- Validation: valid email, not already registered, valid role
- On submit: account created via better-auth admin API, invitation email sent
- Success: redirects to user list with success toast
- Error: inline validation errors (duplicate email, invalid format)
- Audit logged: `user.invite`

---

## UM-4: Change a user's role

**As** an admin,
**I want to** change a user's role,
**So that** I can promote or demote users as responsibilities change.

**Acceptance:**

- Role dropdown on user detail page, pre-filled with current role
- All 4 roles available: learner, author, operator, admin
- Cannot change own role (prevents admin lockout)
- Confirm dialog before applying
- Audit logged: `user.role.change` with before/after and reason

---

## UM-5: Ban a user

**As** an admin,
**I want to** ban a user with a reason,
**So that** I can immediately block access for policy violations.

**Acceptance:**

- Ban button on user detail page (only for non-banned users)
- Form: reason (required, min 10 chars), expiration date (optional)
- Ban is immediate -- user's next request is rejected by `hooks.server.ts`
- Cannot ban yourself
- Audit logged: `user.ban`

---

## UM-6: Unban a user

**As** an admin,
**I want to** unban a previously banned user,
**So that** I can restore access after issues are resolved.

**Acceptance:**

- Unban button on user detail page (only for banned users)
- Confirm dialog with the original ban reason displayed
- Audit logged: `user.unban`

---

## UM-7: View user activity log

**As** an operator,
**I want to** see a user's audit trail,
**So that** I can investigate compliance or support issues.

**Acceptance:**

- Embedded in user detail page (below profile/status)
- Shows actions where `entityId` matches the user
- Columns: timestamp, action, performed by, details summary
- Sorted newest first
- Limited to 50 entries with "load more" option
