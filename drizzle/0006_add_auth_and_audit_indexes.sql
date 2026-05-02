-- Auth + audit hot-path indexes (chunk-3 review criticals 3+4 plus convergent perf majors)
--
-- bauth_session: ban-by-user, list-sessions, revoke-all-for-user, and
-- better-auth's session sweeper all hit unindexed columns -- every operation
-- seq-scans the session table. Add (user_id) and (expires_at).
--
-- bauth_account: every email/password sign-in resolves the account row via
-- (user_id) for hash lookup. Provider-scoped lookups (link-account, OAuth)
-- hit (provider_id, account_id). Both unindexed today.
--
-- bauth_verification: every email-verification, magic-link, and password-reset
-- click resolves the token row via (identifier). Unindexed today.
--
-- audit_log: countAuditEntriesSince filters on (timestamp) but the existing
-- composites have timestamp as the trailing column. auditRecent without a
-- targetId orders by (timestamp DESC) after a (target_type) equality, but the
-- existing (target_type, target_id, timestamp) composite can't serve that
-- cleanly because target_id separates the equality column from the sort
-- column. Add (timestamp) standalone and (target_type, timestamp).
--
-- bauth_session.impersonated_by: previously plain text with no FK back to
-- bauth_user. Add the FK with ON DELETE SET NULL so deleting the impersonator
-- doesn't cascade-kill the target session, but a dangling string is not
-- possible.

ALTER TABLE "bauth_session" ADD CONSTRAINT "bauth_session_impersonated_by_bauth_user_id_fk" FOREIGN KEY ("impersonated_by") REFERENCES "public"."bauth_user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bauth_session_user_idx" ON "bauth_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bauth_session_expires_at_idx" ON "bauth_session" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bauth_account_user_idx" ON "bauth_account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bauth_account_provider_account_idx" ON "bauth_account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bauth_verification_identifier_idx" ON "bauth_verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_timestamp_idx" ON "audit"."audit_log" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_target_type_time_idx" ON "audit"."audit_log" USING btree ("target_type","timestamp");
