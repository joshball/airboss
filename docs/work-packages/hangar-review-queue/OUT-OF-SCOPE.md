---
title: 'Out of Scope: Hangar Review Queue'
product: hangar
feature: hangar-review-queue
type: out-of-scope
status: unread
---

# Out of Scope: Hangar Review Queue

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                    | Status       | Trigger to revisit                                          |
| --------------------------------------- | ------------ | ----------------------------------------------------------- |
| Multi-user assignment / mentions        | Follow-on WP | If/when airboss goes multi-user                             |
| Notifications / in-header review badges | Follow-on WP | When v1 surface proves attention pull is needed             |
| Bulk operations / multi-select on board | Deferred     | When single-target review work feels repetitive at scale    |
| Slash-command keyboard shortcuts        | Follow-on WP | When keyboard nav within `/review` becomes a friction point |

## Multi-user assignment / mentions

Status: Follow-on WP

What was deferred:
A UI for assigning review items to specific users, @-mentions in notes, an inbox view for items assigned to me. The `assigneeId` column exists in `review_item` schema for future use; v1 does not surface a multi-user picker.

Why:
Airboss is single-user today. Assignment UI requires user-picker components, permission rules, "assigned to me" filtering, and notification surfaces -- speculative until there's a second user.

Trigger to revisit:
If/when airboss goes multi-user (a second reviewer joins, or the product surface gains end-users with review responsibilities).

Implementation pattern when triggered:
Spec follow-on WP `hangar-review-collab`. The `assigneeId` column is already in `review_item`; assignment surface is the bulk of the new work. Reuse `libs/auth/` user lookup; add an assignee picker to the item card + review view.

References:

- [spec.md "Out of scope (v1)"](./spec.md) -- "Multi-user assignment" bullet
- [tasks.md "Out of phase / follow-up WPs"](./tasks.md) -- `hangar-review-collab`
- [spec.md "Data model"](./spec.md#data-model) -- `assigneeId` already in schema

## Notifications / in-header review badges

Status: Follow-on WP

What was deferred:
A global-header badge showing the count of items in Review column, items needing attention, or unread frontmatter changes.

Why:
Same reasoning as the platform dashboard: the `/review` route is the surface for review state. Pulling that attention into the global header would create constant low-grade pressure without an action context. v1 surfaces counts on `/review`; that's the design.

Trigger to revisit:
When the v1 surface proves attention pull is needed (e.g. user-zero consistently misses items because they don't visit `/review` regularly).

Implementation pattern when triggered:
Spec a small follow-on. Add a count-badge component to the global header; data source is the same `listItems(boardId, filters)` BC function the board uses.

References:

- [spec.md "Out of scope (v1)"](./spec.md) -- "Notifications / reminders" bullet
- [tasks.md "Out of phase / follow-up WPs"](./tasks.md) -- "Notifications / in-header review badges"

## Bulk operations / multi-select on board

Status: Deferred

What was deferred:
Multi-select on the board (Shift-click, Cmd-click) plus bulk-action UI (mark-many-as-read, bulk drag, bulk frontmatter flip).

Why:
v1 covers the common case via drag-onto-column-header for mark-many-as-read. Multi-select adds UI complexity (selection model, marquee select, bulk-confirmation prompts) that's only worth it once the single-target friction is real. Scope discipline: build it when the pain shows up, not before.

Trigger to revisit:
When single-target review work feels repetitive at scale (e.g. user-zero has 20 items to flip and the per-item drag becomes the bottleneck).

Implementation pattern when triggered:
Add a selection model to the board (multi-select state in the page rune), a bulk-action menu that appears when selection is non-empty, and a confirmation prompt that summarizes the bulk write. Reuse the same drag-and-drop write path under the hood; the only new code is the selection UI plus a fan-out loop.

References:

- [spec.md "Out of scope (v1)"](./spec.md) -- "Bulk operations" bullet

## Slash-command keyboard shortcuts

Status: Follow-on WP

What was deferred:
Keyboard shortcuts like `/review next`, `/review walk`, `j`/`k` navigation across cards and items (beyond the limited TOC-review keyboard nav).

Why:
Nice-to-have. The board and walker work without keyboard shortcuts; adding them speculatively means designing the shortcut map without a real workflow to optimize for. Defer until daily use reveals which transitions need fast-paths.

Trigger to revisit:
When keyboard nav within `/review` becomes a friction point (e.g. user-zero asks for "next item without clicking back to the board").

Implementation pattern when triggered:
Spec a small follow-on. Add a keyboard-shortcuts handler at the layout level; document the shortcuts in a help overlay. Reuse existing routes; shortcuts are just navigation hot-keys.

References:

- [spec.md "Out of scope (v1)"](./spec.md) -- "Slash-command shortcuts" bullet
- [tasks.md "Out of phase / follow-up WPs"](./tasks.md) -- "Slash command keyboard nav"
