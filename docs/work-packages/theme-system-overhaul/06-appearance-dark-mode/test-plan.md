---
title: 'Test Plan: Appearance — Dark Mode'
feature: appearance-dark-mode
type: test-plan
---

# Test Plan

## Contrast (automated)

- Full matrix: 3 themes × 2 appearances × ~25 role pairs → ~150 assertions. All pass WCAG AA.

## Playwright

- Default appearance = system; system in dark; page loads dark; `<html data-appearance="dark">`.
- User picks light; cookie set; reload; page loads light.
- User picks dark; cookie set; reload; page loads dark.
- User picks system with system in light; cookie set; reload; page loads light.
- Simulate system change from light to dark while page open (when user picked system): page restyles without reload.

## Manual

- Every route in light and dark: scan for any surface that looks broken (orphan white background, hex color that didn't migrate, unreadable text).
- First paint in dark: no flash.
- Dashboard (flightdeck) in dark: feels intentional, not broken.
- Login page in dark: toggle works pre-login.

## Regression

- Previously-tested contrast pairs still pass.
- No new lint violations introduced by palette changes.
- FOUC test from #4 still green.
