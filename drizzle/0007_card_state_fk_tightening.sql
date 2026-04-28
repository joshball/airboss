-- Card-state + session-item-result FK tightening
-- See docs/work-packages/card-state-fk-tightening/spec.md
--
-- Replaces single-column FKs on `card_state.user_id` and
-- `session_item_result.user_id` (which were denormalized copies of the
-- owning `card.user_id` / `session.user_id`) with composite FKs that
-- structurally lock those columns to the parent row's user. The composite
-- FKs require unique indexes on the parent (id, user_id) tuples, which we
-- create first.

CREATE UNIQUE INDEX "card_id_user_unique" ON "study"."card" USING btree ("id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_id_user_unique" ON "study"."session" USING btree ("id","user_id");--> statement-breakpoint
ALTER TABLE "study"."card_state" DROP CONSTRAINT "card_state_card_id_card_id_fk";--> statement-breakpoint
ALTER TABLE "study"."card_state" DROP CONSTRAINT "card_state_user_id_bauth_user_id_fk";--> statement-breakpoint
ALTER TABLE "study"."session_item_result" DROP CONSTRAINT "session_item_result_session_id_session_id_fk";--> statement-breakpoint
ALTER TABLE "study"."session_item_result" DROP CONSTRAINT "session_item_result_user_id_bauth_user_id_fk";--> statement-breakpoint
ALTER TABLE "study"."card_state" ADD CONSTRAINT "card_state_card_owner_fk" FOREIGN KEY ("card_id","user_id") REFERENCES "study"."card"("id","user_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."session_item_result" ADD CONSTRAINT "session_item_result_session_owner_fk" FOREIGN KEY ("session_id","user_id") REFERENCES "study"."session"("id","user_id") ON DELETE cascade ON UPDATE cascade;
