# Theme system quick reference

The "I want to style something, which token do I use" page. For *why* the system is shaped this way, read [02-ARCHITECTURE.md](02-ARCHITECTURE.md). For the full token catalog, see [04-VOCABULARY.md](04-VOCABULARY.md).

## I want to...

### ...add text

| Goal                         | Use                              |
| ---------------------------- | -------------------------------- |
| Body copy                    | `color: var(--ink-body);`        |
| De-emphasized "FYI" text     | `color: var(--ink-subtle);`      |
| Form labels, table headers   | `color: var(--ink-muted);`       |
| Captions, helper hints       | `color: var(--ink-faint);`       |
| Headings that need extra weight | `color: var(--ink-strong);`   |
| Text on a dark/inverted bg   | `color: var(--ink-inverse);`     |

### ...paint a surface

| Goal                                  | Use                                  |
| ------------------------------------- | ------------------------------------ |
| The page background                   | `background: var(--surface-page);`   |
| A panel or card                       | `background: var(--surface-panel);`  |
| Something elevated above panel        | `background: var(--surface-raised);` |
| A recessed area (input wells, code)   | `background: var(--surface-sunken);` |
| A subtle muted band                   | `background: var(--surface-muted);`  |
| A dropdown / popover                  | `background: var(--surface-overlay);`|

### ...draw a border

| Goal                              | Use                                   |
| --------------------------------- | ------------------------------------- |
| Default border / divider          | `border-color: var(--edge-default);`  |
| Stronger emphasis border          | `border-color: var(--edge-strong);`   |
| Quietest hairline                 | `border-color: var(--edge-subtle);`   |

### ...make something interactive

Don't reach for raw colors -- use the right primitive.

| You want                                     | Reach for                                                       |
| -------------------------------------------- | --------------------------------------------------------------- |
| A primary action                             | `<Button variant="primary">`                                    |
| A secondary action                           | `<Button variant="secondary">`                                  |
| A transparent inline action                  | `<Button variant="ghost">`                                      |
| A destructive action                         | `<Button variant="danger">`                                     |
| Text link inside body copy                   | `color: var(--link-default);` + `:hover { color: var(--link-hover); }` |
| A custom interactive surface                 | `--action-default-*` for the focal one, `--action-hazard-*` for destructive, `--action-neutral-*` for muted |

`--action-{role}-*` exposes derived states: `-hover`, `-active`, `-wash` (subtle bg), `-edge` (subtle border), `-ink` (text on the role color), `-disabled`.

### ...convey status (Badge / Banner / StatTile)

Status primitives accept a `tone` prop. Tones describe the **intent of the indicator** (separate from `Button.variant`, which describes the **role of an action**).

| Tone        | When to use                                       |
| ----------- | ------------------------------------------------- |
| `default`   | Ordinary, no special intent                       |
| `featured`  | The focal indicator on a surface (was `primary`)  |
| `muted`     | De-emphasized "FYI"                               |
| `success`   | Positive state (saved, complete, healthy)         |
| `warning`   | Caution / needs attention but not broken          |
| `danger`    | Error, destructive state, broken                  |
| `info`      | Informational, advisory                           |
| `accent`    | Decorative emphasis (rare; matches accent tokens) |

```svelte
<Badge tone="success">Saved</Badge>
<Banner tone="danger">Couldn't load reps.</Banner>
<StatTile label="Due now" value={42} tone="featured" />
```

### ...write a focus ring

```css
button:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
```

For a richer ring, `--focus-ring-strong` exists too. Don't write your own ring color.

### ...space / size / round / animate

| Goal              | Use                                                |
| ----------------- | -------------------------------------------------- |
| Padding / gap     | `var(--space-2xs)` ... `var(--space-2xl)`          |
| Border radius     | `var(--radius-sharp)` ... `var(--radius-pill)`     |
| Drop shadow       | `var(--shadow-none)` ... `var(--shadow-lg)`        |
| Transition        | `var(--motion-fast)` / `--motion-normal` / `--motion-slow` |
| Z-index           | `var(--z-base)` ... `var(--z-top)`                 |
| Layout column max | `var(--layout-container-max)`                      |

Never write a raw `px`, `ms`, or hex / rgb / hsl / oklch literal in a component or page `<style>` block. `theme-lint` fails CI on those.

### ...add a new theme

1. `libs/themes/<app>/<name>/index.ts` -- exports an object satisfying `Theme`, calls `registerTheme(...)`.
2. Add `import './<app>/<name>/index'` to `libs/themes/index.ts`.
3. Run `bun themes:emit` -- updates `libs/themes/generated/tokens.css`.
4. Add to the appropriate path-prefix list in `libs/themes/resolve.ts` if it's route-defaulted.

That's it. Contrast tests run automatically across every theme x appearance pair.

## Three vocabularies, one mental model

The system has three sets of names that all sound similar. They mean different things:

| Vocabulary               | Where             | Values                                                   | Purpose                                |
| ------------------------ | ----------------- | -------------------------------------------------------- | -------------------------------------- |
| Action roles (CSS)       | `--action-*`      | `default`, `hazard`, `caution`, `neutral`, `link`        | Color families themes declare base values for |
| Signal roles (CSS)       | `--signal-*`      | `success`, `warning`, `danger`, `info`                   | Status colors themes declare base values for |
| `Tone` enum (TS)         | Badge / Banner / StatTile `tone` prop | `default`, `featured`, `muted`, `success`, `warning`, `danger`, `info`, `accent` | Status indicator intent |
| `Button.variant` (TS)    | `<Button variant="...">` | `primary`, `secondary`, `ghost`, `danger`         | Action role on the page                |

`Button.variant` and `Tone` overlap (`danger` exists in both) but are intentionally separate -- buttons name actions, tones name status. Don't merge them.

`Button.variant="primary"` maps to the `--action-default-*` role tokens internally; `Button.variant="danger"` maps to `--action-hazard-*`. The component does the mapping; consumers just say `primary` or `danger`.

## What never to do

- Write a hex / rgb / hsl / oklch literal in a component or page `<style>`.
- Write a raw `px` / `rem` / `em` for spacing, radius, font-size, or border thickness on blocklisted properties (CSS-only `1px` for hairline borders is the documented exception in `theme-lint`).
- Add a new theme axis (today: `theme`, `appearance`, `layout`). Density / chrome / elevation live *inside* a theme.
- Invent a new tone outside the eight in [tones.ts](../../../libs/themes/tones.ts). If a primitive needs a new tone, the `TONES` array is the single edit and every consumer keeps working.
- Set `data-theme` directly in a route. Routes get themed by [resolve.ts](../../../libs/themes/resolve.ts).
