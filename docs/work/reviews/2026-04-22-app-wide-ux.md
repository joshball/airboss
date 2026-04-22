---
feature: app-wide
category: ux
date: 2026-04-22
branch: main
issues_found: 35
critical: 1
major: 13
minor: 15
nit: 6
revision: refreshed against HEAD (a1db983) -- covers TUI dashboard + knowledge/plans/sessions
---

## Summary

The app has sophisticated bones: the new `/sessions/[id]` flow is **server-derived** (current slot = first unresolved slot, so refresh naturally resumes), knowledge nodes have a 7-phase learn progression with proper a11y, the dashboard was just refactored into a deliberate TUI-style 12-col grid (monospace, 2px corners, full-bleed), and plans drive sessions cleanly. Where the app falls down is **cross-cutting**:

- `libs/themes/` is empty and `libs/ui/` has one component, so every route ships its own buttons/badges/cards/fields. The TUI dashboard makes clear the theme needs to override **layout primitives** (grid, container, density), not just tokens.
- The legacy `/reps/session` flow is still the primary rep entry point (dashboard CTA links there) and still has client-only state — so refresh mid-rep-session still loses progress there even though `/sessions/[id]` solved the pattern.
- No identity/logout in the app chrome across 11 routes.
- Create-then-redirect flows (reps/new, plans/new) give no success feedback; memory/new established the `?created=` banner pattern but it hasn't propagated.
- Calibration filled-state is diagnostic-only (no "do X about it" actions). The session summary's "Suggested next" is read-only text rather than actionable CTAs — same pattern, same problem.
- Knowledge /learn page scaffolds 7 phases but doesn't track per-phase completion state, and the "discovery-first" (WHY → derive → regulation) structure lives in authored markdown, not enforced by the page shell.

## Issues

### CRITICAL: Legacy `/reps/session` loses progress on refresh (newer pattern already exists at `/sessions/[id]`)

- **File**: [apps/study/src/routes/(app)/reps/session/+page.svelte](apps/study/src/routes/(app)/reps/session/+page.svelte)
- **Problem**: `/reps/session` is still the primary rep-session entry point — dashboard CtaPanel, ScheduledRepsPanel, reps index, and calibration page all link there. The batch is loaded into local `$state`; refresh, tab-close, or laptop-sleep loses the queue and any unsubmitted answers. The URL `?s=` preserves only the shuffle seed.
- **Expected**: Refresh mid-session resumes at the next unanswered scenario. The newer `/sessions/[id]` flow already does this — current slot is derived server-side as "first unresolved slot," so refresh naturally continues.
- **Fix**: Port the server-derived pattern from `/sessions/[id]` to `/reps/session`. Server returns attempts-so-far + next unanswered; client is thin. OR (lower effort): deprecate `/reps/session` and route `REPS_SESSION` through the plan/session pipeline, using `mode=reps` on the session. The second option removes a divergent flow entirely.

### MAJOR: `libs/themes/` is empty; `libs/ui/` has one component — needs dual-mode theme system

- **File**: [libs/themes/index.ts](libs/themes/index.ts), [libs/ui/src/index.ts](libs/ui/src/index.ts)
- **Problem**: Every page file defines its own buttons, badges, cards, form fields, and error banners with hardcoded hex colors. Two themes coexist today inside one "style": the normal reading-column web layout on 10 routes, and the TUI-style dense grid on dashboard (monospace, 2px corners, full-bleed 12-col grid, 0.5rem gaps, uppercase headers). The +layout.svelte already conditionally flips `full-bleed` based on route — so the two-theme direction is already proven, just not codified.
- **Expected**: A theme system rich enough to override **tokens (colors, fonts, spacing, radii, shadows), typography scale, AND layout primitives (container behavior, grid gaps, panel padding, density, corner-radius, letter-spacing rules)**. Two named themes: `web` (default, rounded, readable, reading-column) and `tui` (dense, monospace, 2px, full-bleed). Theme selection per-route via layout data or `data-theme` attribute on a theme provider. Most routes render `web`; dashboards and other instrument-dense surfaces opt into `tui`.
- **Fix**: See dispatch plan below. Core primitives in `libs/ui` minimum: `<ThemeProvider>`, `Button`, `Badge`, `Card`/`PanelShell`, `TextField`, `Select`, `Banner`, `StatTile`, `KbdHint`, `ConfirmAction`. Tokens as CSS custom properties scoped under `[data-theme="web"]` and `[data-theme="tui"]`. Layout-overrides as theme-scoped CSS too (not just colors).

### MAJOR: No logout control in the app chrome

- **File**: [apps/study/src/routes/(app)/+layout.svelte](apps/study/src/routes/(app)/+layout.svelte)
- **Problem**: The nav shows Dashboard / Memory / Reps / Calibration and nothing else. No user identity, no logout, no settings. A logout form action exists at [/(app)/logout](apps/study/src/routes/(app)/logout/+page.server.ts) but no UI surfaces it. A user who signs in on a shared machine has no visible way to sign out short of clearing cookies or typing the URL. For an app that will eventually hold personal review history and calibration data, this is not optional.
- **Expected**: Identity anchor in the top-right of the nav (email or name), with at minimum a logout control. Menu can be as simple as a details/summary or a small dropdown.
- **Fix**: Add a user menu to the right side of the nav bar. Data is already loaded (`requireAuth` in every `+page.server.ts` returns a user). Use `<form method="POST" action="/logout">` so it works without JS.

### MAJOR: Create-then-redirect path gives no success confirmation (New scenario)

- **File**: [apps/study/src/routes/(app)/reps/new/+page.server.ts](apps/study/src/routes/(app)/reps/new/+page.server.ts)
- **Problem**: On successful save, the server does `redirect(303, REPS_BROWSE)`. The user lands on the browse list with no banner, toast, or highlight of the just-created scenario. They have to trust that their work was saved because "the page changed." Contrast with the memory `new` flow which *does* have a "Card saved" banner via `?created=` query param — that pattern isn't applied here.
- **Expected**: The browse page shows a success banner ("Scenario 'Engine failure on takeoff' saved") when arriving from a successful create, and ideally highlights/anchors the new item.
- **Fix**: Mirror the memory flow. Redirect to `REPS_BROWSE?created={id}`, render a banner on browse when `created` is present, and scroll-anchor to the matching row. Same pattern applies to any future create-then-redirect flow — make this a convention.

### MAJOR: Review rating mistakes have no undo

- **File**: [apps/study/src/routes/(app)/memory/review/+page.svelte](apps/study/src/routes/(app)/memory/review/+page.svelte)
- **Problem**: Rating buttons (Again/Hard/Good/Easy) submit instantly on click. There's no hold-to-confirm, no 2-second "undo" toast, and no "you rated this Easy — oops, undo?" after the fact. The keyboard shortcut is `1`/`a`/etc., so a stray keypress one off (hitting `2` instead of `3`) silently mis-schedules the next review. For an SRS where the whole point is scheduling signal quality, a wrong rating is a corruption of the learning signal.
- **Expected**: After rating, a brief "Rated Good — undo" affordance (2–3 seconds) before the next card appears, OR a preview of "next due: X days" with a confirm step. At minimum, a way to go back one card within the current session.
- **Fix**: Add a 2-second "Rated {rating} — undo" toast/inline banner that keeps the submit request pending (or rolls it back on undo) before advancing. The server already handles idempotent / out-of-order writes cleanly enough that rollback is viable.

### MAJOR: Native `confirm()` is the only confirmation pattern

- **File**: [apps/study/src/routes/(app)/memory/[id]/+page.svelte](apps/study/src/routes/(app)/memory/%5Bid%5D/+page.svelte) (Archive)
- **Problem**: Native `confirm()` can't show context ("this card has 47 reviews"), can't be styled, can't be keyboard-navigated consistently with the rest of the app, and creates inconsistency the moment a second destructive action is added. Suspend doesn't confirm; Archive does — that asymmetry is hard to justify and harder to remember.
- **Expected**: A `<ConfirmButton>` or `<ConfirmAction>` primitive in `libs/ui` that handles inline reveal ("Archive? [Confirm] [Cancel]") or a shared modal.
- **Fix**: Build the primitive, migrate Archive, and establish the rule for all future destructive actions. Decide deliberately which actions need confirmation (Archive: yes; Suspend: probably no; Reactivate: no).

### MAJOR: Calibration filled-state is a dashboard with no "what do I do next"

- **File**: [apps/study/src/routes/(app)/calibration/+page.svelte](apps/study/src/routes/(app)/calibration/+page.svelte)
- **Problem**: The empty state is pedagogically strong (explains calibration, gives two CTAs: Start a review / Start a rep session). Once data exists, the page becomes a read-only dashboard. You see "Overconfident by 18%" on confidence level 4 — and... nothing. No "here's what to do about it," no "practice these weak domains," no link to a filtered review queue. The app's own design principles say "discovery-first," but here we're giving the learner a diagnosis with no treatment plan.
- **Expected**: Each gap has an action. "Overconfident at level 4 in Weather → start a Weather-filtered rep session" or "Underconfident in Regs → review these 12 cards you've been rating low confidence on despite getting right."
- **Fix**: For each domain row with a significant gap, link to a pre-filtered review/rep session scoped to that domain. For each confidence level with a gap, a one-line interpretation plus a "practice this" CTA. Short term: even adding the two buttons from the empty state to the filled state as persistent footer CTAs would close the loop.

### MAJOR: Calibration page doesn't explain what calibration *is* once you have data

- **File**: [apps/study/src/routes/(app)/calibration/+page.svelte](apps/study/src/routes/(app)/calibration/+page.svelte)
- **Problem**: New user lands on the page after doing enough reviews, sees "Calibration: 0.73" and has no idea what that number means. The empty state explained it ("confidence matches accuracy"); once you have data, that explanation disappears. The scale legend "1.00 = perfect; 0.00 = maximally miscalibrated" is technically correct but doesn't teach. A returning CFI who's earned the score deserves to be shown the *pattern* behind it ("your confidence at level 5 is calibrated, but you're overconfident at level 3 — meaning when you feel kinda-sure, you should feel less-sure").
- **Expected**: A short, always-visible "what is this?" block or a per-section narrative interpretation.
- **Fix**: Add a one-sentence narrative summary above the buckets: "You're reliable when confident (level 5), but level-3 guesses go wrong more than you expect — trust your gut less when it's only *kinda* sure." Generated from the gap data.

### MAJOR: Browse filter state doesn't show what's filtered at a glance

- **File**: [apps/study/src/routes/(app)/memory/browse/+page.svelte](apps/study/src/routes/(app)/memory/browse/+page.svelte), [apps/study/src/routes/(app)/reps/browse/+page.svelte](apps/study/src/routes/(app)/reps/browse/+page.svelte)
- **Problem**: Once filters are applied, the only indication is that the select dropdowns hold values. No pill chips ("Domain: Weather ×"), no count of active filters, no visible summary of the current view. When a user comes back via a bookmarked URL, they scan the page trying to figure out why the list looks sparse.
- **Expected**: Active filter chips above the results list, each removable with an ×. Shows "Showing 7 of 43 cards matching: Domain: Weather, Status: Active."
- **Fix**: Render filter chips from the `filters` prop, each chip being a link that rebuilds the query string without that filter. Add a count summary.

### MAJOR: Memory domain links are inconsistent across pages

- **File**: [apps/study/src/routes/(app)/memory/+page.svelte](apps/study/src/routes/(app)/memory/+page.svelte) (domains are clickable), [apps/study/src/routes/(app)/memory/browse/+page.svelte](apps/study/src/routes/(app)/memory/browse/+page.svelte) (domain badges on cards are NOT clickable)
- **Problem**: On the memory dashboard, domain names link to browse filtered by that domain. On the browse page itself, the domain badge shown on each card is a visual tag that isn't clickable — so you can't click it to filter by the same domain. Users learn the first behavior, try it on browse, and nothing happens.
- **Expected**: Consistent behavior — domain badges are links anywhere they appear, or they're never links.
- **Fix**: Make domain badges clickable filters on browse. Apply the same rule to reps. Pick once, apply everywhere.

### MINOR: No in-app navigation shows "you are here" at more than one level

- **File**: [apps/study/src/routes/(app)/+layout.svelte](apps/study/src/routes/(app)/+layout.svelte) and children
- **Problem**: The top nav shows the top-level section (Memory, Reps, etc.) but inside, say, `/memory/[id]`, there's no breadcrumb. You see "← Browse" as a text link at the top of the detail page, but that's a local convention, not a system. Deeper flows won't scale.
- **Expected**: A breadcrumb component (or structured back affordance) that shows Memory › Browse › "Card detail" — reads top-down, clickable at each level.
- **Fix**: Add a simple breadcrumb primitive to `libs/ui`. Not urgent, but will pay off as routes grow.

### MINOR: Dashboard h1 is "Learning Dashboard" but the section is "Dashboard"

- **File**: [apps/study/src/routes/(app)/dashboard/+page.svelte](apps/study/src/routes/(app)/dashboard/+page.svelte)
- **Problem**: The top nav says "Dashboard" and the page heading says "Learning Dashboard." Minor but easy to fix. VOCABULARY.md should decide which one.
- **Expected**: One name for the concept.
- **Fix**: Pick one and apply both places. "Dashboard" is fine; "Learning Dashboard" implies there'll be other dashboards (which, per MULTI_PRODUCT_ARCHITECTURE.md, is actually true — so maybe the long form is intentional; either way, align).

### MINOR: Stat tiles are not clickable

- **File**: [apps/study/src/routes/(app)/memory/+page.svelte](apps/study/src/routes/(app)/memory/+page.svelte), [apps/study/src/routes/(app)/reps/+page.svelte](apps/study/src/routes/(app)/reps/+page.svelte)
- **Problem**: "Due now: 12" / "Unattempted: 47" / "Reviewed today: 8" are displayed as static text. The obvious next action after seeing "12 due now" is to start the review — but the tile itself isn't clickable. User has to scroll up to the action row. Minor friction that compounds.
- **Expected**: Stat tiles that represent an actionable set should be links (or wrap the count in a link). "12 due now" → clicking goes to `/memory/review`. "47 unattempted" → goes to `/reps/browse?status=unattempted` (or similar).
- **Fix**: Wrap actionable counts in links. Leave purely-descriptive ones (Streak, Accuracy 30d) non-clickable.

### MINOR: Confidence slider skip is a ghost button, same weight as rating

- **File**: [libs/ui/src/components/ConfidenceSlider.svelte](libs/ui/src/components/ConfidenceSlider.svelte)
- **Problem**: The 1–5 buttons and the "Skip confidence" button are visually parallel. Skip is a ghost, but it lives right below the row of rating buttons with similar padding. A hurried user will blow through the confidence step by default, weakening the calibration signal the app depends on.
- **Expected**: Skip should feel like an escape hatch, not a peer option. Smaller, text-only, with a hint that skipping means "I'll stop tracking calibration for this card."
- **Fix**: Reduce skip to small text-link appearance. Consider making Escape the documented skip (it already is in the session flow) and dropping the button entirely on desktop.

### MINOR: Empty state copy doesn't differentiate "no cards due" from "queue just completed"

- **File**: [apps/study/src/routes/(app)/memory/review/+page.svelte](apps/study/src/routes/(app)/memory/review/+page.svelte)
- **Problem**: "All caught up." is shown both when the user finishes a review session AND when they land on the page with nothing due. The nested "No cards due right now" message handles the second case, but the primary heading is identical. The experience "I just did 20 cards" and "there's nothing for me to do" should feel different.
- **Expected**: Two distinct headings. After a session: "Session complete — 20 reviewed." Landing on empty: "You're caught up."
- **Fix**: Branch the heading based on whether `tally.total > 0`.

### MINOR: Reps session confidence prompt is invisible when not shown

- **File**: [apps/study/src/routes/(app)/reps/session/+page.svelte](apps/study/src/routes/(app)/reps/session/+page.svelte)
- **Problem**: Confidence prompting is deterministic-sampled (50% of cards, seeded by ID+date). Users have no way to know when they'll be prompted or why. It can feel random or broken ("why did it ask me that time but not this time?"). This hurts trust in a feature whose value is learner trust.
- **Expected**: Either a subtle indicator ("Confidence check" badge on the scenario header when prompted), or an explanation surface somewhere (settings / help) that makes the sampling predictable.
- **Fix**: Add a tiny badge or section label on the scenario header when confidence is being requested. And link "Why am I sometimes asked about confidence?" to a one-paragraph explanation.

### MINOR: New card form Cmd+Enter submits, Enter does not — undocumented

- **File**: [apps/study/src/routes/(app)/memory/new/+page.svelte](apps/study/src/routes/(app)/memory/new/+page.svelte)
- **Problem**: The form binds Cmd/Ctrl+Enter to submit, which is a great power-user shortcut. It's not documented on the page. Users who'd benefit most won't discover it.
- **Expected**: A small hint near the Save button ("⌘ Enter to save") or a keyboard shortcuts help dialog.
- **Fix**: Add a kbd hint next to the Save button, styled like the ones in the review flow.

### MINOR: Cancel on New card just navigates away — no confirm if form is dirty

- **File**: [apps/study/src/routes/(app)/memory/new/+page.svelte](apps/study/src/routes/(app)/memory/new/+page.svelte), [apps/study/src/routes/(app)/reps/new/+page.svelte](apps/study/src/routes/(app)/reps/new/+page.svelte)
- **Problem**: User types a full card front/back, accidentally clicks Cancel (or hits back), input is gone. No `beforeunload` prompt, no "discard unsaved changes?" modal.
- **Expected**: If the form is dirty and the user attempts to navigate away, prompt.
- **Fix**: Track a `dirty` flag, wire `beforeunload`, and intercept Cancel with an in-app confirm once the UI primitive exists.

### MINOR: Pagination shows page number but not total

- **File**: [apps/study/src/routes/(app)/memory/browse/+page.svelte](apps/study/src/routes/(app)/memory/browse/+page.svelte), [apps/study/src/routes/(app)/reps/browse/+page.svelte](apps/study/src/routes/(app)/reps/browse/+page.svelte)
- **Problem**: "Page 2" with Previous / Next — no "of 7" to orient. The server fetches one extra item to know if there's a next page, which is fine for "is there more" but not for "how much more."
- **Expected**: "Page 2 of 7" or at minimum "Showing 21–40 of 137."
- **Fix**: Add a `total` count to the server load (cheap count query) and surface it. If total is expensive, fall back to "Showing 21–40 results."

### MINOR: Tags field on new card has no validation or preview

- **File**: [apps/study/src/routes/(app)/memory/new/+page.svelte](apps/study/src/routes/(app)/memory/new/+page.svelte)
- **Problem**: Hint says "comma-separated, optional" but nothing shows how they'll be parsed, trimmed, lowercased, deduplicated, etc. User types `Weather, weather, WEATHER` and doesn't know if those are three tags or one.
- **Expected**: Live preview of the parsed tags as chips below the field as the user types.
- **Fix**: Parse on input, render as chip preview. Makes the rule visible.

### MINOR: Error messages use "Please try again" — low information

- **File**: Multiple (e.g. [apps/study/src/routes/(app)/memory/new/+page.server.ts](apps/study/src/routes/(app)/memory/new/+page.server.ts), [reps/new](apps/study/src/routes/(app)/reps/new/+page.server.ts))
- **Problem**: "Could not save the card. Please try again." is the fallback for 500 errors. It tells the user nothing — was it network? server? will it work in 5 seconds? The app quietly logs the real error with a requestId; the user never sees the requestId.
- **Expected**: Generic message + a short reference ("Ref: 1a2b3c4d") that the user can copy if they ask for help. Ideally differentiate network vs server errors.
- **Fix**: Surface the requestId in the user-visible error. "Something went wrong saving that card. Try again, or report ref 1a2b3c4d if it keeps failing."

### MINOR: Color-only encoding on calibration buckets

- **File**: [apps/study/src/routes/(app)/calibration/+page.svelte](apps/study/src/routes/(app)/calibration/+page.svelte)
- **Problem**: Buckets are background-colored green/red/yellow to signal well-calibrated / overconfident / underconfident. Text labels back it up, but the visual scan relies on color alone. Protanopia/deuteranopia users lose the at-a-glance signal.
- **Expected**: Pair color with icon or text treatment (✓ for well-calibrated, ↑ for overconfident, ↓ for underconfident) that survives in monochrome.
- **Fix**: Add small inline icons next to bucket labels. Use shape, not just hue.

### MINOR: Login dev-accounts section is a noisy UI in dev but zero affordance in prod

- **File**: [apps/study/src/routes/login/+page.svelte](apps/study/src/routes/login/+page.svelte)
- **Problem**: In dev, a list of seeded accounts + shared password is rendered. Useful. In production, the login page has no signup path, no forgot-password, no "contact support." A first-time prod user has nowhere to go if they don't already have an account. Probably intentional for now (closed alpha), but worth flagging.
- **Expected**: Either a signup CTA, a "request access" link, or explicit text that this is invite-only.
- **Fix**: Add a small line below the form: "Airboss is currently invite-only. Request access at ..." or similar, shown in non-dev.

### NIT: "Back to dashboard" / "← Browse" / Cancel-go-to-X inconsistency

- **File**: multiple
- **Problem**: Memory review complete uses "Back to dashboard" button. Memory [id] uses "← Browse" text link. Memory new Cancel button goes to `/memory` but Back link goes to `/memory/browse`. Reps new Cancel goes to `/reps`. There's a pattern struggling to emerge — it isn't consistent yet.
- **Expected**: A single back/cancel convention per context. Back from a detail page goes to the list; Cancel from a create form goes to wherever the user came from (or the list as a sane default).
- **Fix**: Document the rule in DESIGN_PRINCIPLES.md once libs/ui has navigation primitives.

### NIT: "Browse" is overloaded — list view vs the button

- **File**: multiple
- **Problem**: "Browse" is used as (a) a route name for the list page, (b) a button label, and (c) a back-link target. It's consistent but the word "browse" is soft — "View all" or "Library" might communicate "this is your stored deck" better. VOCABULARY.md territory.
- **Expected**: Name chosen deliberately with a VOCABULARY.md entry.
- **Fix**: Review the term with VOCABULARY.md.

### NIT: Mobile — nav isn't responsive

- **File**: [apps/study/src/routes/(app)/+layout.svelte](apps/study/src/routes/(app)/+layout.svelte)
- **Problem**: The top nav shows four links in a single row always. Works fine at desktop widths. On a narrow phone it'll wrap or require horizontal scroll depending on font rendering. No hamburger, no bottom tab bar.
- **Expected**: Either (a) the nav is designed to always fit on the smallest target, or (b) a mobile variant exists. Currently it's "works until it doesn't." CLAUDE.md doesn't commit to mobile as a first-class target for study app, but a pilot reviewing cards on their phone between legs is a completely plausible use case.
- **Fix**: Decide the target viewports. If mobile is in, add a mobile-first nav pattern. If not, document the desktop-only scope.

### NIT: `data-app-id="study"` on `<html>` is unused

- **File**: [apps/study/src/app.html](apps/study/src/app.html)
- **Problem**: Probably intended as a hook for app-specific styling once `libs/themes` is real. Currently it's a pointer to a plan that hasn't landed.
- **Expected**: Either use it (to scope `libs/themes` CSS to the right app surface) or remove it.
- **Fix**: Keep — but fill in the theme layer that makes it meaningful.

### NIT: `<hr />` between card front and back in review

- **File**: [apps/study/src/routes/(app)/memory/review/+page.svelte](apps/study/src/routes/(app)/memory/review/+page.svelte)
- **Problem**: A dashed `<hr />` separates front and back. It's the right shape, but `<hr>` is thematic-break semantically. Front-to-back is a logical relationship, not a topic shift. A styled `<div role="separator">` or just a border-top on the back block reads more cleanly.
- **Expected**: Semantic separator or structural block.
- **Fix**: Optional — replace or leave. It's a nit.

---

## Issues from refresh pass (new routes / refactored dashboard)

### MAJOR: `/plans/new` redirects silently on success

- **File**: [apps/study/src/routes/(app)/plans/new/+page.server.ts](apps/study/src/routes/(app)/plans/new/+page.server.ts)
- **Problem**: Create a plan → 303 redirect to `/plans/[id]`. Plan detail has no "created!" banner; user has to infer success from "the URL changed." Same pattern as the scenario-create finding. Memory's `?created=` banner is the solution not yet propagated.
- **Expected**: Detail page shows "Plan created." banner on arrival from a successful create.
- **Fix**: Rolled into the create-feedback convention workstream.

### MAJOR: Session summary's "Suggested next" is read-only prose

- **File**: [apps/study/src/routes/(app)/sessions/[id]/summary/+page.svelte](apps/study/src/routes/(app)/sessions/%5Bid%5D/summary/+page.svelte)
- **Problem**: After a session, summary shows "Suggested next" as an unordered list of hint strings — not links, not buttons. Same symptom as calibration: diagnosis with no treatment. User has to read the hint, parse it, and manually navigate.
- **Expected**: Each suggestion is a button or link that takes the user directly to the action.
- **Fix**: Rolled into the calibration-CTAs workstream (same pattern: gap → action, hint → action).

### MAJOR: `/knowledge/[slug]/learn` has no completion tracking per phase

- **File**: [apps/study/src/routes/(app)/knowledge/[slug]/learn/+page.svelte](apps/study/src/routes/(app)/knowledge/%5Bslug%5D/learn/+page.svelte)
- **Problem**: 7-phase stepper shows which phase you're on (aria-current) and which phases are authored vs. skeleton, but not which ones you've completed or even visited. User returning to a node a week later has no signal about progress. Last phase swaps the Next button for "Review cards for this node" — fine — but there's no persisted "you finished this node on DATE" anywhere. Mastery exists (card-gate + rep-gate) but isn't tied to learn-phase progress.
- **Expected**: Step buttons show visited/complete state. A `data-phase-completed` persisted signal at minimum. Even just session-scoped state (this visit, phases you clicked through) would help.
- **Fix**: Low-priority if mastery is the durable progress metric — but at minimum, visually mark visited phases in the stepper.

### MAJOR: Skip "permanent" has no confirmation in `/sessions/[id]`

- **File**: [apps/study/src/routes/(app)/sessions/[id]/+page.svelte](apps/study/src/routes/(app)/sessions/%5Bid%5D/+page.svelte)
- **Problem**: Skip row offers "Skip today" and "Skip permanently" as peer links. "Permanently" is a non-reversible-without-admin decision (it adds the node/card/rep to skip set on the plan). No confirm, no "you can re-enable from plan detail" nudge. Fat-finger hazard directly below the rating buttons.
- **Expected**: Confirm flow (inline reveal or modal) plus a "reactivate from Plan detail" breadcrumb.
- **Fix**: Requires the ConfirmAction primitive. Rolled into the design-system workstream as a blocker dependency.

### MINOR: Dashboard nav doesn't show which section you're in when panels deep-link you there

- **File**: [apps/study/src/routes/(app)/+layout.svelte](apps/study/src/routes/(app)/+layout.svelte)
- **Problem**: Dashboard DueReviewsPanel and ScheduledRepsPanel deep-link to `/memory/browse?domain=X` and `/reps/browse?domain=X`. Nav's aria-current correctly flips to Memory/Reps, but the deep-linked filter isn't signaled anywhere. User clicks "Weather: 7 due" on the dashboard, lands on browse with the domain filter pre-applied, and has to read the select dropdown to confirm what they filtered to.
- **Expected**: Filter chips above the list (the existing "show active filters" finding solves this too).
- **Fix**: Folded into the create-feedback workstream (which also owns filter-chip visibility).

### MINOR: `/plans/[id]` has a success toast, other edit flows don't

- **File**: [apps/study/src/routes/(app)/plans/[id]/+page.svelte](apps/study/src/routes/(app)/plans/%5Bid%5D/+page.svelte)
- **Problem**: Plan edit returns `{ success: true }` which renders a toast (role="status"). Memory card edit (`/memory/[id]`) redirects back to self without a banner. Inconsistent edit-success pattern — same app, two conventions.
- **Expected**: One edit-success pattern: either "toast on same page" or "redirect with `?updated=1` banner."
- **Fix**: Pick plan's pattern (toast) since it's less disruptive on long forms. Rolled into the create-feedback workstream.

### MINOR: TUI dashboard panel actions use different sizing than their destination CTAs

- **File**: [apps/study/src/routes/(app)/dashboard/_panels/*.svelte](apps/study/src/routes/(app)/dashboard/_panels/)
- **Problem**: Panel action buttons are tight (0.25rem/0.5rem padding, 0.75rem font) to match TUI density. Clicking them lands on routes where buttons are the roomier web treatment. Transition from TUI to web is abrupt.
- **Expected**: A deliberate transition or consistent button sizing within a theme.
- **Fix**: Once theme system lands with layout overrides, this becomes a matter of theme boundary rules (dashboard surface = TUI, destination = web, link buttons style to source or destination — pick one).

### NIT: `/knowledge` filter form doesn't show loading state between submit and result

- **File**: [apps/study/src/routes/(app)/knowledge/+page.svelte](apps/study/src/routes/(app)/knowledge/+page.svelte)
- **Problem**: GET-form navigation works but there's no visual hint between click and load on slower connections.
- **Expected**: Native browser loading is usually enough for GET; consider a subtle skeleton only if it ships poorly on devices. Skip for now.
- **Fix**: Don't bother unless complaints surface.

### NIT: `/session/start` preview "short" warning is quiet

- **File**: [apps/study/src/routes/(app)/session/start/+page.svelte](apps/study/src/routes/(app)/session/start/+page.svelte)
- **Problem**: If preview can't fill the plan's session length, a note appears — currently small text near the preview list. User reading fast hits "Start session" and gets fewer items than expected.
- **Expected**: Warning more prominent: banner-style above the preview, explaining "We could only prepare 4 of your 10-slot session. Create more X / Y / Z or start anyway."
- **Fix**: Upgrade visual weight.

---

## Cross-cutting recommendations (revised)

1. **Stand up `libs/ui` + `libs/themes` as a dual-theme system.** Tokens + layout primitives, not just colors. Two named themes: `web` (default, reading-column, rounded, normal type) and `tui` (dense, full-bleed grid, monospace, 2px corners). Theme scope per-route via layout data. Every primitive component reads from CSS custom properties scoped by `data-theme`. This is the biggest lever and it blocks several other fixes (ConfirmAction, KbdHint, StatTile, Banner).
2. **Establish the create/edit success pattern once.** `?created={id}` / `?updated=1` banner convention for redirects; role="status" toast for stay-on-page edits. Document in DESIGN_PRINCIPLES.md.
3. **Port server-derived session pattern to `/reps/session`** OR **route rep-sessions through the unified session pipeline**. Either is correct. Don't leave two session models.
4. **Identity anchor in nav.** Non-negotiable before any external user touches this.
5. **Make diagnostic surfaces actionable.** Calibration gaps and session-summary suggestions are the same pattern: data without action. Link each gap/suggestion to a pre-filtered session or review queue.

---

## Dispatch plan (5 worktree agents in parallel)

1. **Design system (tokens + primitives + dual themes)** — `libs/themes/`, `libs/ui/`, one migration target (login) to prove shape. Changes pure library code + one route for validation; other workstreams consume.
2. **Nav identity + logout** — `apps/study/src/routes/(app)/+layout.svelte` only. Tiny surface, no overlap with other agents.
3. **`/reps/session` server-derived resume** — `apps/study/src/routes/(app)/reps/session/*` only. Touches rep-session BC if needed but isolated.
4. **Create/edit success feedback convention** — memory/new, reps/new, plans/new, plans/[id] detail pages. Applies the banner pattern. Also adds filter-chip visibility to memory/browse + reps/browse as the same "make current state visible" pattern.
5. **Diagnostic → action: calibration + session summary** — `apps/study/src/routes/(app)/calibration/*` + `apps/study/src/routes/(app)/sessions/[id]/summary/*`. Gap rows and suggestion strings become links to pre-filtered reviews/reps.

File-overlap check: (1) library-only + one route (login); (2) layout.svelte only; (3) reps/session only; (4) memory+reps+plans create/edit pages + browse pages; (5) calibration + session summary. No overlap.
