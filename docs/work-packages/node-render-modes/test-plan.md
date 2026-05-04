---
title: 'Test Plan: Node render modes'
product: study
feature: node-render-modes
type: test-plan
status: draft
review_status: pending
created: 2026-05-04
---

## Setup

- Dev DB seeded.
- All ~16+ existing knowledge nodes migrated to the structured shape (per tasks.md step 6).
- A test free-form node fixture (one node deliberately not migrated) for the disabled-toggle path.
- Logged in as Abby.

---

## NRM-1: Toggle renders on a migrated node

1. Navigate to `/knowledge/density-altitude` (or any migrated node).
2. **Expected:** Body header shows a `Learn / Review / Memorize` segmented control. "Learn" is selected (or last-used mode from localStorage).

## NRM-2: Learn mode order

1. On a migrated node with all section types authored.
2. With Learn selected.
3. **Expected:** Body renders in this DOM order: hook -> explanation -> synthesis -> regulation_text -> practice_prompts -> citations.

## NRM-3: Review mode order

1. Click "Review".
2. **Expected:** Body re-renders without page navigation. Order: synthesis -> regulation_text -> citations -> practice_prompts -> `<details>` "Full explanation" containing hook + explanation. The `<details>` is collapsed by default.

## NRM-4: Memorize mode order

1. Click "Memorize".
2. **Expected:** Order: regulation_text -> synthesis -> practice_prompts -> citations -> `<details>` "Full explanation" containing hook + explanation.

## NRM-5: Mode persistence across nodes

1. Set mode to "Memorize" on `/knowledge/density-altitude`.
2. Navigate to `/knowledge/four-forces`.
3. **Expected:** "Memorize" still selected. localStorage value persisted.

## NRM-6: URL param mode

1. Navigate to `/knowledge/density-altitude?mode=review`.
2. **Expected:** Page renders with Review mode selected. localStorage updated to "review".

## NRM-7: Invalid URL param mode

1. Navigate to `/knowledge/density-altitude?mode=bogus`.
2. **Expected:** Server redirects to `/knowledge/density-altitude` (no `?mode=`); falls back to localStorage / Learn default.

## NRM-8: Free-form node (un-migrated)

1. Navigate to the test free-form node fixture.
2. **Expected:** Body renders as today's free-form markdown. Toggle visible but disabled with tooltip "This node is not yet structured for mode switching."

## NRM-9: Memorize on a node without regulation_text

1. Open a migrated node that has no `regulation_text` section authored.
2. Click "Memorize".
3. **Expected:** Body renders in Learn order with a banner: "No regulation excerpt for this topic; showing the standard view."

## NRM-10: Toggle accessibility

1. Tab to the mode toggle.
2. **Expected:** Each button is keyboard-focusable with a visible focus ring. Arrow keys move between buttons (per WAI-ARIA tabs pattern). Enter / Space activates.

## NRM-11: Mode change announcement

1. Have a screen reader active.
2. Click "Memorize".
3. **Expected:** Screen reader announces "Switched to Memorize mode."

## NRM-12: `[?]` popover

1. Click the `[?]` icon next to the toggle.
2. **Expected:** Popover opens with explainer text for all three modes. Click outside to close.

## NRM-13: parseKnowledgeBody -- structured

1. Vitest unit: parse a markdown string with all section delimiters in order.
2. **Expected:** Returns `{ kind: 'structured', sections: [hook, explanation, synthesis, regulation_text, practice_prompts] }` with each `body` correctly trimmed.

## NRM-14: parseKnowledgeBody -- free-form

1. Vitest unit: parse a markdown string with no delimiters.
2. **Expected:** Returns `{ kind: 'free-form', markdown }`.

## NRM-15: parseKnowledgeBody -- missing required

1. Vitest unit: parse markdown with only `<!-- @section: hook -->` (no synthesis or explanation).
2. **Expected:** Returns `{ kind: 'free-form', markdown }` with a console warning.

## NRM-16: parseKnowledgeBody -- duplicate

1. Vitest unit: parse markdown with two `<!-- @section: explanation -->` markers.
2. **Expected:** First instance kept, second instance's body merged into the first or warned. Document the chosen behavior in the parser.

## NRM-17: Migration script -- auto-detection

1. Run the migration script on a sample free-form node with `## Hook` / `## Explanation` / `## Synthesis` headings.
2. **Expected:** File rewritten with `<!-- @section: hook -->` etc. delimiters. Bodies preserved.

## NRM-18: Migration script -- needs-annotation list

1. Run the migration script on a free-form node without recognized headings.
2. **Expected:** File unchanged. Script outputs the file path in a "needs manual annotation" list.

## NRM-19: bun run check:knowledge-bodies

1. From repo root: `bun run check:knowledge-bodies`.
2. **Expected:** 0 errors after full migration. (Prior to migration: warnings for free-form files; no error.)

## NRM-20: Existing knowledge node count integrity

1. Compare the list of node files before and after migration.
2. **Expected:** Same number of files; same slugs. No content lost. (`git diff --stat` shows only frontmatter / delimiter changes.)

## NRM-21: bun run check

1. From repo root: `bun run check`.
2. **Expected:** 0 errors, 0 warnings.

## NRM-22: Vitest

1. From repo root: `bun test`.
2. **Expected:** All parser + renderer tests pass.

## NRM-23: Playwright

1. `bunx playwright test tests/e2e/knowledge-render-modes.spec.ts`.
2. **Expected:** All scenarios pass.
