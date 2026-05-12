---
title: 'Out of Scope: Retire /admin/audit-ping'
product: hangar
feature: retire-audit-ping
type: out-of-scope
status: unread
---

# Out of Scope: Retire /admin/audit-ping

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                                                | Status       | Trigger to revisit                                    |
| ------------------------------------------------------------------- | ------------ | ----------------------------------------------------- |
| Real cron-based health-check to replace the ping                    | Follow-on WP | When an authoring need for a system heartbeat emerges |
| Removing existing `audit.audit_log` rows from the ping              | Rejected     | Never -- per ADR 004 the audit log is append-only     |
| Narrowing the `audit_target` CHECK constraint to drop `hangar.ping` | Deferred     | When deliberate ping-row cleanup is acceptable        |

## Real cron-based health-check to replace the ping

Status: Follow-on WP

What was deferred:
A real cron-driven health-check that periodically emits an audit row
(or similar liveness signal) for system observability.

Why:
The ping route was a scaffold-era diagnostic that proved the
auth -> form-action -> audit-write -> audit-read path before any
real BC emitted audit rows. Its role is over. Replacing it with a
"real" health-check is its own product decision: who reads the
heartbeat, what alerts fire, what cadence. That belongs in its own
WP rather than being smuggled in under "retire the ping."

Trigger to revisit:
When a concrete authoring need for a system heartbeat emerges (e.g.
operations wants per-minute liveness, or an SLA dashboard wants
heartbeat-derived uptime). Until then there is no consumer for the
signal.

Implementation pattern when triggered:
Author a new WP that picks a fresh `audit_target` slug for the
health-check (do not reuse `hangar.ping`; that slug is retired). Wire
the cron via the platform scheduler in `scripts/scheduler/` so it
mirrors the existing scheduled-jobs shape. Surface the heartbeat
read via `/admin/audit` if useful, or a dedicated tile if the cadence
warrants its own view.

References:

- [spec.md](./spec.md) "Out of scope" -> Replacing the ping with a real cron-based health-check
- [spec.md](./spec.md) "Decisions to ratify" / "Shipped" -- enum kept, route deleted
- `scripts/scheduler/README.md`

## Removing existing `audit.audit_log` rows from the ping

Status: Rejected

What was rejected:
Deleting the historical `audit.audit_log` rows authored by the ping
route while it was live.

Why:
Per [ADR 004](../../decisions/004-audit-substrate.md) the audit log
is append-only. Audit rows are evidence; destroying them to tidy up
a retired diagnostic violates the substrate's core invariant. The
rows are harmless: no surface emits new ones, and the existing rows
remain valid evidence of when the ping fired.

References:

- [spec.md](./spec.md) "Out of scope" -> Removing existing rows line
- [ADR 004](../../decisions/004-audit-substrate.md) (audit_log append-only)

## Narrowing the `audit_target` CHECK constraint to drop `hangar.ping`

Status: Deferred

What was deferred:
A migration that rewrites the `audit_target` CHECK constraint on
`audit.audit_log` to omit `'hangar.ping'`.

Why:
The Shipped section of [spec.md](./spec.md) explains the Postgres
detail: `ALTER TABLE ... ADD CONSTRAINT ... CHECK (...)` re-validates
against existing rows by default. Dropping `HANGAR_PING` from the
schema-derived `AUDIT_TARGET_VALUES` would regenerate a CHECK that
doesn't permit `'hangar.ping'`, and the migration would fail against
any DB that has historical ping audit rows. The agreed outcome was
to keep the enum value (so the CHECK still has it) but delete the
route + route constant + inbound docs references. No code emits
`hangar.ping` now -- the type system has the value but no callsite.

Trigger to revisit:
When a deliberate audit-row cleanup is acceptable (e.g. a scheduled
greenfield reset, or a one-off ops pass that accepts historical
ping-row loss to tighten the schema).

Implementation pattern when triggered:
Either (a) accept historical row loss and ship a regular CHECK
migration that re-validates and is allowed to fail/clean rows, or
(b) use `ADD CONSTRAINT ... NOT VALID` semantics to attach the new
CHECK without re-validating existing rows, then drop the older
constraint. Decide explicitly which path the cleanup takes; both
violate ADR 004's "never destroy history" spirit so the decision
deserves its own WP.

References:

- [spec.md](./spec.md) "Shipped (2026-04-30)" section
- [ADR 004](../../decisions/004-audit-substrate.md)
