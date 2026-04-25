---
title: User Management -- Spec
product: ops
feature: user-management
type: spec
status: done
---

# User Management -- Spec

Operators and admins manage all platform user accounts from ops. View, invite, role-assign, ban/unban, and audit-trail lookup. No new tables -- uses existing `bauth_user` and `audit.action_log`.

## Data Model

### bauth_user (existing, read-only Drizzle schema in `@firc/auth`)

| Column        | Type        | Notes                                      |
| ------------- | ----------- | ------------------------------------------ |
| id            | text PK     | better-auth generated                      |
| email         | text unique | Login identifier                           |
| name          | text        | Display name                               |
| emailVerified | boolean     | Email confirmation status                  |
| role          | text        | LEARNER, AUTHOR, OPERATOR, ADMIN           |
| banned        | boolean     | Immediate access block                     |
| banReason     | text        | Operator-provided reason                   |
| banExpires    | timestamp   | Optional auto-unban (nullable = permanent) |
| image         | text        | Avatar URL (nullable)                      |
| createdAt     | timestamp   | Registration date                          |
| updatedAt     | timestamp   | Last profile change                        |

### audit.action_log (existing, in `@firc/audit`)

| Column     | Type      | Notes                                 |
| ---------- | --------- | ------------------------------------- |
| id         | text PK   | ULID                                  |
| userId     | text      | Who performed the action              |
| action     | text      | Action name (e.g. `user.role.change`) |
| entityType | text      | `user`                                |
| entityId   | text      | Target user's ID                      |
| details    | jsonb     | Before/after, reason                  |
| createdAt  | timestamp | When it happened                      |

## Behavior

### User List (`/users`)

- Paginated table: name, email, role, status (active/banned), created date
- Filters: role (multi-select), status (active/banned/all), search (name or email substring)
- Default sort: name ascending
- Clicking a row navigates to user detail

### User Detail (`/users/[id]`)

- Profile section: name, email, role, created date, email verification status
- Status section: banned/active, ban reason if banned, ban expiration if set
- Actions section (role-dependent, see Permissions below)
- Activity log: recent actions from `audit.action_log` where `entityId = user.id`

### Invite User

- Form: email address, role assignment (dropdown)
- Creates account via better-auth admin API (`createUser`)
- Sends invitation email (better-auth handles this)
- Audit log: `user.invite` with inviter ID, invitee email, assigned role

### Change Role

- Dropdown on user detail page, current role pre-selected
- Uses better-auth admin API (`setRole`)
- Audit log: `user.role.change` with before/after values and reason

### Ban / Unban

- Ban: form with required reason, optional expiration date
- Uses better-auth admin API (`banUser` / `unbanUser`)
- Ban is immediate -- `hooks.server.ts` checks `banned` on every request
- Audit log: `user.ban` / `user.unban` with reason

## Permissions

| Action            | Admin | Operator |
| ----------------- | :---: | :------: |
| View user list    |  Yes  |   Yes    |
| View user detail  |  Yes  |   Yes    |
| View activity log |  Yes  |   Yes    |
| Invite user       |  Yes  |    No    |
| Change role       |  Yes  |    No    |
| Ban / unban       |  Yes  |    No    |

Operators have read-only access. Only admins can mutate user accounts.

## Validation

| Field           | Rule                                        |
| --------------- | ------------------------------------------- |
| Invite email    | Valid email format, not already registered  |
| Role assignment | Must be valid `Role` from `@firc/constants` |
| Ban reason      | Required, min 10 characters                 |
| Ban expiration  | Optional, must be future date if provided   |

## Audit Actions

| Action             | entityType | Details                             |
| ------------------ | ---------- | ----------------------------------- |
| `user.invite`      | `user`     | `{ email, role, invitedBy }`        |
| `user.role.change` | `user`     | `{ previousRole, newRole, reason }` |
| `user.ban`         | `user`     | `{ reason, expires }`               |
| `user.unban`       | `user`     | `{ previousBanReason }`             |

## Dependencies

- `@firc/auth` -- `authClient.admin` for listUsers, setRole, banUser, unbanUser, createUser
- `@firc/audit` -- `logAction` for write, `queryLog` for read
- `@firc/constants` -- `ROLES`, `ROUTES` (new ops routes needed)
- `@firc/ui` -- DataTable, form components, ConfirmDialog
- Depends on: ops-shell (feature #1 must be complete first)
