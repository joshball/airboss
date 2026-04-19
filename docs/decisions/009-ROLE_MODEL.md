---

# 009: Role Model and Registration Policy

Decided 2026-03-27.
Extends: [ADR-007 Auth Topology](007-AUTH_TOPOLOGY.md)

## Context

ADR-007 defined which roles can access which apps. Three gaps remained unresolved at implementation time:

1. `better-auth` configured with `defaultRole: 'user'` -- not a valid ROLES constant. Any self-registrant gets a role that nothing in the codebase recognizes.
2. App-level role enforcement missing -- layout guards check authentication only, not role. A `ROLES.LEARNER` user can navigate to hangar if they know the URL.
3. Registration model undefined -- open or invite-only, per app.
4. Learner lifecycle states (browsing, enrolled, completed) were candidates for role proliferation. Needed a clear model.

## Decisions

### 1. Registration Model

| App          | Registration                   | Role assigned    |
| ------------ | ------------------------------ | ---------------- |
| runway / sim | Self-registration open         | `ROLES.LEARNER`  |
| hangar       | Invite-only, admin-provisioned | `ROLES.AUTHOR`   |
| ops          | Invite-only, admin-provisioned | `ROLES.OPERATOR` |

Self-registration is enabled only for runway/sim -- the learner onboarding path for FIRC participants. Hangar and ops registration is disabled; accounts are created by an admin (via ops app or admin API). `defaultRole` in `createAuth()` is set to `ROLES.LEARNER` so any future re-enabling of registration defaults correctly.

### 2. App-Level Role Enforcement

Each app's root `(app)/+layout.server.ts` enforces a minimum role requirement, not just authentication. A `ROLES.LEARNER` user navigating to `hangar.fircboss.com` receives "not authorized", not a login page (per ADR-007).

Per-action guards (`requireRole()` inside form actions) handle operation-level permissions -- who can create, edit, delete, or publish within an app. These are separate from app-access guards.

| App    | Allowed roles                                                |
| ------ | ------------------------------------------------------------ |
| sim    | `LEARNER`, `OPERATOR`, `ADMIN`                               |
| hangar | `AUTHOR`, `OPERATOR`, `ADMIN`                                |
| ops    | `OPERATOR`, `ADMIN`                                          |
| runway | all authenticated; unauthenticated allowed for public routes |

### 3. Learner Lifecycle -- Enrollment Status, Not Roles

Learner states (registered, enrolled, active, completed, suspended) are enrollment data, not roles. All learner accounts hold `ROLES.LEARNER` for their entire lifecycle. The `enrollment.enrollment.status` column is the source of truth.

| Lifecycle state         | Role      | Enrollment status    |
| ----------------------- | --------- | -------------------- |
| Signed up, not enrolled | `LEARNER` | no enrollment record |
| Enrolled, in progress   | `LEARNER` | `active`             |
| Completed course        | `LEARNER` | `completed`          |
| Suspended               | `LEARNER` | `suspended`          |

UI labels (e.g., "Active Participant", "Graduate") are derived from enrollment status at render time, not stored as role values.

### 4. REVIEWER Role -- Deferred

Read-only access to hangar or ops (FAA auditors, external reviewers) is deferred until a concrete use case exists. When added: a single `REVIEWER` role with per-app read access is preferred over per-app viewer roles (`HANGAR_VIEWER`, `OPS_VIEWER`).

### 5. Banned User Enforcement

`bauth_user.banned` is checked in `hooks.server.ts` after session hydration. Banned users receive a 403; session is not set in `event.locals`. Ban check runs before any route handler.

## Rationale

- **Roles = identity and permission level, not transient state.** Enrollment lifecycle belongs in the enrollment domain. Multiplying roles for lifecycle states creates combinatorial role checking and makes "what can this user do?" hard to answer.
- **App-level guards at layout level** are simpler than duplicating role checks in every action. Actions handle operation-level permissions; layouts handle app-access.
- **Invite-only for hangar/ops** matches the platform model: a small controlled team authors content; operators manage enrollments. These are not public-facing roles.
- **Self-registration for sim/runway** is the expected path for FIRC participants. Flight instructors should be able to sign up and enroll without admin intervention.
- **Deferred REVIEWER role** -- don't build for hypothetical access patterns. Add it when someone actually needs it.
