---
title: 'Test Plan: Study Plan + Session Engine'
product: study
feature: study-plan-and-session-engine
type: test-plan
status: unread
review_status: pending
---

# Test Plan: Study Plan + Session Engine

> **Depends on knowledge-graph spec.** Scenarios that exercise Expand (node-based picks) or node-level skip are flagged with `[graph]`. Until the knowledge-graph spec signs off and its BC lands, those scenarios are either skipped or asserted in the degraded form (empty pool, redistribution to other slices).

## Setup

- Study app running at `study.airboss.test:9600`.
- Logged in as test user.
- Spaced Memory Items and Decision Reps features complete; their schemas + BC + routes in place.
- Knowledge Graph optional -- scenarios tagged `[graph]` require it; others do not.
- DB fresh: no existing plans, sessions, or session_item_result rows for the test user. Existing cards/scenarios are fine and expected.

---

## SP-1: First-run -- no plan

1. Fresh user with no plan row. Navigate to `/session/start`.
2. **Expected:** "Set up your plan" empty state with a primary action linking to `/plans/new`. Engine did not run (no items shown).

## SP-2: First-run wizard -- create plan

1. Navigate to `/plans/new`.
2. Select cert goals: PPL + IR.
3. Select session length: 10.
4. Add focus domain: Weather.
5. Leave skip domains empty.
6. Submit.
7. **Expected:** Redirect to `/plans/:id`. Plan is active. Fields reflect the submitted values. Depth preference defaulted to "working". Default mode defaulted to "mixed".

## SP-3: Wizard -- validation rejects empty cert goals

1. Navigate to `/plans/new`.
2. Submit with no cert goals checked.
3. **Expected:** Validation error: at least 1 cert goal required. Plan not created.

## SP-4: Wizard -- validation rejects session length out of range

1. Navigate to `/plans/new` and use browser devtools (or an alternative input path) to submit `session_length=100`.
2. **Expected:** Server-side validation rejects. Error message references the 3-50 range.

## SP-5: Edit plan -- add focus domain

1. Navigate to `/plans/:id`.
2. Add Regulations to focus domains. Save.
3. **Expected:** Plan updated. Field shows Weather + Regulations.

## SP-6: Edit plan -- focus and skip cannot overlap

1. Navigate to `/plans/:id`.
2. Attempt to add Weather to skip_domains while Weather is in focus_domains.
3. **Expected:** Validation error: focus and skip must be disjoint. Change not saved.

## SP-7: Activate a second plan archives the first

1. With plan A active, create plan B via `/plans/new`.
2. **Expected:** Plan B is active. Plan A is archived. Only one active plan in the DB for this user.

## SP-8: Session preview -- mixed mode, all pools

1. Active plan: cert goals PPL+IR, session_length 10, mode mixed, focus Weather.
2. Create 12 cards across Weather, Regulations, Airspace. Review 3 of them yesterday (so they have non-empty review history in the last 2 sessions).
3. Navigate to `/session/start`.
4. **Expected:** 10 items displayed, grouped by slice (Continue / Strengthen / Expand / Diversify). Each item has a reasoning label. Slot counts approximate 3 / 3 / 2 / 2 (exact counts depend on which pools are filled). If Expand pool is empty because the graph isn't wired `[graph]`, slots 3/3/0/2 with Expand redistributed -- observe redistribution.

## SP-9: Session preview -- mode = continue

1. With the same plan, navigate to `/session/start?mode=continue`.
2. **Expected:** Preview is weighted 0.70 continue, 0.20 strengthen, 0.10 diversify. Slot counts approximate 7/2/0/1 for session_length 10.

## SP-10: Session preview -- mode = strengthen

1. `/session/start?mode=strengthen`.
2. **Expected:** Preview weighted 0.10/0.70/0.00/0.20. Slot counts approximate 1/7/0/2.

## SP-11: Session preview -- mode = expand

1. `/session/start?mode=expand`.
2. **Expected:** Preview weighted 0.10/0.10/0.70/0.10. `[graph]` If graph is wired, expand dominates. Otherwise the expand pool is empty; redistribution shifts toward continue/strengthen/diversify and the preview flags a "short" session if other pools don't cover.

## SP-12: Session preview -- focus override

1. `/session/start?focus=regulations`.
2. **Expected:** Every slice prefers Regulations items. Items outside Regulations appear only if Regulations pools are exhausted.

## SP-13: Session preview -- shuffle

1. Load `/session/start`. Note the items.
2. Click Shuffle.
3. **Expected:** At least one item changes (assuming pools have > session_length candidates). If pools are too small, "No other items to pick from" is surfaced.

## SP-14: Session preview -- replace an item

1. Load `/session/start`. Note the item in slot 3 (a Strengthen item).
2. Click "Replace" on slot 3.
3. **Expected:** Slot 3 is replaced with a different Strengthen item (same slice). Other 9 items unchanged. No duplicates in the batch.

## SP-15: Session preview -- reasoning labels are specific

1. Load `/session/start`. Look at a Strengthen item.
2. **Expected:** Reason detail includes specifics such as "rated Again yesterday" or "accuracy 40% over last 5 attempts". Not just the enum code.

## SP-16: Commit session

1. Load `/session/start` and click Start.
2. **Expected:** Redirect to `/sessions/:id`. First item is presented. DB has a new `study.session` row with `completed_at IS NULL` and `items` matching the preview.

## SP-17: Commit race -- second commit within window rejected

1. Open `/session/start` in two tabs. Click Start in tab 1 quickly; then Start in tab 2.
2. **Expected:** Tab 2 sees an error "session already in progress" and is redirected to the in-progress session from tab 1.

## SP-18: Session play -- card item

1. Start a session with a card in slot 1. Complete the card review (rate Good).
2. **Expected:** `study.review` row created. `session_item_result` row created linking to the review_id. Slot advances to 2.

## SP-19: Session play -- rep item

1. Start a session with a rep in some slot. Select an option.
2. **Expected:** `study.rep_attempt` created. `session_item_result` row created linking to rep_attempt_id.

## SP-20: Session play -- node_start item `[graph]`

1. With graph wired, start a session with an Expand slot yielding a `node_start` item.
2. Click "Begin node". Advance past Context.
3. **Expected:** `session_item_result` row created with `item_kind='node_start'`, `node_id` populated. Slot advances.

## SP-21: Skip today

1. Mid-session on slot 2, click Skip -> Today.
2. **Expected:** `session_item_result` row with `skip_kind='today'`. Slot advances. Plan unchanged.

## SP-22: Skip topic -- card without node_id

1. Mid-session with a card in the current slot. Card has no node_id (graph not yet linking cards). Click Skip -> Topic.
2. **Expected:** `session_item_result` row with `skip_kind='topic'`. Active plan's `skip_domains` now includes the card's domain. Future session previews exclude that domain.

## SP-23: Skip topic -- node-linked card `[graph]`

1. Mid-session with a card linked to a node via node_id. Click Skip -> Topic.
2. **Expected:** `session_item_result` row with `skip_kind='topic'`. Active plan's `skip_nodes` now includes the node_id. `skip_domains` unchanged.

## SP-24: Skip permanent -- card

1. Mid-session with a card in the current slot. Click Skip -> Permanent.
2. **Expected:** `session_item_result` row with `skip_kind='permanent'`. Card status is now `suspended`. Card does not appear in future sessions or in the Memory review queue.

## SP-25: Skip permanent -- node `[graph]`

1. Mid-session with a `node_start` item. Click Skip -> Permanent.
2. **Expected:** Plan's `skip_nodes` includes the node_id. Node does not appear in future previews.

## SP-26: Finish early

1. Mid-session at slot 5 of 10, click Finish Early.
2. **Expected:** Remaining slots (6-10) recorded as skipped with `skip_kind='today'`. Session transitions to summary.

## SP-27: Session summary -- metrics

1. Complete a session with 10 items: 6 cards (4 Good, 2 Again), 2 reps (1 correct, 1 incorrect), 2 skips (both "today").
2. **Expected:** Summary shows 8 attempted, 5 correct (Good counts as correct for cards, Again does not), accuracy 5/8. Avg confidence across attempts where confidence was captured. Domains list. Streak updates.

## SP-28: Streak -- consecutive days

1. Complete a session today.
2. **Expected:** Summary shows streak = 1 (or increments the prior value if the user studied yesterday).

## SP-29: Streak -- tz boundary

1. Set user tz to America/Denver. Complete a session item at 2355 local (which is 0655 UTC next day).
2. Next local day at 0001, complete another item.
3. **Expected:** Streak = 2 (local calendar day boundary), not 1 (UTC boundary issue avoided).

## SP-30: Streak -- gap resets

1. Complete a session today. Skip tomorrow (no items attempted). Return the day after.
2. **Expected:** Streak = 1 on the return day (gap reset).

## SP-31: Suggested next -- cards due tomorrow

1. After a session, ensure cards are scheduled to be due within the next 24 hours.
2. **Expected:** Summary shows "N cards due tomorrow" hint.

## SP-32: Suggested next -- Strengthen session hint

1. Complete a Continue session. Ensure the user has > 5 relearning cards.
2. **Expected:** Summary shows "Try a Strengthen session" hint.

## SP-33: Suggested next -- finish node `[graph]`

1. Start a `node_start` item. Advance past Context only (leaving other phases incomplete). Complete the session.
2. **Expected:** Summary shows "Finish node X" hint referencing the started node.

## SP-34: Abandon + resume within window

1. Start a session, attempt 3 items, close the tab.
2. Return within 30 minutes. Navigate to `/sessions/:id` for that session.
3. **Expected:** Resume view shows slot 4 as the next item. Previously-attempted slots are not re-presented.

## SP-35: Abandon + stale after window

1. Start a session, attempt 2 items, abandon. Wait > 2 hours (or fake the clock).
2. Navigate to `/session/start`.
3. **Expected:** The stale session is not offered as resume; a fresh preview is shown. The stale session remains in the DB with `completed_at IS NULL` and can be viewed via `/sessions/:id` as a historical in-progress record.

## SP-36: All pools empty

1. Empty DB of cards, reps, and nodes for this user. Active plan exists.
2. Navigate to `/session/start`.
3. **Expected:** Preview shows 0 items with a helpful empty state ("Nothing to study yet -- create cards, or wait for the knowledge graph").

## SP-37: Expand redistribution without graph `[graph]`

1. Graph not wired (node pool empty). Mode = mixed. Sufficient cards + reps across 3 domains.
2. **Expected:** Expand slots (2 of 10) are redistributed to other slices proportionally. Final allocation approximately 4 continue / 4 strengthen / 0 expand / 2 diversify. Sum = 10.

## SP-38: Duplicate candidate across slices

1. Construct a scenario where the same card could be a Continue (recent domain) AND Strengthen (rated Again). Run preview.
2. **Expected:** The card appears exactly once in the batch, in the slice where its score was highest.

## SP-39: Interleave order

1. Preview a mixed session with 3/3/2/2 distribution.
2. **Expected:** The ordered items array interleaves across slices (Continue -> Strengthen -> Expand -> Diversify -> Continue -> ...), not grouped by slice.

## SP-40: Archive all plans leaves no active plan

1. With a single active plan, archive it from `/plans/:id`.
2. Navigate to `/session/start`.
3. **Expected:** Empty state from SP-1. The partial UNIQUE index permits 0 active plans; creating a new one reactivates the flow.

## SP-41: Skipped item count is separate from attempted

1. Complete a session where 3 of 10 items were skipped (any kind).
2. **Expected:** Summary shows 7 attempted, 3 skipped. Accuracy is computed over the 7 attempted, not 10.

## SP-42: Session history list

1. Complete 3 sessions across 2 days.
2. Navigate to `/sessions`.
3. **Expected:** List shows 3 rows with date, mode, items attempted, accuracy. Most recent first.

## SP-43: Cert override narrows session

1. Plan has cert_goals [PPL, IR, CPL, CFI]. Navigate to `/session/start?cert=CFI`.
2. **Expected:** `[graph]` Expand picks restricted to CFI-relevant nodes. Other slices continue to pull from all cert-tagged cards/reps (since cards/reps don't yet encode cert in v1), but the cert_override is recorded on the session row for future analytics.

## SP-44: Multiple skip topic calls accumulate

1. Skip topic on a Weather item. Save. Skip topic on a Regulations item. Save.
2. **Expected:** Plan's skip_domains contains both Weather and Regulations. No duplicates if the same topic is skipped twice.

## SP-45: Skipped items recoverable

1. Skip permanent on a card in a session.
2. Navigate to `/memory/browse`, filter to show suspended. Reactivate the card.
3. **Expected:** Card status = active. Card eligible for future session picks. Plan's skip_nodes is not mutated by this action (because the original skip didn't add a node; cards without node_id only mutate suspensions).
