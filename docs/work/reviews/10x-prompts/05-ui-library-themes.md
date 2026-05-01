# Chunk 5 -- UI library and themes

Paste the block below as the first message in a fresh Claude Code session.

---

```text
/ball-review-10x

Scope is locked. Do NOT re-negotiate it -- review exactly what is listed below.

## What to review
Shared UI primitives, design tokens, theming, and domain-coupled visual components.

- `libs/ui/` -- entire library: components, primitives, layouts, drawers, modals, forms, tables, charts, anything reusable. Include co-located tests.
- `libs/themes/` -- design tokens, theme definitions, theme tests under `__tests__/`, theme-lint and theme-codemod outputs if present in the lib
- `libs/activities/` -- domain-coupled visual components (Crosswind and any others under this lib)
- `libs/help/` -- help library and the page-help drawer subsystem (UI surface only -- if there's a backend piece, include it but flag it)
- Any Storybook / playground files under these libs if present
- Top-level `app.css`, `app.html` only if shared via the UI lib

## What is NOT in scope
- App-local components inside `apps/study/src/lib/` or `apps/hangar/src/lib/` -- chunks 1 and 6.
- Routes that consume these components -- chunks 1 and 6.
- BC code -- chunks 2 and others.
- Source render pipeline (`libs/sources/render/`) -- chunk 4.

If a UI component is consumed somewhere, READ those call sites for context but do not raise findings outside the UI/themes/activities/help libs.

## Project context the reviewers must respect
- Read `CLAUDE.md` at repo root and `libs/ui/CLAUDE.md` / `libs/themes/CLAUDE.md` if present.
- Read `docs/platform/DESIGN_PRINCIPLES.md` and `docs/platform/VOCABULARY.md`.
- Hard rules: Svelte 5 runes only (no `$:`, no `export let`, no `<slot>`, no Svelte 4 stores), `$app/state` not `$app/stores`, `.svelte.ts` for rune files outside components, snippets via `{#snippet}`/`{@render}`, no `any`, no magic strings, use `@ab/*` aliases.
- Theme tokens are first-class -- flag any inline hex / rgb / px values that should reference tokens. Per project memory, "token migration passes run last" -- this review may surface a sweep target, not blockers.
- a11y is non-negotiable for shared primitives. Keyboard, focus management, ARIA, color contrast against tokens, motion preferences.

## Reviewers to launch (floor -- detect stack and add more if appropriate)
Core: correctness, perf, architecture, a11y, patterns, testing, dx.
SvelteKit-specific: ux, svelte.
Skip: security (minimal surface here -- include only if obvious XSS/HTML-injection vectors exist in render), backend, schema, tauri/rust/dotnet/maui.

## Spec context
Check `docs/work-packages/` for design-system, theming, drawer, help, page-help packages. Check `docs/decisions/` for ADRs touching design tokens, themes, page-help, drawers. Pass matching `spec.md` and ADR content to the relevant agents.

## Output
Each agent writes one review file to `docs/work/reviews/{YYYY-MM-DD}-ui-library-themes-{category}.md`. After all agents complete, build the summary table and report findings. Do NOT auto-fix -- present the punch list and await my call on `/ball-review-fix`.
```
