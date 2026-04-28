CREATE SCHEMA "study";
--> statement-breakpoint
CREATE SCHEMA "hangar";
--> statement-breakpoint
CREATE SCHEMA "sim";
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
CREATE TABLE "bauth_rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "bauth_rate_limit_key_unique" UNIQUE("key")
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
	"seed_origin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_id_user_unique" UNIQUE("id","user_id"),
	CONSTRAINT "card_type_check" CHECK ("card_type" IN ('basic', 'cloze', 'regulation', 'memory_item')),
	CONSTRAINT "card_source_type_check" CHECK ("source_type" IN ('personal', 'course', 'product', 'imported')),
	CONSTRAINT "card_status_check" CHECK ("status" IN ('active', 'suspended', 'archived'))
);
--> statement-breakpoint
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
CREATE TABLE "study"."credential" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"class" text,
	"regulatory_basis" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"seed_origin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credential_kind_check" CHECK ("kind" IN ('pilot-cert', 'instructor-cert', 'category-rating', 'class-rating', 'endorsement', 'student')),
	CONSTRAINT "credential_category_check" CHECK ("category" IN ('airplane', 'rotorcraft', 'glider', 'lighter-than-air', 'powered-lift', 'weight-shift-control', 'powered-parachute', 'none')),
	CONSTRAINT "credential_class_check" CHECK ("class" IS NULL OR "class" IN ('single-engine-land', 'single-engine-sea', 'multi-engine-land', 'multi-engine-sea', 'helicopter', 'gyroplane', 'glider', 'airship', 'balloon')),
	CONSTRAINT "credential_status_check" CHECK ("status" IN ('active', 'draft', 'archived')),
	CONSTRAINT "credential_slug_shape_check" CHECK ("slug" ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$')
);
--> statement-breakpoint
CREATE TABLE "study"."credential_prereq" (
	"credential_id" text NOT NULL,
	"prereq_id" text NOT NULL,
	"kind" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"seed_origin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credential_prereq_credential_id_prereq_id_kind_pk" PRIMARY KEY("credential_id","prereq_id","kind"),
	CONSTRAINT "credential_prereq_kind_check" CHECK ("kind" IN ('required', 'recommended', 'experience')),
	CONSTRAINT "credential_prereq_no_self_loop_check" CHECK ("credential_id" <> "prereq_id")
);
--> statement-breakpoint
CREATE TABLE "study"."credential_syllabus" (
	"credential_id" text NOT NULL,
	"syllabus_id" text NOT NULL,
	"primacy" text DEFAULT 'supplemental' NOT NULL,
	"seed_origin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credential_syllabus_primacy_check" CHECK ("primacy" IN ('primary', 'supplemental'))
);
--> statement-breakpoint
CREATE TABLE "study"."goal" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"notes_md" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"target_date" date,
	"seed_origin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goal_status_check" CHECK ("status" IN ('active', 'paused', 'completed', 'abandoned'))
);
--> statement-breakpoint
CREATE TABLE "study"."goal_node" (
	"goal_id" text NOT NULL,
	"knowledge_node_id" text NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"seed_origin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goal_node_goal_id_knowledge_node_id_pk" PRIMARY KEY("goal_id","knowledge_node_id"),
	CONSTRAINT "goal_node_weight_check" CHECK ("weight" >= 0 AND "weight" <= 10)
);
--> statement-breakpoint
CREATE TABLE "study"."goal_syllabus" (
	"goal_id" text NOT NULL,
	"syllabus_id" text NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	"seed_origin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goal_syllabus_goal_id_syllabus_id_pk" PRIMARY KEY("goal_id","syllabus_id"),
	CONSTRAINT "goal_syllabus_weight_check" CHECK ("weight" >= 0 AND "weight" <= 10)
);
--> statement-breakpoint
CREATE TABLE "study"."handbook_figure" (
	"id" text PRIMARY KEY NOT NULL,
	"section_id" text NOT NULL,
	"ordinal" integer NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"asset_path" text NOT NULL,
	"width" integer,
	"height" integer,
	"seed_origin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "handbook_figure_ordinal_check" CHECK ("ordinal" >= 0),
	CONSTRAINT "handbook_figure_dimensions_check" CHECK (("width" IS NULL OR "width" > 0) AND ("height" IS NULL OR "height" > 0))
);
--> statement-breakpoint
CREATE TABLE "study"."handbook_read_state" (
	"user_id" text NOT NULL,
	"handbook_section_id" text NOT NULL,
	"status" text DEFAULT 'unread' NOT NULL,
	"comprehended" boolean DEFAULT false NOT NULL,
	"last_read_at" timestamp with time zone,
	"opened_count" integer DEFAULT 0 NOT NULL,
	"total_seconds_visible" integer DEFAULT 0 NOT NULL,
	"notes_md" text DEFAULT '' NOT NULL,
	"seed_origin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "handbook_read_state_user_id_handbook_section_id_pk" PRIMARY KEY("user_id","handbook_section_id"),
	CONSTRAINT "handbook_read_state_status_check" CHECK ("status" IN ('unread', 'reading', 'read')),
	CONSTRAINT "handbook_read_state_total_seconds_check" CHECK ("total_seconds_visible" >= 0),
	CONSTRAINT "handbook_read_state_opened_count_check" CHECK ("opened_count" >= 0),
	CONSTRAINT "handbook_read_state_notes_length_check" CHECK (char_length("notes_md") <= 16384)
);
--> statement-breakpoint
CREATE TABLE "study"."handbook_section" (
	"id" text PRIMARY KEY NOT NULL,
	"reference_id" text NOT NULL,
	"parent_id" text,
	"level" text NOT NULL,
	"ordinal" integer NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"faa_page_start" text,
	"faa_page_end" text,
	"source_locator" text NOT NULL,
	"content_md" text DEFAULT '' NOT NULL,
	"content_hash" text NOT NULL,
	"has_figures" boolean DEFAULT false NOT NULL,
	"has_tables" boolean DEFAULT false NOT NULL,
	"seed_origin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "handbook_section_level_check" CHECK ("level" IN ('chapter', 'section', 'subsection')),
	CONSTRAINT "handbook_section_code_shape_check" CHECK ("code" ~ '^[0-9]+(\.[0-9]+){0,2}$'),
	CONSTRAINT "handbook_section_parent_level_check" CHECK (("level" = 'chapter' AND "parent_id" IS NULL) OR ("level" <> 'chapter' AND "parent_id" IS NOT NULL)),
	CONSTRAINT "handbook_section_ordinal_check" CHECK ("ordinal" >= 0),
	CONSTRAINT "handbook_section_faa_pages_check" CHECK (("faa_page_start" IS NULL AND "faa_page_end" IS NULL) OR "faa_page_start" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "study"."handbook_section_errata" (
	"id" text PRIMARY KEY NOT NULL,
	"section_id" text NOT NULL,
	"errata_id" text NOT NULL,
	"source_url" text NOT NULL,
	"published_at" text NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"patch_kind" text NOT NULL,
	"target_anchor" text,
	"target_page" text NOT NULL,
	"original_text" text,
	"replacement_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "handbook_section_errata_patch_kind_check" CHECK ("patch_kind" IN ('add_subsection', 'append_paragraph', 'replace_paragraph')),
	CONSTRAINT "handbook_section_errata_add_subsection_check" CHECK (("patch_kind" <> 'add_subsection') OR ("original_text" IS NULL)),
	CONSTRAINT "handbook_section_errata_target_page_check" CHECK ("target_page" ~ '^[0-9]+-[0-9]+$'),
	CONSTRAINT "handbook_section_errata_replacement_nonempty_check" CHECK (length(trim("replacement_text")) > 0),
	CONSTRAINT "handbook_section_errata_source_url_check" CHECK ("source_url" LIKE 'https://%')
);
--> statement-breakpoint
CREATE TABLE "study"."knowledge_edge" (
	"from_node_id" text NOT NULL,
	"to_node_id" text NOT NULL,
	"edge_type" text NOT NULL,
	"target_exists" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"seed_origin" text,
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
	"minimum_cert" text,
	"study_priority" text,
	"modalities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"estimated_time_minutes" integer,
	"review_time_minutes" integer,
	"references" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"assessable" boolean DEFAULT false NOT NULL,
	"assessment_methods" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mastery_criteria" text,
	"seed_origin" text,
	"content_md" text NOT NULL,
	"content_hash" text,
	"version" integer DEFAULT 1 NOT NULL,
	"author_id" text,
	"lifecycle" text DEFAULT 'skeleton',
	"references_v2_migrated" boolean DEFAULT false NOT NULL,
	"relevance" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_node_lifecycle_check" CHECK ("lifecycle" IS NULL OR "lifecycle" IN ('skeleton', 'started', 'complete')),
	CONSTRAINT "knowledge_node_minimum_cert_check" CHECK ("minimum_cert" IS NULL OR "minimum_cert" IN ('private', 'instrument', 'commercial', 'cfi')),
	CONSTRAINT "knowledge_node_study_priority_check" CHECK ("study_priority" IS NULL OR "study_priority" IN ('critical', 'standard', 'stretch'))
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
CREATE TABLE "study"."reference" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"document_slug" text NOT NULL,
	"edition" text NOT NULL,
	"title" text NOT NULL,
	"publisher" text DEFAULT 'FAA' NOT NULL,
	"url" text,
	"superseded_by_id" text,
	"seed_origin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reference_kind_check" CHECK ("kind" IN ('handbook', 'cfr', 'ac', 'acs', 'pts', 'aim', 'pcg', 'ntsb', 'poh', 'other')),
	CONSTRAINT "reference_document_slug_shape_check" CHECK ("document_slug" ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'),
	CONSTRAINT "reference_edition_length_check" CHECK (char_length("edition") BETWEEN 1 AND 64)
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
	"review_session_id" text,
	"seed_origin" text,
	CONSTRAINT "review_rating_check" CHECK ("rating" IN (1, 2, 3, 4)),
	CONSTRAINT "review_confidence_check" CHECK ("confidence" IS NULL OR "confidence" BETWEEN 1 AND 5),
	CONSTRAINT "review_state_check" CHECK ("state" IN ('new', 'learning', 'review', 'relearning'))
);
--> statement-breakpoint
CREATE TABLE "study"."saved_deck" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"deck_hash" text NOT NULL,
	"label" text,
	"dismissed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_deck_label_length_check" CHECK ("label" IS NULL OR char_length("label") <= 80),
	CONSTRAINT "saved_deck_label_non_empty_check" CHECK ("label" IS NULL OR char_length("label") > 0)
);
--> statement-breakpoint
CREATE TABLE "study"."scenario" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"situation" text NOT NULL,
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
	"seed_origin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scenario_difficulty_check" CHECK ("difficulty" IN ('beginner', 'intermediate', 'advanced')),
	CONSTRAINT "scenario_phase_check" CHECK ("phase_of_flight" IS NULL OR "phase_of_flight" IN ('preflight', 'takeoff', 'climb', 'cruise', 'descent', 'approach', 'landing', 'ground')),
	CONSTRAINT "scenario_source_type_check" CHECK ("source_type" IN ('personal', 'course', 'product', 'imported')),
	CONSTRAINT "scenario_status_check" CHECK ("status" IN ('active', 'suspended', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "study"."scenario_option" (
	"id" text PRIMARY KEY NOT NULL,
	"scenario_id" text NOT NULL,
	"text" text NOT NULL,
	"is_correct" boolean NOT NULL,
	"outcome" text NOT NULL,
	"why_not" text DEFAULT '' NOT NULL,
	"position" smallint NOT NULL,
	CONSTRAINT "scenario_option_why_not_required_check" CHECK (("is_correct" = true) OR (length(trim("why_not")) > 0))
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
	"seed_origin" text,
	CONSTRAINT "session_id_user_unique" UNIQUE("id","user_id"),
	CONSTRAINT "session_mode_check" CHECK ("mode" IN ('continue', 'strengthen', 'mixed', 'expand')),
	CONSTRAINT "session_focus_override_check" CHECK ("focus_override" IS NULL OR "focus_override" IN ('regulations', 'weather', 'airspace', 'glass-cockpits', 'ifr-procedures', 'vfr-operations', 'aerodynamics', 'teaching-methodology', 'adm-human-factors', 'safety-accident-analysis', 'aircraft-systems', 'flight-planning', 'emergency-procedures', 'faa-practical-standards')),
	CONSTRAINT "session_cert_override_check" CHECK ("cert_override" IS NULL OR "cert_override" IN ('private', 'instrument', 'commercial', 'cfi')),
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
	"chosen_option_id" text,
	"is_correct" boolean,
	"confidence" smallint,
	"answer_ms" integer,
	"presented_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"seed_origin" text,
	CONSTRAINT "sir_item_kind_check" CHECK ("item_kind" IN ('card', 'rep', 'node_start')),
	CONSTRAINT "sir_slice_check" CHECK ("slice" IN ('continue', 'strengthen', 'expand', 'diversify')),
	CONSTRAINT "sir_reason_code_check" CHECK ("reason_code" IN ('continue_recent_domain', 'continue_due_in_domain', 'continue_unfinished_node', 'strengthen_relearning', 'strengthen_rated_again', 'strengthen_overdue', 'strengthen_low_rep_accuracy', 'strengthen_mastery_drop', 'strengthen_sim_weakness_card', 'strengthen_sim_weakness_rep', 'expand_unstarted_ready', 'expand_unstarted_priority', 'expand_focus_match', 'diversify_unused_domain', 'diversify_cross_domain_apply')),
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
	"goal_migrated_at" timestamp with time zone,
	"seed_origin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_status_check" CHECK ("status" IN ('draft', 'active', 'archived')),
	CONSTRAINT "plan_depth_check" CHECK ("depth_preference" IN ('surface', 'working', 'deep')),
	CONSTRAINT "plan_mode_check" CHECK ("default_mode" IN ('continue', 'strengthen', 'mixed', 'expand')),
	CONSTRAINT "plan_session_length_check" CHECK ("session_length" BETWEEN 3 AND 50)
);
--> statement-breakpoint
CREATE TABLE "study"."syllabus" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"edition" text NOT NULL,
	"source_url" text,
	"status" text DEFAULT 'active' NOT NULL,
	"superseded_by_id" text,
	"reference_id" text,
	"seed_origin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "syllabus_kind_check" CHECK ("kind" IN ('acs', 'pts', 'school', 'personal')),
	CONSTRAINT "syllabus_status_check" CHECK ("status" IN ('active', 'draft', 'superseded')),
	CONSTRAINT "syllabus_slug_shape_check" CHECK ("slug" ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$')
);
--> statement-breakpoint
CREATE TABLE "study"."syllabus_node" (
	"id" text PRIMARY KEY NOT NULL,
	"syllabus_id" text NOT NULL,
	"parent_id" text,
	"level" text NOT NULL,
	"ordinal" integer NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"triad" text,
	"required_bloom" text,
	"is_leaf" boolean DEFAULT false NOT NULL,
	"airboss_ref" text,
	"citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"classes" jsonb,
	"content_hash" text,
	"seed_origin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "syllabus_node_level_check" CHECK ("level" IN ('area', 'task', 'element', 'chapter', 'section', 'subsection')),
	CONSTRAINT "syllabus_node_triad_check" CHECK ("triad" IS NULL OR "triad" IN ('knowledge', 'risk_management', 'skill')),
	CONSTRAINT "syllabus_node_required_bloom_check" CHECK ("required_bloom" IS NULL OR "required_bloom" IN ('remember', 'understand', 'apply', 'analyze', 'evaluate', 'create')),
	CONSTRAINT "syllabus_node_parent_level_check" CHECK (("level" IN ('area', 'chapter') AND "parent_id" IS NULL) OR ("level" NOT IN ('area', 'chapter') AND "parent_id" IS NOT NULL)),
	CONSTRAINT "syllabus_node_triad_level_check" CHECK (("level" = 'element' AND "triad" IS NOT NULL) OR ("level" <> 'element' AND "triad" IS NULL)),
	CONSTRAINT "syllabus_node_required_bloom_leaf_check" CHECK (("is_leaf" = true AND "required_bloom" IS NOT NULL) OR ("is_leaf" = false AND "required_bloom" IS NULL)),
	CONSTRAINT "syllabus_node_airboss_ref_shape_check" CHECK ("airboss_ref" IS NULL OR "airboss_ref" LIKE 'airboss-ref:%'),
	CONSTRAINT "syllabus_node_ordinal_check" CHECK ("ordinal" >= 0),
	CONSTRAINT "syllabus_node_classes_check" CHECK ("classes" IS NULL OR (jsonb_typeof("classes") = 'array' AND jsonb_array_length("classes") > 0 AND "classes" <@ '["asel", "amel", "ases", "ames"]'::jsonb))
);
--> statement-breakpoint
CREATE TABLE "study"."syllabus_node_link" (
	"id" text PRIMARY KEY NOT NULL,
	"syllabus_node_id" text NOT NULL,
	"knowledge_node_id" text NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"seed_origin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "syllabus_node_link_weight_check" CHECK ("weight" >= 0 AND "weight" <= 1)
);
--> statement-breakpoint
CREATE TABLE "study"."content_citations" (
	"id" text PRIMARY KEY NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"citation_context" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_citation_source_type_check" CHECK ("source_type" IN ('card', 'rep', 'scenario', 'node')),
	CONSTRAINT "content_citation_target_type_check" CHECK ("target_type" IN ('regulation_node', 'ac_reference', 'external_ref', 'knowledge_node')),
	CONSTRAINT "content_citation_context_length_check" CHECK ("citation_context" IS NULL OR char_length("citation_context") <= 500)
);
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
	"finished_at" timestamp with time zone,
	CONSTRAINT "hangar_job_status_check" CHECK ("status" IN ('queued', 'running', 'complete', 'failed', 'cancelled')),
	CONSTRAINT "hangar_job_kind_check" CHECK ("kind" IN ('sync-to-disk', 'fetch-source', 'upload-source', 'extract-source', 'build-references', 'diff-source', 'validate-references', 'size-report'))
);
--> statement-breakpoint
CREATE TABLE "hangar"."job_log" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"seq" integer NOT NULL,
	"stream" text NOT NULL,
	"line" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hangar_job_log_stream_check" CHECK ("stream" IN ('stdout', 'stderr', 'event'))
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
	"media" jsonb,
	"edition" jsonb,
	"dirty" boolean DEFAULT false NOT NULL,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hangar_source_type_check" CHECK ("type" IN ('cfr', 'aim', 'pcg', 'ac', 'acs', 'phak', 'afh', 'ifh', 'poh', 'ntsb', 'gajsc', 'aopa', 'faa-safety', 'sop', 'authored', 'derived', 'sectional'))
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
	"rev_snapshot" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "hangar_sync_log_kind_check" CHECK ("kind" IN ('commit-local', 'pr')),
	CONSTRAINT "hangar_sync_log_outcome_check" CHECK ("outcome" IN ('success', 'noop', 'conflict', 'failed'))
);
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
CREATE TABLE "audit"."audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" text,
	"op" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"before" jsonb,
	"after" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "audit_log_op_check" CHECK ("op" IN ('create', 'update', 'delete', 'action')),
	CONSTRAINT "audit_log_target_type_check" CHECK ("target_type" IN ('hangar.ping', 'hangar.reference', 'hangar.source', 'hangar.sync', 'hangar.job', 'hangar.source.edition-resolved', 'hangar.source.edition-drift', 'hangar.source.thumbnail-generated'))
);
--> statement-breakpoint
ALTER TABLE "bauth_account" ADD CONSTRAINT "bauth_account_user_id_bauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bauth_session" ADD CONSTRAINT "bauth_session_user_id_bauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."card" ADD CONSTRAINT "card_user_id_bauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."card" ADD CONSTRAINT "card_node_id_knowledge_node_id_fk" FOREIGN KEY ("node_id") REFERENCES "study"."knowledge_node"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."card_feedback" ADD CONSTRAINT "card_feedback_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "study"."card"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."card_feedback" ADD CONSTRAINT "card_feedback_user_id_bauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."card_snooze" ADD CONSTRAINT "card_snooze_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "study"."card"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."card_snooze" ADD CONSTRAINT "card_snooze_user_id_bauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."card_state" ADD CONSTRAINT "card_state_last_review_id_review_id_fk" FOREIGN KEY ("last_review_id") REFERENCES "study"."review"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."card_state" ADD CONSTRAINT "card_state_card_owner_fk" FOREIGN KEY ("card_id","user_id") REFERENCES "study"."card"("id","user_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."credential_prereq" ADD CONSTRAINT "credential_prereq_credential_id_credential_id_fk" FOREIGN KEY ("credential_id") REFERENCES "study"."credential"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."credential_prereq" ADD CONSTRAINT "credential_prereq_prereq_id_credential_id_fk" FOREIGN KEY ("prereq_id") REFERENCES "study"."credential"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."credential_syllabus" ADD CONSTRAINT "credential_syllabus_credential_id_credential_id_fk" FOREIGN KEY ("credential_id") REFERENCES "study"."credential"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."credential_syllabus" ADD CONSTRAINT "credential_syllabus_syllabus_id_syllabus_id_fk" FOREIGN KEY ("syllabus_id") REFERENCES "study"."syllabus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."goal" ADD CONSTRAINT "goal_user_id_bauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."goal_node" ADD CONSTRAINT "goal_node_goal_id_goal_id_fk" FOREIGN KEY ("goal_id") REFERENCES "study"."goal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."goal_node" ADD CONSTRAINT "goal_node_knowledge_node_id_knowledge_node_id_fk" FOREIGN KEY ("knowledge_node_id") REFERENCES "study"."knowledge_node"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."goal_syllabus" ADD CONSTRAINT "goal_syllabus_goal_id_goal_id_fk" FOREIGN KEY ("goal_id") REFERENCES "study"."goal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."goal_syllabus" ADD CONSTRAINT "goal_syllabus_syllabus_id_syllabus_id_fk" FOREIGN KEY ("syllabus_id") REFERENCES "study"."syllabus"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."handbook_figure" ADD CONSTRAINT "handbook_figure_section_id_handbook_section_id_fk" FOREIGN KEY ("section_id") REFERENCES "study"."handbook_section"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."handbook_read_state" ADD CONSTRAINT "handbook_read_state_user_id_bauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."handbook_read_state" ADD CONSTRAINT "handbook_read_state_handbook_section_id_handbook_section_id_fk" FOREIGN KEY ("handbook_section_id") REFERENCES "study"."handbook_section"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."handbook_section" ADD CONSTRAINT "handbook_section_reference_id_reference_id_fk" FOREIGN KEY ("reference_id") REFERENCES "study"."reference"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."handbook_section" ADD CONSTRAINT "handbook_section_parent_id_handbook_section_id_fk" FOREIGN KEY ("parent_id") REFERENCES "study"."handbook_section"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."handbook_section_errata" ADD CONSTRAINT "handbook_section_errata_section_id_handbook_section_id_fk" FOREIGN KEY ("section_id") REFERENCES "study"."handbook_section"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."knowledge_edge" ADD CONSTRAINT "knowledge_edge_from_node_id_knowledge_node_id_fk" FOREIGN KEY ("from_node_id") REFERENCES "study"."knowledge_node"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."knowledge_node" ADD CONSTRAINT "knowledge_node_author_id_bauth_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."bauth_user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."knowledge_node_progress" ADD CONSTRAINT "knowledge_node_progress_user_id_bauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."knowledge_node_progress" ADD CONSTRAINT "knowledge_node_progress_node_id_knowledge_node_id_fk" FOREIGN KEY ("node_id") REFERENCES "study"."knowledge_node"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."memory_review_session" ADD CONSTRAINT "memory_review_session_user_id_bauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."reference" ADD CONSTRAINT "reference_superseded_by_id_reference_id_fk" FOREIGN KEY ("superseded_by_id") REFERENCES "study"."reference"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."review" ADD CONSTRAINT "review_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "study"."card"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."review" ADD CONSTRAINT "review_user_id_bauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."review" ADD CONSTRAINT "review_review_session_id_memory_review_session_id_fk" FOREIGN KEY ("review_session_id") REFERENCES "study"."memory_review_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."saved_deck" ADD CONSTRAINT "saved_deck_user_id_bauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."scenario" ADD CONSTRAINT "scenario_user_id_bauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."scenario" ADD CONSTRAINT "scenario_node_id_knowledge_node_id_fk" FOREIGN KEY ("node_id") REFERENCES "study"."knowledge_node"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."scenario_option" ADD CONSTRAINT "scenario_option_scenario_id_scenario_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "study"."scenario"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."session" ADD CONSTRAINT "session_user_id_bauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."session" ADD CONSTRAINT "session_plan_id_study_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "study"."study_plan"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."session_item_result" ADD CONSTRAINT "session_item_result_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "study"."card"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."session_item_result" ADD CONSTRAINT "session_item_result_scenario_id_scenario_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "study"."scenario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."session_item_result" ADD CONSTRAINT "session_item_result_node_id_knowledge_node_id_fk" FOREIGN KEY ("node_id") REFERENCES "study"."knowledge_node"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."session_item_result" ADD CONSTRAINT "session_item_result_review_id_review_id_fk" FOREIGN KEY ("review_id") REFERENCES "study"."review"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."session_item_result" ADD CONSTRAINT "session_item_result_chosen_option_id_scenario_option_id_fk" FOREIGN KEY ("chosen_option_id") REFERENCES "study"."scenario_option"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."session_item_result" ADD CONSTRAINT "session_item_result_session_owner_fk" FOREIGN KEY ("session_id","user_id") REFERENCES "study"."session"("id","user_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."study_plan" ADD CONSTRAINT "study_plan_user_id_bauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."syllabus" ADD CONSTRAINT "syllabus_superseded_by_id_syllabus_id_fk" FOREIGN KEY ("superseded_by_id") REFERENCES "study"."syllabus"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."syllabus" ADD CONSTRAINT "syllabus_reference_id_reference_id_fk" FOREIGN KEY ("reference_id") REFERENCES "study"."reference"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."syllabus_node" ADD CONSTRAINT "syllabus_node_syllabus_id_syllabus_id_fk" FOREIGN KEY ("syllabus_id") REFERENCES "study"."syllabus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."syllabus_node" ADD CONSTRAINT "syllabus_node_parent_id_syllabus_node_id_fk" FOREIGN KEY ("parent_id") REFERENCES "study"."syllabus_node"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."syllabus_node_link" ADD CONSTRAINT "syllabus_node_link_syllabus_node_id_syllabus_node_id_fk" FOREIGN KEY ("syllabus_node_id") REFERENCES "study"."syllabus_node"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."syllabus_node_link" ADD CONSTRAINT "syllabus_node_link_knowledge_node_id_knowledge_node_id_fk" FOREIGN KEY ("knowledge_node_id") REFERENCES "study"."knowledge_node"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."content_citations" ADD CONSTRAINT "content_citations_created_by_bauth_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."bauth_user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "hangar"."job" ADD CONSTRAINT "job_actor_id_bauth_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."bauth_user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "hangar"."job_log" ADD CONSTRAINT "job_log_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "hangar"."job"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "hangar"."reference" ADD CONSTRAINT "reference_updated_by_bauth_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."bauth_user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "hangar"."source" ADD CONSTRAINT "source_updated_by_bauth_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."bauth_user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "hangar"."sync_log" ADD CONSTRAINT "sync_log_actor_id_bauth_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."bauth_user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sim"."attempt" ADD CONSTRAINT "attempt_user_id_bauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "audit"."audit_log" ADD CONSTRAINT "audit_log_actor_id_bauth_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."bauth_user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "card_user_status_idx" ON "study"."card" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "card_user_domain_idx" ON "study"."card" USING btree ("user_id","domain");--> statement-breakpoint
CREATE INDEX "card_user_created_idx" ON "study"."card" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "card_node_user_idx" ON "study"."card" USING btree ("node_id","user_id");--> statement-breakpoint
CREATE INDEX "card_front_trgm_idx" ON "study"."card" USING gin ("front" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "card_back_trgm_idx" ON "study"."card" USING gin ("back" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "card_feedback_user_card_idx" ON "study"."card_feedback" USING btree ("user_id","card_id");--> statement-breakpoint
CREATE INDEX "card_snooze_user_card_idx" ON "study"."card_snooze" USING btree ("user_id","card_id");--> statement-breakpoint
CREATE INDEX "card_snooze_user_reason_idx" ON "study"."card_snooze" USING btree ("user_id","reason","resolved_at");--> statement-breakpoint
CREATE INDEX "card_snooze_user_removed_idx" ON "study"."card_snooze" USING btree ("user_id","card_id") WHERE reason = 'remove' AND resolved_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "card_snooze_unique_remove" ON "study"."card_snooze" USING btree ("card_id","user_id") WHERE reason = 'remove' AND resolved_at IS NULL;--> statement-breakpoint
CREATE INDEX "card_state_user_due_idx" ON "study"."card_state" USING btree ("user_id","due_at");--> statement-breakpoint
CREATE INDEX "card_state_user_mastered_idx" ON "study"."card_state" USING btree ("user_id") WHERE "stability" > 30;--> statement-breakpoint
CREATE INDEX "card_state_last_review_idx" ON "study"."card_state" USING btree ("last_review_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credential_slug_unique" ON "study"."credential" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "credential_kind_idx" ON "study"."credential" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "credential_category_class_idx" ON "study"."credential" USING btree ("category","class");--> statement-breakpoint
CREATE INDEX "credential_status_idx" ON "study"."credential" USING btree ("status");--> statement-breakpoint
CREATE INDEX "credential_regulatory_basis_gin_idx" ON "study"."credential" USING gin ("regulatory_basis" jsonb_path_ops);--> statement-breakpoint
CREATE INDEX "credential_prereq_by_prereq_idx" ON "study"."credential_prereq" USING btree ("prereq_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "credential_syllabus_unique" ON "study"."credential_syllabus" USING btree ("credential_id","syllabus_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credential_syllabus_primary_unique" ON "study"."credential_syllabus" USING btree ("credential_id") WHERE primacy = 'primary';--> statement-breakpoint
CREATE INDEX "credential_syllabus_by_syllabus_idx" ON "study"."credential_syllabus" USING btree ("syllabus_id");--> statement-breakpoint
CREATE INDEX "goal_user_status_idx" ON "study"."goal" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "goal_user_primary_unique" ON "study"."goal" USING btree ("user_id") WHERE is_primary = true;--> statement-breakpoint
CREATE INDEX "goal_node_by_knowledge_node_idx" ON "study"."goal_node" USING btree ("knowledge_node_id");--> statement-breakpoint
CREATE INDEX "goal_syllabus_by_syllabus_idx" ON "study"."goal_syllabus" USING btree ("syllabus_id");--> statement-breakpoint
CREATE INDEX "handbook_figure_section_idx" ON "study"."handbook_figure" USING btree ("section_id","ordinal");--> statement-breakpoint
CREATE INDEX "handbook_read_state_user_status_idx" ON "study"."handbook_read_state" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "handbook_read_state_section_idx" ON "study"."handbook_read_state" USING btree ("handbook_section_id");--> statement-breakpoint
CREATE UNIQUE INDEX "handbook_section_ref_code_unique" ON "study"."handbook_section" USING btree ("reference_id","code");--> statement-breakpoint
CREATE INDEX "handbook_section_tree_idx" ON "study"."handbook_section" USING btree ("reference_id","parent_id","ordinal");--> statement-breakpoint
CREATE INDEX "handbook_section_level_idx" ON "study"."handbook_section" USING btree ("reference_id","level","ordinal");--> statement-breakpoint
CREATE UNIQUE INDEX "handbook_section_errata_section_errata_idx" ON "study"."handbook_section_errata" USING btree ("section_id","errata_id");--> statement-breakpoint
CREATE INDEX "handbook_section_errata_section_applied_idx" ON "study"."handbook_section_errata" USING btree ("section_id","applied_at");--> statement-breakpoint
CREATE INDEX "knowledge_edge_from_idx" ON "study"."knowledge_edge" USING btree ("from_node_id","edge_type");--> statement-breakpoint
CREATE INDEX "knowledge_edge_to_idx" ON "study"."knowledge_edge" USING btree ("to_node_id","edge_type");--> statement-breakpoint
CREATE INDEX "knowledge_node_domain_idx" ON "study"."knowledge_node" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "knowledge_node_lifecycle_idx" ON "study"."knowledge_node" USING btree ("lifecycle");--> statement-breakpoint
CREATE INDEX "knowledge_node_minimum_cert_idx" ON "study"."knowledge_node" USING btree ("minimum_cert");--> statement-breakpoint
CREATE INDEX "knowledge_node_study_priority_idx" ON "study"."knowledge_node" USING btree ("study_priority");--> statement-breakpoint
CREATE INDEX "knowledge_node_references_gin_idx" ON "study"."knowledge_node" USING gin ("references" jsonb_path_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "knp_user_node_unique" ON "study"."knowledge_node_progress" USING btree ("user_id","node_id");--> statement-breakpoint
CREATE INDEX "knp_node_idx" ON "study"."knowledge_node_progress" USING btree ("node_id");--> statement-breakpoint
CREATE INDEX "mrs_user_deck_status_idx" ON "study"."memory_review_session" USING btree ("user_id","deck_hash","status");--> statement-breakpoint
CREATE INDEX "mrs_user_started_idx" ON "study"."memory_review_session" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reference_doc_edition_unique" ON "study"."reference" USING btree ("document_slug","edition");--> statement-breakpoint
CREATE INDEX "reference_kind_idx" ON "study"."reference" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "reference_doc_superseded_idx" ON "study"."reference" USING btree ("document_slug","superseded_by_id");--> statement-breakpoint
CREATE INDEX "review_card_reviewed_idx" ON "study"."review" USING btree ("card_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "review_user_reviewed_idx" ON "study"."review" USING btree ("user_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "review_session_card_idx" ON "study"."review" USING btree ("review_session_id","card_id");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_deck_user_hash_unique" ON "study"."saved_deck" USING btree ("user_id","deck_hash");--> statement-breakpoint
CREATE INDEX "saved_deck_user_active_idx" ON "study"."saved_deck" USING btree ("user_id","deck_hash") WHERE dismissed_at IS NULL;--> statement-breakpoint
CREATE INDEX "scenario_user_status_idx" ON "study"."scenario" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "scenario_user_domain_idx" ON "study"."scenario" USING btree ("user_id","domain");--> statement-breakpoint
CREATE INDEX "scenario_user_created_idx" ON "study"."scenario" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "scenario_user_node_idx" ON "study"."scenario" USING btree ("user_id","node_id");--> statement-breakpoint
CREATE INDEX "scenario_user_difficulty_idx" ON "study"."scenario" USING btree ("user_id","difficulty");--> statement-breakpoint
CREATE UNIQUE INDEX "scenario_option_scenario_position_unique" ON "study"."scenario_option" USING btree ("scenario_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "scenario_option_correct_unique" ON "study"."scenario_option" USING btree ("scenario_id") WHERE is_correct = true;--> statement-breakpoint
CREATE INDEX "session_user_started_idx" ON "study"."session" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "session_plan_started_idx" ON "study"."session" USING btree ("plan_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sir_session_slot_unique" ON "study"."session_item_result" USING btree ("session_id","slot_index");--> statement-breakpoint
CREATE INDEX "sir_user_completed_idx" ON "study"."session_item_result" USING btree ("user_id","completed_at");--> statement-breakpoint
CREATE INDEX "sir_user_kind_completed_idx" ON "study"."session_item_result" USING btree ("user_id","item_kind","completed_at");--> statement-breakpoint
CREATE INDEX "sir_scenario_completed_idx" ON "study"."session_item_result" USING btree ("scenario_id","completed_at");--> statement-breakpoint
CREATE INDEX "sir_node_completed_idx" ON "study"."session_item_result" USING btree ("node_id","completed_at");--> statement-breakpoint
CREATE INDEX "plan_user_status_idx" ON "study"."study_plan" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_user_active_uniq" ON "study"."study_plan" USING btree ("user_id") WHERE status = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "syllabus_slug_unique" ON "study"."syllabus" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "syllabus_acs_pts_edition_unique" ON "study"."syllabus" USING btree ("kind","edition") WHERE kind IN ('acs', 'pts');--> statement-breakpoint
CREATE INDEX "syllabus_kind_status_idx" ON "study"."syllabus" USING btree ("kind","status");--> statement-breakpoint
CREATE INDEX "syllabus_reference_idx" ON "study"."syllabus" USING btree ("reference_id");--> statement-breakpoint
CREATE UNIQUE INDEX "syllabus_node_syllabus_code_unique" ON "study"."syllabus_node" USING btree ("syllabus_id","code");--> statement-breakpoint
CREATE INDEX "syllabus_node_tree_idx" ON "study"."syllabus_node" USING btree ("syllabus_id","parent_id","ordinal");--> statement-breakpoint
CREATE INDEX "syllabus_node_level_idx" ON "study"."syllabus_node" USING btree ("syllabus_id","level","ordinal");--> statement-breakpoint
CREATE INDEX "syllabus_node_leaf_idx" ON "study"."syllabus_node" USING btree ("syllabus_id","is_leaf");--> statement-breakpoint
CREATE INDEX "syllabus_node_citations_gin_idx" ON "study"."syllabus_node" USING gin ("citations" jsonb_path_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "syllabus_node_link_unique" ON "study"."syllabus_node_link" USING btree ("syllabus_node_id","knowledge_node_id");--> statement-breakpoint
CREATE INDEX "syllabus_node_link_by_syllabus_node_idx" ON "study"."syllabus_node_link" USING btree ("syllabus_node_id");--> statement-breakpoint
CREATE INDEX "syllabus_node_link_by_knowledge_node_idx" ON "study"."syllabus_node_link" USING btree ("knowledge_node_id","syllabus_node_id");--> statement-breakpoint
CREATE INDEX "content_citation_source_idx" ON "study"."content_citations" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "content_citation_target_idx" ON "study"."content_citations" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "content_citation_card_source_idx" ON "study"."content_citations" USING btree ("source_id") WHERE source_type = 'card';--> statement-breakpoint
CREATE INDEX "content_citation_regulation_target_idx" ON "study"."content_citations" USING btree ("target_id") WHERE target_type = 'regulation_node';--> statement-breakpoint
CREATE UNIQUE INDEX "content_citation_source_target_unique" ON "study"."content_citations" USING btree ("source_type","source_id","target_type","target_id");--> statement-breakpoint
CREATE INDEX "hangar_job_status_idx" ON "hangar"."job" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "hangar_job_kind_idx" ON "hangar"."job" USING btree ("kind","created_at");--> statement-breakpoint
CREATE INDEX "hangar_job_target_idx" ON "hangar"."job" USING btree ("target_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX "hangar_job_actor_idx" ON "hangar"."job" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "hangar_job_log_job_idx" ON "hangar"."job_log" USING btree ("job_id","seq");--> statement-breakpoint
CREATE INDEX "hangar_reference_dirty_idx" ON "hangar"."reference" USING btree ("dirty") WHERE "hangar"."reference"."dirty" = true;--> statement-breakpoint
CREATE INDEX "hangar_reference_updated_idx" ON "hangar"."reference" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "hangar_reference_live_idx" ON "hangar"."reference" USING btree ("id") WHERE "hangar"."reference"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "hangar_source_type_idx" ON "hangar"."source" USING btree ("type");--> statement-breakpoint
CREATE INDEX "hangar_source_dirty_idx" ON "hangar"."source" USING btree ("dirty") WHERE "hangar"."source"."dirty" = true;--> statement-breakpoint
CREATE INDEX "hangar_source_live_idx" ON "hangar"."source" USING btree ("id") WHERE "hangar"."source"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "hangar_sync_log_actor_idx" ON "hangar"."sync_log" USING btree ("actor_id","started_at");--> statement-breakpoint
CREATE INDEX "hangar_sync_log_outcome_idx" ON "hangar"."sync_log" USING btree ("outcome","started_at");--> statement-breakpoint
CREATE INDEX "sim_attempt_user_scenario_ended_idx" ON "sim"."attempt" USING btree ("user_id","scenario_id","ended_at");--> statement-breakpoint
CREATE INDEX "sim_attempt_user_ended_idx" ON "sim"."attempt" USING btree ("user_id","ended_at");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit"."audit_log" USING btree ("actor_id","timestamp");--> statement-breakpoint
CREATE INDEX "audit_log_target_idx" ON "audit"."audit_log" USING btree ("target_type","target_id","timestamp");