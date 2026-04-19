---
title: 'Phase 3 UX Review: spaced-memory-items'
date: 2026-04-19
phase: 3
category: ux
---

# Phase 3 UX Review

Scope: card management UI for the spaced-memory-items feature, commit 07d1ff1 on `build/spaced-memory-items`. Routes reviewed:

- `apps/study/src/routes/(app)/memory/new/+page.svelte` + `+page.server.ts`
- `apps/study/src/routes/(app)/memory/browse/+page.svelte` + `+page.server.ts`
- `apps/study/src/routes/(app)/memory/[id]/+page.svelte` + `+page.server.ts`
- `apps/study/src/routes/(app)/memory/+page.server.ts`
- `apps/study/src/routes/(app)/+layout.svelte` (navigation context)

Persona lens: Joshua (user zero), returning CFI who capture-cards while reading the FARs. Habit formation depends on sub-60s card creation.

## Summary

| Severity | Count |
| -------- | ----- |
| Critical |     0 |
| Major    |     6 |
| Minor    |     9 |
| Nit      |     6 |

## Findings

### [MAJOR] "Save and add another" does not preserve contextual fields (domain, tags)

**File:** `apps/study/src/routes/(app)/memory/new/+page.server.ts:65-67`, `new/+page.svelte:46-50`

**Issue:** When the user hits "Save and add another" the server redirects to `?created=<id>` with no state carried forward. The next form is a blank slate -- Joshua must re-pick domain (e.g., `airspace`) and re-type the same tag set (`far-91, airspace-class-c`) for every consecutive card. The whole point of this button is building 5-10 cards while reading one AIM section on one topic.

**Impact:** Primary user -- direct hit to the spec's "low friction on creation" and "building IS studying" principles. Second card onward takes ~2x longer than it should. Kills the habit the feature exists to form.

**Fix:** On `save-and-add`, append the just-used `domain` (and optionally `tags`) to the redirect, prefill them in the new form, and auto-focus the Front textarea. E.g. redirect to `?created=<id>&domain=<d>&tags=<csv>&focus=front`, then read those in the load function and prefill `values`. Also consider a "Keep fields" toggle if tags should not always carry over.

### [MAJOR] No keyboard submit on textareas, no autofocus on Front, no Escape-to-cancel

**File:** `apps/study/src/routes/(app)/memory/new/+page.svelte:68-92`

**Issue:**

- Front textarea has no `autofocus` attribute. Every new-card load requires a click before typing.
- `<textarea>` swallows plain Enter (correct, you want newlines), but there is no Cmd/Ctrl+Enter shortcut to submit. Nothing binds keyboard at all.
- Escape does not cancel/navigate back, even though "Cancel" is a prominent button.

**Impact:** Capture speed. Pilot is reading a regulation, alt-tabs to airboss, must mouse-click Front, type, mouse-click Save. That mouse trip is exactly the friction the spec forbids.

**Fix:**

- Add `autofocus` to the Front textarea (server-rendered or a `$effect` that focuses on mount).
- Add a document-level keyboard handler: `Cmd/Ctrl+Enter` submits with intent `save`, `Cmd/Ctrl+Shift+Enter` submits with intent `save-and-add`, `Escape` navigates to browse (only if form is pristine, otherwise confirm).
- When `?created=<id>` is present, scroll to top and focus Front again.

### [MAJOR] No "loading" state visible on detail page status actions

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte:171-181`

**Issue:** The status-change form uses bare `use:enhance` with no local `saving` flag, no `disabled` on the buttons, no "Suspending..." text. Click Suspend, nothing visibly happens for the network roundtrip, then the page reloads. Users will click twice.

**Impact:** Double-submits are mitigated only by the server-side UPDATE being idempotent for same target status, but the UX is silent. On slow connections this is confusing.

**Fix:** Mirror the pattern used by the update form: local `statusBusy = $state(false)` flag inside the enhance handler, disable the status buttons while pending, optionally label them "Suspending...".

### [MAJOR] Edit mode silently drops the user out if they try to edit a read-only card

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte:144`, `[id]/+page.server.ts:89-91`

**Issue:** The Edit button is only rendered when `card.isEditable`, which is good. But if a card transitions to non-editable between render and submit (or a course-owned card is reached via URL), the server returns `fail(403)` with message "This card is not editable." The message surfaces at the top of the page but users already committed to a multi-minute edit session. There's also no preview of "read-only because source = course / product" on the Edit path -- the message just says "not editable" with no context.

**Impact:** Confusing edge case for the FIRC migration phase (course cards imported into the same UI).

**Fix:** When `isEditable` is false, already-shown note "This card is read-only (source: Course)." is fine -- good. But the 403 message should match that tone and include the `sourceType`: "This card comes from Course content and can't be edited here." Also consider defensive rendering: if `card.isEditable` flips to false between GET and POST, re-render the read-only view with a toast rather than a bare error banner.

### [MAJOR] Detail page action row mixes destructive and non-destructive actions with identical styling

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte:165-182`

**Issue:** `Edit`, `Suspend`, `Archive`, `Reactivate` are all rendered as `.btn.secondary` -- same grey rectangle. Archive is effectively delete (spec: "archive-only, no hard delete"). Suspend pulls a card out of rotation. These deserve distinct visual weight, and Archive should require confirmation.

**Impact:** Easy to misclick Archive when meaning Suspend (buttons are adjacent, same color). Accidentally archiving a carefully-authored card is a setback; there's no undo path in the UI except filtering to status=archived and clicking Reactivate.

**Fix:**

- Give Archive a destructive style (border/text red, or a dedicated `.btn.danger`).
- Add a lightweight `confirm()` or dialog on Archive.
- Group Edit on the left (the default action) and status mutations on the right, with a visual separator.
- Consider wording: "Archive" alone is ambiguous to a pilot -- "Archive (remove from reviews)" or helper tooltip.

### [MAJOR] Browse page has no card count and no empty state when the user has zero cards at all

**File:** `apps/study/src/routes/(app)/memory/browse/+page.svelte:110-114`

**Issue:** The only empty state is "No cards match these filters." -- same message whether (a) the user has 500 cards but the filters exclude all, or (b) the user just logged in for the first time and has zero cards total. No total count is ever shown on the page, even when results exist. There's no guidance toward "create your first card" only vs "relax your filters" branch.

**Impact:** New users see the same dead end as someone with over-aggressive filters. Spec emphasizes this is a habit-forming tool -- empty state for a brand-new user should be welcoming, not a dry "no match".

**Fix:**

- Show a total count near the header: "`Browse -- 127 cards`" or "`Showing 25 of 127`".
- In the load function, also return `totalCount` (unfiltered) so the empty state can branch: if `totalCount === 0` show "You haven't made any cards yet. Capture your first one." If `totalCount > 0` show "No cards match these filters" with a Reset button inline.

### [MINOR] `MEMORY_NEW` has no direct nav link; users must click "New card" button from browse

**File:** `apps/study/src/routes/(app)/+layout.svelte:8-12`

**Issue:** Top nav has `Memory / Reps / Calibration`. `Memory` redirects to browse. There's no nav-level shortcut to `New card`, even though the whole feature is optimized for rapid capture. Getting to the new-card form from anywhere else takes Memory -> scan page -> click "New card" (top-right).

**Impact:** Habit builders. A keyboard or nav-level shortcut for "new card" would match the "30-second capture" spec.

**Fix:** Either (a) add a "+ New" affordance in the top nav (right-aligned), or (b) a global keyboard shortcut (`n` or `c`) that jumps to `MEMORY_NEW`. Document the shortcut somewhere discoverable (e.g., keyboard legend in footer or tooltip on the nav).

### [MINOR] Browse filters auto-submit is absent; Apply button is required

**File:** `apps/study/src/routes/(app)/memory/browse/+page.svelte:63-108`

**Issue:** Changing a select (e.g., Domain from All -> Airspace) does nothing until the user also clicks Apply. Two-step filter interactions are slow for a daily-use tool.

**Impact:** Friction when scanning the deck.

**Fix:** Either submit the form on `change` for selects (keep Apply for the search box), or add an `onchange={(e) => e.currentTarget.form.requestSubmit()}` hook. Reset still needs to nuke the search input -- link to `ROUTES.MEMORY_BROWSE` is correct but the form's native state may remain stale on navigation (SvelteKit should re-hydrate; verify).

### [MINOR] Filter bar wraps awkwardly at medium widths

**File:** `apps/study/src/routes/(app)/memory/browse/+page.svelte:179-188, 382-391`

**Issue:** Grid is `2fr 1fr 1fr 1fr 1fr auto` on desktop and collapses to `1fr 1fr` only below 640px. At 641-900px widths (common laptop split-screen) the filter bar squeezes the search box too narrow to read typed text.

**Impact:** Tablet and split-screen laptop users.

**Fix:** Add an intermediate breakpoint at ~900px: `grid-template-columns: 1fr 1fr 1fr;` with `filter-actions` spanning the row. Or use `grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));`.

### [MINOR] Pagination shows "Page 1" with no total pages, and no skip-to-first/last

**File:** `apps/study/src/routes/(app)/memory/browse/+page.svelte:136-148`, `browse/+page.server.ts:17,63-66`

**Issue:** Loader returns `hasMore` but not total count / total pages. Pager is just Previous | Page N | Next. Once the deck grows (1000+ cards), jumping around is slow.

**Impact:** Becomes painful around ~100 cards and severe around ~500. Not MVP-critical but worth adding before real usage.

**Fix:** Return `totalCount` from load, show `Page N of M (X cards)`, and expose direct page links for small M.

### [MINOR] Recent-reviews table uses raw `toLocaleString()`; not scannable, drops tz context

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte:58-61, 217, 222`

**Issue:** `formatDate` just calls `toLocaleString()` -- outputs something like `4/19/2026, 2:35:07 PM` in en-US. Recent reviews have columns "When" and "Next due" both stamped full-precision. At 6 columns wide, this table is cramped. FSRS intervals (5m, 3h, 12d) are more meaningful than wall-clock timestamps for reviews.

**Impact:** Detail page looks like log output, not a study tool.

**Fix:** Reuse `formatInterval(ms)` already defined above (line 43) for "When" (e.g., "2h ago") and "Next due" (e.g., "in 3d"). Add a `title` attribute with full wall-clock for hover. Drop seconds. Consider a "relative / absolute" toggle on the column header.

### [MINOR] Schedule `Stability` and `Difficulty` need units / tooltips

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte:186-195`

**Issue:** The stats grid shows `Stability 4.23 d`, `Difficulty 6.14`, `Reviews 7`, `Lapses 1`. For a learner who hasn't read about FSRS, "Difficulty 6.14" is opaque ("out of what? 10? 100?"). Stability has `d` unit (good) but a new user won't know "stability" means "interval at which 90% retention holds".

**Impact:** The spec says "visible scheduling" should be a feature; making the numbers legible without a doc-dive matters.

**Fix:** Add a small info icon or `title` tooltips: Stability ("Days at which ~90% retention is predicted"), Difficulty ("FSRS internal scale, roughly 1 (easy) to 10 (hard)"). Or link to a short glossary page.

### [MINOR] Edit mode does not preserve scroll position and does not confirm on unsaved-changes cancel

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte:16, 138`

**Issue:**

- Clicking Edit swaps the render; if user was scrolled down looking at the Schedule block, they snap back up. No `scrollIntoView` on the form.
- Clicking Cancel drops edits instantly. If the user typed into the Back textarea and hit Cancel accidentally, edits are gone with no "discard changes?" prompt.

**Impact:** Low-frequency annoyance, but for a daily tool the lost edit is a papercut.

**Fix:** On Cancel, check whether any field differs from the card's current values; if so, confirm. On entering edit mode, `$effect` that calls `form.scrollIntoView({ block: 'start' })`.

### [MINOR] Detail page "Back -- ← Browse" breadcrumb is small and hidden above the h1

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte:72-76`

**Issue:** The back link is 0.8125rem, grey, above the page title. It reads less as navigation and more as a label. Using a real arrow glyph is fine -- spec confirms `←` is allowed but it's rendered in a tiny inline-block without enough spacing. No breadcrumb (e.g., `Memory / Browse / Card`).

**Impact:** Orientation. Detail page feels disconnected from the deck.

**Fix:** Either make the back link larger/underlined, or add a proper breadcrumb row: `Memory / Browse / <truncated front>`.

### [MINOR] No "duplicate this card" affordance

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte`

**Issue:** Spec doesn't explicitly require it but aligns with "building IS studying": you often want to make a pair of cards from the same source (e.g., forward question and reverse question from one reg). Today the user copies/pastes manually.

**Impact:** Small accelerator for CFIs building matched pairs.

**Fix:** Add a "Duplicate" button that posts to `memory/new` with prefilled `front/back/domain/tags` via query string. Low effort given the form already reads `values` for prefill on validation errors.

### [MINOR] Tags input accepts duplicates and has no visual chip feedback

**File:** `apps/study/src/routes/(app)/memory/new/+page.svelte:117-127`

**Issue:** Tags are a comma-separated text input with no live chip preview. User types `far-91, far-91` and both land in the tag array (zod `cardTagsSchema` does not dedupe). No autocomplete from existing tags (every new card re-types `far-91`).

**Impact:** Builds cruft in the tag set. Makes the filter dropdown less useful over time (even though the filter doesn't include Tags yet -- see another finding).

**Fix:** Dedupe after parsing (`Array.from(new Set(...))`) in `parseTags` server-side. Client-side, render entered tags as chips below the input as the user types. A tag autocomplete is a larger lift but worth tracking.

### [MINOR] Browse filter list does not include Tags, even though spec calls for it

**File:** `apps/study/src/routes/(app)/memory/browse/+page.svelte:63-108`

**Issue:** Spec: "Filter by domain, card_type, source_type, tags. Search front/back text." Implementation has domain, type, source, status, search -- but not tags. Tags are the user's most personal organizational tool and they're invisible to filter.

**Impact:** Directly documented spec gap.

**Fix:** Add a Tags filter (multi-select or a single-tag text filter to start). `getCards` in the BC would need tag filter support; DB schema stores tags as an array so a `contains` or `??` check works.

### [NIT] Domain label "Adm Human Factors" reads badly

**File:** `apps/study/src/routes/(app)/memory/new/+page.svelte:25-30` (humanize function) and all three pages

**Issue:** `humanize('adm-human-factors')` -> "Adm Human Factors". ADM is an acronym (Aeronautical Decision Making) -- the humanizer lowercases/uppercases the first letter only. Same story for "Vfr Operations", "Ifr Procedures", "Faa Practical Standards" -- these should be `VFR`, `IFR`, `FAA`, `ADM`.

**Impact:** Looks unprofessional to a pilot, who reads acronyms as acronyms.

**Fix:** Replace `humanize()` with a label map keyed by domain/source slug, declared in `libs/constants/src/study.ts` (or a sibling `study-labels.ts`). Use same map on all three pages. Example: `DOMAIN_LABELS[DOMAINS.ADM_HUMAN_FACTORS] = 'ADM & Human Factors'`, `DOMAIN_LABELS[DOMAINS.VFR_OPERATIONS] = 'VFR Operations'`.

### [NIT] "Type" select defaults to BASIC but still requires user to click into the select

**File:** `apps/study/src/routes/(app)/memory/new/+page.svelte:106-114`

**Issue:** Defaults work (`value={values.cardType ?? CARD_TYPES.BASIC}`) -- good. But "Basic", "Cloze", "Regulation", "Memory_item" as options -- "Memory_item" still has underscore, confirming nit above. Also Type field is not explained; a CFI may not know cloze = fill-in-blank.

**Impact:** Tiny.

**Fix:** Map slugs to human labels (see above). Add a small hint under the type picker: "Basic = Q/A, Cloze = fill-in, Regulation = cites a CFR/AIM, Memory item = V-speed or limitation." Or defer by hiding the type picker in an expandable "Advanced" section since Basic covers 90% of cases.

### [NIT] Field error color `#b91c1c` is fine but "err" class styling is subdued

**File:** `apps/study/src/routes/(app)/memory/new/+page.svelte:267-270`, `browse/+page.svelte`, `[id]/+page.svelte:481-484`

**Issue:** Field errors render as 0.8125rem red text below the field. No icon, no border on the offending input. Easy to miss when skimming.

**Impact:** Tiny, since the top-level `.error` banner (for `_`) is prominent enough.

**Fix:** Optionally color the field border red when `fieldErrors.<name>` is set (e.g., `class:invalid={fieldErrors.front}` with a `border-color: #dc2626`).

### [NIT] "Save" vs "Save and add another" primary-secondary choice may be inverted for the intended persona

**File:** `apps/study/src/routes/(app)/memory/new/+page.svelte:129-137`

**Issue:** "Save" is primary (blue), "Save and add another" is secondary (grey). Spec explicitly optimizes for rapid batch capture. The primary action should arguably be the one that keeps the user in the capture loop.

**Impact:** Subtle nudge -- users click primary by default.

**Fix:** Make "Save and add another" primary, "Save" secondary. Or add a "Remember my choice" (session-sticky) flag. Worth running past Joshua before changing.

### [NIT] Maxlength 10000 on textareas has no visible counter near limit

**File:** `apps/study/src/routes/(app)/memory/new/+page.svelte:72, 86`

**Issue:** `maxlength="10000"` silently truncates. No character counter. A user pasting a long regulation may not realize they're near the limit.

**Impact:** Edge case -- 10k chars is generous.

**Fix:** Optional: show "9500/10000" only when over ~80% usage.

### [NIT] Inline-form button grouping has no spacing/visual distinction from Edit button

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte:165-182`

**Issue:** The `.row.action-row` is `justify-content: space-between` with Edit on the left and the status inline-form on the right. On narrow screens they wrap and the grouping becomes unclear. See MAJOR finding on grouping; this is the lighter cosmetic version.

**Impact:** Small.

**Fix:** Add a subtle separator (`border-left`) before the status action group, or pad the group with a label ("Status: [buttons]").

### [NIT] Page title for detail page truncates front at 60 chars without ellipsis in `<title>`

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte:68`

**Issue:** `{card.front.slice(0, 60)} -- airboss` cuts mid-word. Browser tab shows "What are the VFR weather minimums in Class C airspace be -- airboss".

**Impact:** Tab disambiguation, small.

**Fix:** Append `...` when `card.front.length > 60`, and trim to last word boundary.

## Clean

Verified clean in this review:

- **Zod validation on server + error display on client** is well-wired. Field errors surface with `values` prefill -- the form won't lose what the user typed on a validation failure.
- **Routes go through `ROUTES` constants** throughout -- no hardcoded paths.
- **Svelte 5 runes are used correctly** -- `$state`, `$derived`, `$props` everywhere, no `export let`, no stores.
- **No `any` types** introduced in scope; `CARD_TYPE_VALUES`/`DOMAIN_VALUES` casts are documented with a short comment explaining the zod widening.
- **Redirect on success** from new-card to detail view is the right default; "Save and add another" keeps the user in create mode (behavior correct, just doesn't preserve context -- see MAJOR above).
- **Pagination with N+1 row trick** for `hasMore` is fine; `filters` round-trip through `buildHref` preserves user state across page clicks.
- **Read-only affordance** exists (Edit button hidden when `!card.isEditable`, "source:" note shown) -- spec requirement met at the structural level.
- **Memory index redirects to browse** in `+page.server.ts` -- note inline makes the Phase 4 replacement plan clear.
- **Inline form for status actions** uses separate `action="?/setStatus"` (vs the update form's `?/update`) -- correct SvelteKit named-action pattern.
- **Cancel on edit** button is `type="button"` (not submit), correctly toggles state without submitting.
- **Review table is read-only and scoped to the card** via `eq(review.cardId, params.id)` -- no cross-user leak risk.
- **Confirmation banner on "Save and add another"** (`Card saved. View it or add another below.`) is a nice touch -- gives trust that the save happened without losing momentum.
