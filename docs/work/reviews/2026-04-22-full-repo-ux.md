---
feature: full-repo
category: ux
date: 2026-04-22
branch: main
issues_found: 34
critical: 3
major: 14
minor: 12
nit: 5
---

## Summary

Shared primitives (`Button`, `Banner`, `ConfirmAction`, `TextField`) exist and are well-designed, but they are inconsistently adopted: nearly every study-app route re-implements its own `.btn` / `.banner` / `.error` CSS instead of using the `@ab/ui` primitives, so the ceiling set by the shell is not reaching the pages. That is the single biggest propagatable UX debt in the repo. On top of that, destructive lifecycle actions (archive plan, finish session early) and most dashboard panel feeds lack confirmation or loading affordances; form action errors from root routes (plan archive/activate/removeSkipNode) are discarded because the pages never inspect `form?.error`; and several pages end on a "success, good luck" state with no next action.

## Propagatable Patterns (top priority)

These are the issues that set the ceiling for every future page. Fix here once and dozens of pages improve.

| # | Pattern                                                                 | Where it leaks                                                                                                                                                                                                                      |
| - | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | Re-implemented `.btn` CSS in every route instead of `Button`            | `memory/+page.svelte:293`, `memory/new/+page.svelte:326`, `memory/[id]/+page.svelte:685`, `memory/browse/+page.svelte:578`, `memory/review/+page.svelte:590`, `plans/+page.svelte:291`, `plans/[id]/+page.svelte:461`, `plans/new/+page.svelte:421`, `reps/+page.svelte:295`, `reps/new/+page.svelte:550`, `reps/browse/+page.svelte:600`, `sessions/[id]/+page.svelte:585`, `sessions/[id]/summary/+page.svelte:354`, `session/start/+page.svelte:459`, `calibration/+page.svelte:934`, `knowledge/+page.svelte:408`, `knowledge/[slug]/+page.svelte:447` |
| 2 | Re-implemented success banner + dismiss in every "created" landing page | `memory/new/+page.svelte:81-85`, `memory/browse/+page.svelte:137-147`, `plans/[id]/+page.svelte:80-90`, `reps/browse/+page.svelte:132-139`                                                                                            |
| 3 | Re-implemented `.error` block for form errors                           | `memory/new/+page.svelte:87-89`, `memory/[id]/+page.svelte:166-168`, `plans/new/+page.svelte:98-100`, `plans/[id]/+page.svelte:94-96`, `reps/new/+page.svelte:109-111`, `sessions/[id]/+page.svelte:119-121`                        |
| 4 | Destructive form actions without confirmation                           | `plans/[id]/+page.svelte:222` (Archive plan), `plans/[id]/+page.svelte:208` (Reactivate skipped node), `sessions/[id]/+page.svelte:101,127` (Finish early / Show summary), `memory/[id]/+page.svelte:268-289` (Suspend/Reactivate) |
| 5 | Form action returns `fail({ error })` but page never renders it         | `plans/[id]` archive/activate/removeSkipNode all have no surfacing in the template (only `?/update` errors render); user sees nothing when server rejects                                                                           |
| 6 | No SvelteKit `+error.svelte` anywhere                                   | Every `error(404)` / `error(500)` thrown in a load function falls back to SvelteKit's built-in page; no branded surface, no "back to dashboard" affordance                                                                         |
| 7 | No global `+layout.svelte` loading/navigation indicator                 | Long-running loads (memory/browse with big decks, knowledge graph render, session preview shuffle) give zero feedback between click and paint                                                                                      |
| 8 | Async GET filters submit a full page nav with no pending state          | `memory/browse`, `reps/browse`, `knowledge` all filter via `<form method="GET">` with no aria-busy or disabled "Apply" during the re-fetch                                                                                         |
| 9 | Double-submit prevention via local `loading` flag is ad-hoc per form    | At least 14 forms each re-implement `let loading = $state(false)` + `disabled={loading}`. No shared `use:pending` hook                                                                                                             |
| 10 | Empty states mix styles -- some bordered-dashed, some plain, some plan panel variants | `memory/+page.svelte:100-102` (inline `<p>`), `reps/+page.svelte:55-60` (dashed block), `plans/+page.svelte:90-99` (centered card), `session/start:239-247` (centered card), `glossary`/`knowledge`/`help` each different |
| 11 | `ConfirmAction` exists and is used in 2 pages only                      | Only `memory/[id]` archive and `sessions/[id]` skip use it; `plans/[id]` archive, session "finish early", memory suspend, plan node reactivation all ignore it                                                                     |

## Issues

### CRITICAL: Plan archive / activate silently discards server errors

- **File**: `apps/study/src/routes/(app)/plans/[id]/+page.svelte:98-108, 218-232`
- **Problem**: The update form surfaces `form.error` (line 94-96), but the archive/activate/removeSkipNode forms never inspect the ActionData. If the server returns `fail(400, { error: ... })` from those actions (e.g. trying to archive while it's the only active plan), the user sees the form re-render with no message and no visible state change. Silent failure on a lifecycle action.
- **Expected**: Any `form.error` from any action on this page surfaces in a single Banner near the top, or at least near the failed form.
- **Fix**: Move the `form?.error` banner above the `<form>` blocks so it covers all actions, not just `?/update`. Use the shared `Banner` primitive. Same pattern in `sessions/[id]/+page.svelte` for the `?/finish` form.

### CRITICAL: Archiving an active study plan requires no confirmation

- **File**: `apps/study/src/routes/(app)/plans/[id]/+page.svelte:221-224`
- **Problem**: Clicking "Archive plan" immediately archives the active plan and returns the user to a state with no active plan. There is no confirmation, no undo, no "are you sure?" A sibling paragraph warns about it but the button fires on the first click. This is exactly the case `ConfirmAction` exists for.
- **Expected**: Two-click confirm, consistent with the archive flow on memory cards (`memory/[id]:291-299`).
- **Fix**: Replace the raw form with `<ConfirmAction formAction="?/archive" label="Archive plan" confirmLabel="Archive and lose the active plan" confirmVariant="danger" />`.

### CRITICAL: Session "Finish early" immediately ends the session, no confirmation

- **File**: `apps/study/src/routes/(app)/sessions/[id]/+page.svelte:101-105`
- **Problem**: One click on "Finish early" from the top-right posts `?/finish` and the user loses the in-progress session with no way to resume. The Svelte 5 reactivity guarantees the button fires on first click. This is the core flow of the app.
- **Expected**: Two-click confirm, especially mid-session when N items have been answered.
- **Fix**: Use `ConfirmAction` with `confirmLabel="End the session now"`. Consider showing "End and save progress" vs "End and discard progress" if both paths exist.

### MAJOR: No `+error.svelte` page -- every load failure dumps the generic SvelteKit page

- **File**: entire `apps/study/src/routes`
- **Problem**: `load()` functions throw `error(404, ...)` in multiple places (`plans/[id]:41`, `memory/[id]`, `knowledge/[slug]`, `glossary/[id]`, `sessions/[id]`, sim `[scenarioId]:12`). None of these have a `+error.svelte` sibling, so users hit the SvelteKit default "500 / 404" black-on-white page with no navigation, no branding, no "back to dashboard" affordance. Any 500 during `getDashboardStats()` or `getCards()` drops them off the app entirely.
- **Expected**: Branded `+error.svelte` at the root of `(app)` showing the status code, a friendly message, a "Back to dashboard" and "Report this" affordance.
- **Fix**: Add `apps/study/src/routes/(app)/+error.svelte`. Use `Banner variant="danger"` + `Button href={ROUTES.DASHBOARD}`.

### MAJOR: `memory/browse` createdCard banner and `reps/browse` createdScenario banner re-invent the same widget

- **File**: `apps/study/src/routes/(app)/memory/browse/+page.svelte:137-147`; `apps/study/src/routes/(app)/reps/browse/+page.svelte:132-139`
- **Problem**: Both pages maintain local `bannerDismissed = $state(false)` and a hand-rolled div.banner with a close button. The `Banner` primitive from `@ab/ui` has `dismissible={true}` and `onDismiss` built in. Neither page uses it. The `?created=` flash is a propagatable pattern (plans/[id], memory/new, plan detail) but each page rebuilds it.
- **Expected**: Factor into a `FlashBanner` shared helper, or at minimum use `Banner variant="success" dismissible onDismiss={...}`.
- **Fix**: Replace inline banner divs with `Banner` primitive; drop duplicate CSS from each file (≈ 40 LoC × 4 files).

### MAJOR: Button and error CSS duplicated across 17+ route files

- **File**: (see Propagatable Patterns table row 1)
- **Problem**: Every route hand-copies `.btn`, `.btn.primary`, `.btn.secondary`, `.btn.ghost`, `.error`, `.banner` styles. The `Button` primitive with matching variants exists (`@ab/ui/components/Button.svelte`). When `Button` adds a variant (`danger`), a loading state, a keyboard shortcut pattern, or any polish, 17 pages have to be manually touched. This is the main reason the app doesn't feel consistent.
- **Expected**: All routes use `Button`, `Banner`, `TextField` from `@ab/ui`. Page-local `.btn` classes deleted.
- **Fix**: Migration pass. Can be parallelized by file per the "parallel agents scope by file" rule. Start with plans + memory + reps (they use the exact same variant set); sessions and calibration are more custom but still reducible.

### MAJOR: `memory/[id]` Suspend / Reactivate fires on first click; Archive is confirmed

- **File**: `apps/study/src/routes/(app)/memory/[id]/+page.svelte:268-289`
- **Problem**: Suspend changes card state from active → suspended immediately; Reactivate does the inverse. Archive uses `ConfirmAction` (line 291). Suspend and Reactivate are ostensibly reversible but they still disrupt the review queue -- at minimum the user should get feedback that something happened (the page just re-renders silently on success). Inconsistent: Archive is 2-click, Suspend is 1-click.
- **Expected**: Either confirm Suspend too, or keep Suspend 1-click but surface a success toast ("Card suspended. [Reactivate]" with an undo link that posts `?/setStatus` back to active).
- **Fix**: Add the post-action edit-toast pattern already in use for `update` (line 66-79) to Suspend/Reactivate as well, or apply `ConfirmAction`.

### MAJOR: Session-start preset gallery disables ALL tiles while one submits

- **File**: `apps/study/src/routes/(app)/session/start/+page.svelte:125-195`
- **Problem**: `disableOthers = submittingPresetId !== null && submittingPresetId !== preset.id` disables every non-submitting tile including the `tile-custom` link to `PLANS_NEW`. If the user changes their mind mid-spinner they can't navigate away. There is no cancel. If the activation fails, `submittingPresetId` resets via `update()` but if the server hangs (network), everything is locked.
- **Expected**: Only the submitting tile itself indicates busy; other tiles show at normal affordance; custom tile stays navigable. Add a timeout-abort affordance if a submission exceeds 10s.
- **Fix**: Drop the `disableOthers` class and only disable the busy tile. Reconsider the custom-tile `onclick` preventDefault.

### MAJOR: No loading indicator between route navigations

- **File**: `apps/study/src/routes/(app)/+layout.svelte`
- **Problem**: Navigating from `/memory` to `/memory/browse?domain=...` (which runs a server `load` with DB queries) gives the user nothing until paint. No progress bar, no aria-live "loading". First-time users repeatedly click the nav link.
- **Expected**: Route-level progress indicator (top-of-page bar driven by `$app/stores`/`navigating`) or skeleton content that matches the real layout.
- **Fix**: Add a `<NavigationProgress>` component in `(app)/+layout.svelte` that watches `$app/navigating`. Shared across all surfaces.

### MAJOR: Filter forms post a full navigation with no pending state

- **File**: `apps/study/src/routes/(app)/memory/browse/+page.svelte:149-200`; `apps/study/src/routes/(app)/reps/browse/+page.svelte:141-191`; `apps/study/src/routes/(app)/knowledge/+page.svelte:79-120`
- **Problem**: Clicking "Apply" on any filter form submits a GET, but the button stays blue and untouched. No aria-busy, no disabled, no skeleton. On a slow DB query the user will click Apply again thinking it didn't fire.
- **Expected**: Disable "Apply" + show a spinner or text "Filtering..." while `$app/navigating` indicates pending.
- **Fix**: Bind `disabled` to `!!$navigating` on each filter-form submit button. Or combine with the nav progress fix above.

### MAJOR: Reps/new and memory/new have no success banner; they just redirect

- **File**: `apps/study/src/routes/(app)/reps/new/+page.server.ts` (redirects to `/reps/browse?created=<id>`); `apps/study/src/routes/(app)/memory/new/+page.server.ts:94-96` (redirects to `/memory/new?...&created=<id>` for "save and add another")
- **Problem**: The browse-page banner handles the positive path. But if the user hits "Save and add another" on memory/new, only a banner saying "Card saved. View it" (`memory/new/+page.svelte:81-85`) renders -- inconsistent with the Banner primitive elsewhere. Reps/new has no such banner at all; the redirect lands on `/reps/browse?created=<id>` which handles it, but going back to `/reps/new` gives no confirmation the scenario was saved.
- **Expected**: Consistent success confirmation using `Banner` primitive everywhere a form action succeeds.
- **Fix**: Unify flash messaging pattern; Banner primitive across all "something saved" banners.

### MAJOR: `knowledge/[slug]/learn` writes fail silently

- **File**: `apps/study/src/routes/(app)/knowledge/[slug]/learn/+page.svelte:54-77`
- **Problem**: `recordVisit` and `markGotIt` catch all errors and continue silently. Comment says "progress is a UX signal, not a decision-maker" but this means: (a) If the server is down for 5 minutes, the user's "completed" checkmarks render locally but are never persisted. On refresh they are gone. (b) If the server returns 403 (session expired), the user keeps studying but no progress saves. No warning.
- **Expected**: Silent-fail is acceptable for a single visit record, but cumulative failure (e.g. 3 consecutive POSTs failed) should surface a Banner: "Your progress isn't saving. Reload the page."
- **Fix**: Track consecutive POST failures; surface a Banner when it exceeds a threshold (e.g. 2 in a row).

### MAJOR: Login page -- no account recovery or sign-up path

- **File**: `apps/study/src/routes/login/+page.svelte`
- **Problem**: A user who forgot their password sees the error banner and has no next action. No "forgot password?" link, no "create account" link, no contact info. Dead end.
- **Expected**: At minimum a muted "No account? Contact the admin." link or similar. If password reset is out of scope right now, say so explicitly.
- **Fix**: Add below the submit button a small `Help <a href="mailto:...">contact</a>` link, or an explicit "Password reset is not yet implemented" message under the error Banner.

### MAJOR: Memory/review answer submit error reverts phase but loses the Save error context

- **File**: `apps/study/src/routes/(app)/memory/review/+page.svelte:335-340`
- **Problem**: On submit failure, `submitError` is set to "Could not save that review. Try again." and phase reverts to `answer`. The user must click the rating button again. But if they clicked "Again" and the server rejected, there is no indication WHICH rating is being retried; the tally shown at the top is stale (tally only updates on success, which is correct) but the UI doesn't highlight the previously-submitted rating.
- **Expected**: When retrying, pre-highlight the previously-attempted rating or auto-retry with exponential backoff once.
- **Fix**: Store the last-attempted rating; visually mark that button as "will retry" or add a KbdHint "Last tried: Again. Click to retry."

### MAJOR: Session summary page lists "Suggested next" actions but has no "study plan" snapshot

- **File**: `apps/study/src/routes/(app)/sessions/[id]/summary/+page.svelte`
- **Problem**: After a session, the summary shows stats but the "Suggested next" block only appears if `summary.suggestedNext.length > 0`. When it is empty, the only actions are "Back to dashboard" and "Another session" in the header. A user who didn't do well gets no guidance on what to actually do -- Review domain X? Create a scenario for the Hard-rated cards?
- **Expected**: Even in the no-suggestions case, a default "Review due cards" / "Add scenarios for weak domains" pair of actions.
- **Fix**: Server should always return at least 1 suggestion; if none apply, fallback to "Review all due now" + "Create a new card" as a minimum useful pair.

### MAJOR: Empty `/sim` scenario list is an undesigned dead end

- **File**: `apps/sim/src/routes/+page.svelte:23-40`
- **Problem**: `{#if scenarios.length === 0} <p class="empty">No scenarios available yet.</p>` — ends there. No "check back later", no link back to the study app, no explanation.
- **Expected**: Either suppress this state (the scenarios are shipped in-bundle, so the only way to hit this is a build bug) or make it a useful placeholder: "Sim scenarios will appear here. Return to study ->".
- **Fix**: Add a link to the study dashboard and a small "this is a prototype" banner referencing the existing `.disclaimer` footer content more prominently.

### MAJOR: Sim cockpit boot-error state has no navigation

- **File**: `apps/sim/src/routes/[scenarioId]/+page.svelte:202-221`
- **Problem**: `bootError` is set on worker init failure or 5s timeout. The message displays but there's no retry button surfaced in the file I read (I read the first 300 lines only; the retry function exists but needs to be exposed). If the worker fails, the user is stuck on a broken cockpit with no back link other than the header "Scenarios".
- **Expected**: Prominent retry button + clear back-link when boot fails; the page should collapse the cockpit UI.
- **Fix**: Verify `bootError` block renders a `<Button onclick={retryWorker}>Try again</Button>` and hides the broken instruments. If not, add it.

### MAJOR: Dashboard panels have inconsistent empty/error handling

- **File**: `apps/study/src/routes/(app)/dashboard/_panels/*.svelte`
- **Problem**: `CtaPanel` aggregates three panel errors into one string (line 55-63). Other panels (Weak areas, Map, Cert progress) each handle errors independently via `PanelShell`'s `error` prop. No unified pattern. If three of the nine panels error, the user sees three red boxes stacked with no way to retry.
- **Expected**: A single "One or more panels failed to load. [Retry]" summary at the top, and per-panel muted "unavailable" state.
- **Fix**: Add a dashboard-level aggregated error bar; per-panel errors collapse to muted placeholders.

### MINOR: Tags input accepts any string including duplicates and whitespace noise

- **File**: `apps/study/src/routes/(app)/memory/new/+page.svelte:162-172`
- **Problem**: The tags field trims commas but accepts "  ,, ,far-91 , far-91, FAR-91" and submits noisy results. No dedupe, no case normalization, no preview of how the server will store them.
- **Expected**: Show the parsed tags as chips below the input as the user types so they see what's actually being submitted.
- **Fix**: Live-parse the input and render chips; allow a click-to-remove on each.

### MINOR: Cancel button in `memory/new` uses a `<a class="btn">` while Save is a `<button>`

- **File**: `apps/study/src/routes/(app)/memory/new/+page.svelte:176`
- **Problem**: "Cancel" is an `<a>` pointing to `ROUTES.MEMORY`. If the user was 300 words into a card, they lose everything, no warning, no local draft. Same in reps/new.
- **Expected**: Cancel warns if the form has unsaved changes: `beforeunload` guard + a confirm dialog.
- **Fix**: Track `dirty` state; intercept Cancel click and use `ConfirmAction` when dirty.

### MINOR: Review page `phase === 'submitting'` shows only a tiny "Saving..." text

- **File**: `apps/study/src/routes/(app)/memory/review/+page.svelte:364-366`
- **Problem**: Saving state collapses the rating buttons to a single subdued paragraph. The user can't tell what they rated, can't cancel, can't see progress. If the submit takes more than ~300ms it looks like the UI froze.
- **Expected**: Keep the rating row visible with the selected button highlighted and disabled; show a small spinner in the selected button.
- **Fix**: Keep the rating buttons mounted; add a `disabled` + `aria-busy` state on the submitted one; spinner glyph.

### MINOR: Reps/new "Cancel" uses history.back() or falls back to `/reps`

- **File**: `apps/study/src/routes/(app)/reps/new/+page.svelte:317-331`
- **Problem**: Good intent, but: (a) if the user came from an external tab (email link), `window.history.length > 1` is `true` and `history.back()` takes them off the app entirely. (b) If they typed directly into the URL, fallback is `/reps`, which might not be where they expected. (c) Inconsistent with memory/new which always goes to `/memory`.
- **Expected**: Consistent cancel target per app. Either always go to the list page, or use `document.referrer` + same-origin check.
- **Fix**: Check same-origin on referrer before using `history.back()`; unify the pattern across new-creation pages.

### MINOR: Plan detail "Archived plans" list has no filter or pagination

- **File**: `apps/study/src/routes/(app)/plans/+page.svelte:101-115`
- **Problem**: Archived plans list is unbounded, no sort control, no way to permanently delete. A heavy user after 6 months of study will have 50+ archives stacked vertically.
- **Expected**: Limit to N, "Show all", sort by updatedAt desc; add delete affordance (with confirm).
- **Fix**: Server load already returns a bounded `archived` -- verify the bound. Add "Show all" toggle.

### MINOR: Plan skip-node reactivate shows raw node id

- **File**: `apps/study/src/routes/(app)/plans/[id]/+page.svelte:199-216`
- **Problem**: `<span class="pill-label">{id}</span>` renders the knowledge-node slug. The user sees `far-91-155-vfr-mins` instead of `VFR weather minimums`. Reactivating requires the user to know which slug maps to which topic.
- **Expected**: Load the node title and display it; fall back to the slug if the node was deleted.
- **Fix**: Server `load` enriches `skipNodes` with titles; template uses title.

### MINOR: Help page empty state references internal work-package names

- **File**: `apps/study/src/routes/(app)/help/+page.svelte:43-52`
- **Problem**: "Phase 2 of the help-library work package (wp-help-library-content) ships the seven first-pass pages." User-facing text should never reference internal work-package ids.
- **Expected**: Learner-facing message.
- **Fix**: Rewrite: "Help pages are coming soon. In the meantime, press `/` or `Cmd+K` to search the aviation reference library."

### MINOR: Glossary detail has no back button / prev-next nav

- **File**: `apps/study/src/routes/(app)/glossary/[id]/+page.svelte`
- **Problem**: Breadcrumb goes back to the list but loses search/filter state. No prev/next between terms. User reading through a set has to keep going back to the list.
- **Expected**: Back link preserves search query params; keyboard `j/k` or prev/next buttons.
- **Fix**: Return link includes the search context; optionally prev/next from server-provided adjacent ids.

### MINOR: Calibration CTA links always to STRENGTHEN mode regardless of whether user has a plan

- **File**: `apps/study/src/routes/(app)/calibration/+page.svelte:176, 282`
- **Problem**: Tapping "Start a Strengthen session" when `needsPlan` is true lands on `/session/start?sessionMode=strengthen` which then shows the preset gallery -- the `sessionMode` param gets dropped. Confusing.
- **Expected**: Either redirect through plan-creation with sessionMode carried forward, or disable the CTA with "Create a plan first" when no plan exists.
- **Fix**: Server load passes `hasPlan` to calibration; button href or disabled state branches on it.

### MINOR: `plans/new` submit button uses ellipsis U+2026 "…", not three dots

- **File**: `apps/study/src/routes/(app)/plans/new/+page.svelte:247`; `apps/study/src/routes/(app)/plans/[id]/+page.svelte:194`
- **Problem**: Inconsistent with the rest of the codebase which uses `'...'` (three ASCII dots) -- see `memory/review/+page.svelte:259`, `memory/new/+page.svelte:181`, `reps/new:333`.
- **Expected**: Single typographic standard. CLAUDE.md already prohibits em-dash; extend to ellipsis.
- **Fix**: Replace all `…` loading strings with `...` for consistency.

### MINOR: Session page "Skip hint" prose appears below the skip row only for the card flow

- **File**: `apps/study/src/routes/(app)/sessions/[id]/+page.svelte:304`
- **Problem**: `<p class="skip-hint">Topic + permanent skips can be reactivated from the plan detail page.</p>` is a one-liner that explains an unusual interaction model. It would be more useful alongside the "Skip permanently" button itself, not as a trailing footnote.
- **Expected**: Tooltip or aria-describedby on the "Skip permanently" ConfirmAction trigger.
- **Fix**: Add a title/tooltip to the ConfirmAction trigger; remove the trailing skip-hint.

### MINOR: Memory browse banner contains HTML entity `&ldquo;`/`&rdquo;` but others use straight quotes

- **File**: `apps/study/src/routes/(app)/memory/browse/+page.svelte:141`
- **Problem**: "View &ldquo;{createdCard.front}&rdquo;" inside code. Elsewhere (`reps/browse:134`) uses the same. Inconsistent with in-template strings that use straight ASCII quotes elsewhere.
- **Expected**: Consistent quoting.
- **Fix**: Use CSS `q` element or pick one convention.

### MINOR: `memory/[id]` edit mode toast auto-dismisses in 3s but Suspend/Reactivate silently reload

- **File**: `apps/study/src/routes/(app)/memory/[id]/+page.svelte:269-290`
- **Problem**: Suspend/Reactivate buttons fire form submit and the page re-renders. No toast. But edit mode does render a toast. Inconsistent feedback for state-changing actions.
- **Expected**: Consistent post-action feedback for all state mutations on the same page.
- **Fix**: Apply the same edit-success toast pattern to status changes: surface "Card suspended." / "Card reactivated." via the same mechanism.

### NIT: Dashboard stamp string is computed at mount and never refreshes

- **File**: `apps/study/src/routes/(app)/dashboard/+page.svelte:19-20`
- **Problem**: Comment says "read-only ornament; not a real-time clock" but if the user leaves the tab open for 2 hours, the stamp becomes misleading. Consider labeling as "loaded at" more prominently.
- **Expected**: Label clarifies it's the load time, not now.
- **Fix**: Prefix `{stamp}` with "loaded " or similar clarifier.

### NIT: Multiple pages compute `domainLabel(slug)` / `humanize(slug)` as local helpers

- **File**: ~15 files duplicate `function humanize(slug: string): string { return slug.split... }` and `function domainLabel(slug: string): string { return (DOMAIN_LABELS as ...)[slug] ?? humanize(slug); }`.
- **Problem**: Copy-paste. If the humanize rule ever needs tweaking, all 15 need updating. `@ab/utils` already exports `humanize`; it's used in some pages (`reps:4`, `knowledge:14`) but not others.
- **Expected**: Central `domainLabel` in `@ab/constants` or `@ab/utils` alongside `humanize`.
- **Fix**: Export `domainLabel(slug: Domain)` from `@ab/constants`; replace local copies.

### NIT: "New card" button on `/memory` top-right has no keyboard shortcut

- **File**: `apps/study/src/routes/(app)/memory/+page.svelte:40-42`
- **Problem**: High-frequency action, no shortcut. `memory/new/+page.svelte:60-65` supports Cmd+Enter-to-submit but there's no `n`-to-new from the memory index.
- **Expected**: Pressing `n` on `/memory` navigates to `/memory/new`. Same for `/reps` -> `/reps/new`.
- **Fix**: Add `onkeydown` window listener on list pages.

### NIT: `reps/+page.svelte` "Start session" button has a `title=` tooltip but also a `visually-hidden` duplicate

- **File**: `apps/study/src/routes/(app)/reps/+page.svelte:41-52`
- **Problem**: Both `title="Write a scenario first to enable sessions."` and `<span id="start-session-hint" class="visually-hidden">` describe the same thing. Redundant.
- **Expected**: Pick one (aria-describedby + visually-hidden span is the accessible path; title is mouse-only).
- **Fix**: Drop the `title` attribute.

### NIT: Dashboard footer uses `//` as a visual separator

- **File**: `apps/study/src/routes/(app)/dashboard/+page.svelte:58-62`
- **Problem**: TUI styling, but `//` in prose reads as a comment to engineers. The CLAUDE.md banned spaces around `/` in noun lists but it's fine as a separator here. Flagging as cosmetic; consider `-` or a middle-dot instead.
- **Expected**: N/A -- this is intentional TUI design.
- **Fix**: Keep. Noting for awareness only.
