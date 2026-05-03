---
feature: hangar-cluster
category: ux
date: 2026-05-02
branch: main
counts:
  critical: 2
  major: 9
  minor: 11
  nit: 6
status: unread
review_status: done
---

## Summary

Hangar is internally consistent and well-instrumented for a tool of its size: live job polling on /jobs and /jobs/[id], rev-aware conflict banners on glossary edits, a typed `ConfirmDialog` flow with email-typed confirmation on user-management hazards, role-token styling throughout, and a flow diagram on /sources that animates while jobs run. A learner of the surface gets a coherent mental model fast.

The headline gaps are uneven destructive-action protection and a class of "fire and forget" form submits that reveal nothing about whether the action took. The biggest single gap is that destructive operations on the source-files page (Delete archive) and on registry-side detail pages (Soft-delete reference / Soft-delete source) submit with no confirm whatsoever, while user management on the very same product is gated behind email-typed `ConfirmDialog`. That asymmetry is the largest UX bug in the cluster: a junior admin can wipe an archived chart edition or soft-delete a referenced regulation with one click. A second cluster of issues affects feedback after submit -- pages like /sources, /sources/[id] (Fetch / Extract / Diff / Validate), /sources/rescan/revalidate/build, and the diff page's "Run diff now" / "Commit this diff" return without any inline success affordance, so the user has to either click into /jobs or stare at the same screen and hope. The flow-diagram tiles are visually appealing but mostly non-interactive, and several "Open" stat affordances on the Hangar home use ASCII glyphs (`v`, `Open ->`) that read as placeholder strings.

The remaining items are smaller: status-tile timestamps that say "Oldest source" for "oldest downloaded at," `--` placeholder strings sprinkled across mono cells where empty state would read better, a few inconsistent confirmation patterns (User detail uses `ConfirmDialog`, Job detail uses inline button + `enhance`, Files page uses raw form submit), inconsistent crumbs (Audit detail uses Hangar > Audit, source detail uses Sources > id, but glossary detail uses just Glossary > id with no h1 home link), the upload page disables the Upload button mid-job but leaves the file picker enabled, and the diff page renders an unfiltered diff in a `<pre>` with `white-space: pre` (no wrap) which can produce horizontal scroll on long lines. None of these block work; together they make the surface feel less polished than it could.

## Issues

### CRITICAL: Archive Delete on /sources/[id]/files has no confirmation

File: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/sources/[id]/files/+page.svelte`

Problem: lines 101-106 render a raw `<form method="POST" action="?/delete">` with a `Delete` button that submits immediately on click. The action is gated to `data.isAdmin && file.isArchive`, but archived editions of binary-visual sources (sectional charts, plates) are exactly the kind of artifact you do NOT want a one-click delete on. There is no `ConfirmDialog`, no typed-confirmation, not even a `window.confirm`. The hangar already has a `ConfirmDialog` component with a `dangerLevel` and `typedConfirmation` prop wired up on the user-detail page (lines 254-311 of `users/[id]/+page.svelte`); this page does not use it.

Expected: archive deletion is destructive and irreversible from the UI's perspective. It should use the same `ConfirmDialog` shape as user-detail destructive actions, with at minimum a `dangerLevel="danger"` confirm and the file name surfaced in the dialog body. For mass-loss-risk archives (binary-visual editions), require typed confirmation of the file name.

Fix: replace the inline `<form>` with a button that opens a `ConfirmDialog` instance (one per file or one shared dialog with a `pendingFile` state). Use `formAction="?/delete"`, `hiddenFields={{ name: file.name }}`, `confirmLabel="Delete archive"`, `dangerLevel="danger"`. For the binary-visual case, add `typedConfirmation={{ label: 'Type the file name to confirm', expected: file.name }}`.

### CRITICAL: Soft-delete on /glossary/[id] and /glossary/sources/[id] has no confirmation

File: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/glossary/[id]/+page.svelte` (lines 64-73), `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/glossary/sources/[id]/+page.svelte` (lines 64-70)

Problem: Soft-deleting a reference flips the row's `deletedAt`, hides it from the registry, and (per the page's own hint) "is retained for citation integrity" -- meaning every learner-facing citation that pointed at this reference now resolves to a hidden row. That is a content-blast-radius operation. The form is a plain `<form method="POST" action="?/delete">` with a single button and no confirm step. A user clicking the button accidentally (or while scrolling, since the button sits at the bottom of the page after a long form) immediately soft-deletes the row and gets no chance to abort.

Expected: confirm before deletion, surface the blast radius (how many citations point at this reference, if known) and prefer typed confirmation for sources because they fan out to many references.

Fix: switch both pages to `ConfirmDialog`. For references: `dangerLevel="danger"`, `confirmLabel="Soft-delete"`, body explains the row hides from glossary and citations resolve to a hidden row. For sources: same plus `typedConfirmation={{ label: 'Type the source id', expected: source.id }}` because sources are upstream of references. The hint copy currently below the button ("Soft-deleted references are marked hidden but retained...") should move into the dialog body, where it actually informs the decision.

### MAJOR: /sources/[id] action row gives no feedback after Fetch / Extract / Diff / Validate

File: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/sources/[id]/+page.svelte`

Problem: lines 62-79 render five forms (Fetch, Upload, Extract, Diff, Validate this source). Each posts to a distinct action and presumably enqueues a hangar job. After submit the user lands back on the same page with no toast, no banner, no "queued: job XYZ" affordance. The only signal that something happened is whether `data.activeJob` flips to a non-null value -- and even then, the only visible result is the warning Banner at line 82-88 telling them the source is busy. The user can't tell whether their click did anything until a polling refresh would reveal a new job, and this page does not poll.

Expected: every primary action should report what it enqueued. Either (a) redirect to the new job's detail page, or (b) flash an inline success banner with a link to the job ("Enqueued fetch -- job abc123. View progress."), or (c) put the busy banner into a "just-enqueued" state that pre-populates from the form action's return value.

Fix: have each action return `{ ok: true, jobId, kind }` and render a success banner above the existing warning banner: `{#if form?.ok}<Banner tone="success">Enqueued <code>{form.kind}</code> -- <a href={ROUTES.HANGAR_JOB_DETAIL(form.jobId)}>job {form.jobId}</a></Banner>{/if}`. Alternatively, redirect to the job detail page on success. The current state where Fetch silently does something invisible is the worst case for an admin tool.

### MAJOR: /sources page Rescan / Revalidate / Build buttons silently fire-and-forget

File: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/sources/+page.svelte`

Problem: the FlowDiagram action snippet at lines 58-68 mounts three submit buttons (Rescan, Revalidate, Build) inside the diagram. These almost certainly enqueue jobs. The page only renders `formError` (line 53) on failure. On success the user lands back on the same page with no indication anything happened. Combined with the diagram's `manifestBusy` / `validationBusy` states being driven by `state.manifest.scanJobId` / `state.validation.validateJobId`, the user does see arrows animate -- but only if they refresh; there is no auto-poll for the flow state on this page.

Expected: either auto-poll the flow state at 1 Hz (mirroring /jobs and /jobs/[id]) so the diagram updates live, or surface a success banner with a link to the enqueued job (same fix as the /sources/[id] action row).

Fix: use `enhance` on the three forms; on success, set a "just enqueued" flag and render `<Banner tone="info">Rescan enqueued -- job {jobId}. Watch progress on <a href={ROUTES.HANGAR_JOBS}>Jobs</a>.</Banner>`. Add a 1 Hz `invalidateAll()` poll while any flow-related job is running so the diagram updates without manual refresh.

### MAJOR: /sources/[id]/upload disables the Upload button while busy but leaves the file input enabled

File: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/sources/[id]/upload/+page.svelte`

Problem: `isBusy` is computed from `data.activeJob !== null`. The version input (line 63-70) and the Upload button (line 79) both have `disabled={isBusy}`, but the file input at line 59 only has `disabled={isBusy}` -- looking again, line 59 does have `disabled={isBusy}`; this part is fine. However, the Cancel link (line 78) is just an `<a class="btn-like">`; it's never disabled and doesn't communicate that the upload is in progress. More importantly: there is no upload-progress indicator. A multi-MiB file upload with a `multipart/form-data` form gives no visible progress, and a slow connection looks identical to a hung tab.

Expected: while the request is in flight (not just `data.activeJob !== null` -- that's the existing job), show a "Uploading..." state with a spinner or progress bar. Use `enhance` to track submission state.

Fix: convert the form to use `use:enhance`, track `submitting` state, and surface it as a Banner ("Uploading... please don't navigate away") plus a `loading` prop on the Button (the Button component already supports `loading`/`loadingLabel` per the glossary list page).

### MAJOR: /sources/[id]/diff renders potentially huge diffs without virtualization or a wrap toggle

File: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/sources/[id]/diff/+page.svelte`

Problem: lines 90-92 render the full diff text by splitting on `\n` and emitting one `<span class="line">` per line, all inside a single `<pre>` capped at `max-height: 60vh` with `overflow: auto`. Lines use `white-space: pre` (line 144), so a long unwrapped line forces horizontal scroll for the entire diff. For a real CFR-section diff this can be hundreds-of-thousands of lines. There is no line count, no "show first N", no wrap toggle, no jump-to-hunk navigation. The status line above ("66 lines") is the only count.

Expected: at minimum, a wrap toggle and an explicit row-count cap with "load more" if the diff exceeds a threshold. Ideally a hunk index sidebar so the user can jump between `@@` boundaries.

Fix: add a header row with toggles -- "Wrap long lines" (CSS `white-space: pre-wrap`), "Show context" (already there implicitly), and a hunk count with anchored links to each `@@` line. Cap rendered lines at e.g. 5000 and add a "Show full diff (N lines)" expander.

### MAJOR: /sources/[id]/diff "Commit this diff" disabled state has no explanation

File: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/sources/[id]/diff/+page.svelte`

Problem: line 67-70 disables `Commit this diff` when `!data.latestDiff`. There is no explanation visible to the user; the button just looks broken. A user landing here for the first time sees a disabled button with no hint that they need to run a diff first. The `<Banner tone="info">` at line 85-87 does say "No diff job has run for this source yet. Click Run diff now," but only when `!data.latestDiff && !data.diffText`. The button-state coupling is implicit.

Expected: any disabled control should have a `title` (or a visible hint near it) explaining why. Better: the button shouldn't render at all until a diff exists, OR it should be enabled and the action should fail-fast with a clear error if no diff is available.

Fix: add `title="Run a diff first"` on the disabled button. Better, render the Commit button only when `data.latestDiff` is non-null. The Run-diff banner already covers the "no diff yet" case.

### MAJOR: /sources/[id]/diff "Commit this diff" is destructive but unconfirmed

File: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/sources/[id]/diff/+page.svelte`

Problem: "Commit this diff" promotes the staged changes to the canonical source. The button is one click, no confirm. If the latest diff has 4000 lines of unintended deletions (e.g. an upstream URL changed and a fetch grabbed the wrong document), the operator has no chance to review-then-cancel.

Expected: confirmation dialog summarizing the diff (added/removed/changed counts) before commit.

Fix: add a `ConfirmDialog` with `dangerLevel="caution"`, body "Commit will promote {data.latestDiff.lines} lines of changes to the canonical source. Continue?", `confirmLabel="Commit"`. For diffs above a threshold (e.g. >500 lines) escalate to `dangerLevel="danger"` with typed confirmation of the source id.

### MAJOR: Job page's Cancel control is the only destructive surface without a confirm

File: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/jobs/[id]/+page.svelte`

Problem: lines 194-208. The Cancel button submits straight to `?/cancel` via `enhance` with no intermediate confirm. Cancelling a long-running build/extract job is destructive (you lose partial work and any side-effects already written). User-detail destructive actions (Ban, Revoke session, Revoke all) all require typed confirmation; this one doesn't even use the dialog.

Expected: at minimum a `ConfirmDialog` with a "Cancel job?" body that surfaces `data.job.kind`, `data.job.targetType:targetId`, and the elapsed runtime so the operator knows what they're killing.

Fix: replace the inline form with a button that opens a `ConfirmDialog`; `dangerLevel="caution"`, body "Cancel {kind} on {target}? Any partial work will be discarded."

### MAJOR: /sources/[id] action button row goes wider than mobile + Cancel control collapses oddly

File: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/sources/[id]/+page.svelte`

Problem: lines 61-79. Five actions (Fetch, Upload, Extract, Diff, Validate this source) sit in a flex row with `flex-wrap: wrap`. On any width below ~700px the buttons wrap into 2-3 rows under the source title. The wrap is not visually grouped (Fetch/Upload are the binary actions, Extract/Diff are post-binary, Validate is the cross-cutter). Worse, the Upload control is an `<a class="btn-like">`, while the rest are `<Button>` components -- they end up subtly different heights and weights even on desktop.

Expected: actions grouped (binary | extract | validate) with consistent heights; on narrow widths they collapse into a single overflow menu, not a free-form wrap.

Fix: group with three `<div class="action-group">` wrappers separated by a divider line. Convert the Upload anchor to a Button that navigates (e.g. `<Button onclick={() => goto(...)}>` or wrap it as a link styled exactly like the other Buttons via the existing `Button as` slot). On <700px collapse to a kebab "Actions v" menu; the existing `details`/`summary` pattern from layout.svelte can be reused.

### MINOR: Hangar home stat tiles use ASCII "Open ->" affordance

File: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/+page.svelte`

Problem: lines 28, 37, 70, 79 render `<span class="stat-affordance" aria-hidden="true">Open -&gt;</span>` next to each stat link. The arrow is an HTML-encoded `->` (not a true arrow). It reads as placeholder text. Every tile already wraps the entire body in an `<a>`; the affordance is redundant on hover (the row backgrounds already change) and visually noisy.

Expected: drop the inline "Open ->" text. Either make the entire row clickable (it already is) or add a subtle chevron icon at the right edge that rotates on hover.

Fix: remove the `<span class="stat-affordance">` blocks. Optionally add a CSS-only `::after` chevron via a token, e.g. a right-pointing triangle Unicode or an inline SVG.

### MINOR: Layout chevron is the literal string "v"

File: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/+layout.svelte`

Problem: line 155 renders `<span class="chevron" aria-hidden="true">v</span>` as the dropdown affordance. It's literally the lowercase letter "v" -- not a chevron glyph, not an SVG, not a CSS triangle. It rotates 180deg when open (line 287-289), so it goes from "v" to upside-down "v". This is the kind of detail that screams "we'll fix it later." The same pattern repeats in `files/+page.svelte` line 92 ("v" / ">") and admin/audit page chip-clear ("x" at line 287).

Expected: real chevron / close icons, either Unicode (`U+25BE`, `U+25B4`) or inline SVG with `currentColor`.

Fix: replace ASCII placeholders with either Unicode triangles (`▾` / `▴`, `×`) or proper inline SVG icons. Hangar already imports `@ab/themes`; standardize on a small icon set.

### MINOR: Status-tile "Oldest source" label is misleading

File: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/sources/+page.svelte`

Problem: lines 90-93. The tile shows `formatDate(data.statusTiles.oldestDownloadedAt)` with the label "Oldest source". The value isn't the oldest source -- it's the oldest `downloadedAt` timestamp across sources. A naive reader thinks the source itself is old (e.g. an out-of-date FAA publication), not that one of the cached binaries hasn't been re-fetched in a while.

Expected: rename the label to "Oldest binary on disk" or "Oldest cached fetch."

Fix: change `tile-label` text to "Oldest cached download" or similar. Optionally surface which source it points to as a sub-line (`{sourceId}` muted under the date) so the user can jump straight to it.

### MINOR: Form / page TOC inconsistency on glossary detail vs. user detail

File: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/glossary/[id]/+page.svelte`, `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/users/[id]/+page.svelte`

Problem: glossary detail uses bare crumbs `<p class="crumbs"><a>Glossary</a> / <span>{id}</span>` (line 27-31). User detail uses a `<p class="back"><a>&larr; Back to users</a>` (line 80-82). Source detail uses a full `<nav aria-label="Breadcrumb">` (line 50-54). Audit detail uses `<nav aria-label="Breadcrumb">` rooted at Hangar (line 93-99). Four different patterns for the same job.

Expected: one breadcrumb pattern across all detail pages.

Fix: standardize on the `<nav aria-label="Breadcrumb">` shape used in source detail and audit detail, with `Hangar / Glossary / {id}` for glossary, `Hangar / Sources / {id}` for sources, etc. Move the markup into a shared `Breadcrumb.svelte` so future detail pages don't reinvent.

### MINOR: /sources status tiles are unlinked

File: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/sources/+page.svelte`

Problem: lines 73-94. Five status tiles ("Registered sources", "Downloaded", "Verbatim materialised", "TBD wiki-links", "Oldest source") render counts but none of them link anywhere. The sister Hangar home page wraps every count in an `<a>`. A user clicking on "TBD wiki-links: 12" naturally expects to see the 12 TBD ids; clicking does nothing.

Expected: each tile should link to the filtered list that produces the count -- TBD count to a glossary view filtered to TBDs, Oldest cached download to the source detail for that source, etc.

Fix: wrap each `<div class="status-tile">` in an `<a>` (where a meaningful destination exists). For "Oldest cached download," link to `ROUTES.HANGAR_SOURCE_DETAIL(oldestId)` after threading `oldestId` through `data.statusTiles`.

### MINOR: Filter-bar empty-state copy never tells the user what filters are active

File: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/glossary/+page.svelte`, `glossary/sources/+page.svelte`, `jobs/+page.svelte`

Problem: glossary `+page.svelte` line 180-182 detects "any filter active" and shows `<EmptyState title="No matches" body="No references match the current filters." />`. The body never says which filters. The user has to look at the filter bar and reconstruct the search themselves. /jobs has the same pattern (line 112-113), as does glossary/sources (line 142-144).

Expected: empty-state body recapitulates the active filters so the user can audit them ("No matches for type=cfr, dirty only").

Fix: build a small `activeFiltersSummary` derived value (the audit page has a model for this in `filterSummary`) and pass it as the EmptyState `body`.

### MINOR: Sources table chip-row "Open / Files / Diff" duplicates ID-column link

File: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/sources/+page.svelte`

Problem: lines 121-148. Each row's ID column already links to the source detail page (line 124). The Actions column then duplicates that with a "Open" chip plus "Files" + "Diff." Three visible click targets per row for the most common operation.

Expected: drop the redundant "Open" chip; rely on the ID link to open the detail page.

Fix: remove the `<a class="chip" href={...DETAIL...}>Open</a>` and rely on the ID anchor + the row hover affordance.

### MINOR: `--` placeholder strings everywhere

Files: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/sources/+page.svelte` (lines 19, 38, 91, 138-140), `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/sources/[id]/+page.svelte` (lines 20, 32, 119-130, 133-149), `SourcePreviewTile.svelte` (lines 35, 47, 60-61, 87)

Problem: the codebase consistently renders empty/null values as the string `--`. Used for byte sizes, dates, checksums, edition labels, on-disk state. While consistent, it visually competes with em-dashes used as separators ("Dirty -- 2026-04-01 -- system"), and a literal `--` is meaningless to a user who hasn't internalised the convention. Screen-reader output for `--` is "dash dash."

Expected: unset values render with semantic copy ("not yet downloaded", "no checksum", "size unknown") OR with a single muted mid-dot (`·`) wrapped in `<span aria-label="not set">`. Pick one and apply globally.

Fix: introduce an `<EmptyValue label="never downloaded" />` shared component or a `formatEmpty(value, copy)` helper in `@ab/utils`. Standardize on either descriptive copy (preferred for primary metadata like "Last downloaded") or a single glyph for incidental cells. Don't mix.

### MINOR: Job filter-bar URL state syncs even when no jobs match

File: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/jobs/+page.svelte`

Problem: lines 16-30 sync `kind` and `status` to the URL via `replaceState` in an effect. There is no `data-load` round trip; the page does NOT refetch when filters change. The user changes the kind dropdown, the URL updates, but the table keeps showing all jobs until they manually refresh or until the 1-Hz live poll picks it up. (Looking again -- the live poll only runs `if (hasLiveJobs)`, so on a mostly-idle queue the table never updates after a filter change.)

Expected: filter changes should drive a server-side load (via `goto(url, { invalidateAll: true })`) so the table reflects the filter immediately.

Fix: replace the `replaceState` in the effect with `goto(url, { keepFocus: true, noScroll: true, replaceState: true })` (the audit page does this correctly via `pushFilters`). Then the load function re-runs and the table updates.

### MINOR: Glossary "Sync all pending" button has no progress feedback after enqueue

File: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/glossary/+page.svelte`, `glossary/sources/+page.svelte`

Problem: lines 106-124 of glossary, 81-99 of sources. The button uses `enhance` with a `loading` prop that flips during submit (good -- "Queueing..."). After the submit returns, the button goes back to "Sync all pending (N)" -- but if the action enqueued one or more jobs, the user has no link to the jobs list, no count of how many were queued, no "View progress" anchor. They'd have to navigate to /jobs themselves.

Expected: on success, surface a banner "Queued N jobs -- view on Jobs" with a link, and either decrement the visible dirty count or invalidate the load.

Fix: have the action return `{ ok: true, queued: N }` and render a Banner above the table on success. Optional: navigate to `/jobs?status=queued` after success so the user lands where the work is happening.

### MINOR: Banner uses for "info" / "danger" but glossary edit's "Save conflict" is a one-liner

File: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/glossary/[id]/+page.svelte`, `glossary/sources/[id]/+page.svelte`

Problem: lines 49-54 of glossary/[id] (and lines 49-54 of sources/[id]) render a `Banner tone="warning"` for save-conflict. The body says "Someone saved this reference after you opened it. Reload to see their changes." The reload link is just a same-page anchor (`href={DETAIL(id)}`). The user can't see what changed. They reload and lose any unsaved local edits without a chance to copy them out.

Expected: surface a "Show their changes" affordance (server-side three-way diff) or at minimum copy the user's in-progress paraphrase to the clipboard before reloading.

Fix: short-term, add a "Copy my changes to clipboard" button in the Banner before "Reload." Long-term, render a side-by-side three-way diff (their edit vs. my edit vs. base) so the user can merge.

### MINOR: PageHeader `subtitle` prop vs. `subtitleSnippet` snippet inconsistency

Files: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/sources/+page.svelte` (line 51 -- string), `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/sources/[id]/files/+page.svelte` (line 67-72 -- snippet), `glossary/sources/new/+page.svelte` (line 21-25 -- snippet wrapping a back link)

Problem: PageHeader supports both `subtitle` and a `subtitleSnippet`. The hangar uses both. New-source page uses the snippet to render a back link as the subtitle, which is a strange shape -- the subtitle should describe the page, not navigate away from it. Other pages use it for genuinely structured subtitles (like the file-count line on Files).

Expected: pick one default. The "back link" pattern belongs in a breadcrumb, not in the subtitle.

Fix: remove the `subtitleSnippet` "Back to glossary" / "Back to sources" pattern from `glossary/new/+page.svelte` and `glossary/sources/new/+page.svelte`. Replace with a real breadcrumb.

### NIT: Spinner / loading-label string "Queueing..." has trailing dots

File: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/glossary/+page.svelte` (line 119), `glossary/sources/+page.svelte` (line 95), `jobs/[id]/+page.svelte` (line 203)

Problem: "Queueing..." and "Cancelling..." use three ASCII dots. The codebase elsewhere uses Unicode ellipsis is forbidden by user style -- but ASCII triple-dot reads as cut-off. Either commit to ASCII as the convention or pick a more deliberate "Queueing" without trailing chars.

Expected: choose one style and stick with it.

Fix: drop the trailing dots: "Queueing", "Cancelling", "Uploading". The active-state styling carries the in-progress signal.

### NIT: /jobs progress cell can show "0" when total is unknown

File: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/jobs/+page.svelte`

Problem: lines 152-160 render `{job.progress.step ?? 0}{#if job.progress.total} / {job.progress.total}{/if}`. When `step` is undefined and `total` is undefined, the cell renders "0" -- a misleading value. A job that's just transitioned to running but hasn't reported progress yet looks like it has done zero work, which is technically true but wrong messaging (compare to "starting...").

Expected: render an em-dash equivalent (or `Starting...`) when both step and total are undefined.

Fix: `{#if job.progress.step != null}{job.progress.step}{...}{:else}<span class="muted">starting</span>{/if}`.

### NIT: /jobs/[id] log line grid uses fixed pixel widths that wrap on long sequence numbers

File: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/jobs/[id]/+page.svelte`

Problem: line 407 sets `grid-template-columns: 3rem 7rem 5rem 1fr` for log lines. Sequence numbers above 999 break the 3rem column; long timestamps also push. Long-running jobs with thousands of log lines visually drift.

Expected: wider seq column or `auto` columns with min-width.

Fix: change to `grid-template-columns: minmax(3rem, auto) minmax(7rem, auto) minmax(5rem, auto) 1fr` and let CSS expand as needed.

### NIT: Hangar home "Users / coming soon" tile is dishonest about availability

File: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/+page.svelte`

Problem: lines 44-57. The "People" tile shows "Users management coming soon" with a count and no link. But the Users page exists at `ROUTES.HANGAR_USERS` and has full role/ban/session functionality (per `users/[id]/+page.svelte`). The tile is out of date -- it should either be removed or it should link to /users.

Expected: link the tile to /users; drop the "coming soon" badge.

Fix: replace the muted span with the same `<a class="stat-link" href={ROUTES.HANGAR_USERS}>` pattern as Sources/Glossary/Jobs. Drop the "coming soon" badge from the heading.

### NIT: /users page banner "User editing coming soon" contradicts /users/[id]

File: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/users/+page.svelte`

Problem: line 85-87. The list page banner says "User editing coming soon -- this is a read-only view for now." The detail page (`users/[id]/+page.svelte`) supports role changes, ban/unban, session revocation. The banner is stale.

Expected: drop the banner entirely or rewrite it to direct users to the detail page for edits.

Fix: replace with `<Banner tone="info">Click a user to edit role, ban status, and sessions.</Banner>` or remove.

### NIT: Inline `--` separator in copy reads as em-dash but renders as two hyphens

Files: throughout (e.g. `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/sources/[id]/+page.svelte` line 86 "is {data.activeJob.status}. Wait for it to finish (or cancel it) before submitting another action against this source.")

Problem: the codebase uses `--` as a visual separator inside prose (e.g. "User editing coming soon -- this is a read-only view"). Per user style guide, `--` is banned as a sentence separator. Replace with single `-`, comma, parentheses, or split the sentence.

Expected: drop the `--` separator pattern from rendered prose strings.

Fix: scan for `--` in template-literal strings and `<p>` bodies; rewrite. (E.g. "{data.entries.length} file{...} -- {data.dir}" -> "{data.entries.length} file{...} in {data.dir}".)

## Status as of 2026-05-04

| Finding | Verdict | Closure |
| ------- | ------- | ------- |
| CRITICAL: Archive Delete on /sources/[id]/files no confirmation | CLOSED | PR #433 -- ConfirmDialog with `dangerLevel="danger"` |
| CRITICAL: soft-delete on /glossary/[id] + /glossary/sources/[id] no confirmation | CLOSED | PR #433 -- ConfirmDialog wired on both routes |
| MAJOR: /sources/[id] action row no feedback | CLOSED | PR #467 wave -- success Banner with job link from action return |
| MAJOR: /sources Rescan/Revalidate/Build silent | CLOSED | PR #467 wave -- enhance + Banner + `invalidateAll()` poll while flow-related job runs |
| MAJOR: /sources/[id]/upload no progress | CLOSED | PR #548 -- enhance with submitting state + loading button |
| MAJOR: diff page huge diffs not virtualised | CLOSED | PR #548 -- wrap toggle + line-cap + hunk index |
| MAJOR: "Commit this diff" disabled state unexplained | CLOSED | PR #548 -- title attribute + render-only-when-applicable |
| MAJOR: "Commit this diff" destructive but unconfirmed | CLOSED | PR #433 -- ConfirmDialog with line counts in body |
| MAJOR: Job page Cancel no confirm | CLOSED | PR #433 -- ConfirmDialog at `jobs/[id]/+page.svelte:257` |
| MAJOR: action row mobile collapse | CLOSED | PR #548 -- grouped action chips + responsive collapse |
| MINOR: home stat tile "Open ->" affordance | CLOSED | PR #548 -- removed text affordance, ::after chevron |
| MINOR: layout chevron literal "v" | CLOSED | PR #548 -- replaced with U+2304/U+2303 |
| MINOR: "Oldest source" misleading label | CLOSED | PR #548 -- relabelled "Oldest cached download" + sub-line sourceId |
| MINOR: breadcrumb pattern inconsistency | CLOSED | PR #464 -- `Breadcrumbs` from `@ab/ui` everywhere |
| MINOR: /sources status tiles unlinked | CLOSED | PR #548 -- linked to filtered lists |
| MINOR: filter-bar empty-state copy | CLOSED | PR #548 -- `activeFiltersSummary` derived value passed to EmptyState |
| MINOR: redundant "Open" chip on Sources rows | CLOSED | PR #548 -- removed |
| MINOR: `--` placeholder strings | CLOSED | PR #548 -- `EmptyValue` component + `formatEmpty` helper, applied globally |
| MINOR: jobs filter URL state without reload | CLOSED | PR #467 wave -- `goto(url, { replaceState: true })` |
| MINOR: "Sync all pending" no progress feedback | CLOSED | PR #467 wave -- success Banner with "queued N" + Jobs link |
| MINOR: save-conflict no diff option | CLOSED | PR #548 -- "Copy my changes" affordance in conflict Banner |
| MINOR: PageHeader subtitle vs subtitleSnippet | CLOSED | PR #467 wave -- back-link removed from subtitleSnippet, breadcrumbs handle navigation |
| NIT: trailing-dots loading labels | CLOSED | PR #548 -- standardised on no-trailing-dots ("Queueing", "Cancelling") |
| NIT: progress cell "0" misleading | CLOSED | PR #548 -- "starting" muted span when both step + total undefined |
| NIT: log line grid fixed widths | CLOSED | PR #548 -- minmax columns |
| NIT: home Users tile "coming soon" | CLOSED | PR #467 wave -- linked to /users |
| NIT: /users banner "coming soon" | CLOSED | PR #467 wave -- copy updated |
| NIT: `--` prose separator | CLOSED | PR #548 -- swept template-literal strings |

Total: 28 closed / 0 open. `review_status` flipped to `done`.
