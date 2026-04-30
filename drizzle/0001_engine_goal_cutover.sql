ALTER TABLE "study"."goal" ADD COLUMN "focus_domains" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "study"."goal" ADD COLUMN "skip_domains" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "study"."goal" ADD COLUMN "skip_nodes" jsonb DEFAULT '[]'::jsonb NOT NULL;