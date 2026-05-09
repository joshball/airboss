CREATE TABLE "study"."course" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"seed_origin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_kind_check" CHECK ("kind" IN ('instructor', 'personal')),
	CONSTRAINT "course_status_check" CHECK ("status" IN ('draft', 'active', 'archived')),
	CONSTRAINT "course_slug_shape_check" CHECK ("slug" ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$')
);
--> statement-breakpoint
CREATE TABLE "study"."course_step" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"parent_id" text,
	"level" text NOT NULL,
	"ordinal" integer NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"body_md" text DEFAULT '' NOT NULL,
	"knowledge_node_id" text,
	"is_leaf" boolean DEFAULT false NOT NULL,
	"content_hash" text,
	"seed_origin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_step_level_check" CHECK ("level" IN ('section', 'step')),
	CONSTRAINT "course_step_consistency_check" CHECK (
				(("level" = 'section'
					AND "parent_id" IS NULL
					AND "knowledge_node_id" IS NULL
					AND "is_leaf" = false)
				 OR
				 ("level" = 'step'
					AND "parent_id" IS NOT NULL
					AND "knowledge_node_id" IS NOT NULL
					AND "is_leaf" = true))
			),
	CONSTRAINT "course_step_ordinal_check" CHECK ("ordinal" >= 0)
);
--> statement-breakpoint
CREATE TABLE "study"."goal_course" (
	"goal_id" text NOT NULL,
	"course_id" text NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	"seed_origin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goal_course_goal_id_course_id_pk" PRIMARY KEY("goal_id","course_id"),
	CONSTRAINT "goal_course_weight_check" CHECK ("weight" >= 0 AND "weight" <= 10)
);
--> statement-breakpoint
CREATE TABLE "hangar"."board" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hangar"."board_column" (
	"id" text PRIMARY KEY NOT NULL,
	"board_id" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hangar"."board_task" (
	"id" text PRIMARY KEY NOT NULL,
	"board_id" text NOT NULL,
	"column_id" text,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"type" text NOT NULL,
	"product_area" text NOT NULL,
	"assignee_id" text,
	"created_by" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hangar_board_task_type_check" CHECK ("type" IN ('bug', 'feature', 'chore', 'investigation', 'follow-up')),
	CONSTRAINT "hangar_board_task_product_area_check" CHECK ("product_area" IN ('hangar', 'study', 'sim', 'flightbag', 'avionics', 'platform', 'docs'))
);
--> statement-breakpoint
CREATE TABLE "hangar"."docs_search_index" (
	"path" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"frontmatter" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tsv" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(body, '')), 'B')) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hangar"."review_bucket" (
	"id" text PRIMARY KEY NOT NULL,
	"board_id" text NOT NULL,
	"name" text NOT NULL,
	"kind_id" text NOT NULL,
	"filter_criteria" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hangar"."review_item" (
	"id" text PRIMARY KEY NOT NULL,
	"board_id" text NOT NULL,
	"pinned_column_id" text,
	"kind_id" text NOT NULL,
	"ref" text NOT NULL,
	"title" text NOT NULL,
	"frontmatter_status" text,
	"review_status" text,
	"cached_fields" jsonb DEFAULT '{"otherFields":{}}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hangar_review_item_frontmatter_status_check" CHECK ("frontmatter_status" IS NULL OR "frontmatter_status" IN ('unread', 'reading', 'done')),
	CONSTRAINT "hangar_review_item_review_status_check" CHECK ("review_status" IS NULL OR "review_status" IN ('pending', 'done'))
);
--> statement-breakpoint
CREATE TABLE "hangar"."review_kind" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hangar_review_kind_id_check" CHECK ("id" IN ('wp_spec', 'wp_test_plan', 'reference_toc', 'knowledge_node', 'ad_hoc'))
);
--> statement-breakpoint
CREATE TABLE "hangar"."review_session" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"user_id" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"outcome" text,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hangar_review_session_outcome_check" CHECK ("outcome" IS NULL OR "outcome" IN ('pass', 'fail', 'abandoned'))
);
--> statement-breakpoint
CREATE TABLE "hangar"."review_step" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"step_index" integer NOT NULL,
	"step_ref" text NOT NULL,
	"outcome" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hangar_review_step_outcome_check" CHECK ("outcome" IN ('pass', 'fail', 'blocked'))
);
--> statement-breakpoint
ALTER TABLE "study"."reference" DROP CONSTRAINT "reference_subjects_values_check";--> statement-breakpoint
ALTER TABLE "study"."reference_section" DROP CONSTRAINT "reference_section_faa_pages_check";--> statement-breakpoint
ALTER TABLE "study"."syllabus_node" DROP CONSTRAINT "syllabus_node_level_check";--> statement-breakpoint
ALTER TABLE "study"."syllabus_node" DROP CONSTRAINT "syllabus_node_parent_level_check";--> statement-breakpoint
ALTER TABLE "audit"."audit_log" DROP CONSTRAINT "audit_log_target_type_check";--> statement-breakpoint
ALTER TABLE "study"."knowledge_node_progress" DROP CONSTRAINT "knowledge_node_progress_node_id_knowledge_node_id_fk";
--> statement-breakpoint
ALTER TABLE "study"."knowledge_node_progress" ALTER COLUMN "node_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "hangar"."source" ALTER COLUMN "checksum" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "hangar"."source" ALTER COLUMN "downloaded_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hangar"."source" ALTER COLUMN "downloaded_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "study"."knowledge_node" ADD COLUMN "kind" text DEFAULT 'concept' NOT NULL;--> statement-breakpoint
ALTER TABLE "study"."scenario" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "study"."course_step" ADD CONSTRAINT "course_step_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "study"."course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."course_step" ADD CONSTRAINT "course_step_parent_id_course_step_id_fk" FOREIGN KEY ("parent_id") REFERENCES "study"."course_step"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."course_step" ADD CONSTRAINT "course_step_knowledge_node_id_knowledge_node_id_fk" FOREIGN KEY ("knowledge_node_id") REFERENCES "study"."knowledge_node"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."goal_course" ADD CONSTRAINT "goal_course_goal_id_goal_id_fk" FOREIGN KEY ("goal_id") REFERENCES "study"."goal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."goal_course" ADD CONSTRAINT "goal_course_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "study"."course"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hangar"."board_column" ADD CONSTRAINT "board_column_board_id_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "hangar"."board"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "hangar"."board_task" ADD CONSTRAINT "board_task_board_id_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "hangar"."board"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "hangar"."board_task" ADD CONSTRAINT "board_task_column_id_board_column_id_fk" FOREIGN KEY ("column_id") REFERENCES "hangar"."board_column"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "hangar"."board_task" ADD CONSTRAINT "board_task_assignee_id_bauth_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."bauth_user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "hangar"."board_task" ADD CONSTRAINT "board_task_created_by_bauth_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."bauth_user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "hangar"."review_bucket" ADD CONSTRAINT "review_bucket_board_id_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "hangar"."board"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "hangar"."review_bucket" ADD CONSTRAINT "review_bucket_kind_id_review_kind_id_fk" FOREIGN KEY ("kind_id") REFERENCES "hangar"."review_kind"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "hangar"."review_item" ADD CONSTRAINT "review_item_board_id_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "hangar"."board"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "hangar"."review_item" ADD CONSTRAINT "review_item_pinned_column_id_board_column_id_fk" FOREIGN KEY ("pinned_column_id") REFERENCES "hangar"."board_column"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "hangar"."review_item" ADD CONSTRAINT "review_item_kind_id_review_kind_id_fk" FOREIGN KEY ("kind_id") REFERENCES "hangar"."review_kind"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "hangar"."review_session" ADD CONSTRAINT "review_session_item_id_review_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "hangar"."review_item"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "hangar"."review_session" ADD CONSTRAINT "review_session_user_id_bauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "hangar"."review_step" ADD CONSTRAINT "review_step_session_id_review_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "hangar"."review_session"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "course_slug_unique" ON "study"."course" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "course_kind_status_idx" ON "study"."course" USING btree ("kind","status");--> statement-breakpoint
CREATE UNIQUE INDEX "course_step_course_code_unique" ON "study"."course_step" USING btree ("course_id","code");--> statement-breakpoint
CREATE INDEX "course_step_tree_idx" ON "study"."course_step" USING btree ("course_id","parent_id","ordinal");--> statement-breakpoint
CREATE INDEX "course_step_node_idx" ON "study"."course_step" USING btree ("knowledge_node_id");--> statement-breakpoint
CREATE INDEX "goal_course_by_course_idx" ON "study"."goal_course" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hangar_board_name_unique_idx" ON "hangar"."board" USING btree ("name");--> statement-breakpoint
CREATE INDEX "hangar_board_column_board_idx" ON "hangar"."board_column" USING btree ("board_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "hangar_board_column_name_unique_idx" ON "hangar"."board_column" USING btree ("board_id","name");--> statement-breakpoint
CREATE INDEX "hangar_board_task_board_idx" ON "hangar"."board_task" USING btree ("board_id","sort_order");--> statement-breakpoint
CREATE INDEX "hangar_board_task_column_idx" ON "hangar"."board_task" USING btree ("column_id") WHERE "hangar"."board_task"."column_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "hangar_board_task_assignee_idx" ON "hangar"."board_task" USING btree ("assignee_id") WHERE "hangar"."board_task"."assignee_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "hangar_docs_search_tsv_idx" ON "hangar"."docs_search_index" USING gin ("tsv");--> statement-breakpoint
CREATE INDEX "hangar_review_bucket_board_idx" ON "hangar"."review_bucket" USING btree ("board_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "hangar_review_bucket_name_unique_idx" ON "hangar"."review_bucket" USING btree ("board_id","name");--> statement-breakpoint
CREATE INDEX "hangar_review_bucket_kind_idx" ON "hangar"."review_bucket" USING btree ("kind_id");--> statement-breakpoint
CREATE INDEX "hangar_review_item_kind_idx" ON "hangar"."review_item" USING btree ("kind_id","updated_at") WHERE "hangar"."review_item"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "hangar_review_item_ref_unique_idx" ON "hangar"."review_item" USING btree ("board_id","kind_id","ref") WHERE "hangar"."review_item"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "hangar_review_item_frontmatter_status_idx" ON "hangar"."review_item" USING btree ("board_id","frontmatter_status") WHERE "hangar"."review_item"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "hangar_review_item_review_status_idx" ON "hangar"."review_item" USING btree ("board_id","review_status") WHERE "hangar"."review_item"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "hangar_review_item_board_idx" ON "hangar"."review_item" USING btree ("board_id","deleted_at");--> statement-breakpoint
CREATE INDEX "hangar_review_item_pinned_column_idx" ON "hangar"."review_item" USING btree ("pinned_column_id") WHERE "hangar"."review_item"."pinned_column_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "hangar_review_session_item_user_idx" ON "hangar"."review_session" USING btree ("item_id","user_id","started_at");--> statement-breakpoint
CREATE INDEX "hangar_review_session_item_started_idx" ON "hangar"."review_session" USING btree ("item_id","started_at" desc);--> statement-breakpoint
CREATE UNIQUE INDEX "hangar_review_session_open_unique_idx" ON "hangar"."review_session" USING btree ("item_id","user_id") WHERE "hangar"."review_session"."finished_at" IS NULL;--> statement-breakpoint
CREATE INDEX "hangar_review_step_session_idx" ON "hangar"."review_step" USING btree ("session_id","step_index");--> statement-breakpoint
CREATE UNIQUE INDEX "hangar_review_step_ref_unique_idx" ON "hangar"."review_step" USING btree ("session_id","step_ref");--> statement-breakpoint
ALTER TABLE "study"."knowledge_node_progress" ADD CONSTRAINT "knowledge_node_progress_node_id_knowledge_node_id_fk" FOREIGN KEY ("node_id") REFERENCES "study"."knowledge_node"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."knowledge_edge" DROP COLUMN "target_exists";--> statement-breakpoint
ALTER TABLE "study"."reference_section" DROP COLUMN "faa_page_start";--> statement-breakpoint
ALTER TABLE "study"."reference_section" DROP COLUMN "faa_page_end";--> statement-breakpoint
ALTER TABLE "study"."knowledge_node" ADD CONSTRAINT "knowledge_node_kind_check" CHECK ("kind" IN ('concept', 'procedure', 'case_study', 'transition', 'reference_anchor'));--> statement-breakpoint
ALTER TABLE "study"."reference" ADD CONSTRAINT "reference_subjects_values_check" CHECK ("subjects" <@ ARRAY['regulations', 'definitions', 'weather', 'navigation', 'communications', 'airspace', 'aerodynamics', 'performance', 'weight-balance', 'aircraft-systems', 'flight-instruments', 'procedures', 'instrument-procedures', 'operations', 'commercial-operations', 'rotorcraft', 'equipment', 'human-factors', 'medical', 'airworthiness', 'certification', 'maintenance', 'airports', 'emergencies', 'accident-reporting', 'security', 'training-ops']::text[]);--> statement-breakpoint
ALTER TABLE "hangar"."source" ADD CONSTRAINT "hangar_source_downloaded_pair_check" CHECK (("checksum" IS NULL) = ("downloaded_at" IS NULL));