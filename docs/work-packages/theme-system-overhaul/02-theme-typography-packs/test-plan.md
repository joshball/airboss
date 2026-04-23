---
title: 'Test Plan: Typography Packs'
feature: theme-typography-packs
type: test-plan
---

# Test Plan

## Unit

- Pack type-checks.
- Emitter expands a bundle to the expected five CSS variables.
- Size adjustments apply: pack with `serif: 0.95` produces a heading whose `size` value is 0.95× base.

## Visual

- Pixel-diff study routes before/after. Web routes should look visually unchanged (same fonts). Dashboard should look visually unchanged (mono still mono, sizes compressed).

## Type

- Bundle key typos fail compile (`pack.bundles.readng` must not type-check).
