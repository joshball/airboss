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
ALTER TABLE "study"."content_citations" ADD CONSTRAINT "content_citations_created_by_bauth_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."bauth_user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "content_citation_source_idx" ON "study"."content_citations" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "content_citation_target_idx" ON "study"."content_citations" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "content_citation_card_source_idx" ON "study"."content_citations" USING btree ("source_id") WHERE source_type = 'card';--> statement-breakpoint
CREATE INDEX "content_citation_regulation_target_idx" ON "study"."content_citations" USING btree ("target_id") WHERE target_type = 'regulation_node';--> statement-breakpoint
CREATE UNIQUE INDEX "content_citation_source_target_unique" ON "study"."content_citations" USING btree ("source_type","source_id","target_type","target_id");