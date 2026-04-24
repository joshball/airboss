CREATE SCHEMA "hangar";
--> statement-breakpoint
CREATE TABLE "hangar"."job" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"progress" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb,
	"error" text,
	"actor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "hangar"."job_log" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"seq" integer NOT NULL,
	"stream" text NOT NULL,
	"line" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hangar"."reference" (
	"id" text PRIMARY KEY NOT NULL,
	"rev" integer DEFAULT 1 NOT NULL,
	"display_name" text NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"paraphrase" text NOT NULL,
	"tags" jsonb NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"related" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"author" text,
	"reviewed_at" text,
	"verbatim" jsonb,
	"dirty" boolean DEFAULT false NOT NULL,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hangar"."source" (
	"id" text PRIMARY KEY NOT NULL,
	"rev" integer DEFAULT 1 NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"version" text NOT NULL,
	"url" text NOT NULL,
	"path" text NOT NULL,
	"format" text NOT NULL,
	"checksum" text NOT NULL,
	"downloaded_at" text NOT NULL,
	"size_bytes" integer,
	"locator_shape" jsonb,
	"dirty" boolean DEFAULT false NOT NULL,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hangar"."sync_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"kind" text NOT NULL,
	"files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"commit_sha" text,
	"pr_url" text,
	"outcome" text NOT NULL,
	"message" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "hangar"."job" ADD CONSTRAINT "job_actor_id_bauth_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."bauth_user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "hangar"."job_log" ADD CONSTRAINT "job_log_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "hangar"."job"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "hangar"."reference" ADD CONSTRAINT "reference_updated_by_bauth_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."bauth_user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "hangar"."source" ADD CONSTRAINT "source_updated_by_bauth_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."bauth_user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "hangar"."sync_log" ADD CONSTRAINT "sync_log_actor_id_bauth_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."bauth_user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "hangar_job_status_idx" ON "hangar"."job" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "hangar_job_kind_idx" ON "hangar"."job" USING btree ("kind","created_at");--> statement-breakpoint
CREATE INDEX "hangar_job_target_idx" ON "hangar"."job" USING btree ("target_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX "hangar_job_actor_idx" ON "hangar"."job" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "hangar_job_log_job_idx" ON "hangar"."job_log" USING btree ("job_id","seq");--> statement-breakpoint
CREATE INDEX "hangar_reference_dirty_idx" ON "hangar"."reference" USING btree ("dirty");--> statement-breakpoint
CREATE INDEX "hangar_reference_updated_idx" ON "hangar"."reference" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "hangar_source_type_idx" ON "hangar"."source" USING btree ("type");--> statement-breakpoint
CREATE INDEX "hangar_source_dirty_idx" ON "hangar"."source" USING btree ("dirty");--> statement-breakpoint
CREATE INDEX "hangar_sync_log_actor_idx" ON "hangar"."sync_log" USING btree ("actor_id","started_at");--> statement-breakpoint
CREATE INDEX "hangar_sync_log_outcome_idx" ON "hangar"."sync_log" USING btree ("outcome","started_at");