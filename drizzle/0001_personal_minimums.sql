CREATE TABLE "study"."personal_minimums" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"ceiling_ft" integer NOT NULL,
	"visibility_sm" numeric(4, 1) NOT NULL,
	"wind_total_kt" integer NOT NULL,
	"crosswind_total_kt" integer NOT NULL,
	"night_required_recency_landings" integer DEFAULT 3 NOT NULL,
	"imc_required_recency_approaches" integer DEFAULT 6 NOT NULL,
	"pax_max" integer NOT NULL,
	"terrain_buffer_agl" integer NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_until" timestamp with time zone,
	"seed_origin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "personal_minimums_crosswind_le_wind_check" CHECK ("crosswind_total_kt" <= "wind_total_kt"),
	CONSTRAINT "personal_minimums_effective_window_check" CHECK ("effective_until" IS NULL OR "effective_until" > "effective_from"),
	CONSTRAINT "personal_minimums_ceiling_range_check" CHECK ("ceiling_ft" BETWEEN 0 AND 30000),
	CONSTRAINT "personal_minimums_visibility_range_check" CHECK ("visibility_sm" BETWEEN 0 AND 99.9),
	CONSTRAINT "personal_minimums_wind_range_check" CHECK ("wind_total_kt" BETWEEN 0 AND 99),
	CONSTRAINT "personal_minimums_crosswind_range_check" CHECK ("crosswind_total_kt" BETWEEN 0 AND 99),
	CONSTRAINT "personal_minimums_night_recency_range_check" CHECK ("night_required_recency_landings" BETWEEN 0 AND 50),
	CONSTRAINT "personal_minimums_imc_recency_range_check" CHECK ("imc_required_recency_approaches" BETWEEN 0 AND 50),
	CONSTRAINT "personal_minimums_pax_range_check" CHECK ("pax_max" BETWEEN 0 AND 19),
	CONSTRAINT "personal_minimums_terrain_buffer_range_check" CHECK ("terrain_buffer_agl" BETWEEN 0 AND 10000),
	CONSTRAINT "personal_minimums_notes_length_check" CHECK ("notes" IS NULL OR char_length("notes") <= 4000)
);
--> statement-breakpoint
ALTER TABLE "study"."personal_minimums" ADD CONSTRAINT "personal_minimums_user_id_bauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "personal_minimums_user_idx" ON "study"."personal_minimums" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "personal_minimums_user_effective_idx" ON "study"."personal_minimums" USING btree ("user_id","effective_from" desc);--> statement-breakpoint
CREATE UNIQUE INDEX "personal_minimums_one_active_per_user_uidx" ON "study"."personal_minimums" USING btree ("user_id") WHERE is_active = true;