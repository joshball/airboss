# wp-flightbag-reader-ux -- test plan

Manual walkthrough the user runs before flipping `human_review_status: signed-off`.

## Setup

- Reseed dev DB: `bun run db reset`.
- Sign in as Abby.
- Open flightbag: <http://localhost:5176> (or whatever port flightbag is on).

## Walk -- Phase 1: chrome consolidation

### Visual consistency across reader surfaces

1. Open the flightbag catalog (`/`). Note: hero header, reference card grid.
2. Click into a handbook (PHAK). Note the reader chrome: breadcrumb, source-links, page header.
3. Click into a chapter, then a section. Note the chrome stays consistent across all three pages.
4. Repeat the walk for AIM, CFR, ACS, AC. Each doc-type's three-or-more-deep navigation uses the same reader chrome.
5. **Confirm**: identical breadcrumb spacing, identical source-links placement (right of header), identical empty-state visuals where they appear.

### Empty states

1. Find a CFR Part with no sections ingested (or seed one). Confirm `<ReaderEmptyState kind="not-yet-ingested">` renders with eCFR link.
2. Find an ACS that's "sourced only." Confirm `<ReaderEmptyState kind="sourced-only">` with PDF + portal links.
3. Confirm all empty states share visual language (badge + heading + body + actions).

### Heartbeat

1. Open an AIM section. Wait 30s. Reload.
2. Confirm `study.reference_section_read_state` row created with `last_read_at` set, `total_seconds_visible > 0`. (Read state surfaces in the section header as "You've read this once; last on Mon 11.")
3. Repeat for CFR section and ACS task.

## Walk -- Phase 2: study `/library/*` cutover

### Redirects

1. Hit `/library/handbook/phak` directly in study. Confirm 301 -> `/handbook/phak/<latest-edition>` in flightbag.
2. Hit `/library/handbook/phak/chapter/4`. Confirm 301 -> equivalent flightbag URL.
3. Repeat for `/library/regulations/14/91`, `/library/testing/ppl-airplane`, `/library/advisories/61-65`.
4. Confirm internal links in study (e.g. cert-dashboard "References" tile) point at `ROUTES.FLIGHTBAG_*` and don't 301 internally.

### No duplicate reader

1. Confirm no `+page.svelte` files remain in `apps/study/src/routes/(app)/library/handbook/`.
2. Confirm `apps/study/src/routes/(app)/library/+page.svelte` (the catalog at `/library`) has been retired or repointed to flightbag.

## Walk -- Phase 3: reader pref tokens + control

### The prefs popover

1. Open any flightbag reader page. Confirm `<ReaderPrefsButton>` (gear icon) in the header.
2. Click. Popover shows: font-family radio (Sans / Serif / Mono), font-scale slider (5 stops), density radio, measure radio, heading-scale radio.
3. Set font-family = Sans. Body type changes immediately (no reload).
4. Set font-scale = 1.25. Type bumps up.
5. Set density = Spacious. Line-height grows.
6. Set measure = Wide. Body widens to ~84ch.
7. Set heading-scale = Larger. h1/h2/h3 grow more than body.
8. Reload. All settings persist.

### Site-wide cascade

1. Switch to study app (same browser).
2. Open `/study/learn/<knowledge-node>`. Confirm the node body adopts the same font-family / scale / density / measure as set in flightbag.
3. Confirm UI surfaces (forms, dashboards) are NOT affected -- only the prose-bearing surfaces.

### Defaults

1. Sign out. Sign in as a fresh user.
2. Open flightbag PHAK §4.2. Confirm: serif body (Georgia / ui-serif), scale 1.0, comfortable line-height (1.65), normal measure (72ch), heading-scale 1.0.

### Anonymous handling

1. Sign out entirely. Open flightbag.
2. Confirm `<ReaderPrefsButton>` is hidden (no session, no prefs to write).
3. Confirm body still renders with defaults.

## Walk -- Phase 4: overview view + persistent rail + transitions

### Overview view

1. Open `/handbook/phak/<latest-edition>`. Confirm: 2-3 column grid of `<ChapterTile>`s.
2. Each tile shows chapter code, title, sub-section list (collapsed), progress ring, reading-time.
3. If you've read a section, "Resume reading at §X.Y" pinned at the top, links to that section.
4. Hover a tile -> sub-sections expand.
5. Click a sub-section -> navigates to that section in reading view.

### Persistent rail

1. From section §1.1, click §1.2 in the rail.
2. Confirm: rail does NOT remount (no flicker; active marker animates between entries).
3. Body cross-fades (Chrome / Edge / Safari). On Firefox: clean cut, no jank.
4. Repeat across chapters (§1.5 -> §2.1).

### Keyboard nav

1. From section §1.1, press `j`. Confirm navigation to next section.
2. Press `k`. Confirm navigation to previous section.
3. Press `o`. Confirm navigation to handbook overview.
4. Press `?`. Confirm cheatsheet overlay appears with all reader shortcuts.
5. Focus an input field. Press `j`. Confirm shortcut does NOT fire (input handler).

### Mobile

1. Resize to narrow viewport (<60rem).
2. TOC drawer collapses to a top-of-page disclosure.
3. Tap to open. Tap a section link.
4. Confirm: drawer auto-closes after navigation.

### End-of-doc footer

1. Navigate to the last section of any chapter (or doc).
2. Confirm `<ReaderNav variant="end-of-doc">` renders: progress summary + "Mark chapter as read" button + (placeholder) "Next handbook in syllabus."
3. Click "Mark chapter as read" -> all sections in the chapter flip to `read`.

## Surfaced gaps to verify before signoff

- [ ] No console errors on any page (browser devtools open during walkthrough).
- [ ] No broken `/library/*` links anywhere (grep + manual click-through).
- [ ] Reader prefs work in incognito (cookie persistence + no session).
- [ ] View Transitions degrade silently in Firefox.
- [ ] Cheatsheet `?` overlay closes on Esc.
- [ ] Heartbeat doesn't double-fire after view transition.
- [ ] WP frontmatter intact; no agent committed `human_review_status`.
