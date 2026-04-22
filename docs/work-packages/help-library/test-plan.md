---
title: 'Test Plan: Help Library'
product: study
feature: help-library
type: test-plan
status: unread
---

# Test Plan: Help Library

## Setup

- Study app running at `localhost:9600`
- Logged in as test user
- `@ab/aviation` registry populated from wp-reference-system-core (at least the 175 hand-authored entries)
- `@ab/help` registry populated by the study app's `register.ts` at boot

---

## HL-1: Help index loads and groups pages

1. Navigate to `/help`.
2. **Expected:** Grouped list of seven pages: Getting started, Dashboard, Memory review, Reps session, Calibration, Knowledge graph, Keyboard shortcuts. Grouping is by `appSurface`.

## HL-2: Nav entry links to help

1. From any `(app)` route, click the Help entry in the top nav.
2. **Expected:** Lands on `/help`, nav aria-current marks Help active.

## HL-3: Help page detail renders

1. From `/help`, click "Calibration."
2. **Expected:** URL becomes `/help/calibration`. Page shows title, summary, TOC in sidebar, sections rendered in order. First section has no heading on the page; subsequent sections have headings matching their TOC entry.

## HL-4: Help page 404 on missing slug

1. Navigate to `/help/does-not-exist`.
2. **Expected:** 404 response (not a blank page).

## HL-5: TOC highlights current section on scroll

1. Open `/help/dashboard` (long page with nine panel sections).
2. Scroll to the Weak Areas section.
3. **Expected:** TOC entry for Weak Areas has `aria-current="true"` and visible highlight.

## HL-6: Collapsible sections toggle

1. On `/help/memory-review`, click a section heading.
2. **Expected:** Section collapses; clicking again expands. Keyboard Enter and Space also toggle. Focus-visible ring present.

## HL-7: Wiki-link in help body resolves

1. Open `/help/memory-review` (body references `[[FSRS::term-fsrs]]` or similar).
2. Hover the linked term.
3. **Expected:** Popover from `@ab/aviation`'s `ReferenceTerm` shows the reference's paraphrase. Click navigates to `/glossary/term-fsrs`.

## HL-8: Broken wiki-link fails the build

1. Add `[[Bogus::not-a-real-id]]` to a help page body.
2. Run `bun run check`.
3. **Expected:** Build fails with a message pointing at the help file and the missing id.

## HL-9: Duplicate help page id fails validation

1. Add a second help page with `id: 'calibration'`.
2. Run `bun run check`.
3. **Expected:** Validation error naming both sources.

## HL-10: Search finds aviation results

1. Open `/` or click the top-nav search button.
2. Type "metar".
3. **Expected:** Results panel shows an Aviation group with the METAR entry labeled `aviation - authored` (or `aviation - cfr` depending on source-type). No cross-library ranking bleed.

## HL-11: Search finds help results

1. In search, type "calibration."
2. **Expected:** Results panel shows a Help group with the Calibration help page labeled `help - concept`.

## HL-12: Search shows both libraries at once

1. In search, type "ifr fuel" (term with aviation hits and at least one help page mention).
2. **Expected:** Two groups visible: Aviation hits grouped first, Help hits second (or per the design.md ordering). Each result carries library + source-type label.

## HL-13: Power-user query narrows by tag

1. In search, type `tag:weather rules:ifr`.
2. **Expected:** Only entries with `aviationTopic` including `weather` AND `flightRules: ifr` appear. Filter chips above results reflect the parsed query.

## HL-14: Within-category ranking is exact-then-alias-then-keyword

1. Search for "METAR" where "METAR" is the displayName of one entry, an alias on another, and a keyword match on a third.
2. **Expected:** Display-name hit first, alias hit second, keyword hit third. No cross-category reordering.

## HL-15: Library filter narrows scope

1. In search, open filters, toggle Library to `help` only.
2. **Expected:** Aviation group disappears. Help group remains.

## HL-16: Search keyboard shortcuts

1. Press `/` anywhere in the app.
2. **Expected:** Search widget opens, focus on input.
3. With results visible in two library groups, press `]`.
4. **Expected:** Focus jumps to the first result of the next group. `[` goes back.
5. Press Enter on a focused result.
6. **Expected:** Navigates to that result's page. Escape at any time closes the widget.

## HL-17: Cmd+K also opens search

1. Anywhere in the app, press `Cmd+K` (or `Ctrl+K` on non-Mac).
2. **Expected:** Same search widget opens with focus on input. Identical behavior to the nav button.

## HL-18: Unregistered page is invisible

1. Author a new help page in `content/` but do NOT add it to the `studyHelpPages` aggregate.
2. Reload the app.
3. **Expected:** Page does not appear in `/help` index; `/help/[new-slug]` 404s; search does not surface it.

## HL-19: Registration is idempotent

1. Trigger `register.ts` twice in dev (hot-reload or manual re-call).
2. **Expected:** No duplicate entries in `getAllPages()`. Re-registering the same id replaces prior content rather than adding a second copy.

## HL-20: Keyboard shortcuts page lists every binding

1. Open `/help/keyboard-shortcuts`.
2. **Expected:** At minimum these are documented: review flow rating keys (1-4 and a/h/g/e), confidence-prompt skip, new-card Cmd+Enter submit, search `/`, search `[` / `]`, search Escape, Cmd+K, reps session skip keys. Each binding links to the help page for the surface it applies to.

## HL-21: Focus-visible throughout

1. Tab through the help index, a help detail page, and the search widget.
2. **Expected:** Every interactive element shows a visible focus ring. No keyboard trap in the search widget. `aria-current` set correctly on nav, TOC, and result groups.
