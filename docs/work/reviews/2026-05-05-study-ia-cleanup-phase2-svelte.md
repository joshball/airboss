# Svelte 5 review -- study-ia-cleanup Phase 2

issues_found: 2

## S-1 (minor) -- `program/goals/[id]/+page.svelte` uses `PageData & LayoutData` intersection

```typescript
let { data, form }: { data: PageData & LayoutData; form: ActionData } = $props();
```

SvelteKit auto-merges layout data into page data via the generated `PageData` type, so the explicit `& LayoutData` intersection is redundant. The TS-check still passes because the merge yields the same shape. The pattern works, but a fresh reader would not know whether `data.activePlan` came from the layout or the page server load.

Two paths:

- Drop `& LayoutData`; rely on the implicit merge. Concise, idiomatic.
- Keep it as documentation -- tells the reader explicitly that the value originates upstream.

Recommendation: drop it. The generated type already captures the merge; intersection is noise.

## S-2 (info) -- Tab strip uses `$derived` correctly

`apps/study/src/routes/(app)/program/+layout.svelte` derives the four `*Active` flags + the `goalHref` / `planHref` deep-link targets via `$derived`. No `$:` legacy. `$app/state` (not stores) for `page`. Snippets used for the layout slot. All on-pattern.

No fix.
