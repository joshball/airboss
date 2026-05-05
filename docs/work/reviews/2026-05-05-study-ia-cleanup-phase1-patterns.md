# Patterns review -- study-ia-cleanup Phase 1

issues_found: 3

## PT-1 (major) -- pageKey is a magic string at the call site

`apps/study/src/routes/(app)/study/+page.svelte:33`

```html
<PageExplainer pageKey="home" dismissed={data.pageExplainerDismissals.home === true}>
```

`'home'` is a string literal. CLAUDE.md "Critical Rules" says "All literal values in `libs/constants/`. ... All routes go through `ROUTES`. ... No magic strings." A `PAGE_EXPLAINER_KEYS` const (see SEC-2 in security review) covers this and serves the security defense-in-depth. Same root cause -- fix once.

```typescript
// libs/constants/src/study-home.ts
export const PAGE_EXPLAINER_KEYS = {
  STUDY_HOME: 'home',
  // ... grows as new pages mount the explainer
} as const;
export type PageExplainerKey = (typeof PAGE_EXPLAINER_KEYS)[keyof typeof PAGE_EXPLAINER_KEYS];
export const PAGE_EXPLAINER_KEY_VALUES: readonly PageExplainerKey[] = Object.values(PAGE_EXPLAINER_KEYS);
```

Then `pageKey={PAGE_EXPLAINER_KEYS.STUDY_HOME}` at the call site, and the API endpoint validates against `PAGE_EXPLAINER_KEY_VALUES`.

## PT-2 (minor) -- `tooltip-${...}` id template is a magic string fragment

`libs/ui/src/components/Tooltip.svelte:71`

The `tooltip-` prefix should live in a constant alongside the component (or in `libs/constants/` if it's used cross-lib). Same applies to the existing `airboss.page-explainer.dismissed.` localStorage prefix in PR #649's previous shape -- now removed in this slice, so PT-2 is the last remaining instance.

## PT-3 (nit) -- `Math.max(0, recallRequired - recallPassing)` inlines a clamp that belongs in `@ab/utils`

`apps/study/src/routes/(app)/study/+page.svelte:22`

The "non-negative subtraction" idiom is small, but it appears in two other places in the diff (TilesPanel does similar arithmetic, per the workpackage diff context). A `clampNonNegative(a, b)` helper in `@ab/utils` would centralize the intent.

This is a "watch for a third instance" item; not actionable in this slice.
