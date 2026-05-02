-- Audit target-type allowlist refresh for auth events (chunk-3 review convergent
-- finding "no audit emission on auth events").
--
-- Adds three target_type values to the `audit.audit_log` CHECK constraint:
--
--   auth.login          -- successful sign-in via better-auth
--   auth.login-failed   -- bad-credentials / rate-limited / banned-block / 5xx
--   auth.logout         -- explicit sign-out
--
-- The constraint is regenerated from `AUDIT_TARGET_VALUES` (libs/constants/src/audit.ts);
-- this migration mirrors that set on the database side. Append-only audit rows
-- keep migrating cleanly because the new IN-list is a superset of the old one.

ALTER TABLE "audit"."audit_log" DROP CONSTRAINT "audit_log_target_type_check";--> statement-breakpoint
ALTER TABLE "audit"."audit_log" ADD CONSTRAINT "audit_log_target_type_check" CHECK ("target_type" IN ('hangar.ping', 'hangar.reference', 'hangar.source', 'hangar.sync', 'hangar.job', 'hangar.source.edition-resolved', 'hangar.source.edition-drift', 'hangar.source.thumbnail-generated', 'hangar.user', 'auth.login', 'auth.login-failed', 'auth.logout'));
