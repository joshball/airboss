---
feature: auth-identity-audit
category: schema
date: 2026-05-01
branch: main
status: unread
review_status: done
counts:
  critical: 2
  major: 4
  minor: 3
  nit: 2
---

## Status as of 2026-05-04

Walked every finding against current main. 9 of 11 closed; 2 carried (low-impact mechanical).

| Severity | Finding                                                    | Verdict                                                                                       |
| -------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| CRITICAL | `bauth_session.user_id` not indexed                        | CLOSED -- `bauth_session_user_idx` in libs/auth/src/schema.ts:56                              |
| CRITICAL | `bauth_session.expires_at` not indexed                     | CLOSED -- `bauth_session_expires_at_idx` in libs/auth/src/schema.ts:59                        |
| MAJOR    | `bauth_account.user_id` unindexed FK                       | CLOSED -- `bauth_account_user_idx` + `bauth_account_provider_account_idx` (schema.ts:86-87)   |
| MAJOR    | `bauth_verification.identifier` no lookup index            | CLOSED -- `bauth_verification_identifier_idx` in schema.ts:104                                |
| MAJOR    | `audit_log.timestamp` standalone scans uncovered           | CLOSED -- `audit_log_timestamp_idx` in audit/schema.ts:80                                     |
| MAJOR    | `bauth_session.impersonated_by` is free text, no FK        | CLOSED -- `references(() => bauthUser.id, { onDelete: 'set null' })` at schema.ts:49          |
| MINOR    | `bauth_user.role` has no check / FK                        | STILL OPEN -- carried below; better-auth manages writes to that column                        |
| MINOR    | `bauth_*` tables sit in public, mixed with future identity | CLOSED -- `SCHEMAS.IDENTITY` documented + reserved (libs/constants/src/schemas.ts:38-46)      |
| MINOR    | `bauthRateLimit` lacks created_at / sweep-friendly column  | CLOSED -- comment block at libs/auth/src/schema.ts:108-127 documents the better-auth contract |
| NIT      | `auditColumns()` returns only `*_by` not `*_at`            | STILL OPEN -- carried below; helper has no live call sites yet                                |
| NIT      | `metadata` jsonb default is `{}` literal                   | CLOSED -- `default(sql\`'{}'::jsonb\`)` in audit/schema.ts:72                                 |

### Carried-forward design items

- **`bauth_user.role` check / FK**: better-auth manages writes to that column via `admin` plugin; the JS-side `parseRole()` collapses unknown values at the hook boundary so downstream `requireRole` fails closed. Adding a DB CHECK requires coordinating with better-auth's seed flow (which may insert before the constants land). Trigger: when the role set stops changing (post-FIRC merge, ADR 009 follow-up).
- **`auditColumns` rename / API shape**: dormant -- helper has no live call sites today. Trigger: when the first BC adopts `auditColumns()`. Move + rename + add `*_at` in the same pass.

## Summary

Reviewed `libs/auth/src/schema.ts`, `libs/auth/src/columns.ts`, and `libs/audit/src/schema.ts` against the rubric for namespacing, IDs, FKs, indexing, audit-column hygiene, and auth-specific concerns (session token lookup, expiry-driven cleanup, user-by-email lookup, audit query patterns).

The audit schema is solid: namespaced under `audit`, append-only via `auditWrite`, snapshot columns sized correctly, op + target_type checks gated by constants, two compound indexes. The `bauth_*` mirror is structurally fine for read-only Drizzle access but the deployed migration is missing several indexes that better-auth's own query patterns require, plus we have orphan FK targets and a query path (`countAuditEntriesSince`) with no covering index. Two critical findings -- the missing `bauth_session.user_id` index (every session lookup that filters by user is a seq scan) and the missing `bauth_session.expires_at` index (better-auth's session-cleanup job seq-scans on every tick). Three majors around the missing `bauth_account.user_id` FK index, the missing `bauth_verification.identifier` lookup index, and the `audit_log.timestamp` query that `countAuditEntriesSince` issues with no usable index. The rest are convention/style items.

The sessions table also tracks `impersonated_by` as a free `text` column with no FK back to `bauth_user`, which means a deleted impersonator leaves dangling rows. Minor but worth tightening since the rest of the schema enforces this.

ADRs referenced: 004 (namespaces), 007 (auth topology), 010 (ID strategy).

## Issues

### CRITICAL: `bauth_session.user_id` is not indexed

Table: `public.bauth_session`
Column: `user_id`
Problem: Every "list sessions for a user" / "revoke sessions for user X" / "is this user logged in anywhere?" query that better-auth issues filters on `user_id`. `bauth_session.user_id` is a NOT NULL FK to `bauth_user.id` but the FK gets no implicit index in PostgreSQL, and `drizzle/0000_initial.sql` declares no `CREATE INDEX` on it. As the session table grows (one row per active login per device per user, never aggressively pruned) every revoke/list becomes a seq scan, and the cascade behavior of the FK itself does a seq scan on every user delete or update.
Rule: FK columns must be indexed; session lookup paths used by auth middleware must be covered.
Fix: Add `index('bauth_session_user_idx').on(t.userId)` (or `(t.userId, t.expiresAt)` to also cover "active sessions for user") in `libs/auth/src/schema.ts` and emit a follow-up migration. Same shape as the `auditActorIdx` already in `libs/audit/src/schema.ts`.

### CRITICAL: `bauth_session.expires_at` is not indexed

Table: `public.bauth_session`
Column: `expires_at`
Problem: Better-auth's session sweeper runs `DELETE FROM bauth_session WHERE expires_at < now()` on a schedule. With no index on `expires_at`, the sweeper is a full table scan and -- worse -- the scan competes with live session-token lookups. The schema review checklist calls out "expiry indexed for cleanup queries" specifically; this is the exact missing index.
Rule: Session expiry column must be indexed for cleanup queries.
Fix: Add `index('bauth_session_expires_idx').on(t.expiresAt)` in `libs/auth/src/schema.ts`. If we want both "active sessions for user" and "expired sessions to sweep" covered, a single composite `(t.userId, t.expiresAt)` plus a lone `(t.expiresAt)` is the right pair.

### MAJOR: `bauth_account.user_id` is an unindexed FK

Table: `public.bauth_account`
Column: `user_id`
Problem: Same shape as the session issue. `bauth_account.user_id` is NOT NULL with FK to `bauth_user.id`, no index. Every "find accounts for user" -- which better-auth runs on every login (to resolve the credential row from the user) -- seq-scans `bauth_account`. Lower impact than session because the table is smaller, but the auth login critical path is the worst place to leave a seq scan.
Rule: All FK columns must be indexed.
Fix: Add `index('bauth_account_user_idx').on(t.userId)`. Consider `(t.userId, t.providerId)` if better-auth's lookup typically scopes by provider as well.

### MAJOR: `bauth_verification.identifier` has no lookup index

Table: `public.bauth_verification`
Column: `identifier`
Problem: Better-auth queries `bauth_verification` by `identifier` for every email-verification link click, magic-link click, and password-reset link click. The schema declares `identifier` as plain `text` with no index and no unique constraint. Volume is low today but every auth email flow touches this table; the cost is a seq scan at exactly the moment a user is trying to confirm an email.
Rule: Lookup columns on the auth critical path must be indexed.
Fix: Add `index('bauth_verification_identifier_idx').on(t.identifier, t.expiresAt)` (composite so the same index serves "look up active verification for identifier X" and the cleanup sweeper that prunes expired verifications). Mirrors the session pair above.

### MAJOR: `audit_log.timestamp` standalone scans have no covering index

Table: `audit.audit_log`
Column: `timestamp`
Problem: `countAuditEntriesSince(since)` in `libs/audit/src/log.ts` runs `SELECT count(*) FROM audit_log WHERE timestamp >= $1` with no actor or target filter. The two existing indexes (`audit_log_actor_idx` on `(actor_id, timestamp)`, `audit_log_target_idx` on `(target_type, target_id, timestamp)`) cannot serve this query because `timestamp` is the trailing column. As the audit log grows -- and it grows monotonically by design -- the hangar admin home's "recent activity" tile becomes the slowest query in the app.
Rule: Audit log query patterns must be indexed (by user, by entity, by time).
Fix: Add `index('audit_log_timestamp_idx').on(t.timestamp)` (descending order also fine via `.desc()` since most reads order by `desc(timestamp)`). One BRIN index on `timestamp` would also work and is cheaper to maintain on append-only tables, but a btree is fine at our scale.

### MAJOR: `bauth_session.impersonated_by` is a free `text` field with no FK

Table: `public.bauth_session`
Column: `impersonated_by`
Problem: When an admin impersonates a user, better-auth records the admin's user id here. The column is plain `text`. If that admin is later deleted, the impersonation trail in `bauth_session` becomes a dangling string id with no enforced relationship -- the rest of the codebase (`auditColumns()`, `auditLog.actorId`) consistently uses real FKs with `onDelete: 'set null'` for exactly this case. Inconsistent with the schema's own audit-trail discipline and forfeits the "what admin opened this session" lookup integrity.
Rule: Any column that holds a user id must FK to `bauth_user.id` with an explicit ondelete behavior.
Fix: Either add `.references(() => bauthUser.id, { onDelete: 'set null', onUpdate: 'cascade' })` to the column, or document explicitly (in the schema comment) that better-auth manages this column outside our FK graph and we accept the dangling-id risk. If better-auth refuses to write the FK constraint via its adapter, attach the constraint in a hand-rolled migration after the table is created.

### MINOR: `bauth_user.role` has no check or FK to a roles table

Table: `public.bauth_user`
Column: `role`
Problem: `role` is plain nullable `text`. ADR 009 (Role Model) defines a fixed set of roles -- this column accepts anything. The rest of the schema gates enum-shaped text via `check(... IN (...))` constraints (see `auditLog.op`, `auditLog.targetType`, every `study.session_*_check` in `0000_initial.sql`). Inconsistent and lets a typo or a stray role string land in production.
Rule: Enum-like text columns should have a check constraint sourced from a constants module.
Fix: Add a `ROLES` constant + `ROLE_VALUES` array to `libs/constants/src/roles.ts` (the `ROLES` constant is already imported by `server.ts`, so the values exist somewhere) and wire a `check('bauth_user_role_check', sql.raw(\`"role" IN (${inList(ROLE_VALUES)}) OR "role" IS NULL\`))`. Same `inList` helper as `audit/src/schema.ts`.

### MINOR: `bauth_*` tables sit in `public`, mixed with future identity tables

Table: `public.bauth_user`, `public.bauth_session`, `public.bauth_account`, `public.bauth_verification`
Column: --
Problem: Per ADR 004, identity-adjacent tables should land in the `identity` schema. Better-auth's adapter doesn't support PostgreSQL schemas (acknowledged in the schema header comment) so the `bauth_*` tables stay in `public` -- but `SCHEMAS.IDENTITY` is reserved and unused. The schema comment says "we keep identity-adjacent custom tables (user preferences, roles mappings, etc.) in this namespace as they land" -- this is correct, but as nothing has landed yet there's a real risk that the next time someone needs a `user_preference` table they'll drop it next to `bauth_user` in `public` for symmetry. Worth a louder warning.
Rule: Schema namespacing is per ADR 004; identity-related tables that we own go under `identity`.
Fix: Either add a comment block at the top of `libs/auth/src/schema.ts` that explicitly says "any non-better-auth identity table goes under `auditSchema`/`identitySchema`, never alongside `bauth_*` in public", or actually create the `identitySchema = pgSchema(SCHEMAS.IDENTITY)` declaration here so future tables hang off it without re-discovering the rule. Prefer the latter.

### MINOR: `bauthRateLimit` is missing `created_at` / no expiry-friendly column

Table: `public.bauth_rate_limit`
Column: --
Problem: Every other bauth table has `created_at` + `updated_at`. `bauth_rate_limit` has neither. `last_request` (a `bigint` ms timestamp) is the only temporal column, and it's the one better-auth itself reads/writes. If a future migration wants to "drop rate-limit rows older than X" the only signal is `last_request` (a millisecond bigint, not a Postgres timestamp), which precludes a normal `index ... where last_request < now()` cleanup pattern.
Rule: Audit-style timestamp columns are project default; deviating needs comment.
Fix: Either add a real Postgres `timestamp` column for sweep predicate use, or add a comment in the schema explaining that `last_request` (epoch ms) is the canonical sweep column and pointing at the better-auth field-name constraint that prevents using a normal timestamp. The comment block already explains the JS-property rationale; one more sentence about cleanup completes the story.

### NIT: `auditColumns()` returns `{ createdBy, updatedBy }` but no `createdAt`/`updatedAt`

Table: any consumer of `auditColumns()`
Column: --
Problem: The helper name implies a complete audit-column set but only returns the `*_by` actor pair. Callers that want `createdAt`/`updatedAt` (which is everyone, given the project default) have to declare them separately -- and they do, all over `libs/bc/study/src/schema.ts` and `libs/db/src/hangar.ts`. Either the helper should also emit `createdAt: timestamp(...).defaultNow()` + `updatedAt: timestamp(...).defaultNow()` to match the naming, or it should be renamed `actorColumns()` to make clear it only handles the FK pair.
Rule: Helpers should match their name; partial helpers invite duplication and drift.
Fix: Rename the helper to `actorColumns()` and update the four callers (grep for `auditColumns(` in the repo). Or keep the name and absorb the timestamps -- the comment block hints at this evolution already. Either is fine; pick one and converge.

### NIT: `metadata` jsonb default is `{}` literal rather than `sql\`'{}'::jsonb\``

Table: `audit.audit_log`
Column: `metadata`
Problem: `jsonb('metadata').$type<Record<string, unknown>>().notNull().default({})` -- Drizzle converts the `{}` to `'{}'::jsonb` correctly today, but the rest of the codebase that uses jsonb defaults uses `sql\`'{}'::jsonb\`` (or similar) to make the cast explicit and stable across Drizzle versions. Cosmetic; behavior is identical today.
Rule: Project convention -- explicit jsonb defaults via `sql\`...\``.
Fix: Switch to `default(sql\`'{}'::jsonb\`)` for parity with `libs/bc/study/src/schema.ts` patterns. Pure cosmetic; do it on the next touch of the file.
