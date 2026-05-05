# Correctness review -- study-ia-cleanup Phase 1

Branch: `ball/study-ia-phase1-fix-08db086b` vs `main`
Reviewer: correctness (sequential pass, not parallel agent dispatch -- harness limitation noted in `.ball-coord/to-dispatcher.md`)

issues_found: 5

## C-1 (major) -- Tooltip emits duplicate DOM ids when the same glossary key appears multiple times on a page

`libs/ui/src/components/Tooltip.svelte:71`

```typescript
const tooltipId = $derived(`tooltip-${(glossaryKey ?? literalTerm ?? 'unknown').replace(/\s+/g, '-').toLowerCase()}`);
```

`apps/study/src/routes/(app)/study/+page.svelte` already mounts `<Tooltip for="goal">` three times on the home page (lines 35, 43, 67) and `<Tooltip for="plan">` four times (lines 36, 44, 55, 68). Every one of those collapses to the same `id="tooltip-goal"` / `id="tooltip-plan"`. When two tooltips happen to be open simultaneously (which can occur with overlapping focus rings or via multiple touches on iOS), the DOM has duplicate ids. `aria-describedby` on the trigger then resolves ambiguously.

Fix: derive a per-instance unique id. Use Svelte 5's `$props.id()` is not a thing; use a module-level counter or `crypto.randomUUID()` once per component instance.

## C-2 (major) -- Tooltip never closes on touch devices

`libs/ui/src/components/Tooltip.svelte:153-160`

```html
ontouchstart={handleOpen}
```

`onmouseleave` does not fire on touch devices, so once a user taps a tooltip on iOS / Android the bubble stays open until they tab elsewhere or hit Esc on a Bluetooth keyboard. The spec is explicit (`docs/work-packages/study-app-ia-cleanup/design.md:147`): "Tap outside, blur, or Esc dismisses." This is a hard miss.

Fix: add a `pointer-down` listener on `document` (mounted only while `open` is true) that closes the bubble when the target is outside `triggerEl`.

## C-3 (minor) -- `dueCardsCount` derivation: subtraction can produce a confusing 0 when `recallRequired` is 0

`apps/study/src/routes/(app)/study/+page.svelte:20-22`

```typescript
const recallRequired = $derived(data.kind === 'home' ? (data.mastery.byEvidenceKind.recall?.required ?? 0) : 0);
const recallPassing = $derived(data.kind === 'home' ? (data.mastery.byEvidenceKind.recall?.passing ?? 0) : 0);
const dueCardsCount = $derived(Math.max(0, recallRequired - recallPassing));
```

When the credential has zero recall-gated leaves (e.g. a syllabus-of-syllabi parent), `dueCardsCount` resolves to `0`, which the TilesPanel will badge as "0 due". A new user with no cards will read this as "I have completed all my cards", which is the opposite of true. The comment acknowledges this as a placeholder until the per-credential aggregation lands; either:

- Surface `null` instead of `0` and have TilesPanel render "--", OR
- Block the badge when `recallRequired === 0`.

Pick one. "Maybe someday" is not allowed (CLAUDE.md "no undecided considerations").

## C-4 (minor) -- `dismissed === true` strict equality is redundant given the JSONB shape

`apps/study/src/routes/(app)/study/+page.svelte:33`

```typescript
<PageExplainer pageKey="home" dismissed={data.pageExplainerDismissals.home === true}>
```

The Zod schema for `study.page_explainer.dismissed` is `z.record(z.string().min(1), z.literal(true))` -- the only possible truthy value is `true`. Reading `data.pageExplainerDismissals.home` is already `true | undefined`. The `=== true` only protects against shape drift -- if you trust your own Zod schema (you should, it gates writes), `Boolean(...)` or just `data.pageExplainerDismissals.home ?? false` is cleaner.

## C-5 (nit) -- `glossaryKey ?? literalTerm ?? 'unknown'` swallows the dev-warning case

`libs/ui/src/components/Tooltip.svelte:71`

If both `glossaryKey` and `literalTerm` are undefined, `tooltipId` becomes `tooltip-unknown` which is silently rendered. The dev warning in `$effect` only fires when `glossaryKey !== undefined`. Either also warn on `literalTerm + literalDefinition` mismatch, or assert that exactly one mode is supplied via a type-level XOR (overloaded `Props` discriminated union).
