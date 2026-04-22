---
feature: full-codebase
category: ux
date: 2026-04-22
branch: main
issues_found: 22
critical: 0
major: 6
minor: 11
nit: 5
scope: every user-facing route in apps/study/ + apps/sim/ (Phase 0 prototype)
prior_review: docs/work/reviews/2026-04-22-app-wide-ux.md
---

## Summary

The 2026-04-22 app-wide review landed the headline fixes: identity/logout in nav, `?created=` banners + edit-success toasts, filter chips on both browse pages, the `/session/start` preset gallery, the calibration interpretation line + per-bucket/per-domain CTAs, the structured "Suggested next" actions on session summary, and the deprecation of `/reps/session`. The `/sessions/[id]` flow stays server-derived and resumes on refresh. What's still open is narrower and more about polish than systemic debt: three confirmed-open items from the user's own list (native `confirm()` for Archive, no undo window in review, no per-phase completion on `/learn`), a still-unconfirmed `Skip permanently` with no guard, and a grab-bag of inconsistent empty-state headings, pagination counts, stat-tile linkability, and sim-app prototype gaps. No new critical issues.

## Issues

### MAJOR: Native `confirm()` still guards Archive; ConfirmAction primitive exists but is unused

- **File**: apps/study/src/routes/(app)/memory/[id]/+page.svelte:274
- **Problem**: The Archive action on the card detail page still uses `window.confirm()`. The `libs/ui/src/components/ConfirmAction.svelte` primitive already exists (form-mode with hidden fields, callback mode, inline two-step reveal) and is purpose-built for this exact case. The prior review flagged the native `confirm()` as a MAJOR and that ticket is still open. Native `confirm()` can't show card context ("this card has 47 reviews"), can't be styled, blocks the thread, and is inconsistent with the rest of the app.
- **Expected**: Archive reveals an inline confirm row ("Archive? [Confirm] [Cancel]") using `ConfirmAction` in form mode; hidden fields carry `status=archived`.
- **Fix**: Replace the inline `use:enhance` `confirm()` block with `<ConfirmAction formAction="?/setStatus" confirmVariant="danger" hiddenFields={{ status: 'archived' }} label="Archive" confirmLabel="Archive this card" />`. Drop the native prompt. Same pattern should be applied the moment any second destructive action lands anywhere in the app.

### MAJOR: `Skip permanently` in `/sessions/[id]` has no confirmation

- **File**: apps/study/src/routes/(app)/sessions/[id]/+page.svelte:267-271
- **Problem**: Two skip links sit side-by-side in the footer: `Skip today` (reversible) and `Skip permanently` (adds the item to the plan's skip set). They're peer link-buttons, same size, same shape, differing only in one red text colour. No inline confirm, no modal, no "you can reactivate from Plan detail" hint. Fat-finger hazard directly below the rating row. Prior review flagged this as MAJOR and it remains open (ConfirmAction was written for exactly this scenario).
- **Expected**: `Skip permanently` reveals a confirm row before firing. Plus a one-line hint that the decision can be undone from `/plans/[id]`.
- **Fix**: Swap the `Skip permanently` form for `<ConfirmAction formAction="?/skip" confirmVariant="danger" hiddenFields={{ slotIndex, skipKind: 'permanent' }} label="Skip permanently" confirmLabel="Skip permanently (undo from plan)" />`. Add a `<small>` under the footer noting reactivation path.

### MAJOR: Review ratings submit instantly with no undo window

- **File**: apps/study/src/routes/(app)/memory/review/+page.svelte:197-223
- **Problem**: Tapping Again/Hard/Good/Easy (or hitting `1`/`2`/`3`/`4`) submits the rating and advances. Fat-fingering `2` instead of `3` silently mis-schedules the next review. Prior review called this out as MAJOR under "Review rating mistakes have no undo" and the user's own list confirms it's still open. The scheduling signal is the product; corrupting it by one keystroke undermines the whole SRS loop.
- **Expected**: After rating, a brief (~2s) "Rated Good -- undo" inline affordance before advance. OR keep the current post-advance flow but support `Backspace`/dedicated "undo last rating" in the same session.
- **Fix**: Two viable shapes. (1) Delay the advance: keep `phase = 'submitting'`, show a `role="status"` block with "Rated {label} -- [undo]" and a 2s timer; if the user hits undo, POST to a new `?/rollback` action that reverses the last FSRS write. (2) Keep instant advance but add a session-scoped history stack with a persistent "Undo last rating" control at the top of each card. Option 1 is closer to the debrief-culture principle ("confirmation, not guesswork") and fits DESIGN_PRINCIPLES.md #7.

### MAJOR: `/knowledge/[slug]/learn` still has no persisted per-phase completion

- **File**: apps/study/src/routes/(app)/knowledge/[slug]/learn/+page.svelte:92-107
- **Problem**: The 7-phase stepper shows `active` + `authored` states but not "visited" or "complete." Come back a week later and you can't tell which phases you've already walked through. The user's open-items list explicitly flags this. Mastery is the durable signal for the node as a whole, but per-phase progress would let a learner resume mid-walkthrough without re-scanning every phase body to find their place.
- **Expected**: Stepper buttons visually distinguish completed/visited phases from unvisited. Minimum viable: session-scoped visited state (no server persistence). Ideal: a `knowledge_phase_progress` table keyed by `(userId, nodeId, phase)` with a timestamp, hydrated on load and written whenever the user moves past a phase.
- **Fix**: Start session-scoped. Track `visited = new Set<KnowledgePhase>()` in `$state`, add the active phase on `$effect`, paint the `.step.visited` style (dim check-mark or filled dot). Promote to server-backed in a follow-up ADR if the user zero walkthrough confirms the signal is useful. Spec says this is low-priority relative to mastery tracking, but the visual nudge is cheap and closes the "where was I?" gap.

### MAJOR: Reps dashboard stat tiles remain non-clickable

- **File**: apps/study/src/routes/(app)/reps/+page.svelte:53-77; apps/study/src/routes/(app)/memory/+page.svelte:45-65
- **Problem**: "Unattempted: 47" / "Today: 3" / "Due now: 12" read as static text. The obvious next action after "12 due now" is `/memory/review`; after "47 unattempted" is `/reps/browse?status=unattempted`. The tile is both the label and the implicit call-to-action, so making it a link (or wrapping the number in one) collapses the click path from three visual jumps (read tile -> re-find action row -> click button) to one. Prior review flagged this as MINOR; repeating here because the absence is more felt on the reps page where the tiles and action row are visually far apart.
- **Expected**: Actionable tiles become links. Purely descriptive tiles (Streak, Accuracy 30d) stay non-clickable. Hover affordance on clickable tiles.
- **Fix**: Wrap the `tile` div in an `<a>` for clickable tiles. Add `.tile:hover` border/background shift. Memory side: "Due now" -> `/memory/review`; "Reviewed today" -> `/memory/browse?status=active` (or skip). Reps side: "Available" -> `/reps/browse`; "Unattempted" -> `/reps/browse` (consider adding a `status=unattempted` filter); "Today" -> stay static (it's a retrospective count).

### MAJOR: Sim prototype has no loading or error state while the worker boots

- **File**: apps/sim/src/routes/[scenarioId]/+page.svelte:252-258
- **Problem**: The sim page status reads "Connecting to FDM..." as a single line inside the `.status` strip, while the `.panel` above is already rendering three instruments with `kias=0`, `altitudeFeet=0`, `pitchRad=0`. A new user sees instruments at zeroes and no visual cue that the sim hasn't started yet -- it looks like the aircraft is sitting on the ramp with engines off, which for a departure-stall prototype is plausible-enough to mask a bug. If the worker fails to post READY (CSP, syntax, etc.), the UI stays in "Connecting..." forever with no error surface. The header also has no footer-level indicator that space will start it once the worker is ready.
- **Expected**: Pre-ready state visually dims the instrument panel (or shows a "Waiting for sim..." overlay). A timeout (~5s) flips to an error state with "Sim failed to start -- try reload / check console."
- **Fix**: Gate `.panel` / `.readouts` / `.controls` with `class:pending={!ready}` styling. Add a `$effect` that sets a timeout when `!ready` and surfaces an error banner if the worker never posts READY. Also surface "Press Space to fly" more prominently on pre-start so the user knows the sim is armed, not broken.

### MINOR: `/memory/review` "All caught up." still used for both queue-complete and empty-on-arrival

- **File**: apps/study/src/routes/(app)/memory/review/+page.svelte:147-166
- **Problem**: The heading "All caught up." fires both when `phase === 'complete'` after reviewing N cards AND when the learner lands on an empty queue. The sub-line differentiates ("You reviewed 20 cards..." vs "No cards due right now..."), but the heading treats a successful session the same as a no-op arrival. Prior review flagged this as MINOR and the branching still hasn't happened.
- **Expected**: Two distinct headings. Session just completed (`total > 0`): "Session complete." Empty arrival (`total === 0`): "You're caught up."
- **Fix**: `<h1>{total > 0 ? 'Session complete.' : "You're caught up."}</h1>`. Keep the sub-line as-is.

### MINOR: Browse pagination shows current page but not total pages or item count

- **File**: apps/study/src/routes/(app)/memory/browse/+page.svelte:245-257, apps/study/src/routes/(app)/reps/browse/+page.svelte:242-254
- **Problem**: "Page 2" with Previous/Next -- no "of 7" orientation, no "showing 21-40 of 137." Server uses the `fetch-one-extra` pattern to know if there's a next page, which gives "is there more" but not "how much more." Prior review flagged this as MINOR; hasn't been addressed.
- **Expected**: "Page 2 of 7" minimum. Ideally "Showing 21-40 of 137 matches."
- **Fix**: Add a `total` count to each browse page's server load (`select count(*)` scoped to the same where clause). Display "Page X of Y" next to the page number; add a one-liner above the list with the range summary when `total > pageSize`.

### MINOR: Preset gallery CTAs link directly into a server form action with no pre-submit visibility of what each preset does

- **File**: apps/study/src/routes/(app)/session/start/+page.svelte:109-154
- **Problem**: Each preset tile is a form POST. Clicking "Strengthen" fires a create-plan+start-session flow immediately, with the only feedback being the `Starting...` status line on the busy tile. If a user mis-taps a tile, the plan is created (and if there's no prior active plan, that preset plan is now the default). There's no "preview this plan" step, no "activate this plan without starting a session" option, no undo. It's the opposite extreme of the `Skip permanently` issue: *too* fluid for a destructive-ish action (activating a plan archives any existing one). Prior review didn't flag this because the gallery shipped after the review.
- **Expected**: Either a one-line description of the side effects ("This creates and activates a Strengthen plan, archiving your current plan"), OR a per-tile "Activate without starting" secondary action so the user can review the plan first.
- **Fix**: Smallest fix: augment each preset's `tile-desc` with an "Activates and starts" / "Replaces active plan" micro-caption driven off whether the user has an existing active plan. Larger fix: split each tile into two actions -- a primary "Start" button and a secondary "Preview plan" link that routes to `/plans/new?preset=strengthen` (prefilled form the user can tweak).

### MINOR: Dashboard title still reads "Learning Dashboard" while nav says "Dashboard"

- **File**: apps/study/src/routes/(app)/dashboard/+page.svelte:29; apps/study/src/routes/(app)/+layout.svelte:73
- **Problem**: Top nav says "Dashboard," page H1 says "Learning Dashboard." Prior review flagged this as MINOR pending a VOCABULARY.md decision. No follow-up yet.
- **Expected**: One name in VOCABULARY.md, both surfaces agree.
- **Fix**: Pick one, document in VOCABULARY.md under a "Dashboard" entry, update either the nav label or the H1 to match.

### MINOR: `memory/new` banner is a standalone note -- no scroll anchor or highlight on the saved card

- **File**: apps/study/src/routes/(app)/memory/new/+page.svelte:74-78
- **Problem**: After "Save and add another," the banner reads "Card saved. View it or add another below." The `<a href>` goes to the detail page, but the user (on the create flow) has no in-page highlight of what they just saved. The browse flow *does* highlight the just-created row via `just-created` class; the memory/new post-save experience is the odd one out.
- **Expected**: Either the banner links to the card (which it does -- good), OR the page shows a collapsed preview of the last-saved card's front/back so the user has visual confirmation before moving on.
- **Fix**: Low-priority visual nicety. Consider rendering a small muted "Last saved: {front-first-60-chars}" chip under the banner when `createdId` is present. Or just leave it -- the current banner is sufficient per principle #7.

### MINOR: `/plans/new` lacks a pre-submit preview of what the plan looks like

- **File**: apps/study/src/routes/(app)/plans/new/+page.svelte
- **Problem**: All plan settings are configured in the form, then submitted blind. Once created, the user lands on `/plans/[id]?created=1` with the banner -- but by then the plan is active and any prior plan is archived. No chance to review "here's what you picked, is this right?" before committing. For a form with certs + focus + skip + depth + mode + length (6 distinct decisions), that's asking a lot from blind submission.
- **Expected**: A one-click "Preview" section that shows the plan summary live as the form changes; OR make "Create plan" land on a preview page first with a second "Activate" button.
- **Fix**: Low effort: add a live `<aside>` that mirrors the chosen values in the same shape as the `/plans` dashboard's active plan card. Stretch: split plan creation from activation (the schema already separates draft/active).

### MINOR: Sim app has no feedback when `scenarios` list is empty

- **File**: apps/sim/src/routes/+page.svelte:18-30
- **Problem**: `listScenarios()` is called at module level -- if it ever returns an empty array (during Phase 0 there's one scenario; Phase 1+ may vary), the `<ul>` renders empty with no messaging. The `.disclaimer` footer handles the prototype framing, but there's no empty state for the list itself.
- **Expected**: "No scenarios available yet." with muted styling when list is empty.
- **Fix**: Add `{#if scenarios.length === 0}<p class="empty">No scenarios available yet.</p>{:else}` around the `<ul>`.

### MINOR: Sim `.status` treats "Connecting..." / "Flying" / "Paused" / "SUCCESS" / "FAILURE" all in the same visual lane

- **File**: apps/sim/src/routes/[scenarioId]/+page.svelte:245-263
- **Problem**: A scenario outcome ("STALL RECOVERY SUCCESS -- recovered in 3.2s") gets the same typography, the same box, and the same prominence as "Flying" or "Paused." A terminal outcome should visually arrest -- this one flashes by on a single line and then the page just sits there.
- **Expected**: On outcome resolution, a larger success/failure banner with a "Reset (R)" CTA and a one-line takeaway. Mid-run statuses stay as the compact strip they are.
- **Fix**: When `outcome !== null`, render an overlaid success/failure card above or over the instrument panel; keep the small status strip for mid-run flight state. Wire the existing `R` keyboard reset into a visible button.

### MINOR: Knowledge `/learn` "Previous" on phase 1 is disabled but offers no "return to node detail" path

- **File**: apps/study/src/routes/(app)/knowledge/[slug]/learn/+page.svelte:122-129
- **Problem**: On phase 1 the Previous button is `disabled`. No way back out except the breadcrumb nav (which is great, but the mental model for the stepper is "walk forward / back through this flow"). On the final phase, "Next" is swapped for "Review cards for this node" -- nice action. No equivalent escape on phase 1.
- **Expected**: Either Previous on phase 1 navigates to the knowledge detail page (the node's summary), or an explicit "Back to node" link lives in the controls row.
- **Fix**: Replace the disabled Previous on step 1 with an `<a>` to `ROUTES.KNOWLEDGE_SLUG(node.id)` labeled "Back to node." Pairs with the final-phase "Review cards" to keep the stepper's front and back edges symmetric.

### MINOR: Calibration "Practice level N" button label is ambiguous about what it does

- **File**: apps/study/src/routes/(app)/calibration/+page.svelte:306-310
- **Problem**: Each bucket with a gap shows a "Practice level 3" button that links to `/session/start?mode=strengthen`. The label implies domain- or confidence-level-specific targeting; in reality every button for every bucket lands on the same Strengthen preset. The comment in the code acknowledges this ("Cards don't store per-card confidence; feeding the calibration signal more data is what moves the score, and Strengthen is the engine slice tuned for that") -- which is correct -- but the label still overpromises. User reads "Practice level 3," clicks, gets a Strengthen session that isn't level-3-scoped.
- **Expected**: Label matches the action. "Start Strengthen" or "Practice miscalibrated cards" or similar; OR the button is genuinely scoped (e.g. `?confidenceLevel=3`) and the session engine filters to cards rated at that confidence bucket.
- **Fix**: Minimum: rename "Practice level N" -> "Strengthen at this level" (same destination, accurate copy). Better: extend the session engine to accept `?focusConfidence=N` and feed only cards whose last confidence was N into the queue; keep the current label.

### MINOR: `/reps/new` Cancel link routes to `/reps` (dashboard), not back

- **File**: apps/study/src/routes/(app)/reps/new/+page.svelte (and similar memory/new)
- **Problem**: Cancel on the new-scenario form hops to `/reps` regardless of where the user came from. If they arrived via `/reps/browse` after noticing a gap, Cancel teleports them two levels up. Similar pattern on `/memory/new` Cancel -> `/memory`.
- **Expected**: Cancel returns to the referring page if it's within the app (`/reps/browse` or `/reps`); falls back to `/reps` as a sensible default.
- **Fix**: Server load returns a `referrer` if the Referer header matches `^/reps|/memory`. Cancel link uses `referrer ?? /reps`. Alternatively, add a `?from=` query param when the "New scenario" button is clicked from browse; Cancel reads it.

### NIT: Reps dashboard disabled "Start session" button has no tooltip explaining why

- **File**: apps/study/src/routes/(app)/reps/+page.svelte:37-42
- **Problem**: When `hasScenarios` is false, "Start session" renders as `<button disabled>`. No title, no aria-describedby, no inline hint. A user who doesn't realize scenarios are per-user and landed on a fresh account sees a greyed button with no explanation.
- **Expected**: `title="Create a scenario first"` or an adjacent `<small>` hint, or render it as a link to `/reps/new` instead of disabling.
- **Fix**: `title="Write a scenario first to enable sessions."` on the disabled button; or swap the disabled state for a text link "No scenarios yet -- create one to start a session."

### NIT: Session summary "Skipped" tile sub-line packs three counts into one row

- **File**: apps/study/src/routes/(app)/sessions/[id]/summary/+page.svelte:61-64
- **Problem**: `{n} today · {n} topic · {n} permanent` jams three stats in the tile sub-line. Typography is tight (0.8125rem, no wrap control) -- on a narrow tablet it can overflow or wrap awkwardly.
- **Expected**: Stats grouped into a compact chip row, or the tile is subdivided into three mini-stats.
- **Fix**: Low-priority. Replace the sub-line with `<ul>` of three chips, `flex-wrap: wrap`. Or keep current layout and let it wrap -- first confirm it actually breaks.

### NIT: `/knowledge` filter form doesn't preserve unknown query params on Reset

- **File**: apps/study/src/routes/(app)/knowledge/+page.svelte:99
- **Problem**: "Reset" links to `ROUTES.KNOWLEDGE` bare, which drops any future query params (sort, view, etc.) that might be layered on. Not a live bug (no such params exist yet), but the pattern is brittle.
- **Expected**: Reset clears filter params but preserves others (none today). Defensive: use `buildHref({ domain: undefined, cert: undefined, priority: undefined, lifecycle: undefined })`.
- **Fix**: Consolidate the href-building in a helper like memory/browse does; prevents future regressions.

### NIT: Sim keyboard help is desktop-only assumption

- **File**: apps/sim/src/routes/[scenarioId]/+page.svelte:265-281
- **Problem**: The help dl lists W/S, Shift, Ctrl, Space, R -- all keyboard. On touch / mobile the sim has no controls at all (keydown/keyup only). Page gives no indication that this is keyboard-required.
- **Expected**: "Keyboard required" banner on mobile, OR virtual joystick / buttons for mobile.
- **Fix**: Phase 0 prototype, so document-only fix: prepend the help block with "Keyboard required -- desktop only for Phase 0." Touch support is a later-phase concern.

### NIT: Glossary page has no H1, title, or empty-state handling at the route level

- **File**: apps/study/src/routes/(app)/glossary/+page.svelte
- **Problem**: The route is a one-line wrapper around `ReferencePage` from `@ab/aviation/ui`. No in-route heading, no breadcrumb, no empty-state messaging at the app level -- everything is delegated to the component. If `references` is empty or the nested component fails, the page surface is blank.
- **Expected**: At minimum a route-level title (already has `<title>` tag) + a visible H1 outside the component so the nav-active state has something to anchor to visually.
- **Fix**: Wrap `<ReferencePage>` in a `<section>` with `<h1>Glossary</h1>` + optional `<p class="sub">`, consistent with every other route's header pattern.

---

## Status of user's open items

| Item                                                            | Status      | Notes                                                                                                                      |
| --------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| Knowledge /learn phase completion tracking still not persisted  | Confirmed   | Stepper shows `active` + `authored`, no visited/complete state at all (session or server).                                 |
| Native `confirm()` still used for destructive actions           | Confirmed   | One surviving site: memory/[id] Archive. ConfirmAction primitive exists in libs/ui but unused anywhere in apps/.           |
| Review rating undo window                                       | Confirmed   | Instant submit-and-advance; no undo, no hold-to-confirm, no history stack.                                                 |
| Skip permanently without confirmation (session runner)          | Confirmed   | Same pattern as Archive -- same primitive can solve it. Prior review also flagged this.                                    |

All four open items are still live. The ConfirmAction primitive is the blocking dependency for two of them (Archive, Skip permanently); review undo and `/learn` completion tracking are independent pieces of work.

---

## Status of prior-review closeouts

| Prior issue                                                                          | Closed? | Evidence                                                                                                                                                    |
| ------------------------------------------------------------------------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CRITICAL: Legacy /reps/session loses progress on refresh                             | Yes     | /reps/session removed; REPS_SESSION retired in routes.ts; dashboard CTA now routes to /session/start.                                                       |
| MAJOR: libs/themes empty, libs/ui one component                                      | Yes     | libs/ui has 11 components (Banner, Button, Badge, Card, ConfidenceSlider, ConfirmAction, KbdHint, PanelShell, Select, StatTile, TextField); themes landed.  |
| MAJOR: No logout control in nav                                                      | Yes     | Identity details/summary menu + sign-out form action live in +layout.svelte.                                                                                |
| MAJOR: Create-then-redirect gives no success confirmation                            | Yes     | `?created=<id>` pattern live on reps/browse + memory/browse; `?created=1` on /plans/[id] detail.                                                            |
| MAJOR: Review rating mistakes have no undo                                           | No      | See open item above.                                                                                                                                        |
| MAJOR: Native confirm() is the only confirmation pattern                             | No      | See open item above. Primitive exists; migration not done.                                                                                                  |
| MAJOR: Calibration filled-state is diagnosis with no treatment                       | Yes     | Per-bucket and per-domain CTAs live; interpretation card surfaces narrative.                                                                                |
| MAJOR: Calibration doesn't explain what it is once data exists                       | Yes     | `interpretation` derived string renders above buckets with worst-bucket callout.                                                                            |
| MAJOR: Browse filter state not visible at a glance                                   | Yes     | Filter chips with `×` removal + Clear-all live on both memory/browse and reps/browse.                                                                       |
| MAJOR: Memory domain links inconsistent                                              | Partial | Memory dashboard + knowledge domain headings link; browse-card domain badges still aren't clickable. Low-priority but still inconsistent.                   |
| MAJOR: /plans/new redirects silently                                                 | Yes     | `?created=1` banner with optional Start-a-session action.                                                                                                   |
| MAJOR: Session summary "Suggested next" is read-only prose                           | Yes     | `summary.suggestedNext` renders as an action-button list with variants.                                                                                     |
| MAJOR: /knowledge/[slug]/learn has no per-phase completion                           | No      | See open item above.                                                                                                                                        |
| MAJOR: Skip permanently in sessions/[id] has no confirm                              | No      | See open item above.                                                                                                                                        |
| MINOR: Stat tiles not clickable                                                      | No      | Memory + reps dashboards still have static tiles.                                                                                                           |
| MINOR: Pagination shows page number but not total                                    | No      | Both browse pages still show bare "Page N."                                                                                                                 |
| MINOR: Confidence slider skip is same weight as ratings                              | Partial | Slider is in libs/ui now (design-system migration took priority); visual tweak still pending.                                                               |
| MINOR: Empty vs complete heading in /memory/review                                   | No      | Still "All caught up." for both.                                                                                                                            |
| MINOR: Cmd+Enter shortcut on memory/new undocumented                                 | No      | Code still implements it; no kbd hint near Save.                                                                                                            |
| MINOR: Cancel on New card has no dirty-form guard                                    | No      | Still direct navigation, no beforeunload.                                                                                                                   |
| MINOR: Dashboard h1 vs nav name mismatch                                             | No      | Still "Learning Dashboard" vs "Dashboard".                                                                                                                  |
| MINOR: Tags field no validation/preview                                              | No      | Still plain text input with hint.                                                                                                                           |
| MINOR: Error messages low-information ("Please try again")                           | No      | Still generic; no reference id surfaced.                                                                                                                    |
| MINOR: Color-only encoding on calibration buckets                                    | Partial | Text labels ("Overconfident by X%") carry semantic weight; color is the scan cue but not the only encoding. Icons still not added.                          |
| MINOR: Login dev-accounts visible in dev, no prod affordance                         | No      | Still no invite-only / request-access copy below the form.                                                                                                  |
| MINOR: Reps session confidence prompt invisible when not shown                       | N/A     | /reps/session retired; new /sessions/[id] prompts explicitly via the ConfidenceSlider phase. Issue moot.                                                    |

---

## Not raised as new issues (already in prior review, no regression)

- Breadcrumb primitive for deeper flows (`/memory/[id]` still uses `← Browse` text)
- `Browse` overloaded as a term (VOCABULARY entry pending)
- Mobile nav responsiveness (still desktop-first; unchanged)
- `data-app-id="study"` on `<html>` (still a pointer to future theme work; now partially used by the resolved theme provider)

---

## Recommended ordering

Pick the three items that cost <= a day each and remove the last surviving MAJOR debt:

1. **ConfirmAction migration.** Archive on `/memory/[id]` + Skip-permanently on `/sessions/[id]`. Same primitive, two sites, couple of hours. Kills two MAJOR issues at once.
2. **Review rating undo window.** 2-second inline "Rated X -- undo" bar on `/memory/review`. Adds one new server action (`?/rollback`) plus a Timeout-driven `$state` flag. Removes the last MAJOR on the user's open-items list.
3. **Per-phase visited state on `/learn`.** Start with session-scoped `visited: Set<KnowledgePhase>` and a `.step.visited` visual. Gives the learner the missing "where was I?" cue without a new table. Promote to server persistence in a follow-up only if user-zero walkthrough confirms value.

Everything else in this review is polish, nit, or scoped to the sim-app prototype (which explicitly labels itself throwaway). None of it is urgent.
