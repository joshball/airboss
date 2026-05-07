---
pr: 221
date: 2026-04-26
title: "feat(study): rename + delete affordance for saved decks"
wp_id: null
bugs_fixed: []
summary: |
  Adds study.saved_deck overlay table keyed (user_id, deck_hash) with optional label + dismissed_at. The dashboard's Saved Decks list stays implicit on memory_review_session.deck_hash; this row only appears when a learner renames or dismisses an entry. New BC functions renameSavedDeck / deleteSavedDeck / normalizeSavedDeckLabel (in libs/bc/study/src/saved-decks.ts). Length-bounded by a new SAVED_DECK_LABEL_MAX_LENGTH constant (80 chars), enforced at the BC + a CHECK constraint at the column. listSavedDecks joins the overlay so the custom label surfaces and dismissed entries are filtered out....
---
