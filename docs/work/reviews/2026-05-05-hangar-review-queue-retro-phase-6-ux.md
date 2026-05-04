---
title: 'Retro Phase 6 UX Review: Hangar Review Queue'
reviewer: ux
date: 2026-05-05
scope: phase 6 (TOC + knowledge node + ad-hoc tasks) -- merged in PR #611 squash 1310d0ec
---

# Retro Phase 6 UX Review: Hangar Review Queue

## Summary

- Files reviewed: 7
- Critical: 0
- Major: 4
- Minor: 8
- Nit: 5

Phase 6 lands three competent per-kind surfaces and a working CRUD flow. The keyboard model, optimistic updates, and a11y live-regions are carried over cleanly from the Phase 5 walker. The biggest gaps are in completion / hand-off feedback (TOC finish doesn't tell the reviewer the bucket side-effect; new task -> edit page lands silent; delete redirect drops its own toast) and in two design-spec drifts (the TOC right pane is static, the suggested-finish hint disappears the moment the user opens the finish panel). None of these block ship; all are reasonable retro fixes.

## Findings

### Critical

(none)

### Major

#### MAJOR: TOC right pane is static -- design called for "content loads on right"

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/_views/ReferenceTocView.svelte:494-503`
- **Problem**: Spec/design (`design.md:204`: "Click an entry, content loads on right") promises that selecting a TOC entry loads that entry's body in the right pane. The actual right pane is a single static `Card` with `reference.displayName` + `reference.paraphrase`; clicking entries only updates `activeEntryRef` for visual focus + the keyboard cursor. The reviewer therefore can't actually verify the entry against the source body inside this surface -- they have to bounce out to `/flightbag` or the original PDF.
- **Why it matters**: This is the killer thing the TOC review is supposed to make fast (the IDEAS.md line that motivated the kind). Without per-entry content, this is a bookkeeping list, not a review surface; reviewers will mark `pass` from memory or skip the kind entirely.
- **Fix**: Either (a) implement: derive a per-entry content slot from the reference's verbatim/extracted body keyed by `entryRef`, render it via `RenderedSection` in the right pane on `activeEntryRef` change, or (b) demote the design line to "out of scope for v1" in `design.md` + spec and ship a "Open in flightbag" deep link in the right pane so the reviewer at least has a one-click path to the source. Pick one and resolve in the same turn (project rule: no undecided "considerations for future work").

#### MAJOR: TOC bucket side-effect on finish is invisible

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/_views/ReferenceTocView.svelte:265-268` + `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/+page.server.ts:499-530`
- **Problem**: When the reviewer finishes a TOC session as `pass`, the bucket filter `noPassingSession: true` removes the item from the `References -- missing TOC review` bucket on the next loader pass. The user sees only `TOC review finished as pass.` -- nothing tells them "this item just left the TOC bucket" or "X items remain in the bucket." On `fail` / `abandoned` the item stays in the bucket, but again with no indication.
- **Why it matters**: The whole point of the TOC bucket is to drive a count to zero. Reviewers need closing feedback that confirms the bucket made progress, otherwise they have to navigate back to `/review` and recount the bucket each pass. This is the equivalent of a queue worker that gives no acknowledgement when an item is acked.
- **Fix**: Append the bucket status to the success toast: `TOC review finished as pass. Item removed from "References -- missing TOC review" bucket.` (or "kept in bucket -- mark pass to remove" on non-pass). Either pre-compute the bucket-membership delta server-side and return it in the action result, or include the bucket name + outcome rule as static copy.

#### MAJOR: Create-task redirect lands silent on edit page

- **File**: `apps/hangar/src/routes/(app)/review/tasks/new/+page.server.ts:115` redirects to `ROUTES.HANGAR_REVIEW_TASK_EDIT(task.id)`
- **Problem**: After a successful create, the user lands on `/review/tasks/[taskId]/edit` with no toast, no banner, no "Task created" confirmation. The page just looks like an edit form; it's identical to opening an existing task. The user has to look at the breadcrumb/title to realise the task got created.
- **Why it matters**: This is the standard create-then-edit pattern, but without a one-time success cue the user has no closing handshake. They may re-submit, they may navigate back to the board to "verify," or they may just feel uncertain. The board-side feedback (the new card appearing) only happens after a separate trip back to `/review`.
- **Fix**: Either (a) redirect to `/review` with a one-shot URL param (`?created=<taskId>`) the board reads to fire `Task "<title>" created.` toast (pattern is already in the wp_spec page for walker finish: `REVIEW_WP_SPEC_FINISH_PARAMS`), or (b) keep the redirect to edit but pass `?created=1` and have the edit page show a single-fire success toast on mount, then strip the param via `goto(... replaceState)` like the wp_spec page does.

#### MAJOR: Delete success has no surface confirmation

- **File**: `apps/hangar/src/routes/(app)/review/tasks/[taskId]/edit/+page.server.ts:140` (`throw redirect(303, ROUTES.HANGAR_REVIEW)`)
- **Problem**: A successful delete redirects straight to `/review`. The board has no awareness that a delete just happened, so the user gets zero confirmation -- the card they were just looking at simply isn't there any more, and they have to remember they hit "Confirm delete" in order to interpret that. Failure paths get a sticky red toast (line 73-76 of the edit page) but success is silent.
- **Why it matters**: Destructive action without acknowledgement is the worst UX shape. Even though the confirm panel reads "There is no undo," the missing closing handshake reads as "did it actually delete? did the form just clear?" The old `confirmDelete` flag in client state, the breadcrumb gone, the entire page swap -- all of it adds up to "I think it worked" rather than "yes, deleted."
- **Fix**: Mirror the create flow: redirect to `/review?deleted=<title>` (or `?deletedTask=1`) and have the board show `Task "<title>" deleted.` once on mount, then strip the param. `REVIEW_WP_SPEC_FINISH_PARAMS` is the canonical precedent.

### Minor

#### MINOR: TOC keyboard cheat sheet is hidden when finish panel is open

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/_views/ReferenceTocView.svelte:368-375` (`.shortcuts` lives inside `.summary`)
- **Problem**: The keyboard cheat sheet (`j/k navigate -- p/f/b outcome`) is only shown when the summary card renders. The summary card always renders once entries exist, so this is fine in steady state, but the `.shortcuts` block uses `flex: 1 0 100%` to wrap below the summary -- on narrow viewports it's the very last thing in the summary, easy to miss. Phase 5 walker prints its cheat sheet right next to the action header (walker `+page.svelte:495-499`). Inconsistent placement between the two surfaces.
- **Why it matters**: The whole point of having a cheat sheet is that the user finds it without hunting. Two surfaces with different placements means muscle memory doesn't transfer.
- **Fix**: Pull the cheat sheet into a small dedicated `<aside>` row directly under the page header (or beside the "Finish TOC review" button), matching the walker's placement.

#### MINOR: Suggested-finish outcome is computed but the rationale is hidden behind a click

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/_views/ReferenceTocView.svelte:110-114` + `377-386`
- **Problem**: `suggestedFinish()` picks `pass` / `fail` / `abandoned` based on totals, and seeds the radio in the finish panel. But the suggestion only appears after the user clicks `Finish TOC review`; before that, the button just says "Finish TOC review" with no hint that hitting it will pre-select e.g. `pass`. Reviewers who aren't sure they recorded enough rows can't tell at a glance what outcome the system thinks fits.
- **Why it matters**: The state on the summary card already says e.g. `Pass 12 / Fail 0 / Blocked 0 / Recorded 12`, but it doesn't telegraph the next step ("Finishing now will close as PASS"). Adding the projected outcome label saves a click of curiosity and reduces "did I actually pass everything?" hesitation.
- **Fix**: Render the projected finish outcome inline above (or on) the button, e.g. `Finish TOC review (suggests: Pass)`. Or render a small inline summary: `12 of 12 entries pass -- this will close as PASS`.

#### MINOR: Auto-finish on last-pass is not offered

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/_views/ReferenceTocView.svelte:106-108` (`everyEntryPassed` is computed but never used as a trigger)
- **Problem**: Once the reviewer marks `pass` on the final entry, `everyEntryPassed` flips true. Nothing happens. The user must scroll up to the summary card and press `Finish TOC review` -> pick outcome -> `Confirm finish`. Three actions for the most common path.
- **Why it matters**: For the killer case (TOC clean, walk through, every entry passes), the reviewer's reward is more clicking. The walker has the same shape, but TOC is the keyboard-driven kind where the cost of a mouse trip is highest.
- **Fix**: When `everyEntryPassed` becomes true via a `recordEntry` call, auto-open the finish panel pre-seeded with `pass` and shift focus to the `Confirm finish` button. Add a small "Auto-opened because every entry passed" caption so the user knows why focus moved.

#### MINOR: Resume-on-revisit has no explicit banner

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/_views/ReferenceTocView.svelte:500-503`
- **Problem**: When the reviewer comes back tomorrow to a half-walked TOC, the only "you have an open session" hint is a small caption on the right pane: `Open session started Apr 30, 4:12 PM.` The cursor isn't positioned at the next un-recorded entry; nothing announces "resuming previous session." Compared to the wp_spec walker which shows a clear `Resume walker` button + `Open session started <ts>` line in the sidebar (`+page.svelte:257-264`), the TOC view bury this state.
- **Why it matters**: Sessions are explicitly a "resumable" feature in the spec (`spec.md:122-123`). The TOC view currently renders identically whether you're starting fresh or resuming, which trips reviewers who expected a cue.
- **Fix**: Show a one-line banner above the entry list when there are recorded entries on session open: `Resuming session started <ts> -- <N> entries already recorded.` Set `activeEntryRef` to the first un-recorded entry (instead of `null`) on mount when resuming.

#### MINOR: TOC "no entries" empty state suggests a fix the reviewer can't perform

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/_views/ReferenceTocView.svelte:343-358`
- **Problem**: When the parser returns zero entries, the UI says: "Re-extract the TOC into the reference's `verbatim` jsonb (expects `toc[]`...)." This is developer language about a DB column shape, not a reviewer action. The reviewer can't fix this; they need to either (a) hand it to an agent or (b) flag it as blocked.
- **Why it matters**: An empty state should give the user their next action. Right now the user is told a thing they can't do.
- **Fix**: Reword: `This reference doesn't have a TOC extraction yet. Mark this item blocked, or open a hangar task to re-extract the TOC.` Add a single-click "Open ad-hoc task to re-extract" button that pre-fills `/review/tasks/new` with title + product area.

#### MINOR: TOC parser errors surface as raw paths

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/_views/ReferenceTocView.svelte:351-357`
- **Problem**: Parser errors render as `<li>{err.message} <code>({err.path})</code></li>`. The path is JSON-pointer-ish (`$.toc[3].label`) which is fine for a dev but not for a reviewer scanning what's wrong. The list also has no heading saying these are *parse* errors.
- **Why it matters**: Polish issue but raises the cognitive cost of the empty state.
- **Fix**: Add a header `<h3>Parser warnings</h3>` over the list and prefix each row with the pointer in muted text rather than parenthesised after the message.

#### MINOR: New-task "Assignee user id" field is a raw text input

- **File**: `apps/hangar/src/routes/(app)/review/tasks/new/+page.svelte:134-138` and `[taskId]/edit/+page.svelte:171-174`
- **Problem**: Both forms ask for an opaque `auth_xxxx` id in a free text field. There's a `(optional)` hint, but no autocomplete, no list of existing users, no validation. Reviewer has to copy-paste from somewhere; the form doesn't tell them where.
- **Why it matters**: Single-user app today (per `spec.md` "Out of scope"), so most of the time the field is left blank, which is fine -- but exposing it as a raw text input invites typos that fail silently (the FK either accepts it or the row hits a constraint error). Better to hide it for v1, or surface it as a real picker.
- **Fix**: Either hide the assignee field behind a "Show advanced fields" disclosure (matches "out of scope -- multi-user assignment" from the spec), or replace with a `<select>` of users you already have a query for.

#### MINOR: Edit page "Back to board" mid-form is the only escape

- **File**: `apps/hangar/src/routes/(app)/review/tasks/[taskId]/edit/+page.svelte:178`
- **Problem**: The `Back to board` link sits directly next to `Save`. If the user has typed unsaved changes and clicks `Back to board`, the form values are lost silently -- no "discard changes?" prompt. The new-task form uses `Cancel` (line 142 of `tasks/new/+page.svelte`) which has the same issue.
- **Why it matters**: Standard editor escape pattern, low-stakes for a small form like this, but inconsistent with the destructive-action confirmation pattern the same codebase uses elsewhere (delete confirms, flip-status confirms).
- **Fix**: Track a `dirty` flag (`onchange` on the form -> set `dirty = true`). Intercept the Back/Cancel link click while `dirty` and confirm via inline banner + Discard/Stay buttons. Or accept the loss and rename the link to `Discard and return` so the user knows.

### Nit

#### NIT: AdHocView's leading paragraph mixes escaped-vs-rendered backticks

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/_views/AdHocView.svelte:19-22`
- **Problem**: The hint reads ``Ad-hoc tasks live on the board as a `board_task` row. The dispatcher route lands you here so deep-links from elsewhere don't 404, but the canonical detail surface is the edit form.`` -- it leaks an internal table name to the user and explains the dispatcher's reason for existing. That's developer-internal; reviewers don't care that there's a dispatcher.
- **Why it matters**: User-facing copy reads developer-y. Cluttery.
- **Fix**: Replace with `This is an ad-hoc task on the review board. Edit it below.` and keep the `Open task editor` link as the primary action.

#### NIT: Ad-hoc kind label "Ad-hoc task" varies between view + breadcrumb

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/_views/AdHocView.svelte:18` says "Ad-hoc task"; the breadcrumb on `/review/[kind]/[itemId]` shows `data.kindLabel` which for `ad_hoc` is also "Ad-hoc task" (per `REVIEW_KIND_LABELS`)
- **Problem**: Both come out as "Ad-hoc task" -- redundant. The page heading + the kind row + the breadcrumb all say the same thing.
- **Why it matters**: Visual noise.
- **Fix**: Rename the AdHocView card heading to `Task details` (the page already establishes "ad-hoc" via breadcrumb + kind chip).

#### NIT: New-task and edit forms don't auto-focus the title field

- **File**: `apps/hangar/src/routes/(app)/review/tasks/new/+page.svelte:67-78`, `[taskId]/edit/+page.svelte:122-131`
- **Problem**: Reviewer lands on the form with no field focused. Standard pattern is to autofocus the first input on a create form.
- **Why it matters**: Saves a click on the most common entry point.
- **Fix**: Add `autofocus` (svelte 5: `<input autofocus>` is fine) on the title input of the new-task form.

#### NIT: TOC "Reference not found" message references the loader

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/_views/ReferenceTocView.svelte:340-342`
- **Problem**: Copy reads "The underlying `hangar.reference` row may have been deleted. Re-run the loader to refresh the board." -- developer-y, mentions a schema namespace.
- **Why it matters**: User-facing copy.
- **Fix**: `This reference no longer exists. <a href={ROUTES.HANGAR_REVIEW}>Return to the board</a> -- the next refresh will clear this item.`

#### NIT: `confirmFinish` button group reads as three separate options without primary cue

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/_views/ReferenceTocView.svelte:393-424`
- **Problem**: The three outcome buttons (`Pass` / `Fail` / `Abandoned`) all have equal weight visually until clicked. The pre-seeded suggestion (`suggestedFinish()`) sets the active state correctly, but new reviewers may not realise they can click the bigger `Confirm finish` directly without re-affirming the radio.
- **Why it matters**: Already kind of tucked away (low severity); but the `role="radiogroup"` + `aria-pressed` shape means a screenreader user can't easily tell which is "default."
- **Fix**: Render the suggested option with a `(suggested)` caption below the button label, or set `aria-describedby` on the suggested option to a sentence saying so.

## Areas verified clean

- **Per-kind dispatcher** (`apps/hangar/src/routes/(app)/review/[kind]/[itemId]/+page.svelte`) -- view discrimination by `data.view` is exhaustive (covers `wp_spec` / `reference_toc` / `knowledge_node` / `ad_hoc` / `placeholder`); breadcrumb + kind chip + ref code present on every kind.
- **Loading states** -- every form action uses `Button loading={...} loadingLabel="Saving..."`; the optimistic outcome buttons disable while in-flight (`savingByRef`).
- **Error states on per-row TOC outcome saves** -- per-row error message under the entry, sticky toast on top, correct optimistic revert. Walker pattern carried over cleanly.
- **Confirm-gate on destructive actions** -- delete task: confirm banner + button; flip review_status / mark knowledge node reviewed: confirm panel + writes only on confirm. Pattern is consistent across the three flips.
- **Frontmatter sidebar in KnowledgeNodeView** -- only renders if `frontmatter.length > 0`, surfaces the `discovery_review` value with a `Reviewed` badge once flipped. Discovery-pedagogy hint reads correctly per ADR 011.
- **Live regions** -- both `liveAnnounce` (action result) and the per-page debounced filter-count announcer (board-only) are present and correct on the new views.
- **URL persistence** -- per-kind page restores tab state via `REVIEW_WP_SPEC_TAB_PARAM`; finish-toast params are correctly stripped on mount via `goto(... replaceState: true)`.
- **Mobile layout** -- both views collapse to single column at 900px (`@media (max-width: 900px)`); new-task form row collapses at 600px. Breakpoints are sensible.
- **Keyboard model consistency** -- TOC view + walker share the same `WALKER_KEYBOARD_SHORTCUTS` constants (the retro brief's claim of `s/n` vs `b` divergence is incorrect; both surfaces use `j/k/p/f/b` and the walker adds `n`. No drift; cheat sheets agree.).
- **A11y on outcome buttons** -- `aria-pressed`, `role="group"` on the per-entry outcome row, focusable entries via tab, focus-visible outlines on every interactive element.
- **Visual consistency with Phase 5** -- right-rail card pattern, footer-action confirm panels, summary-card on top all match the wp_spec view's shape.
