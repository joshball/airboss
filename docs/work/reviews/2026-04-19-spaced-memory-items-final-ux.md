---
title: 'Final UX Review: spaced-memory-items'
date: 2026-04-19
category: ux
---

# Final UX Review

End-to-end UX review of the `spaced-memory-items` feature on branch `build/spaced-memory-items`. Scope: diff of 9 commits against `docs/initial-migration`, seven SvelteKit page files plus their load/action servers and the layout.

The feature works. The core review loop is tight, keyboard-first, and correctly restrained on gamification. Most findings below are about first-run onboarding, "what do I do next" guidance when the queue is empty, and a handful of dead ends in the surrounding chrome.

## Summary

| Severity | Count |
| -------- | ----- |
| Critical |     2 |
| Major    |     8 |
| Minor    |    10 |
| Nit      |     7 |

## Findings

### [CRITICAL] Nav links to Reps and Calibration lead to 404s

**File:** `apps/study/src/routes/(app)/+layout.svelte:11-13`

**Issue:** The primary nav renders three links -- Memory, Reps, Calibration -- but only `/memory/*` routes exist on this branch. Clicking "Reps" or "Calibration" yields SvelteKit's default 404. The nav has no active-route styling either, so a user who lands there has no visual anchor for where they are or how to get back.

**Impact:** The first thing every new user does is explore the nav. Two of three tabs are dead. For a daily-habit tool this undermines trust immediately.

**Fix:** Either (a) hide Reps / Calibration until those surfaces ship, (b) render them as disabled labels with a "coming soon" tooltip, or (c) land them on a simple placeholder page with a back link. Also add `aria-current="page"` styling so the active section is visible.

---

### [CRITICAL] Top-level `/` has no redirect; lands users on a stub page

**File:** `apps/study/src/routes/(app)/+page.svelte:1-2`

**Issue:** The (app) index is a two-line placeholder:

```svelte
<h1>Dashboard</h1>
<p>Due cards, reps, and streak will show here.</p>
```

A newly authenticated user who hits `/` after login has no path forward: no nav highlight, no CTA, no redirect to `/memory`. The skip-to-main link and the nav are all they get.

**Impact:** First-session dead end. Joshua logs in, sees "Due cards will show here," has to guess that "Memory" is where he should go.

**Fix:** Either redirect `/` -> `/memory` in `(app)/+page.server.ts`, or render a real home with the memory dashboard's due-tile as the first element and a "Start review" CTA. Given the post-pivot surface taxonomy, redirecting to `/memory` is the minimal correct choice for now.

---

### [MAJOR] "No cards due" empty state on the dashboard is a bar chart for 0/0

**File:** `apps/study/src/routes/(app)/memory/+page.svelte:60-65, 89-114`

**Issue:** On a fresh account (no cards yet) the dashboard shows four stat tiles -- all zero -- plus an empty "By state" grid of zeros and a single "No active cards yet. Create your first." line buried in "By domain." The dominant visual is four big "0"s.

**Impact:** First impression is "this looks broken / cold." The spec emphasizes algorithm-over-willpower and low-friction capture; the dashboard should visibly usher a brand-new user into creating their first card.

**Fix:** When `totalActive === 0` and `stats.dueNow === 0`, replace the stat grid with a single onboarding card: "Your deck is empty. Start by capturing one thing you want to remember." + a prominent "New card" button. Keep the header + quick actions. Only show stat tiles once there's at least one card.

---

### [MAJOR] Dashboard "Start review" CTA stays primary even with 0 due cards

**File:** `apps/study/src/routes/(app)/memory/+page.svelte:40`

**Issue:** The three action buttons in the header -- Browse, New card, Start review -- never change state. When `stats.dueNow === 0`, "Start review" is still the loudest button; clicking it lands on the "all caught up" screen. Over time this becomes a daily false affordance: the big blue button doesn't do anything useful on low-queue days.

**Impact:** Dulls the meaning of "there is something to do." Violates the "visible scheduling" intent of the spec -- the UI should tell you "0 due, nothing to review now."

**Fix:** Swap primary emphasis based on state:
- `dueNow > 0`: "Start review" primary, "New card" secondary. Optionally append `(N)` to the label.
- `dueNow === 0`: "New card" primary, "Start review" demoted to ghost or hidden. Show next-due timestamp next to it so the user understands why.

---

### [MAJOR] "All caught up" screen hides the most important fact: when the next card is due

**File:** `apps/study/src/routes/(app)/memory/review/+page.svelte:146-165`

**Issue:** The spec (line 3 of review edge cases: "show 'all caught up' with next due date") explicitly calls for the next-due timestamp. The current screen shows a session tally or "No cards due right now. Come back later," but does not tell the user *when* to come back. The load function (`review/+page.server.ts`) doesn't fetch the next-due either.

**Impact:** "Come back later" is vague -- if the next card is due in 15 minutes vs 3 days, the user's behavior should differ. Missing this makes the algorithm invisible, which is the one thing this product is built around.

**Fix:** Extend `load` in `memory/review/+page.server.ts` to return `nextDueAt` (earliest `card_state.due_at > now` for active, non-suspended cards). Render "Next card due in X" on the caught-up screen with the same `formatInterval` helper used on the card detail page. If there are no future due cards at all (new user), show the "write more cards" prompt instead.

---

### [MAJOR] Review page "all caught up" is reachable only via the review URL; no entry point from dashboard

**File:** `apps/study/src/routes/(app)/memory/+page.svelte:40`

**Issue:** If `dueNow === 0` the dashboard never shows what the next review will be -- neither timestamp nor count-down. The only way to see "no cards due" is to click "Start review" and land on the empty session.

**Impact:** Multiple clicks for a single piece of information that should be the dashboard's headline on 0-due days.

**Fix:** Inline the next-due hint on the "Due now" tile when `dueNow === 0`: "0 / next in 2h 14m" or similar. Again, requires the dashboard loader to compute next-due.

---

### [MAJOR] Confidence prompt shows AFTER the user clicks "Show answer," not before reveal

**File:** `apps/study/src/routes/(app)/memory/review/+page.svelte:55-71, 187-204`

**Issue:** The flow is: front visible -> user clicks "Show answer" -> the page transitions to the confidence prompt (showing front + back is NOT yet shown because the confidence prompt is rendered instead of the reveal). This is technically correct per spec, but the visual ordering on screen is jarring: the "Show answer" button disappears, the answer stays hidden, and a new panel of numbers appears where the rating row was expected. The user just asked to see the answer and got a slider instead.

The prompt text ("Before revealing -- how confident are you?") reads like a wrong-time question because the user has already decided they want the reveal.

**Impact:** Every first-time confidence prompt is a small "wait what" moment. For a daily reviewer hitting this ~50% of the time, it's friction that pattern-learning will dull but never eliminate.

**Fix:** Two options, pick one:
1. **Preferred:** Show the confidence row *below* the front, always rendered on cards that qualify, with the "Show answer" button below it. User rates confidence, then the same button continues to the reveal. No branching phase. Keyboard shortcut unchanged.
2. **Minimal:** Rename the button on confidence-prompted cards from "Show answer" to "Rate confidence -> reveal" so the user isn't surprised.

---

### [MAJOR] `auto-submit` race: clicking a rating creates both a navigation-style and action-style event

**File:** `apps/study/src/routes/(app)/memory/review/+page.svelte:125-136, 227-241`

**Issue:** Keyboard shortcuts in phase=`answer` call `clickRating(value)`, which does a DOM `querySelector` for a button and triggers `.click()`. This works but relies on the DOM being in a stable state. There is no `e.preventDefault()` on the keys 1/2/3/4 in the answer phase (line 126-129) -- meaning pressing "1" while focus is in some other element (e.g., if the user clicked somewhere) would still try to fire. More concerning: because the form is a `use:enhance` form, the FIRST keypress can fire -> form submits -> `phase = 'submitting'` -> advance -> next card renders, but if the user taps 2-3 keys in quick succession (rapid reviewer habit, especially with "Good" landing on "3"), the second keypress targets an already-unmounted button.

**Impact:** Practically: works fine. But a fast reviewer hammering keys will eventually hit a state where a keypress does nothing or submits the wrong card. The spec calls out idempotency for double-submit -- this is the UI half of that concern.

**Fix:** In `onKeydown`, guard with `if (phase !== 'answer') return;` before the rating keys (you already branch on phase), add `e.preventDefault()` to each arm, and debounce by disabling further rating shortcuts once `phase === 'submitting'`. Also consider calling the submit helper directly instead of via DOM `.click()`.

---

### [MAJOR] Rating buttons are not disabled during submit; double-click possible

**File:** `apps/study/src/routes/(app)/memory/review/+page.svelte:227-241`

**Issue:** The rating `<button>`s have `type="submit"` but no `disabled` attr. On submit, `phase` transitions to `'submitting'` and the whole form is replaced, but on a slow network the buttons remain clickable until the re-render completes. The server-side `submitReview` relies on idempotency inside `submitReview` (per spec), but the UI doesn't visually prevent the second click or update the tally if both succeed.

**Impact:** Low likelihood but produces double-counted tallies in the local session and an inconsistent review count.

**Fix:** Add `disabled={phase === 'submitting'}` to each rating button. Visually lower opacity or show a subtle "saving" indicator so the user has feedback.

---

### [MAJOR] Review page has no "end session" affordance mid-queue

**File:** `apps/study/src/routes/(app)/memory/review/+page.svelte:167-245`

**Issue:** Once in a review session (say 15 of 20 cards), there's no visible way to stop gracefully. The user must either (a) close the tab, (b) click the browser back button, (c) use the nav in the parent layout, which is still rendered but visually separate. There's no "I'll stop here" button, no "show summary now" option.

**Impact:** Daily use involves interrupted sessions. A pilot checks 5 cards between flights; he shouldn't have to finish a batch of 20 or feel he's "abandoning" the session.

**Fix:** Add a small ghost-button in the top-right of the `.hd` row: "End session" -> jumps to the complete state, showing whatever tally was accrued. Pair with the existing counter so the user still knows where they are.

---

### [MAJOR] Browse: no visible card count / result totals

**File:** `apps/study/src/routes/(app)/memory/browse/+page.svelte:160-172`

**Issue:** The page shows up to 25 cards, pagination (Previous / Page N / Next), but never tells the user "X cards in total" or "Y matching your filters." With multiple filters applied, it's impossible to know whether the result is all 3 matches or the first 25 of 450.

**Impact:** Makes it hard to judge whether a filter is too narrow or whether you actually have a lot of cards in a domain. The dashboard's "Active cards" tile helps but doesn't reflect filter state.

**Fix:** `getCards` already supports filters -- either return a total count from the loader (one extra `count(*)` query) or surface "Page N of M" / "Showing 25 of X." The extra query is cheap.

---

### [MAJOR] Edit form field errors show after redirect but form re-mounts to read-only view on success

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte:118-259`

**Issue:** On a successful edit, the server redirects back to the same URL, the page re-renders in read-only mode, and `editing = false`. Good. On a *validation failure*, `form.fieldErrors` is populated but the page might render in read-only mode because `editing` is a local `$state` that resets to `false` on navigation if the user happens to have already closed the editor. In practice the fail case keeps the current page (no redirect), so `editing` persists -- but only if the user had the editor open when they submitted. The form's `action="?/update"` ensures that path. OK, it works. But if the user clicks the read-only "Edit" button after a validation-fail state from a prior submit, they see stale `form.fieldErrors` values from the previous attempt injected into the edit form.

**Impact:** Subtle. On repeated failed edits or a page navigation and return, error banners can reappear from stale `form` state.

**Fix:** Clear `form.fieldErrors` when `editing` flips from false -> true (in `startEdit`, navigate with `invalidateAll()` or use SvelteKit's `form = null` pattern), or only surface errors when `form.intent === 'update' && editing`.

---

### [MINOR] Dashboard "Reviewed today" tile doesn't link anywhere

**File:** `apps/study/src/routes/(app)/memory/+page.svelte:50-54`

**Issue:** "Reviewed today" is a stat tile with a count. A natural click target. There's no corresponding review-log page; `recentReviews` only exists per-card.

**Impact:** A curious user expects to click the number to see what they reviewed. Nothing happens.

**Fix:** Either remove affordance styling (it's fine as passive text today -- low priority), or in a follow-up add a `/memory/activity` page scoped to "today" or by date. Low now; capture as a follow-up.

---

### [MINOR] Streak tile shows "0 days" ambiguously on a brand-new account

**File:** `apps/study/src/routes/(app)/memory/+page.svelte:55-59`

**Issue:** New user sees "0 days" streak. Reads as a failure state. It's not -- there's nothing to review yet.

**Impact:** First-impression cold. Contradicts "no gamification" -- showing a zero streak is the most gamified thing on the page.

**Fix:** When `stats.reviewedToday === 0 && totalActive === 0`, hide the streak tile entirely (or show "-" / "Start to track"). Once the user has a deck, the 0 is earned.

---

### [MINOR] "By state" grid uses constants as label order but shows zero rows for new users

**File:** `apps/study/src/routes/(app)/memory/+page.svelte:67-87`

**Issue:** Four labels (New, Learning, Review, Relearning) each showing `0` on a new account. Duplicates the dashboard's emptiness. For users with cards, "0 Relearning" is a good thing -- but users don't know that.

**Impact:** Visual noise. Makes the dashboard feel like a debug view.

**Fix:** Hide the "By state" panel entirely when `totalActive === 0`. Consider also hiding `relearning` when it's zero and the user has no history (or dim it). Keep the panel for active users.

---

### [MINOR] Schedule panel is raw FSRS numbers; pilot can't tell "why 3 days"

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte:261-271`

**Issue:** The panel shows Stability: `4.57 d`, Difficulty: `5.12`, Reviews: 2, Lapses: 0. For a pilot -- even one who wants visible scheduling -- these numbers don't explain the scheduling logic. Stability is a memory half-life; difficulty is a 1-10 scale. The user is left to infer what `4.57 d` means relative to the due date.

**Impact:** Misses an opportunity the spec explicitly calls out ("algorithm-over-willpower"). A user who sees raw FSRS parameters but not their meaning will either tune them out (bad) or come up with wrong mental models (worse).

**Fix:** Add a one-line caption under the schedule panel or inline tooltips:
- **Stability:** "Your estimated memory half-life -- higher = you'll remember longer."
- **Difficulty:** "1 is easy, 10 is hard. Adjusts with each rating."
- **Next review:** consider adding a visual timeline (last review marker -> due marker -> now) -- already have the recent reviews table with dates; a thin visualization closes the loop.

---

### [MINOR] Schedule panel formats intervals differently from reviews table

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte:87-90, 292-298`

**Issue:** The schedule shows "Due: in 3d" (humanized) but the recent reviews table shows full `Date.toLocaleString()` timestamps ("4/19/2026, 8:14:00 AM"). Two styles of time for the same object (the card's due history).

**Impact:** Inconsistent. Hard to scan the history.

**Fix:** Use `formatInterval` in both places -- "3d ago" / "in 2d" is easier to scan. Keep the full timestamp in a `<time title="...">` tooltip.

---

### [MINOR] "New card" form's "Save and add another" redirects and reseeds, but doesn't scroll to top

**File:** `apps/study/src/routes/(app)/memory/new/+page.svelte:35-38`

**Issue:** After save-and-add, the page reloads with a success banner at the top, the domain pre-filled, and focus on Front. Good. But on a shorter viewport the banner may be above the fold and the user sees a focused Front textarea without seeing the "Card saved" confirmation.

**Impact:** Minor ambiguity about whether the previous save worked. Works fine on desktop; wobbly on smaller screens.

**Fix:** After redirect, the effect at line 35-38 focuses `frontInput`. Before focusing, call `window.scrollTo(0, 0)` (or `frontInput?.scrollIntoView({ block: 'center' })` then scroll top). Alternatively: keep the banner fixed-positioned for a short window, or render the banner as a toast.

---

### [MINOR] "Save and add another" preserves domain + type + tags but not front/back

**File:** `apps/study/src/routes/(app)/memory/new/+page.server.ts:72-83`

**Issue:** Expected behavior -- but it's worth noting that on a validation failure *after* save-and-add, the previous card's values have been cleared (correct), while if the failure was on the first submit, the values are preserved (also correct). The two behaviors feel inconsistent to the user who just submitted and got an error.

**Impact:** Edge-case only. Mostly fine.

**Fix:** No change. Document the behavior or add a small "New card #N this session" counter to make the session feel intentional.

---

### [MINOR] Archive flow redirects away without any undo affordance

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.server.ts:130-132`

**Issue:** Archiving redirects to `/memory/browse`. The confirm dialog is sufficient but once the user is on Browse they see their deck minus the archived card with no indication of what just happened. The browse default filter is `status=active` so the card is invisible.

**Impact:** Hard to recover from accidental archive without remembering the card's contents to search.

**Fix:** On archive redirect, include a query param like `?archived={id}` and render a dismissible "Archived -- undo" banner on the Browse page. A two-minute window where "Undo" un-archives the card would close the loop. Spec calls out that archive is soft -- lean into that.

---

### [MINOR] Browse filter "Reset" still reloads with an empty query; no visible indication filters were active

**File:** `apps/study/src/routes/(app)/memory/browse/+page.svelte:123-127`

**Issue:** The filter bar is always visible at the top. There's no filter pill summary, no "Clear all" counter showing how many filters are active. Users have to scan five selects to see what's applied.

**Impact:** Power-user friction; tolerable now because there are only five filters.

**Fix:** Add a small filter summary row: "Filtering: Regulations · Basic · 2 filters [Clear]" -- show only when at least one filter is non-default.

---

### [MINOR] Login dev-accounts buttons set password but don't auto-submit

**File:** `apps/study/src/routes/login/+page.svelte:17-20, 83-87`

**Issue:** Clicking a dev-account button fills email + password fields. User still has to click "Sign in." For a dev convenience affordance during daily development this is an extra click.

**Impact:** Joshua's session boot. Friction.

**Fix:** After `fillDevAccount`, programmatically submit the form (requestSubmit). Or add a separate "Sign in as X" button that does both.

---

### [NIT] "Card detail" page title is the card front text, but browser history shows cryptic prefixes

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte:96-98`

**Issue:** Title is `{card.front.slice(0, 60)} -- airboss`. For long fronts this is great; for a one-sentence card it's fine; for a cloze card with markdown syntax it looks like gibberish in tab strip.

**Fix:** Strip markdown (or at least `[[...]]`, `{{...}}`) from the title preview. Low priority.

---

### [NIT] "Show answer" button on mobile has the `Space` kbd hint, which is misleading on touch

**File:** `apps/study/src/routes/(app)/memory/review/+page.svelte:201-204`

**Issue:** `<span class="kbd">Space</span>` is shown on every device including mobile where there's no keyboard. Same for rating key hints.

**Fix:** Hide `.kbd` on narrow viewports via `@media (hover: none)` or `@media (max-width: 480px)`.

---

### [NIT] "Wild guess" -> "Certain" confidence scale is five levels shown horizontally; can wrap awkwardly

**File:** `apps/study/src/routes/(app)/memory/review/+page.svelte:187-199`

**Issue:** Five 5rem-min-width buttons in a flex row wrap to 2-3 per row on narrow screens. The label + number combo is readable but the alignment breaks.

**Fix:** On narrow viewports, grid-template-columns: repeat(5, 1fr) and reduce padding, or switch to a single row of number buttons with the label shown for only the hovered one.

---

### [NIT] Domain filter chip on Browse shows full label; could echo the dashboard's shorter style

**File:** `apps/study/src/routes/(app)/memory/browse/+page.svelte:145-147`

**Issue:** Cosmetic only. Domain badges use `domainLabel(c.domain)` which is the human-readable full name ("Regulations (Part 91)"). On narrow screens, these push the meta row to wrap.

**Fix:** Either shorten labels in `DOMAIN_LABELS` for badge contexts, or provide a `DOMAIN_SHORT_LABELS` variant. Not urgent.

---

### [NIT] Rating hints "< 1m / < 10m / ~ days / ~ week+" are slightly inconsistent

**File:** `apps/study/src/routes/(app)/memory/review/+page.svelte:36-40`

**Issue:** "< 1m" and "< 10m" are precise; "~ days" and "~ week+" are vague. For a first-time user this is confusing -- why does Again say "less than 1 minute" so precisely and Good say "roughly days"?

**Fix:** Use the same style: "< 1 min / < 10 min / 1-3 days / 1 week+" or similar. The FSRS result is probabilistic but the hint is a UI promise; match styles.

---

### [NIT] Caught-up session summary uses `<strong>` but no heading link back to dashboard

**File:** `apps/study/src/routes/(app)/memory/review/+page.svelte:147-165`

**Issue:** The summary has three buttons (Back to dashboard, New card, Reload queue). After a completed session the natural next action is "start another round" only if more cards just became due. The "Reload queue" button is clever but its label is jargon-y -- most users won't understand what a "queue" is in this context.

**Fix:** Rename "Reload queue" to "Check for more due cards" or similar. Consider merging with "Back to dashboard" (the dashboard shows due counts anyway).

---

### [NIT] Browse card row clickable area is the whole `<a>` but pointer style only changes on hover

**File:** `apps/study/src/routes/(app)/memory/browse/+page.svelte:141-157`

**Issue:** The `<li>` is a card container; the anchor inside is the full click area. `transition: border-color 120ms, box-shadow 120ms;` is nice, but there's no `cursor: pointer` declared -- the browser infers it from the anchor. On mobile the affordance is subtle (no hover state).

**Fix:** Add a subtle chevron or "->" at the end of each card row on touch devices. Or just live with it -- anchors on touch get a tap highlight.

---

### [NIT] Dashboard domain progress bar shows "0% mastered" for brand-new deck

**File:** `apps/study/src/routes/(app)/memory/+page.svelte:106-109`

**Issue:** Domain breakdown shows "0% mastered (stability > 30d)" on every domain until cards have matured. For a brand-new card, stability starts at 0 -- so the bar is always 0% at first. Not wrong, but it frames progress as something you don't have yet.

**Fix:** Only show the mastery bar once the domain has at least one card with `state !== 'new'`. Or show "Building stability..." until there's meaningful data.

---

## Clean

The following are well-executed and deserve call-out so they aren't lost in cleanup:

- **Keyboard flow during review** (space to reveal, 1-4 to rate, Esc to skip confidence) -- exactly the daily-reviewer ergonomics the spec asked for.
- **"Save and add another"** with domain/tags carry-over and auto-focus on Front -- this nails the spec's "30-second card creation" feel.
- **Deterministic confidence sampling** via `deterministicUnit(cardId:dayKey)` -- smart; same card same day gives same prompt, which prevents accidental calibration noise.
- **Archive confirmation dialog** -- the one destructive flow has a confirm step. Good restraint.
- **Review page's local batch + invalidateAll()** pattern -- keeps the queue stable during in-flight rating submits.
- **Per-rating color coding** (Again red, Hard orange, Good green, Easy blue) -- communicates state without being loud.
- **Dashboard density vs no-gamification** -- no streaks-on-fire, no animated confetti, no levels. The streak tile is a number. Well done.
- **Source-type badge** showing "Personal" / "Course" and disabling edit for non-editable cards -- future-proofs the assignment flow per spec.
- **Validation errors are field-scoped** with ARIA `aria-invalid` / `aria-describedby` -- accessible.
- **Empty state on Browse distinguishes "deck empty" from "over-filtered"** -- simple but often missed.
- **CSP-friendly pattern** (`use:enhance`, no inline event handlers except via Svelte `onclick=`, which is fine under SvelteKit's hash-csp).
