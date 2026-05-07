---
pr: 114
date: 2026-04-24
title: "refactor(themes): migrate palettes to oklch + contrast matrix measures them (WP#8)"
wp_id: theme-system-overhaul
bugs_fixed: []
summary: |
  Work package #8 of the theme-system-overhaul series lands OKLCH as the authoring representation for every palette. libs/themes/contrast.ts now measures OKLCH directly via CSS Color 4 matrices (OKLab intermediate), so the contrast matrix no longer skips themes that aren't all-hex. Every (theme, appearance) pair across airboss/default, study/sectional, study/flightdeck, and sim/glass is measured; all 11 required role-pairs pass WCAG AA.
---
