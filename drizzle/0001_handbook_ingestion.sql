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
	"faa_page_start" integer,
	"faa_page_end" integer,
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
	CONSTRAINT "handbook_section_faa_pages_check" CHECK (("faa_page_start" IS NULL AND "faa_page_end" IS NULL) OR ("faa_page_start" IS NOT NULL AND ("faa_page_end" IS NULL OR "faa_page_end" >= "faa_page_start")))
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
ALTER TABLE "study"."handbook_figure" ADD CONSTRAINT "handbook_figure_section_id_handbook_section_id_fk" FOREIGN KEY ("section_id") REFERENCES "study"."handbook_section"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."handbook_read_state" ADD CONSTRAINT "handbook_read_state_user_id_bauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."handbook_read_state" ADD CONSTRAINT "handbook_read_state_handbook_section_id_handbook_section_id_fk" FOREIGN KEY ("handbook_section_id") REFERENCES "study"."handbook_section"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."handbook_section" ADD CONSTRAINT "handbook_section_reference_id_reference_id_fk" FOREIGN KEY ("reference_id") REFERENCES "study"."reference"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."handbook_section" ADD CONSTRAINT "handbook_section_parent_id_handbook_section_id_fk" FOREIGN KEY ("parent_id") REFERENCES "study"."handbook_section"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study"."reference" ADD CONSTRAINT "reference_superseded_by_id_reference_id_fk" FOREIGN KEY ("superseded_by_id") REFERENCES "study"."reference"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "handbook_figure_section_idx" ON "study"."handbook_figure" USING btree ("section_id","ordinal");--> statement-breakpoint
CREATE INDEX "handbook_read_state_user_status_idx" ON "study"."handbook_read_state" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "handbook_read_state_section_idx" ON "study"."handbook_read_state" USING btree ("handbook_section_id");--> statement-breakpoint
CREATE UNIQUE INDEX "handbook_section_ref_code_unique" ON "study"."handbook_section" USING btree ("reference_id","code");--> statement-breakpoint
CREATE INDEX "handbook_section_tree_idx" ON "study"."handbook_section" USING btree ("reference_id","parent_id","ordinal");--> statement-breakpoint
CREATE INDEX "handbook_section_level_idx" ON "study"."handbook_section" USING btree ("reference_id","level","ordinal");--> statement-breakpoint
CREATE UNIQUE INDEX "reference_doc_edition_unique" ON "study"."reference" USING btree ("document_slug","edition");--> statement-breakpoint
CREATE INDEX "reference_kind_idx" ON "study"."reference" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "reference_doc_superseded_idx" ON "study"."reference" USING btree ("document_slug","superseded_by_id");--> statement-breakpoint
CREATE INDEX "knowledge_node_references_gin_idx" ON "study"."knowledge_node" USING gin ("references" jsonb_path_ops);