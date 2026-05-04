---
title: 'Phase 5 UX Review: Hangar Review Queue'
reviewer: ux
date: 2026-05-04
diff: d975adb2...3b523eff
---

# Phase 5 UX Review: Hangar Review Queue

Phase 5 lights up the WP-spec tabbed view (`/review/wp_spec/[itemId]`) and the test-plan walker (`.../walker`). Per the spec, this is "the killer feature." The implementation is broadly thoughtful: spec.md frontmatter is the source of truth, sessions are resumable, the walker round-trips through SvelteKit form actions, optimistic outcome flips fall back cleanly on transport errors, and there is a polite live region in both routes. Tabs / sidebar / walker rows wire to design tokens; no hex literals.

The places it falls short are mostly around the points where the user is most committed: finishing a session, recovering from a partial fail, and being told what just happened. The default-to-`pass` finish bug, the toast-eaten-by-navigation pattern, and the "no test plan" sidebar that still offers an "Open walker" button at the bottom of the actions card are the load-bearing ones. Everything else is polish.

## Summary

- Files reviewed: 5
- Critical: 1
- Major: 7
- Minor: 11
- Nit: 6

## Findings

### Critical

#### CRITICAL: Finish defaults to "pass" when only blocked rows exist (or any non-fail mix that isn't a clean pass)

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/walker/+page.svelte:293`
- **Problem**: The Finish button preselects the confirm outcome with `confirmFinish = everyStepPassed ? 'pass' : totals.fail > 0 ? 'fail' : 'pass'`. If the reviewer recorded any combination that is not a clean pass and has zero fails (e.g. all blocked, or blocked + pass, or just one step recorded as blocked), the dialog opens with **`Finish session as pass?`** and the visible flip warning text says "All N steps passed -- this will flip review_status: done." But `everyStepPassed` is false in that branch, so `cleanPass` will be false on the server and the flip will not actually happen. The user sees a UI that says "you're flipping review_status to done" while the server quietly closes a non-flip pass session. Worse, the user just one-clicks Confirm because the dialog claims clean pass.
- **Why it matters**: The walker's whole point is to gate `review_status: done` behind a 100% pass. The fallback `: 'pass'` defeats that: a session with any blocked rows looks like a successful run on the way out and ends up labelled `outcome=pass` in `review_session.outcome` even though the test plan was not satisfied. Future reviews of session history will not flag it as "incomplete".
- **Fix**: Default to `'abandoned'` (or, better, `'fail'` when non-pass rows exist) when the walker did not complete cleanly. The `SESSION_OUTCOMES` enum already has `abandoned` for exactly this case. Reading: `confirmFinish = everyStepPassed ? 'pass' : totals.fail > 0 ? 'fail' : 'abandoned'`. And drop the `flip-note` paragraph unless `everyStepPassed && confirmFinish === 'pass'` is true (it already gates correctly, but verify the message can never appear with `confirmFinish = 'pass'` on a non-clean run).

### Major

#### MAJOR: Finish toast is destroyed by the redirect to spec view; user has no confirmation the flip happened

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/walker/+page.svelte:194-201`
- **Problem**: After `?/finishSession` succeeds, the walker writes `toast = { kind: 'success', message: 'Session finished as pass. review_status flipped to done.' }`, runs `invalidateAll()`, sets `confirmFinish = null`, then immediately `await goto(ROUTES.HANGAR_REVIEW_KIND(...))`. The toast lives on the walker page, so it disappears the instant the navigation completes. The user lands on the spec view with no toast, no banner, no live announcement -- just a quietly updated session-history rail (one new "Pass" badge buried in the right rail). For a feature whose acceptance criterion is "the user knows the flip happened," this is the load-bearing UX moment and it is invisible.
- **Why it matters**: Two acceptance bullets in spec.md depend on this: "Item now in Done column" and "100% pass triggers frontmatter flip." The user has no closing handshake telling them either occurred. Failure modes (frontmatter write threw) are likewise lost.
- **Fix**: Either (a) carry the toast across the navigation by appending a query param the spec view reads on mount and re-displays as a toast, or (b) inline a final state on the walker page itself ("Session finished -- redirecting...") and only navigate after a brief confirmation. Option (a) is cleaner; the spec view already has a toast surface and the load function can read `?finishedAs=pass&flipped=true`. Today `frontmatterError` is also dropped silently on redirect, which is worse than the success case.

#### MAJOR: "Open test-plan walker" link appears in the spec view's Actions card even when no test-plan.md exists

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/+page.svelte:202`
- **Problem**: The sidebar's Walker card correctly says "No test-plan.md for this work package" when `!data.walker.hasPlan`. But the Actions card a few rows below still renders `<a class="action-link" href={walkerHref}>Open test-plan walker</a>` unconditionally. The user clicks it, lands on the walker route, and the walker server load creates an `open` review_session for an empty plan, then renders the "No walker steps detected" empty state. They now have an open session row in the DB with zero steps, plus a blank session timestamped in the spec view's "Sessions" rail.
- **Why it matters**: Side-effect of clicking a dead-end link is a polluted session list. The spec view already knows there's no plan; it should not link to the walker at all in that branch.
- **Fix**: Wrap the action-link in `{#if data.walker.hasPlan}`. Better, also avoid the `startSession()` insert in the walker server load when `steps.length === 0` -- create the session lazily on first `?/recordStep` so dead-end visits leave no row. The current shape has the BC creating sessions for empty plans even via direct URL access.

#### MAJOR: Walker has no "Abandon" affordance; only Pause (which doesn't close) or Finish (which closes with a sticky outcome)

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/walker/+page.svelte:287-326`
- **Problem**: `SESSION_OUTCOMES` includes `abandoned` but the walker UI never offers it. If the reviewer starts a session, records two passes, realises the WP isn't ready, and wants to throw the session out -- they have three choices: Pause (session stays open forever), Finish-as-fail (creates a misleading "fail" entry), or close the tab (also leaves the session open, plus pollutes "open session" semantics so the spec view keeps offering "Resume walker"). There is no graceful exit.
- **Why it matters**: The spec calls for "multiple sessions per item are allowed (e.g., walk it again after a fix). Latest session is the default view; prior sessions are listed below." Today every never-finished session sticks around as "Open" in the rail forever. A reviewer who walks five WPs, then realises the loader hadn't refreshed, gets five permanently-open sessions and five "Resume walker" links that never go away on reload.
- **Fix**: Add an "Abandon" button alongside Pause / Finish that closes the session with `outcome='abandoned'`, prompts confirm with "All step outcomes will be discarded" wording, and -- critically -- never flips frontmatter regardless of pass count. Surface abandoned sessions in the rail with a distinct `badge-abandoned` token (the rail currently catch-alls non-pass non-fail closed sessions to the generic `.badge` style which reads "abandoned" as plain mono text).

#### MAJOR: Note typed without first picking an outcome is held in the local map but never persisted; user loses it on reload

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/walker/+page.svelte:143-157`
- **Problem**: `commitNote` explicitly comments "Save a local-only optimistic note so the textarea persists until the user picks an outcome -- the next outcome click submits both at once." But `WalkerStepRow.svelte:55-58` always re-mirrors `noteDraft = recordedNote` on every server-load `$effect`, and an `invalidateAll()` from a sibling step's recordStep returns fresh `data.recordedByRef` that does not include the orphan-note-no-outcome row -- so after typing a note on step 5 and clicking pass on step 4, the page reloads, step 5's `recordedByRef` entry is missing, the WalkerStepRow re-mirrors `noteDraft` from `recordedNote = ''`, and the typed note vanishes. User-visible: "I typed a note on step 5 but didn't pick an outcome yet, then clicked pass on step 4 -- now my step 5 note is gone."
- **Why it matters**: Reviewers commonly write the note before deciding the outcome ("seems sketchy because X, Y, Z, hmm, let me think about pass/fail..."). The current implementation invisibly nukes that note any time another step records.
- **Fix**: Three options. (a) On note-without-outcome, persist a `outcome='blocked'` row so the note has a home, and let the user override. (b) Save the orphan note in localStorage keyed on `(sessionId, stepRef)` so reloads resurrect it. (c) Surface the orphan-note row to the parent so subsequent server reloads don't blow it away (lift the "no outcome yet" map into the walker page state). (a) is the simplest and matches the existing BC contract that requires an outcome.

#### MAJOR: Optimistic outcome flip persists across server-load races; stale outcome can be left in the UI when invalidateAll fails to refetch

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/walker/+page.svelte:78-124`
- **Problem**: `recordStep` always sets the optimistic state to the new outcome, then awaits `postAction` and then `invalidateAll`. If `invalidateAll` resolves but the load returned a stale row (e.g. pre-write snapshot due to a connection retry on the server), the `$effect` at line 39-43 will overwrite optimistic with stale data -- but then a subsequent click on a different step's outcome will start from the stale baseline, masking the prior issue.

  More acutely: the `$effect` always replaces `optimistic` with `recordedByRef` *every time `data` updates*. In the case where the user clicked Pass, the server wrote it, the load re-fetched it, and the `recordedByRef` came back identical -- great. But if the user clicked Pass and then -- before the round-trip resolves -- clicked Fail on the same row, the second click writes `optimistic` again, the first round-trip resolves and triggers `invalidateAll` and the `$effect` snaps the row back to the *first* pass (because that's what server sees), then the second round-trip resolves and snaps to fail. The intermediate flip back to pass is visible. This is racy in a way that confuses the reviewer mid-decision.
- **Why it matters**: Walker is the most click-heavy surface in the feature. Two-click sequences (pass then change-of-mind to fail) are common. The user sees a flicker through pass-fail-pass-fail, or worse, a pass that "won't stick" if they clicked twice fast.
- **Fix**: Sequence per-step writes (track a per-stepRef in-flight token, drop the stale write's apply if a newer click came in). Or: don't run the `$effect` that overwrites optimistic on `data` change while any save is in flight (`savingByStep.size > 0`). The simpler fix is the latter; mute the mirror-effect during in-flight.

#### MAJOR: No keyboard shortcut for outcome buttons; a 50-step plan needs ~100 mouse clicks to walk

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/walker/+page.svelte` and `libs/ui/src/components/WalkerStepRow.svelte`
- **Problem**: The walker is the high-volume click surface in this feature. The reference TOC review (Phase 6, per the spec) plans `j` / `k` / `b` keyboard shortcuts; the walker for `wp_test_plan` -- which is more click-heavy -- has none. A reviewer walking a 50-step plan does 50 clicks to read the row + 50 clicks for outcome + N for notes. The `outcomes` div is a `role="group"` of three plain buttons; tab to one, Enter to activate, but no spatial / keyboard locality between rows.
- **Why it matters**: Adoption killer. The first half of the spec frames the entire WP as solving "I have 89 work packages and have reviewed none of them." A 50-click-per-WP cost makes the feature feel high-friction.
- **Fix**: Either (a) wire `j`/`k`/`b` shortcuts page-level (focused step gets the outcome) with a visible cheat-sheet in the summary panel, like `j = pass | k = fail | b = block`, matching the design doc's reference_toc keyboard pattern; or (b) make the buttons keyboard-equivalent of a radio group: `role="radiogroup"` on `.outcomes`, `role="radio"` per button, arrow-key navigation between them. (a) is the bigger UX win; (b) is the floor.

#### MAJOR: Tabs lose state on `?/markSpecRead` / `?/flipReviewStatus` because `invalidateAll()` re-runs the load and the URL `?tab=` is only read once on mount

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/+page.svelte:24,49-58`
- **Problem**: The component reads `page.url.searchParams.get('tab')` once in the `$state` initializer and uses an `$effect` to push subsequent activeTab changes back via `replaceState`. When the user is on the Test Plan tab and clicks "Mark spec read", the `use:enhance` callback runs `await update()` then `await invalidateAll()` -- which re-runs the page load and updates the form prop. The component does not re-mount, so `activeTab` is preserved (good). But the URL has `?tab=test-plan`, the `update()` may reset to default, and any future cold reload after the toast is dismissed will land on Spec because the URL was reset to clean. This is also fragile against future changes that swap the form-action surface.

  Confirmed less-fragile path: I traced the code and `update()` is called with no options, which means SvelteKit's default is `reset: true` (it resets the form prop and re-runs `invalidateAll`). The URL itself isn't touched by `update()`, but reloads carry whatever's in the URL bar -- which the `$effect` does keep in sync. So the actual bug is narrower: when the user lands on spec view via a *server redirect* from `/review/items/[itemId]` and that redirect drops the `?tab` param, deep-link state is gone. Plus the `$effect` runs `replaceState` even on the initial paint, immediately stripping `?tab=spec` since the if-clause deletes `tab` for the default; this clears any other query params siblings that the redirect carried (none today, but fragile).
- **Why it matters**: Tabs are user-visible-state; the WP being reviewed and which doc the reviewer is currently looking at is page state that should survive any in-page action. The current shape mostly works but has a sharp edge waiting for a future redirect path.
- **Fix**: Use `goto(url, { replaceState: true, keepFocus: true, noScroll: true })` instead of raw `history.replaceState`; SvelteKit then keeps the URL in sync with its own router state and avoids subtle desync after `invalidateAll`. Also: when reading the initial tab, also accept it from the path-fragment hash (`#test-plan`) for old-school deep links from prose.

### Minor

#### MINOR: Step number column duplicates the table's first column (e.g. "1" next to "1.1")

- **File**: `libs/ui/src/components/WalkerStepRow.svelte:72-73`
- **Problem**: `parseTestPlan` emits `stepIndex` (1-based across the whole plan) and `title` (column 1, typically "1.1" / "1.2" / "8.10"). The row renders both: `<span class="step-number">{stepIndex}</span>` immediately followed by `<h3 class="step-title">{title}</h3>`. So a row reads "5  1.5  Click Pass on step 1.1." Two numbers competing for attention; confusing when the test plan author already chose `1.5` as the step label.
- **Why it matters**: The design.md sketch shows the title row as `1.1  Navigate to /flightbag with empty database` -- one identifier, not two.
- **Fix**: Drop the `step-number` chip OR drop the `title` from the rendered body and make the section header carry the H2 group label. The latter matches the design doc better.

#### MINOR: `sectionTitle` from parseTestPlan is parsed but never displayed; rows pile up without their H2 grouping

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/walker/+page.svelte:328-344`
- **Problem**: Every step has a `sectionTitle` field (the H2 it lives under, e.g. "8. Test-plan walker -- end-to-end"). The walker page maps `data.steps.forEach -> WalkerStepRow` with no grouping. A 12-section, 40-step plan renders as a 40-row flat list. The design.md explicitly shows `## 1. First Visit -- Auto-Setup` as a section divider above the rows.
- **Why it matters**: Section breaks orient the reviewer ("ok, I'm done with the loader section, now onto bucket admin"). Without them, there's no sense of progress through the plan, and the summary's "12/40 recorded" is the only orientation hint.
- **Fix**: Group `data.steps` by `sectionTitle` (preserving order) and render each group with an `<h2>` divider -- matches the design.md mock 1:1.

#### MINOR: "Resume walker" / "Open test-plan walker" share the same button shape; resume gets no visual cue it's resuming a session-in-progress

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/+page.svelte:146-148`
- **Problem**: The walker card shows `Resume walker` text when `openSessionId !== null`, but the link looks identical to "Open test-plan walker" otherwise. The "X of Y steps recorded" line above is the only signal that a session is in flight. No "started 14:21" timestamp, no "last edited 3 minutes ago," no progress bar, no badge.
- **Why it matters**: Returning the next day, the user wants to know "did I leave myself a session" before clicking. Today the walker card carries the data (recordedSteps + counts) but presents no continuity. Compare to the design.md walker mock: "Session #2 -- started 14:21".
- **Fix**: When `openSessionId !== null`, show the open session's `startedAt` next to the resume affordance. The data is already in `data.sessions` (the rail below); join them in the load function or surface `openSession.startedAt` separately.

#### MINOR: "Sessions" rail has no truncation indicator at the 20-row cap

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/+page.svelte:154-178`
- **Problem**: `listSessions(item.id)` server-side hard-caps at `REVIEW_SESSION_HISTORY_LIMIT = 20`. The UI renders all rows it gets and stops; no "Showing 20 of N" indicator and no link to a full-history view.
- **Why it matters**: A heavy reviewer who has walked one WP 25 times sees an arbitrary slice of history with no signal that there's more.
- **Fix**: Either add a count to the heading (`<h2>Sessions ({{count}})</h2>`) or surface an explicit "Showing the last 20 sessions" footer when the cap is hit. Cap detection requires counting on server (or returning a `truncated: boolean` flag).

#### MINOR: Frontmatter sidebar is a left-justified mono dl on the same column as the article body, not a right-rail panel

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/+page.svelte:111-123`
- **Problem**: Design doc shows "Right-rail frontmatter panel: collapses on mobile, hidden if no frontmatter." Implementation puts the frontmatter dl as a sunken card *above* the markdown article, on the same column. With the content area being already constrained by the 18rem sidebar grid column, the frontmatter card eats vertical space at the top of every tab.
- **Why it matters**: Vertical-stack pushes the doc body down by ~150px. On smaller viewports the user scrolls past the frontmatter to read the spec, then reverses to check `status` / `review_status`. A pinned right rail (or a fold-out detail) is the design doc's intent.
- **Fix**: Either move the frontmatter dl into the right sidebar (above the Walker card), or wrap it in a `<details>` element that defaults closed. Note the design.md sidebar already has Status / Sessions cards -- add a Frontmatter card above them.

#### MINOR: `?tab=spec` shows `(none)` suffix on tab labels for missing files but no global indication "this WP only has 2 of 6 docs"

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/+page.svelte:38`
- **Problem**: Tab labels become `Tasks (none)`, `User Stories (none)` etc. when files are missing. The labels are still clickable (the panel snippet shows the missing-file placeholder). For a WP with five missing docs out of six, every tab except Spec reads "(none)" and the user has to click each to see the same placeholder.
- **Why it matters**: Wasted clicks. If a tab maps to no file, default to non-clickable.
- **Fix**: When `tab.present === false`, set `disabled: true` on the TabItem (Tabs.svelte already supports `disabled`). The default-active-tab fallback in Tabs.svelte already finds the first enabled tab, so the user lands somewhere clickable.

#### MINOR: "Confirm finish" panel sits inside the same `.summary` flex container as the live progress dl; on small viewports the dl wraps under the dialog and gets visually lost

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/walker/+page.svelte:260-326`
- **Problem**: When the user clicks Finish, the .actions div swaps the Finish button for a `<form class="finish-form">` that's `flex-direction: column; max-width: 24rem`. The summary container's `flex-wrap: wrap` makes the form drop below the dl on narrow viewports, but at intermediate widths (700px, say) the form pushes the dl into a vertical stack and the user can no longer see the pass/fail/blocked tally that's informing their finish decision.
- **Why it matters**: The dl is the context the user needs to confirm. Hiding it under the dialog defeats the dialog.
- **Fix**: Either make `.finish-form` an inline overlay (absolute-positioned popover) anchored to the Finish button, or move the confirm into a real `<dialog>` modal. The popover keeps the dl visible.

#### MINOR: Error toast on `recordStep` failure does not preserve the rejected outcome -- user has to re-click

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/walker/+page.svelte:96-119`
- **Problem**: On `result.type === 'failure'`, optimistic state is reverted to `prior` (or deleted), the toast shows the failure reason, and the row goes back to its previous outcome. The user has no signal *which* step failed (the toast is page-level, not row-level). With three rows in flight, the user sees one toast and has to figure out which row reverted.
- **Why it matters**: Walker errors are likely transient (DB hiccup, network flap). Re-clicking the right row requires scanning the list.
- **Fix**: Add a per-row error state to `WalkerStepRow` that surfaces inline ("save failed -- click to retry"). The container already has `savingByStep`; extend with `errorByStep: Map<string, string>`.

#### MINOR: `startedAt` in walker header / sidebar uses `toLocaleString()` with no timezone; reviewer working across timezones sees ambiguous dates

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/walker/+page.svelte:227` and `+page.svelte:162`
- **Problem**: `new Date(data.session.startedAt).toLocaleString()` returns "5/4/2026, 2:21:14 PM" with no timezone. A reviewer who walks a session at home (PST), opens the spec view at the office (EST), sees a different timestamp than what they remember.
- **Why it matters**: Session resume hinges on "is this the same session I left yesterday?" Ambiguous timestamps undermine that.
- **Fix**: Use `new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZoneName: 'short' }).format(new Date(...))` -- or use a relative-time formatter ("3 hours ago, started PST") that matches what reviewers actually want.

#### MINOR: Tab content is unstyled prose; long tables overflow the content column on narrow viewports without scroll affordance

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/+page.svelte:124`
- **Problem**: `<MarkdownArticle bodyHtml={tab.bodyHtml} />` renders sanitized HTML. Tables in spec / test-plan / design files have wide rows (the test-plan table here is 3 columns and 80+ chars per row). The MarkdownArticle's prose container is 1fr inside a grid that allots 18rem to the right rail; on a 1024px viewport the prose column is ~700px which pushes table content into horizontal overflow.
- **Why it matters**: The Test Plan tab is the most important content surface in the WP-spec view. If its tables get clipped off-screen the reviewer doesn't read the expected column.
- **Fix**: Wrap the MarkdownArticle in a horizontal-scroll container `overflow-x: auto`, OR ensure MarkdownArticle's table styles include `overflow-x: auto` on a wrapping div around `<table>`.

#### MINOR: Toast persists indefinitely; no auto-dismiss

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/+page.svelte:97-102` and walker `:234-239`
- **Problem**: Toasts have a manual dismiss button but no auto-dismiss timer. Success toasts in particular ("Spec marked as read.") should disappear after a few seconds; today they stay until the user clicks the `×`.
- **Why it matters**: Permanent toasts pile up if the user takes multiple actions in sequence (mark read -> flip review_status, sees success replaced by success). Not destructive but visually noisy.
- **Fix**: Auto-dismiss success toasts after ~4-5s; keep error toasts sticky (the user needs to read them) but offer a Retry button alongside Dismiss for actionable errors.

### Nit

#### NIT: Breadcrumb label "Test Plan" is the segment to spec view, not to the walker

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/walker/+page.svelte:13-17`
- **Problem**: Crumbs are `[Review board, Test Plan -> spec view, item.title]`. Clicking "Test Plan" returns to the spec view (which has a Test Plan *tab*). That's reasonable, but the label is confusing -- the user just left the Test Plan tab and is on the walker; the crumb labelled "Test Plan" then points back to the parent. Calling it "Spec" or `data.kindLabel` would be clearer.

#### NIT: Pause button shows "Pausing..." spinner but the action does no real work; users see a loading state for a no-op

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/walker/+page.svelte:204-215`
- **Problem**: `?/pauseSession` literally returns `{ pauseSession: 'ok' }` after a `requireRole` check. The frontend posts a form, awaits the response, then navigates. A reviewer hitting Pause sees a brief spinner for what could be a synchronous link.

#### NIT: `liveAnnounce` overwrites itself on rapid consecutive saves; AT users miss intermediate announcements

- **File**: walker `+page.svelte:122` and elsewhere
- **Problem**: `liveAnnounce = "Step N recorded as pass."` -- if a user clicks pass on step 1, then pass on step 2 within 200ms, only the last one is announced. ARIA polite live regions queue but the value reset can be coalesced.
- **Fix**: Append rather than replace, or use `aria-relevant` semantics; small impact.

#### NIT: "Mark spec read" succeeds even when status is already `done`; toast is misleading "Spec marked as read"

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/+page.server.ts:230-247`
- **Problem**: The action overwrites `status: done` with `status: done` and reports success. No-op success is fine, but the toast wording implies state changed.

#### NIT: Frontmatter dl uses `display: contents` on `.fm-row`, breaking screen-reader dl association in older AT

- **File**: `+page.svelte:308-310`
- **Problem**: `display: contents` is generally well-supported now, but `dl > div > dt + dd` still trips up some older readers. Marginal.

#### NIT: Outcome buttons `min-width: 4rem` is tight for the longest label "Blocked" -- truncation risk if labels grow with i18n

- **File**: `WalkerStepRow.svelte:215`
- **Problem**: Cosmetic. Future i18n of `REVIEW_OUTCOME_LABELS` could overflow.

## Areas verified clean

- **Auth gating**: every action and load calls `requireRole(event, AUTHOR/OPERATOR/ADMIN)` with no orphan endpoints.
- **Tamper guard**: `?/recordStep` and `?/finishSession` both verify `getOpenSession(itemId, userId).id === sessionId` before touching the DB. A second user cannot step on another user's session by guessing IDs.
- **Idempotency**: `startSession` is correctly retry-safe on 23505 unique violation; `recordStep` is upsert-keyed on `(sessionId, stepRef)`; finishing twice would fail at the BC level (already-set `finishedAt`) which is the right shape.
- **Frontmatter write atomicity**: `writeFrontmatterField` (sibling temp + rename) is durable against partial writes.
- **Live region present**: both routes render a `<div aria-live="polite" role="status">` for AT announcements.
- **Disabled-while-saving**: outcome buttons honour `disabled={savingByStep.get(stepRef) === true}` so a fast double-click does not double-submit per row.
- **Read-vs-write determinism**: finishSession re-reads the live test plan and recorded steps before deciding flip rather than trusting the load-time snapshot, defending against a concurrent test-plan edit between page load and Finish click.
- **Empty / missing states**: walker handles "no test-plan.md" and "test-plan.md exists but no walkable rows" with distinct copy and a back-to-spec link.
- **Tabs keyboard nav**: arrow / Home / End / Enter all wired in the shared Tabs component, with `prefers-reduced-motion` honoured on `scrollIntoView`.
