CREATE SCHEMA "sim";
--> statement-breakpoint
CREATE TABLE "sim"."attempt" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"scenario_id" text NOT NULL,
	"outcome" text NOT NULL,
	"reason" text NOT NULL,
	"elapsed_seconds" real NOT NULL,
	"grade_total" real,
	"grade" jsonb,
	"tape" jsonb,
	"ended_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sim"."attempt" ADD CONSTRAINT "attempt_user_id_bauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "sim_attempt_user_scenario_ended_idx" ON "sim"."attempt" USING btree ("user_id","scenario_id","ended_at");--> statement-breakpoint
CREATE INDEX "sim_attempt_user_ended_idx" ON "sim"."attempt" USING btree ("user_id","ended_at");