---
status: deferred
trigger: as part of the next study schema migration window
source: 2026-04-27 schema review
---

# Tighten `card_state` and `session_item_result` ownership FKs

## Problem

`study.card_state.user_id` is denormalised from `card.user_id` with no DB-level enforcement. Same shape on `study.session_item_result.user_id` denormalised from `session.user_id`. Schema comments claim the write path keeps them consistent, but nothing at the DB layer stops drift.

## Scope

1. Add `UNIQUE(card.id, user_id)` on `card`.
2. Change `card_state.(card_id, user_id) -> card.(id, user_id)` composite FK, ON DELETE CASCADE.
3. Same for `session.(id, user_id)` UNIQUE + `session_item_result.(session_id, user_id) -> session.(id, user_id)`.

OR (simpler): drop `user_id` from `card_state` and `session_item_result` entirely, join through.

## Trigger

Next study schema migration window. No urgency unless drift is observed.
