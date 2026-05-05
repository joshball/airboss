# UX review -- study-ia-cleanup Phase 1

issues_found: 4

## UX-1 (minor) -- collapse / re-open writes through to the server but no toast / inline feedback on failure

`libs/ui/src/components/PageExplainer.svelte:81-91`

If the dismissal POST fails, the optimistic UI rolls back to "expanded" and the user sees the explainer reappear silently. They have no signal *why* clicking Hide didn't stick. The current code comment says "non-load-bearing -- the user can just click again" but a silent revert reads as a UI bug, not a graceful fallback.

Fix options:

- Use the existing toast subsystem (if any -- check `libs/ui/src/components/`) to surface "Could not save preference. Try again."
- Add an inline retry affordance on the explainer itself (e.g. a small "Retry" link next to Hide).

Recommendation: low-volume failure mode, ship a toast. If the toast subsystem doesn't exist yet, log to console (`console.warn`) and add a TEMP_FIXES entry for the toast follow-up.

## UX-2 (minor) -- "Hide" copy is ambiguous; users may expect it to dismiss for this session vs. forever

`libs/ui/src/components/PageExplainer.svelte:115`

The button label is "Hide". The persistence model is "forever, until you click `?`". A first-time user reasonably reads "Hide" as "hide for now"; the per-page sticky behavior is surprising.

Proposed copy: "Don't show again" (matches the Settings global toggle naming) or "Hide on this page". Verify against `libs/help/src/glossary/content/explainer.md`.

## UX-3 (nit) -- the `?` reopen button is a bare circle with no hover label

`libs/ui/src/components/PageExplainer.svelte:122-132`

`aria-label="Show page explainer"` covers screen readers. Sighted users see only `?`. A hover tooltip ("Show explainer") would aid first-time discovery. Could reuse the new `<Tooltip>` primitive once C-1/C-2 close.

## UX-4 (nit) -- glossary entry copy is thin in places ("Reps" = "Scenario reps. Decision-making mini-scenarios.")

`libs/help/src/glossary/entries.ts:103-107`

Some short definitions are circular ("Reps" -> "Scenario reps") or jargon-heavy ("Domain" -> "One of the FAA knowledge areas"). They satisfy the typed contract (length > 0) but probably won't help a new learner. Pass to the user / CFI reviewer for copy edits before Phase 2.

Spec compliance: `tasks.md` 1.3.4 calls for "Author seed entries for every term in spec.md glossary"; the 20 entries match. Quality bar is editorial, not engineering -- defer to copy review.
