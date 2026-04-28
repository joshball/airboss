---
title: 'card-page-and-cross-references'
status: deferred
size: medium
depends_on: []
created: 2026-04-24
deferred_at: 2026-04-28
trigger: A user wants to share a single card publicly (the original ask behind the card-detail vs card-page split), OR the cross-reference panel becomes a blocker for the cited-by surface across content types. At that point, run /ball-wp-spec to settle owner-only vs public surface scope.
---

# Card Page and Cross-References

## One-sentence summary

Split the card surface in two: an owner-only detail view with cross-reference context, plus a public shareable card page that carries no scheduling internals.

## Why

SMI walkthrough item 4 asked for a way to start a review from the card detail page. The better answer is to split surfaces: `/memory/<id>` stays owner-only (edit, suspend, archive, source, scheduling history, cross-references) and a new `/cards/<id>` is the shareable view (front, back, domain, source, nothing private). The user also asked for cross-references (which sessions, plans, scenarios, and reps include or cite this card) on the owner detail view.

Source items: `docs/work/.archive/todos/20260424-02-smi-walkthrough-feedback.md` item 4 (reframed), plus the new cross-ref ask captured in the session handoff.

## In scope

- New route `/cards/<id>`: public, read-only, shareable. Shows front, back, domain, source badge, any authored citations (from `content-citations` when that WP lands). No scheduling internals. No edit. Safe to link externally.
- Existing route `/memory/<id>`: stays owner-only. Adds a Cross-References panel that lists:
  - Sessions: review sessions that included this card (via `session_item_result.card_id`).
  - Reps: reps that cite this card (when/if reps-to-card enrollment materializes; surface as TBD).
  - Plans: study plans that include this card (plan-to-card enrollment is TBD, see decision 3).
  - Scenarios: scenarios that cite this card (via citations once `content-citations` lands).
- Share button on `/memory/<id>`: copies the public `/cards/<id>` URL. No owner-only leakage.
- Navigation: "Open public view" affordance on `/memory/<id>` for the owner to preview what their card looks like shared.

## Out of scope

- The "review this card now" button. Dropped per locked decision; not replaced. Reason: single-card review outside of a real session would either bypass FSRS scheduling or require inventing a fake session. Neither is worth the payoff.
- Authoring citations. That lives in `content-citations`. This WP only reads them once they exist.
- Plan-to-card enrollment UI. Only the cross-reference read path is in scope, and only if the enrollment data exists by build time; otherwise the Plans row shows "Not available yet."
- Public card comments, likes, or feedback. `/cards/<id>` is a static shareable view in v1.

## Product decisions the user needs to make

1. **Route home for the public card page**

   - Options: under the `study` app (`apps/study/src/routes/cards/[id]/+page.svelte`)/a future public surface (`apps/runway/`)/a new `public` app.
   - Recommendation: under the `study` app for v1. Study already owns cards, card_state, and the review flow. Splitting to Runway when Runway doesn't exist yet is premature. If we later want a marketing-facing surface at `/cards/`, we can move or mount there; the URL stays stable.
   - Affects: route registration, auth guards (public route needs an explicit opt-out from the auth guard).

2. **Access control for `/cards/<id>`**

   - Options: public-with-no-login/public-but-login-optional/owner + invited.
   - Recommendation: public, no login required. Rate-limit by IP on the load function. Cards with `source_type = 'personal'` are still public by default when visited by URL; if the user wants privacy they can suspend or archive (which 404s the public page). Document this clearly on the owner detail page.
   - Affects: auth configuration, load function, `/memory/<id>` help copy.

3. **Cross-references panel scope at ship time**

   - Options: ship all four rows even if some say "not available yet"/ship only rows whose data source exists today/ship sessions + reps now, plans + scenarios behind a flag.
   - Recommendation: ship all four rows with honest empty states. "Plans" says "Plan-to-card enrollment not yet tracked" until that lands. "Scenarios" says "Cite this card from a scenario to see it here" with a link to `content-citations` if merged. Reason: the panel is the right IA; empty rows signal the shape.
   - Affects: panel component, copy.

4. **Suspended/archived card behavior on `/cards/<id>`**

   - Options: 404/show with a banner/show as normal.
   - Recommendation: 404 for suspended and archived. Reason: these are the user's "take this out" signals; honor them on the public surface. Owner-view `/memory/<id>` still shows them (with banner).
   - Affects: public load function.

5. **Share-button destination copy on `/memory/<id>`**

   - Options: copy the `/cards/<id>` URL silently/copy + toast/open popover like `review-sessions-url`.
   - Recommendation: copy + toast on the detail page (single action). The review-screen popover is more complex because the reviewer may also want to Report. On the detail page, share is the only reasonable action.
   - Affects: detail-page header.

## Data model

No new tables. Additions:

- Routes in `libs/constants/src/routes.ts`:

  ```typescript
  ROUTES.CARD_PUBLIC(cardId)      // '/cards/<id>'
  ROUTES.MEMORY_CARD(cardId)      // '/memory/<id>' (existing; document explicitly)
  ```

- Read functions in `libs/bc/study`:

  ```typescript
  getCardCrossReferences(cardId, userId): {
    sessions: Array<{ id: string; startedAt: Date; status: string }>;
    reps: Array<{ id: string; citedAt: Date }>;       // empty until reps-to-card exists
    plans: Array<{ id: string; name: string }>;       // empty until plan-to-card exists
    scenarios: Array<{ id: string; name: string }>;   // empty until content-citations exists
  }
  getPublicCard(cardId): { front; back; domain; sourceType; citations[] } | null
  ```

Queries:

- Sessions: `select session_id, started_at, status from session_item_result join memory_review_session on ... where card_id = ? and user_id = ?`.
- Reps/plans/scenarios: deferred query shape; return empty arrays with a "coming soon" flag until each source exists.

## UI sketch

Owner detail `/memory/<id>`:

```text
+---------------------------------------------+
| Front                                        |
| Back                                         |
|                                              |
| Status: active    Source: Personal [?]       |
| Domain: Airspace  Type: basic                |
|                                              |
| [ Edit ]  [ Suspend ] [ Archive ]  [ Share ] |
+---------------------------------------------+
| Cross-references                             |
|                                              |
|  Sessions: 3 recent  (list, linked)          |
|  Reps:     none yet  (tooltip: coming soon)  |
|  Plans:    none yet  (tooltip: coming soon)  |
|  Scenarios: 1 cite   (list, linked)          |
+---------------------------------------------+
```

Public card page `/cards/<id>`:

```text
+---------------------------------------------+
| Airspace                                     |
|                                              |
| Front (question)                             |
|                                              |
| Back (answer)                                |
|                                              |
| Citations (from content-citations, if any)   |
|                                              |
| Source: Personal                             |
+---------------------------------------------+
```

No edit controls. No scheduling internals. No reveal timing. Just the content.

## Open questions (non-blocking)

- Whether course-source cards expose the course name on the public page. Default: yes for `source_type = 'course'` with a human-readable source label, no opaque `source_ref` string leaks.
- Whether the public card page should have OpenGraph tags for link previews. Default: yes (domain + first 200 chars of front), but defer the exact copy to build.
- Whether to denormalize session-count onto `card_state` for perf. Default: no, run the query live until it is shown to be slow.

## Build sequencing notes

1. Add route constants + public route scaffold + auth bypass for `/cards/<id>`.
2. BC read function `getPublicCard` + its load.
3. BC read function `getCardCrossReferences` (sessions row populated, others empty).
4. Add Cross-references panel on `/memory/<id>`.
5. Add Share button + toast on `/memory/<id>`.
6. Wire additional cross-ref rows (plans, scenarios) as their data sources land.

## References

- `docs/work/.archive/todos/20260424-02-smi-walkthrough-feedback.md` item 4
- `docs/work/handoffs/20260424-session-state-smi-walkthrough.md` work package scope summaries + locked decisions
- `docs/work-packages/spaced-memory-items/spec.md` existing card detail + source semantics
- `docs/work-packages/content-citations/spec.md` Citations rendered on the public page
- `docs/work-packages/review-sessions-url/spec.md` Share button in the review screen also links here
- `libs/constants/src/routes.ts` new route entries
