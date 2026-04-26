-- Per-(user, deckHash) overlay for the Saved Decks dashboard surface.
--
-- The dashboard's Saved Decks list is otherwise implicit: every distinct
-- `deck_hash` carried on a `memory_review_session` row contributes an
-- entry. This table lets a learner attach a custom label or dismiss an
-- entry from the dashboard without touching the underlying review-session
-- history.
--
-- Backed by `libs/bc/study/src/saved-decks.ts` (renameSavedDeck /
-- deleteSavedDeck) and read by `listSavedDecks` via a left-join overlay.
-- Re-running the same filter or renaming a previously-dismissed deck
-- clears `dismissed_at` so the entry returns.

CREATE TABLE "study"."saved_deck" (
	"id"            text PRIMARY KEY NOT NULL,
	"user_id"       text NOT NULL,
	"deck_hash"     text NOT NULL,
	"label"         text,
	"dismissed_at"  timestamp with time zone,
	"created_at"    timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at"    timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_deck_label_length_check"
		CHECK ("label" IS NULL OR char_length("label") <= 80),
	CONSTRAINT "saved_deck_label_non_empty_check"
		CHECK ("label" IS NULL OR char_length("label") > 0)
);
--> statement-breakpoint

ALTER TABLE "study"."saved_deck"
	ADD CONSTRAINT "saved_deck_user_id_bauth_user_id_fk"
	FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id")
	ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint

CREATE UNIQUE INDEX "saved_deck_user_hash_unique"
	ON "study"."saved_deck" ("user_id", "deck_hash");
--> statement-breakpoint

CREATE INDEX "saved_deck_user_active_idx"
	ON "study"."saved_deck" ("user_id", "deck_hash")
	WHERE dismissed_at IS NULL;
