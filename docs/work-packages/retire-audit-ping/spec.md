---
id: retire-audit-ping
title: 'Retire /admin/audit-ping'
product: hangar
category: platform
status: in-flight
agent_review_status: done
human_review_status: pending
created: 2026-04-30
owner: user
depends_on: []
unblocks: []
tags: [cleanup, audit]
legacy_fields:
  feature: retire-audit-ping
  type: spec
---

<!-- Shipped in code but pending user walkthrough; transition to `status: shipped` requires user to set `human_review_status: signed-off`. -->

Cleanup follow-up to [hangar-audit-explorer](../hangar-audit-explorer/spec.md). The ping route was a scaffold-era heartbeat that proved the auth -> form-action -> audit-write -> audit-read path before any real BC emitted audit rows. Now that `/admin/audit` is the live read surface and the dashboard's System -> Audit tile points at it, the ping route is redundant.

This WP deletes the route, retires the `AUDIT_TARGETS.HANGAR_PING` enum value (or keeps it for a "system heartbeat" role -- decided in this spec), and prunes any stale references.

## Trigger

The first hangar mutation surface (likely [`hangar-users-editing`](../hangar-users-editing/spec.md)) lands and emits its own audit rows -- at that point the ping is no longer the only row in the table on a fresh dev DB and its diagnostic role is over.

## In scope

| #  | Item                                                                                                                            |
| -- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1  | Delete `apps/hangar/src/routes/(app)/admin/audit-ping/`.                                                                        |
| 2  | Delete `ROUTES.HANGAR_ADMIN_AUDIT_PING` from `libs/constants/src/routes.ts`.                                                    |
| 3  | Decide on `AUDIT_TARGETS.HANGAR_PING`: drop entirely, OR re-purpose as `system.heartbeat` for a future cron-style health-check. |
| 4  | Remove any inbound link / docs reference (search the repo for `audit-ping` and `HANGAR_PING`).                                  |
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

## Shipped (2026-04-30)

Decision (1) ratified with one tightening: **the enum value `AUDIT_TARGETS.HANGAR_PING` stays, the route does not.**

The original recommendation said "drop the enum value, the DB CHECK still permits the existing rows because they already passed at insert time." That last claim is wrong on a Postgres detail: `ALTER TABLE ... ADD CONSTRAINT ... CHECK (...)` re-validates against existing rows by default. Dropping `HANGAR_PING` from the schema-derived `AUDIT_TARGET_VALUES` would regenerate a CHECK that doesn't permit `'hangar.ping'`, and the migration would fail to apply against any DB that has historical ping audit rows.

Per [ADR 004](../../decisions/004-audit-substrate.md) (audit_log is append-only, never destroy history), the safer outcome is to keep the enum value (so the DB CHECK still has it) but delete the route + the route constant + the inbound docs references. No code emits `hangar.ping` now -- the type system has the value but no callsite.

If a future cleanup wants to actually narrow the CHECK, it can ship as a separate WP using `ADD CONSTRAINT ... NOT VALID` semantics, or by accepting historical row loss as a trade-off. Out of scope here.

What landed:

- Deleted `apps/hangar/src/routes/(app)/admin/audit-ping/+page.{server.ts,svelte}`.
- Deleted `ROUTES.HANGAR_ADMIN_AUDIT_PING`.
- Kept `AUDIT_TARGETS.HANGAR_PING` with a "retired -- do not reuse" docstring.
- Updated hangar PRD (removed the route row + the retire-row from "In flight"), ROADMAP (removed the audit-ping mention from "Where we are"), VISION (refreshed the now/next/later table -- people area is `/users` shipped, system area is jobs + audit explorer), platform ROADMAP (replaced the audit-ping line).
- Updated `apps/hangar/src/lib/help/content/audit.ts` to drop the "companion heartbeat" paragraph.
