---
title: 'Out of Scope: Design token convergence pass'
product: platform
feature: wp-design-token-convergence
type: out-of-scope
status: unread
---

# Out of Scope: Design token convergence pass

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                | Status   | Trigger to revisit                                            |
| ------------------- | -------- | ------------------------------------------------------------- |
| Tone / color tokens | Rejected | Never -- already tokenized; convergence pass does not revisit |
| Spacing tokens      | Rejected | Never -- already tokenized; convergence pass does not revisit |
| Typography tokens   | Rejected | Never -- already tokenized; convergence pass does not revisit |

## Tone / color tokens

Status: Rejected

What was rejected:
Adding or migrating tone / color tokens as part of this WP.

Why:
Tone and color tokens are already tokenized in [libs/themes/contract.ts](../../../libs/themes/contract.ts) and consumed via the canonical theme emission pipeline. This WP is a convergence pass targeting **three specific gaps** (icon sizing, overlay sizing, focus-ring shadow recipe, plus instrument SVG label constants). Rolling color into the scope would inflate the change set and obscure the convergence story.

References:

- [spec.md](./spec.md) -- "Out of scope" listed tone / color tokens
- [docs/work/reviews/2026-05-02-ui-library-themes-patterns.md](../../work/reviews/2026-05-02-ui-library-themes-patterns.md) -- source review identified the three specific gaps

## Spacing tokens

Status: Rejected

What was rejected:
Adding or migrating spacing tokens as part of this WP.

Why:
Spacing tokens are already tokenized in the themes contract. The convergence pass is intentionally narrow -- it codifies the three patterns that the chunk-5 patterns review surfaced as convergent across multiple files, not every conceivable token family.

References:

- [spec.md](./spec.md) -- "Out of scope" listed spacing tokens
- [docs/work/reviews/2026-05-02-ui-library-themes-patterns.md](../../work/reviews/2026-05-02-ui-library-themes-patterns.md) -- source review

## Typography tokens

Status: Rejected

What was rejected:
Adding or migrating typography tokens (font families, weights, line-heights, sizes) as part of this WP.

Why:
Typography is already tokenized. The instrument SVG label constants section of this WP is **not** a typography token effort -- those are unitless SVG coordinates that share a constants module rather than a CSS custom property family, and they belong to the `libs/activities/src/cockpit-panel/` boundary, not the themes contract.

References:

- [spec.md](./spec.md) -- "Out of scope" listed typography tokens
- [spec.md](./spec.md) "Instrument SVG label sizes" -- the SVG constants explicitly framed as not-typography-tokens
