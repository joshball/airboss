---
title: 'Out of Scope: Review Sessions URL'
product: study
feature: review-sessions-url
type: out-of-scope
status: unread
---

# Out of Scope: Review Sessions URL

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                        | Status       | Trigger to revisit                                                 |
| ------------------------------------------- | ------------ | ------------------------------------------------------------------ |
| Jump-to-card dropdown (item 15)             | Follow-on WP | After (a) Resume ships; jumps need their own peek-policy decision  |
| Cross-user session sharing                  | Rejected     | Never -- see detail below                                          |
| FSRS scheduling mutation from URL entry     | Rejected     | Never -- see detail below                                          |
| Backfill of historical sessions             | Rejected     | Never -- see detail below                                          |
| Save-current-run-as-deck shortcut           | Deferred     | When usage data shows users reconstruct the same filter via Browse |
| `abandoned` session retention beyond 1/deck | Deferred     | When dashboard surfacing of older abandoned runs becomes valuable  |
| `deck_hash` carrying FSRS-params version    | Deferred     | When FSRS optimization / tuning lands and changes filter outputs   |

## Jump-to-card dropdown (item 15)

Status: Follow-on WP

What was deferred:
Turning `Card 1 of 12` into a jump-to-card dropdown that lets the user move to an arbitrary card in the current session.

Why:
Jumping around a live session changes the FSRS ordering semantics. The product decision (do jumps count as peeks? can the user re-rate a peeked card?) needs to be made deliberately, not slipped in alongside the URL substrate. Per the verdict pass, the dropdown shipped via PR #169 once the URL substrate landed.

Trigger to revisit:
After (a) Resume ships and the session has a stable id (already true on main). Then the dropdown can be built without contaminating the substrate decisions.

Implementation pattern when triggered:
Mirror the dropdown that shipped in PR #169 in `apps/study/src/routes/(app)/memory/review/[sessionId]/+page.svelte`. Reuse the route constant `ROUTES.MEMORY_REVIEW_SESSION` at `libs/constants/src/routes.ts:123`.

References:

- `docs/work-packages/review-sessions-url/spec.md` "Out of scope"
- `docs/work-packages/review-flow-v2/spec.md` mirrors this deferral
- `docs/work/.archive/todos/20260424-02-smi-walkthrough-feedback.md` item 15
- PR #169

## Cross-user session sharing

Status: Rejected

What was rejected:
A "here's my run, try it" mode where another user can load and walk the same session a peer just completed.

Why:
The Resume layer is explicitly private; the Redo layer covers the reproducible-entry-point use case via a filter hash. Cross-user sharing pulls in privacy, anonymization, attribution, and rating-history semantics that are not justified by any current user request. The Share button is also wired to copy the per-card URL, not the session URL, which closes the natural shortcut.

Trigger to revisit:
Never -- see detail above. A future "study with a friend" or social study feature would open its own WP with explicit privacy and attribution scope.

References:

- `docs/work-packages/review-sessions-url/spec.md` "Out of scope"
- ADR 013 (URL state taxonomy) -- `docs/decisions/013-url-state-taxonomy.md`

## FSRS scheduling mutation from URL entry

Status: Rejected

What was rejected:
Any URL-driven mutation of FSRS scheduling state. The session is treated as a traversal view, not a schedule editor.

Why:
URLs are an entry point for viewing and replaying, not for editing the schedule. Allowing URL-driven schedule mutation would make sessions a side-channel for FSRS state and would invite accidental schedule corruption (a stale bookmark, a shared link, a refresh after a session expires). Keeping the substrate side-effect-free is a hard line.

Trigger to revisit:
Never -- see detail above. Schedule edits flow through the BC review-write path and the snooze / remove / restore actions, never through URL parameters.

References:

- `docs/work-packages/review-sessions-url/spec.md` "Out of scope"
- `docs/decisions/012-reps-session-substrate.md` (session substrate boundary)

## Backfill of historical sessions

Status: Rejected

What was rejected:
Synthesizing `memory_review_session` rows for review history that predates the table's existence.

Why:
Old reviews lack the deck composition signal needed to reconstruct a coherent session. Inventing sessions retroactively would produce false dashboard tiles and fake resume affordances, and the engineering cost is high for no learner value. New sessions only is the simple, correct rule.

Trigger to revisit:
Never -- see detail above. A separate analytics or historical-replay WP could revisit if there is a concrete reason to reconstruct past runs, but the substrate explicitly opts out.

References:

- `docs/work-packages/review-sessions-url/spec.md` "Out of scope"

## Save-current-run-as-deck shortcut

Status: Deferred

What was deferred:
A "save this deck" button on a run in progress that creates a Redo entry from the current filter without requiring the user to reconstruct it via Browse.

Why:
The spec lists this as a non-blocking open question with a default answer: require the user to construct the filter via Browse / dashboard. The reasoning is that the value is unclear without usage data, and a save-on-the-fly button adds review-chrome surface area that the user might never invoke.

Trigger to revisit:
When usage data shows users repeatedly reconstruct the same filter via Browse, or a user explicitly asks for the shortcut.

Implementation pattern when triggered:
Add a small "Save this run as a deck" affordance to the session chrome that resolves the current `deck_hash` from the session row and copies the canonical Redo URL to the clipboard. No new table -- the existing `deck_spec` jsonb on `memory_review_session` already encodes the filter.

References:

- `docs/work-packages/review-sessions-url/spec.md` "Open questions"

## `abandoned` session retention beyond 1/deck

Status: Deferred

What was deferred:
Surfacing more than one abandoned session per `deck_hash` on the dashboard. The default is "resurface at most one abandoned session per deck; older abandoned sessions are history only."

Why:
The dashboard is a "what should I do next?" surface, not a session archive. Showing multiple abandoned runs of the same deck adds clutter without obvious value. The default keeps the dashboard focused and lets the rest live in history.

Trigger to revisit:
When the dashboard adds a "history" or "runs" affordance, or when users explicitly ask to resume an older abandoned run on the same deck.

Implementation pattern when triggered:
The `(user_id, deck_hash, status)` index already supports the query. The change is purely on the dashboard query: drop the "at most one abandoned per deck" filter and let the existing `(user_id, started_at desc)` index drive ordering.

References:

- `docs/work-packages/review-sessions-url/spec.md` "Open questions"

## `deck_hash` carrying FSRS-params version

Status: Deferred

What was deferred:
Including a FSRS-params version in the `deck_hash` so filter results remain reproducible across FSRS parameter changes.

Why:
The current `deck_hash` is `SHA-1(canonical filter JSON) first 8 chars`. A change to FSRS parameters can shift which cards a given filter resolves to (e.g., "due" or "interval" semantics shift). The current substrate happily lets the deck shift -- which is correct when the user just wants "today's airspace due cards" but would surprise a user who bookmarked "my exact set."

Trigger to revisit:
When FSRS optimization or tuning lands and we observe a real case of a bookmarked Redo URL behaving differently after a parameter bump.

Implementation pattern when triggered:
Add a `fsrs_version` field to the canonical filter JSON before hashing. The `deck_spec` jsonb already stores the filter, so the version becomes a normal field; the hash becomes deterministic per FSRS-params version. Migrate the resolver to accept old hashes via a fallback path.

References:

- `docs/work-packages/review-sessions-url/spec.md` "Open questions"
- `docs/decisions/012-reps-session-substrate.md`
