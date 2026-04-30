---
title: 'Spec: Retire /admin/audit-ping'
product: hangar
feature: retire-audit-ping
type: spec
status: draft
review_status: pending
created: 2026-04-30
---

# Spec: Retire `/admin/audit-ping`

Cleanup follow-up to [hangar-audit-explorer](../hangar-audit-explorer/spec.md). The ping route was a scaffold-era heartbeat that proved the auth -> form-action -> audit-write -> audit-read path before any real BC emitted audit rows. Now that `/admin/audit` is the live read surface and the dashboard's System -> Audit tile points at it, the ping route is redundant.

This WP deletes the route, retires the `AUDIT_TARGETS.HANGAR_PING` enum value (or keeps it for a "system heartbeat" role -- decided in this spec), and prunes any stale references.

## Trigger

The first hangar mutation surface (likely [`hangar-users-editing`](../hangar-users-editing/spec.md)) lands and emits its own audit rows -- at that point the ping is no longer the only row in the table on a fresh dev DB and its diagnostic role is over.

## In scope

| #  | Item                                                                                                                            |
| -- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1  | Delete `apps/hangar/src/routes/(app)/admin/audit-ping/`.                                                                         |
| 2  | Delete `ROUTES.HANGAR_ADMIN_AUDIT_PING` from `libs/constants/src/routes.ts`.                                                     |
| 3  | Decide on `AUDIT_TARGETS.HANGAR_PING`: drop entirely, OR re-purpose as `system.heartbeat` for a future cron-style health-check.   |
| 4  | Remove any inbound link / docs reference (search the repo for `audit-ping` and `HANGAR_PING`).                                   |
| 5  | Drop the corresponding test plan section in [hangar-audit-explorer/test-plan.md] step 6.2 (regression check on the ping route). |

## Out of scope

- Replacing the ping with a real cron-based health-check. If that earns a place, it's its own WP.
- Removing the existing `audit.audit_log` rows already authored by the ping -- they stay in the log per ADR 004 (append-only).

## Decisions to ratify

1. **Drop `AUDIT_TARGETS.HANGAR_PING` vs keep as `system.heartbeat`?** Recommended default: drop. The DB CHECK constraint still permits the existing rows because they already passed at insert time; new rows would fail (good -- no surface still emits them). If a future health-check wants its own target type, it picks a fresh string.

## Acceptance

- `audit-ping` route + tile-link references all removed.
- `bun run check` clean.
- A reference repo grep for `audit-ping` and `HANGAR_PING` returns only this WP, the predecessor WP's archive note, and ADR 004 references where appropriate.
