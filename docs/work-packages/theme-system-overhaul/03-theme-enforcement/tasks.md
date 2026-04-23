---
title: 'Tasks: Theme Enforcement'
feature: theme-enforcement
type: tasks
---

# Tasks

## Lint rule

- [ ] Scaffold `tools/theme-lint/` with a CLI entry (`tools/theme-lint/bin.ts`).
- [ ] AST-based scanner for Svelte `<style>` blocks and `.css` files.
- [ ] Rule: no hex colors, no rgb()/rgba() except `transparent`.
- [ ] Rule: no named CSS colors on color/background/border/fill/stroke.
- [ ] Rule: no raw rem/px/em on blocklisted properties.
- [ ] Rule: no hardcoded transition durations (ms/s).
- [ ] Rule: no hardcoded font-family.
- [ ] Rule: unknown `var(--*)` reference (cross-ref against `TOKENS`).
- [ ] Exception mechanism: `/* lint-disable-token-enforcement: <reason> */`.
- [ ] Ignore file support: `tools/theme-lint/ignore.txt`.
- [ ] `package.json` script `"lint:theme": "bun tools/theme-lint/bin.ts"`.
- [ ] Populate ignore file with current violations (run scanner, dump results).

## Codemod

- [ ] `tools/theme-codemod/` with CLI entry.
- [ ] Color mappings (context-independent cases): `white`/`#ffffff` in ambiguous context → TODO; `#fff` on `color:` property → `--ink-inverse` + TODO for review.
- [ ] Radius mapping: nearest `var(--radius-*)`.
- [ ] Transition mapping: `120ms` → `var(--motion-fast)`, `200ms` → `var(--motion-normal)`.
- [ ] Font-family mapping: match known stacks to bundle families.
- [ ] Dry-run mode: print intended changes without writing.
- [ ] Report: what was auto-fixed, what was flagged TODO.

## Tests

- [ ] `libs/themes/__tests__/contrast.test.ts` — full role-pair matrix per (theme × appearance).
- [ ] `libs/themes/__tests__/palette-parse.test.ts` — every color parses as OKLCH.
- [ ] `apps/study/tests/e2e/theme-fouc.spec.ts` — Playwright test for pre-hydration attribute.
- [ ] `apps/study/tests/e2e/appearance-toggle.spec.ts` — toggle dark, reload, still dark.

## CI

- [ ] `.github/workflows/ci.yml` (or equivalent) runs `lint:theme` on PR.
- [ ] CI runs `test:unit libs/themes`.
- [ ] CI runs `test:e2e theme`.
- [ ] Pre-commit hook optional: run lint on staged files.

## Documentation

- [ ] `tools/theme-lint/README.md` — how to use, how to add exceptions.
- [ ] Update project root `CLAUDE.md` with a section pointing to theme enforcement.
