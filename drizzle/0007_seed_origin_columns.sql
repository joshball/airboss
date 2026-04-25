ALTER TABLE "study"."card" ADD COLUMN "seed_origin" text;--> statement-breakpoint
ALTER TABLE "study"."knowledge_node" ADD COLUMN "seed_origin" text;--> statement-breakpoint
ALTER TABLE "study"."review" ADD COLUMN "seed_origin" text;--> statement-breakpoint
ALTER TABLE "study"."scenario" ADD COLUMN "seed_origin" text;--> statement-breakpoint
ALTER TABLE "study"."session" ADD COLUMN "seed_origin" text;--> statement-breakpoint
ALTER TABLE "study"."session_item_result" ADD COLUMN "seed_origin" text;--> statement-breakpoint
ALTER TABLE "study"."study_plan" ADD COLUMN "seed_origin" text;