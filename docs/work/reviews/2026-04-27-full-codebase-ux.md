---
feature: full-codebase
category: ux
date: 2026-04-27
branch: main
issues_found: 24
critical: 0
major: 6
minor: 13
nit: 5
---

## Summary

Overall UX quality across the study app is solid: confirmation patterns, undo windows, banner/toast pairings, optimistic updates with rollback, and InfoTip-driven explanations are consistently applied per DESIGN_PRINCIPLES.md #6. The main weaknesses cluster in `apps/hangar/`, where a row of bare `Rescan / Revalidate / Build / Size report` buttons fires server work with zero confirmation, no in-button progress, and no toast/banner on success; that pattern repeats on the source detail page. Several customer-facing surfaces leak developer/admin language (handbook ingest commands, "Phase 2 of wp-help-library-content", "Editing coming in a follow-up"), and a handful of pages use em-dash separators or carry interpunct/em-dash glyphs that violate the project text style. No critical (data-loss / blocked-task) issues were found.

## Issues

### MAJOR: Hangar source operations have no confirmation, no progress, no success feedback

- **File**: apps/hangar/src/routes/(app)/sources/+page.svelte:62-74
- **Problem**: Four bare `Rescan / Revalidate / Build / Size report` buttons each submit a POST form. The user gets no second-confirm, no in-button "Working..." state, no toast on completion. After clicking, the only signal is that the page silently reloads and (sometimes) a row gains an "active job" link. For a hangar-admin who triggered the wrong action against the registry, there is no recoverable signal between click and completion.
- **Expected**: Either (a) wrap each form in `ConfirmAction` (the project's two-step destructive pattern) for non-idempotent operations, or (b) keep the single click but add `aria-busy` + a "Working..." label during submission and a `role="status"` toast confirming the operation kicked off ("Rescan started", linked to the resulting job row).
- **Fix**: Add `use:enhance` with a per-button `submitting` boolean; render `loading={submitting}` on `Button` and a `role="status"` banner ("Job queued" + link to `HANGAR_JOB_DETAIL`) on success. Treat Build / Revalidate as elevated and gate behind `ConfirmAction` (Rescan and Size report are read-only and can stay single-click).

### MAJOR: Source detail action row repeats the same no-feedback pattern

- **File**: apps/hangar/src/routes/(app)/sources/[id]/+page.svelte:60-78
- **Problem**: Fetch / Upload / Extract / Diff / Validate share the same bare-form pattern. There is no inline busy state when a click is in flight; the only pending signal is the page-level Banner ("This source has a running operation") that appears *after* the page reload completes. For Extract on a large source, the user can double-click before the new job is registered.
- **Expected**: Per-button `aria-busy` + disabled state during submission; rely on `enhance` to flip a local boolean, not on the server round-trip.
- **Fix**: Use the same `submittingAction` pattern from `session/start/+page.svelte` (where one preset's submission disables the others). Disable peer buttons while one is in flight.

### MAJOR: Handbook empty state ships shell commands to end users

- **File**: apps/study/src/routes/(app)/handbooks/+page.svelte:18-21
- **Problem**: When no handbooks are seeded, the empty state reads literally: "Run `bun run sources extract handbooks phak` followed by `bun run db seed handbooks`." That is operator/admin guidance, not learner UX. A cold-start user (Joshua-zero or any future learner) sees a CLI dump.
- **Expected**: Empty state should describe the intended outcome and route the user toward content authored elsewhere ("No handbooks yet. Handbooks are added by your administrator -- check back, or browse the knowledge graph in the meantime.").
- **Fix**: Replace the `<code>` block with a learner-grade copy and a CTA link to `ROUTES.KNOWLEDGE`. Move the ingest hint into a dev-only block (`{#if dev}` from `$app/environment`) or strip it entirely (it duplicates info already in `docs/work/`).

### MAJOR: Help index empty state references internal work-package by name

- **File**: apps/study/src/routes/(app)/help/+page.svelte:46-51
- **Problem**: "Phase 2 of the help-library work package (wp-help-library-content) ships the seven first-pass pages." Internal project tracking leaked into a user-facing empty state.
- **Expected**: Plain-English description that doesn't expose internal phase / work-package identifiers.
- **Fix**: "Help pages are still being authored. The aviation glossary search above works today." Drop the wp identifier entirely.

### MAJOR: Hangar user detail page advertises a missing feature

- **File**: apps/hangar/src/routes/(app)/users/[id]/+page.svelte:54
- **Problem**: A persistent `Banner tone="info"` reads "Editing coming in a follow-up." This is a stub-shaped UX -- per CLAUDE.md PRIME DIRECTIVE, "as a stub" / "for now" is a known issue. The banner promises a feature that doesn't exist with no timeline or workaround.
- **Expected**: Either ship the editing surface or remove the promissory banner. If editing genuinely belongs in another doc/route, link it; if it's not on the active roadmap, drop the banner.
- **Fix**: Remove the banner or replace with a concrete pointer ("Update users via `bun run db seed`" if that's the actual path today, behind a dev-only guard). Better: gate this entire page behind a "users are read-only in hangar today" decision and update CLAUDE.md / TASKS.md.

### MAJOR: Knowledge node "Got it" success is invisible to AT users in some browsers

- **File**: apps/study/src/routes/(app)/knowledge/[slug]/learn/+page.svelte:205-211
- **Problem**: After clicking Got it, the button is replaced by a `<span class="got-it-done" aria-live="polite">` but the `aria-live` is on the just-mounted node, not on a stable region; many screen readers won't announce a region whose first contents are themselves the announcement. The button is gone, so a user who didn't already focus the surrounding area gets no feedback.
- **Expected**: Use a stable `role="status"` region that exists empty before the click and gets populated on success, OR keep the button visible in a "Marked" state and rely on the existing button-state semantics.
- **Fix**: Render an empty `<div role="status" aria-live="polite">` outside the conditional, then write the text into it on success. Or simpler: always render the button; flip its label to "Marked as understood" + disable. Avoids the live-region ambiguity entirely.

### MINOR: Em-dash separator in `<title>` and inline reason detail

- **File**: apps/study/src/routes/(app)/sessions/[id]/+page.svelte:87, 137
- **File**: apps/study/src/routes/(app)/session/start/+page.svelte:400
- **Problem**: `<title>Session — airboss</title>` and `— {item.reasonDetail}` use em-dash, which CLAUDE.md / global rules prohibit. Every other page in the app uses ` -- ` (double hyphen). This is the only file that drifted.
- **Expected**: Match the surrounding pattern: `<title>Session -- airboss</title>` and ` -- {item.reasonDetail}`.
- **Fix**: Replace U+2014 with `--` in those three lines (sessions/[id] line 87 and 137; session/start line 400).

### MINOR: Interpunct in subhead violates project glyph policy

- **File**: apps/study/src/routes/(app)/sessions/[id]/+page.svelte:94
- **Problem**: `Item {currentNum} of {total} · {completedCount} done` uses U+00B7 (middle dot). The project consistently uses ` -- ` or commas as separators in similar subheads (e.g. memory/[id], plans, calibration).
- **Expected**: Same separator style as peers, e.g. `Item {currentNum} of {total} -- {completedCount} done`.
- **Fix**: Replace `·` with `--` (or a comma).

### MINOR: Sources list `Rescan/Revalidate/Build/Size report` are unlabeled in role/intent

- **File**: apps/hangar/src/routes/(app)/sources/+page.svelte:62-74
- **Problem**: Beyond the major (no feedback), the buttons sit in a row with no aria-label distinguishing one-click read-only ops (Rescan, Size report) from cluster-mutating ops (Revalidate, Build). On hover / focus, screen-reader users hear four button labels with no hint at consequence.
- **Expected**: Group destructive vs read-only into separate `<div role="group" aria-label>` clusters, OR add `title` / aria-describedby explaining what each does and whether it writes.
- **Fix**: Wrap actions in two button groups ("Read-only checks" / "Rebuild operations") with role/labels, or add explicit `title="Rescan source registry; read-only"` attributes.

### MINOR: Calibration empty state buries the path that produces data

- **File**: apps/study/src/routes/(app)/calibration/+page.svelte:233-244
- **Problem**: The empty state explains that calibration needs ~25 confidence ratings, then offers `Start a review` and `Start a rep session`. But confidence ratings only happen on cards where `promptConfidence` is true. A user who clicks Start a review and gets a deck of cards that don't prompt for confidence will still see the empty state next time and feel stuck.
- **Expected**: Reference the visible knob: confidence prompts come from card `promptConfidence` -- explain or link to "How to enable confidence prompts" so the empty state actually unblocks.
- **Fix**: Add one sentence: "Confidence prompts appear on cards marked Prompt confidence. Edit a card to enable, or use the default Strengthen session which prompts every card."

### MINOR: Calibration "Strengthen at this level" CTA is misleading per the comment

- **File**: apps/study/src/routes/(app)/calibration/+page.svelte:170-172, 322-325
- **Problem**: The comment says: "Strengthen session hits relearning + rated-Again + overdue cards, which is what 'recalibrate at this confidence level' actually needs." But the rendered CTA says "Strengthen at this level" -- there is no level filtering on the destination URL; every bucket's CTA goes to the same Strengthen URL. The user expects a level-scoped session and gets the global Strengthen mode.
- **Expected**: Either pass the bucket's confidence level as a query param the session-engine respects, OR rename the CTA to "Start Strengthen session" so the copy matches the behavior.
- **Fix**: Drop the per-level wording on the bucket CTA. All four buckets get the same label ("Start Strengthen") since they route to the same place. A future enhancement can add `?confidenceLevel=` to the route.

### MINOR: Memory dashboard "saved decks" rename hint phrasing is awkward

- **File**: apps/study/src/routes/(app)/memory/+page.svelte:217
- **Problem**: `<p class="rename-hint">{SAVED_DECK_COPY.RENAME_CLEAR}: leave blank and Save.</p>` reads as "Clear label: leave blank and Save." That's two imperatives jammed together.
- **Expected**: "To clear the label, leave the field blank and Save."
- **Fix**: Update the constant copy in `SAVED_DECK_COPY.RENAME_CLEAR` to a full sentence and drop the inline ": leave blank and Save."

### MINOR: Resume tile uses ASCII arrow that doesn't match surrounding type

- **File**: apps/study/src/routes/(app)/memory/+page.svelte:170
- **Problem**: `Continue -&gt;` renders as `Continue ->` in literal ASCII, but every other CTA in the app uses arrow-less language ("Open", "Start review", "View it"). One-off styling.
- **Expected**: Either drop the arrow ("Continue") or use a consistent affordance from the design system (the arrows in `back: a { content: '&larr;'... }` pattern).
- **Fix**: Drop the `-&gt;` glyph or wrap it in a span with `aria-hidden`.

### MINOR: Plans archived view confuses two empty states

- **File**: apps/study/src/routes/(app)/plans/+page.svelte:179-184
- **Problem**: The "No archived plans" article reads "Plans you archive will appear here. Archiving keeps a plan's history without deleting it." Useful, but it appears whenever the user clicks the Archived tab on a brand-new account, which is also the moment they have no idea why a plan would ever be archived. This is a "feature explainer in an empty-state slot" issue.
- **Expected**: Empty state should give the user the next action (maybe "Active plans get archived when you create a new one"), not a passive description.
- **Fix**: "Archived plans appear here when you replace your active plan. You haven't archived any plans yet." -- or a link back to the Active tab CTA.

### MINOR: Memory new "Save and add another" button has no visible cue post-save

- **File**: apps/study/src/routes/(app)/memory/new/+page.svelte:88-92, 207-210
- **Problem**: After "Save and add another" the route redirects back with `?created=<id>`, which renders a banner. But the banner sits above the form and the focus jumps to Front (which is right). The banner says "Card saved. View it or add another below." -- but the user just clicked "Save and add another," so "add another below" is redundant and the "View it" link is the only fresh affordance. The user may scroll or tab past it.
- **Expected**: Differentiate the banner copy by intent: if the user clicked "Save and add another", show a slim status toast ("Card saved") instead of the persistent banner. Reserve the banner for the plain "Save" path where the user expects to navigate away.
- **Fix**: Pass the intent through the redirect (`?created=<id>&intent=continue`), branch the banner to a smaller toast for the continue path.

### MINOR: Session start preset detail "Activating archives any active plan" warning is in the body, not the confirm button

- **File**: apps/study/src/routes/(app)/session/start/+page.svelte:289, 311
- **Problem**: The preset Drawer body shows "Activating this preset archives any currently active plan" as small `signal-warning`-colored text near the bottom, but the Start button doesn't reflect the destructive aspect. A user clicking Start does so without re-reading the warning. Per DESIGN_PRINCIPLES.md, "destructive actions are confirmed before execution" -- archiving an existing active plan is borderline destructive.
- **Expected**: Either (a) gate the Start button behind a `ConfirmAction` when the user has an active plan, or (b) make the Start button label conditional: "Replace active plan and start" if there's a plan to archive.
- **Fix**: Pass `hasActivePlan` from the loader; render a different button label and add an inline confirm step for that case.

### MINOR: Sessions page progressbar lacks numeric percentage announcement

- **File**: apps/study/src/routes/(app)/sessions/[id]/+page.svelte:108-110
- **Problem**: The progress bar has `role="progressbar" aria-valuemin="0" aria-valuemax={total} aria-valuenow={completedCount}` -- which reads to AT as "completed of total" but the visual bar shows percentage. There's no `aria-valuetext` to humanize ("3 of 12, 25% done").
- **Expected**: Add `aria-valuetext` so screen-reader output matches the visual semantics.
- **Fix**: `aria-valuetext={`${completedCount} of ${total} done`}`.

### MINOR: Memory review "Caught up" empty state has no path back to writing cards by domain

- **File**: apps/study/src/routes/(app)/memory/review/[sessionId]/+page.svelte:455-463
- **Problem**: When the user finishes a session with `totalCards === 0`, the buttons are Back to dashboard / New card / Start a fresh run. Start a fresh run will likely loop back to "caught up" again if no cards are due. The user's actual next action when caught up at zero is "wait" or "write more cards", but the third button is misleading.
- **Expected**: Conditionally swap the third button to "Browse cards" or similar when totalCards === 0.
- **Fix**: `{#if totalCards > 0}<a ...>Start a fresh run</a>{:else}<a href={ROUTES.MEMORY_BROWSE}>Browse cards</a>{/if}`.

### MINOR: Knowledge node detail "Start learning this node" precedes the discovery-first content

- **File**: apps/study/src/routes/(app)/knowledge/[slug]/+page.svelte:246-249
- **Problem**: ADR 011 / DESIGN_PRINCIPLES discovery-first: "Lead with WHY. Let the learner derive the answer." The node page jumps straight from the metadata header / Mastery panel to a prominent "Start learning this node" CTA -- before any prose, before the WHY. Compare with the learn route which does carry phase content. The detail page short-circuits the learner into action without showing context, which inverts the intended pedagogical priority.
- **Expected**: Open the page with the node's WHY (a phase-1 / motivation snippet) above the CTAs, OR move the Start learning CTA below the prerequisites section so the page reads "what / why / when, then go learn".
- **Fix**: Render a brief motivation block (could be the first phase body if it exists) above the `.ctas` div, or move `.ctas` below the prerequisites.

### MINOR: Hangar jobs page polls every 1 second with no indication

- **File**: apps/hangar/src/routes/(app)/jobs/+page.svelte:30-42
- **Problem**: `setInterval(invalidateAll, 1000)` while live jobs run -- users don't know the page is auto-refreshing, and they may wonder why filter selection feels reactive. No spinner, no "live" indicator.
- **Expected**: Show a small "Live" pill or "Auto-refreshing" annotation when polling is active so the user knows the table updates on its own.
- **Fix**: Render a `Badge` near the heading: `{#if hasLiveJobs}<Badge tone="info">Live</Badge>{/if}`.

### NIT: Login dev panel exposes plaintext password

- **File**: apps/study/src/routes/login/+page.svelte:99-101
- **Problem**: Dev-mode shows `password: <code>{DEV_PASSWORD}</code>`. Reasonable for local dev, but the dev-account buttons already pre-fill the field on click; printing the password adds nothing and trains the user that passwords belong on screen. Cosmetic.
- **Expected**: Either drop the line (the prefill suffices) or hide it behind a "Show" disclosure.
- **Fix**: Remove `.dev-hint` paragraph; the buttons already do the work.

### NIT: Sim cockpit retry button has no busy state

- **File**: apps/sim/src/routes/[scenarioId]/+page.svelte:507-513
- **Problem**: When `bootError` shows, clicking Retry calls `retryWorker` but the button doesn't disable or show "Retrying..." -- a stuck worker can be hammered.
- **Expected**: Disable + label-flip while retry is in flight.
- **Fix**: Track a `retrying` state, set on click, clear on next ready/error.

### NIT: References viewer breadcrumb on knowledge learn uses raw "/" separator with `aria-hidden`

- **File**: apps/study/src/routes/(app)/knowledge/[slug]/learn/+page.svelte:125-131
- **Problem**: Three breadcrumb separators are `<span aria-hidden="true">/</span>`. The slash works visually but for AT users the trail flattens to "Knowledge {Title} Learn" with no separators. Tiny but present.
- **Expected**: Use a single trailing `/` per item via CSS or wrap into a real `<nav>` `<ol>` so the list semantics carry the structure. (The wrapper already has `aria-label="Breadcrumb"`, but the children are flat spans/anchors.)
- **Fix**: Convert to an `<ol>` of `<li>` items with CSS `::after` slashes; let the list semantics do the structural work.

### NIT: Sim debrief stale-tape banner uses two paragraphs of explanation

- **File**: apps/sim/src/routes/[scenarioId]/debrief/+page.svelte:175-184
- **Problem**: When the scenario hash mismatches, the user sees two `<code>` hashes and a paragraph that mostly serves the developer. The actionable output ("Re-fly the scenario") is at the end.
- **Expected**: Lead with the action: "Re-fly to refresh this debrief." then offer the hash detail behind a `<details>` for the curious / the dev.
- **Fix**: Reorder; collapse hash detail into a `<details>`.

### NIT: Plans index "active plan" badge text repeats the obvious

- **File**: apps/study/src/routes/(app)/plans/+page.svelte:115
- **Problem**: The active plan card has a colored background, an `Edit plan` link, and a header marked Active. The pill `{PLAN_STATUS_LABELS[active.status]}` (which renders "Active") on top of all that is redundant.
- **Expected**: Drop the badge on the active card; reserve it for the archived list where state actually disambiguates.
- **Fix**: Remove the badge inside `.plan-card.active`, keep it in the archived `<li>`.
