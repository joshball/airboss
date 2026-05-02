-- Add `study.session_item_result` to the audit_log target_type allow-list.
--
-- Matches the new AUDIT_TARGETS.STUDY_SESSION_ITEM constant emitted by
-- `recordItemResult` (libs/bc/study/src/sessions.ts). Without widening the
-- CHECK constraint the BC's audit emit would fail with a constraint violation
-- the moment a learner submits a slot result.
--
-- The widening is append-only -- existing rows stay valid; the only behavior
-- change is that the new target_type string is now accepted.
ALTER TABLE "audit"."audit_log" DROP CONSTRAINT "audit_log_target_type_check";--> statement-breakpoint
ALTER TABLE "audit"."audit_log" ADD CONSTRAINT "audit_log_target_type_check" CHECK ("target_type" IN ('hangar.ping', 'hangar.reference', 'hangar.source', 'hangar.sync', 'hangar.job', 'hangar.source.edition-resolved', 'hangar.source.edition-drift', 'hangar.source.thumbnail-generated', 'hangar.user', 'study.session_item_result'));
