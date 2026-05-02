---
feature: study-app-surfaces
category: ux
date: 2026-05-01
branch: main
issues_found: 18
critical: 0
major: 7
minor: 8
nit: 3
---

## Summary

UX review of the study app's route tree (apps/study/src/routes) with the library-completeness spec as the active context. The flows are mature: spec-driven library page with topic/cert/regs/aircraft spines, a deeply considered memory review page with undo/jump/share/snooze, and consistent EmptyState/PageHeader/Banner usage. The biggest UX gaps cluster around the library subsurfaces:

1. The library landing page hides distinct error/feedback affordances when a spine is empty, leans on raw kind/cert vocabulary, and has no surfacing of the spec's "Read in-app vs Browse vs External link only" card-state distinction (Open Question #1 in the spec, smell #5).
2. Several subroutes throw 404s for legitimate-looking empty states (an unknown topic, a cert with zero refs).
3. The `/library` aircraft section silently disappears when count = 0 instead of communicating what aircraft-specific means; the regulations sub-card shows muted "empty" cards that still navigate to a useless empty list.
4. Form-error surfacing is inconsistent across pages -- some use Banner, some use bespoke `.error` divs, some use inline `_` field-error pills, and a few action paths surface no error at all.
5. The handbook reader's "newer edition available" banner is a `role="alert"` on a passive piece of info; the linked-edition is the same handbook (self-link).
6. Skip-permanently/skip-topic in `/sessions/[id]` is destructive enough to warrant explicit explanation in the confirm copy; today the confirm strings are terse ("Skip permanently (undo from plan)") and the recovery affordance is a hint paragraph the user reads after acting.
7. A few minor consistency drifts: btn classes vs the `Button` primitive coexist on the same page (memory/new, sessions/[id], plans/new), the dashboard footer stamps a non-live timestamp computed at module load, and the regulations index card uses `opacity: 0.55` for empties without explaining why.

Nothing is blocking core flows; no data-loss risks. The work is mostly polish + spec-alignment + better empty/error wording.

## Issues

### MAJOR: `/library/topic/[topic]` 404s on unknown topic instead of soft empty

File: apps/study/src/routes/(app)/library/topic/[topic]/+page.server.ts:68-70

Problem: `isAviationTopic(topicParam)` rejects any topic not in the enum and the loader throws `error(404, 'Unknown topic: ...')`. A user landing on a stale link (e.g. an old subjects value retired between editions) hits the generic /library/ +error.svelte boundary with `404 Not found`. There is no recovery path back to the library landing.

Expected: An unknown topic is far more often a user/data-staleness issue than a broken URL. Show an empty state styled like the in-page "no references tagged" empty -- "No topic 'foo'. Pick another from the library" with a back link.

Fix: Replace `throw error(404, ...)` with a load-time return where `groups: []`, `topicLabel: param`, and add a "Topic not found" branch in the page template that points back to ROUTES.LIBRARY. Or keep the 404 and override `+error.svelte` for `(app)/library` to add a "Back to library" link in addition to dashboard.

### MAJOR: Library landing has no card-state indicator (spec smell #5 / Open Question #1)

File: apps/study/src/routes/(app)/library/+page.svelte (whole file), libs/ui/src/library/LibraryCard.svelte

Problem: The spec calls out this exact UX gap in §6 ("Smells worth fixing along the way", #5) and Open Questions #1: "Should the library page distinguish 'ingested + readable in-app' from 'umbrella (link-only)'?". Today the landing page is purely a count-by-spine view (`5 references`, `12 references`); the user cannot tell whether tapping a spine card will deliver content they can read in-app or just umbrella cards that bounce to faa.gov. Worse, on the regulations and aircraft sub-pages, the LibraryCard variants render three distinct treatments (readable, external, unlinked) but the landing-page tile gives no preview.

Expected: Either a per-spine breakdown (e.g. `12 references -- 3 in-app, 9 external`) or a small chip/icon indicating that the spine has at least one in-app readable. The spec's recommendation `Read | Browse | External link only` is the canonical phrasing.

Fix: In `+page.server.ts`, additionally compute readable counts per spine via `getReadableReferenceIds()` and surface a `Xinapp / Yexternal` sub-line on each card. Or add a single chip on cards whose spine contains zero readable refs ("Links only"). Tackle in a small follow-on WP per spec §6, smell #5; flag it in IDEAS.md if not done now.

### MAJOR: `/library/regulations` empty buckets render as 0.55-opacity links to dead lists

File: apps/study/src/routes/(app)/library/regulations/+page.svelte:21-32

Problem: When a regulations bucket is empty (e.g. NTSB pre-seed), the card still renders, opacity-dimmed, and is still clickable. Tapping it lands on `/library/regulations/[kind]` with an EmptyState ("No NTSB references seeded yet"). The dim treatment is the only signal -- there's no aria-disabled, no "0 references" suppression, and no "coming soon" copy.

Expected: Either suppress the card entirely (matching the landing page's `visibleRegulationBuckets.filter(count > 0)` pattern) or keep the card and disable the link with a clearer "No references yet" treatment. Pick one and apply it consistently with the landing page.

Fix: Change the loop to `data.buckets.filter(b => b.count > 0)`, mirroring the landing-page pattern in `/library/+page.svelte:30-32`. If the intent is to advertise upcoming buckets, replace the dimmed `<a>` with a `<div aria-disabled="true">` and add a "coming soon" sub-line.

### MAJOR: `/library/aircraft/[slug]` gives no in-app content path even when `isReadable` would be true

File: apps/study/src/routes/(app)/library/aircraft/[slug]/+page.svelte:25-37

Problem: This subpage hard-codes `isReadable={false}` on the LibraryCard regardless of seed state. POH/AFM is intentionally external-only per the explainer paragraph, but a future POH ingest (out-of-scope per spec) would silently still render as external. More immediately, the page is a dead-end card with one paragraph; there's no "back to library" beyond the breadcrumb in the header.

Expected: Either drive `isReadable` from the loader (consistent with other subroutes), or explicitly comment why it's hard-coded. Add a "Back to Library" action in the page header.

Fix: Compute `isReadable` from `getReadableReferenceIds()` like the topic/cert pages do. If POH is meant to stay external forever, leave a code comment to that effect. Add `actions={() => Button(href=ROUTES.LIBRARY, ghost, 'Back to library')}` in the PageHeader snippet.

### MAJOR: Form-error surfacing inconsistent across pages

Files (sample):
- apps/study/src/routes/(app)/memory/new/+page.svelte:83-85 (`<div class="error" role="alert">`)
- apps/study/src/routes/(app)/plans/new/+page.svelte:79-81 (`<div class="error" role="alert">`)
- apps/study/src/routes/(app)/plans/[id]/+page.svelte:108-110 (Banner)
- apps/study/src/routes/(app)/sessions/[id]/+page.svelte:117-118 (`<div class="error" role="alert">`)
- apps/study/src/routes/login/+page.svelte:38-39 (Banner)

Problem: The same kind of feedback (form-action failure) is rendered in three different shapes -- `Banner tone="danger"`, `<div class="error">`, and inline-pill `_` field errors. Visual consistency suffers, and color tokens drift (some use `--action-hazard-wash`, some use `--action-hazard-edge`, some pick from `--button-hazard-bg`).

Expected: All form-level errors use `Banner tone="danger"`. Inline field errors use the `<span class="err">` pattern next to the input.

Fix: Replace the bespoke `.error` divs in memory/new, plans/new, sessions/[id] with `<Banner tone="danger">{error}</Banner>` to match plans/[id] and login. Audit the rest of the route tree for the same drift.

### MAJOR: Memory/review page mid-flow loading state is invisible during route transitions

File: apps/study/src/routes/(app)/memory/review/[sessionId]/+page.svelte:700-702

Problem: When a rating is submitted, the page sets `phase = SUBMITTING` and shows `<p class="rate-q subdued">Saving...</p>` -- but the rest of the page (front/back card, ratings row) stays mounted in its previous state with the rating buttons still clickable until the action returns and the next card loads. Rapid keyboard rating spam (e.g. user hits "3" twice quickly) can race against the in-flight submission. The rating buttons have `disabled={phase !== ANSWER}` which catches some races, but the keyboard shortcut path (line 277-279) calls `ratingShortcut(...)` -> `btn?.click()` which doesn't check phase before triggering.

Expected: Block keyboard rating shortcuts while `phase === SUBMITTING`. Add a global "submitting" affordance (e.g. dim the rating row, swap the rate-q line to the saving message above the row, not below).

Fix: At line 273-280, gate keyboard rating with `if (phase !== REVIEW_PHASES.ANSWER) return;` before reading `e.key`. Move the "Saving..." message above the ratings row so the user sees it without scrolling, and add `aria-busy="true"` to the form during submit.

### MAJOR: `/sessions/[id]` "Skip permanently" is a destructive irreversible action with terse confirm copy

File: apps/study/src/routes/(app)/sessions/[id]/+page.svelte:289-300

Problem: The third skip option is "Skip permanently" with confirm label "Skip permanently (undo from plan)". The recovery hint is a paragraph below: "Topic + permanent skips can be reactivated from the plan detail page." A user clicks the danger-variant Skip permanently > Skip permanently (undo from plan) confirm > and may not realize they need to walk to /plans/[id] to reverse it. There's no inline reactivate link, and the confirmation copy doesn't echo the "from plan" phrase the hint uses (`Reactivate` is the actual button label inside plan details).

Expected: Confirmation dialog that names where the recovery happens. e.g. `Skip permanently? You can reactivate it from your plan's "Skipped nodes" section.`

Fix: Pass a richer `confirmLabel` or add a `confirmBody` prop pattern to ConfirmAction so the confirm explicitly says "Reactivate from /plans/[planId]". Add the planId to the hidden fields so the post-action banner can link straight to the plan detail. Failing that, extend the post-skip toast to include "Skipped permanently. Manage skipped nodes -> [plan]".

### MINOR: Handbook reader "newer edition" banner is `role="alert"` for a passive notice

File: apps/study/src/routes/(app)/library/handbook/[slug]/+page.svelte:33-39

Problem: `<div class="banner" role="alert">` on a non-urgent informational message. ARIA `alert` is for time-sensitive interruptive content; a "newer edition available" advisory shouldn't yank the SR user's focus.

Expected: Use `role="status"` or just a `<aside>` with semantic styling. ARIA-alert is reserved for urgency.

Fix: Replace `role="alert"` with `role="status"`. The Banner component already supports `tone="info"`; consider replacing the bespoke div entirely.

### MINOR: Handbook "newer edition" link points to itself when `supersededByEdition` is the same `documentSlug`

File: apps/study/src/routes/(app)/library/handbook/[slug]/+page.svelte:37

Problem: `ROUTES.LIBRARY_HANDBOOK(data.reference.documentSlug)` is constant per slug; `supersededByEdition` is just an edition string. When the user is reading PHAK/26B and a 27A is published, the link reloads the same URL (which now resolves to the latest because the loader picks an edition). It works coincidentally, but the structure suggests the link should encode which edition is being targeted.

Expected: Either have the loader return a target slug + edition pair for `supersededBy`, or document the implicit "always-latest" semantics. Match the help-text to the behavior ("Read the latest edition").

Fix: Loader exposes `supersededByDocumentSlug` (often the same), and the template builds a clearer link. If the intent is "you're on the latest, here's the change log," remove the link and just show the new edition badge.

### MINOR: `/library` aircraft section quietly disappears when count = 0 with no explanation

File: apps/study/src/routes/(app)/library/+page.svelte:135-150

Problem: `{#if aircraftCount > 0}` hides the entire Aircraft-specific spine when no POH rows are seeded. This is consistent with the spec's POH umbrella treatment (spec §2 catalog), but the user has no signal that aircraft-specific content even exists as a category. A new user wonders where Cessna 172 lives.

Expected: Either render a small zero-state under "Aircraft-specific" with the explanatory text from `/library/aircraft/[slug]/+page.svelte:39-42` ("POH/AFM content is manufacturer-specific..."), or surface it as a top-level "Aircraft" link in the by-cert/by-topic spine.

Fix: Render the section even when empty, with an EmptyState body explaining the umbrella POH semantics. Or rewire to suppress only when `data.aircraft.length === 0` AND the user has no cert that needs aircraft content.

### MINOR: `/library/regulations/[kind]` umbrella references render with `isReadable={false}` baked in (no in-app path ever)

File: apps/study/src/routes/(app)/library/regulations/[kind]/+page.svelte:65-72

Problem: Hardcoded `isReadable={false}` on umbrella refs. Same shape as the aircraft page issue. If a future ingestion lands NTSB content, this card silently stays external.

Expected: Drive from the loader.

Fix: Either compute `isReadable` server-side, or comment the intent. Same fix shape as the aircraft page.

### MINOR: Memory/new "Save and add another" intent has no visible confirmation when Save also redirects

File: apps/study/src/routes/(app)/memory/new/+page.svelte:77-81 + actions:197-199

Problem: When the user clicks "Save and add another," the action redirects back to /memory/new with `?created=<id>`, the banner at line 77-81 shows "Card saved. View it or add another below," and the form is cleared (focus lands on Front via $effect). That's good. But "Save" does the same redirect (with `?created=<id>` and a domain-seed forward), so the user can't tell from the URL whether they're now adding-another or finishing. The PageHeader "Browse" affordance is the only escape.

Expected: After plain "Save," redirect to the new card detail (`/memory/[id]?fresh=1`) so the action's verb matches the result. "Save and add another" stays on the new-card page.

Fix: Differentiate the two intents in `+page.server.ts` actions. Save -> redirect to ROUTES.MEMORY_CARD(id). Save-and-add -> redirect back to /memory/new.

### MINOR: Pending session preset submit shows "Starting..." but other tiles disable instead of dim

File: apps/study/src/routes/(app)/session/start/+page.svelte:197-217

Problem: `disableOthers` is `submittingPresetId !== null && submittingPresetId !== preset.id`. While one tile is submitting, the rest go to `disabled` + `is-disabled` styling -- but the in-flight tile shows no spinner; only the drawer footer button has `is-busy` + `Starting...`. If the user dismissed the drawer before the action returned, no UI signals the in-flight state.

Expected: While `submittingPresetId !== null`, a non-dismissable progress overlay or banner reading "Starting your session..."

Fix: Either lock the drawer open while submitting (don't allow Cancel), or show a top-of-page Banner tone="info" reading "Starting <preset.label>..." until the submit settles. Also disable the dashboard "Cancel" button in the page header during submit.

### MINOR: Plans/new range slider has no aria-valuetext for screen readers

File: apps/study/src/routes/(app)/plans/new/+page.svelte:155-168

Problem: The range input has `min`/`max` attributes but no `aria-valuetext`. Screen reader users hear "X" not "X items". The visible legend "Items per session: {sessionLength}" reflects the value, but the input itself doesn't have an associated description.

Expected: `aria-valuetext={\`${sessionLength} items per session\`}` on the input, or wire the `<legend>` as the input's accessible name via aria-labelledby.

Fix: Add `aria-valuetext` and consider a hidden `<label for>` since the legend doesn't announce as a label on a range input across all SR/browser combos.

### MINOR: Dashboard footer timestamp is captured at module load and never refreshes

File: apps/study/src/routes/(app)/dashboard/+page.svelte:19-20

Problem: `const loadedAt = new Date(); const stamp = ...` runs once when the module evaluates. On a long-lived tab, the dashboard footer keeps showing yesterday's timestamp. It's `aria-hidden="true"` so SRs are spared, but a sighted user opening the dashboard on day 2 sees a stale stamp that looks like authoritative data.

Expected: Either compute on load via `data.serverTime` (server-side now) or refresh via `$effect` + interval. Or drop the timestamp entirely if it's pure decoration.

Fix: Move the stamp to a `$derived` driven by a `$state` time that ticks on a `$effect` interval, or pass `serverTime` from the loader and compute reactively. Or remove since `aria-hidden` admits it's decorative.

### MINOR: Sessions/[id] "Skip today" is a button-styled link without confirmation -- inconsistent with other skip variants

File: apps/study/src/routes/(app)/sessions/[id]/+page.svelte:271-276

Problem: "Skip today" is a plain submit button with no confirm. "Skip topic" and "Skip permanently" use ConfirmAction. The reasoning is sound (today-skip is reversible by tomorrow's run), but the visual hierarchy puts all three on a single row with the same `link-btn` styling -- the user can't tell at a glance which one is the lightweight action.

Expected: Different visual weight for the three, and/or move "Skip today" to a different row. Or keep one row but label them by reversibility ("Skip until tomorrow", "Skip topic (in plan)", "Skip permanently").

Fix: Add a small subtitle or split the row. Cleaner: label "Skip today" -> "Snooze until tomorrow" so the verb signals reversibility.

### NIT: Library landing "Show all topics" button copy doesn't reflect collapsed/expanded state in aria

File: apps/study/src/routes/(app)/library/+page.svelte:108-112

Problem: `<button>` toggles `showAllTopics`; the visible label flips between `Show all N topics` and `Hide smaller topics`. There's no aria-expanded attribute, so SR users get only the visible text change.

Expected: `aria-expanded={showAllTopics}` and `aria-controls` pointing at the topic list.

Fix: Add `aria-expanded={showAllTopics}` and an id on the topic `<ul>` referenced by `aria-controls`.

### NIT: Memory/[id] page layout uses `var(--space-2xl)` padding on the card while review uses `var(--space-xl)` -- subtle inconsistency

Files: apps/study/src/routes/(app)/memory/review/[sessionId]/+page.svelte:993, apps/study/src/routes/(app)/memory/+page.svelte (saved-decks block)

Problem: Different padding scales for visually-equivalent "card containers" across the memory subroutes. Not load-bearing but each surface looks like it was authored by a different agent.

Expected: One container token (e.g. `--card-padding-lg`) used across memory.

Fix: Pick one (likely `--space-xl`) and apply consistently.

### NIT: `/credentials` "All active credentials are listed" banner has no dismiss

File: apps/study/src/routes/(app)/credentials/+page.svelte:38-46

Problem: The "No primary goal set" banner reappears every load until the user creates a goal. There's no per-session dismiss. Most banners in the app are dismissible via Banner's `dismissible` prop.

Expected: Make it dismissible (cookie-backed `dismissed_credentials_no_goal` flag) so power users aren't reminded forever.

Fix: Wire to a small cookie + a dismiss button. Low priority.
