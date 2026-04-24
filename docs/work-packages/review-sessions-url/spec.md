---
title: 'review-sessions-url'
status: draft
size: medium
depends_on: [review-flow-v2 (shares review chrome)]
created: 2026-04-24
---

# Review Sessions URL

## One-sentence summary

Give memory review sessions real URL identity so they can be resumed, redone from a filter, and share individual cards without leaking session state.

## Why

SMI walkthrough item 18 flagged that `/memory/review` has no concept of "this run." Close the tab and the progress is gone. There is no bookmarkable "my daily airspace review." Share buttons don't exist, and even if they did, the user's intent is usually "show someone this specific card," not "show someone my run."

Aligns with ADR 013 (URL state taxonomy): session identity belongs in the path, reproducible filters belong in the query string, and card identity belongs in its own canonical URL.

Source items: `docs/work/todos/20260424-02-smi-walkthrough-feedback.md` items 15, 18.

## In scope

Three URL layers, landed in order:

- (a) Resume: `/memory/review/<sessionId>`. A review session has a durable id. Close + reopen the URL -> same card list, same position, same rating history so far. Summary state when the run is complete.
- (b) Redo: `/memory/review?deck=<filterHash>`. A filter spec (domain + deck type + due-only + card_type + tags) that yields a reproducible entry point. Each visit starts a fresh session.
- (c) Share: card detail URL already exists (`/memory/<id>`; `card-page-and-cross-references` adds `/cards/<id>` as the shareable public page). Share button in the review screen copies the card URL, not the session URL.

## Out of scope

- Item 15 "Card 1 of 12" as a jump-to-card dropdown. Revisit after (a) ships; jumping around a live session changes the FSRS ordering semantics, and we need to decide separately whether jumps are allowed and whether they count as peeks.
- Cross-user session sharing ("here's my run, try it"). (b) covers the reproducible entry point; (a) stays private.
- Any mutation of FSRS scheduling from URL entry. The session is a traversal view, not a schedule editor.
- Backfill of historical sessions. New sessions only.

## Product decisions the user needs to make

1. **`memory_review_session` table shape**

   - Options:
     - (A) One row per session, item list as `jsonb` (`card_id_list`), current position as int.
     - (B) Parent row + child `memory_review_session_item` rows with explicit order.
   - Recommendation: (A) for v1. The item list is set at session start from the filter and not mutated; a jsonb array is simpler and faster to load. If the snooze/remove mid-session replacement grows into "edit the list on the fly," revisit. Flag the trigger in the spec.
   - Affects: resume query, replacement-flow wiring.

2. **Filter-hash format for (b) Redo**

   - Options:
     - (A) URL-encoded query string: `?deck=domain:airspace,due:true,type:basic`.
     - (B) Canonical JSON + short content-hash: `?deck=h_<hash>` with the JSON resolved server-side (requires a lookup table).
     - (C) Canonical JSON base64url'd into the URL.
   - Recommendation: (C) canonical JSON base64url'd. Bookmarkable without a server lookup, human-readable after decoding, deterministic. Add a `deckHash` derivation (SHA-1 first 8 chars) stored on each resulting session row so we can cluster "all runs of the same deck" for later analytics. No DB table needed for the filter itself.
   - Affects: filter-resolver helper, `memory_review_session.deck_hash` column, Browse/dashboard bookmarks.

3. **Session expiry for (a) Resume**

   - Options: no expiry (sessions live forever)/expire after 7 days if incomplete/expire at end of day.
   - Recommendation: no hard expiry; mark as `abandoned` if not touched for 14 days so the dashboard can surface them. User can still resume an abandoned run. Completed runs stay forever as history.
   - Affects: `memory_review_session.status` + background job (cheap; can be a lazy check on visit).

4. **Session identity reuse on the same deck**

   - Options: each visit to `?deck=<hash>` creates a new session/the latest incomplete session for the same `deck_hash` is resumed automatically/the user chooses (continue vs fresh).
   - Recommendation: user chooses. On visit to `?deck=<hash>`, if there is an incomplete session for the same deck_hash, show a short inline prompt: "Resume your in-progress run (12 of 20)?" with Resume/Start fresh. Fresh creates a new session; Resume redirects to `/memory/review/<sessionId>`.
   - Affects: the `/memory/review?deck=<hash>` entry-route component.

5. **Share button payload**

   - Options: copy card URL only/copy card URL + open a popover with Report + Copy.
   - Recommendation: popover with two actions: `Copy card link` (goes to `/cards/<id>` from `card-page-and-cross-references`) and `Report this card` (hands off to the `snooze-and-flag` flag flow). Rationale: "share" and "flag" are the two things the reviewer is likely to do when they want to exit the card sideways.
   - Affects: review-chrome share button + popover, cross-WP wiring.

## Data model

```typescript
// study.memory_review_session
{
  id: text primary key,                  // mrs_ prefix
  user_id: text not null references identity.user(id),
  deck_hash: text not null,              // SHA-1(canonical filter JSON) first 8 chars
  deck_spec: jsonb not null,             // the canonical filter JSON itself
  card_id_list: jsonb not null,          // ordered array of card ids at session creation time
  current_index: integer not null default 0,
  status: text not null default 'active',// 'active' | 'completed' | 'abandoned'
  started_at: timestamptz not null default now(),
  last_activity_at: timestamptz not null default now(),
  completed_at: timestamptz,             // null while active
}
```

Indexes:

- `(user_id, deck_hash, status)` to resolve "my incomplete run of this deck."
- `(user_id, started_at desc)` for dashboard history.

No changes to `study.review`/`study.card_state`. A review written during a session writes its `session_id` on `session_item_result` (already exists per the reps substrate per ADR 012).

Routes (in `libs/constants/src/routes.ts`):

```typescript
ROUTES.MEMORY_REVIEW                       // '/memory/review' (existing, now with ?deck= support)
ROUTES.MEMORY_REVIEW_SESSION(sessionId)    // '/memory/review/<sessionId>'
```

## UI sketch

New routes and behaviors:

```text
/memory/review                          -> dashboard; shows active/resumable sessions
/memory/review?deck=<hash>              -> resolver; offers Resume (if match exists) or Start fresh
/memory/review/<sessionId>              -> the review itself; identical chrome to current review screen,
                                           plus a "Session 3 of 20 - started 14:02" affordance
```

Share affordance in review chrome:

```text
[Share v]
   Copy card link     -> clipboard: /cards/<id>
   Report this card   -> opens snooze-and-flag "Bad question" popover
```

Dashboard addition (`/memory`):

- A compact "Resume your last run" tile when an active/abandoned session exists for the user, linking to `/memory/review/<sessionId>`.

## Open questions (non-blocking)

- Whether the Redo entry should be creatable from the current review (a "save this deck" button on a run in progress). Default: no, require the user to construct the filter via Browse/dashboard. Revisit with usage data.
- Whether `abandoned` sessions should be resurfaced on the dashboard for N days or indefinitely. Default: resurface while there is at most one abandoned session per deck_hash; older abandoned sessions are history only.
- Whether `deck_hash` should include a FSRS-params version so filter results remain reproducible after FSRS tuning. Revisit when FSRS optimization lands.

## Build sequencing notes

Internal order locked:

1. **(a) Resume.** Schema + BC + route. This is the substrate.
2. **(b) Redo.** Filter-hash encoder/decoder + resolver route + dashboard bookmarks.
3. **(c) Share.** Popover + Report wiring (handoff to `snooze-and-flag` flag flow).

Do not bundle (a) with (b) in a single PR. The resume surface needs to burn in before we layer bookmarkable entry points on top.

## References

- `docs/work/todos/20260424-02-smi-walkthrough-feedback.md` items 15, 18
- `docs/work/handoffs/20260424-session-state-smi-walkthrough.md` work package scope summaries
- `docs/decisions/013-url-state-taxonomy.md` URL-state tiers (path for identity, query for filters)
- `docs/decisions/012-reps-session-substrate.md` existing session substrate (reps and review sessions share the substrate)
- `docs/work-packages/card-page-and-cross-references/spec.md` (c) Share target lives here
- `docs/work-packages/snooze-and-flag/spec.md` Report hand-off target
- `libs/constants/src/routes.ts` new route entries
