# theme-lint

Custom AST-free lint rule that blocks hardcoded visual values in `.svelte` `<style>` blocks and `.css` files under `apps/**` and `libs/ui/**`. Part of the theme system overhaul (work package #3).

## What it blocks

- Hex colors (`#fff`, `#ffffff`, `#ff00ff`)
- `rgb()` / `rgba()` / `hsl()` / `hsla()` / `oklch()` literals in call-site CSS
- Named CSS colors (`white`, `black`, `red`, etc.) on color-carrying properties
- Raw `rem` / `em` / `px` on padding, margin, gap, font-size, border-radius (with `0` and `1px` allowed as conventions)
- Hardcoded `ms` / `s` transition durations
- `font-family` literals (must use `var(--font-family-*)` or a typography-bundle token)
- `var(--unknown-token)` references that aren't in `vocab.ts`, `legacy-aliases.ts`, or one of the emitted role-token prefix families (`--type-*`, `--button-*`, `--input-*`, `--sim-*`)

## Usage

```bash
bun run lint:theme           # scan apps/ and libs/ui, respect ignore.txt
bun tools/theme-lint/bin.ts --json    # machine-readable output
bun tools/theme-lint/bin.ts --fix-ignore   # regenerate ignore.txt from current violations
bun tools/theme-lint/bin.ts apps/sim  # lint a single subtree
```

`bun run check` runs `lint:theme` as part of the pipeline.

## Exceptions

Two mechanisms:

1. Inline suppression. A comment with a non-empty reason suppresses violations on the next non-blank line (or on the same line if the comment is inline):

   ```css
   /* lint-disable-token-enforcement: debug outline while wiring focus */
   outline: 2px solid #ff00ff;
   ```

2. Grandfather list. `tools/theme-lint/ignore.txt` lists `<file>:<line>:<rule>` entries. Populated at package #3 landing time; shrinks as packages #5 and #7 migrate call sites.

## Adding tokens

When a new role token lands:

1. Add it to `libs/themes/vocab.ts` (`TOKENS` object).
2. Wire it through `libs/themes/emit.ts` so it appears in the generated CSS.
3. `bun run lint:theme` will accept `var(--new-token)` references immediately.

Adding tokens should be rare and deliberate; prefer composing existing tokens.
