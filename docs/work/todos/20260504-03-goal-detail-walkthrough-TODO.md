# Goal detail walkthrough -- UX punch list

Captured 2026-05-04 while Joshua walked through creating his first PPL goal.
Source URL: `https://study.airboss.test/goals/goal_01kqtrwpfr2126yp24stkb34fr`
Source file: [apps/study/src/routes/(app)/goals/[id]/+page.svelte](../../../apps/study/src/routes/(app)/goals/[id]/+page.svelte)

**Do not fix yet -- capture only.**

## Status bar / header actions

- The red `[Archive]` button looks out of place next to ghost `Pause` / `Mark complete`. It's a `variant="danger"` (line 109). Pause and Mark complete are ghost. Archive should not scream.
- Lifecycle actions (Make primary / Pause / Mark complete / Archive) currently sit in a `.status-bar` row *below* the header, while `Edit` lives in the `PageHeader` actions snippet (top-right).
  - Joshua wants all lifecycle actions to the **left of Edit**, in the header actions slot. Not in a separate bar below.

## Syllabi block

- **Lookup / discovery in the dropdown.** Currently a bare `<select>` with `{credentialTitle} -- {syllabusTitle}` text. No way to see what each syllabus actually is before adding. Need either:
  - searchable combobox, OR
  - link/preview to the syllabus detail page next to each option, OR
  - browse/picker modal that shows syllabus content (areas/tasks) before commit.
- **Naming: "Private Pilot -- Private Pilot -- Airplane Airman Certification Standards".** Two "Private Pilot"s. Comes from `{credentialTitle} -- {syllabusTitle}` (line 158 of `+page.svelte`). The credential is named "Private Pilot" and the syllabus is named "Private Pilot -- Airplane Airman Certification Standards". Need to dedupe -- either rename the syllabus row in seeds, or build the label so the credential prefix isn't repeated when the syllabus title already starts with it.
- **Visual offset in the dropdown** (see screenshot): the selected option text appears shifted/cropped vs the options below. Investigate select styling -- `.add-form` flex with `align-items: flex-end` plus the inline label on the select may be causing the misalignment.
- **Selected syllabus row appears blue (link-styled) but isn't a link.** `.row-title` uses `color: var(--action-link)` and `font-weight-semibold` (line 358-361) but the syllabus row renders a `<span>`, not an `<a>`. Either: (a) make it a link to the syllabus detail page, or (b) drop the link styling for non-link rows. Joshua's first instinct is the link.
- **Multiple syllabi -- supported in BC, hidden by UI.** The data model and the actions allow many (`addGoalSyllabus`, `availableSyllabi` is a list). UI hides the add form entirely when only one credential's primary syllabus exists for the user. Joshua noticed there's no visible "Add" affordance until you happen to have >1 available, and the add form *only* renders if `availableSyllabi.length > 0` (line 152). Decision: should we always render the add affordance (with empty-state messaging when nothing's available), so the capability is discoverable?

## Knowledge nodes block

- Works once added. Same discovery problem as syllabi -- you can't preview a node before adding it. Need a link to the node detail page from each option (or from the "available" list) before commit.

## Bigger structural rethink (Joshua's suggestion)

> "Maybe we should rethink this? have collapsable panels instead? With grouped cards for them? with links to see?"

Worth exploring:

- Two collapsible panels -- Syllabi, Knowledge nodes -- each opening to show a card grid of what's currently attached + a "browse to add" affordance.
- Each card links to the underlying detail (syllabus page, node page) for preview without commit.
- "Add" becomes a picker modal instead of an inline `<select>`, with search + preview links.

## "I have a study plan -- now what?"

This is the big one. After attaching syllabi/nodes there is no "save" / "start" / "begin studying" CTA. Joshua doesn't know what to do next. Two questions to resolve:

1. **Should there be an explicit start button at the bottom?** ("Start studying" -> pushes goal to ACTIVE primary, jumps to the study session route.) Or is the act of making it primary + having syllabi attached enough?
2. **What's the actual next surface?** From a populated goal, where should `Start studying` route to -- `/study`? a daily session route? the first leaf of the first syllabus? the highest-weight knowledge node?

Need to design the goal -> first session handoff. Right now the goal page is a configurator with no exit ramp.

## Answers Joshua asked for inline (not actions, just clarifications)

- **Why two "Private Pilot"s?** Label is built as `${credentialTitle} -- ${syllabusTitle}` and the seeded syllabus title already starts with "Private Pilot". Dedup the label or rename the seed.
- **Can you add multiple syllabi?** Yes -- BC supports it (`addGoalSyllabus` runs per-syllabus, `availableSyllabi` is a list). UI just hides the form when there's nothing left to add. Once you have more than one credential with a primary syllabus, the dropdown will list them and you can add as many as you want. The "Add" button is per-form; there's no separate "+" because the form itself is the add.
- **Why does the syllabus row look like a link?** `.row-title` is styled with link color + bold even when rendered as a `<span>`. Bug.
- **What now?** No designed answer yet. The goal page ends the flow; the next step (start a session, see daily reps) is not wired into this page. Open question above.

## Walkthrough cont'd -- /study dashboard, Read tile, Cards tile, error UX

### "I started in /study, now I'm in /goals -- what's up there?"

Captured: the goal-create flow leaves you on the goal detail page with no clear "back to where I was" affordance. The breadcrumb only goes Goals -> {goal} (line 38), not Study -> Goals -> {goal}. Joshua didn't know how to get back to study. Open question: should the goal-detail breadcrumb root at `/study` instead, or should there be a "Back to study" CTA after creation?

### /study dashboard has no call to action

The five-tile entry row ([apps/study/src/routes/(app)/study/_panels/TilesPanel.svelte](../../../apps/study/src/routes/(app)/study/_panels/TilesPanel.svelte)) is "equal weight by design (no primary CTA)" -- explicitly documented in the file header comment. The tiles are: Read, Cards, Sim, Scenarios, Flight. Joshua's reaction: there is no obvious next step. This was a deliberate design choice (let the user pick the surface) but it lands as "now what?" for a brand-new user who just built a goal.

Open question: does the brand-new-user path need a CTA ("Start with cards" / "Read the handbook to begin") that fades once the user has an established cadence? Five equal tiles is right for the steady state, wrong for first-run.

### Read tile -> /library shows ALL references

`Read | Open handbook` -> `ROUTES.LIBRARY` -> the flightbag library showing every reference. Joshua expected something specific to **his** active goal (PPL syllabus -> the relevant handbook sections). Instead it dumps the full library.

Open question: should `Read` from the dashboard be filtered by primary goal -- e.g., the syllabus's recommended reading, the handbook sections referenced by leaves on the active goal? Or scoped to "what I'm working on this week"?

### Cards tile -> /memory/review -> 500

`Cards | 6 due` -> `ROUTES.MEMORY_REVIEW` -> 500. The 500 doesn't appear in the logs. The `/memory/review` load function is read-only and renders a "Start review?" prompt; the action `fresh` mints the session ([apps/study/src/routes/(app)/memory/review/+page.server.ts:1-50](../../../apps/study/src/routes/(app)/memory/review/+page.server.ts#L1-L50)). The 500 is happening somewhere in load -- likely a downstream call (`abandonStaleSessions`, `findResumableSessionByDeckHash`, deck-spec decode, or one of the imported BC helpers).

To investigate: tail bun dev logs while clicking the tile, OR add a try/catch in load that surfaces the underlying error to the +error.svelte boundary. Right now SvelteKit's prod-style error masking is hiding it.

### Error visibility (the bigger ask)

> "we need much more detail in the app when an error happens. it should give us deeper exception info and the log (this should be configurable, in localhost and .test domains. And even then configurable. so it can be nice errors for users and details for devs (maybe for now, just a detail button that can be removed later?"

Capture as a platform task. The shape:

- `+error.svelte` (and any other error boundaries) should branch on host:
  - `localhost` / `*.test` / `*.airboss.test` -> dev mode: show the full error message, stack, and any captured server log lines.
  - production -> friendly message only.
- Even in dev, gate behind a toggle (env var or per-page flag) so we can A/B the user-facing message during demos.
- Interim shape: a `[Show details]` button that expands the technical block. Easy to remove later.
- Server-side: 500s are not currently being written where Joshua can see them. Confirm where bun dev's stderr/log is going and whether we have an unhandled-error logger in `hooks.server.ts`. If not, add one.

This is the second time error opacity has bitten the walkthrough -- worth treating as a real platform deliverable, not an inline fix.

### Returning lands on /dashboard, not /study

Joshua: "Now i went back to dashboard? rather than study? strange."

Two things to disentangle:

- The header has a `Stats` link that goes to `ROUTES.DASHBOARD = '/dashboard'` ([libs/constants/src/routes.ts:643](../../../libs/constants/src/routes.ts#L643)). It's labelled "Stats" but the route is `/dashboard` -- the URL contradicts the label.
- After some action (creating a goal? hitting /memory/review and bouncing back?) Joshua landed on /dashboard instead of /study. Need to figure out which redirect did this -- candidates: the goal-create redirect, the +error.svelte fallback, or a back-button quirk after the 500.

Open question: should `/dashboard` be renamed (or merged into `/study`) to remove the surprise? They feel like overlapping concepts: /study is the entry tiles, /dashboard is the stats panel. If "Stats" is the label, maybe the route should be `/stats`. Or fold both into one home.

## Walkthrough cont'd -- /dashboard, plans vs goals, nav

### "I started a plan, why doesn't it show?"

Critical confusion: **goals and plans are different things in this codebase.** Joshua created a *goal* (`/goals/new` -> `/goals/{id}`). The dashboard's "Today" / CTA panel looks for an active *plan* via `activePlan` ([CtaPanel.svelte:9-11](../../../apps/study/src/routes/(app)/dashboard/_panels/CtaPanel.svelte#L9-L11)) and shows "Create a study plan" -> `/plans/new` when none exists. The goal Joshua created is invisible to this panel because it's a different BC entity.

This is the core IA problem of the walkthrough. See synthesis doc.

### "Review (12)" but I saw 6 before

Two different counters:

- The `/study` Cards tile shows `dueCardsCount` from the study page's own load.
- The `/dashboard` CTA panel's "Review (N)" reads `stats.dueNow` ([CtaPanel.svelte:31,52](../../../apps/study/src/routes/(app)/dashboard/_panels/CtaPanel.svelte#L31)).

Either the two queries aren't using the same cutoff (now-vs-end-of-day? include/exclude new cards?), or the deck filter differs (focus node vs all). Either way, the user sees inconsistent numbers for the same concept. Reconcile to one source of truth.

Also: the same 12-due CTA leads to the same `/memory/review` 500 captured above.

### `/plans/new` is a third surface, separate from study and goals

`/plans/new` is a totally different flow from `/goals/new`. Joshua expected it to be a refinement of the goal he just built, not a new top-level concept. The relationship between Goal -> Plan is invisible from the UI.

### Nav inconsistency: Memory is a dropdown, others aren't

In [(app)/+layout.svelte:222-279](../../../apps/study/src/routes/(app)/+layout.svelte#L222-L279):

- Top-level links: Study, Stats (=Dashboard), Plans, Credentials, Lens, Goals, Reps, Flight, Knowledge, Glossary, Calibration, Help
- Dropdowns: Memory (Home/Browse/Review/New), Help (Index/Concepts/...)

Why is Memory a dropdown but Plans/Goals/Knowledge aren't? They have at least as many sub-pages. Either everything with sub-pages becomes a dropdown, or Memory's children get flattened.

### Glossary placement

Joshua wants Glossary moved next to Flightbag (the cross-app reference link in the right cluster of [AppHeader.svelte:304-306](../../../libs/ui/src/components/AppHeader.svelte#L304-L306)). "Maybe over/under? i don't know?" Capture as a placement question, not a fixed instruction.

### Two Helps -- remove the local one

Two Help entries: a global one in `AppHeader.svelte` ([line 297](../../../libs/ui/src/components/AppHeader.svelte#L297)) and a local Help dropdown in the study layout ([line 269](../../../apps/study/src/routes/(app)/+layout.svelte#L269)). Drop the local one.

## Followups (do these later, with explicit asks)

- [ ] Recolor / replace Archive button (drop `variant="danger"`).
- [ ] Move all status-bar actions into the PageHeader actions snippet, left of Edit.
- [ ] Fix the dropdown offset / selected option styling.
- [ ] Drop link styling from non-link `.row-title` spans, or make syllabi rows real links.
- [ ] Dedupe credential/syllabus label.
- [ ] Add searchable picker + per-option preview links for syllabi and nodes.
- [ ] Decide: collapsible panels with card grid + picker modal?
- [ ] Design the goal -> first session handoff and add a Start CTA.
- [ ] Decide whether to always show the Add affordance (with empty state) for discoverability.
- [ ] Reroot goal-detail breadcrumb at /study, or add "Back to study" CTA after goal creation.
- [ ] Decide first-run CTA on /study (vs steady-state equal-weight tiles).
- [ ] Decide what `Read` means from /study -- full library vs goal-scoped reading.
- [ ] Diagnose /memory/review 500 (suspected: load-fn downstream throw being masked).
- [ ] Build dev-mode error detail surface (host-gated, with toggle, [Show details] button now).
- [ ] Add server-side unhandled-error logger in study app `hooks.server.ts` if missing.
- [ ] Rename `/dashboard` (label says Stats) or merge into `/study`.
- [ ] Trace which redirect lands the user on /dashboard instead of /study.
- [ ] Resolve goal-vs-plan IA confusion (the big one -- see synthesis doc).
- [ ] Reconcile two due-cards counters between `/study` tile and `/dashboard` CTA.
- [ ] Decide nav dropdown rule (everything with children, or none -- not just Memory).
- [ ] Move Glossary near Flightbag in the right cluster (or wherever).
- [ ] Remove the local Help dropdown from the study layout (keep the global header Help).
- [ ] **Build the synthesis doc** -- IA cleanup proposal (see below).
