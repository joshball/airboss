---
title: 'snooze-and-flag'
status: deferred
size: large
depends_on: [review-flow-v2 (shares review chrome)]
created: 2026-04-24
deferred_at: 2026-04-28
trigger: review-flow-v2 unblocks (locked or shipped), AND the next SMI walkthrough re-raises items 10 / 11 (snooze duration UI, mid-session replacement). At that point, run /ball-wp-spec to lock product decisions and ship the substrate.
---

# Snooze and Flag

## One-sentence summary

Give the reviewer a single Snooze action with typed reasons (including a bad-question author-review loop and a reversible remove) plus a separate per-card content-quality feedback channel.

## Why

SMI walkthrough items 10 and 11 surfaced two distinct needs that today's review flow can't express:

- The reviewer wants to push a card out even when they know it, or flag it as bad, or say "this belongs to a different domain," or remove it outright, all without polluting the FSRS signal.
- The reviewer wants to rate the content quality (like/dislike/flag) separately from rating their own recall.

Source items: `docs/work/.archive/todos/20260424-02-smi-walkthrough-feedback.md` items 10, 11.

## In scope

- Single `Snooze` button in the review chrome. Opens a menu with reason codes: `bad-question`, `wrong-domain`, `know-it-bored`, `remove`.
- Per reason, the post-snooze behavior:

  | Reason          | Behavior                                                                                                  |
  | --------------- | --------------------------------------------------------------------------------------------------------- |
  | `bad-question`  | Comment required. Card snoozes for default duration OR until author edits it. Enters author-review queue. |
  | `wrong-domain`  | Comment required. Long snooze (60d default) or user-selectable "exclude from deck."                       |
  | `know-it-bored` | No comment required. Three duration levels as constants.                                                  |
  | `remove`        | Comment required. Card soft-removed from user's deck. Reversible from Browse.                             |

- Three snooze-duration constants (short/medium/long) in `libs/constants/src/study.ts`. No slider.
- Mid-session replacement policy: shrink the deck on `snooze` (the queue just gets shorter); pull a same-domain replacement on `remove`.
- Author-review re-entry banner: when a `bad-question` card is edited by the author, it re-enters the user's deck with the explicit banner "This card was updated. Does it look better now?"
- Per-card content feedback pill: `like`, `dislike`, `flag`. Separate from the recall rating. Dislike requires a comment. Flag funnels into the same author-review queue as `bad-question`.
- Browse surfacing: soft-removed cards are reachable via a `Removed` filter on `/memory/browse` and can be restored with one click.

## Out of scope

- Admin-facing author-review queue UI. That lives in a future Hangar surface; reasoning: Hangar is the authoring app, not the user-facing study app, and the queue is a triage workflow not a study action. This WP lands the data and the user-side only; the admin queue is a separate WP when Hangar grows content-moderation views.
- Taxonomy reassignment when a `wrong-domain` flag resolves. That is a Hangar concern too.
- Community-visible feedback (public likes, public flags). All feedback is private to the user and the content author.
- Bulk snooze/bulk remove. Single-card only in v1.

## Product decisions the user needs to make

1. **Storage shape: new table vs columns on `session_item_result`**

   - Options:
     - (A) New `study.card_snooze` table. One row per snooze action. Columns: `id`, `card_id`, `user_id`, `reason`, `comment`, `duration_level`, `snooze_until`, `created_at`, `resolved_at` (nullable; for `bad-question` when the author edits).
     - (B) Columns on `session_item_result`: `snooze_reason`, `snooze_comment`, `snooze_until`.
   - Recommendation: (A) new `study.card_snooze` table. It cleanly separates the snooze lifecycle (bad-question's wait-for-edit loop is not tied to a session row), supports the admin author-review queue as a direct query target, and keeps `session_item_result` focused on "what happened during one review."
   - Affects: every data-path in this WP, replacement-flow query, Browse filter query, future Hangar queue query.

2. **`remove` as soft-remove semantics**

   - Options: flag on `card_state` (`status = 'removed'`)/dedicated row in `card_snooze` with reason `remove` and no `snooze_until`.
   - Recommendation: dedicated row in `card_snooze` with `reason = 'remove'`, `snooze_until = NULL`, and a UNIQUE partial index on `(card_id, user_id) WHERE reason = 'remove' AND resolved_at IS NULL`. Restoring from Browse writes `resolved_at`. This keeps the historical trail intact and avoids overloading `card_state`.
   - Affects: Browse filter, read functions that respect "removed" state, FSRS scheduler exclusions.

3. **Content feedback storage: same table or separate?**

   - Options: reuse `card_snooze` with `reason` values for `like`/`dislike`/`flag`/extend/new `card_feedback` table.
   - Recommendation: new `study.card_feedback` table. Content opinions are not schedule actions; mixing them into `card_snooze` conflates lifecycles. Columns: `id`, `card_id`, `user_id`, `signal` (`like`/`dislike`/`flag`), `comment`, `created_at`. Flag rows surface in the same author queue as `bad-question` snoozes via a UNION in the admin query.
   - Affects: review chrome wiring, future Hangar queue query.

4. **Snooze duration levels (values)**

   - Options: 1d/7d/30d, or 3d/14d/60d, or named (short/medium/long) with admin-tunable values.
   - Recommendation: 3d/14d/60d as constants named `SNOOZE_DURATION_SHORT`, `SNOOZE_DURATION_MEDIUM`, `SNOOZE_DURATION_LONG` in `libs/constants/src/study.ts`. Reason-specific defaults: `know-it-bored` defaults to medium (14d), `bad-question` to medium with "until fixed" override, `wrong-domain` to long (60d).
   - Affects: the durations constant, reason-menu defaults.

5. **Re-entry banner delivery**

   - Options: show the banner on the very next review session after the edit/show it on every appearance until the user rates the card again/show it for a configurable number of appearances.
   - Recommendation: show on the next one appearance of the card, then suppress. Record `resolved_at` when the user rates the re-entered card (any rating, including a second `bad-question` snooze).
   - Affects: `card_snooze.resolved_at`, review-route banner logic.

6. **Replacement candidate query for `remove`**

   - Options: strictly same-domain due/same-domain due-or-new/any-domain due.
   - Recommendation: same-domain due first, then same-domain new if no due. If neither exists, the queue just gets shorter for this session. Do not cross-domain replace; the user's expectation was domain-continuous.
   - Affects: review BC `getReplacementCard` query.

## Data model

New tables in the `study` schema namespace. IDs use `prefix_ULID` via `@ab/utils` `createId()`.

```typescript
// study.card_snooze
{
  id: text primary key,              // csnz_ prefix
  card_id: text not null references study.card(id),
  user_id: text not null references identity.user(id),
  reason: text not null,             // 'bad-question' | 'wrong-domain' | 'know-it-bored' | 'remove'
  comment: text,                     // required for bad-question, wrong-domain, remove; nullable for know-it-bored
  duration_level: text,              // 'short' | 'medium' | 'long'; nullable for 'remove'
  snooze_until: timestamptz,         // null for 'remove' (indefinite) and 'bad-question' waiting-on-edit
  resolved_at: timestamptz,          // null while active; set when user re-rates, card edited, or restored from Browse
  created_at: timestamptz not null default now(),
}

// Unique active-remove per (card, user)
// create unique index on study.card_snooze (card_id, user_id)
//   where reason = 'remove' and resolved_at is null;

// study.card_feedback
{
  id: text primary key,              // cfbk_ prefix
  card_id: text not null references study.card(id),
  user_id: text not null references identity.user(id),
  signal: text not null,             // 'like' | 'dislike' | 'flag'
  comment: text,                     // required for 'dislike' and 'flag'; nullable for 'like'
  created_at: timestamptz not null default now(),
}
```

New constants in `libs/constants/src/study.ts`:

```typescript
export const SNOOZE_REASONS = {
  BAD_QUESTION: 'bad-question',
  WRONG_DOMAIN: 'wrong-domain',
  KNOW_IT_BORED: 'know-it-bored',
  REMOVE: 'remove',
} as const;

export const SNOOZE_DURATION_DAYS = {
  SHORT: 3,
  MEDIUM: 14,
  LONG: 60,
} as const;

export const CARD_FEEDBACK_SIGNALS = {
  LIKE: 'like',
  DISLIKE: 'dislike',
  FLAG: 'flag',
} as const;
```

## UI sketch

Review screen additions:

```text
+----------------------------------------------+
| Card 3 of 12    [?]  Airspace        [Snooze]|
+----------------------------------------------+
|  question / answer ...                        |
+----------------------------------------------+
|  [like] [dislike] [flag]                      |
+----------------------------------------------+
|  [Wrong] [Hard] [Right] [Easy]                |
+----------------------------------------------+

Snooze popover:
  ( ) Bad question       (comment required)
  ( ) Wrong domain       (comment required)
  ( ) Know it (bored)    Short / Medium / Long
  ( ) Remove from deck   (comment required)
  [ Cancel ]  [ Snooze ]
```

Browse additions:

- New filter chip `Removed` alongside existing `Active / Suspended / Archived`. Selected rows expose a `Restore` button.

Re-entry banner on the review card (when applicable):

```text
+----------------------------------------------+
| This card was updated. Does it look better?   |
+----------------------------------------------+
| ... card front ...                            |
```

## Open questions (non-blocking)

- Hangar-side author-review queue layout. Deferred with trigger: begin when Hangar grows a moderation surface. Captured as a follow-up WP, not in this one.
- Whether `like` should be silent (no side-effect) or nudge FSRS toward longer intervals. Default: silent; revisit with data.
- Whether `wrong-domain` can optionally hard-exclude the card from the deck forever (rather than long snooze). Decide at build time; default to 60d snooze.

## Build sequencing notes

1. Constants + schema (card_snooze + card_feedback + indexes + migration).
2. BC functions: `snoozeCard`, `removeCard`, `restoreCard`, `submitFeedback`, `getReplacementCard`, `getActiveSnoozes`. FSRS scheduler honors active snoozes and removes.
3. Review-route Snooze button + reason popover.
4. Review-route per-card feedback pill.
5. Replacement flow wiring (shrink on snooze, replace on remove).
6. Browse `Removed` filter and Restore action.
7. Re-entry banner path (triggered when a `bad-question` row's card gets edited; wiring to card edit side is minimal: on card update, mark matching unresolved `bad-question` rows with a `resolved_at = null` + `edited_since = now()` flag that the review queue picks up. Alternative: set `snooze_until = now()` on author edit; specify at build).

## References

- `docs/work/.archive/todos/20260424-02-smi-walkthrough-feedback.md` items 10, 11
- `docs/work/handoffs/20260424-session-state-smi-walkthrough.md` work package scope summaries + Product decisions locked in
- `docs/work-packages/spaced-memory-items/spec.md` existing review flow + FSRS scheduler
- `libs/constants/src/study.ts` existing study constants (`REVIEW_RATINGS`, `CARD_TYPES`, `DOMAINS`)
- `docs/work-packages/review-flow-v2/spec.md` shares review chrome
