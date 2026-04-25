CREATE TABLE "study"."card_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"card_id" text NOT NULL,
	"user_id" text NOT NULL,
	"signal" text NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_feedback_signal_check" CHECK ("signal" IN ('like', 'dislike', 'flag'))
);
--> statement-breakpoint
CREATE TABLE "study"."card_snooze" (
	"id" text PRIMARY KEY NOT NULL,
	"card_id" text NOT NULL,
	"user_id" text NOT NULL,
	"reason" text NOT NULL,
	"comment" text,
	"duration_level" text,
	"snooze_until" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"card_edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_snooze_reason_check" CHECK ("reason" IN ('bad-question', 'wrong-domain', 'know-it-bored', 'remove')),
	CONSTRAINT "card_snooze_duration_level_check" CHECK ("duration_level" IS NULL OR "duration_level" IN ('short', 'medium', 'long'))
);
--> statement-breakpoint
ALTER TABLE "study"."card_feedback" ADD CONSTRAINT "card_feedback_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "study"."card"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."card_feedback" ADD CONSTRAINT "card_feedback_user_id_bauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."card_snooze" ADD CONSTRAINT "card_snooze_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "study"."card"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."card_snooze" ADD CONSTRAINT "card_snooze_user_id_bauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "card_feedback_user_card_idx" ON "study"."card_feedback" USING btree ("user_id","card_id");--> statement-breakpoint
CREATE INDEX "card_snooze_user_card_idx" ON "study"."card_snooze" USING btree ("user_id","card_id");--> statement-breakpoint
CREATE INDEX "card_snooze_user_reason_idx" ON "study"."card_snooze" USING btree ("user_id","reason","resolved_at");--> statement-breakpoint
CREATE INDEX "card_snooze_user_removed_idx" ON "study"."card_snooze" USING btree ("user_id","card_id") WHERE reason = 'remove' AND resolved_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "card_snooze_unique_remove" ON "study"."card_snooze" USING btree ("card_id","user_id") WHERE reason = 'remove' AND resolved_at IS NULL;