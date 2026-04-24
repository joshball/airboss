CREATE TABLE "study"."memory_review_session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"deck_hash" text NOT NULL,
	"deck_spec" jsonb NOT NULL,
	"card_id_list" jsonb NOT NULL,
	"current_index" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "mrs_status_check" CHECK ("status" IN ('active', 'completed', 'abandoned')),
	CONSTRAINT "mrs_current_index_check" CHECK ("current_index" >= 0)
);
--> statement-breakpoint
ALTER TABLE "study"."review" ADD COLUMN "review_session_id" text;--> statement-breakpoint
ALTER TABLE "study"."memory_review_session" ADD CONSTRAINT "memory_review_session_user_id_bauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "mrs_user_deck_status_idx" ON "study"."memory_review_session" USING btree ("user_id","deck_hash","status");--> statement-breakpoint
CREATE INDEX "mrs_user_started_idx" ON "study"."memory_review_session" USING btree ("user_id","started_at");--> statement-breakpoint
ALTER TABLE "study"."review" ADD CONSTRAINT "review_review_session_id_memory_review_session_id_fk" FOREIGN KEY ("review_session_id") REFERENCES "study"."memory_review_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_session_card_idx" ON "study"."review" USING btree ("review_session_id","card_id");