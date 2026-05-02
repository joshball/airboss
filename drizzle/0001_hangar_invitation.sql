CREATE TABLE "hangar"."invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"proposed_role" text NOT NULL,
	"token" text NOT NULL,
	"invited_by_user_id" text,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_user_id" text,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitation_token_unique" UNIQUE("token"),
	CONSTRAINT "hangar_invitation_proposed_role_check" CHECK ("proposed_role" IN ('learner', 'author', 'operator', 'admin'))
);
--> statement-breakpoint
ALTER TABLE "audit"."audit_log" DROP CONSTRAINT "audit_log_target_type_check";--> statement-breakpoint
DROP INDEX "hangar"."hangar_reference_live_idx";--> statement-breakpoint
DROP INDEX "hangar"."hangar_source_live_idx";--> statement-breakpoint
DROP INDEX "hangar"."hangar_reference_updated_idx";--> statement-breakpoint
ALTER TABLE "hangar"."sync_log" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "hangar"."sync_log" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "hangar"."invitation" ADD CONSTRAINT "invitation_invited_by_user_id_bauth_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."bauth_user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "hangar"."invitation" ADD CONSTRAINT "invitation_accepted_user_id_bauth_user_id_fk" FOREIGN KEY ("accepted_user_id") REFERENCES "public"."bauth_user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "hangar"."invitation" ADD CONSTRAINT "invitation_revoked_by_user_id_bauth_user_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."bauth_user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "hangar_invitation_status_idx" ON "hangar"."invitation" USING btree ("accepted_at","revoked_at","expires_at");--> statement-breakpoint
CREATE INDEX "hangar_invitation_email_idx" ON "hangar"."invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "hangar_invitation_invited_at_idx" ON "hangar"."invitation" USING btree ("invited_at");--> statement-breakpoint
CREATE UNIQUE INDEX "hangar_invitation_pending_email_unique_idx" ON "hangar"."invitation" USING btree ("email") WHERE "hangar"."invitation"."accepted_at" IS NULL AND "hangar"."invitation"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "hangar_source_updated_idx" ON "hangar"."source" USING btree ("updated_at") WHERE "hangar"."source"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "hangar_sync_log_kind_idx" ON "hangar"."sync_log" USING btree ("kind","started_at");--> statement-breakpoint
CREATE INDEX "hangar_job_log_at_idx" ON "hangar"."job_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "hangar_reference_updated_idx" ON "hangar"."reference" USING btree ("updated_at") WHERE "hangar"."reference"."deleted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "audit"."audit_log" ADD CONSTRAINT "audit_log_target_type_check" CHECK ("target_type" IN ('hangar.ping', 'hangar.reference', 'hangar.source', 'hangar.sync', 'hangar.job', 'hangar.source.edition-resolved', 'hangar.source.edition-drift', 'hangar.source.thumbnail-generated', 'hangar.user', 'study.session_item_result', 'auth.login', 'auth.login-failed', 'auth.logout', 'hangar.invitation'));