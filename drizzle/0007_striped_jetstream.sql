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
ALTER TABLE "study"."handbook_section_errata" ADD CONSTRAINT "handbook_section_errata_section_id_handbook_section_id_fk" FOREIGN KEY ("section_id") REFERENCES "study"."handbook_section"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "handbook_section_errata_section_errata_idx" ON "study"."handbook_section_errata" USING btree ("section_id","errata_id");--> statement-breakpoint
CREATE INDEX "handbook_section_errata_section_applied_idx" ON "study"."handbook_section_errata" USING btree ("section_id","applied_at");