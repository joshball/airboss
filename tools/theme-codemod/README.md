# theme-codemod

Mechanical rewrites that move call-site CSS from legacy `--ab-*` tokens and literal values to the role tokens defined in `libs/themes/vocab.ts`. Part of the theme system overhaul (work package #3); actually run against `apps/study/src` in package #5 and against `apps/sim/src` in package #7.

## What it does

- **Legacy aliases.** Every `var(--ab-foo)` whose `LEGACY_ALIAS_MAP` value is itself a `var(--role)` reference is rewritten to the canonical role token. Aliases that expand to literal values (pixel breakpoints, rgba fallbacks) are left alone so the emitted `--ab-*` block keeps resolving them.
- **Radius literals.** `border-radius: 8px` -> `border-radius: var(--radius-md)` at the nearest rung.
- **Motion literals.** `transition: ... 120ms` -> `transition: ... var(--motion-fast)`, `200ms` / `250ms` -> `var(--motion-normal)`. Durations far from any rung (>60ms off) stay as-is so the lint rule can flag them for human review.
- **Font-family literals.** Known sans stacks -> `var(--font-family-sans)`; known mono stacks -> `var(--font-family-mono)`.
- **Ambiguous color literals.** `color: #fff` and `background: #fff` get a `/* TODO-theme: pick a role token ... */` comment prefixed to the declaration. Never auto-rewritten; a human must decide between ink/surface/inverse.

Every transform is idempotent: running twice produces the same output as running once.

## Usage

```bash
bun tools/theme-codemod/bin.ts --dry-run apps/study/src  # preview
bun tools/theme-codemod/bin.ts apps/study/src            # write in place
```

After running, always:

1. `bun run themes:emit` to refresh the generated CSS (if palette/contract changes landed alongside).
2. `bun run check` to confirm svelte-check + biome + lint:theme stay green.
3. Visual diff the affected pages; the rewrites should be pixel-identical when the legacy alias block is intact.

## Scope

Targets `.svelte` `<style>` blocks and `.css` files. Svelte markup (script, template) is untouched. `libs/themes/**` is never rewritten -- that's where tokens are defined.
