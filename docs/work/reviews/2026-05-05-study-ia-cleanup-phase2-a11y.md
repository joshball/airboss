# A11y review -- study-ia-cleanup Phase 2

issues_found: 3

## A-1 (major) -- Tab strip uses `<a>` anchors with `aria-current="page"`, not `role="tablist"` + `role="tab"`

`apps/study/src/routes/(app)/program/+layout.svelte:42-69` renders a `<nav class="program-tabs">` of plain anchors. ARIA's tablist pattern would be:

```html
<div role="tablist">
  <a role="tab" aria-selected="true" ...>Quals</a>
</div>
```

But the WAI-ARIA tablist pattern implies tab-controls-panel semantics where tabs swap visible regions on the same page. Our "tabs" are sibling routes -- distinct URLs, full-page navigations. `<nav>` of anchors with `aria-current="page"` is the correct pattern for that ("you are here" navigation), not tablist. The `/program/plans/+page.svelte` already uses `role="tablist"` for its inner Active/Archived selector (true same-page tabs); the outer Program nav is correctly NOT tablist.

No fix. The selector comment block in design.md "Page anchor convention" implicitly confirms this -- tabs are anchors, not panels.

## A-2 (minor) -- `<span data-testid="goal-detail-start-cta">` wraps an interactive Button

`apps/study/src/routes/(app)/program/goals/[id]/+page.svelte:57-63`. The span is purely a testid carrier; the focusable element is the inner `<a>` (Button-as-link). Screen readers traverse the link normally. No tab-stop introduced by the span (no tabindex). Acceptable.

A future Button.svelte change to accept a `testid` prop would let us drop the span. Out of scope for Phase 2.

## A-3 (nit) -- New `PageHeader` h1 emits `data-testid="page-anchor"` but `pageheader-title` shifted to the title-row container

The relocation is intentional (it's the central enforcement of the Phase 4 CI guard). Tests grepping for `pageheader-title` need to be aware: the testid still exists, just on the wrapper now. Verified no current consumer of `pageheader-title` exists in apps/, libs/, or tests/.

No fix.
