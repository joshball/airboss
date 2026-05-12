---
title: Command palette Phase 2 -- UX review
date: 2026-05-11
branch: ball/palette-phase2-f191fb12
pr: 831
reviewer: agent (close-pass synthesis)
category: ux
status: pending
review_status: done
issues_found: 4
---

# UX review

User flows, feedback, error/empty/loading states, interaction design.

## Findings

### U1. (Major) No loading state -- columns flash empty during server fetch

**File:** `libs/help/src/ui/HelpSearchPalette.svelte`

The in-process facade renders synchronously the moment `debouncedQuery` lands. The DB-backed fetch returns 50-300ms later. During that window the user sees: synchronous columns (aviation refs, help, external tools) render immediately; "My Stuff", handbook chapters, CFR sections, AIM, knowledge nodes are absent (the columns render with `No hits`); then everything pops in when the fetch resolves.

This is visibly jittery. A user typing `weather` sees external tools first, then `pop` -- handbook + CFR sections show up half a second later.

**Fix:** show a per-column loading affordance (skeleton row or "Loading..." text in `hint`) while `lastFetchedQuery !== debouncedQuery && debouncedQuery.length > 0`. The columns most affected are `faa-resources` (handbook + CFR + AIM chapters), `airboss-content` (knowledge nodes + courses), `my-stuff` (cards + reps + plans).

Minimum bar: a single `data-loading="true"` attribute on the columns + a CSS treatment (subtle pulse). The detail pane in Phase 3 will handle this more richly.

### U2. (Major) Empty state hint contradicts placeholder

**File:** `libs/help/src/ui/HelpSearchPalette.svelte` (lines 345 + 425)

- Placeholder: ``Search (try `metar`, `Part 91`, `doc:FAA-H-8083-28 turb`, `mine`)``
- Empty hint below the columns: "Start typing. Try a doc code (`FAA-H-8083-28`, `Part 91`, `AIM 7-1`), an alias (`AvWX`, `PHAK`), a term (`metar`, `density altitude`), or a filter (`doc:`, `kind:`, `mine`)."

Two pieces of "try these" copy in the same dialog, with slightly different examples. The placeholder is glanceable; the hint is verbose. If the user is going to read either, it should be one of them.

**Fix:** pick one. The longer hint inside the dialog is more useful (visible after open); shorten the placeholder to `Search...`. Or drop the dialog-body hint in Phase 2 and rely on the placeholder, which is closer to the input.

### U3. (Minor) `Cmd+\` toggle for detail pane is missing the detail pane

**Files:** `docs/work-packages/command-palette/spec.md` (Decision #3) + `libs/help/src/ui/HelpSearchPalette.svelte`

Spec calls for a right-side detail pane togglable with `Cmd+\`. Phase 2 deliberately defers the detail pane to Phase 3. Today neither the pane nor the `Cmd+\` binding exist -- but the footer says "`Tab` / `[` `]` jump column · `Enter` open · `Esc` close" with no mention of the deferred binding. The keystroke hint is right-sized for Phase 2.

But Phase 3 is the next step and there's a UX seam to think about: when the detail pane lands, where does it go on narrow viewports? At `1100px` and below, columns collapse to 3 per row (`@media (max-width: 1100px)` in `.columns`). The pane can't fit alongside 3 columns on a 1024px screen. Decision #3 says "hidden below ~900px" which is well below 1100. So between 900-1100px the spec says "show pane" but the column layout has only 1024-ish horizontal space available.

**Fix (for Phase 3 design):** decide the bridge between 900-1100px and document. Either:

- pane is hidden in this band too (effectively bumping the threshold to 1100)
- columns collapse to 2 in this band so the pane fits

Capture the decision when Phase 3 starts; don't surface as a defer. For Phase 2 the current behavior is fine.

### U4. (Nit) Banner reads "Open" -- ambiguous when the result is a downstream link

**File:** `libs/help/src/ui/HelpSearchPalette.svelte` (line 367-373)

The banner row always says "Open" regardless of the result type. For an external tool (`web.tool` rows from `external-tools.ts`), the action opens a new tab. For an internal route, it navigates in-app. For a doc-code (handbook root), it opens the in-app library reader. Three different actions, one label.

**Fix:** discriminate via `result.type`. Map `web.tool` -> "Open (external)" (with the tab icon), `cmd.*` -> "Run", everything else -> "Open". The activate() function already discriminates external vs internal at navigate-time; the label should mirror.

Not blocking for Phase 2; Phase 3's detail pane carries richer action affordances and this resolves there. Surface here so it doesn't get forgotten.
