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
	"target_date" timestamp with time zone,
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
	CONSTRAINT "syllabus_node_ordinal_check" CHECK ("ordinal" >= 0)
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
ALTER TABLE "study"."knowledge_node" ADD COLUMN "references_v2_migrated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "study"."study_plan" ADD COLUMN "goal_migrated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "study"."credential_prereq" ADD CONSTRAINT "credential_prereq_credential_id_credential_id_fk" FOREIGN KEY ("credential_id") REFERENCES "study"."credential"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."credential_prereq" ADD CONSTRAINT "credential_prereq_prereq_id_credential_id_fk" FOREIGN KEY ("prereq_id") REFERENCES "study"."credential"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."credential_syllabus" ADD CONSTRAINT "credential_syllabus_credential_id_credential_id_fk" FOREIGN KEY ("credential_id") REFERENCES "study"."credential"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."credential_syllabus" ADD CONSTRAINT "credential_syllabus_syllabus_id_syllabus_id_fk" FOREIGN KEY ("syllabus_id") REFERENCES "study"."syllabus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."goal" ADD CONSTRAINT "goal_user_id_bauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."goal_node" ADD CONSTRAINT "goal_node_goal_id_goal_id_fk" FOREIGN KEY ("goal_id") REFERENCES "study"."goal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."goal_node" ADD CONSTRAINT "goal_node_knowledge_node_id_knowledge_node_id_fk" FOREIGN KEY ("knowledge_node_id") REFERENCES "study"."knowledge_node"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."goal_syllabus" ADD CONSTRAINT "goal_syllabus_goal_id_goal_id_fk" FOREIGN KEY ("goal_id") REFERENCES "study"."goal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."goal_syllabus" ADD CONSTRAINT "goal_syllabus_syllabus_id_syllabus_id_fk" FOREIGN KEY ("syllabus_id") REFERENCES "study"."syllabus"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."syllabus" ADD CONSTRAINT "syllabus_superseded_by_id_syllabus_id_fk" FOREIGN KEY ("superseded_by_id") REFERENCES "study"."syllabus"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."syllabus" ADD CONSTRAINT "syllabus_reference_id_reference_id_fk" FOREIGN KEY ("reference_id") REFERENCES "study"."reference"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."syllabus_node" ADD CONSTRAINT "syllabus_node_syllabus_id_syllabus_id_fk" FOREIGN KEY ("syllabus_id") REFERENCES "study"."syllabus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."syllabus_node" ADD CONSTRAINT "syllabus_node_parent_id_syllabus_node_id_fk" FOREIGN KEY ("parent_id") REFERENCES "study"."syllabus_node"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."syllabus_node_link" ADD CONSTRAINT "syllabus_node_link_syllabus_node_id_syllabus_node_id_fk" FOREIGN KEY ("syllabus_node_id") REFERENCES "study"."syllabus_node"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."syllabus_node_link" ADD CONSTRAINT "syllabus_node_link_knowledge_node_id_knowledge_node_id_fk" FOREIGN KEY ("knowledge_node_id") REFERENCES "study"."knowledge_node"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
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
CREATE INDEX "syllabus_node_link_by_knowledge_node_idx" ON "study"."syllabus_node_link" USING btree ("knowledge_node_id","syllabus_node_id");