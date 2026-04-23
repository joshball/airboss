# Enforcement playbook

Every prior iteration meant to add enforcement and didn't. airboss-v1 left behind eleven deleted "adoption plan" docs because documentation doesn't enforce anything. The tools below are **not optional** — they ship *with* the architecture, not after.

If you can't write the lint rule, you haven't defined the vocabulary yet.

## What enforcement covers

| Concern                                      | Tool                                | When                            |
| -------------------------------------------- | ----------------------------------- | ------------------------------- |
| Pages/components use hardcoded colors        | Lint rule (Biome custom / ESLint)   | Every save + CI                 |
| Pages/components use hardcoded spacing       | Lint rule                           | Every save + CI                 |
| Pages/components use hardcoded transitions   | Lint rule                           | Every save + CI                 |
| Token names exist in vocabulary              | Lint rule reads `vocab.ts`          | Every save + CI                 |
| Contrast ratios meet WCAG AA                 | Vitest test per (theme × appearance × role-pair) | CI      |
| Light/dark palettes parse as valid OKLCH     | Vitest test per palette             | CI                              |
| No duplicate theme IDs in the registry       | Registry runtime check              | App boot (dev) + test suite     |
| `data-theme` + `data-appearance` in first paint | Playwright test                  | CI                              |
| No FOUC on route change                      | Playwright test                     | CI                              |
| Migrations happen                            | Codemod + CI fail on violations     | PR gates                        |

## 1. Lint rule: no hardcoded visual values in `<style>` blocks

**What it blocks:**

- `#rrggbb`, `#rgb`, `rgb(`, `rgba(` (except `transparent`, `currentColor`, `inherit`, variables)
- Named CSS colors (`white`, `black`, `red`, etc.)
- `\d+(\.\d+)?rem|px|em` as values for any property in the blocklist:
  - `color`, `background*`, `border*`, `outline*`
  - `padding*`, `margin*`, `gap`, `row-gap`, `column-gap`
  - `font-size`, `font-family`, `font-weight`, `line-height`, `letter-spacing`
  - `border-radius`
  - `box-shadow`, `text-shadow`
  - `transition*`, `animation-duration`
  - `min-width`, `max-width`, `width`, `min-height`, `max-height`, `height` (at page/layout level — inside primitives is fine)
- Hardcoded millisecond durations
- `font-family` with actual family names (must use `var(--type-*)` or `var(--font-family-*)`)

**What it allows:**

- `1px solid` borders (the `1px` is a convention-level value)
- `0` (dimensionless)
- Percentages, `auto`, CSS keywords
- Values inside `var(...)` calls
- Values inside comments

**Exception mechanism:** a `/* lint-disable-token-enforcement: <reason> */` comment suppresses the next rule. Reviewers must justify every exception.

**Where to implement:** start as a simple AST pass in a pre-commit hook or a custom Biome plugin. Keep it in `tools/theme-lint/` so it's versioned with the repo.

**Scope:** runs on `.svelte`, `.css`, `.scss` files in `apps/**` and `libs/ui/**`. Excluded: `libs/themes/**` (that's where values are *defined*), `libs/themes/<app>/<theme>/**` (obviously), test fixtures.

## 2. Codemod: rewrite existing hardcoded values

Lint rule tells you what's broken; codemod fixes it. Run once per folder during migration.

**Mappings it should know:**

```text
white, #ffffff, #fff        -> var(--surface-page) | var(--ink-inverse)   [context-dependent]
black, #000000, #000        -> var(--ink-body) | var(--surface-page) in dark
\d+px border-radius         -> nearest var(--radius-*)
\d+(ms|s) transition        -> var(--motion-fast) or var(--motion-normal)
raw rem values              -> nearest var(--space-*) or var(--type-*)
```

Context-dependent cases (is this `white` a background fill or a text-on-dark color?) the codemod shouldn't guess. Instead it:

- Flags the line
- Inserts a `/* TODO-theme: background-or-foreground? */` comment
- Refuses to auto-fix

The human decides; the codemod handles the mechanical cases.

**Implementation:** a TypeScript script using the Svelte compiler AST. Ships in `tools/theme-codemod/`. Takes a glob, writes changes in place, leaves a diff for review.

## 3. Contrast tests

Every theme × appearance × role-pair must meet WCAG AA (4.5:1 for body, 3:1 for large text and non-text elements).

```ts
// libs/themes/__tests__/contrast.test.ts
import { describe, it, expect } from 'vitest';
import { listThemes, resolveTheme, contrast } from '@ab/themes';

const requiredPairs = [
  { fg: 'ink.body', bg: 'surface.page', ratio: 4.5, reason: 'body text' },
  { fg: 'ink.body', bg: 'surface.panel', ratio: 4.5 },
  { fg: 'ink.muted', bg: 'surface.page', ratio: 4.5 },
  { fg: 'action.default.ink', bg: 'action.default', ratio: 4.5, reason: 'button label on solid' },
  { fg: 'signal.danger.ink', bg: 'signal.danger.wash', ratio: 4.5 },
  { fg: 'signal.success.ink', bg: 'signal.success.wash', ratio: 4.5 },
  { fg: 'edge.default', bg: 'surface.page', ratio: 3.0, reason: 'border visibility' },
  // ... 20-30 pairs total
];

describe.each(listThemes())('$id', (theme) => {
  describe.each(theme.appearances)('%s appearance', (appearance) => {
    const resolved = resolveTheme(theme, appearance);
    describe.each(requiredPairs)('$fg on $bg ≥ $ratio', (pair) => {
      it(pair.reason ?? '', () => {
        const ratio = contrast(get(resolved, pair.fg), get(resolved, pair.bg));
        expect(ratio).toBeGreaterThanOrEqual(pair.ratio);
      });
    });
  });
});
```

**The test fails on regression.** Someone adds a new theme or tweaks a palette and breaks a ratio — CI catches it immediately. No theme ships until this test is green.

## 4. Palette parse tests

OKLCH strings are easy to typo. Parse every color in every theme at test time:

```ts
describe.each(listThemes())('$id palette parses', (theme) => {
  it.each(['light', 'dark'])('%s', (appearance) => {
    if (!theme.palette[appearance]) return;
    for (const [path, value] of flattenPalette(theme.palette[appearance]!)) {
      expect(parseOklch(value), `${path}: ${value}`).toBeDefined();
    }
  });
});
```

## 5. Vocabulary guard

The `vocab.ts` file is the master list of legal token names. The lint rule above reads from it. When someone uses `var(--ink-wrong)` and no such token exists, lint fails with a suggestion (`did you mean --ink-muted?`).

Implementation: token names live in a `TOKENS` object in `vocab.ts`; lint reads the object and cross-references every `var(--*)` reference in the codebase. Typos fail instantly.

## 6. Appearance toggle persistence test (Playwright)

```ts
test('appearance preference survives reload', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-test="appearance-toggle-dark"]');
  await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark');
});
```

## 7. FOUC test

```ts
test('no appearance flash on first paint', async ({ page }) => {
  await page.addInitScript(() => {
    document.cookie = 'appearance=dark; path=/';
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  // Before hydration, <html> must already carry data-appearance=dark.
  await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark');
});
```

The pre-hydration script runs before `domcontentloaded` completes. If it doesn't set the attribute, this test fails and FOUC is back.

## 8. CI gates

Summary of what blocks a PR from merging:

- `bun run lint:theme` — lint rule, 0 violations
- `bun run test:unit libs/themes` — contrast + palette parse + derivation unit tests
- `bun run test:e2e theme` — Playwright appearance + FOUC tests
- TypeScript strict mode — theme contract violations surface at compile time

All four must pass. No "critical/major/minor" classification on theme violations — the vocabulary is either followed or it isn't.

## Adoption strategy

The past seven iterations suggest this order:

1. **Land the lint rule with a grandfather list.** Every existing violation goes into an ignore file. New code can't add violations; old code stays as-is until migrated.
2. **Run the codemod folder-by-folder.** Each folder becomes one PR. Ignore file shrinks with each merge.
3. **Delete the ignore file when empty.** The lint rule now prevents backslide indefinitely.

Without the ignore file, you can't land the lint rule without migrating the whole codebase first — that's a big-bang migration nobody ships. With it, you get enforcement from day one and incremental adoption from day one.

## Why this beats documentation

airboss-v1's graveyard of eleven deleted adoption docs happened because documentation is advice. A lint rule is a command. Developers read advice and defer; developers read red squigglies and fix. This is the single biggest lever for making the system stick.
