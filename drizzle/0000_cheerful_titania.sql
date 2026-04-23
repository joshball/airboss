CREATE SCHEMA "study";
--> statement-breakpoint
CREATE SCHEMA "audit";
--> statement-breakpoint
CREATE TABLE "bauth_account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bauth_session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"impersonated_by" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "bauth_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "bauth_user" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text,
	"address" jsonb,
	"banned" boolean,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "bauth_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "bauth_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study"."card" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"front" text NOT NULL,
	"back" text NOT NULL,
	"domain" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"card_type" text NOT NULL,
	"source_type" text DEFAULT 'personal' NOT NULL,
	"source_ref" text,
	"node_id" text,
	"is_editable" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_type_check" CHECK ("card_type" IN ('basic', 'cloze', 'regulation', 'memory_item')),
	CONSTRAINT "card_source_type_check" CHECK ("source_type" IN ('personal', 'course', 'product', 'imported')),
	CONSTRAINT "card_status_check" CHECK ("status" IN ('active', 'suspended', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "study"."card_state" (
	"card_id" text NOT NULL,
	"user_id" text NOT NULL,
	"stability" real NOT NULL,
	"difficulty" real NOT NULL,
	"state" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"last_review_id" text,
	"last_reviewed_at" timestamp with time zone,
	"review_count" integer DEFAULT 0 NOT NULL,
	"lapse_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_state_card_id_user_id_pk" PRIMARY KEY("card_id","user_id"),
	CONSTRAINT "card_state_state_check" CHECK ("state" IN ('new', 'learning', 'review', 'relearning'))
);
--> statement-breakpoint
CREATE TABLE "study"."knowledge_edge" (
	"from_node_id" text NOT NULL,
	"to_node_id" text NOT NULL,
	"edge_type" text NOT NULL,
	"target_exists" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_edge_from_node_id_to_node_id_edge_type_pk" PRIMARY KEY("from_node_id","to_node_id","edge_type"),
	CONSTRAINT "knowledge_edge_type_check" CHECK ("edge_type" IN ('requires', 'deepens', 'applies', 'teaches', 'related'))
);
--> statement-breakpoint
CREATE TABLE "study"."knowledge_node" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"domain" text NOT NULL,
	"cross_domains" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"knowledge_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"technical_depth" text,
	"stability" text,
	"relevance" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"modalities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"estimated_time_minutes" integer,
	"review_time_minutes" integer,
	"references" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"assessable" boolean DEFAULT false NOT NULL,
	"assessment_methods" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mastery_criteria" text,
	"content_md" text NOT NULL,
	"content_hash" text,
	"version" integer DEFAULT 1 NOT NULL,
	"author_id" text,
	"lifecycle" text DEFAULT 'skeleton',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_node_lifecycle_check" CHECK ("lifecycle" IS NULL OR "lifecycle" IN ('skeleton', 'started', 'complete'))
);
--> statement-breakpoint
CREATE TABLE "study"."knowledge_node_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"node_id" text,
	"visited_phases" text[] DEFAULT '{}'::text[] NOT NULL,
	"completed_phases" text[] DEFAULT '{}'::text[] NOT NULL,
	"last_phase" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study"."review" (
	"id" text PRIMARY KEY NOT NULL,
	"card_id" text NOT NULL,
	"user_id" text NOT NULL,
	"rating" smallint NOT NULL,
	"confidence" smallint,
	"stability" real NOT NULL,
	"difficulty" real NOT NULL,
	"elapsed_days" real NOT NULL,
	"scheduled_days" real NOT NULL,
	"state" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answer_ms" integer,
	CONSTRAINT "review_rating_check" CHECK ("rating" IN (1, 2, 3, 4)),
	CONSTRAINT "review_confidence_check" CHECK ("confidence" IS NULL OR "confidence" BETWEEN 1 AND 5),
	CONSTRAINT "review_state_check" CHECK ("state" IN ('new', 'learning', 'review', 'relearning'))
);
--> statement-breakpoint
CREATE TABLE "study"."scenario" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"situation" text NOT NULL,
	"options" jsonb NOT NULL,
	"teaching_point" text NOT NULL,
	"domain" text NOT NULL,
	"difficulty" text NOT NULL,
	"phase_of_flight" text,
	"source_type" text DEFAULT 'personal' NOT NULL,
	"source_ref" text,
	"node_id" text,
	"is_editable" boolean DEFAULT true NOT NULL,
	"reg_references" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scenario_difficulty_check" CHECK ("difficulty" IN ('beginner', 'intermediate', 'advanced')),
	CONSTRAINT "scenario_phase_check" CHECK ("phase_of_flight" IS NULL OR "phase_of_flight" IN ('preflight', 'takeoff', 'climb', 'cruise', 'descent', 'approach', 'landing', 'ground')),
	CONSTRAINT "scenario_source_type_check" CHECK ("source_type" IN ('personal', 'course', 'product', 'imported')),
	CONSTRAINT "scenario_status_check" CHECK ("status" IN ('active', 'suspended', 'archived')),
	CONSTRAINT "scenario_options_shape_check" CHECK (jsonb_typeof("options") = 'array'
				 AND jsonb_array_length("options") BETWEEN 2 AND 5)
);
--> statement-breakpoint
CREATE TABLE "study"."session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"mode" text NOT NULL,
	"focus_override" text,
	"cert_override" text,
	"session_length" smallint NOT NULL,
	"items" jsonb NOT NULL,
	"seed" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "session_mode_check" CHECK ("mode" IN ('continue', 'strengthen', 'mixed', 'expand')),
	CONSTRAINT "session_focus_override_check" CHECK ("focus_override" IS NULL OR "focus_override" IN ('regulations', 'weather', 'airspace', 'glass-cockpits', 'ifr-procedures', 'vfr-operations', 'aerodynamics', 'teaching-methodology', 'adm-human-factors', 'safety-accident-analysis', 'aircraft-systems', 'flight-planning', 'emergency-procedures', 'faa-practical-standards')),
	CONSTRAINT "session_cert_override_check" CHECK ("cert_override" IS NULL OR "cert_override" IN ('PPL', 'IR', 'CPL', 'CFI')),
	CONSTRAINT "session_session_length_check" CHECK ("session_length" BETWEEN 3 AND 50)
);
--> statement-breakpoint
CREATE TABLE "study"."session_item_result" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"user_id" text NOT NULL,
	"slot_index" smallint NOT NULL,
	"item_kind" text NOT NULL,
	"slice" text NOT NULL,
	"reason_code" text NOT NULL,
	"card_id" text,
	"scenario_id" text,
	"node_id" text,
	"review_id" text,
	"skip_kind" text,
	"reason_detail" text,
	"chosen_option" text,
	"is_correct" boolean,
	"confidence" smallint,
	"answer_ms" integer,
	"presented_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "sir_item_kind_check" CHECK ("item_kind" IN ('card', 'rep', 'node_start')),
	CONSTRAINT "sir_slice_check" CHECK ("slice" IN ('continue', 'strengthen', 'expand', 'diversify')),
	CONSTRAINT "sir_reason_code_check" CHECK ("reason_code" IN ('continue_recent_domain', 'continue_due_in_domain', 'continue_unfinished_node', 'strengthen_relearning', 'strengthen_rated_again', 'strengthen_overdue', 'strengthen_low_rep_accuracy', 'strengthen_mastery_drop', 'expand_unstarted_ready', 'expand_unstarted_priority', 'expand_focus_match', 'diversify_unused_domain', 'diversify_cross_domain_apply')),
	CONSTRAINT "sir_skip_kind_check" CHECK ("skip_kind" IS NULL OR "skip_kind" IN ('today', 'topic', 'permanent')),
	CONSTRAINT "sir_confidence_check" CHECK ("confidence" IS NULL OR "confidence" BETWEEN 1 AND 5),
	CONSTRAINT "sir_answer_ms_check" CHECK ("answer_ms" IS NULL OR "answer_ms" >= 0)
);
--> statement-breakpoint
CREATE TABLE "study"."study_plan" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"cert_goals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"focus_domains" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"skip_domains" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"skip_nodes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"depth_preference" text DEFAULT 'working' NOT NULL,
	"session_length" smallint DEFAULT 10 NOT NULL,
	"default_mode" text DEFAULT 'mixed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_status_check" CHECK ("status" IN ('draft', 'active', 'archived')),
	CONSTRAINT "plan_depth_check" CHECK ("depth_preference" IN ('surface', 'working', 'deep')),
	CONSTRAINT "plan_mode_check" CHECK ("default_mode" IN ('continue', 'strengthen', 'mixed', 'expand')),
	CONSTRAINT "plan_session_length_check" CHECK ("session_length" BETWEEN 3 AND 50)
);
--> statement-breakpoint
CREATE TABLE "audit"."audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" text,
	"op" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"before" jsonb,
	"after" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bauth_account" ADD CONSTRAINT "bauth_account_user_id_bauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bauth_session" ADD CONSTRAINT "bauth_session_user_id_bauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."card" ADD CONSTRAINT "card_user_id_bauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."card" ADD CONSTRAINT "card_node_id_knowledge_node_id_fk" FOREIGN KEY ("node_id") REFERENCES "study"."knowledge_node"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."card_state" ADD CONSTRAINT "card_state_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "study"."card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."card_state" ADD CONSTRAINT "card_state_user_id_bauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."card_state" ADD CONSTRAINT "card_state_last_review_id_review_id_fk" FOREIGN KEY ("last_review_id") REFERENCES "study"."review"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."knowledge_edge" ADD CONSTRAINT "knowledge_edge_from_node_id_knowledge_node_id_fk" FOREIGN KEY ("from_node_id") REFERENCES "study"."knowledge_node"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."knowledge_node" ADD CONSTRAINT "knowledge_node_author_id_bauth_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."bauth_user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."knowledge_node_progress" ADD CONSTRAINT "knowledge_node_progress_user_id_bauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."knowledge_node_progress" ADD CONSTRAINT "knowledge_node_progress_node_id_knowledge_node_id_fk" FOREIGN KEY ("node_id") REFERENCES "study"."knowledge_node"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."review" ADD CONSTRAINT "review_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "study"."card"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."review" ADD CONSTRAINT "review_user_id_bauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."scenario" ADD CONSTRAINT "scenario_user_id_bauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."scenario" ADD CONSTRAINT "scenario_node_id_knowledge_node_id_fk" FOREIGN KEY ("node_id") REFERENCES "study"."knowledge_node"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."session" ADD CONSTRAINT "session_user_id_bauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."session" ADD CONSTRAINT "session_plan_id_study_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "study"."study_plan"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."session_item_result" ADD CONSTRAINT "session_item_result_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "study"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."session_item_result" ADD CONSTRAINT "session_item_result_user_id_bauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."session_item_result" ADD CONSTRAINT "session_item_result_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "study"."card"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."session_item_result" ADD CONSTRAINT "session_item_result_scenario_id_scenario_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "study"."scenario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."session_item_result" ADD CONSTRAINT "session_item_result_node_id_knowledge_node_id_fk" FOREIGN KEY ("node_id") REFERENCES "study"."knowledge_node"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."session_item_result" ADD CONSTRAINT "session_item_result_review_id_review_id_fk" FOREIGN KEY ("review_id") REFERENCES "study"."review"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."study_plan" ADD CONSTRAINT "study_plan_user_id_bauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "audit"."audit_log" ADD CONSTRAINT "audit_log_actor_id_bauth_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."bauth_user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "card_user_status_idx" ON "study"."card" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "card_user_domain_idx" ON "study"."card" USING btree ("user_id","domain");--> statement-breakpoint
CREATE INDEX "card_user_created_idx" ON "study"."card" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "card_node_user_idx" ON "study"."card" USING btree ("node_id","user_id");--> statement-breakpoint
CREATE INDEX "card_front_trgm_idx" ON "study"."card" USING gin ("front" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "card_back_trgm_idx" ON "study"."card" USING gin ("back" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "card_state_user_due_idx" ON "study"."card_state" USING btree ("user_id","due_at");--> statement-breakpoint
CREATE INDEX "card_state_user_mastered_idx" ON "study"."card_state" USING btree ("user_id") WHERE "stability" > 30;--> statement-breakpoint
CREATE INDEX "card_state_last_review_idx" ON "study"."card_state" USING btree ("last_review_id");--> statement-breakpoint
CREATE INDEX "knowledge_edge_from_idx" ON "study"."knowledge_edge" USING btree ("from_node_id","edge_type");--> statement-breakpoint
CREATE INDEX "knowledge_edge_to_idx" ON "study"."knowledge_edge" USING btree ("to_node_id","edge_type");--> statement-breakpoint
CREATE INDEX "knowledge_node_domain_idx" ON "study"."knowledge_node" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "knowledge_node_lifecycle_idx" ON "study"."knowledge_node" USING btree ("lifecycle");--> statement-breakpoint
CREATE UNIQUE INDEX "knp_user_node_unique" ON "study"."knowledge_node_progress" USING btree ("user_id","node_id");--> statement-breakpoint
CREATE INDEX "knp_node_idx" ON "study"."knowledge_node_progress" USING btree ("node_id");--> statement-breakpoint
CREATE INDEX "review_card_reviewed_idx" ON "study"."review" USING btree ("card_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "review_user_reviewed_idx" ON "study"."review" USING btree ("user_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "scenario_user_status_idx" ON "study"."scenario" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "scenario_user_domain_idx" ON "study"."scenario" USING btree ("user_id","domain");--> statement-breakpoint
CREATE INDEX "scenario_user_created_idx" ON "study"."scenario" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "scenario_user_node_idx" ON "study"."scenario" USING btree ("user_id","node_id");--> statement-breakpoint
CREATE INDEX "scenario_user_difficulty_idx" ON "study"."scenario" USING btree ("user_id","difficulty");--> statement-breakpoint
CREATE INDEX "session_user_started_idx" ON "study"."session" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "session_plan_started_idx" ON "study"."session" USING btree ("plan_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sir_session_slot_unique" ON "study"."session_item_result" USING btree ("session_id","slot_index");--> statement-breakpoint
CREATE INDEX "sir_user_completed_idx" ON "study"."session_item_result" USING btree ("user_id","completed_at");--> statement-breakpoint
CREATE INDEX "sir_user_kind_completed_idx" ON "study"."session_item_result" USING btree ("user_id","item_kind","completed_at");--> statement-breakpoint
CREATE INDEX "sir_scenario_completed_idx" ON "study"."session_item_result" USING btree ("scenario_id","completed_at");--> statement-breakpoint
CREATE INDEX "sir_node_completed_idx" ON "study"."session_item_result" USING btree ("node_id","completed_at");--> statement-breakpoint
CREATE INDEX "plan_user_status_idx" ON "study"."study_plan" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_user_active_uniq" ON "study"."study_plan" USING btree ("user_id") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit"."audit_log" USING btree ("actor_id","timestamp");--> statement-breakpoint
CREATE INDEX "audit_log_target_idx" ON "audit"."audit_log" USING btree ("target_type","target_id","timestamp");