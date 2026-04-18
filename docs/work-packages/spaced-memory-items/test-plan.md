---
title: 'Test Plan: Spaced Memory Items'
product: study
feature: spaced-memory-items
type: test-plan
status: unread
---

# Test Plan: Spaced Memory Items

## Setup

- Study app running at `localhost:9600`
- Logged in as test user
- Database running with `study` schema created
- No existing cards (fresh state)

---

## SMI-1: Create a basic card

1. Navigate to `/memory/new`.
2. Fill in: Front = "What is the minimum fuel reserve for VFR day flight?", Back = "30 minutes at normal cruise (14 CFR 91.151)", Domain = Regulations, Card Type = Basic.
3. Click Save.
4. **Expected:** Redirected to card detail page. Card shows front/back/domain. Status = active. Source badge shows "Personal."

## SMI-2: Create a card with tags

1. Navigate to `/memory/new`.
2. Fill in front/back/domain/type, add tags: "far-91", "fuel".
3. Click Save.
4. **Expected:** Card created with both tags visible on detail page.

## SMI-3: Validation rejects empty fields

1. Navigate to `/memory/new`.
2. Leave front empty, fill everything else.
3. Click Save.
4. **Expected:** Validation error on front field. Card not created. Form preserves entered values.

## SMI-4: Browse cards with filters

1. Create 3 cards: 1 in Regulations, 1 in Weather, 1 in Airspace.
2. Navigate to `/memory/browse`.
3. **Expected:** All 3 cards listed.
4. Filter by domain = Regulations.
5. **Expected:** Only the Regulations card shown.

## SMI-5: Edit a personal card

1. Navigate to a personal card's detail page.
2. Edit the front text. Click Save.
3. **Expected:** Card updated. New front text shown.

## SMI-6: Memory dashboard shows due count

1. Create 3 cards (they start as "new" with due_at = now).
2. Navigate to `/memory`.
3. **Expected:** Dashboard shows "3 cards due" (or similar). Grouped by domain.

## SMI-7: Review flow -- first card

1. Create 1 card.
2. Navigate to `/memory/review`.
3. **Expected:** Card front shown. "Show Answer" button visible.
4. Click "Show Answer."
5. **Expected:** Card back revealed. Rating buttons visible: Again, Hard, Good, Easy.
6. Click "Good."
7. **Expected:** Card advanced. Session shows 1 reviewed. If it was the only card, session summary shown.

## SMI-8: Review flow -- FSRS scheduling

1. Create 1 card. Review it with rating "Good."
2. Check card detail page.
3. **Expected:** card_state shows state = "learning" (or "review" depending on FSRS first-review logic), due_at is in the future (minutes to days from now, not immediate), stability > 0.

## SMI-9: Review flow -- Again resets

1. Create a card. Review it "Good" until it reaches "review" state with a multi-day interval.
2. Review it "Again."
3. **Expected:** State changes to "relearning." due_at resets to soon (minutes, not days). Lapse count increments by 1.

## SMI-10: Review flow -- confidence slider

1. Create 5+ cards.
2. Start review session.
3. **Expected:** On approximately half the cards, a confidence slider (1-5: Wild Guess through Certain) appears BEFORE the answer is revealed. On others, no slider.
4. Rate confidence, then reveal answer and rate.
5. **Expected:** Review saved with confidence value. Check card detail's review history.

## SMI-11: Review flow -- confidence slider skip

1. When confidence slider appears, dismiss/skip it without selecting.
2. Reveal answer and rate.
3. **Expected:** Review saved with confidence = NULL. No error.

## SMI-12: No cards due

1. Review all due cards.
2. Navigate to `/memory/review`.
3. **Expected:** "All caught up" message. Shows next due date. Suggestion to create cards or come back later.

## SMI-13: Dashboard streak tracking

1. Review at least 1 card today.
2. Check dashboard.
3. **Expected:** Streak shows 1 day (or increments existing streak).

## SMI-14: Suspend a card

1. Navigate to a card detail page. Click Suspend.
2. Navigate to `/memory/review`.
3. **Expected:** Suspended card does not appear in review queue.
4. Navigate to `/memory/browse`, filter to show suspended.
5. **Expected:** Suspended card visible with "Suspended" status.

## SMI-15: Archive a card

1. Navigate to a card detail page. Click Archive.
2. **Expected:** Card status = archived. Not in review queue. Visible in browse with "Archived" filter.

## SMI-16: Dashboard domain breakdown

1. Create cards across 3+ domains. Review some.
2. Check dashboard.
3. **Expected:** Per-domain stats: total cards, due cards, mastered count (stability > 30 days).

## SMI-17: Non-editable card (future-proofing)

1. Manually insert a card with `source_type = 'course'`, `is_editable = false` (via DB or seed script).
2. Navigate to card detail.
3. **Expected:** Edit form is disabled/hidden. Source badge shows "Course." Card appears in review queue normally.
