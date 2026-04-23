---
title: 'Test Plan: Session Legibility and Help Expansion'
product: study
feature: session-legibility-and-help-expansion
type: test-plan
status: unread
---

# Test Plan: Session Legibility and Help Expansion

Prefix: **SLHE**.

## Setup

- Running airboss dev on `http://127.0.0.1:9600`.
- A test user with an active study plan and enough session history that `/session/start` returns at least 2 rows per slice.
- If data is thin: seed scenario data or use the dev seed script under [scripts/](../../../scripts/) (check existing seed helpers).
- Desktop Chrome (primary), iPhone-sized responsive viewport (secondary), Firefox for keyboard-only pass.

---

## SLHE-1: Markdown renderer — headings, paragraphs, emphasis

1. Navigate to `/help/concept-fsrs`.
2. **Expected:** h2/h3 headings render with visible hierarchy. Paragraphs have readable line-height. Bold and italic inline emphasis visible. Inline code has monospace font and subtle background.

## SLHE-2: Markdown renderer — tables

1. Navigate to `/help/memory-review`.
2. Scroll to the rating-semantics section.
3. **Expected:** Table renders with aligned columns, styled header row, responsive horizontal scroll on a 375px-wide viewport.

## SLHE-3: Markdown renderer — fenced code + highlighting

1. Navigate to a concept page that includes a `typescript` fenced block (author one in `concept-fsrs` if none present).
2. **Expected:** Code block renders with syntax-highlighted tokens (keyword, string, comment distinctly coloured). `lang="text"` blocks render plain.

## SLHE-4: Markdown renderer — callouts

1. Navigate to `/help/memory-review`.
2. **Expected:** `:::tip`, `:::note`, `:::warn`, `:::example` blocks render as `HelpCard` variants with the expected icon + tone per existing `HelpCard` styling.

## SLHE-5: Markdown renderer — wikilinks

1. Navigate to `/help/concept-fsrs`.
2. Click a `[[display::concept-spaced-rep]]` link in the body.
3. **Expected:** Navigates to `/help/concept-spaced-rep`. Styled as a link (primary colour, underline on hover).

## SLHE-6: Markdown renderer — external links with source badges

1. Navigate to `/help/concept-fsrs`.
2. **Expected:** External links show an external-link icon. Links to `wikipedia.org` display a "Wikipedia" source badge. Links to `faa.gov` display an "FAA" badge.

## SLHE-7: External refs footer

1. Navigate to `/help/concept-fsrs`.
2. Scroll to page bottom.
3. **Expected:** References footer renders with 2-6 entries, each showing title, source badge, optional note, clickable URL.

## SLHE-8: PageHelp — memory-review

1. Navigate to `/memory/review`.
2. Find the `?` icon in the page header.
3. Click it.
4. **Expected:** Navigates to `/help/memory-review`. Icon has `aria-label="Help for this page"`.

## SLHE-9: PageHelp — unknown pageId renders nothing

1. (Dev-only) Temporarily change `<PageHelp pageId="does-not-exist" />` in any route.
2. Reload.
3. **Expected:** No `?` icon rendered. Console shows a dev warning. No thrown error.

## SLHE-10: InfoTip — hover opens popover

1. Navigate to `/session/start`.
2. Hover over the `?` icon next to the "Strengthen" slice heading.
3. **Expected:** Popover appears with term, short definition, and a "Learn more" link to `/help/concept-session-slices#strengthen`.

## SLHE-11: InfoTip — click pins popover

1. Navigate to `/session/start`.
2. Click the `?` next to "Continue where you left off."
3. Move mouse away.
4. **Expected:** Popover remains open. Close via Escape or by clicking outside.

## SLHE-12: InfoTip — keyboard accessible

1. Navigate to `/session/start`.
2. Tab until focus lands on an InfoTip trigger.
3. Press Enter.
4. **Expected:** Popover opens; focus moves inside. Tab cycles through popover contents. Escape closes and returns focus to trigger.

## SLHE-13: InfoTip — touch accessible

1. Open `/session/start` on a touch device or touch-emulated DevTools.
2. Tap an InfoTip `?`.
3. **Expected:** Popover opens. Tap outside closes. No hover-only behaviour blocks use.

## SLHE-14: InfoTip — viewport edge flip

1. Navigate to `/session/start`.
2. Locate an InfoTip on the far right edge of the viewport (e.g., reason chip in last column).
3. Hover to open.
4. **Expected:** Popover flips left to stay in viewport. No horizontal scroll introduced.

## SLHE-15: InfoTip — reduced motion

1. System preference: reduced motion enabled.
2. Open an InfoTip.
3. **Expected:** Popover appears without fade transition (or with instant transition). No motion.

## SLHE-16: Session preview IDs — Card links

1. Navigate to `/session/start` with a preview containing a Card row.
2. Click the card ID link.
3. **Expected:** Navigates to `/memory/<cardId>` and renders the card detail page.

## SLHE-17: Session preview IDs — Node links

1. Navigate to `/session/start` with a preview containing a `node_start` row.
2. Click the node ID link.
3. **Expected:** Navigates to `/knowledge/<slug>` and renders the node detail page.

## SLHE-18: Session preview IDs — Rep fallback

1. Navigate to `/session/start` with a preview containing a Rep row.
2. Click the scenario ID link.
3. **Expected:** Navigates to `/reps/browse?scenarioId=<id>`. That scenario's row scrolls into view and shows a transient highlight (~2-3 seconds).

## SLHE-19: Collapsible legend — default state

1. Fresh browser profile (no localStorage).
2. Navigate to `/session/start`.
3. **Expected:** Legend is collapsed. Summary text "What am I looking at?" visible.

## SLHE-20: Collapsible legend — expand + persist

1. Open the legend.
2. Reload the page.
3. **Expected:** Legend remains open (state persisted via `localStorage`). Close and reload; it stays closed.

## SLHE-21: Collapsible legend — content

1. Open the legend.
2. **Expected:** Labelled diagram visible (slice heading, kind badge, reason chip, ID, preview count all annotated). A "Read the full guide" button links to `/help/session-start`.

## SLHE-22: Session-start help page — exists and loads

1. Navigate to `/help/session-start`.
2. **Expected:** Page loads. Sections: What you see, Slices, Kinds, Reason codes, Priorities, Domains, Modes and weights. Each renders with rich markdown.

## SLHE-23: Session-start help page — reason-codes table

1. On `/help/session-start`, scroll to the Reason codes section.
2. **Expected:** Table with 13 rows, one per `SessionReasonCode`. Columns: label, slice, explanation. Matches the definitions in `SESSION_REASON_CODE_DEFINITIONS`.

## SLHE-24: Concepts index — exists and groups

1. Navigate to `/help/concepts`.
2. **Expected:** Page renders with three groups: Learning science, Airboss architecture, Aviation doctrine. Each group has card entries for the pages assigned.

## SLHE-25: Concepts index — nav entry

1. From `/dashboard`, locate the Help nav entry.
2. **Expected:** A "Concepts" link or submenu entry exists and navigates to `/help/concepts`.

## SLHE-26: Concept page cross-links work

1. Navigate to `/help/concept-fsrs`.
2. Click at least two wikilinks to other concept pages.
3. **Expected:** Each navigates to the linked concept page; no dead links.

## SLHE-27: Concept page external refs open new window with source attribution

1. Navigate to `/help/concept-active-recall`.
2. Click an external reference in the footer.
3. **Expected:** Opens in a new tab (`target="_blank"` with `rel="noopener noreferrer"`). URL matches declared `url`.

## SLHE-28: Validation — externalRefs URL rejection

1. Temporarily add an `externalRefs` entry with `url: 'http://localhost:9600/evil'` to any concept page.
2. Run `bun run check`.
3. **Expected:** Build fails with a validation error referencing the bad URL and the page id.

## SLHE-29: Validation — unknown callout variant

1. Temporarily introduce `:::unknown-variant` in a help page body.
2. Run `bun run check`.
3. **Expected:** Build fails with a clear error naming the page and unknown variant.

## SLHE-30: Validation — concept ↔ helpKind consistency

1. Temporarily set `concept: true` on a page with `helpKind: 'reference'`.
2. Run `bun run check`.
3. **Expected:** Build fails with an error stating `concept: true` requires `helpKind: 'concept'`.

## SLHE-31: Search palette still finds concept pages

1. Press `/` to open the search palette.
2. Type "FSRS".
3. **Expected:** Concept page `concept-fsrs` appears in the Help bucket.

## SLHE-32: No regression — existing help pages render

1. Navigate to each of the 7 pre-existing pages: `/help/getting-started`, `/help/dashboard`, `/help/reps-session`, `/help/calibration`, `/help/knowledge-graph`, `/help/keyboard-shortcuts`, `/help/memory-review`.
2. **Expected:** All render correctly with the new MarkdownBody. No broken layout. No wikilinks resolve as plain text unintentionally.

## SLHE-33: `bun run check` green

1. After all phases complete, run `bun run check`.
2. **Expected:** 0 errors, 0 warnings.

## SLHE-34: Mobile — `/session/start` readable

1. Viewport 375×812 (iPhone SE).
2. **Expected:** Slice headings + InfoTips stack cleanly. IDs still tappable (min 44×44 target). Legend collapses/expands within viewport.

## SLHE-35: Mobile — `/help/<concept>` readable

1. Viewport 375×812.
2. Navigate to `/help/concept-calibration`.
3. **Expected:** TOC collapses (if desktop-only), body readable without horizontal scroll, tables scroll horizontally when needed, external refs footer stacks.

## SLHE-36: Client bundle — no server-only imports leak

1. Build the app: `bun run build` (or equivalent).
2. **Expected:** No `node:fs` externalization warnings in the client bundle output. No server-only imports in the browser graph.

## SLHE-37: Accessibility — axe scan clean on a help page

1. Run axe-core (or equivalent a11y check) against `/help/memory-review`.
2. **Expected:** No critical or serious violations. Minor violations triaged and either fixed or noted.

## SLHE-38: Accessibility — axe scan clean on `/session/start`

1. Run axe against `/session/start` after Phase 4.
2. **Expected:** No critical or serious violations on the InfoTip triggers, the legend, or the preview rows.

## SLHE-39: SSR — help page renders server-side

1. Disable JavaScript in the browser.
2. Navigate to `/help/concept-fsrs`.
3. **Expected:** Full page content (including highlighted code blocks) renders. Wikilinks are navigable. External refs footer is visible.

## SLHE-40: Focus-trap refactor — ConfirmAction still works

1. Find any dashboard flow that uses `<ConfirmAction>` (e.g., destructive actions).
2. Tab through; hit Escape; click outside.
3. **Expected:** Focus cycles within the confirm panel, Escape cancels, click-outside cancels, focus returns to trigger. Behaviour is identical to pre-refactor.
