CREATE TABLE "study"."user_pref" (
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_pref_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
ALTER TABLE "audit"."audit_log" DROP CONSTRAINT "audit_log_target_type_check";--> statement-breakpoint
ALTER TABLE "study"."user_pref" ADD CONSTRAINT "user_pref_user_id_bauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_pref_key_idx" ON "study"."user_pref" USING btree ("key");--> statement-breakpoint
ALTER TABLE "audit"."audit_log" ADD CONSTRAINT "audit_log_target_type_check" CHECK ("target_type" IN ('hangar.reference', 'hangar.source', 'hangar.sync', 'hangar.job', 'hangar.source.edition-resolved', 'hangar.source.edition-drift', 'hangar.source.thumbnail-generated', 'hangar.user', 'study.session_item_result', 'auth.login', 'auth.login-failed', 'auth.logout', 'hangar.invitation', 'study.user_pref', 'hangar.ping'));